import Foundation

struct LaunchAppRequest: Codable {
    let bundleId: String
}

struct TerminateAppRequest: Codable {
    let bundleId: String
}
