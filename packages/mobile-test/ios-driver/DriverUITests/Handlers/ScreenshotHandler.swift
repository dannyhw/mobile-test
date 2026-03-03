import FlyingFox
import XCTest

@MainActor
struct ScreenshotHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        let screenshot = XCUIScreen.main.screenshot()
        let png = screenshot.pngRepresentation

        return HTTPResponse(
            statusCode: .ok,
            headers: [.contentType: "image/png"],
            body: png
        )
    }
}
