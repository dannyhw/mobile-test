import type { ElementHandle } from '../element/types.js'

export interface TapRequest {
  x: number
  y: number
  duration?: number
}

export interface SwipeRequest {
  startX: number
  startY: number
  endX: number
  endY: number
  duration?: number
}

export interface TypeTextRequest {
  text: string
}

export interface PressKeyRequest {
  key: 'delete' | 'return' | 'enter' | 'tab' | 'space' | 'escape'
}

export interface ClearTextRequest {
  bundleId?: string
  identifier?: string
  x: number
  y: number
  width: number
  height: number
}

export interface LaunchAppRequest {
  bundleId: string
}

export interface TerminateAppRequest {
  bundleId: string
}

export interface DeviceInfoResponse {
  widthPoints: number
  heightPoints: number
  widthPixels: number
  heightPixels: number
  scale: number
}

export interface StatusResponse {
  status: string
}

export interface KeyboardStateResponse {
  visible: boolean
}

export type ViewHierarchyResponse = ElementHandle
