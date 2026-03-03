import FlyingFox
import XCTest
import os

@MainActor
struct TypeTextHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        guard let body = try? await JSONDecoder().decode(TypeTextRequest.self, from: request.bodyData) else {
            return AppError(type: .precondition, message: "Invalid request body for /typeText").httpResponse
        }

        do {
            let text = body.text
            guard !text.isEmpty else {
                return HTTPResponse(statusCode: .ok)
            }

            // Type the first character slowly to avoid dropped characters
            // from autocorrect/keyboard listener race conditions
            let firstChar = String(text.prefix(1))
            let rest = String(text.dropFirst())

            let firstRecord = EventRecord()
            _ = firstRecord.addTextInput(firstChar, typingSpeed: 1)
            try await RunnerDaemonProxy().synthesize(eventRecord: firstRecord)

            if !rest.isEmpty {
                // Brief pause between first and remaining characters
                try await Task.sleep(nanoseconds: 300_000_000) // 300ms

                let restRecord = EventRecord()
                _ = restRecord.addTextInput(rest, typingSpeed: 30)
                try await RunnerDaemonProxy().synthesize(eventRecord: restRecord)
            }

            return HTTPResponse(statusCode: .ok)
        } catch {
            return AppError(message: "Error typing text: \(error.localizedDescription)").httpResponse
        }
    }
}
