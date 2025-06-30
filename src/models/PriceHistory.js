const db = require('../db');
const logger = require('../utils/logger');

class PriceHistory {
  static async create(priceData) {
    try {
      const {
        asinId,
        price,
        listPrice,
        discountPercent,
        hasCoupon,
        couponAmount,
        sellerName,
        sellerCount,
        availability,
        primeEligible,
        rating,
        reviewCount,
        scrapedAt
      } = priceData;

      const result = await db.query(
        `INSERT INTO price_history (
          asin_id, price, list_price, discount_percent, has_coupon, coupon_amount,
          seller_name, seller_count, availability, prime_eligible, rating, review_count, scraped_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          asinId, price, listPrice, discountPercent, hasCoupon, couponAmount,
          sellerName, sellerCount, availability, primeEligible, rating, reviewCount,
          scrapedAt || new Date()
        ]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating price history:', error);
      throw error;
    }
  }

  static async findByASIN(asinId, options = {}) {
    try {
      const { limit = 100, offset = 0, days = 30 } = options;
      const result = await db.query(
        `SELECT * FROM price_history 
         WHERE asin_id = $1 AND scraped_at >= NOW() - INTERVAL '${days} days'
         ORDER BY scraped_at DESC 
         LIMIT $2 OFFSET $3`,
        [asinId, limit, offset]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error finding price history by ASIN:', error);
      throw error;
    }
  }

  static async getLatestPrice(asinId) {
    try {
      const result = await db.query(
        'SELECT * FROM price_history WHERE asin_id = $1 ORDER BY scraped_at DESC LIMIT 1',
        [asinId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting latest price:', error);
      throw error;
    }
  }

  static async getPriceChanges(asinId, hours = 24) {
    try {
      const result = await db.query(
        `SELECT 
          ph1.price as current_price,
          ph2.price as previous_price,
          ph1.price - ph2.price as price_change,
          CASE 
            WHEN ph2.price > 0 THEN ((ph1.price - ph2.price) / ph2.price) * 100
            ELSE 0
          END as price_change_percent,
          ph1.scraped_at as current_time,
          ph2.scraped_at as previous_time
         FROM price_history ph1
         LEFT JOIN price_history ph2 ON ph1.asin_id = ph2.asin_id
         WHERE ph1.asin_id = $1 
           AND ph1.scraped_at >= NOW() - INTERVAL '${hours} hours'
           AND ph2.scraped_at < ph1.scraped_at
         ORDER BY ph1.scraped_at DESC, ph2.scraped_at DESC
         LIMIT 1`,
        [asinId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting price changes:', error);
      throw error;
    }
  }

  static async getPriceStats(asinId, days = 30) {
    try {
      const result = await db.query(
        `SELECT 
          MIN(price) as min_price,
          MAX(price) as max_price,
          AVG(price) as avg_price,
          COUNT(*) as data_points,
          STDDEV(price) as price_volatility
         FROM price_history 
         WHERE asin_id = $1 AND scraped_at >= NOW() - INTERVAL '${days} days'`,
        [asinId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting price stats:', error);
      throw error;
    }
  }

  static async bulkCreate(priceDataArray) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const results = [];

      for (const priceData of priceDataArray) {
        const result = await this.create(priceData);
        results.push(result);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error bulk creating price history:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async cleanup(daysToKeep = 90) {
    try {
      const result = await db.query(
        `DELETE FROM price_history 
         WHERE scraped_at < NOW() - INTERVAL '${daysToKeep} days'`
      );
      logger.info(`Cleaned up ${result.rowCount} old price history records`);
      return result.rowCount;
    } catch (error) {
      logger.error('Error cleaning up price history:', error);
      throw error;
    }
  }
}

module.exports = PriceHistory;