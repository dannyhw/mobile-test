import type { ElementHandle } from '../element/types.js'

/**
 * Minimal view of an agent-device snapshot node. Kept local so the rest of the
 * framework never imports agent-device types.
 */
export interface FlatSnapshotNode {
  index: number
  parentIndex?: number
  depth?: number
  role?: string
  type?: string
  label?: string
  value?: string
  identifier?: string
  rect?: { x: number; y: number; width: number; height: number }
  enabled?: boolean
  selected?: boolean
  focused?: boolean
  visibleToUser?: boolean
  hittable?: boolean
}

export interface SnapshotTreeOptions {
  /**
   * Divide rect values by this factor to get points. Use when a backend
   * reports rects in pixels (e.g. Android density) instead of points.
   */
  rectDivisor?: number
}

/**
 * Rebuild agent-device's flat node list into the `ElementHandle` tree the
 * element layer walks. Nodes are attached to their `parentIndex`; nodes with
 * no parent (or a parent that is missing from the list) become children of a
 * synthetic root whose frame is the union of its children.
 */
export function snapshotToTree(nodes: FlatSnapshotNode[], options?: SnapshotTreeOptions): ElementHandle {
  const divisor = options?.rectDivisor && options.rectDivisor > 0 ? options.rectDivisor : 1
  const handles = new Map<number, ElementHandle>()

  for (const node of nodes) {
    handles.set(node.index, toHandle(node, divisor))
  }

  const roots: ElementHandle[] = []
  for (const node of nodes) {
    const handle = handles.get(node.index)!
    const parent = node.parentIndex !== undefined ? handles.get(node.parentIndex) : undefined
    if (parent && parent !== handle) {
      ;(parent.children ??= []).push(handle)
    } else {
      roots.push(handle)
    }
  }

  if (roots.length === 1) return roots[0]

  return {
    identifier: '',
    label: '',
    frame: unionFrame(roots),
    elementType: 0,
    role: 'root',
    enabled: true,
    selected: false,
    hasFocus: false,
    children: roots,
  }
}

function toHandle(node: FlatSnapshotNode, divisor: number): ElementHandle {
  const rect = node.rect ?? { x: 0, y: 0, width: 0, height: 0 }
  return {
    identifier: node.identifier ?? '',
    label: node.label ?? '',
    value: node.value,
    frame: {
      X: rect.x / divisor,
      Y: rect.y / divisor,
      Width: rect.width / divisor,
      Height: rect.height / divisor,
    },
    elementType: 0,
    // iOS raw snapshots report XCUIElementType names ("Button", "TextField");
    // Android reports class names. Lowercase so `by.role('button')` is stable.
    role: (node.role ?? node.type)?.toLowerCase(),
    enabled: node.enabled ?? true,
    selected: node.selected ?? false,
    hasFocus: node.focused ?? false,
    visibleToUser: node.visibleToUser,
    hittable: node.hittable,
  }
}

function unionFrame(handles: ElementHandle[]): Record<string, number> {
  if (handles.length === 0) return { X: 0, Y: 0, Width: 0, Height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const h of handles) {
    const f = h.frame
    minX = Math.min(minX, f.X ?? 0)
    minY = Math.min(minY, f.Y ?? 0)
    maxX = Math.max(maxX, (f.X ?? 0) + (f.Width ?? 0))
    maxY = Math.max(maxY, (f.Y ?? 0) + (f.Height ?? 0))
  }
  return { X: minX, Y: minY, Width: maxX - minX, Height: maxY - minY }
}
