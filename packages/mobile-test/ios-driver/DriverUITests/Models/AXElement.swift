import Foundation
import XCTest

typealias AXFrame = [String: Double]

extension AXFrame {
    static var zero: AXFrame { ["X": 0, "Y": 0, "Width": 0, "Height": 0] }
}

struct AXElement: Codable {
    let identifier: String
    let frame: AXFrame
    let value: String?
    let title: String?
    let label: String
    let elementType: Int
    let enabled: Bool
    let placeholderValue: String?
    let selected: Bool
    let hasFocus: Bool
    var children: [AXElement]?

    init(
        identifier: String = "",
        frame: AXFrame = .zero,
        value: String? = nil,
        title: String? = nil,
        label: String = "",
        elementType: Int = 0,
        enabled: Bool = false,
        placeholderValue: String? = nil,
        selected: Bool = false,
        hasFocus: Bool = false,
        children: [AXElement]? = nil
    ) {
        self.identifier = identifier
        self.frame = frame
        self.value = value
        self.title = title
        self.label = label
        self.elementType = elementType
        self.enabled = enabled
        self.placeholderValue = placeholderValue
        self.selected = selected
        self.hasFocus = hasFocus
        self.children = children
    }

    /// Initialize from XCUIElement snapshot dictionary
    init(_ dict: [XCUIElement.AttributeName: Any]) {
        func valueFor(_ name: String) -> Any {
            dict[XCUIElement.AttributeName(rawValue: name)] as Any
        }

        self.identifier = valueFor("identifier") as? String ?? ""
        self.label = valueFor("label") as? String ?? ""
        self.value = valueFor("value") as? String
        self.title = valueFor("title") as? String
        self.elementType = valueFor("elementType") as? Int ?? 0
        self.frame = valueFor("frame") as? AXFrame ?? .zero
        self.enabled = valueFor("enabled") as? Bool ?? false
        self.placeholderValue = valueFor("placeholderValue") as? String
        self.selected = valueFor("selected") as? Bool ?? false
        self.hasFocus = valueFor("hasFocus") as? Bool ?? false

        let childrenDicts = valueFor("children") as? [[XCUIElement.AttributeName: Any]]
        self.children = childrenDicts?.map { AXElement($0) }
    }
}
