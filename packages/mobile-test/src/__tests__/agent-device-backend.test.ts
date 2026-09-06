import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { AgentDeviceBackend } from '../backend/agent-device.js'
import { BackendUnsupportedError } from '../backend/types.js'

const { mockExeca } = vi.hoisted(() => ({ mockExeca: vi.fn().mockResolvedValue({ stdout: '' }) }))
vi.mock('execa', () => ({ execa: mockExeca }))

vi.mock('../logger.js', () => ({
  log: {
    time: vi.fn(async (_label: string, fn: () => unknown) => await fn()),
    debug: vi.fn(),
  },
}))

function agentError(code: string, message = code, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { code, ...extra })
}

function fakeClient() {
  return {
    capture: {
      snapshot: vi.fn().mockResolvedValue({ nodes: [], truncated: false }),
      screenshot: vi.fn(async ({ path, pixelDensity }: { path: string; pixelDensity?: number; normalizeStatusBar?: boolean; stabilize?: boolean }) => {
        const density = pixelDensity ?? 1
        await sharp({ create: { width: 4 * density, height: 8 * density, channels: 3, background: '#ffffff' } })
          .png()
          .toFile(path)
        return { path, width: 4 * density, height: 8 * density, logicalWidth: 4, logicalHeight: 8, pixelDensity: density }
      }),
    },
    interactions: {
      press: vi.fn().mockResolvedValue({}),
      longPress: vi.fn().mockResolvedValue({}),
      pan: vi.fn().mockResolvedValue({}),
      swipe: vi.fn().mockResolvedValue({}),
      type: vi.fn().mockResolvedValue({}),
      fill: vi.fn().mockResolvedValue({}),
    },
    command: {
      keyboard: vi.fn().mockResolvedValue({ data: { visible: true } }),
      wait: vi.fn().mockResolvedValue({}),
      back: vi.fn().mockResolvedValue({}),
      home: vi.fn().mockResolvedValue({}),
      alert: vi.fn().mockRejectedValue(agentError('COMMAND_FAILED', 'alert not found')),
    },
    apps: {
      open: vi.fn().mockResolvedValue({ session: 's' }),
      close: vi.fn().mockResolvedValue({}),
      install: vi.fn().mockResolvedValue({}),
    },
    settings: { update: vi.fn().mockResolvedValue({}) },
    sessions: { close: vi.fn().mockResolvedValue({}) },
  }
}

function backendWith(client: ReturnType<typeof fakeClient>, platform: 'ios' | 'android' = 'ios') {
  return new AgentDeviceBackend({
    session: 'test-session',
    platform,
    device: { name: 'Fake', id: platform === 'ios' ? 'UDID-1' : 'emulator-5554', platform },
    client: client as any,
  })
}

const handle = (value?: string) => ({
  identifier: 'field',
  label: '',
  value,
  frame: { X: 10, Y: 20, Width: 100, Height: 40 },
  elementType: 0,
  enabled: true,
  selected: false,
  hasFocus: false,
})

