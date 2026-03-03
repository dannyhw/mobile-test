import FlyingFox
import XCTest
import os

@MainActor
struct SwipeHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        guard let body = try? await JSONDecoder().decode(SwipeRequest.self, from: request.bodyData) else {
            return AppError(type: .precondition, message: "Invalid request body for /swipe").httpResponse
        }

        do {
            let start = CGPoint(x: CGFloat(body.startX), y: CGFloat(body.startY))
            let end = CGPoint(x: CGFloat(body.endX), y: CGFloat(body.endY))
            let duration = body.duration ?? 0.5

            let description = "Swipe from \(start.debugDescription) to \(end.debugDescription) with \(duration) duration"
            try EventTarget().dispatchEvent(description: description) {
                EventRecord().addSwipeEvent(start: start, end: end, duration: duration)
            }
            return HTTPResponse(statusCode: .ok)
        } catch {
            return AppError(message: "Error swiping: \(error.localizedDescription)").httpResponse
        }
    }
}
