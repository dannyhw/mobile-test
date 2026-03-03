import Foundation
import XCTest

private var _overwriteDefaultParameters = [String: Int]()

struct AXClientSwizzler {
    fileprivate static let proxy = AXClientiOS_Standin()

    private init() {}

    static var overwriteDefaultParameters: [String: Int] {
        get { _overwriteDefaultParameters }
        set { setup; _overwriteDefaultParameters = newValue }
    }

    static let setup: Void = {
        let axClientiOSClass: AnyClass = objc_getClass("XCAXClient_iOS") as! AnyClass
        let defaultParametersSelector = Selector(("defaultParameters"))
        let original = class_getInstanceMethod(axClientiOSClass, defaultParametersSelector)!

        let replaced = class_getInstanceMethod(
            AXClientiOS_Standin.self,
            #selector(AXClientiOS_Standin.swizzledDefaultParameters))!

        method_exchangeImplementations(original, replaced)
    }()
}

@objc private class AXClientiOS_Standin: NSObject {
    func originalDefaultParameters() -> NSDictionary {
        let selector = Selector(("defaultParameters"))
        let swizzledSelector = #selector(swizzledDefaultParameters)
        let imp = class_getMethodImplementation(AXClientiOS_Standin.self, swizzledSelector)
        typealias Method = @convention(c) (NSObject, Selector) -> NSDictionary
        let method = unsafeBitCast(imp, to: Method.self)
        return method(self, selector)
    }

    @objc func swizzledDefaultParameters() -> NSDictionary {
        let defaultParameters = originalDefaultParameters().mutableCopy() as! NSMutableDictionary
        for (key, value) in _overwriteDefaultParameters {
            defaultParameters[key] = value
        }
        return defaultParameters
    }
}
