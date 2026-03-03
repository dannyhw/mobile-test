import XCTest
import os

final class DriverTests: XCTestCase {

    private static let logger = Logger(
        subsystem: "dev.mobiletest.driver",
        category: "DriverTests"
    )

    override func setUpWithError() throws {
        // Prevent XCTest from aborting when internal assertions fail
        // (common with React Native accessibility trees)
        continueAfterFailure = true
    }

    func testDriverServer() async throws {
        let server = DriverServer()
        DriverTests.logger.info("Starting mobile-test driver HTTP server")
        try await server.start()
    }
}
