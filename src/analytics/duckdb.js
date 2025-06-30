const duckdb = require('duckdb');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class DuckDBAnalytics {
  constructor() {
    this.dbPath = process.env.DUCKDB_PATH || './data/analytics.duckdb';
    this.db = null;
    this.connection = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new duckdb.Database(this.dbPath);
      this.connection = this.db.connect();
      
      await this.setupTables();
      this.initialized = true;
      logger.info('DuckDB analytics database initialized');
    } catch (error) {
      logger.error('Error initializing DuckDB:', error);
      throw error;
    }
  }

  async setupTables() {
    const tables = [
      // Price analysis table
      `CREATE TABLE IF NOT EXISTS price_features (
        asin_id VARCHAR,
        asin VARCHAR,
        timestamp TIMESTAMP,
        current_price DECIMAL(10,2),
        previous_price DECIMAL(10,2),
        price_delta DECIMAL(10,2),
        price_delta_percent DECIMAL(8,4),
        coupon_flip BOOLEAN,
        coupon_amount DECIMAL(10,2),
        seller_count INTEGER,
        seller_delta INTEGER,
        availability_score DECIMAL(3,2),
        prime_eligible BOOLEAN,
        rating DECIMAL(3,2),
        review_count INTEGER,
        price_volatility DECIMAL(8,4),
        is_weekend BOOLEAN,
        hour_of_day INTEGER,
        PRIMARY KEY (asin_id, timestamp)
      )`,
      
      // ML training features
      `CREATE TABLE IF NOT EXISTS ml_features (
        asin_id VARCHAR,
        feature_timestamp TIMESTAMP,
        features JSON,
        target_price_drop DECIMAL(8,4),
        target_drop_within_24h BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (asin_id, feature_timestamp)
      )`,
      
      // Prediction results
      `CREATE TABLE IF NOT EXISTS predictions (
        asin_id VARCHAR,
        prediction_timestamp TIMESTAMP,
        drop_probability DECIMAL(8,4),
        expected_drop_percent DECIMAL(8,4),
        confidence_score DECIMAL(8,4),
        model_version VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (asin_id, prediction_timestamp)
      )`
    ];

    for (const tableSQL of tables) {
      await this.query(tableSQL);
    }
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.initialized) {
        return reject(new Error('DuckDB not initialized'));
      }

      this.connection.all(sql, ...params, (err, result) => {
        if (err) {
          logger.error('DuckDB query error:', { sql: sql.substring(0, 100), error: err });
          reject(err);
        } else {
          logger.debug('DuckDB query executed:', { 
            sql: sql.substring(0, 100), 
            rowCount: result?.length || 0 
          });
          resolve(result);
        }
      });
    });
  }

  async extractPriceFeatures(priceHistory) {
    try {
      if (!priceHistory || priceHistory.length < 2) {
        return null;
      }

      const latest = priceHistory[0];
      const previous = priceHistory[1];
      const timestamp = new Date(latest.scraped_at);

      const features = {
        asin_id: latest.asin_id,
        asin: latest.asin,
        timestamp: timestamp.toISOString(),
        current_price: parseFloat(latest.price) || 0,
        previous_price: parseFloat(previous.price) || 0,
        price_delta: (parseFloat(latest.price) || 0) - (parseFloat(previous.price) || 0),
        price_delta_percent: previous.price > 0 ? 
          (((parseFloat(latest.price) || 0) - (parseFloat(previous.price) || 0)) / parseFloat(previous.price)) * 100 : 0,
        coupon_flip: latest.has_coupon !== previous.has_coupon,
        coupon_amount: parseFloat(latest.coupon_amount) || 0,
        seller_count: parseInt(latest.seller_count) || 1,
        seller_delta: (parseInt(latest.seller_count) || 1) - (parseInt(previous.seller_count) || 1),
        availability_score: this.calculateAvailabilityScore(latest.availability),
        prime_eligible: latest.prime_eligible || false,
        rating: parseFloat(latest.rating) || 0,
        review_count: parseInt(latest.review_count) || 0,
        price_volatility: this.calculatePriceVolatility(priceHistory),
        is_weekend: timestamp.getDay() === 0 || timestamp.getDay() === 6,
        hour_of_day: timestamp.getHours()
      };

      // Insert into DuckDB
      await this.insertPriceFeatures(features);
      return features;
    } catch (error) {
      logger.error('Error extracting price features:', error);
      throw error;
    }
  }

  async insertPriceFeatures(features) {
    const sql = `
      INSERT OR REPLACE INTO price_features (
        asin_id, asin, timestamp, current_price, previous_price, price_delta,
        price_delta_percent, coupon_flip, coupon_amount, seller_count,
        seller_delta, availability_score, prime_eligible, rating,
        review_count, price_volatility, is_weekend, hour_of_day
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.query(sql, [
      features.asin_id, features.asin, features.timestamp,
      features.current_price, features.previous_price, features.price_delta,
      features.price_delta_percent, features.coupon_flip, features.coupon_amount,
      features.seller_count, features.seller_delta, features.availability_score,
      features.prime_eligible, features.rating, features.review_count,
      features.price_volatility, features.is_weekend, features.hour_of_day
    ]);
  }

  calculateAvailabilityScore(availability) {
    const scores = {
      'in stock': 1.0,
      'limited': 0.7,
      'low stock': 0.5,
      'out of stock': 0.0,
      'unavailable': 0.0
    };
    return scores[availability?.toLowerCase()] || 0.5;
  }

  calculatePriceVolatility(priceHistory) {
    if (!priceHistory || priceHistory.length < 3) return 0;
    
    const prices = priceHistory.slice(0, 10).map(p => parseFloat(p.price)).filter(p => p > 0);
    if (prices.length < 2) return 0;

    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  async generateMLFeatures(asinId, lookbackHours = 168) { // 7 days
    try {
      const sql = `
        SELECT 
          asin_id,
          AVG(price_delta_percent) as avg_price_change,
          STDDEV(price_delta_percent) as price_volatility,
          COUNT(CASE WHEN price_delta < 0 THEN 1 END) as drop_count,
          COUNT(CASE WHEN coupon_flip = true THEN 1 END) as coupon_flips,
          AVG(seller_count) as avg_seller_count,
          MAX(price_delta_percent) as max_price_drop,
          MIN(price_delta_percent) as max_price_increase,
          COUNT(*) as data_points
        FROM price_features
        WHERE asin_id = ? 
          AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '${lookbackHours} hours'
        GROUP BY asin_id
      `;

      const result = await this.query(sql, [asinId]);
      return result[0] || null;
    } catch (error) {
      logger.error('Error generating ML features:', error);
      throw error;
    }
  }

  async storePrediction(asinId, prediction) {
    try {
      const sql = `
        INSERT INTO predictions (
          asin_id, prediction_timestamp, drop_probability,
          expected_drop_percent, confidence_score, model_version
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      await this.query(sql, [
        asinId,
        new Date().toISOString(),
        prediction.dropProbability,
        prediction.expectedDrop,
        prediction.confidence,
        prediction.modelVersion || 'v1.0'
      ]);
    } catch (error) {
      logger.error('Error storing prediction:', error);
      throw error;
    }
  }

  async getTopPredictions(limit = 50) {
    try {
      const sql = `
        SELECT p.*, pf.asin, pf.current_price
        FROM predictions p
        JOIN (
          SELECT asin_id, asin, current_price,
                 ROW_NUMBER() OVER (PARTITION BY asin_id ORDER BY timestamp DESC) as rn
          FROM price_features
        ) pf ON p.asin_id = pf.asin_id AND pf.rn = 1
        WHERE p.prediction_timestamp >= CURRENT_TIMESTAMP - INTERVAL '4 hours'
        ORDER BY p.drop_probability DESC, p.expected_drop_percent DESC
        LIMIT ?
      `;

      return await this.query(sql, [limit]);
    } catch (error) {
      logger.error('Error getting top predictions:', error);
      throw error;
    }
  }

  async close() {
    if (this.connection) {
      this.connection.close();
    }
    if (this.db) {
      this.db.close();
    }
    logger.info('DuckDB connection closed');
  }
}

// Create singleton instance
const analytics = new DuckDBAnalytics();

module.exports = analytics;