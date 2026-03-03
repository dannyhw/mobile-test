import type { Frame } from '../element/types.js'

/**
 * Crop a PNG buffer to a frame region.
 * Frame coordinates are in points; screenshot pixels are in retina pixels.
 * Multiply by scale factor to convert.
 */
export async function cropToFrame(
  pngBuffer: Buffer,
  frame: Frame,
  scale: number,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default

  const left = Math.round(frame.x * scale)
  const top = Math.round(frame.y * scale)
  const width = Math.round(frame.width * scale)
  const height = Math.round(frame.height * scale)

  return sharp(pngBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer()
}
