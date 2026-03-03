export interface Frame {
  x: number
  y: number
  width: number
  height: number
}

export interface ElementHandle {
  identifier: string
  label: string
  value?: string
  title?: string
  frame: Record<string, number> // AXFrame: { X, Y, Width, Height }
  elementType: number
  enabled: boolean
  placeholderValue?: string
  selected: boolean
  hasFocus: boolean
  children?: ElementHandle[]
}

/** Convert AXFrame dict to our Frame type */
export function toFrame(axFrame: Record<string, number>): Frame {
  return {
    x: axFrame['X'] ?? 0,
    y: axFrame['Y'] ?? 0,
    width: axFrame['Width'] ?? 0,
    height: axFrame['Height'] ?? 0,
  }
}

/** Get center point of a frame */
export function frameCenter(frame: Frame): { x: number; y: number } {
  return {
    x: frame.x + frame.width / 2,
    y: frame.y + frame.height / 2,
  }
}
