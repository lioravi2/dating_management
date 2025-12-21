# Supabase Email Not Sending - Troubleshooting Guide

## Problem
- Audit log shows `user_recovery_requested` (request received)
- No email is being sent (tried Hotmail and Gmail)
- No error message in client

## Diagnosis
This indicates Supabase **received** the request but **failed to send** the email. This is an email service configuration issue, not a code issue.

## Checklist to Verify

### 1. Email Provider Status
**Location:** Supabase Dashboard → Authentication → Providers

- [ ] **Email provider is ENABLED** (toggle should be ON)
- [ ] **Enable email confirmations** - Check if this affects magic links
- [ ] **Enable email change confirmations** - Optional

### 2. SMTP Configuration
**Location:** Supabase Dashboard → Settings → Auth → SMTP Settings

**If using built-in email service:**
- [ ] Built-in service should work by default (no configuration needed)
- [ ] **BUT** built-in service has very strict rate limits (2 emails/hour)
- [ ] Built-in service may be disabled or not working in some regions

**If using custom SMTP:**
- [ ] **SMTP Host** - Should be configured (e.g., `smtp.gmail.com`, `smtp.sendgrid.net`)
- [ ] **SMTP Port** - Should be set (usually 587 for TLS, 465 for SSL)
- [ ] **SMTP User** - Should be your email/SMTP username
- [ ] **SMTP Password** - Should be your SMTP password/app password
- [ ] **Sender email** - Should be a valid email address
- [ ] **Sender name** - Optional but recommended

**Common SMTP Providers:**
- **Gmail**: `smtp.gmail.com`, port 587, use App Password (not regular password)
- **SendGrid**: `smtp.sendgrid.net`, port 587, use API key as password
- **AWS SES**: Use your SES SMTP credentials
- **Mailgun**: Use Mailgun SMTP settings

### 3. Email Templates
**Location:** Supabase Dashboard → Authentication → Email Templates

- [ ] **Magic Link template exists** and is enabled
- [ ] **Template content** - Check if template is properly configured
- [ ] **Subject line** - Should be set
- [ ] **Email body** - Should contain the magic link button/link

### 4. Audit Logs (What You Already Found)
**Location:** Supabase Dashboard → Authentication → Audit Logs

**What you found:**
- ✅ Entry shows `user_recovery_requested` - This means Supabase **received** the request
- ❌ But no email was sent - This means email delivery **failed**

**What to check in Audit Logs:**
- [ ] Look for **additional entries** after `user_recovery_requested`
- [ ] Check if there's an entry showing email was sent (e.g., `email_sent` or similar)
- [ ] Look for any entries with errors or failures
- [ ] Check the `payload` field in the audit log entry - it might contain error details

**Note:** Audit logs may not show email delivery errors directly. If you only see `user_recovery_requested` and nothing else, the email likely failed silently.

### 5. Rate Limits
**Location:** Supabase Dashboard → Settings → Auth → Rate Limits

- [ ] **Rate limit for sending emails** - Check if you've hit the limit
- [ ] Built-in service: 2 emails/hour (FIXED - cannot be changed)
- [ ] Custom SMTP: Can be increased after setup

### 6. Site URL and Redirect URLs
**Location:** Supabase Dashboard → Authentication → URL Configuration

- [ ] **Site URL** - Should be `https://dating-management.vercel.app`
- [ ] **Redirect URLs** - Should include:
  - `https://dating-management.vercel.app/**`
  - `http://localhost:3000/**` (for local dev)

## Common Issues and Solutions

### Issue 1: Built-in Email Service Not Working
**Symptom:** Audit log shows request, but no email sent
**Solution:** 
- Built-in email service may be unreliable or disabled
- **Set up custom SMTP** (recommended for production)

### Issue 2: Custom SMTP Not Configured
**Symptom:** No SMTP settings in dashboard
**Solution:**
- Go to Settings → Auth → SMTP Settings
- Configure a custom SMTP provider
- Test the configuration

### Issue 3: SMTP Credentials Wrong
**Symptom:** Auth logs show SMTP errors
**Solution:**
- Verify SMTP host, port, username, password
- For Gmail: Use App Password (not regular password)
- For SendGrid: Use API key as password

### Issue 4: Email Templates Missing/Disabled
**Symptom:** No email template configured
**Solution:**
- Go to Authentication → Email Templates
- Ensure Magic Link template exists and is enabled
- Check template content

### Issue 5: Email Provider Blocking
**Symptom:** Emails sent but not received
**Solution:**
- Check spam/junk folders
- Check email provider's suppression list
- Verify sender email is not blocked

## Immediate Action Items

### Option 1: Test Email Service Directly (Recommended)

**Use the test email endpoint to verify if Supabase's email service is working:**

1. **Open the test page:**
   - Navigate to: `http://localhost:3000/test-email` (or your web app URL + `/test-email`)
   - Or use the API directly: `POST /api/auth/test-email` with `{ "email": "your-email@example.com" }`

2. **Enter an email address** that exists in your Supabase users table (e.g., `avilior@hotmail.com`)

3. **Click "Send Test Email"**

4. **Check the result:**
   - If it says "Success": Supabase generated the magic link (check your email inbox/spam)
   - If you receive the email: ✅ Email service is working
   - If you don't receive the email: ❌ Email service is NOT working (configuration issue)

### Option 2: Check Audit Logs (you already did this)

1. **Check Audit Logs** (you already did this):
   - ✅ You found `user_recovery_requested` entry
   - ❌ No email was sent
   - **Next:** Check if there are any other entries after the `user_recovery_requested` entry
   - **Check the `payload` field** - it might contain error details

2. **Verify Email Provider is Enabled**:
   - Go to Authentication → Providers
   - Ensure Email provider toggle is ON

3. **Check SMTP Configuration**:
   - Go to Settings → Auth → SMTP Settings
   - If no SMTP configured, set up custom SMTP
   - If SMTP configured, verify credentials are correct

4. **Check Email Templates**:
   - Go to Authentication → Email Templates
   - Ensure Magic Link template exists

5. **Test with Different Email**:
   - Try a completely different email provider (not Hotmail/Gmail)
   - This helps determine if it's provider-specific

## Recommended Solution

**Set up custom SMTP** for reliable email delivery:

1. Choose a provider (SendGrid free tier is good for testing)
2. Get SMTP credentials from the provider
3. Configure in Supabase Dashboard → Settings → Auth → SMTP Settings
4. Test by requesting a magic link
5. Check email inbox (and spam folder)

## Next Steps - Priority Order

**Most Important Checks (do these first):**

1. **Check Email Templates** (Authentication → Email Templates):
   - Does "Magic Link" template exist?
   - Is it enabled?
   - What does the template content look like?

2. **Check SMTP Settings** (Settings → Auth → SMTP Settings):
   - Is custom SMTP configured? (If not, you're using built-in service)
   - If custom SMTP is configured, are the credentials correct?
   - If no SMTP configured, built-in service may not be working

3. **Check Rate Limits** (Settings → Auth → Rate Limits):
   - What is "Rate limit for sending emails" set to?
   - Have you hit the limit? (Built-in: 2 emails/hour)

4. **Check Email Provider** (Authentication → Providers):
   - Is "Email" provider enabled? (toggle should be ON)

**After checking, share:**
- Email template status (exists? enabled?)
- SMTP configuration status (custom SMTP configured? or using built-in?)
- Rate limit status (what's the limit? have you hit it?)
- Email provider status (enabled?)

This will help identify the exact issue.

