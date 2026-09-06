export type LocatorType = 'id' | 'text' | 'label' | 'role'

export class Locator {
  public ancestorLocator?: Locator

  constructor(
    public readonly type: LocatorType,
    public readonly value: string | RegExp,
  ) {}

  withAncestor(ancestor: Locator): Locator {
    const copy = new Locator(this.type, this.value)
    copy.ancestorLocator = ancestor
    return copy
  }

  toString(): string {
    const base = `by.${this.type}(${this.value})`
    if (this.ancestorLocator) {
      return `${base}.withAncestor(${this.ancestorLocator})`
    }
    return base
  }
}

export const by = {
  id(id: string): Locator {
    return new Locator('id', id)
  },

  text(text: string | RegExp): Locator {
    return new Locator('text', text)
  },

  label(label: string | RegExp): Locator {
    return new Locator('label', label)
  },

  /**
   * Match by semantic role, e.g. "button", "textfield", "scrollview".
   * Roles are backend-provided strings; compare with `agent-device snapshot`.
   */
  role(role: string | RegExp): Locator {
    return new Locator('role', role)
  },
}
