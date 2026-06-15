/**
 * Responsive layout test utilities
 *
 * Provides helpers to simulate different viewport sizes in jsdom
 * for testing responsive component behavior.
 */

/** Mobile viewport width (below Tailwind lg: 1024px) */
export const MOBILE_WIDTH = 375;
/** Tablet viewport width */
export const TABLET_WIDTH = 768;
/** Desktop viewport width (above Tailwind lg: 1024px) */
export const DESKTOP_WIDTH = 1280;
/** Standard viewport height used for all sizes */
export const VIEWPORT_HEIGHT = 900;

/** Tailwind breakpoints for reference */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Resize the jsdom window to the given dimensions.
 * Fires a 'resize' event so components listening to window resize react.
 */
export function setViewport(width: number, height: number = VIEWPORT_HEIGHT): void {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
}

/** Set viewport to a mobile width (< 1024px) */
export function setMobileViewport(): void {
  setViewport(MOBILE_WIDTH);
}

/** Set viewport to a tablet width (768px) */
export function setTabletViewport(): void {
  setViewport(TABLET_WIDTH);
}

/** Set viewport to a desktop width (>= 1024px) */
export function setDesktopViewport(): void {
  setViewport(DESKTOP_WIDTH);
}

/** Check if the current viewport matches a Tailwind breakpoint (emulates `lg:` etc.) */
export function isViewportAtLeast(breakpoint: keyof typeof BREAKPOINTS): boolean {
  return window.innerWidth >= BREAKPOINTS[breakpoint];
}

/**
 * Execute a callback in a specific viewport, then restore the original size.
 *
 * @example
 * await withViewport(DESKTOP_WIDTH, async () => {
 *   render(<MyComponent />);
 *   expect(screen.getByRole('navigation')).toBeVisible();
 * });
 */
export async function withViewport<T>(
  width: number,
  fn: () => Promise<T> | T,
): Promise<T> {
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;
  try {
    setViewport(width);
    return await fn();
  } finally {
    setViewport(originalWidth, originalHeight);
  }
}
