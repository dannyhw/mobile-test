export interface Frame {
  x: number
  y: number
  width: number
  height: number
}

export function visibleFramePercentage(frame: Frame, viewport: Frame): number {
  if (frame.width <= 0 || frame.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return 0
  }

  const visibleWidth = Math.max(
    0,
    Math.min(frame.x + frame.width, viewport.x + viewport.width) -
    Math.max(frame.x, viewport.x),
  )
  const visibleHeight = Math.max(
    0,
    Math.min(frame.y + frame.height, viewport.y + viewport.height) -
    Math.max(frame.y, viewport.y),
  )

  return (visibleWidth * visibleHeight) / (frame.width * frame.height)
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
