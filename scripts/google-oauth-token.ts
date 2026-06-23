#!/usr/bin/env bun
/**
 * Google OAuth Token Generator for JARVIS
 *
 * Generates a refresh token for Gmail and Calendar API access.
 * Run this ONCE after setting up Google Cloud OAuth credentials.
 *
 * Usage:
 *   bun run scripts/google-oauth-token.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send', // send the daily digest
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

const REDIRECT_URI = 'http://localhost:8888/oauth2callback';

async function main() {
  console.log('='.repeat(70));
  console.log('Google OAuth Token Generator for JARVIS');
  console.log('='.repeat(70));
  console.log('');

  // Load environment
  const envPath = join(__dirname, '../.env');
  const envContent = readFileSync(envPath, 'utf-8');

  // Parse client ID and secret
  const clientIdMatch = envContent.match(/GOOGLE_CLIENT_ID=(.+)/);
  const clientSecretMatch = envContent.match(/GOOGLE_CLIENT_SECRET=(.+)/);

  if (!clientIdMatch || !clientSecretMatch) {
    console.error('❌ Error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not found in .env');
    console.error('');
    console.error('Please add these to agent-sdk/.env:');
    console.error('  GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com');
    console.error('  GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx');
    console.error('');
    console.error('See: GOOGLE-OAUTH-SETUP.md for instructions');
    process.exit(1);
  }

  const clientId = clientIdMatch[1].trim();
  const clientSecret = clientSecretMatch[1].trim();

  console.log('✅ Found OAuth credentials in .env');
  console.log(`   Client ID: ${clientId.substring(0, 20)}...`);
  console.log('');

  // Generate authorization URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('📝 Opening browser for authorization...');
  console.log('');
  console.log('If browser doesn\'t open, visit this URL:');
  console.log(authUrl.toString());
  console.log('');

  // Open browser
  const openCommand = process.platform === 'darwin' ? 'open' :
                      process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(openCommand, [authUrl.toString()]);

  // Start local server to receive callback
  console.log('⏳ Waiting for authorization... (listening on http://localhost:8888)');
  console.log('');

  const server = Bun.serve({
    port: 8888,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/oauth2callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          return new Response(`
            <html>
              <body>
                <h1>❌ Authorization Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });
        }

        if (!code) {
          return new Response('No authorization code received', { status: 400 });
        }

        try {
          // Exchange code for tokens
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: REDIRECT_URI,
              grant_type: 'authorization_code'
            })
          });

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`Token exchange failed: ${errorText}`);
          }

          const tokens = await tokenResponse.json();

          // Save refresh token to .env
          let updatedEnv = envContent;

          // Remove existing GOOGLE_REFRESH_TOKEN if present
          updatedEnv = updatedEnv.replace(/GOOGLE_REFRESH_TOKEN=.+\n/g, '');

          // Add new refresh token (after GOOGLE_CLIENT_SECRET)
          updatedEnv = updatedEnv.replace(
            /GOOGLE_CLIENT_SECRET=.+/,
            `$&\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
          );

          writeFileSync(envPath, updatedEnv);

          console.log('');
          console.log('✅ Authorization successful!');
          console.log('');
          console.log('Refresh token saved to .env');
          console.log('');
          console.log('You can now use Gmail and Calendar integrations!');
          console.log('');

          // Close server after 2 seconds
          setTimeout(() => {
            server.stop();
            process.exit(0);
          }, 2000);

          return new Response(`
            <html>
              <body>
                <h1>✅ Authorization Successful!</h1>
                <p>Refresh token has been saved to .env</p>
                <p>You can close this window and return to the terminal.</p>
                <script>setTimeout(() => window.close(), 3000)</script>
              </body>
            </html>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });

        } catch (error: any) {
          console.error('');
          console.error('❌ Error exchanging code for tokens:', error.message);
          console.error('');

          server.stop();
          process.exit(1);
        }
      }

      return new Response('Not found', { status: 404 });
    }
  });

  console.log(`✅ Server running at http://localhost:8888`);
  console.log('');
  console.log('Complete the authorization in your browser...');
  console.log('');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
