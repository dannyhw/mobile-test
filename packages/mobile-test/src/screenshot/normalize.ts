import { execa } from 'execa'

export async function normalizeStatusBar(udid: string): Promise<void> {
  await execa('xcrun', [
    'simctl', 'status_bar', udid, 'override',
    '--time', '9:41',
    '--batteryState', 'charged',
    '--batteryLevel', '100',
    '--cellularMode', 'active',
    '--cellularBars', '4',
  ])
}

export async function resetStatusBar(udid: string): Promise<void> {
  await execa('xcrun', ['simctl', 'status_bar', udid, 'clear'])
}
