const logger = require('../utils/logger');
const PriceHistory = require('../models/PriceHistory');
const ASIN = require('../models/ASIN');
const analytics = require('../analytics/duckdb');
const slackService = require('./slack');
const PriceAlert = require('../models/PriceAlert');

class PriceDetectionService {
  constructor() {
    this.alertThresholds = {
      priceDropPercent: parseFloat(process.env.DEFAULT_PRICE_DROP_PERCENT) || 10,
      minimumDiscount: parseFloat(process.env.DEFAULT_MINIMUM_DISCOUNT) || 5,
      maxAlertsPerHour: parseInt(process.env.MAX_ALERTS_PER_HOUR) || 5
    };
  }

  async analyzeRecentPriceChanges(customerId, options = {}) {
    try {
      const { hours = 2, limit = 100 } = options;
      
      // Get recently updated ASINs
      const recentASINs = await ASIN.findByCustomer(customerId, { limit });
      const alerts = [];
      const threats = [];

      for (const asin of recentASINs) {
        try {
          const analysis = await this.analyzeASINPriceChanges(asin, hours);
          
          if (analysis.alerts.length > 0) {
            alerts.push(...analysis.alerts);
          }
          
          if (analysis.threat) {
            threats.push(analysis.threat);
          }
        } catch (error) {
          logger.error('Error analyzing ASIN price changes:', { 
            asin: asin.asin, 
            error: error.message 
          });
        }
      }

      // Sort threats by drop probability
      threats.sort((a, b) => b.dropProbability - a.dropProbability);
      
      // Send alerts if any
      if (alerts.length > 0) {
        await this.sendPriceAlerts(alerts, customerId);
      }

      // Send top threats summary
      if (threats.length > 0) {
        await this.sendTopThreats(threats.slice(0, 5), customerId);
      }

      return {
        success: true,
        alertsGenerated: alerts.length,
        threatsIdentified: threats.length,
        topThreats: threats.slice(0, 5)
      };
    } catch (error) {
      logger.error('Error analyzing recent price changes:', error);
      throw error;
    }
  }

  async analyzeASINPriceChanges(asinRecord, hours = 2) {
    try {
      const alerts = [];
      let threat = null;

      // Get recent price history
      const priceHistory = await PriceHistory.findByASIN(asinRecord.id, { 
        limit: 50, 
        days: 7 
      });

      if (priceHistory.length < 2) {
        return { alerts, threat };
      }

      const latest = priceHistory[0];
      const previous = priceHistory[1];
      const priceChange = this.calculatePriceChange(latest, previous);
      
      // Check for significant price drops
      if (this.isSignificantPriceDrop(priceChange)) {
        const alert = await this.createPriceDropAlert(asinRecord, latest, previous, priceChange);
        alerts.push(alert);
      }

      // Check for coupon changes
      if (this.isCouponFlip(latest, previous)) {
        const alert = await this.createCouponAlert(asinRecord, latest, previous);
        alerts.push(alert);
      }

      // Check for stock status changes
      if (this.isBackInStock(latest, previous)) {
        const alert = await this.createStockAlert(asinRecord, latest);
        alerts.push(alert);
      }

      // Generate threat assessment
      threat = await this.generateThreatAssessment(asinRecord, priceHistory);

      return { alerts, threat };
    } catch (error) {
      logger.error('Error analyzing ASIN price changes:', { asin: asinRecord.asin, error });
      throw error;
    }
  }

  calculatePriceChange(latest, previous) {
    const currentPrice = parseFloat(latest.price) || 0;
    const previousPrice = parseFloat(previous.price) || 0;
    
    if (previousPrice === 0) {
      return { amount: 0, percent: 0, isValid: false };
    }

    const amount = currentPrice - previousPrice;
    const percent = (amount / previousPrice) * 100;

    return {
      amount,
      percent,
      isValid: true,
      currentPrice,
      previousPrice
    };
  }

