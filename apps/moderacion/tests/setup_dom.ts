/**
 * Setup de entorno DOM liviano para pruebas de componentes y lifecycle con @vue/test-utils en Node.
 */

if (typeof globalThis.document === 'undefined') {
  class MockNode {
    nodeType = 1
    childNodes: unknown[] = []
    children: unknown[] = []
    parentNode: unknown = null
  }

  class MockElement extends MockNode {
    style = {}
    innerHTML = ''
    textContent = ''
    attributes: Record<string, string> = {}

    appendChild(child: unknown) {
      this.childNodes.push(child)
      return child
    }
    removeChild(child: unknown) {
      const idx = this.childNodes.indexOf(child)
      if (idx !== -1) this.childNodes.splice(idx, 1)
      return child
    }
    insertBefore(child: unknown) {
      this.childNodes.push(child)
      return child
    }
    setAttribute(name: string, val: string) {
      this.attributes[name] = val
    }
    removeAttribute(name: string) {
      Reflect.deleteProperty(this.attributes, name)
    }
    addEventListener() {}
    removeEventListener() {}
  }

  class MockHTMLElement extends MockElement {}
  class MockSVGElement extends MockElement {}

  // @ts-expect-error mocks para entorno node
  globalThis.Node = MockNode
  // @ts-expect-error mocks para entorno node
  globalThis.Element = MockElement
  // @ts-expect-error mocks para entorno node
  globalThis.HTMLElement = MockHTMLElement
  // @ts-expect-error mocks para entorno node
  globalThis.SVGElement = MockSVGElement

  const mockDoc = {
    createElement: () => new MockHTMLElement(),
    createElementNS: () => new MockSVGElement(),
    createTextNode: () => ({ textContent: '', nodeType: 3 }),
    createComment: () => ({ textContent: '', nodeType: 8 }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    body: new MockHTMLElement(),
  }

  // @ts-expect-error mock para entorno node
  globalThis.document = mockDoc
  // @ts-expect-error mock para entorno node
  globalThis.window = globalThis
}
