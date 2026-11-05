/** jsdom stubs so Mantine can mount in unit tests (copied from automation-pitch). */

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) => {
    const min = /\(min-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
    const matches = min ? 1024 >= Number(min[1]) : false;
    return {
      matches,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    } as MediaQueryList;
  };
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Mantine's autosizing Textarea listens for font loading.
if (!document.fonts) {
  Object.defineProperty(document, "fonts", {
    value: { addEventListener() {}, removeEventListener() {}, ready: Promise.resolve() },
  });
}

// jsdom has no canvas; label measuring falls back to an estimate when there is no 2D context.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;
