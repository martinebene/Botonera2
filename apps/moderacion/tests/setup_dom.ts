/**
 * Setup de entorno DOM liviano para pruebas de componentes, interacción y lifecycle
 * con @vue/test-utils en entorno Node (sin dependencias externas pesadas).
 */

if (typeof globalThis.document === 'undefined' || !globalThis.document.querySelector) {
  type Listener = (event: MockEvent) => void

  class MockEvent {
    type: string
    target: unknown = null
    currentTarget: unknown = null
    bubbles = true
    cancelable = true
    defaultPrevented = false

    constructor(type: string, options: Record<string, unknown> = {}) {
      this.type = type
      if (options.bubbles !== undefined) this.bubbles = Boolean(options.bubbles)
      if (options.cancelable !== undefined) this.cancelable = Boolean(options.cancelable)
      if (options.key !== undefined) (this as unknown as { key: string }).key = String(options.key)
      if (options.shiftKey !== undefined)
        (this as unknown as { shiftKey: boolean }).shiftKey = Boolean(options.shiftKey)
    }

    preventDefault() {
      this.defaultPrevented = true
    }

    stopPropagation() {}
  }

  class MockKeyboardEvent extends MockEvent {
    key = ''
    shiftKey = false
    constructor(type: string, options: Record<string, unknown> = {}) {
      super(type, options)
      this.key = (options.key as string) ?? ''
      this.shiftKey = Boolean(options.shiftKey)
    }
  }

  class MockMouseEvent extends MockEvent {}
  class MockCustomEvent extends MockEvent {}

  // @ts-expect-error Mock global de eventos para entorno Node
  globalThis.Event = MockEvent
  // @ts-expect-error Mock global de KeyboardEvent para entorno Node
  globalThis.KeyboardEvent = MockKeyboardEvent
  // @ts-expect-error Mock global de MouseEvent para entorno Node
  globalThis.MouseEvent = MockMouseEvent
  // @ts-expect-error Mock global de CustomEvent para entorno Node
  globalThis.CustomEvent = MockCustomEvent

  class MockClassList {
    private set = new Set<string>()

    constructor(initial = '') {
      if (initial) {
        initial
          .split(/\s+/)
          .filter(Boolean)
          .forEach((c) => this.set.add(c))
      }
    }

    add(...classes: string[]) {
      classes.forEach((c) => this.set.add(c))
    }

    remove(...classes: string[]) {
      classes.forEach((c) => this.set.delete(c))
    }

    contains(cls: string) {
      return this.set.has(cls)
    }

    toggle(cls: string) {
      if (this.set.has(cls)) {
        this.set.delete(cls)
        return false
      }
      this.set.add(cls)
      return true
    }

    get value() {
      return Array.from(this.set).join(' ')
    }

    toString() {
      return this.value
    }
  }

  class MockNode {
    nodeType = 1
    childNodes: MockNode[] = []
    parentNode: MockNode | null = null
    ownerDocument: unknown = null

    get children(): MockElement[] {
      return this.childNodes.filter((n): n is MockElement => n.nodeType === 1)
    }

    get firstChild(): MockNode | null {
      return this.childNodes[0] ?? null
    }

    get lastChild(): MockNode | null {
      return this.childNodes[this.childNodes.length - 1] ?? null
    }

    get nextSibling(): MockNode | null {
      if (!this.parentNode) return null
      const idx = this.parentNode.childNodes.indexOf(this)
      return idx >= 0 && idx < this.parentNode.childNodes.length - 1
        ? this.parentNode.childNodes[idx + 1]
        : null
    }
  }

  class MockElement extends MockNode {
    tagName = 'DIV'
    style: Record<string, string> = {}
    attributes: Record<string, string> = {}
    listeners: Record<string, Listener[]> = {}
    classList: MockClassList
    private _value = ''
    private _textContent = ''

    constructor(tagName = 'DIV') {
      super()
      this.tagName = tagName.toUpperCase()
      this.classList = new MockClassList()
    }

    get id(): string {
      return this.attributes['id'] ?? ''
    }
    set id(val: string) {
      this.attributes['id'] = val
    }

    get className(): string {
      return this.classList.value
    }
    set className(val: string) {
      this.classList = new MockClassList(val)
    }

    get value(): string {
      return this._value
    }
    set value(val: string) {
      this._value = String(val)
    }

    get disabled(): boolean {
      return 'disabled' in this.attributes && this.attributes['disabled'] !== 'false'
    }
    set disabled(val: boolean) {
      if (val) {
        this.attributes['disabled'] = ''
      } else {
        delete this.attributes['disabled']
      }
    }

    get textContent(): string {
      if (this.childNodes.length === 0) return this._textContent
      return this.childNodes
        .map((n) =>
          n instanceof MockElement
            ? n.textContent
            : ((n as { textContent?: string }).textContent ?? ''),
        )
        .join('')
    }
    set textContent(val: string) {
      this._textContent = String(val)
      this.childNodes = []
    }

    get innerHTML(): string {
      return this.textContent
    }
    set innerHTML(_val: string) {}

    appendChild(child: MockNode): MockNode {
      child.parentNode = this
      this.childNodes.push(child)
      return child
    }

    removeChild(child: MockNode): MockNode {
      const idx = this.childNodes.indexOf(child)
      if (idx !== -1) {
        child.parentNode = null
        this.childNodes.splice(idx, 1)
      }
      return child
    }

    insertBefore(newNode: MockNode, referenceNode: MockNode | null): MockNode {
      newNode.parentNode = this
      if (!referenceNode) {
        this.childNodes.push(newNode)
        return newNode
      }
      const idx = this.childNodes.indexOf(referenceNode)
      if (idx !== -1) {
        this.childNodes.splice(idx, 0, newNode)
      } else {
        this.childNodes.push(newNode)
      }
      return newNode
    }

    setAttribute(name: string, val: string) {
      this.attributes[name] = String(val)
      if (name === 'class') {
        this.classList = new MockClassList(String(val))
      }
    }

    getAttribute(name: string): string | null {
      return this.attributes[name] ?? null
    }

    hasAttribute(name: string): boolean {
      return name in this.attributes
    }

    removeAttribute(name: string) {
      Reflect.deleteProperty(this.attributes, name)
      if (name === 'class') {
        this.classList = new MockClassList()
      }
    }

    addEventListener(type: string, listener: Listener) {
      if (!this.listeners[type]) this.listeners[type] = []
      this.listeners[type].push(listener)
    }

    removeEventListener(type: string, listener: Listener) {
      if (!this.listeners[type]) return
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener)
    }

    dispatchEvent(event: MockEvent): boolean {
      event.target = this
      event.currentTarget = this
      const list = (this.listeners[event.type] || []).slice()
      list.forEach((fn) => fn(event))

      // Bubble simple up to parent
      if (event.bubbles && this.parentNode instanceof MockElement) {
        this.parentNode.dispatchEvent(event)
      }
      return !event.defaultPrevented
    }

    focus() {
      // @ts-expect-error Mock global de activeElement para pruebas de foco
      if (globalThis.document) {
        // @ts-expect-error Mock global de activeElement para pruebas de foco
        globalThis.document.activeElement = this
      }
    }

    blur() {
      // @ts-expect-error Mock global de activeElement para pruebas de foco
      if (globalThis.document && globalThis.document.activeElement === this) {
        // @ts-expect-error Mock global de activeElement para pruebas de foco
        globalThis.document.activeElement = null
      }
    }

    matches(selector: string): boolean {
      if (selector === '*') return true
      if (selector.startsWith('#')) {
        return this.attributes['id'] === selector.slice(1)
      }
      if (selector.startsWith('.')) {
        return this.classList.contains(selector.slice(1))
      }
      const matchAttr = selector.match(/^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/)
      if (matchAttr) {
        const [, attr, val] = matchAttr
        if (val !== undefined) {
          return this.attributes[attr] === val
        }
        return attr in this.attributes
      }
      if (selector === 'button') {
        return this.tagName === 'BUTTON'
      }
      if (selector === 'input') {
        return this.tagName === 'INPUT'
      }
      if (selector === 'button:not([disabled])') {
        return this.tagName === 'BUTTON' && !this.disabled
      }
      return this.tagName.toLowerCase() === selector.toLowerCase()
    }

    querySelector(selector: string): MockElement | null {
      for (const child of this.children) {
        if (child.matches(selector)) return child
        const found = child.querySelector(selector)
        if (found) return found
      }
      return null
    }

    querySelectorAll(selector: string): MockElement[] {
      const results: MockElement[] = []
      for (const child of this.children) {
        if (child.matches(selector)) results.push(child)
        results.push(...child.querySelectorAll(selector))
      }
      return results
    }
  }

  class MockHTMLElement extends MockElement {}
  class MockSVGElement extends MockElement {}

  // @ts-expect-error Mock global de Node para entorno Node
  globalThis.Node = MockNode
  // @ts-expect-error Mock global de Element para entorno Node
  globalThis.Element = MockElement
  // @ts-expect-error Mock global de HTMLElement para entorno Node
  globalThis.HTMLElement = MockHTMLElement
  // @ts-expect-error Mock global de SVGElement para entorno Node
  globalThis.SVGElement = MockSVGElement

  const bodyElement = new MockHTMLElement('BODY')

  const mockDoc = {
    createElement: (tag: string) => new MockHTMLElement(tag),
    createElementNS: (_ns: string, tag: string) => new MockSVGElement(tag),
    createTextNode: (text: string) => {
      const n = new MockNode()
      n.nodeType = 3
      // @ts-expect-error Asignación de textContent en nodo mock
      n.textContent = String(text)
      return n
    },
    createComment: (text: string) => {
      const n = new MockNode()
      n.nodeType = 8
      // @ts-expect-error Asignación de textContent en nodo mock
      n.textContent = String(text)
      return n
    },
    activeElement: null as MockElement | null,
    body: bodyElement,
    documentElement: new MockHTMLElement('HTML'),
    getElementById: (id: string) => bodyElement.querySelector(`#${id}`),
    querySelector: (sel: string) => bodyElement.querySelector(sel),
    querySelectorAll: (sel: string) => bodyElement.querySelectorAll(sel),
    addEventListener: () => {},
    removeEventListener: () => {},
  }

  // @ts-expect-error Mock global de document para entorno de test
  globalThis.document = mockDoc
  // @ts-expect-error Mock global de window para entorno de test
  globalThis.window = globalThis
}
