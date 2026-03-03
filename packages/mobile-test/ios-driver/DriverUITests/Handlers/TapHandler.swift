import FlyingFox
import XCTest
import os

@MainActor
struct TapHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        guard let body = try? await JSONDecoder().decode(TapRequest.self, from: request.bodyData) else {
            return AppError(type: .precondition, message: "Invalid request body for /tap").httpResponse
        }

        do {
            let point = CGPoint(x: CGFloat(body.x), y: CGFloat(body.y))
            let eventRecord = EventRecord()
            _ = eventRecord.addPointerTouchEvent(at: point, touchUpAfter: body.duration)
            try await RunnerDaemonProxy().synthesize(eventRecord: eventRecord)
            return HTTPResponse(statusCode: .ok)
        } catch {
            return AppError(message: "Error tapping: \(error.localizedDescription)").httpResponse
        }
    }
}
