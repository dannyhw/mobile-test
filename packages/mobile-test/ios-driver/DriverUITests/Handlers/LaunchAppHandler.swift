import FlyingFox
import XCTest

@MainActor
struct LaunchAppHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        guard let body = try? await JSONDecoder().decode(LaunchAppRequest.self, from: request.bodyData) else {
            return AppError(type: .precondition, message: "Invalid request body for /launchApp").httpResponse
        }

        let app = XCUIApplication(bundleIdentifier: body.bundleId)
        app.launch()
        return HTTPResponse(statusCode: .ok)
    }
}
