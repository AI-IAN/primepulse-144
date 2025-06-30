const axios = require('axios');
const logger = require('../utils/logger');

class SlackService {
  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.channel = process.env.SLACK_CHANNEL || '#price-alerts';
    this.username = process.env.SLACK_USERNAME || 'PrimePulse Bot';
    this.enabled = process.env.ENABLE_SLACK_ALERTS === 'true';
  }

  async sendAlert(alert) {
    if (!this.enabled) {
      logger.debug('Slack alerts disabled, skipping notification');
      return;
    }

    if (!this.webhookUrl) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    try {
      const message = this.formatAlert(alert);
      const payload = {
        channel: this.channel,
        username: this.username,
        icon_emoji: ':bell:',
        attachments: [message]
      };

      const response = await axios.post(this.webhookUrl, payload);
      logger.info('Slack alert sent successfully', { asin: alert.asin });
      return response.data;
    } catch (error) {
      logger.error('Error sending Slack alert:', {
        error: error.message,
        asin: alert.asin,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      throw error;
    }
  }

  async sendTopThreats(threats, customerName = 'Customer') {
    if (!this.enabled || !threats || threats.length === 0) {
      return;
    }

    try {
      const message = this.formatTopThreats(threats, customerName);
      const payload = {
        channel: this.channel,
        username: this.username,
        icon_emoji: ':warning:',
        ...message
      };

      const response = await axios.post(this.webhookUrl, payload);
      logger.info('Top threats alert sent successfully', { count: threats.length });
      return response.data;
    } catch (error) {
      logger.error('Error sending top threats alert:', error);
      throw error;
    }
  }

  formatAlert(alert) {
    const { asin, title, alertType, currentPrice, previousPrice, priceChange, priceChangePercent, dropProbability } = alert;
    
    let color = 'good';
    let title_text = 'Price Alert';
    
    if (alertType === 'price_drop') {
      color = 'good';
      title_text = '💰 Price Drop Alert';
    } else if (alertType === 'coupon_added') {
      color = 'warning';
      title_text = '🎫 Coupon Added';
    } else if (alertType === 'back_in_stock') {
      color = 'good';
      title_text = '📦 Back in Stock';
    }

    const fields = [
      {
        title: 'ASIN',
        value: `<https://www.amazon.com/dp/${asin}|${asin}>`,
        short: true
      },
      {
        title: 'Current Price',
        value: `$${currentPrice}`,
        short: true
      }
    ];

    if (previousPrice && priceChange) {
      fields.push({
        title: 'Previous Price',
        value: `$${previousPrice}`,
        short: true
      });
      fields.push({
        title: 'Price Change',
        value: `${priceChange >= 0 ? '+' : ''}$${priceChange.toFixed(2)} (${priceChangePercent.toFixed(1)}%)`,
        short: true
      });
    }

    if (dropProbability) {
      fields.push({
        title: 'Drop Probability',
        value: `${(dropProbability * 100).toFixed(1)}%`,
        short: true
      });
    }

    return {
      color,
      title: title_text,
      text: title ? `*${title}*` : `Product: ${asin}`,
      fields,
      footer: 'PrimePulse 144',
      ts: Math.floor(Date.now() / 1000)
    };
  }

  formatTopThreats(threats, customerName) {
    const topThreats = threats.slice(0, 5); // Top 5 threats
    
    let text = `🚨 *Top ${topThreats.length} Price Drop Threats for ${customerName}*\n\n`;
    
    topThreats.forEach((threat, index) => {
      const { asin, title, dropProbability, expectedDrop, currentPrice, confidence } = threat;
      const rank = index + 1;
      
      text += `*${rank}. ${title || asin}*\n`;
      text += `• ASIN: <https://www.amazon.com/dp/${asin}|${asin}>\n`;
      text += `• Current Price: $${currentPrice}\n`;
      text += `• Drop Probability: ${(dropProbability * 100).toFixed(1)}%\n`;
      text += `• Expected Drop: ${expectedDrop.toFixed(1)}%\n`;
      text += `• Confidence: ${(confidence * 100).toFixed(1)}%\n\n`;
    });

    text += `_Generated at ${new Date().toLocaleString()}_`;

    return {
      text,
      mrkdwn: true
    };
  }

  async sendTestAlert() {
    const testAlert = {
      asin: 'B08N5WRWNW',
      title: 'Test Product - Echo Dot (4th Gen)',
      alertType: 'price_drop',
      currentPrice: 39.99,
      previousPrice: 49.99,
      priceChange: -10.00,
      priceChangePercent: -20.0,
      dropProbability: 0.85
    };

    return await this.sendAlert(testAlert);
  }

  async sendSystemAlert(message, level = 'info') {
    if (!this.enabled) {
      return;
    }

    try {
      let color = 'good';
      let emoji = ':information_source:';
      
      if (level === 'error') {
        color = 'danger';
        emoji = ':x:';
      } else if (level === 'warning') {
        color = 'warning';
        emoji = ':warning:';
      }

      const payload = {
        channel: this.channel,
        username: this.username,
        icon_emoji: emoji,
        attachments: [{
          color,
          title: 'PrimePulse System Alert',
          text: message,
          footer: 'PrimePulse 144 System',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      const response = await axios.post(this.webhookUrl, payload);
      logger.info('System alert sent to Slack');
      return response.data;
    } catch (error) {
      logger.error('Error sending system alert to Slack:', error);
      throw error;
    }
  }
}

// Create singleton instance
const slackService = new SlackService();

module.exports = slackService;