/**
 * Responsive layout tests for the Sidebar component
 *
 * Verifies:
 * - Mobile overlay appears/disappears with isOpen prop
 * - Sidebar translates off-screen when closed, on-screen when open
 * - Close button is rendered on mobile
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { setDesktopViewport, setMobileViewport } from '../../../tests/utils/responsive';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUsePathname = jest.fn().mockReturnValue('/dashboard');
const mockRouterPush = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@test.com', role: 'contributor' },
    loading: false,
  }),
}));

jest.mock('../../../src/hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: () => true,
    isAdmin: false,
    isFounder: false,
    isParticipant: true,
    canAny: () => true,
    canAll: () => true,
    role: 'contributor',
  }),
}));

// Import after mocks
import Sidebar from '../../../src/components/layout/Sidebar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSidebar(isOpen: boolean, onClose = jest.fn()) {
  return render(<Sidebar isOpen={isOpen} onClose={onClose} />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Sidebar — Mobile Overlay Behavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    setMobileViewport(); // simulate mobile viewport
  });

  afterEach(() => {
    cleanup();
  });

  it('renders mobile overlay when isOpen is true', () => {
    renderSidebar(true);
    // The overlay is a div with onClick={onClose} and aria-hidden="true"
    // Use div[aria-hidden] to avoid matching SVG icons which also have aria-hidden
    const overlay = document.querySelector('div[aria-hidden="true"]');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-black/50', 'z-40', 'lg:hidden');
  });

  it('does NOT render mobile overlay when isOpen is false', () => {
    renderSidebar(false);
    const overlay = document.querySelector('div[aria-hidden="true"]');
    expect(overlay).not.toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = jest.fn();
    renderSidebar(true, onClose);

    const overlay = document.querySelector('div[aria-hidden="true"]');
    expect(overlay).toBeInTheDocument();

    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows sidebar with translate-x-0 when open', () => {
    renderSidebar(true);
    const aside = document.querySelector('aside');
    expect(aside).toBeInTheDocument();
    expect(aside!.className).toContain('translate-x-0');
  });

  it('shows sidebar with -translate-x-full when closed on mobile', () => {
    renderSidebar(false);
    const aside = document.querySelector('aside');
    expect(aside).toBeInTheDocument();
    expect(aside!.className).toContain('-translate-x-full');
  });

  it('renders close button inside sidebar on mobile', () => {
    renderSidebar(true);
    const closeBtn = screen.getByLabelText('Close sidebar');
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn.className).toContain('lg:hidden');
  });

  it('close button triggers onClose when clicked', () => {
    const onClose = jest.fn();
    renderSidebar(true, onClose);

    const closeBtn = screen.getByLabelText('Close sidebar');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders navigation items', () => {
    renderSidebar(true);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Build Cycles')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('renders the logo and title', () => {
    renderSidebar(true);
    expect(screen.getByText("Builder's Circle")).toBeInTheDocument();
  });

  it('renders copyright footer', () => {
    renderSidebar(true);
    expect(screen.getByText('© 2026 Builder\'s Circle')).toBeInTheDocument();
  });
});

describe('Sidebar — Desktop visibility (lg: breakpoint classes)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    setDesktopViewport();
  });

  afterEach(() => {
    cleanup();
  });

  it('has lg:translate-x-0 class to keep sidebar visible on desktop', () => {
    renderSidebar(false);
    const aside = document.querySelector('aside');
    expect(aside).toBeInTheDocument();
    // The sidebar has "lg:translate-x-0 lg:static lg:z-auto" classes
    expect(aside!.className).toContain('lg:translate-x-0');
    expect(aside!.className).toContain('lg:static');
  });

  it('does not render mobile overlay on desktop regardless of isOpen', () => {
    renderSidebar(true);
    const overlay = document.querySelector('div[aria-hidden="true"]');
    expect(overlay).toBeInTheDocument();
    // The class lg:hidden ensures it's visually hidden on desktop via CSS
    expect(overlay!.className).toContain('lg:hidden');
  });

  it('close button has lg:hidden class on desktop', () => {
    renderSidebar(true);
    const closeBtn = screen.getByLabelText('Close sidebar');
    expect(closeBtn.className).toContain('lg:hidden');
  });
});
