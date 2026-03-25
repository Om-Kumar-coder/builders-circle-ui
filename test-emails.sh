#!/bin/bash

API_KEY="re_fPyinyyw_88Sj88amw3dGbKaUzFdKono6"
FROM="Builders Circle <noreply@triagebuilders.com>"
TO="omkumar.coder@gmail.com"
URL="https://api.resend.com/emails"

send() {
  local subject="$1"
  local html="$2"
  local result=$(curl -s -X POST "$URL" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"from\":\"$FROM\",\"to\":\"$TO\",\"subject\":\"$subject\",\"html\":\"$html\"}")
  echo "$subject => $result"
}

echo "Testing all email functions..."

send "New Login Detected - Builders Circle" \
  "<p>Hi there,</p><p>A new login was detected on your account from IP <b>148.230.90.1</b> using Chrome on Windows.</p><p>Time: $(date -u)</p>"

send "Your Password Was Changed - Builders Circle" \
  "<p>Hi there,</p><p>Your account password was successfully changed.</p><p>Time: $(date -u)</p><p>If you did not make this change, contact support immediately.</p>"

send "2FA Enabled - Builders Circle" \
  "<p>Hi there,</p><p>Two-factor authentication has been <b>enabled</b> on your account. Your account is now more secure.</p><p>Time: $(date -u)</p>"

send "2FA Disabled - Builders Circle" \
  "<p>Hi there,</p><p>Two-factor authentication has been <b>disabled</b> on your account.</p><p>Time: $(date -u)</p>"

send "Access Granted - Builders Circle" \
  "<p>Hi there,</p><p>You have been granted access on Builders Circle.</p><p>Access Type: <b>Tier 2</b><br>Expires: <b>No expiry</b></p>"

send "Access Revoked - Builders Circle" \
  "<p>Hi there,</p><p>Your access has been revoked on Builders Circle.</p><p>If you believe this is an error, contact your administrator.</p>"

send "Agreement Accepted - Builders Circle" \
  "<p>Hi there,</p><p>You have successfully accepted the Builders Circle agreement.</p><p>Version: v1.0 | Accepted At: $(date -u)</p>"

send "Welcome to Builders Circle!" \
  "<p>Hi there,</p><p>You have completed onboarding and your account is fully set up. Welcome to Builders Circle!</p>"

send "Participation Warning: At Risk - Builders Circle" \
  "<p>Hi there,</p><p>Your participation status has changed to <b>At Risk</b>.</p><p>Days since last activity: <b>14</b></p><p>Submit a verified activity to restore your active status.</p>"

echo "Done! Check omkumar.coder@gmail.com"
