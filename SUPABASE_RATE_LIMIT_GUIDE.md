# Supabase Rate Limit Configuration Guide

## Problem
You're experiencing "request rate limit reached" errors even when you haven't tried to login in the past hour. This suggests either:
1. Multiple requests are being made (bug fixed in code)
2. Rate limits are too restrictive for testing

## Understanding Supabase Rate Limits

### Critical: Email Sending Limit (The Main Issue)

**Rate limit for sending emails**: **2 emails/hour** (FIXED - Cannot be changed)

- This is the **most restrictive limit** and applies to magic link emails
- **Built-in SMTP has a fixed rate limit of 2 emails/hour** that cannot be increased
- To increase this limit, you **must set up a custom SMTP provider** (Gmail, SendGrid, AWS SES, etc.)
- This is why you're hitting rate limits even with minimal usage

### Other Rate Limits (Can be adjusted)

1. **Rate limit for token verifications**: 30 requests/5 min (360/hour) - Per IP address
   - Controls how many OTP/Magic link verifications can be made
   - This is usually not the bottleneck

2. **Rate limit for sign-ups and sign-ins**: 30 requests/5 min (360/hour) - Per IP address
   - Controls how many sign-in/sign-up requests can be made
   - This is usually not the bottleneck

## How to Increase Email Rate Limits

### Option 1: Set Up Custom SMTP (Required to Increase Email Limit)

The built-in email service has a **fixed rate limit of 2 emails/hour** that cannot be changed. To increase it:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Auth** → **SMTP Settings**
4. Configure a custom SMTP provider:
   - **Gmail** (free, but requires app password)
   - **SendGrid** (free tier: 100 emails/day)
   - **AWS SES** (very affordable, high limits)
   - **Mailgun** (free tier: 5,000 emails/month)
   - **Postmark** (paid, but reliable)
5. After setting up custom SMTP, you can increase the email rate limit in **Settings** → **Auth** → **Rate Limits**

### Option 2: Adjust Other Rate Limits (For Token Verifications)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Auth** → **Rate Limits**
4. Adjust:
   - **Rate limit for token verifications**: Increase from 30/5min if needed
   - **Rate limit for sign-ups and sign-ins**: Increase from 30/5min if needed
5. Click **Save changes**

**Note**: These limits are per IP address, so they're usually not the issue for magic links.

## Code Fixes Applied

1. **Removed unnecessary check-user API call** - This was making an extra request before sign-in, which could contribute to rate limits
2. **Added double-submit prevention** - Prevents the form from being submitted multiple times accidentally
3. **Better error handling** - Shows clearer messages when rate limits are hit

## Testing Recommendations

For development/testing:
- Use the **dev sign-in button** to bypass magic links entirely
- The dev sign-in doesn't count toward rate limits
- Only use magic links when testing the actual email flow

## Current Rate Limit Defaults

Supabase's default rate limits:

### Built-in SMTP (Cannot be changed):
- **Email sending**: **2 emails/hour** (FIXED - This is your bottleneck!)

### Per IP Address (Can be adjusted):
- **Token verifications**: 30 requests/5 min (360/hour)
- **Sign-ups and sign-ins**: 30 requests/5 min (360/hour)
- **Token refreshes**: 150 requests/5 min (1800/hour)
- **Anonymous users**: 30 requests/hour

## Solutions for Testing

### Immediate Solution: Use Dev Sign-In
- The **dev sign-in button** bypasses magic links entirely
- No rate limits apply to dev sign-in
- Perfect for development and testing

### Long-term Solution: Set Up Custom SMTP
1. Choose an SMTP provider (SendGrid free tier is good for testing)
2. Configure it in Supabase Dashboard → Settings → Auth → SMTP Settings
3. After setup, you can increase email rate limits significantly
4. Example: SendGrid free tier allows 100 emails/day

### Why You're Hitting Limits
- **2 emails/hour** is very restrictive
- If you test with the same email multiple times, you'll hit the limit quickly
- Even testing once per hour can be limiting during development

## Verification

After setting up custom SMTP:
1. Wait a few minutes for changes to propagate
2. Go to **Settings** → **Auth** → **Rate Limits**
3. You should now be able to increase "Rate limit for sending emails"
4. Try signing in with magic link
5. If still hitting limits, check:
   - Are you testing with multiple email addresses?
   - Is there any automated testing running?
   - Are there any browser extensions or tools making requests?

