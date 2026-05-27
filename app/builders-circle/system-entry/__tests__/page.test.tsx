/**
 * Component Tests — System Entry (Prefilter) Page
 *
 * Tests the entry control prefilter page:
 * 1. Page renders correctly with all sections
 * 2. Acknowledgment checkbox enables the CTA button
 * 3. CTA logs events and navigates to /triage/apply
 * 4. Exit tracking sends beforeunload beacon
 * 5. Scroll tracking fires prefilter_scrolled_50
 * 6. Handles already-acknowledged state from localStorage
 * 7. Server-signed JWT request flow
 */

import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

// ── Mock next/navigation ────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── Mock fetch globally ─────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;
global.Request = jest.fn() as any;

// Mock sendBeacon
const mockSendBeacon = jest.fn();
Object.defineProperty(navigator, 'sendBeacon', {
  value: mockSendBeacon,
  writable: true,
});

// ── Mock sessionStorage / localStorage ──────────────────────────────────

const mockSessionStorage: Record<string, string> = {};
const mockLocalStorage: Record<string, string> = {};

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: (key: string) => mockSessionStorage[key] ?? null,
    setItem: (key: string, val: string) => { mockSessionStorage[key] = val; },
    removeItem: (key: string) => { delete mockSessionStorage[key]; },
    clear: () => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]); },
  },
  writable: true,
});

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] ?? null,
    setItem: (key: string, val: string) => { mockLocalStorage[key] = val; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); },
  },
  writable: true,
});

// ── Import after mocks ──────────────────────────────────────────────────

import SystemEntryPage from '../page';

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]);
  Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);

  // Default: fetch succeeds for event logging
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
});

afterEach(() => {
  cleanup();
});

// ── TEST GROUP 1: Initial Render ────────────────────────────────────────

describe('SystemEntry Initial Render [Group 1]', () => {
  test('renders the page title and header', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await act(async () => {
      render(<SystemEntryPage />);
    });

    expect(screen.getByText('Builders Circle')).toBeInTheDocument();
    expect(screen.getByText('System Entry')).toBeInTheDocument();
  });

  test('renders all 4 requirement items', async () => {
    await act(async () => {
      render(<SystemEntryPage />);
    });

    expect(screen.getByText('Commitment to Contribution')).toBeInTheDocument();
    expect(screen.getByText('Alignment with Platform Values')).toBeInTheDocument();
    expect(screen.getByText('Verifiable Track Record')).toBeInTheDocument();
    expect(screen.getByText(/Onboarding & Security/)).toBeInTheDocument();
  });

  test('renders disabled CTA button initially', async () => {
    await act(async () => {
      render(<SystemEntryPage />);
    });

    const cta = screen.getByRole('button', { name: /proceed to application/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toBeDisabled();
  });

  test('renders acknowledgment checkbox unchecked', async () => {
    await act(async () => {
      render(<SystemEntryPage />);
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  test('logs prefilter_page_view on mount', async () => {
    await act(async () => {
      render(<SystemEntryPage />);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/triage/event',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('prefilter_page_view'),
      })
    );
  });
});

// ── TEST GROUP 2: Acknowledgment Flow ───────────────────────────────────

describe('SystemEntry Acknowledgment Flow [Group 2]', () => {
  test('checking checkbox enables the CTA button', async () => {
    // Mock the prefilter/ack endpoint to return a valid token
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }) // event log
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { token: 'test-jwt-token', expiresIn: '2h' } }) }) // prefilter/ack
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }); // set-cookie

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const checkbox = screen.getByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkbox);
    });

    // Wait for the async operations to settle
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    const cta = screen.getByRole('button', { name: /proceed to application/i });
    expect(cta).not.toBeDisabled();
  });

  test('checking checkbox stores ack in localStorage', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { token: 'test-jwt', expiresIn: '2h' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const checkbox = screen.getByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkbox);
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect(mockLocalStorage['prefilter_ack']).toBe('true');
    expect(mockLocalStorage['prefilter_token']).toBeDefined();
  });

  test('logs prefilter_checkbox_checked on checkbox toggle', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { token: 'test-jwt', expiresIn: '2h' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const checkbox = screen.getByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkbox);
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    // Should have logged prefilter_checkbox_checked after the token flow
    const events = mockFetch.mock.calls.filter(
      (call: any[]) => call[0] === '/api/triage/event'
    );
    const hasCheckboxEvent = events.some(
      (call: any[]) => call[1]?.body?.includes('prefilter_checkbox_checked')
    );
    expect(hasCheckboxEvent).toBe(true);
  });

  test('unchecking checkbox disables the CTA and removes localStorage keys', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { token: 'test-jwt', expiresIn: '2h' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const checkbox = screen.getByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkbox);
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    // Uncheck
    mockLocalStorage['prefilter_ack'] = 'true'; // Simulate stored state
    await act(async () => {
      fireEvent.click(checkbox);
    });

    expect(mockLocalStorage['prefilter_ack']).toBeUndefined();
    expect(mockLocalStorage['prefilter_token']).toBeUndefined();

    const cta = screen.getByRole('button', { name: /proceed to application/i });
    expect(cta).toBeDisabled();
  });
});

