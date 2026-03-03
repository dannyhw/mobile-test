export type LocatorType = 'id' | 'text'

export class Locator {
  constructor(
    public readonly type: LocatorType,
    public readonly value: string | RegExp,
  ) {}

  toString(): string {
    return `by.${this.type}(${this.value})`
  }
}

export const by = {
  id(id: string): Locator {
    return new Locator('id', id)
  },

  text(text: string | RegExp): Locator {
    return new Locator('text', text)
  },
}
