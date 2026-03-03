import FlyingFox
import XCTest
import os

@MainActor
struct DoubleTapHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        guard let body = try? await JSONDecoder().decode(TapRequest.self, from: request.bodyData) else {
            return AppError(type: .precondition, message: "Invalid request body for /doubleTap").httpResponse
        }

        do {
            let point = CGPoint(x: CGFloat(body.x), y: CGFloat(body.y))
            let tapDuration = EventRecord.defaultTapDuration

            // First tap
            let eventRecord = EventRecord()
            var path1 = PointerEventPath.pathForTouch(at: point)
            path1.offset += tapDuration
            path1.liftUp()
            _ = eventRecord.add(path1)

            // Second tap with offset after first tap completes
            let gap = 0.05 // 50ms gap between taps
            var path2 = PointerEventPath.pathForTouch(at: point, offset: tapDuration + gap)
            path2.offset += tapDuration
            path2.liftUp()
            _ = eventRecord.add(path2)

            try await RunnerDaemonProxy().synthesize(eventRecord: eventRecord)
            return HTTPResponse(statusCode: .ok)
        } catch {
            return AppError(message: "Error double-tapping: \(error.localizedDescription)").httpResponse
        }
    }
}
