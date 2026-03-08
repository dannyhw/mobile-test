import type { ElementHandle } from '../element/types.js'

const IOS_ELEMENT_TYPES = {
  unknown: 0,
  staticText: 9,
  image: 40,
  group: 47,
  button: 48,
} as const

interface XmlNode {
  name: string
  attributes: Record<string, string>
  children: XmlNode[]
}

export function looksLikeAndroidViewHierarchy(contentType: string | null, body: string): boolean {
  const normalizedContentType = contentType?.toLowerCase() ?? ''
  if (normalizedContentType.includes('xml')) {
    return true
  }

  return body.trimStart().startsWith('<?xml') || body.trimStart().startsWith('<hierarchy')
}

export function normalizeAndroidViewHierarchy(xml: string, bundleId?: string): ElementHandle {
  const hierarchy = parseXml(xml)
  if (hierarchy.name !== 'hierarchy') {
    throw new Error(`Expected Android hierarchy root <hierarchy>, received <${hierarchy.name}>.`)
  }

  const relevantRoots = selectRelevantRoots(hierarchy.children, bundleId)
  if (relevantRoots.length === 0) {
    return syntheticRoot([])
  }

  if (relevantRoots.length === 1) {
    return normalizeNode(relevantRoots[0])
  }

  return syntheticRoot(relevantRoots.map(normalizeNode))
}

function selectRelevantRoots(nodes: XmlNode[], bundleId?: string): XmlNode[] {
  if (!bundleId) {
    return nodes.filter(node => node.name === 'node')
  }

  const directMatches = nodes.filter(node => node.name === 'node' && subtreeContainsPackage(node, bundleId))
  return directMatches.length > 0 ? directMatches : nodes.filter(node => node.name === 'node')
}

function subtreeContainsPackage(node: XmlNode, bundleId: string): boolean {
  if (node.attributes.package === bundleId) {
    return true
  }

  return node.children.some(child => subtreeContainsPackage(child, bundleId))
}

function normalizeNode(node: XmlNode): ElementHandle {
  const text = nonEmpty(node.attributes.text)
  const contentDescription = nonEmpty(node.attributes['content-desc'])
  const hintText = nonEmpty(node.attributes.hintText)
  const checked = parseBoolean(node.attributes.checked)
  const label = contentDescription ?? text ?? hintText ?? ''
  const value = text ?? (node.attributes.checkable ? String(Number(checked)) : undefined)
  const children = node.children
    .filter(child => child.name === 'node')
    .map(normalizeNode)

  return {
    identifier: normalizeIdentifier(node.attributes['resource-id']),
    label,
    value,
    title: undefined,
    frame: parseBounds(node.attributes.bounds),
    elementType: mapElementType(node.attributes.class),
    enabled: parseEnabled(node.attributes.enabled, node.attributes.clickable),
    placeholderValue: hintText,
    selected: parseBoolean(node.attributes.selected),
    hasFocus: parseBoolean(node.attributes.focused),
    children,
  }
}

function syntheticRoot(children: ElementHandle[]): ElementHandle {
  return {
    identifier: '',
    label: '',
    frame: unionFrames(children.map(child => child.frame)),
    elementType: IOS_ELEMENT_TYPES.group,
    enabled: true,
    selected: false,
    hasFocus: false,
    children,
  }
}

function unionFrames(frames: Array<Record<string, number>>): Record<string, number> {
  const validFrames = frames.filter(frame => frame.Width > 0 && frame.Height > 0)
  if (validFrames.length === 0) {
    return zeroFrame()
  }

  const minX = Math.min(...validFrames.map(frame => frame.X))
  const minY = Math.min(...validFrames.map(frame => frame.Y))
  const maxX = Math.max(...validFrames.map(frame => frame.X + frame.Width))
  const maxY = Math.max(...validFrames.map(frame => frame.Y + frame.Height))

  return {
    X: minX,
    Y: minY,
    Width: maxX - minX,
    Height: maxY - minY,
  }
}

