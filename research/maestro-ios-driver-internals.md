# Maestro iOS Driver Internals: Touch, Text Input, and View Hierarchy

Analysis of the exact private/public APIs and patterns used by the Maestro XCTest runner.

## Architecture Overview

Maestro runs an XCTest UI test that starts an HTTP server (using FlyingFox). The TypeScript/Java client sends HTTP requests to this server. The server uses private XCTest APIs to synthesize events and read the view hierarchy.

Key chain: **HTTP request -> Route Handler -> Private XCTest APIs -> iOS**

---

## 1. Touch Synthesis

### Private APIs Used

| Class | Method | Purpose |
|-------|--------|---------|
| `XCTRunnerDaemonSession` | `sharedSession` / `daemonProxy` | Gets the XCTest daemon proxy for event synthesis |
| `XCSynthesizedEventRecord` | `initWithName:interfaceOrientation:` | Creates an event record container |
| `XCPointerEventPath` | `initForTouchAtPoint:offset:` | Creates a touch-down event at a point |
| `XCPointerEventPath` | `liftUpAtOffset:` | Lifts the finger (touch-up) |
| `XCPointerEventPath` | `moveToPoint:atOffset:` | Moves touch to a new point (for swipes) |
| `XCSynthesizedEventRecord` | `addPointerEventPath:` | Adds a path to the event record |
| Daemon proxy | `_XCT_synthesizeEvent:completion:` | Sends the synthesized event to the system |

### How It Works

1. **RunnerDaemonProxy** accesses `XCTRunnerDaemonSession.sharedSession.daemonProxy` via reflection (`NSClassFromString` + `NSSelectorFromString` + `unsafeBitCast`).
2. **EventRecord** wraps `XCSynthesizedEventRecord` -- a container for one or more pointer event paths.
3. **PointerEventPath** wraps `XCPointerEventPath` -- represents a single finger's movement over time:
   - `initForTouchAtPoint:offset:` = finger touches down
   - `moveToPoint:atOffset:` = finger drags (swipe)
   - `liftUpAtOffset:` = finger lifts
4. The event record is sent to the daemon via `_XCT_synthesizeEvent:completion:`.

### Tap Flow (Minimal)

```swift
let eventRecord = EventRecord(orientation: .portrait)
let path = PointerEventPath.pathForTouch(at: CGPoint(x: 100, y: 200))
path.offset += 0.1  // hold for 100ms
path.liftUp()
eventRecord.add(path)
RunnerDaemonProxy().synthesize(eventRecord: eventRecord)
```

### Swipe Flow (Minimal)

```swift
let eventRecord = EventRecord(orientation: .portrait)
let path = PointerEventPath.pathForTouch(at: startPoint)
path.offset += 0.1
path.moveTo(point: endPoint)
path.offset += duration
path.liftUp()
eventRecord.add(path)
RunnerDaemonProxy().synthesize(eventRecord: eventRecord)
```

### What We Must Keep
- The `RunnerDaemonProxy` pattern for accessing `XCTRunnerDaemonSession` -- this is the only way to synthesize events without custom app builds.
- The `EventRecord` / `PointerEventPath` wrappers around `XCSynthesizedEventRecord` and `XCPointerEventPath`.
- The `unsafeBitCast` + `@convention(c)` pattern for calling private ObjC methods from Swift.

### What We Can Simplify
- Remove orientation-aware point translation (handle in TypeScript layer instead).
- Flatten `EventRecord` and `PointerEventPath` into a simpler API with methods like `tap(x, y)`, `swipe(from, to, duration)`.
- Remove FlyingFox HTTP layer (we can call these directly from our XCTest runner).

---

## 2. Text Input

### Private APIs Used

| Class | Method | Purpose |
|-------|--------|---------|
| Daemon proxy | `_XCT_sendString:maximumFrequency:completion:` | Alternative: send string directly to focused field |
| `XCPointerEventPath` | `initForTextInput` | Creates a text input event path |
| `XCPointerEventPath` | `typeText:atOffset:typingSpeed:shouldRedact:` | Types text via event synthesis |

### How It Works (Event Synthesis approach - what Maestro actually uses)

1. Wait for keyboard to be visible (`app.keyboards.firstMatch.exists`).
2. Create a `PointerEventPath.pathForTextInput()` -- special path type for text, not touch.
3. Call `path.type(text:typingSpeed:)` to queue the keystrokes.
4. Wrap in an `EventRecord` and synthesize via `RunnerDaemonProxy`.

### Important Workaround

Maestro splits text input into two parts:
- First character typed at speed 1 (slow) to avoid autocorrect/keyboard listener issues.
- 500ms pause.
- Remaining characters typed at speed 30 (fast).

This is a critical workaround for iOS dropping characters.

### Alternative: Direct String Sending

