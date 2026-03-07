import FlyingFox
import XCTest

@MainActor
struct ClearTextHandler: HTTPHandler {
    private static let focusSettleDelayNs: UInt64 = 150_000_000
    private static let postActionDelayNs: UInt64 = 250_000_000
    private static let maxDeleteIterations = 24
    private static let stagnantIterationsBeforeFail = 3
    private static let selectAllLabels = ["Select All", "Select all"]
    private static let clearKeywords = ["clear"]
    private static let editableElementTypes: Set<Int> = [
        Int(XCUIElement.ElementType.textField.rawValue),
        Int(XCUIElement.ElementType.secureTextField.rawValue),
        Int(XCUIElement.ElementType.searchField.rawValue),
        Int(XCUIElement.ElementType.textView.rawValue),
    ]

    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        guard let body = try? await JSONDecoder().decode(ClearTextRequest.self, from: request.bodyData) else {
            return AppError(type: .precondition, message: "Invalid request body for /clearText").httpResponse
        }

        do {
            let app = body.bundleId.map(XCUIApplication.init(bundleIdentifier:)) ?? XCUIApplication()
            let target = ClearTarget(request: body)

            guard let initialElement = try editableElement(in: app, matching: target) else {
                return AppError(
                    type: .precondition,
                    message: "Could not find the requested editable element to clear."
                ).httpResponse
            }

            if isEffectivelyEmpty(initialElement) {
                return HTTPResponse(statusCode: .ok)
            }

            try await tap(at: target.center)
            try await Task.sleep(nanoseconds: Self.focusSettleDelayNs)

            if tapNativeClearAffordance(in: app, target: target) {
                try await Task.sleep(nanoseconds: Self.postActionDelayNs)
                if try editableElement(in: app, matching: target).map(isEffectivelyEmpty) == true {
                    return HTTPResponse(statusCode: .ok)
                }
            }

            if try await selectAllAndDelete(in: app, target: target) {
                if try editableElement(in: app, matching: target).map(isEffectivelyEmpty) == true {
                    return HTTPResponse(statusCode: .ok)
                }
            }

            if try await deleteUntilEmpty(in: app, target: target) {
                return HTTPResponse(statusCode: .ok)
            }

            return AppError(
                type: .timeout,
                message: "Failed to clear the requested input. The field never reached an empty value."
            ).httpResponse
        } catch {
            return AppError(message: "Error clearing text: \(error.localizedDescription)").httpResponse
        }
    }

    private func editableElement(in app: XCUIApplication, matching target: ClearTarget) throws -> AXElement? {
        let snapshot = try app.snapshot().dictionaryRepresentation
        if let best = bestEditableMatch(in: AXElement(snapshot), target: target) {
            return best.element
        }
        return nil
    }

    private func bestEditableMatch(in node: AXElement, target: ClearTarget) -> (element: AXElement, score: Int)? {
        var best: (element: AXElement, score: Int)?

        if let score = score(node, for: target) {
            best = (node, score)
        }

        for child in node.children ?? [] {
            guard let candidate = bestEditableMatch(in: child, target: target) else { continue }
            if best == nil || candidate.score > best!.score {
                best = candidate
            }
        }

        return best
    }

    private func score(_ element: AXElement, for target: ClearTarget) -> Int? {
        guard Self.editableElementTypes.contains(element.elementType) else { return nil }

        let rect = rect(from: element.frame)
        let targetRect = target.rect
        let targetCenter = target.center
        let containsCenter = rect.contains(targetCenter)
        let intersectsTarget = rect.intersects(targetRect)
        guard containsCenter || intersectsTarget else { return nil }

        var score = 0
        if let identifier = target.identifier, !identifier.isEmpty, element.identifier == identifier {
            score += 10_000
        }
        if containsCenter {
            score += 1_000
        }

        let area = max(Int(rect.width * rect.height), 1)
        score -= area / 10
        return score
    }

    private func isEffectivelyEmpty(_ element: AXElement) -> Bool {
        normalizedValue(of: element).isEmpty
    }

    private func normalizedValue(of element: AXElement) -> String {
        guard let value = element.value, !value.isEmpty else {
            return ""
        }
        if let placeholder = element.placeholderValue, value == placeholder {
            return ""
        }
        return value
    }

    private func tapNativeClearAffordance(in app: XCUIApplication, target: ClearTarget) -> Bool {
        for button in app.descendants(matching: .button).allElementsBoundByIndex {
            guard button.exists, button.isHittable else { continue }
            guard isPotentialClearButton(button) else { continue }

            let buttonCenter = CGPoint(x: button.frame.midX, y: button.frame.midY)
            guard target.rect.contains(buttonCenter) else { continue }

            button.tap()
            return true
        }

        return false
    }

    private func isPotentialClearButton(_ element: XCUIElement) -> Bool {
        let tokens = [element.identifier, element.label, element.value as? String]
            .compactMap { $0?.lowercased() }

        return tokens.contains { token in
            Self.clearKeywords.contains(where: token.contains)
        }
    }

    private func selectAllAndDelete(in app: XCUIApplication, target: ClearTarget) async throws -> Bool {
        try await longPress(at: target.center, duration: 1.0)
        try await Task.sleep(nanoseconds: Self.postActionDelayNs)

        guard let selectAll = selectAllControl(in: app) else {
            return false
        }

        selectAll.tap()
        try await Task.sleep(nanoseconds: Self.postActionDelayNs)
        try await sendDeletes(count: 1)
        try await Task.sleep(nanoseconds: Self.postActionDelayNs)
        return true
    }

    private func selectAllControl(in app: XCUIApplication) -> XCUIElement? {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let queries = [
            app.descendants(matching: .menuItem),
            app.descendants(matching: .button),
            springboard.descendants(matching: .menuItem),
            springboard.descendants(matching: .button),
        ]

        for query in queries {
            for label in Self.selectAllLabels {
                let match = query.matching(NSPredicate(format: "label == %@", label)).firstMatch
                if match.exists, match.isHittable {
                    return match
                }
            }
        }

        return nil
    }

    private func deleteUntilEmpty(in app: XCUIApplication, target: ClearTarget) async throws -> Bool {
        var previousValue: String?
        var stagnantIterations = 0

        for _ in 0..<Self.maxDeleteIterations {
            guard let element = try editableElement(in: app, matching: target) else {
                return false
            }

            let value = normalizedValue(of: element)
            if value.isEmpty {
                return true
            }

            let deleteCount = min(max(value.count, 1), 12)
            try await sendDeletes(count: deleteCount)
            try await Task.sleep(nanoseconds: Self.postActionDelayNs)

            guard let updatedElement = try editableElement(in: app, matching: target) else {
                return false
            }

            let updatedValue = normalizedValue(of: updatedElement)
            if updatedValue.isEmpty {
                return true
            }

            if updatedValue == previousValue {
                stagnantIterations += 1
                if stagnantIterations >= Self.stagnantIterationsBeforeFail {
                    return false
                }
            } else {
                stagnantIterations = 0
            }

            previousValue = updatedValue
        }

        return false
    }

    private func sendDeletes(count: Int) async throws {
        guard count > 0 else { return }

        let deleteText = String(repeating: XCUIKeyboardKey.delete.rawValue, count: count)
        let eventRecord = EventRecord()
        _ = eventRecord.addTextInput(deleteText, typingSpeed: 30)
        try await RunnerDaemonProxy().synthesize(eventRecord: eventRecord)
    }

    private func tap(at point: CGPoint) async throws {
        let eventRecord = EventRecord()
        _ = eventRecord.addPointerTouchEvent(at: point, touchUpAfter: nil)
        try await RunnerDaemonProxy().synthesize(eventRecord: eventRecord)
    }

    private func longPress(at point: CGPoint, duration: TimeInterval) async throws {
        let eventRecord = EventRecord()
        _ = eventRecord.addPointerTouchEvent(at: point, touchUpAfter: duration)
        try await RunnerDaemonProxy().synthesize(eventRecord: eventRecord)
    }

    private func rect(from frame: AXFrame) -> CGRect {
        CGRect(
            x: frame["X"] ?? 0,
            y: frame["Y"] ?? 0,
            width: frame["Width"] ?? 0,
            height: frame["Height"] ?? 0
        )
    }
}

private struct ClearTarget {
    let identifier: String?
    let rect: CGRect

    init(request: ClearTextRequest) {
        self.identifier = request.identifier
        self.rect = CGRect(x: request.x, y: request.y, width: request.width, height: request.height)
    }

    var center: CGPoint {
        CGPoint(x: rect.midX, y: rect.midY)
    }
}
