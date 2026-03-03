import FlyingFox
import XCTest

@MainActor
struct TerminateAppHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        guard let body = try? await JSONDecoder().decode(TerminateAppRequest.self, from: request.bodyData) else {
            return AppError(type: .precondition, message: "Invalid request body for /terminateApp").httpResponse
        }

        let app = XCUIApplication(bundleIdentifier: body.bundleId)
        app.terminate()
        return HTTPResponse(statusCode: .ok)
    }
}
