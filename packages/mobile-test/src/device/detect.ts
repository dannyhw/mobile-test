import { execaCommand } from 'execa'

export interface SimulatorInfo {
  udid: string
  name: string
  state: string
  runtime: string
}

interface SimctlDevice {
  udid: string
  name: string
  state: string
  isAvailable: boolean
}

interface SimctlOutput {
  devices: Record<string, SimctlDevice[]>
}

export interface AndroidDeviceInfo {
  udid: string
  name: string
  state: string
  isEmulator: boolean
  model?: string
}

export async function detectBootedSimulators(): Promise<SimulatorInfo[]> {
  const { stdout } = await execaCommand('xcrun simctl list devices booted --json')
  const parsed: SimctlOutput = JSON.parse(stdout)

  const simulators: SimulatorInfo[] = []

  for (const [runtime, devices] of Object.entries(parsed.devices)) {
    for (const device of devices) {
      if (device.state === 'Booted') {
        simulators.push({
          udid: device.udid,
          name: device.name,
          state: device.state,
          runtime,
        })
      }
    }
  }

  return simulators
}

function humanizeAdbValue(value: string | undefined): string | undefined {
  return value?.replaceAll('_', ' ')
}

export async function detectConnectedAndroidDevices(): Promise<AndroidDeviceInfo[]> {
  const { stdout } = await execaCommand('adb devices -l')
  const devices: AndroidDeviceInfo[] = []

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('List of devices attached')) {
      continue
    }

    const [udid, state, ...rest] = line.split(/\s+/)
    if (!udid || state !== 'device') {
      continue
    }

    const details = Object.fromEntries(
      rest
        .filter(part => part.includes(':'))
        .map((part) => {
          const separator = part.indexOf(':')
          return [part.slice(0, separator), part.slice(separator + 1)]
        }),
    ) as Record<string, string>

    const model = humanizeAdbValue(details.model)
    const name = model ?? humanizeAdbValue(details.device) ?? udid

    devices.push({
      udid,
      name,
      state,
      isEmulator: udid.startsWith('emulator-'),
      model,
    })
  }

  return devices
}

export async function getDefaultIOSDevice(): Promise<SimulatorInfo> {
  const simulators = await detectBootedSimulators()

  if (simulators.length === 0) {
    throw new Error(
      'No booted iOS simulators found.\n\n' +
      'Start a simulator before running tests:\n' +
      '  xcrun simctl boot "iPhone 16"\n\n' +
      'Or open one from Xcode: Xcode → Window → Devices and Simulators'
    )
  }

  return simulators[0]
}

export async function getDefaultAndroidDevice(): Promise<AndroidDeviceInfo> {
  const devices = await detectConnectedAndroidDevices()

  if (devices.length === 0) {
    throw new Error(
      'No connected Android devices found.\n\n' +
      'Start an emulator or connect a device before running tests:\n' +
      '  emulator -avd <name>\n\n' +
      'Then confirm ADB can see it:\n' +
      '  adb devices'
    )
  }

  return devices[0]
}

export function getDefaultDevice(): Promise<SimulatorInfo>
export function getDefaultDevice(platform: 'ios'): Promise<SimulatorInfo>
export function getDefaultDevice(platform: 'android'): Promise<AndroidDeviceInfo>
export async function getDefaultDevice(
  platform: 'ios' | 'android' = 'ios',
): Promise<SimulatorInfo | AndroidDeviceInfo> {
  if (platform === 'android') {
    return getDefaultAndroidDevice()
  }

  return getDefaultIOSDevice()
}