describe('AgentDeviceBackend', () => {
  let client: ReturnType<typeof fakeClient>

  beforeEach(() => {
    client = fakeClient()
  })

  it('requests a raw, full snapshot scoped to the device and converts it to a tree', async () => {
    client.capture.snapshot.mockResolvedValue({
      nodes: [
        { index: 0, type: 'Application', rect: { x: 0, y: 0, width: 402, height: 874 } },
        { index: 1, parentIndex: 0, type: 'Button', identifier: 'go', label: 'Go', rect: { x: 1, y: 2, width: 3, height: 4 } },
      ],
      truncated: false,
    })

    const root = await backendWith(client).snapshot()

    expect(client.capture.snapshot).toHaveBeenCalledWith({ platform: 'ios', udid: 'UDID-1', raw: true, forceFull: true })
    expect(root.role).toBe('application')
    expect(root.children![0]).toMatchObject({ identifier: 'go', label: 'Go', role: 'button', frame: { X: 1, Y: 2, Width: 3, Height: 4 } })
  })

  it('captures screenshots at 3x on iOS and derives points and scale', async () => {
    const backend = backendWith(client)
    const shot = await backend.screenshot()

    expect(client.capture.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'ios', udid: 'UDID-1', pixelDensity: 3, normalizeStatusBar: false }),
    )
    expect(shot.scale).toBe(3)
    expect(shot.widthPoints).toBe(4)
    expect(shot.heightPoints).toBe(8)
    expect(shot.widthPixels).toBe(12)
    expect(shot.heightPixels).toBe(24)
    expect(shot.png.subarray(1, 4).toString('ascii')).toBe('PNG')

    // Viewport is cached from the screenshot's logical size.
    expect(await backend.viewport()).toEqual({ x: 0, y: 0, width: 4, height: 8 })
    expect(client.capture.screenshot).toHaveBeenCalledTimes(1)
  })

  it('does not request a pixel density on Android', async () => {
    await backendWith(client, 'android').screenshot()
    const args = client.capture.screenshot.mock.calls[0][0]
    expect(args).toMatchObject({ platform: 'android', serial: 'emulator-5554' })
    expect(args.pixelDensity).toBeUndefined()
    expect(args.normalizeStatusBar).toBeUndefined()
  })

  it('maps taps to press, long taps to longPress, and double taps to the doubleTap flag', async () => {
    const backend = backendWith(client)
    await backend.tap(5, 6)
    await backend.tap(5, 6, { doubleTap: true })
    await backend.tap(5, 6, { durationMs: 1200 })

    expect(client.interactions.press).toHaveBeenNthCalledWith(1, { platform: 'ios', udid: 'UDID-1', x: 5, y: 6 })
    expect(client.interactions.press).toHaveBeenNthCalledWith(2, { platform: 'ios', udid: 'UDID-1', x: 5, y: 6, doubleTap: true })
    expect(client.interactions.longPress).toHaveBeenCalledWith({ platform: 'ios', udid: 'UDID-1', x: 5, y: 6, durationMs: 1200 })
  })

  it('implements swipe as a timed pan', async () => {
    await backendWith(client).swipe({ x: 100, y: 500 }, { x: 100, y: 200 })
    expect(client.interactions.pan).toHaveBeenCalledWith({
      platform: 'ios', udid: 'UDID-1', x: 100, y: 500, dx: 0, dy: -300, durationMs: 300,
    })
    expect(client.interactions.swipe).not.toHaveBeenCalled()
  })

  it('clears text with one backspace per character and skips empty fields', async () => {
    const backend = backendWith(client)
    await backend.clearText(handle('Alice'))
    expect(client.interactions.type).toHaveBeenCalledWith({ platform: 'ios', udid: 'UDID-1', text: '\b\b\b\b\b' })

    client.interactions.type.mockClear()
    await backend.clearText(handle(undefined))
    expect(client.interactions.type).not.toHaveBeenCalled()
  })

  it('clears text on Android with adb delete key events', async () => {
    mockExeca.mockClear()
    await backendWith(client, 'android').clearText(handle('Bob'))
    expect(client.interactions.type).not.toHaveBeenCalled()
    expect(mockExeca).toHaveBeenNthCalledWith(1, 'adb', ['-s', 'emulator-5554', 'shell', 'input', 'keyevent', 'KEYCODE_MOVE_END'])
    expect(mockExeca).toHaveBeenNthCalledWith(2, 'adb', ['-s', 'emulator-5554', 'shell', 'input', 'keyevent', 'KEYCODE_DEL', 'KEYCODE_DEL', 'KEYCODE_DEL'])
  })

  it('skips Android stabilization only for fast screenshots', async () => {
    const backend = backendWith(client, 'android')
    await backend.screenshot({ fast: true })
    await backend.screenshot()
    expect(client.capture.screenshot.mock.calls[0][0]).toMatchObject({ stabilize: false })
    expect(client.capture.screenshot.mock.calls[1][0].stabilize).toBeUndefined()
  })

  it('replaces text with fill at the element center', async () => {
    await backendWith(client).replaceText(handle('old'), 'new')
    expect(client.interactions.fill).toHaveBeenCalledWith({ platform: 'ios', udid: 'UDID-1', x: 60, y: 40, text: 'new' })
  })

  it('detects the iOS keyboard from the raw snapshot and uses keyboard status on Android', async () => {
    client.capture.snapshot.mockResolvedValue({
      nodes: [{ index: 0, type: 'Keyboard', rect: { x: 0, y: 600, width: 402, height: 274 } }],
      truncated: false,
    })
    expect(await backendWith(client).keyboardVisible()).toBe(true)
    expect(client.command.keyboard).not.toHaveBeenCalled()

    client.capture.snapshot.mockResolvedValue({ nodes: [], truncated: false })
    expect(await backendWith(client).keyboardVisible()).toBe(false)

    client.command.keyboard.mockResolvedValue({ data: { visible: false } })
    expect(await backendWith(client, 'android').keyboardVisible()).toBe(false)
    expect(client.command.keyboard).toHaveBeenCalledWith({ platform: 'android', serial: 'emulator-5554', action: 'status' })
  })

  it('maps keys to keyboard, back and home commands', async () => {
    const backend = backendWith(client, 'android')
    await backend.pressKey('return')
    await backend.pressKey('back')
    await backend.pressKey('home')
    expect(client.command.keyboard).toHaveBeenCalledWith({ platform: 'android', serial: 'emulator-5554', action: 'return' })
    expect(client.command.back).toHaveBeenCalledTimes(1)
    expect(client.command.home).toHaveBeenCalledTimes(1)
  })

  it('reports an unsupported keyboard dismiss as false instead of throwing', async () => {
    client.command.keyboard.mockRejectedValue(agentError('UNSUPPORTED_OPERATION'))
    expect(await backendWith(client).dismissKeyboard()).toBe(false)

    client.command.keyboard.mockRejectedValue(agentError('COMMAND_FAILED', 'boom'))
    await expect(backendWith(client).dismissKeyboard()).rejects.toThrow(/keyboard dismiss failed \(COMMAND_FAILED\): boom/)
  })

  it('launches with relaunch and an optional deep link', async () => {
    const backend = backendWith(client)
    await backend.launchApp('com.example.app', { url: 'example:///form' })
    expect(client.apps.open).toHaveBeenCalledWith({
      platform: 'ios', udid: 'UDID-1', app: 'com.example.app', relaunch: true, url: 'example:///form',
    })
  })

  it('accepts stacked "Open in" alerts after opening a URL on iOS', async () => {
    client.command.alert
      .mockResolvedValueOnce({ data: { message: 'Open in “example-app”?', items: ['Cancel', 'Open'] } })
      .mockResolvedValueOnce({ data: { message: 'Open in “example-app”?', items: ['Cancel', 'Open'] } })
      .mockRejectedValue(agentError('COMMAND_FAILED', 'alert not found'))

    await backendWith(client).openUrl('example:///form', { bundleId: 'com.example.app' })

    expect(client.apps.open).toHaveBeenCalledWith({ platform: 'ios', udid: 'UDID-1', url: 'example:///form', app: 'com.example.app' })
    const presses = client.interactions.press.mock.calls.filter(([a]) => a.selector === 'text="Open"')
    expect(presses).toHaveLength(2)
  })

  it('treats a wait-stable timeout as settled and surfaces unsupported as BackendUnsupportedError', async () => {
    const backend = backendWith(client)
    client.command.wait.mockRejectedValueOnce(agentError('WAIT_FAILED', 'not stable', { details: { reason: 'wait_stable_timeout' } }))
    await expect(backend.waitStable({ quietMs: 100, timeoutMs: 1000 })).resolves.toBeUndefined()
    expect(client.command.wait).toHaveBeenCalledWith({ platform: 'ios', udid: 'UDID-1', stable: true, quietMs: 100, timeoutMs: 1000 })

    client.command.wait.mockRejectedValueOnce(agentError('UNSUPPORTED_OPERATION'))
    await expect(backend.waitStable()).rejects.toBeInstanceOf(BackendUnsupportedError)
  })

  it('wraps agent-device errors with the operation, code and hint', async () => {
    client.interactions.press.mockRejectedValue(agentError('AMBIGUOUS_MATCH', 'two matches', { hint: 'narrow it' }))
    await expect(backendWith(client).tap(1, 1)).rejects.toThrow(
      'agent-device press failed (AMBIGUOUS_MATCH): two matches\n  Hint: narrow it',
    )
  })

  it('sets location through settings and closes the session once', async () => {
    const backend = backendWith(client)
    await backend.setLocation(1.5, 2.5)
    expect(client.settings.update).toHaveBeenCalledWith({
      platform: 'ios', udid: 'UDID-1', setting: 'location', state: 'set', latitude: 1.5, longitude: 2.5,
    })

    await backend.close()
    await backend.close()
    expect(client.sessions.close).toHaveBeenCalledTimes(1)
    expect(client.sessions.close).toHaveBeenCalledWith({ session: 'test-session' })
  })
})
