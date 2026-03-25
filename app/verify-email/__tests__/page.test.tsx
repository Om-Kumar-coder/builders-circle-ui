/**
 * Unit tests for VerifyEmailContent success UI branching
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';

// Mock next/navigation
const mockPush = jest.fn();
let mockToken = 'test-token-123';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? mockToken : null),
  }),
}));

// Mock apiClient
const mockVerifyEmail = jest.fn();
jest.mock('../../../src/lib/api-client', () => ({
  apiClient: {
    verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args),
    resendVerificationEmail: jest.fn(),
  },
}));

// Import after mocks are set up
import VerifyEmailPage from '../page';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockToken = 'test-token-123';
});

afterEach(() => {
  jest.useRealTimers();
});

describe('VerifyEmailContent success UI branching', () => {
  it('renders "Set Up Password" button and correct message when needsPassword is true, no "Continue to Login"', async () => {
    // Requirement 1.1, 1.3, 1.4
    mockVerifyEmail.mockResolvedValue({ success: true, needsPassword: true });

    await act(async () => {
      render(<VerifyEmailPage />);
    });

    expect(screen.getByRole('button', { name: /set up password/i })).toBeInTheDocument();
    // The message appears in both the status paragraph and the blue info box
    expect(screen.getAllByText(/email verified! setting up your account/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /continue to login/i })).not.toBeInTheDocument();
  });

  it('renders "Continue to Login" button and no "Set Up Password" when needsPassword is false', async () => {
    // Requirement 1.5
    mockVerifyEmail.mockResolvedValue({ success: true, needsPassword: false });

    await act(async () => {
      render(<VerifyEmailPage />);
    });

    expect(screen.getByRole('button', { name: /continue to login/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set up password/i })).not.toBeInTheDocument();
  });

  it('behaves like needsPassword: false when needsPassword is omitted from response', async () => {
    // Requirement 1.5
    mockVerifyEmail.mockResolvedValue({ success: true });

    await act(async () => {
      render(<VerifyEmailPage />);
    });

    expect(screen.getByRole('button', { name: /continue to login/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set up password/i })).not.toBeInTheDocument();
  });

  it('fires router.push to /set-password?token=... after 2s when needsPassword is true', async () => {
    // Requirement 1.2
    mockVerifyEmail.mockResolvedValue({ success: true, needsPassword: true });

    await act(async () => {
      render(<VerifyEmailPage />);
    });

    expect(mockPush).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockPush).toHaveBeenCalledWith('/set-password?token=test-token-123');
  });
});

// Feature: triage-approved-user-onboarding, Property 1: password-setup UI rendered exclusively when needsPassword is true
describe('Property 1: password-setup UI rendered exclusively when needsPassword is true', () => {
  it('for any needsPassword: true response, "Set Up Password" is present and "Continue to Login" is absent', async () => {
    // Validates: Requirements 1.1, 1.3, 1.4, 2.3
    await fc.assert(
      fc.asyncProperty(fc.constant(true), async (_needsPassword) => {
        mockVerifyEmail.mockResolvedValue({ success: true, needsPassword: true });

        await act(async () => {
          render(<VerifyEmailPage />);
        });

        const setUpBtn = screen.queryByRole('button', { name: /set up password/i });
        const loginBtn = screen.queryByRole('button', { name: /continue to login/i });
        const messages = screen.queryAllByText(/email verified! setting up your account/i);

        const result =
          setUpBtn !== null &&
          loginBtn === null &&
          messages.length >= 1;

        cleanup();
        return result;
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: triage-approved-user-onboarding, Property 2: standard login UI rendered exclusively when needsPassword is false
describe('Property 2: standard login UI rendered exclusively when needsPassword is false', () => {
  it('for any needsPassword: false/absent response, "Continue to Login" is present and "Set Up Password" is absent', async () => {
    // Validates: Requirements 1.5, 2.4
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.constant(false), fc.constant(undefined)),
        async (needsPasswordValue) => {
          const response: Record<string, unknown> = { success: true };
          if (needsPasswordValue !== undefined) {
            response.needsPassword = needsPasswordValue;
          }
          mockVerifyEmail.mockResolvedValue(response);

          await act(async () => {
            render(<VerifyEmailPage />);
          });

          const loginBtn = screen.queryByRole('button', { name: /continue to login/i });
          const setUpBtn = screen.queryByRole('button', { name: /set up password/i });

          const result = loginBtn !== null && setUpBtn === null;

          cleanup();
          return result;
        }
      ),
      { numRuns: 100 }
    );
  });
});
