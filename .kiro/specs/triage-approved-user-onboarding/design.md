# Design Document: Triage-Approved User Onboarding Fix

## Overview

The `verify-email` page in Builder's Circle has a bug where triage-approved users — who have no password yet — are shown a "Continue to Login" button after email verification. This allows them to skip password setup and get stuck at login. The fix is contained entirely within `app/verify-email/page.tsx` and involves:

1. Adding a `needsPassword` boolean to component state.
2. Setting it from the API response before rendering the success UI.
3. Branching the success UI block to render either the password-setup variant or the standard login-redirect variant based on that state.

No backend changes are required. The backend already returns `{ success: true, needsPassword: true }` correctly.

## Architecture

This is a single-file frontend fix. The flow is:

```
/verify-email?token=...
  └─ verifyEmail(token)
       └─ apiClient.verifyEmail(token)
            ├─ needsPassword: true  →  setNeedsPassword(true) → success UI (password-setup variant)
            │                              └─ setTimeout 2s → router.push(/set-password?token=...)
            └─ needsPassword: false →  setNeedsPassword(false) → success UI (login-redirect variant)
                                           └─ setTimeout 3s → router.push(/login?verified=true)
```

## Components and Interfaces

### VerifyEmailContent (modified)

File: `app/verify-email/page.tsx`

State additions:
```typescript
const [needsPassword, setNeedsPassword] = useState<boolean>(false);
```

Updated `verifyEmail` logic:
```typescript
const verifyEmail = useCallback(async (token: string) => {
  try {
    const result = await apiClient.verifyEmail(token);
    const requiresPassword = !!(result as any)?.needsPassword;
    setNeedsPassword(requiresPassword);
    setStatus('success');

    if (requiresPassword) {
      setMessage('Email verified! Setting up your account...');
      setTimeout(() => {
        router.push(`/set-password?token=${token}`);
      }, 2000);
    } else {
      setMessage('Your email has been verified successfully! You can now sign in.');
      setTimeout(() => {
        router.push('/login?verified=true');
      }, 3000);
    }
  } catch {
    setStatus('error');
    setMessage('Email verification failed. Please try again or request a new verification link.');
  }
}, [router]);
```

Updated success UI block:
```tsx
{status === 'success' && needsPassword && (
  <div className="space-y-4">
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
      <p className="text-blue-400 text-sm">
        🔐 Email verified! Setting up your account...
      </p>
    </div>
    <button
      onClick={() => router.push(`/set-password?token=${searchParams.get('token')}`)}
      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
    >
      Set Up Password
    </button>
  </div>
)}

{status === 'success' && !needsPassword && (
  <div className="space-y-4">
    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
      <p className="text-green-400 text-sm">
        🎉 Welcome to Builder&apos;s Circle! You&apos;ll be redirected to the login page in a few seconds.
      </p>
    </div>
    <button
      onClick={() => router.push('/login?verified=true')}
      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
    >
      Continue to Login
    </button>
  </div>
)}
```

## Data Models

No new data models. The existing API response shape is used:

```typescript
// Existing backend response (no changes needed)
interface VerifyEmailResponse {
  success: boolean;
  needsPassword?: boolean; // true for triage-approved users
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

Property 1: Password-setup UI rendered exclusively when needsPassword is true

*For any* successful email verification response where `needsPassword` is `true`, the rendered success UI must contain the "Set Up Password" button and the "Email verified! Setting up your account..." message, and must NOT contain the "Continue to Login" button.

**Validates: Requirements 1.1, 1.3, 1.4, 2.3**

---

Property 2: Standard login UI rendered exclusively when needsPassword is false

*For any* successful email verification response where `needsPassword` is `false` or absent, the rendered success UI must contain the "Continue to Login" button, and must NOT contain the "Set Up Password" button.

**Validates: Requirements 1.5, 2.4**

---

Example 1: Redirect destination when needsPassword is true

When `needsPassword` is `true` and the token is `"abc123"`, after 2 seconds the router must push `/set-password?token=abc123`.

**Validates: Requirements 1.2**

## Error Handling

No changes to error handling. The existing `catch` block and error UI remain unchanged.

## Testing Strategy

**Dual Testing Approach**: Unit tests for specific examples and edge cases; property-based tests for universal rendering correctness.

**Property-Based Testing Library**: `fast-check` (already common in TypeScript/Next.js projects).

**Unit Tests** (specific examples):
- Render with `needsPassword: true` response → assert "Set Up Password" button present, "Continue to Login" absent, message text correct.
- Render with `needsPassword: false` response → assert "Continue to Login" button present, "Set Up Password" absent.
- Render with response omitting `needsPassword` → same as `false` case.
- Timer fires with `needsPassword: true` → assert `router.push` called with `/set-password?token=...`.

**Property-Based Tests** (universal properties):
- Property 1: For any boolean `needsPassword` value, the rendered success UI must contain exactly the correct button and message for that value, and never both simultaneously.
  - Tag: `Feature: triage-approved-user-onboarding, Property 1: password-setup UI rendered exclusively when needsPassword is true`
  - Minimum 100 iterations.
- Property 2: For any standard verification response, the login-redirect UI is rendered.
  - Tag: `Feature: triage-approved-user-onboarding, Property 2: standard login UI rendered exclusively when needsPassword is false`
  - Minimum 100 iterations.

**Test file**: `app/verify-email/__tests__/page.test.tsx`
