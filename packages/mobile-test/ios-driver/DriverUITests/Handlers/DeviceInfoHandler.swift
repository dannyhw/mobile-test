import FlyingFox
import Foundation
import XCTest

@MainActor
struct DeviceInfoHandler: HTTPHandler {
    func handleRequest(_ request: HTTPRequest) async throws -> HTTPResponse {
        let screen = UIScreen.main
        let size = screen.bounds.size
        let scale = screen.scale

        let response = DeviceInfoResponse(
            widthPoints: Int(size.width),
            heightPoints: Int(size.height),
            widthPixels: Int(size.width * scale),
            heightPixels: Int(size.height * scale),
            scale: Double(scale)
        )

        let body = try JSONEncoder().encode(response)
        return HTTPResponse(statusCode: .ok, body: body)
    }
}