function parseEnabled(enabled?: string, clickable?: string): boolean {
  if (enabled !== undefined) {
    return parseBoolean(enabled)
  }

  if (clickable !== undefined) {
    return parseBoolean(clickable)
  }

  return true
}

function normalizeIdentifier(resourceId?: string): string {
  const id = nonEmpty(resourceId)
  if (!id) {
    return ''
  }

  const slashIndex = id.lastIndexOf('/')
  return slashIndex >= 0 ? id.slice(slashIndex + 1) : id
}

function mapElementType(className?: string): number {
  const normalizedClassName = className?.toLowerCase() ?? ''

  if (!normalizedClassName) {
    return IOS_ELEMENT_TYPES.unknown
  }

  if (
    normalizedClassName.includes('button') ||
    normalizedClassName.includes('fab') ||
    normalizedClassName.includes('chip')
  ) {
    return IOS_ELEMENT_TYPES.button
  }

  if (
    normalizedClassName.includes('textview') ||
    normalizedClassName.includes('checkedtextview')
  ) {
    return IOS_ELEMENT_TYPES.staticText
  }

  if (
    normalizedClassName.includes('imageview') ||
    normalizedClassName.endsWith('.image')
  ) {
    return IOS_ELEMENT_TYPES.image
  }

  if (
    normalizedClassName.includes('layout') ||
    normalizedClassName.includes('viewgroup') ||
    normalizedClassName.includes('scrollview') ||
    normalizedClassName.includes('recyclerview') ||
    normalizedClassName.includes('listview')
  ) {
    return IOS_ELEMENT_TYPES.group
  }

  return IOS_ELEMENT_TYPES.unknown
}

function parseBounds(bounds?: string): Record<string, number> {
  const value = nonEmpty(bounds)
  if (!value) {
    return zeroFrame()
  }

  const matches = value.match(/-?\d+/g)
  if (!matches || matches.length < 4) {
    return zeroFrame()
  }

  const [left, top, right, bottom] = matches.slice(0, 4).map(Number)
  return {
    X: left,
    Y: top,
    Width: Math.max(0, right - left),
    Height: Math.max(0, bottom - top),
  }
}

function zeroFrame(): Record<string, number> {
  return { X: 0, Y: 0, Width: 0, Height: 0 }
}

function parseBoolean(value?: string): boolean {
  return value === 'true'
}

function nonEmpty(value?: string): string | undefined {
  if (value === undefined) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parseXml(xml: string): XmlNode {
  const stack: XmlNode[] = []
  let root: XmlNode | undefined
  const tagPattern = /<([^>]+)>/g
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(xml)) !== null) {
    const rawTag = match[1].trim()
    if (!rawTag || rawTag.startsWith('?') || rawTag.startsWith('!')) {
      continue
    }

    if (rawTag.startsWith('/')) {
      stack.pop()
      continue
    }

    const selfClosing = rawTag.endsWith('/')
    const tagBody = selfClosing ? rawTag.slice(0, -1).trim() : rawTag
    const spaceIndex = tagBody.search(/\s/)
    const name = spaceIndex === -1 ? tagBody : tagBody.slice(0, spaceIndex)
    const attributes = spaceIndex === -1 ? {} : parseAttributes(tagBody.slice(spaceIndex + 1))
    const node: XmlNode = { name, attributes, children: [] }

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node)
    } else {
      root = node
    }

    if (!selfClosing) {
      stack.push(node)
    }
  }

  if (!root) {
    throw new Error('Android view hierarchy XML was empty.')
  }

  return root
}

function parseAttributes(input: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const attributePattern = /([^\s=]+)\s*=\s*"([^"]*)"/g
  let match: RegExpExecArray | null

  while ((match = attributePattern.exec(input)) !== null) {
    attributes[match[1]] = decodeXml(match[2])
  }

  return attributes
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