// ── TEST GROUP 3: CTA Navigation ────────────────────────────────────────

describe('SystemEntry CTA Navigation [Group 3]', () => {
  test('clicking CTA navigates to /triage/apply', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { token: 'test-jwt', expiresIn: '2h' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const checkbox = screen.getByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkbox);
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    const cta = screen.getByRole('button', { name: /proceed to application/i });
    await act(async () => {
      fireEvent.click(cta);
    });

    // Wait for the 200ms delay + route push
    await act(async () => {
      await new Promise(r => setTimeout(r, 300));
    });

    expect(mockPush).toHaveBeenCalledWith('/triage/apply');
  });

  test('clicking CTA logs prefilter_cta_click event', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { token: 'test-jwt', expiresIn: '2h' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const checkbox = screen.getByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkbox);
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    const cta = screen.getByRole('button', { name: /proceed to application/i });
    await act(async () => {
      fireEvent.click(cta);
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 300));
    });

    const hasCtaEvent = mockFetch.mock.calls.some(
      (call: any[]) => call[0] === '/api/triage/event' && call[1]?.body?.includes('prefilter_cta_click')
    );
    expect(hasCtaEvent).toBe(true);
  });
});

// ── TEST GROUP 4: Exit Tracking ─────────────────────────────────────────

describe('SystemEntry Exit Tracking [Group 4]', () => {
  test('sends beacon on beforeunload when not acknowledged', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      render(<SystemEntryPage />);
    });

    // Trigger beforeunload
    fireEvent(window, new Event('beforeunload'));

    expect(mockSendBeacon).toHaveBeenCalledWith(
      '/api/triage/event',
      expect.any(Blob)
    );
  });

  test('does not send beacon on beforeunload when acknowledged', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { token: 'test-jwt', expiresIn: '2h' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const checkbox = screen.getByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkbox);
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    // Trigger beforeunload with acknowledged state
    fireEvent(window, new Event('beforeunload'));

    expect(mockSendBeacon).not.toHaveBeenCalled();
  });
});

// ── TEST GROUP 5: Preexisting Session ───────────────────────────────────

describe('SystemEntry Preexisting Session [Group 5]', () => {
  test('reads prefilter_ack from localStorage and shows CTA enabled', async () => {
    mockLocalStorage['prefilter_ack'] = 'true';

    // First call is event log (page view), remaining calls for ack flow
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { token: 'existing-jwt', expiresIn: '2h' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      render(<SystemEntryPage />);
    });

    // Wait for async operations
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  test('generates session ID and stores in sessionStorage', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const sid = mockSessionStorage['prefilter_session_id'];
    expect(sid).toBeDefined();
    expect(sid).toMatch(/^pref_\d+_/);
  });

  test('reuses existing session ID on re-render', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const firstSid = mockSessionStorage['prefilter_session_id'];

    cleanup();

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const secondSid = mockSessionStorage['prefilter_session_id'];
    expect(secondSid).toBe(firstSid);
  });
});

// ── TEST GROUP 6: Server-Side JWT Flow ──────────────────────────────────

describe('SystemEntry Server-Side JWT Flow [Group 6]', () => {
  test('calls prefilter/ack endpoint on acknowledgment', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }) // page view event
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { token: 'jwt-abc-123', expiresIn: '2h' } }) }) // prefilter/ack
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }); // set-cookie

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const checkbox = screen.getByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkbox);
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    // Check prefilter/ack was called with sessionId
    const ackCalls = mockFetch.mock.calls.filter((call: any[]) => call[0] === '/api/triage/prefilter/ack');
    expect(ackCalls.length).toBe(1);
    expect(ackCalls[0][1].body).toContain('sessionId');
    expect(ackCalls[0][1].body).toContain('pref_');

    // Token should be stored
    expect(mockLocalStorage['prefilter_token']).toBe('jwt-abc-123');
  });

  test('calls set-cookie endpoint after getting JWT', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { token: 'jwt-abc-123', expiresIn: '2h' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    await act(async () => {
      render(<SystemEntryPage />);
    });

    const checkbox = screen.getByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkbox);
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    const cookieCalls = mockFetch.mock.calls.filter((call: any[]) => call[0] === '/api/prefilter/set-cookie');
    expect(cookieCalls.length).toBe(1);
    expect(cookieCalls[0][1].body).toContain('jwt-abc-123');
  });
});
