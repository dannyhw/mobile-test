# odiff — Image Comparison Library

> https://github.com/dmtrKovalenko/odiff

## Why odiff over pixelmatch

| | odiff | pixelmatch |
|---|---|---|
| **Speed** | ~6x faster (SIMD-optimized Zig) | Pure JS, single-threaded |
| **Architecture** | Native binary with Node.js bindings | Pure JavaScript |
| **Ignore regions** | Built-in `ignoreRegions` option | Manual pre-processing needed |
| **Antialiasing** | Built-in detection | Basic support |
| **Layout diff** | Detects size changes as separate `layout-diff` | Fails silently or errors |
| **Server mode** | `ODiffServer` keeps persistent process | N/A, in-process only |
| **Result data** | Returns `diffPercentage`, `diffCount`, optional `diffLines` | Returns pixel count only |
| **Formats** | PNG, JPEG, WebP, TIFF | PNG only |

## Benchmarks

Full-page screenshot (~4500px wide):
- **odiff**: 1.168s
- pixelmatch: 7.712s (6.6x slower)
- ImageMagick: 8.881s (7.6x slower)

For CI with thousands of screenshots, this difference is enormous.

## Node.js API

### Basic usage

```typescript
import { compare } from 'odiff-bin'

const result = await compare('baseline.png', 'current.png', 'diff.png', {
  threshold: 0.1,          // color difference sensitivity (0-1)
  antialiasing: true,      // exclude antialiased pixels
  outputDiffMask: true,    // generate diff image
  ignoreRegions: [         // skip dynamic areas
    { x1: 0, y1: 0, x2: 200, y2: 44 }  // status bar
  ],
})

if (result.match) {
  // Images match
} else if (result.reason === 'pixel-diff') {
  console.log(`${result.diffPercentage}% different (${result.diffCount} pixels)`)
} else if (result.reason === 'layout-diff') {
  console.log('Images have different dimensions')
}
```

### Server mode (fast sequential comparisons)

```typescript
import { ODiffServer } from 'odiff-bin'

const server = new ODiffServer()

// Reuses the same process for all comparisons — no startup overhead
for (const test of tests) {
  const result = await server.compare(test.baseline, test.current, test.diff)
}

server.stop()
```

### Buffer comparison (no disk I/O)

```typescript
const result = await server.compareBuffers(
  baselineBuffer, 'png',
  currentBuffer, 'png',
  'diff.png',
  options
)
```

## How We'll Use It

1. **ODiffServer** as a singleton during test runs — one persistent process, fast sequential comparisons
2. **ignoreRegions** for masking dynamic content (status bar, timestamps, ads) — maps directly from element bounds
3. **threshold + maxDiffPercentage** as the two user-facing knobs:
   - `threshold` (0-1): how different a pixel color must be to count as changed
   - `maxDiffPercentage`: what % of changed pixels is acceptable
4. **antialiasing: true** by default to reduce false positives from rendering differences
5. **layout-diff** detection to give clear error messages when screen sizes change
6. **Diff image output** for debugging — shows exactly which pixels changed

## Installation

```bash
npm install odiff-bin
```

Ships prebuilt binaries for macOS (arm64/x64), Linux (arm64/x64), Windows. No native compilation needed.
