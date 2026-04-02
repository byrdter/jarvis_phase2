# Google OAuth Setup for JARVIS Phase 2C

Follow these steps to set up Gmail and Calendar API access.

---

## Step 1: Create Google Cloud Project (2 minutes)

1. Go to: **https://console.cloud.google.com/**

2. Click **"Select a project"** dropdown at the top

3. Click **"NEW PROJECT"**

4. Enter project details:
   - **Project name:** `JARVIS Agent`
   - **Organization:** (leave default or select your org)
   - Click **CREATE**

5. Wait for project creation (~10 seconds)

6. Make sure **"JARVIS Agent"** is selected in the dropdown

---

## Step 2: Enable APIs (2 minutes)

1. In the left sidebar, click **"APIs & Services"** → **"Library"**

2. Search for: **"Gmail API"**
   - Click on **Gmail API**
   - Click **ENABLE**
   - Wait for it to enable (~5 seconds)

3. Click **"← APIs & Services"** to go back

4. Search for: **"Google Calendar API"**
   - Click on **Google Calendar API**
   - Click **ENABLE**
   - Wait for it to enable (~5 seconds)

---

## Step 3: Configure OAuth Consent Screen (3 minutes)

1. In the left sidebar, click **"OAuth consent screen"**

2. Select **External** (unless you have Google Workspace)
   - Click **CREATE**

3. Fill out the consent screen:
   - **App name:** `JARVIS Personal Assistant`
   - **User support email:** (your email)
   - **Developer contact email:** (your email)
   - Click **SAVE AND CONTINUE**

4. **Scopes** page:
   - Click **ADD OR REMOVE SCOPES**
   - Search for and select:
     - `Gmail API` → `.../auth/gmail.readonly`
     - `Gmail API` → `.../auth/gmail.modify`
     - `Google Calendar API` → `.../auth/calendar.readonly`
   - Click **UPDATE**
   - Click **SAVE AND CONTINUE**

5. **Test users** page:
   - Click **+ ADD USERS**
   - Enter your email address
   - Click **ADD**
   - Click **SAVE AND CONTINUE**

6. **Summary** page:
   - Review and click **BACK TO DASHBOARD**

---

## Step 4: Create OAuth Credentials (2 minutes)

1. In the left sidebar, click **"Credentials"**

2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**

3. Configure OAuth client:
   - **Application type:** Desktop app
   - **Name:** `JARVIS Desktop Client`
   - Click **CREATE**

4. **Download credentials:**
   - A popup appears with Client ID and Client Secret
   - Click **DOWNLOAD JSON**
   - Save file as: `client_secret.json`
   - Click **OK**

---

## Step 5: Add to JARVIS .env (1 minute)

1. Open the downloaded `client_secret.json` file

2. Copy the values to `agent-sdk/.env`:

```bash
# Gmail/Calendar (Google OAuth)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
```

**Don't close the browser yet!** Keep the Google Cloud Console open.

---

## Step 6: Generate Refresh Token (I'll provide script)

Once you've completed Steps 1-5 above, let me know and I'll create a script to generate your refresh token.

The script will:
1. Open your browser
2. Ask you to authorize JARVIS
3. Save the refresh token to `.env`

---

## What You'll End Up With

In `agent-sdk/.env`:
```bash
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxx
GOOGLE_REFRESH_TOKEN=1//xxxxxxxxxxxxxx
```

Then we can build the Gmail and Calendar integrations!

---

## Troubleshooting

**"Access blocked: This app's request is invalid"**
- Make sure you added your email to Test Users (Step 3.5)
- Make sure you selected "External" for OAuth consent screen

**"Error 403: access_denied"**
- Enable Gmail API and Calendar API (Step 2)
- Add the correct scopes (Step 3.4)

**Can't find OAuth consent screen**
- Make sure the correct project is selected (top dropdown)

---

**Ready?** Complete Steps 1-5 above, then let me know when you have:
- ✅ Google Cloud Project created
- ✅ Gmail API enabled
- ✅ Calendar API enabled  
- ✅ OAuth consent screen configured
- ✅ OAuth credentials downloaded
- ✅ Client ID and Secret added to `.env`

Then I'll create the refresh token script!
