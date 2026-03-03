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

export async function getDefaultDevice(): Promise<SimulatorInfo> {
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
