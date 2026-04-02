/**
 * Gmail Integration for JARVIS
 *
 * Programmatic access to Gmail using Google OAuth
 *
 * Features:
 * - Read emails
 * - Search emails
 * - Get unread count
 * - Check for specific senders (brokers, alerts)
 */

interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  snippet: string;
  body?: string;
  labels: string[];
}

interface GmailSearchOptions {
  query: string;
  maxResults?: number;
  includeBody?: boolean;
}

export class GmailIntegration {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';

    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error(
        'Missing Google OAuth credentials. Please run: bun run google:auth'
      );
    }
  }

  /**
   * Get a valid access token (refresh if needed)
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Refresh the access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh access token: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer

    return this.accessToken;
  }

  /**
   * Make an authenticated request to Gmail API
   */
  private async gmailRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
    const token = await this.getAccessToken();

    const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gmail API error: ${error}`);
    }

    return await response.json();
  }

  /**
   * Get unread email count
   */
  async getUnreadCount(): Promise<number> {
    const data = await this.gmailRequest('messages', {
      q: 'is:unread',
      maxResults: '1',
    });

    return data.resultSizeEstimate || 0;
  }

  /**
   * Search emails by query
   */
  async searchEmails(options: GmailSearchOptions): Promise<GmailMessage[]> {
    const {
      query,
      maxResults = 10,
      includeBody = false,
    } = options;

    // Get list of message IDs
    const listData = await this.gmailRequest('messages', {
      q: query,
      maxResults: maxResults.toString(),
    });

    if (!listData.messages || listData.messages.length === 0) {
      return [];
    }

    // Fetch full message details
    const messages: GmailMessage[] = [];

    for (const msg of listData.messages) {
      const message = await this.getMessage(msg.id, includeBody);
      if (message) {
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string, includeBody: boolean = false): Promise<GmailMessage | null> {
    try {
      const format = includeBody ? 'full' : 'metadata';
      const data = await this.gmailRequest(`messages/${messageId}`, { format });

      // Parse headers
      const headers = data.payload.headers;
      const getHeader = (name: string) => {
        const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
        return header ? header.value : '';
      };

      // Parse body (if requested)
      let body = '';
      if (includeBody && data.payload.parts) {
        const textPart = data.payload.parts.find((p: any) => p.mimeType === 'text/plain');
        if (textPart && textPart.body.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      } else if (includeBody && data.payload.body.data) {
        body = Buffer.from(data.payload.body.data, 'base64').toString('utf-8');
      }

      return {
        id: data.id,
        threadId: data.threadId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To'),
        date: new Date(parseInt(data.internalDate)),
        snippet: data.snippet,
        body: includeBody ? body : undefined,
        labels: data.labelIds || [],
      };
    } catch (error) {
      console.error(`Failed to get message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Check for emails from specific senders in last N hours
   */
  async checkBrokerageAlerts(hoursAgo: number = 24): Promise<GmailMessage[]> {
    // Common brokerage email domains
    const brokerDomains = [
      'alpaca.markets',
      'etrade.com',
      'schwab.com',
      'fidelity.com',
      'interactivebrokers.com',
      'robinhood.com',
      'tdameritrade.com',
      'webull.com',
    ];

    // Calculate timestamp for N hours ago
    const timestamp = Math.floor(Date.now() / 1000) - (hoursAgo * 3600);

    // Build query for emails from brokers after timestamp
    const domainQueries = brokerDomains.map(domain => `from:${domain}`).join(' OR ');
    const query = `(${domainQueries}) after:${timestamp}`;

    return await this.searchEmails({
      query,
      maxResults: 20,
      includeBody: false,
    });
  }

  /**
   * Get recent emails (last N hours)
   */
  async getRecentEmails(hoursAgo: number = 24, maxResults: number = 10): Promise<GmailMessage[]> {
    const timestamp = Math.floor(Date.now() / 1000) - (hoursAgo * 3600);
    const query = `after:${timestamp}`;

    return await this.searchEmails({
      query,
      maxResults,
      includeBody: false,
    });
  }

  /**
   * Search emails from specific sender
   */
  async getEmailsFromSender(sender: string, maxResults: number = 10): Promise<GmailMessage[]> {
    return await this.searchEmails({
      query: `from:${sender}`,
      maxResults,
      includeBody: false,
    });
  }

  /**
   * Search emails by subject
   */
  async searchBySubject(subject: string, maxResults: number = 10): Promise<GmailMessage[]> {
    return await this.searchEmails({
      query: `subject:${subject}`,
      maxResults,
      includeBody: false,
    });
  }

  /**
   * Get unread emails
   */
  async getUnreadEmails(maxResults: number = 10): Promise<GmailMessage[]> {
    return await this.searchEmails({
      query: 'is:unread',
      maxResults,
      includeBody: false,
    });
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    const token = await this.getAccessToken();

    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD'],
      }),
    });
  }

  /**
   * Get profile info
   */
  async getProfile(): Promise<{ emailAddress: string; messagesTotal: number; threadsTotal: number }> {
    const data = await this.gmailRequest('profile');

    return {
      emailAddress: data.emailAddress,
      messagesTotal: data.messagesTotal,
      threadsTotal: data.threadsTotal,
    };
  }
}

// Export singleton instance
export const gmail = new GmailIntegration();
