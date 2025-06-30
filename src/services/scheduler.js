const cron = require('node-cron');
const logger = require('../utils/logger');
const scraperService = require('./scraper');
const priceDetectionService = require('./priceDetection');
const Customer = require('../models/Customer');
const analytics = require('../analytics/duckdb');
const slackService = require('./slack');

class SchedulerService {
  constructor() {
    this.isRunning = false;
    this.jobs = new Map();
    this.crawlInterval = parseInt(process.env.CRAWL_INTERVAL_MINUTES) || 120;
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    try {
      // Initialize analytics
      if (!analytics.initialized) {
        await analytics.initialize();
      }

      // Schedule main crawling job every 2 hours
      const crawlCronExpression = `0 */${Math.floor(this.crawlInterval / 60)} * * *`;
      this.scheduleJob('main-crawl', crawlCronExpression, this.runMainCrawlCycle.bind(this));

      // Schedule price detection every 30 minutes
      this.scheduleJob('price-detection', '*/30 * * * *', this.runPriceDetectionCycle.bind(this));

      // Schedule daily cleanup at 2 AM
      this.scheduleJob('daily-cleanup', '0 2 * * *', this.runDailyCleanup.bind(this));

      // Schedule weekly analytics report on Sundays at 9 AM
      this.scheduleJob('weekly-report', '0 9 * * 0', this.runWeeklyReport.bind(this));

      this.isRunning = true;
      logger.info('Scheduler started successfully', {
        crawlInterval: this.crawlInterval,
        jobCount: this.jobs.size
      });

      // Send startup notification
      await slackService.sendSystemAlert('PrimePulse 144 scheduler started successfully', 'info');
    } catch (error) {
      logger.error('Error starting scheduler:', error);
      await slackService.sendSystemAlert(`Scheduler startup failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop all scheduled jobs
      for (const [name, task] of this.jobs) {
        task.stop();
        logger.info('Stopped scheduled job:', name);
      }

      this.jobs.clear();
      this.isRunning = false;

      logger.info('Scheduler stopped successfully');
      await slackService.sendSystemAlert('PrimePulse 144 scheduler stopped', 'info');
    } catch (error) {
      logger.error('Error stopping scheduler:', error);
    }
  }

  scheduleJob(name, cronExpression, handler) {
    try {
      const task = cron.schedule(cronExpression, async () => {
        logger.info(`Starting scheduled job: ${name}`);
        const startTime = Date.now();
        
        try {
          await handler();
          const duration = Date.now() - startTime;
          logger.info(`Completed scheduled job: ${name}`, { duration });
        } catch (error) {
          logger.error(`Error in scheduled job ${name}:`, error);
          await slackService.sendSystemAlert(
            `Scheduled job failed: ${name} - ${error.message}`,
            'error'
          );
        }
      }, {
        scheduled: false
      });

      this.jobs.set(name, task);
      task.start();
      
      logger.info('Scheduled job registered:', { name, cronExpression });
    } catch (error) {
      logger.error('Error scheduling job:', { name, error });
      throw error;
    }
  }

  async runMainCrawlCycle() {
    try {
      logger.info('Starting main crawl cycle');
      
      // Get all active customers
      const customers = await Customer.getAll();
      
      if (customers.length === 0) {
        logger.warn('No active customers found for crawling');
        return;
      }

      const results = {
        totalCustomers: customers.length,
        successful: 0,
        failed: 0,
        totalASINs: 0,
        successfulScrapes: 0
      };

      for (const customer of customers) {
        try {
          logger.info('Starting crawl for customer:', customer.name);
          
          const crawlResult = await scraperService.scrapeCustomerASINs(customer.id, {
            limit: 1000 // MVP limit
          });
          
          if (crawlResult.success) {
            results.successful++;
            results.totalASINs += crawlResult.total;
            results.successfulScrapes += crawlResult.successful;
            
            logger.info('Customer crawl completed:', {
              customer: customer.name,
              total: crawlResult.total,
              successful: crawlResult.successful,
              failed: crawlResult.failed
            });
          } else {
            results.failed++;
            logger.error('Customer crawl failed:', {
              customer: customer.name,
              error: crawlResult.error
            });
          }
        } catch (error) {
          results.failed++;
          logger.error('Error crawling customer ASINs:', {
            customer: customer.name,
            error: error.message
          });
        }
      }

      logger.info('Main crawl cycle completed:', results);
      
      // Send summary notification for significant issues
      if (results.failed > 0 || results.successfulScrapes < results.totalASINs * 0.8) {
        await slackService.sendSystemAlert(
          `Crawl cycle completed with issues: ${results.successful}/${results.totalCustomers} customers successful, ${results.successfulScrapes}/${results.totalASINs} ASINs scraped`,
          'warning'
        );
      }
    } catch (error) {
      logger.error('Error in main crawl cycle:', error);
      throw error;
    }
  }

  async runPriceDetectionCycle() {
    try {
      logger.info('Starting price detection cycle');
      
      const customers = await Customer.getAll();
      
      if (customers.length === 0) {
        logger.warn('No active customers found for price detection');
        return;
      }

      let totalAlerts = 0;
      let totalThreats = 0;

      for (const customer of customers) {
        try {
          const detectionResult = await priceDetectionService.runDetectionCycle(customer.id);
          
          totalAlerts += detectionResult.alertsGenerated;
          totalThreats += detectionResult.threatsIdentified;
          
          logger.debug('Price detection completed for customer:', {
            customer: customer.name,
            alerts: detectionResult.alertsGenerated,
            threats: detectionResult.threatsIdentified
          });
        } catch (error) {
          logger.error('Error in price detection for customer:', {
            customer: customer.name,
            error: error.message
          });
        }
      }

      logger.info('Price detection cycle completed:', {
        customers: customers.length,
        totalAlerts,
        totalThreats
      });
    } catch (error) {
      logger.error('Error in price detection cycle:', error);
      throw error;
    }
  }

  async runDailyCleanup() {
    try {
      logger.info('Starting daily cleanup');
      
      // Clean up old price history (keep 90 days)
      const cleanupResult = await require('../models/PriceHistory').cleanup(90);
      
      // Clean up old logs
      const logCleanupResult = await this.cleanupOldLogs();
      
      logger.info('Daily cleanup completed:', {
        priceHistoryRecordsRemoved: cleanupResult,
        logFilesProcessed: logCleanupResult
      });
      
      await slackService.sendSystemAlert(
        `Daily cleanup completed: ${cleanupResult} old price records removed`,
        'info'
      );
    } catch (error) {
      logger.error('Error in daily cleanup:', error);
      throw error;
    }
  }

  async runWeeklyReport() {
    try {
      logger.info('Generating weekly analytics report');
      
      if (!analytics.initialized) {
        logger.warn('Analytics not initialized, skipping weekly report');
        return;
      }

      // Get top predictions from the past week
      const topPredictions = await analytics.getTopPredictions(20);
      
      if (topPredictions.length === 0) {
        logger.info('No predictions to report');
        return;
      }

      // Format weekly report
      let reportText = '📊 *Weekly PrimePulse Analytics Report*\n\n';
      reportText += `📈 Top ${Math.min(topPredictions.length, 10)} Price Drop Predictions:\n\n`;
      
      topPredictions.slice(0, 10).forEach((prediction, index) => {
        reportText += `${index + 1}. *${prediction.asin}* - ${(prediction.drop_probability * 100).toFixed(1)}% drop probability\n`;
        reportText += `   Expected drop: ${prediction.expected_drop_percent.toFixed(1)}% | Current: $${prediction.current_price}\n\n`;
      });
      
      reportText += `_Report generated: ${new Date().toLocaleString()}_`;
      
      // Send to Slack
      await slackService.sendSystemAlert(reportText, 'info');
      
      logger.info('Weekly report sent successfully', {
        predictionsIncluded: Math.min(topPredictions.length, 10)
      });
    } catch (error) {
      logger.error('Error generating weekly report:', error);
      throw error;
    }
  }

  async cleanupOldLogs() {
    try {
      // This is a placeholder - implement actual log cleanup based on your needs
      logger.info('Log cleanup completed (placeholder)');
      return 0;
    } catch (error) {
      logger.error('Error cleaning up logs:', error);
      return 0;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      jobCount: this.jobs.size,
      jobs: Array.from(this.jobs.keys()),
      crawlInterval: this.crawlInterval,
      nextRuns: this.getNextRunTimes()
    };
  }

  getNextRunTimes() {
    // This would calculate next run times for each job
    // Simplified implementation
    return {
      'main-crawl': 'Next run calculated based on cron expression',
      'price-detection': 'Every 30 minutes',
      'daily-cleanup': 'Daily at 2:00 AM',
      'weekly-report': 'Sundays at 9:00 AM'
    };
  }

  async triggerManualCrawl(customerId) {
    try {
      logger.info('Manual crawl triggered', { customerId });
      
      const result = await scraperService.scrapeCustomerASINs(customerId, {
        limit: 1000
      });
      
      // Run price detection after manual crawl
      await priceDetectionService.runDetectionCycle(customerId);
      
      return result;
    } catch (error) {
      logger.error('Error in manual crawl:', error);
      throw error;
    }
  }
}

// Create singleton instance
const schedulerService = new SchedulerService();

module.exports = schedulerService;