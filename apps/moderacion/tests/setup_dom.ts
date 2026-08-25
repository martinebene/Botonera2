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

  class MockStyle {
    [key: string]: unknown

    setProperty(name: string, val: string) {
      this[name] = val
    }

    removeProperty(name: string) {
      Reflect.deleteProperty(this, name)
    }

    getPropertyValue(name: string): string {
      return (this[name] as string) ?? ''
    }
  }

  class MockNode {
    nodeType = 1
    childNodes: MockNode[] = []
    parentNode: MockNode | null = null
    ownerDocument: unknown = null
    private _nodeValue = ''

    get nodeValue(): string {
      return this._nodeValue
    }
    set nodeValue(val: string) {
      this._nodeValue = String(val)
    }

    get textContent(): string {
      if (this.nodeType === 3) return this._nodeValue
      return this.childNodes.map((c) => c.textContent).join('')
    }
    set textContent(val: string) {
      if (this.nodeType === 3) {
        this._nodeValue = String(val)
      } else {
        this.childNodes = []
        if (val) {
          const textNode = new MockNode()
          textNode.nodeType = 3
          textNode.nodeValue = String(val)
          this.appendChild(textNode)
        }
      }
    }

    get children(): MockElement[] {
      return this.childNodes.filter((n): n is MockElement => n.nodeType === 1)
    }

    get firstChild(): MockNode | null {
      return this.childNodes[0] ?? null
    }

    get lastChild(): MockNode | null {
      return this.childNodes[this.childNodes.length - 1] ?? null
    }

    get firstElementChild(): MockElement | null {
      return this.children[0] ?? null
    }

    get lastElementChild(): MockElement | null {
      const ch = this.children
      return ch[ch.length - 1] ?? null
    }

    get nextSibling(): MockNode | null {
      if (!this.parentNode) return null
      const idx = this.parentNode.childNodes.indexOf(this)
      return idx >= 0 && idx < this.parentNode.childNodes.length - 1
        ? this.parentNode.childNodes[idx + 1]
        : null
    }

    get previousSibling(): MockNode | null {
      if (!this.parentNode) return null
      const idx = this.parentNode.childNodes.indexOf(this)
      return idx > 0 ? this.parentNode.childNodes[idx - 1] : null
    }

    get nextElementSibling(): MockElement | null {
      if (!this.parentNode) return null
      const siblings = (this.parentNode as MockElement).children ?? []
      const idx = siblings.indexOf(this as unknown as MockElement)
      return idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null
    }

    get previousElementSibling(): MockElement | null {
      if (!this.parentNode) return null
      const siblings = (this.parentNode as MockElement).children ?? []
      const idx = siblings.indexOf(this as unknown as MockElement)
      return idx > 0 ? siblings[idx - 1] : null
    }

    appendChild(child: MockNode): MockNode {
      if (child.nodeType === 11) {
        // DocumentFragment: transferir todos los hijos síncronamente
        const children = [...child.childNodes]
        child.childNodes = []
        for (const c of children) {
          this.appendChild(c)
        }
        return child
      }
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
      if (newNode.nodeType === 11) {
        // DocumentFragment: transferir todos los hijos síncronamente
        const children = [...newNode.childNodes]
        newNode.childNodes = []
        for (const c of children) {
          this.insertBefore(c, referenceNode)
        }
        return newNode
      }
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

    contains(other: MockNode | null): boolean {
      if (!other) return false
      if (other === this) return true
      let current = other.parentNode
      while (current) {
        if (current === this) return true
        current = current.parentNode
      }
      return false
    }

    cloneNode(deep = false): MockNode {
      const clone = new MockElement((this as unknown as MockElement).tagName ?? 'DIV')
      clone.nodeType = this.nodeType
      clone.nodeValue = this.nodeValue
      if (this instanceof MockElement) {
        clone.attributes = { ...this.attributes }
        clone.classList = new MockClassList(this.classList.value)
        clone.value = this.value
      }
      if (deep) {
        for (const child of this.childNodes) {
          clone.appendChild(child.cloneNode(true))
        }
      }
      return clone
    }
  }

  class MockElement extends MockNode {
    tagName = 'DIV'
    style: MockStyle
    attributes: Record<string, string> = {}
    listeners: Record<string, Listener[]> = {}
    classList: MockClassList
    private _value = ''

    constructor(tagName = 'DIV') {
      super()
      this.tagName = tagName.toUpperCase()
      this.classList = new MockClassList()
      this.style = new MockStyle()
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

    get innerHTML(): string {
      return this.childNodes
        .map((n) => {
          if (n.nodeType === 3) {
            return n.nodeValue
          }
          if (n.nodeType === 8) {
            return `<!--${n.nodeValue}-->`
          }
          if (n instanceof MockElement) {
            const tag = n.tagName.toLowerCase()
            const attrs = Object.entries(n.attributes)
              .map(([k, v]) => (v === '' ? k : `${k}="${v}"`))
              .join(' ')
            const attrStr = attrs ? ` ${attrs}` : ''
            return `<${tag}${attrStr}>${n.innerHTML}</${tag}>`
          }
          return ''
        })
        .join('')
    }
    set innerHTML(_val: string) {}

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
      if (selector === '[tabindex]:not([tabindex="-1"])') {
        return (
          this.hasAttribute('tabindex') && this.getAttribute('tabindex') !== '-1' && !this.disabled
        )
      }
      return this.tagName.toLowerCase() === selector.toLowerCase()
    }

    querySelector(selector: string): MockElement | null {
      // Soporte para selectores compuestos separados por coma
      if (selector.includes(',')) {
        const parts = selector.split(',').map((s) => s.trim())
        for (const part of parts) {
          const found = this.querySelector(part)
          if (found) return found
        }
        return null
      }
      // Soporte para selectores descendientes
      const descendantParts = selector.trim().split(/\s+/)
      if (descendantParts.length > 1) {
        const first = this.querySelector(descendantParts[0])
        return first ? first.querySelector(descendantParts.slice(1).join(' ')) : null
      }
      for (const child of this.children) {
        if (child.matches(selector)) return child
        const found = child.querySelector(selector)
        if (found) return found
      }
      return null
    }

    querySelectorAll(selector: string): MockElement[] {
      // Soporte para selectores compuestos separados por coma
      if (selector.includes(',')) {
        const parts = selector.split(',').map((s) => s.trim())
        const set = new Set<MockElement>()
        for (const part of parts) {
          this.querySelectorAll(part).forEach((el) => set.add(el))
        }
        return Array.from(set)
      }
      // Soporte para selectores descendientes
      const descendantParts = selector.trim().split(/\s+/)
      if (descendantParts.length > 1) {
        const firsts = this.querySelectorAll(descendantParts[0])
        const results: MockElement[] = []
        for (const f of firsts) {
          results.push(...f.querySelectorAll(descendantParts.slice(1).join(' ')))
        }
        return results
      }
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
    createDocumentFragment: () => {
      const fragment = new MockNode()
      fragment.nodeType = 11
      return fragment
    },
    createTextNode: (text: string) => {
      const n = new MockNode()
      n.nodeType = 3
      n.nodeValue = String(text)
      return n
    },
    createComment: (text: string) => {
      const n = new MockNode()
      n.nodeType = 8
      n.nodeValue = String(text)
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
