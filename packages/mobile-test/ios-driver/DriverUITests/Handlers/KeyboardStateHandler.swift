import FlyingFox
import XCTest

@MainActor
struct KeyboardStateHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        do {
            let bundleId = request.query["bundleId"]
            let app = bundleId.map(XCUIApplication.init(bundleIdentifier:)) ?? XCUIApplication()
            let responseBody = try JSONEncoder().encode(
                KeyboardStateResponse(visible: app.keyboards.firstMatch.exists)
            )

            return HTTPResponse(statusCode: .ok, body: responseBody)
        } catch {
            return AppError(message: "Error getting keyboard state: \(error.localizedDescription)").httpResponse
        }
    }
}
