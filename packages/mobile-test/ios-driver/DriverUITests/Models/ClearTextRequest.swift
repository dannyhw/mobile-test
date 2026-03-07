import Foundation

struct ClearTextRequest: Decodable {
    let bundleId: String?
    let identifier: String?
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}
