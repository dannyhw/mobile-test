import type {
  TapRequest,
  SwipeRequest,
  TypeTextRequest,
  LaunchAppRequest,
  TerminateAppRequest,
  DeviceInfoResponse,
  StatusResponse,
  ViewHierarchyResponse,
} from './protocol.js'

export class DriverClient {
  constructor(private baseUrl = 'http://localhost:22087') {}

  async status(): Promise<StatusResponse> {
    return this.get('/status')
  }

  async tap(x: number, y: number, duration?: number): Promise<void> {
    await this.post<TapRequest>('/tap', { x, y, duration })
  }

  async doubleTap(x: number, y: number): Promise<void> {
    await this.post<TapRequest>('/doubleTap', { x, y })
  }

  async swipe(startX: number, startY: number, endX: number, endY: number, duration?: number): Promise<void> {
    await this.post<SwipeRequest>('/swipe', { startX, startY, endX, endY, duration })
  }

  async typeText(text: string): Promise<void> {
    await this.post<TypeTextRequest>('/typeText', { text })
  }

  async eraseText(charactersToErase: number): Promise<void> {
    await this.post<{ charactersToErase: number }>('/eraseText', { charactersToErase })
  }

  async screenshot(): Promise<Buffer> {
    const res = await this.fetch('/screenshot', 'screenshot')
    return Buffer.from(await res.arrayBuffer())
  }

  async viewHierarchy(bundleId?: string): Promise<ViewHierarchyResponse> {
    const query = bundleId ? `?bundleId=${encodeURIComponent(bundleId)}` : ''
    return this.get(`/viewHierarchy${query}`)
  }

  async launchApp(bundleId: string): Promise<void> {
    await this.post<LaunchAppRequest>('/launchApp', { bundleId })
  }

  async terminateApp(bundleId: string): Promise<void> {
    await this.post<TerminateAppRequest>('/terminateApp', { bundleId })
  }

  async deviceInfo(): Promise<DeviceInfoResponse> {
    return this.get('/deviceInfo')
  }

  private async fetch(path: string, operation: string): Promise<Response> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}${path}`)
    } catch (err) {
      throw new Error(
        `Failed to connect to driver at ${this.baseUrl}${path} (${operation}).\n\n` +
        `Is the driver running? Check that:\n` +
        `  - A simulator is booted (xcrun simctl list devices booted)\n` +
        `  - The driver was started (via vitest plugin or launchDriver())\n` +
        `  - Nothing else is using port ${new URL(this.baseUrl).port}`,
        { cause: err },
      )
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(
        `Driver returned ${res.status} ${res.statusText} for ${operation} (${path})` +
        (body ? `\n  Response: ${body.slice(0, 200)}` : ''),
      )
    }

    return res
  }

  private async get<T>(path: string): Promise<T> {
    const operation = path.replace(/^\//, '').replace(/\?.*/, '')
    const res = await this.fetch(path, operation)
    return res.json() as Promise<T>
  }

  private async post<T>(path: string, body: T): Promise<void> {
    const operation = path.replace(/^\//, '')
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (err) {
      throw new Error(
        `Failed to connect to driver at ${this.baseUrl}${path} (${operation}).\n\n` +
        `Is the driver running? Check that:\n` +
        `  - A simulator is booted (xcrun simctl list devices booted)\n` +
        `  - The driver was started (via vitest plugin or launchDriver())`,
        { cause: err },
      )
    }

    if (!res.ok) {
      const responseBody = await res.text().catch(() => '')
      throw new Error(
        `Driver returned ${res.status} ${res.statusText} for ${operation} (${path})` +
        (responseBody ? `\n  Response: ${responseBody.slice(0, 200)}` : ''),
      )
    }
  }
}
