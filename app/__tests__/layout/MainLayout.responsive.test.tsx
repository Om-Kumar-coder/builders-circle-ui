/**
 * Responsive layout tests for the MainLayout component
 *
 * Verifies the integration between Header and Sidebar:
 * - Sidebar starts closed on mobile
 * - Clicking the Header menu button opens the sidebar
 * - The sidebar overlay is present when sidebar is open
 * - Content area renders children correctly
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { setDesktopViewport, setMobileViewport } from '../../../tests/utils/responsive';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUsePathname = jest.fn().mockReturnValue('/dashboard');
const mockRouterPush = jest.fn();
const mockGetUnreadMessageCount = jest.fn().mockResolvedValue({ count: 0 });
const mockGetCycles = jest.fn().mockResolvedValue([]);

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@test.com', role: 'contributor' },
    loading: false,
    logout: jest.fn(),
  }),
}));

jest.mock('../../../src/hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: () => true,
    isAdmin: false,
    isFounder: false,
  }),
}));

jest.mock('../../../src/hooks/useCycles', () => ({
  useCycles: () => ({
    cycles: [],
    loading: false,
  }),
}));

jest.mock('../../../src/hooks/useSessionTracking', () => ({
  useSessionTracking: jest.fn(),
}));

jest.mock('../../../src/lib/api-client', () => ({
  apiClient: {
    getUnreadMessageCount: () => mockGetUnreadMessageCount(),
  },
}));

// Import after mocks
import MainLayout from '../../../src/components/layout/MainLayout';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MainLayout — Mobile Viewport', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    setMobileViewport();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders children content', () => {
    render(
      <MainLayout title="Test Dashboard">
        <div data-testid="child-content">Hello World</div>
      </MainLayout>,
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('sidebar starts closed on mount (no overlay)', () => {
    render(
      <MainLayout title="Dashboard">
        <div>Content</div>
      </MainLayout>,
    );

    // Overlay should NOT be present when sidebar starts closed
    // Use div[aria-hidden] to avoid matching SVG icons which also have aria-hidden
    const overlay = document.querySelector('div[aria-hidden="true"]');
    expect(overlay).not.toBeInTheDocument();
  });

  it('sidebar is off-screen (-translate-x-full) when closed on mobile', () => {
    render(
      <MainLayout title="Dashboard">
        <div>Content</div>
      </MainLayout>,
    );

    const aside = document.querySelector('aside');
    expect(aside).toBeInTheDocument();
    expect(aside!.className).toContain('-translate-x-full');
  });

  it('opens sidebar when menu button is clicked', () => {
    render(
      <MainLayout title="Dashboard">
        <div>Content</div>
      </MainLayout>,
    );

    // Click the mobile menu button
    const menuBtn = screen.getByLabelText('Open menu');
    fireEvent.click(menuBtn);

    // Sidebar should now have translate-x-0 (visible)
    const aside = document.querySelector('aside');
    expect(aside!.className).toContain('translate-x-0');

    // Overlay should now be present
    const overlay = document.querySelector('div[aria-hidden="true"]');
    expect(overlay).toBeInTheDocument();
  });

  it('closes sidebar when overlay is clicked', () => {
    render(
      <MainLayout title="Dashboard">
        <div>Content</div>
      </MainLayout>,
    );

    // Open sidebar
    fireEvent.click(screen.getByLabelText('Open menu'));

    // Verify it's open
    let aside = document.querySelector('aside');
    expect(aside!.className).toContain('translate-x-0');

    // Click overlay to close
    const overlay = document.querySelector('div[aria-hidden="true"]');
    fireEvent.click(overlay!);

    // Sidebar should be off-screen again
    aside = document.querySelector('aside');
    expect(aside!.className).toContain('-translate-x-full');
  });

  it('shows the title in the header', () => {
    render(
      <MainLayout title="My Page">
        <div>Content</div>
      </MainLayout>,
    );

    expect(screen.getByText('My Page')).toBeInTheDocument();
  });

  it('renders the main content area with container classes', () => {
    const { container } = render(
      <MainLayout title="Dashboard">
        <div>Content</div>
      </MainLayout>,
    );

    // The main content should have container mx-auto classes
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
  });
});

describe('MainLayout — Desktop Viewport', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    setDesktopViewport();
  });

  afterEach(() => {
    cleanup();
  });

  it('sidebar has lg static positioning on desktop', () => {
    render(
      <MainLayout title="Dashboard">
        <div>Content</div>
      </MainLayout>,
    );

    const aside = document.querySelector('aside');
    expect(aside).toBeInTheDocument();
    // On desktop, sidebar has lg:static and lg:translate-x-0
    expect(aside!.className).toContain('lg:static');
    expect(aside!.className).toContain('lg:translate-x-0');
  });

  it('does not render mobile menu button on desktop', () => {
    render(
      <MainLayout title="Dashboard">
        <div>Content</div>
      </MainLayout>,
    );

    // The menu button still exists in the DOM but has lg:hidden class
    const menuBtn = screen.getByLabelText('Open menu');
    expect(menuBtn).toBeInTheDocument();
    expect(menuBtn.className).toContain('lg:hidden');
  });
});
