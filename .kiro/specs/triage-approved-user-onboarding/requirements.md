# Requirements Document

## Introduction

This document covers the bug fix for the email verification flow for triage-approved users in Builder's Circle. When an admin approves a user via `/admin/triage`, the user receives an approval email with a verification link. Clicking that link hits `/verify-email?token=...`, and the backend returns `{ success: true, needsPassword: true }` for these users since they have no password yet. The current frontend incorrectly shows a "Continue to Login" button for all verified users, allowing triage-approved users to skip password setup entirely and get stuck at login.

## Glossary

- **Triage_User**: A user who applied via `/submit-to-triage` and was approved by an admin, but has not yet set a password.
- **Standard_User**: A user who registered normally and already has a password set.
- **Verify_Email_Page**: The frontend page at `/verify-email` that handles email verification token processing.
- **needsPassword**: A boolean flag returned by the backend `POST /auth/verify-email` endpoint indicating the verified user has no password and must set one before logging in.
- **Set_Password_Page**: The frontend page at `/set-password` where triage-approved users create their initial password.

## Requirements

### Requirement 1: Differentiated Success State for Triage-Approved Users

**User Story:** As a triage-approved user, I want the email verification page to correctly guide me to set my password, so that I can complete account setup without getting stuck at login with no password.

#### Acceptance Criteria

1. WHEN the backend returns `needsPassword: true` after email verification, THE Verify_Email_Page SHALL display the message "Email verified! Setting up your account..." instead of the standard success message.
2. WHEN the backend returns `needsPassword: true` after email verification, THE Verify_Email_Page SHALL redirect the user to `/set-password?token=<token>` after a 2-second delay.
3. WHEN the backend returns `needsPassword: true` after email verification, THE Verify_Email_Page SHALL display a "Set Up Password" button that navigates to `/set-password?token=<token>`.
4. WHEN the backend returns `needsPassword: true` after email verification, THE Verify_Email_Page SHALL NOT display the "Continue to Login" button.
5. WHEN the backend returns `needsPassword: false` or omits `needsPassword` after email verification, THE Verify_Email_Page SHALL display the existing "Continue to Login" button and redirect to `/login?verified=true`.

### Requirement 2: Success State Tracks Password Requirement

**User Story:** As a developer, I want the verify-email page state to accurately reflect whether the user needs to set a password, so that the UI always renders the correct actions for the user's situation.

#### Acceptance Criteria

1. THE Verify_Email_Page SHALL maintain a `needsPassword` boolean in component state, initialized to `false`.
2. WHEN the backend response includes `needsPassword: true`, THE Verify_Email_Page SHALL set the `needsPassword` state to `true` before rendering the success UI.
3. WHILE `needsPassword` state is `true` and status is `success`, THE Verify_Email_Page SHALL render the password-setup variant of the success UI exclusively.
4. WHILE `needsPassword` state is `false` and status is `success`, THE Verify_Email_Page SHALL render the standard login-redirect variant of the success UI exclusively.
