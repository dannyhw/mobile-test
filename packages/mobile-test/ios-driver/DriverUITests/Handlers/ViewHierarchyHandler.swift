import FlyingFox
import XCTest
import os

@MainActor
struct ViewHierarchyHandler: HTTPHandler {
    private static let snapshotMaxDepth = 60

    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        let bundleId = request.query["bundleId"]

        do {
            // Set maxDepth for deep React Native trees
            AXClientSwizzler.overwriteDefaultParameters["maxDepth"] = Self.snapshotMaxDepth

            let app: XCUIApplication
            if let bundleId = bundleId {
                app = XCUIApplication(bundleIdentifier: bundleId)
            } else {
                // Default to springboard if no bundleId specified
                app = XCUIApplication(bundleIdentifier: "com.apple.springboard")
            }

            let snapshotDict = try app.snapshot().dictionaryRepresentation
            let element = AXElement(snapshotDict)
            let body = try JSONEncoder().encode(element)
            return HTTPResponse(statusCode: .ok, body: body)
        } catch {
            return AppError(message: "Error getting view hierarchy: \(error.localizedDescription)").httpResponse
        }
    }
}
