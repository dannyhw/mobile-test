export type LocatorType = 'id' | 'text' | 'type' | 'label'

export class Locator {
  public ancestorLocator?: Locator

  constructor(
    public readonly type: LocatorType,
    public readonly value: string | RegExp | number,
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

  type(elementType: number): Locator {
    return new Locator('type', elementType)
  },

  label(label: string | RegExp): Locator {
    return new Locator('label', label)
  },
}
