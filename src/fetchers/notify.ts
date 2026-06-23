/**
 * Delivery layer for the AI-futures pipeline.
 *
 * Prefers Gmail (the JARVIS-connected inbox) when Google OAuth is configured;
 * falls back to Telegram (already configured) otherwise. This lets the daily
 * digest run TODAY via Telegram and auto-upgrade to email the moment
 * `bun run google:auth` populates GOOGLE_* in .env.
 */

export type DeliveryChannel = 'gmail' | 'telegram' | 'none';

export function chosenChannel(): DeliveryChannel {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
    return 'gmail';
  }
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) return 'telegram';
  return 'none';
}

async function sendTelegram(text: string): Promise<{ ok: boolean; detail: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chat = process.env.TELEGRAM_CHAT_ID!;
  // Telegram caps messages at 4096 chars; chunk if needed.
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, 3900));
    remaining = remaining.slice(3900);
  }
  let lastId = '';
  for (const chunk of chunks) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: chunk, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
    const j = await r.json();
    if (!j.ok) return { ok: false, detail: JSON.stringify(j).slice(0, 300) };
    lastId = String(j.result?.message_id ?? '');
  }
  return { ok: true, detail: `telegram msg ${lastId}` };
}

async function sendGmail(subject: string, html: string): Promise<{ ok: boolean; detail: string }> {
  const { gmail } = await import('../../integrations/gmail.ts');
  const r = await gmail.sendMessage({ subject, html });
  return { ok: true, detail: `gmail ${r.id} -> ${r.to}` };
}

/**
 * Deliver a notification. Provide both html (for email) and text (for Telegram/
 * markdown). Returns which channel was used.
 */
export async function deliver(opts: { subject: string; html: string; text: string }): Promise<{ channel: DeliveryChannel; ok: boolean; detail: string }> {
  const channel = chosenChannel();
  try {
    if (channel === 'gmail') return { channel, ...(await sendGmail(opts.subject, opts.html)) };
    if (channel === 'telegram') return { channel, ...(await sendTelegram(`*${opts.subject}*\n\n${opts.text}`)) };
    return { channel: 'none', ok: false, detail: 'No delivery channel configured (set GOOGLE_* or TELEGRAM_*).' };
  } catch (e: any) {
    return { channel, ok: false, detail: String(e?.message || e).slice(0, 300) };
  }
}
