import FlyingFox
import Foundation
import os

struct DriverServer {

    private static let logger = Logger(
        subsystem: "dev.mobiletest.driver",
        category: "DriverServer"
    )

    func start() async throws {
        let portString = ProcessInfo.processInfo.environment["MOBILE_TEST_PORT"]
        let port = portString.flatMap { UInt16($0) } ?? 22087

        let server = HTTPServer(
            address: try .inet(ip4: "127.0.0.1", port: port),
            timeout: 100
        )

        await registerRoutes(on: server)

        Self.logger.info("Driver server listening on port \(port)")
        try await server.run()
    }

    @MainActor
    private func registerRoutes(on server: HTTPServer) async {
        // Health + info
        await server.appendRoute(HTTPRoute("status"), to: StatusHandler())
        await server.appendRoute(HTTPRoute("deviceInfo"), to: DeviceInfoHandler())
        await server.appendRoute(HTTPRoute("keyboard"), to: KeyboardStateHandler())
        await server.appendRoute(HTTPRoute("screenshot"), to: ScreenshotHandler())

        // Actions
        await server.appendRoute(HTTPRoute("tap"), to: TapHandler())
        await server.appendRoute(HTTPRoute("doubleTap"), to: DoubleTapHandler())
        await server.appendRoute(HTTPRoute("swipe"), to: SwipeHandler())
        await server.appendRoute(HTTPRoute("typeText"), to: TypeTextHandler())
        await server.appendRoute(HTTPRoute("pressKey"), to: PressKeyHandler())
        await server.appendRoute(HTTPRoute("eraseText"), to: EraseTextHandler())
        await server.appendRoute(HTTPRoute("clearText"), to: ClearTextHandler())

        // View hierarchy
        await server.appendRoute(HTTPRoute("viewHierarchy"), to: ViewHierarchyHandler())

        // App lifecycle
        await server.appendRoute(HTTPRoute("launchApp"), to: LaunchAppHandler())
        await server.appendRoute(HTTPRoute("terminateApp"), to: TerminateAppHandler())
    }
}
