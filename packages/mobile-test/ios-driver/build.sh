#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DERIVED_DATA_PATH="./build"
DESTINATION="${DESTINATION:-generic/platform=iOS Simulator}"
OUTPUT_DIR="../dist/ios-driver"
PROJECT_FILE="MobileTestDriver.xcodeproj"

echo "Building iOS driver for simulator..."

rm -rf "$DERIVED_DATA_PATH"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/Debug-iphonesimulator"

if [ ! -d "$PROJECT_FILE" ]; then
  echo "Generating Xcode project from project.yml..."
  xcodegen generate
fi

xcodebuild clean build-for-testing \
  -project "$PROJECT_FILE" \
  -scheme DriverApp \
  -destination "$DESTINATION" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  -quiet

BUILD_PRODUCTS="$DERIVED_DATA_PATH/Build/Products/Debug-iphonesimulator"

# Copy artifacts preserving the directory structure expected by xctestrun
cp -r "$BUILD_PRODUCTS/DriverUITests-Runner.app" "$OUTPUT_DIR/Debug-iphonesimulator/"
cp -r "$BUILD_PRODUCTS/DriverApp.app" "$OUTPUT_DIR/Debug-iphonesimulator/"

# Copy PackageFrameworks if present (FlyingFox)
if [ -d "$BUILD_PRODUCTS/PackageFrameworks" ]; then
  cp -r "$BUILD_PRODUCTS/PackageFrameworks" "$OUTPUT_DIR/Debug-iphonesimulator/"
fi

# Copy the xctestrun file (goes in the root, __TESTROOT__ resolves to its parent)
XCTESTRUN_FILE=$(find "$DERIVED_DATA_PATH/Build/Products" -name "*.xctestrun" | head -n 1)
cp "$XCTESTRUN_FILE" "$OUTPUT_DIR/MobileTestDriver.xctestrun"

# Clean up build directory
rm -rf "$DERIVED_DATA_PATH"

echo "Build complete. Artifacts in $OUTPUT_DIR:"
find "$OUTPUT_DIR" -maxdepth 2 -type f -o -type d | head -20