  isSignificantPriceDrop(priceChange) {
    if (!priceChange.isValid) return false;
    
    return priceChange.percent <= -this.alertThresholds.priceDropPercent &&
           Math.abs(priceChange.amount) >= this.alertThresholds.minimumDiscount;
  }

  isCouponFlip(latest, previous) {
    return latest.has_coupon !== previous.has_coupon && latest.has_coupon === true;
  }

  isBackInStock(latest, previous) {
    const wasOutOfStock = previous.availability === 'out of stock' || previous.availability === 'unavailable';
    const isNowInStock = latest.availability === 'in stock';
    return wasOutOfStock && isNowInStock;
  }

  async createPriceDropAlert(asinRecord, latest, previous, priceChange) {
    const alert = {
      asin: asinRecord.asin,
      title: asinRecord.title,
      alertType: 'price_drop',
      currentPrice: priceChange.currentPrice,
      previousPrice: priceChange.previousPrice,
      priceChange: priceChange.amount,
      priceChangePercent: priceChange.percent,
      timestamp: new Date().toISOString(),
      severity: this.calculateAlertSeverity(priceChange.percent)
    };

    // Store in database
    await this.storeAlert(asinRecord.customer_id, asinRecord.id, alert);
    
    return alert;
  }

  async createCouponAlert(asinRecord, latest, previous) {
    const alert = {
      asin: asinRecord.asin,
      title: asinRecord.title,
      alertType: 'coupon_added',
      currentPrice: parseFloat(latest.price) || 0,
      couponAmount: parseFloat(latest.coupon_amount) || 0,
      timestamp: new Date().toISOString(),
      severity: 'medium'
    };

    await this.storeAlert(asinRecord.customer_id, asinRecord.id, alert);
    return alert;
  }

  async createStockAlert(asinRecord, latest) {
    const alert = {
      asin: asinRecord.asin,
      title: asinRecord.title,
      alertType: 'back_in_stock',
      currentPrice: parseFloat(latest.price) || 0,
      availability: latest.availability,
      timestamp: new Date().toISOString(),
      severity: 'low'
    };

    await this.storeAlert(asinRecord.customer_id, asinRecord.id, alert);
    return alert;
  }

  async generateThreatAssessment(asinRecord, priceHistory) {
    try {
      if (!analytics.initialized) {
        return null;
      }

      // Generate ML features
      const features = await analytics.generateMLFeatures(asinRecord.id);
      
      if (!features) {
        return null;
      }

      // Simple rule-based threat assessment (replace with actual ML model)
      const dropProbability = this.calculateDropProbability(features, priceHistory);
      const expectedDrop = this.calculateExpectedDrop(features, priceHistory);
      const confidence = this.calculateConfidence(features);

      const threat = {
        asin: asinRecord.asin,
        title: asinRecord.title,
        currentPrice: parseFloat(priceHistory[0]?.price) || 0,
        dropProbability,
        expectedDrop,
        confidence,
        features: {
          avgPriceChange: features.avg_price_change || 0,
          priceVolatility: features.price_volatility || 0,
          dropCount: features.drop_count || 0,
          couponFlips: features.coupon_flips || 0
        },
        timestamp: new Date().toISOString()
      };

      // Store prediction
      await analytics.storePrediction(asinRecord.id, threat);
      
      return threat;
    } catch (error) {
      logger.error('Error generating threat assessment:', { asin: asinRecord.asin, error });
      return null;
    }
  }

  calculateDropProbability(features, priceHistory) {
    // Simple rule-based calculation (replace with ML model)
    let probability = 0;
    
    // High volatility increases probability
    if (features.price_volatility > 0.1) probability += 0.3;
    
    // Recent drops increase probability
    if (features.drop_count > 3) probability += 0.2;
    
    // Coupon activity increases probability
    if (features.coupon_flips > 0) probability += 0.15;
    
    // Negative price trend increases probability
    if (features.avg_price_change < -5) probability += 0.25;
    
    // Recent price increase might lead to correction
    if (features.max_price_increase > 15) probability += 0.1;
    
    return Math.min(probability, 1.0);
  }

