#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OUTPUT_DIR="../dist/android-driver"
APP_APK="app/build/outputs/apk/debug/app-debug.apk"
TEST_APK="app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"

echo "Building Android driver instrumentation artifacts..."

rm -rf "$OUTPUT_DIR"
./gradlew --no-daemon :app:assembleDebug :app:assembleDebugAndroidTest

mkdir -p "$OUTPUT_DIR"
cp "$APP_APK" "$OUTPUT_DIR/MobileTestDriver.apk"
cp "$TEST_APK" "$OUTPUT_DIR/MobileTestDriverTest.apk"

echo "Build complete. Artifacts in $OUTPUT_DIR:"
find "$OUTPUT_DIR" -maxdepth 1 -type f | sort

