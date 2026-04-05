import "@testing-library/jest-dom";
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// ResizeObserver polyfill — recharts needs it; happy-dom doesn't include it
// Arrow functions cannot be used as constructors, so we use a class.
// ---------------------------------------------------------------------------
class MockResizeObserver {
  observe    = vi.fn();
  unobserve  = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// ---------------------------------------------------------------------------
// matchMedia polyfill — needed by some theme-detection code
// ---------------------------------------------------------------------------
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches:             false,
    media:               query,
    onchange:            null,
    addListener:         vi.fn(),
    removeListener:      vi.fn(),
    addEventListener:    vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent:       vi.fn(),
  })),
});