`RunnerDaemonProxy.send(string:typingFrequency:)` calls `_XCT_sendString:maximumFrequency:completion:` on the daemon proxy. This is simpler but Maestro chose the event synthesis path instead (likely for reliability).

### What We Must Keep
- The `PointerEventPath.pathForTextInput()` + `typeText` pattern.
- The slow-first-character workaround (or we need to find our own solution to dropped characters).
- Keyboard presence check before typing.

### What We Can Simplify
- Try the `_XCT_sendString` approach first; fall back to event synthesis if needed.
- Expose a single `type(text)` method that handles the workarounds internally.

---

## 3. View Hierarchy

### APIs Used

| API | Type | Purpose |
|-----|------|---------|
| `XCUIApplication(bundleIdentifier:)` | Public XCTest | Get app reference without launching it |
| `XCUIElement.snapshot()` | Public XCTest | Get accessibility snapshot |
| `.dictionaryRepresentation` | Semi-private | Convert snapshot to dictionary |
| `XCAXClient_iOS.defaultParameters` | Private | Controls snapshot parameters (maxDepth) |
| Method swizzling | Runtime | Override maxDepth for deep hierarchies |

### How It Works

1. Get the foreground app via `RunningApp.getForegroundApp()` (returns `XCUIApplication`).
2. Call `element.snapshot().dictionaryRepresentation` to get the full tree as a dictionary.
3. Recursively parse the dictionary into `AXElement` structs.
4. Merge app hierarchy + status bar + keyboard + alerts into one tree.

### AXElement Properties Extracted

- `identifier` (accessibilityIdentifier / testID)
- `label` (accessibilityLabel)
- `value` (accessibilityValue)
- `title`
- `frame` (X, Y, Width, Height)
- `elementType` (integer enum: button=1, staticText=48, etc.)
- `enabled`, `selected`, `hasFocus`
- `placeholderValue`
- `children` (recursive)

### AXClientSwizzler (maxDepth Override)

For apps with deep view hierarchies (60+ levels), the default XCTest snapshot throws `kAXErrorIllegalArgument`. Maestro works around this by:
1. Swizzling `XCAXClient_iOS.defaultParameters` to inject `maxDepth: 60`.
2. If snapshot still fails, walking the tree manually by fetching children one-by-one.

```swift
// The swizzle: replace defaultParameters on XCAXClient_iOS
let axClientiOSClass = objc_getClass("XCAXClient_iOS")
method_exchangeImplementations(original, replaced)
// The replaced method adds { "maxDepth": 60 } to the default dictionary
```

### Recovery Strategy for Deep Hierarchies

When `snapshot().dictionaryRepresentation` throws `kAXErrorIllegalArgument`:
1. Navigate to the first meaningful child element.
2. Snapshot that subtree instead.
3. Separately fetch keyboard, alerts, and other window elements.
4. Merge everything into a single tree.

### What We Must Keep
- `XCUIApplication(bundleIdentifier:)` to attach to running apps without launching.
- `snapshot().dictionaryRepresentation` for getting the hierarchy.
- The `AXClientSwizzler` maxDepth override for deep hierarchies.
- The recovery/fallback strategy for large view trees.
- Frame offset adjustment for apps that don't fill the screen.

### What We Can Simplify
- Strip down `AXElement` to just what we need: `identifier`, `label`, `value`, `frame`, `elementType`, `enabled`, `children`. Remove `horizontalSizeClass`, `verticalSizeClass`, `displayID`, `windowContextID` unless needed.
- Skip Safari WebView special handling initially (iOS 26+ edge case).
- Skip status bar merging initially.
- Simplify the multi-fallback hierarchy fetching -- start with the simple path, add fallbacks only when we hit real issues.

---

## Summary: Minimal Core We Need

### Swift Code Required (~200 lines)

1. **RunnerDaemonProxy** (~50 lines): Access `XCTRunnerDaemonSession.sharedSession.daemonProxy`. Two methods: `synthesize(eventRecord:)` and `send(string:)`.

2. **EventRecord + PointerEventPath** (~60 lines): Wrappers for `XCSynthesizedEventRecord` and `XCPointerEventPath`. Support tap, swipe, and text input.

3. **ViewHierarchy** (~50 lines): Call `snapshot().dictionaryRepresentation`, parse into a JSON-serializable tree. Include the maxDepth swizzle.

4. **AXElement model** (~40 lines): Simplified struct with just the fields we need.

### Pattern for Calling Private APIs

All private API access follows the same pattern:
```swift
let clazz: AnyClass = NSClassFromString("PrivateClassName")!
let selector = NSSelectorFromString("privateMethod:")
let imp = object.method(for: selector)
typealias Method = @convention(c) (NSObject, Selector, ArgType) -> ReturnType
let method = unsafeBitCast(imp, to: Method.self)
let result = method(object, selector, arg)
```

This is the standard ObjC runtime reflection pattern and is safe to use in XCTest runners (they are not App Store apps, so private API restrictions don't apply).
