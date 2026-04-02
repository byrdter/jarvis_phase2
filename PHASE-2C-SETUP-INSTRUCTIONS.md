# Phase 2C Setup Instructions

**Goal:** Get Gmail and Calendar integrations working

---

## Quick Steps

### 1. Set Up Google Cloud (10 minutes)

📖 **Follow:** `GOOGLE-OAUTH-SETUP.md` (complete guide)

**Summary:**
1. Create Google Cloud project "JARVIS Agent"
2. Enable Gmail API + Calendar API
3. Configure OAuth consent screen
4. Create OAuth credentials (Desktop app)
5. Download `client_secret.json`
6. Add Client ID and Secret to `.env`

### 2. Generate Refresh Token (1 minute)

Once you've added `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`:

```bash
cd agent-sdk
bun run google:auth
```

This will:
- Open your browser
- Ask you to authorize JARVIS
- Save refresh token to `.env`
- Done!

### 3. Test (I'll build this after Step 2)

Once you have the refresh token, I'll build:
- Gmail integration
- Calendar integration  
- Test scripts

Then you can run:
```bash
bun run test:gmail
bun run test:calendar
```

---

## What You Need to Complete

**Right now:**
1. Open `GOOGLE-OAUTH-SETUP.md`
2. Follow Steps 1-5
3. Add Client ID and Secret to `agent-sdk/.env`
4. Run `bun run google:auth`

**Then tell me:**
"OAuth setup complete, refresh token saved"

**Then I'll build:**
- `integrations/gmail.ts`
- `integrations/calendar.ts`
- Test scripts

---

## Your .env Should Look Like This (After Step 1)

```bash
# =============================================================================
# API Authentication
# =============================================================================
ANTHROPIC_API_KEY=

# Gmail/Calendar (Google OAuth)
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
# GOOGLE_REFRESH_TOKEN will be added automatically by google:auth script

# ... rest of .env ...
```

---

## After Step 2 (google:auth), You'll Have This

```bash
# Gmail/Calendar (Google OAuth)
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GOOGLE_REFRESH_TOKEN=1//xxxxxxxxxxxxx
```

---

## Troubleshooting

**"GOOGLE_CLIENT_ID not found in .env"**
→ Make sure you completed Step 5 in GOOGLE-OAUTH-SETUP.md

**"Access blocked: This app's request is invalid"**
→ Add your email to Test Users in OAuth consent screen

**Browser doesn't open**
→ Copy the URL from terminal and paste in browser manually

**"Error exchanging code for tokens"**
→ Make sure Client ID and Secret are correct in .env

---

**Ready?** 

1. Open `GOOGLE-OAUTH-SETUP.md`
2. Complete Steps 1-5
3. Run `bun run google:auth`
4. Let me know when done!
