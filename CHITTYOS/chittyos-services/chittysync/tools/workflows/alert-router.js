/**
 * ChittySync Alert Router
 *
 * Unified alerting across Google Chat, Email, Slack, and SMS.
 * Routes alerts based on severity and configured channels.
 *
 * @module alert-router
 */

/**
 * Alert severity levels
 */
const SEVERITY_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

/**
 * Alert Router Durable Object
 */
export class AlertRouter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.alertState = {
      sentAlerts: [],
      throttles: new Map()
    };
  }

  /**
   * Send alert to configured channels
   * @param {Object} alert - Alert configuration
   * @returns {Promise<Object>} Alert results
   */
  async alert(alert) {
    const {
      severity = SEVERITY_LEVELS.INFO,
      message,
      channels = ['all'],
      metadata = {}
    } = alert;

    // Throttle duplicate alerts (5 minute window)
    const throttleKey = `${severity}:${message.substring(0, 50)}`;
    if (this.isThrottled(throttleKey)) {
      return {
        throttled: true,
        message: 'Alert throttled (duplicate within 5 minutes)'
      };
    }

    const startTime = Date.now();
    const promises = [];

    // Determine channels based on severity
    const targetChannels = this.getChannelsForSeverity(severity, channels);

    // Send to each channel
    if (targetChannels.includes('chat')) {
      promises.push(this.sendGoogleChat({ severity, message, metadata }));
    }

    if (targetChannels.includes('email')) {
      promises.push(this.sendEmail({ severity, message, metadata }));
    }

    if (targetChannels.includes('slack')) {
      promises.push(this.sendSlack({ severity, message, metadata }));
    }

    if (targetChannels.includes('sms')) {
      promises.push(this.sendSMS({ severity, message, metadata }));
    }

    const results = await Promise.allSettled(promises);

    // Update throttle
    this.throttle(throttleKey);

    // Log alert
    this.alertState.sentAlerts.push({
      severity,
      message: message.substring(0, 100),
      channels: targetChannels,
      timestamp: Date.now(),
      success: results.filter(r => r.status === 'fulfilled').length
    });

    return {
      severity,
      channels: targetChannels,
      duration: Date.now() - startTime,
      results: results.map((r, i) => ({
        channel: targetChannels[i],
        status: r.status,
        error: r.status === 'rejected' ? r.reason.message : null
      }))
    };
  }

  /**
   * Get channels for severity level
   * @param {string} severity - Severity level
   * @param {string[]} requestedChannels - Requested channels
   * @returns {string[]} Target channels
   */
  getChannelsForSeverity(severity, requestedChannels) {
    // If 'all' specified, use default channels for severity
    if (requestedChannels.includes('all')) {
      switch (severity) {
        case SEVERITY_LEVELS.CRITICAL:
          return ['chat', 'email', 'sms'];
        case SEVERITY_LEVELS.WARNING:
          return ['chat', 'email'];
        case SEVERITY_LEVELS.INFO:
        default:
          return ['chat'];
      }
    }

    return requestedChannels;
  }

  /**
   * Check if alert is throttled
   * @param {string} key - Throttle key
   * @returns {boolean} Is throttled
   */
  isThrottled(key) {
    const lastSent = this.alertState.throttles.get(key);
    if (!lastSent) return false;

    const elapsed = Date.now() - lastSent;
    return elapsed < 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Set throttle for alert
   * @param {string} key - Throttle key
   */
  throttle(key) {
    this.alertState.throttles.set(key, Date.now());

    // Clean up old throttles (older than 10 minutes)
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [k, timestamp] of this.alertState.throttles.entries()) {
      if (timestamp < cutoff) {
        this.alertState.throttles.delete(k);
      }
    }
  }

  /**
   * Send alert to Google Chat
   * @param {Object} alert - Alert data
   * @returns {Promise<Object>} Result
   */
  async sendGoogleChat(alert) {
    const webhook = this.env.GOOGLE_CHAT_WEBHOOK;
    if (!webhook) {
      throw new Error('GOOGLE_CHAT_WEBHOOK not configured');
    }

    const emoji = this.getEmojiForSeverity(alert.severity);
    const color = this.getColorForSeverity(alert.severity);

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${emoji} *${alert.severity.toUpperCase()}*\n\n${alert.message}`,
        cards: [{
          header: {
            title: `ChittySync Alert - ${alert.severity.toUpperCase()}`,
            subtitle: new Date().toISOString()
          },
          sections: [{
            widgets: [{
              textParagraph: {
                text: alert.message
              }
            }]
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Google Chat webhook failed: ${response.status}`);
    }

    return { channel: 'chat', success: true };
  }

  /**
   * Send alert via email
   * @param {Object} alert - Alert data
   * @returns {Promise<Object>} Result
   */
  async sendEmail(alert) {
    // TODO: Implement email sending (via SendGrid, Mailgun, etc.)
    // For now, return mock success
    return { channel: 'email', success: true };
  }

  /**
   * Send alert to Slack
   * @param {Object} alert - Alert data
   * @returns {Promise<Object>} Result
   */
  async sendSlack(alert) {
    const webhook = this.env.SLACK_WEBHOOK;
    if (!webhook) {
      throw new Error('SLACK_WEBHOOK not configured');
    }

    const emoji = this.getEmojiForSeverity(alert.severity);
    const color = this.getColorForSeverity(alert.severity);

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${emoji} *${alert.severity.toUpperCase()}*`,
        attachments: [{
          color,
          text: alert.message,
          footer: 'ChittySync Alert Router',
          ts: Math.floor(Date.now() / 1000)
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status}`);
    }

    return { channel: 'slack', success: true };
  }

  /**
   * Send SMS alert
   * @param {Object} alert - Alert data
   * @returns {Promise<Object>} Result
   */
  async sendSMS(alert) {
    // TODO: Implement SMS (via Twilio, etc.)
    // For now, return mock success
    return { channel: 'sms', success: true };
  }

  /**
   * Get emoji for severity level
   * @param {string} severity - Severity level
   * @returns {string} Emoji
   */
  getEmojiForSeverity(severity) {
    switch (severity) {
      case SEVERITY_LEVELS.CRITICAL:
        return '🚨';
      case SEVERITY_LEVELS.WARNING:
        return '⚠️';
      case SEVERITY_LEVELS.INFO:
      default:
        return 'ℹ️';
    }
  }

  /**
   * Get color for severity level
   * @param {string} severity - Severity level
   * @returns {string} Color (hex)
   */
  getColorForSeverity(severity) {
    switch (severity) {
      case SEVERITY_LEVELS.CRITICAL:
        return '#ff0000';
      case SEVERITY_LEVELS.WARNING:
        return '#ff9900';
      case SEVERITY_LEVELS.INFO:
      default:
        return '#00aaff';
    }
  }

  /**
   * Get alert history
   * @param {Object} filters - Filter options
   * @returns {Array} Recent alerts
   */
  getHistory(filters = {}) {
    const { limit = 50, severity = null } = filters;

    let alerts = this.alertState.sentAlerts;

    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    return alerts.slice(-limit);
  }

  /**
   * Handle HTTP fetch
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // POST /send - Send alert
    if (path === '/send' && request.method === 'POST') {
      const body = await request.json();
      const result = await this.alert(body);
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /history - Get alert history
    if (path === '/history' && request.method === 'GET') {
      const severity = url.searchParams.get('severity');
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const history = this.getHistory({ severity, limit });
      return new Response(JSON.stringify({ success: true, data: history }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}

/**
 * Worker entry point
 */
export default {
  async fetch(request, env, ctx) {
    // Get Durable Object instance
    const id = env.ALERT_ROUTER.idFromName('global');
    const stub = env.ALERT_ROUTER.get(id);
    return stub.fetch(request);
  }
};
