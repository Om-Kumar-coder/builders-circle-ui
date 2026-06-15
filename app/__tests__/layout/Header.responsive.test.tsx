/**
 * Responsive layout tests for the Header component
 *
 * Verifies:
 * - Mobile menu button is visible on mobile viewport (lg:hidden class)
 * - Search bar is hidden on mobile (hidden md:flex)
 * - Menu button triggers onMenuClick callback
 * - User menu dropdown opens and closes correctly
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

jest.mock('../../../src/lib/api-client', () => ({
  apiClient: {
    getUnreadMessageCount: () => mockGetUnreadMessageCount(),
  },
}));

// Import after mocks
import Header from '../../../src/components/layout/Header';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Header — Mobile Menu Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMobileViewport();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders mobile menu button on mobile viewport', () => {
    const onMenuClick = jest.fn();
    render(<Header onMenuClick={onMenuClick} />);

    const menuBtn = screen.getByLabelText('Open menu');
    expect(menuBtn).toBeInTheDocument();
    // Menu button has lg:hidden class — visible on mobile, hidden on desktop
    expect(menuBtn.className).toContain('lg:hidden');
  });

  it('calls onMenuClick when mobile menu button is clicked', () => {
    const onMenuClick = jest.fn();
    render(<Header onMenuClick={onMenuClick} />);

    const menuBtn = screen.getByLabelText('Open menu');
    fireEvent.click(menuBtn);
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it('shows user avatar with initials', () => {
    render(<Header onMenuClick={jest.fn()} />);
    // "TU" for "Test User"
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('shows the title prop', () => {
    render(<Header title="Test Dashboard" onMenuClick={jest.fn()} />);
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('renders messaging button when user exists', () => {
    render(<Header onMenuClick={jest.fn()} />);
    const msgBtn = screen.getByLabelText('Open messaging');
    expect(msgBtn).toBeInTheDocument();
  });
});

describe('Header — User Dropdown Menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMobileViewport();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens user dropdown when avatar button is clicked', () => {
    render(<Header onMenuClick={jest.fn()} />);

    const userBtn = screen.getByLabelText('User menu');
    expect(userBtn).toBeInTheDocument();

    fireEvent.click(userBtn);

    // Dropdown content should be visible
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('shows user email in dropdown', () => {
    render(<Header onMenuClick={jest.fn()} />);

    fireEvent.click(screen.getByLabelText('User menu'));
    expect(screen.getByText('test@test.com')).toBeInTheDocument();
  });

  it('shows user role badge in dropdown', () => {
    render(<Header onMenuClick={jest.fn()} />);

    fireEvent.click(screen.getByLabelText('User menu'));
    expect(screen.getByText('contributor')).toBeInTheDocument();
  });
});

describe('Header — Search Bar Visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('search bar has hidden md:flex classes (hidden on mobile)', () => {
    const { container } = render(<Header onMenuClick={jest.fn()} />);
    // The search wrapper div has 'hidden md:flex' class
    const searchParent = container.querySelector('.hidden');
    expect(searchParent).toBeInTheDocument();
    expect(searchParent!.className).toContain('md:flex');
  });
});

describe('Header — Messaging Panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMobileViewport();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens messaging panel when messaging button is clicked', () => {
    render(<Header onMenuClick={jest.fn()} />);

    const msgBtn = screen.getByLabelText('Open messaging');
    fireEvent.click(msgBtn);

    expect(screen.getByText('Messaging')).toBeInTheDocument();
  });

  it('closes messaging panel when close button is clicked', () => {
    render(<Header onMenuClick={jest.fn()} />);

    const msgBtn = screen.getByLabelText('Open messaging');
    fireEvent.click(msgBtn);

    const closeBtn = screen.getByLabelText('Close messaging');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Messaging')).not.toBeInTheDocument();
  });
});
