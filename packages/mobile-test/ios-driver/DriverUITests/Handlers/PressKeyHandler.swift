import FlyingFox
import XCTest

@MainActor
struct PressKeyHandler: HTTPHandler {
    private let typingSpeed = 30

    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        guard let body = try? await JSONDecoder().decode(PressKeyRequest.self, from: request.bodyData) else {
            return AppError(type: .precondition, message: "Invalid request body for /pressKey").httpResponse
        }

        do {
            let eventRecord = EventRecord()
            _ = eventRecord.addTextInput(body.xctestKey, typingSpeed: typingSpeed)
            try await RunnerDaemonProxy().synthesize(eventRecord: eventRecord)
            return HTTPResponse(statusCode: .ok)
        } catch {
            return AppError(message: "Error pressing key: \(error.localizedDescription)").httpResponse
        }
    }
}
