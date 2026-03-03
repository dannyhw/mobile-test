import FlyingFox
import XCTest
import os

@MainActor
struct EraseTextHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        guard let body = try? await JSONDecoder().decode(EraseTextRequest.self, from: request.bodyData) else {
            return AppError(type: .precondition, message: "Invalid request body for /eraseText").httpResponse
        }

        do {
            let count = body.charactersToErase
            guard count > 0 else {
                return HTTPResponse(statusCode: .ok)
            }

            // Send delete key presses to erase text (same approach as Maestro)
            let deleteChar = XCUIKeyboardKey.delete.rawValue
            let deleteText = String(repeating: deleteChar, count: count)

            let eventRecord = EventRecord()
            _ = eventRecord.addTextInput(deleteText, typingSpeed: 30)
            try await RunnerDaemonProxy().synthesize(eventRecord: eventRecord)

            return HTTPResponse(statusCode: .ok)
        } catch {
            return AppError(message: "Error erasing text: \(error.localizedDescription)").httpResponse
        }
    }
}
