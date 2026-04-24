# Discord alerts setup

## 1. Create Discord webhooks

Create up to four Discord webhooks, one for each topic below:

- `DISCORD_WEBHOOK_SIGNUP`: new user signups
- `DISCORD_WEBHOOK_BILLING`: Stripe and subscription lifecycle events
- `DISCORD_WEBHOOK_ERRORS`: backend and worker failures
- `DISCORD_WEBHOOK_SECURITY`: reserved for auth/security alerts

If you want to start simple, configure only `DISCORD_WEBHOOK_ERRORS` and `DISCORD_WEBHOOK_BILLING`.

## 2. Add env vars

Add these variables to your backend environment:

```bash
DISCORD_ALERTS_ENABLED=true
DISCORD_ALERTS_ENABLED_IN=production
DISCORD_ALERTS_DEFAULT_USERNAME="BentiFiles Ops"
DISCORD_ALERTS_TIMEOUT_MS=5000

DISCORD_WEBHOOK_SIGNUP="https://discord.com/api/webhooks/..."
DISCORD_WEBHOOK_BILLING="https://discord.com/api/webhooks/..."
DISCORD_WEBHOOK_ERRORS="https://discord.com/api/webhooks/..."
DISCORD_WEBHOOK_SECURITY="https://discord.com/api/webhooks/..."
```

## 3. Install backend dependency

From `backend/`:

```bash
npm install
```

`discord-ops-alert` is already added to `backend/package.json`.

## 4. What now sends alerts

- New signup with email/password
- First Google signup
- Stripe checkout completed
- Stripe subscription updated
- Stripe payment confirmed
- Stripe payment failed
- Stripe subscription canceled/deleted
- Unhandled Express errors
- Unhandled promise rejections / uncaught exceptions
- Fatal worker crashes