  calculateExpectedDrop(features, priceHistory) {
    // Expected drop percentage based on historical patterns
    const avgDrop = Math.abs(features.avg_price_change || 0);
    const maxDrop = Math.abs(features.max_price_drop || 0);
    
    return Math.min((avgDrop + maxDrop) / 2, 50); // Cap at 50%
  }

  calculateConfidence(features) {
    // Confidence based on data quality
    const dataPoints = features.data_points || 0;
    
    if (dataPoints < 5) return 0.3;
    if (dataPoints < 20) return 0.6;
    if (dataPoints < 50) return 0.8;
    
    return 0.9;
  }

  calculateAlertSeverity(priceChangePercent) {
    const absPercent = Math.abs(priceChangePercent);
    
    if (absPercent >= 30) return 'critical';
    if (absPercent >= 20) return 'high';
    if (absPercent >= 10) return 'medium';
    
    return 'low';
  }

  async storeAlert(customerId, asinId, alert) {
    try {
      // This would use the PriceAlert model (to be implemented)
      logger.info('Price alert generated:', {
        customerId,
        asinId,
        alertType: alert.alertType,
        severity: alert.severity
      });
      
      // TODO: Implement PriceAlert.create()
      // await PriceAlert.create({
      //   customerId,
      //   asinId,
      //   alertType: alert.alertType,
      //   currentPrice: alert.currentPrice,
      //   previousPrice: alert.previousPrice,
      //   priceChange: alert.priceChange,
      //   priceChangePercent: alert.priceChangePercent,
      //   message: JSON.stringify(alert),
      //   channels: ['slack']
      // });
    } catch (error) {
      logger.error('Error storing alert:', error);
    }
  }

  async sendPriceAlerts(alerts, customerId) {
    try {
      // Rate limit alerts per hour
      const recentAlerts = alerts.length; // TODO: Check database for recent alerts
      
      if (recentAlerts > this.alertThresholds.maxAlertsPerHour) {
        logger.warn('Alert rate limit exceeded, throttling alerts', { customerId });
        alerts = alerts.slice(0, this.alertThresholds.maxAlertsPerHour);
      }

      // Send individual alerts for critical ones
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      
      for (const alert of criticalAlerts) {
        try {
          await slackService.sendAlert(alert);
          logger.info('Critical alert sent', { asin: alert.asin, severity: alert.severity });
        } catch (error) {
          logger.error('Error sending critical alert:', { asin: alert.asin, error });
        }
      }

      // Batch non-critical alerts
      const otherAlerts = alerts.filter(a => a.severity !== 'critical');
      if (otherAlerts.length > 0) {
        // TODO: Implement batch alert sending
        logger.info('Batch alerts queued', { count: otherAlerts.length });
      }
    } catch (error) {
      logger.error('Error sending price alerts:', error);
    }
  }

  async sendTopThreats(threats, customerId) {
    try {
      // TODO: Get customer name from database
      const customerName = 'MVP Customer';
      
      await slackService.sendTopThreats(threats, customerName);
      logger.info('Top threats alert sent', { 
        customerId, 
        threatCount: threats.length 
      });
    } catch (error) {
      logger.error('Error sending top threats:', error);
    }
  }

  async runDetectionCycle(customerId) {
    try {
      logger.info('Starting price detection cycle', { customerId });
      
      const results = await this.analyzeRecentPriceChanges(customerId, {
        hours: 2,
        limit: 1000 // MVP limit
      });
      
      logger.info('Price detection cycle completed', {
        customerId,
        alertsGenerated: results.alertsGenerated,
        threatsIdentified: results.threatsIdentified
      });
      
      return results;
    } catch (error) {
      logger.error('Error in price detection cycle:', { customerId, error });
      throw error;
    }
  }
}

// Create singleton instance
const priceDetectionService = new PriceDetectionService();

module.exports = priceDetectionService;