# Implementation Plan: Triage-Approved User Onboarding Fix

## Overview

Single-file fix in `app/verify-email/page.tsx`. Add `needsPassword` state, set it from the API response, and branch the success UI to render the correct variant for triage-approved users vs. standard users.

## Tasks

- [x] 1. Add needsPassword state and update verifyEmail logic
  - Add `const [needsPassword, setNeedsPassword] = useState<boolean>(false)` to `VerifyEmailContent`
  - In `verifyEmail`, extract `needsPassword` from the API result and call `setNeedsPassword` before `setStatus('success')`
  - Update the message set for the `needsPassword: true` branch to `'Email verified! Setting up your account...'`
  - _Requirements: 2.1, 2.2, 1.1, 1.2_

- [x] 2. Update success UI to branch on needsPassword state
  - [x] 2.1 Replace the single `status === 'success'` block with two mutually exclusive blocks:
    - `status === 'success' && needsPassword` → password-setup variant (blue styling, "Set Up Password" button pointing to `/set-password?token=...`, no "Continue to Login")
    - `status === 'success' && !needsPassword` → standard variant (green styling, "Continue to Login" button, no "Set Up Password")
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.3, 2.4_

  - [x] 2.2 Write unit tests for success UI branching
    - Test `needsPassword: true` response renders "Set Up Password" button and correct message, no "Continue to Login"
    - Test `needsPassword: false` response renders "Continue to Login" button, no "Set Up Password"
    - Test response omitting `needsPassword` behaves as `false`
    - Test timer fires `router.push('/set-password?token=...')` when `needsPassword: true`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.3 Write property test for mutually exclusive success UI rendering
    - **Property 1: Password-setup UI rendered exclusively when needsPassword is true**
    - **Validates: Requirements 1.1, 1.3, 1.4, 2.3**
    - Use `fast-check` to generate arbitrary boolean `needsPassword` values and assert the correct button is present and the other is absent
    - Tag: `Feature: triage-approved-user-onboarding, Property 1: password-setup UI rendered exclusively when needsPassword is true`
    - Minimum 100 iterations

  - [x] 2.4 Write property test for standard login UI
    - **Property 2: Standard login UI rendered exclusively when needsPassword is false**
    - **Validates: Requirements 1.5, 2.4**
    - Tag: `Feature: triage-approved-user-onboarding, Property 2: standard login UI rendered exclusively when needsPassword is false`
    - Minimum 100 iterations

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
