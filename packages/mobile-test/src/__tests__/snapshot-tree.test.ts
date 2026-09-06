import { describe, expect, it } from 'vitest'
import { snapshotToTree, type FlatSnapshotNode } from '../backend/snapshot-tree.js'
import { findElement } from '../element/match.js'
import { by } from '../element/by.js'

const nodes: FlatSnapshotNode[] = [
  { index: 0, role: 'window', rect: { x: 0, y: 0, width: 390, height: 844 } },
  { index: 1, parentIndex: 0, role: 'scrollview', identifier: 'counter-scroll', rect: { x: 0, y: 100, width: 390, height: 700 } },
  { index: 2, parentIndex: 1, role: 'text', identifier: 'counter', label: '3', value: '3', rect: { x: 20, y: 120, width: 100, height: 30 } },
  { index: 3, parentIndex: 1, role: 'button', identifier: 'click-button', label: 'Tap me', rect: { x: 20, y: 900, width: 200, height: 44 }, enabled: false, focused: true, hittable: false, visibleToUser: false },
]

describe('snapshotToTree', () => {
  it('rebuilds the parent/child structure from parentIndex', () => {
    const root = snapshotToTree(nodes)
    expect(root.role).toBe('window')
    expect(root.children).toHaveLength(1)
    expect(root.children![0].identifier).toBe('counter-scroll')
    expect(root.children![0].children!.map(c => c.identifier)).toEqual(['counter', 'click-button'])
  })

  it('maps fields into the ElementHandle shape the matcher understands', () => {
    const root = snapshotToTree(nodes)
    const button = findElement(root, by.id('click-button'))!
    expect(button.frame).toEqual({ X: 20, Y: 900, Width: 200, Height: 44 })
    expect(button.label).toBe('Tap me')
    expect(button.enabled).toBe(false)
    expect(button.hasFocus).toBe(true)
    expect(button.hittable).toBe(false)
    expect(button.visibleToUser).toBe(false)
    expect(button.elementType).toBe(0)

    const counter = findElement(root, by.text('3'))!
    expect(counter.identifier).toBe('counter')
    expect(counter.value).toBe('3')
  })

  it('defaults missing booleans to enabled / unselected / unfocused', () => {
    const root = snapshotToTree(nodes)
    const scroll = findElement(root, by.id('counter-scroll'))!
    expect(scroll.enabled).toBe(true)
    expect(scroll.selected).toBe(false)
    expect(scroll.hasFocus).toBe(false)
    expect(scroll.value).toBeUndefined()
  })

  it('wraps multiple roots in a synthetic root covering their union', () => {
    const root = snapshotToTree([
      { index: 0, rect: { x: 0, y: 0, width: 100, height: 100 } },
      { index: 1, rect: { x: 50, y: 50, width: 100, height: 100 } },
      { index: 2, parentIndex: 99, rect: { x: 10, y: 10, width: 10, height: 10 } }, // orphan
    ])
    expect(root.role).toBe('root')
    expect(root.children).toHaveLength(3)
    expect(root.frame).toEqual({ X: 0, Y: 0, Width: 150, Height: 150 })
  })

  it('divides rects when the backend reports pixels', () => {
    const root = snapshotToTree(nodes, { rectDivisor: 2 })
    const button = findElement(root, by.id('click-button'))!
    expect(button.frame).toEqual({ X: 10, Y: 450, Width: 100, Height: 22 })
  })

  it('returns an empty root for an empty snapshot', () => {
    const root = snapshotToTree([])
    expect(root.children).toEqual([])
    expect(root.frame).toEqual({ X: 0, Y: 0, Width: 0, Height: 0 })
  })
})
