import FlyingFox
import Foundation

@MainActor
struct StatusHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        let response = StatusResponse(status: "ready")
        let body = try JSONEncoder().encode(response)
        return HTTPResponse(statusCode: .ok, body: body)
    }
}
