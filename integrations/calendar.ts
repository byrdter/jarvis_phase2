/**
 * Google Calendar Integration for JARVIS
 *
 * Programmatic access to Google Calendar using Google OAuth
 *
 * Features:
 * - Get today's events
 * - Query events by date range
 * - Search for specific events
 * - Check earnings calendar for stock symbols
 */

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  status: string;
  htmlLink: string;
  attendees?: Array<{ email: string; responseStatus: string }>;
}

interface CalendarSearchOptions {
  startDate?: Date;
  endDate?: Date;
  query?: string;
  maxResults?: number;
  calendarId?: string;
}

export class CalendarIntegration {
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
   * Make an authenticated request to Calendar API
   */
  private async calendarRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
    const token = await this.getAccessToken();

    const url = new URL(`https://www.googleapis.com/calendar/v3/${endpoint}`);
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
      throw new Error(`Calendar API error: ${error}`);
    }

    return await response.json();
  }

  /**
   * Parse event from API response
   */
  private parseEvent(event: any): CalendarEvent {
    const getDateTime = (dateTime: any): Date => {
      if (dateTime.dateTime) {
        return new Date(dateTime.dateTime);
      } else if (dateTime.date) {
        return new Date(dateTime.date);
      }
      return new Date();
    };

    return {
      id: event.id,
      summary: event.summary || '(No title)',
      description: event.description,
      location: event.location,
      start: getDateTime(event.start),
      end: getDateTime(event.end),
      status: event.status,
      htmlLink: event.htmlLink,
      attendees: event.attendees?.map((a: any) => ({
        email: a.email,
        responseStatus: a.responseStatus,
      })),
    };
  }

  /**
   * Get events from calendar
   */
  async getEvents(options: CalendarSearchOptions = {}): Promise<CalendarEvent[]> {
    const {
      startDate = new Date(),
      endDate,
      query,
      maxResults = 10,
      calendarId = 'primary',
    } = options;

    const params: Record<string, string> = {
      timeMin: startDate.toISOString(),
      maxResults: maxResults.toString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    };

    if (endDate) {
      params.timeMax = endDate.toISOString();
    }

    if (query) {
      params.q = query;
    }

    const data = await this.calendarRequest(`calendars/${calendarId}/events`, params);

    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.map((event: any) => this.parseEvent(event));
  }

  /**
   * Get today's events
   */
  async getTodayEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.getEvents({
      startDate: today,
      endDate: tomorrow,
      maxResults: 50,
    });
  }

  /**
   * Get events for a specific date
   */
  async getEventsByDate(date: Date): Promise<CalendarEvent[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await this.getEvents({
      startDate: startOfDay,
      endDate: endOfDay,
      maxResults: 50,
    });
  }

  /**
   * Get upcoming events (next N days)
   */
  async getUpcomingEvents(days: number = 7, maxResults: number = 20): Promise<CalendarEvent[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    return await this.getEvents({
      startDate: now,
      endDate: future,
      maxResults,
    });
  }

  /**
   * Search events by query
   */
  async searchEvents(query: string, maxResults: number = 10): Promise<CalendarEvent[]> {
    return await this.getEvents({
      query,
      maxResults,
    });
  }

  /**
   * Get events in a date range
   */
  async getEventRange(startDate: Date, endDate: Date, maxResults: number = 50): Promise<CalendarEvent[]> {
    return await this.getEvents({
      startDate,
      endDate,
      maxResults,
    });
  }

  /**
   * Check for earnings calendar events for stock symbols
   */
  async getEarningsCalendar(symbols: string[], daysAhead: number = 30): Promise<CalendarEvent[]> {
    const events = await this.getUpcomingEvents(daysAhead, 100);

    // Filter events that mention stock symbols in summary or description
    const symbolsLower = symbols.map(s => s.toLowerCase());

    return events.filter(event => {
      const searchText = `${event.summary} ${event.description || ''}`.toLowerCase();
      return symbolsLower.some(symbol => searchText.includes(symbol));
    });
  }

  /**
   * Get this week's events
   */
  async getThisWeekEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return await this.getEvents({
      startDate: startOfWeek,
      endDate: endOfWeek,
      maxResults: 100,
    });
  }

  /**
   * Get this month's events
   */
  async getThisMonthEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return await this.getEvents({
      startDate: startOfMonth,
      endDate: endOfMonth,
      maxResults: 200,
    });
  }

  /**
   * Check if date has any events
   */
  async hasEventsOnDate(date: Date): Promise<boolean> {
    const events = await this.getEventsByDate(date);
    return events.length > 0;
  }

  /**
   * Get next event
   */
  async getNextEvent(): Promise<CalendarEvent | null> {
    const events = await this.getUpcomingEvents(30, 1);
    return events.length > 0 ? events[0] : null;
  }

  /**
   * List available calendars
   */
  async listCalendars(): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
    const data = await this.calendarRequest('users/me/calendarList');

    return data.items.map((cal: any) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary,
    }));
  }
}

// Export singleton instance
export const calendar = new CalendarIntegration();
