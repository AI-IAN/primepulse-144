const db = require('../db');
const logger = require('../utils/logger');

class ASIN {
  static async findById(id) {
    try {
      const result = await db.query(
        'SELECT * FROM asins WHERE id = $1 AND is_active = true',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding ASIN by ID:', error);
      throw error;
    }
  }

  static async findByCustomerAndASIN(customerId, asin) {
    try {
      const result = await db.query(
        'SELECT * FROM asins WHERE customer_id = $1 AND asin = $2 AND is_active = true',
        [customerId, asin]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding ASIN by customer and ASIN:', error);
      throw error;
    }
  }

  static async findByCustomer(customerId, options = {}) {
    try {
      const { limit = 100, offset = 0, priority } = options;
      let query = 'SELECT * FROM asins WHERE customer_id = $1 AND is_active = true';
      const params = [customerId];
      let paramIndex = 2;

      if (priority) {
        query += ` AND priority = $${paramIndex}`;
        params.push(priority);
        paramIndex++;
      }

      query += ` ORDER BY priority DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error finding ASINs by customer:', error);
      throw error;
    }
  }

  static async create(asinData) {
    try {
      const { customerId, asin, title, category, brand, priority } = asinData;
      const result = await db.query(
        `INSERT INTO asins (customer_id, asin, title, category, brand, priority)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [customerId, asin.toUpperCase(), title, category, brand, priority || 3]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('ASIN already exists for this customer');
      }
      logger.error('Error creating ASIN:', error);
      throw error;
    }
  }

  static async bulkCreate(customerId, asins) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const results = [];

      for (const asinData of asins) {
        const { asin, title, category, brand, priority } = asinData;
        try {
          const result = await client.query(
            `INSERT INTO asins (customer_id, asin, title, category, brand, priority)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [customerId, asin.toUpperCase(), title, category, brand, priority || 3]
          );
          results.push(result.rows[0]);
        } catch (error) {
          if (error.code !== '23505') { // Skip duplicate constraint violations
            throw error;
          }
          logger.warn(`ASIN ${asin} already exists for customer ${customerId}`);
        }
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error bulk creating ASINs:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async update(id, updateData) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(id);
      const result = await db.query(
        `UPDATE asins SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating ASIN:', error);
      throw error;
    }
  }

  static async updateLastCrawled(id) {
    try {
      const result = await db.query(
        'UPDATE asins SET last_crawled_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating last crawled time:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const result = await db.query(
        'UPDATE asins SET is_active = false WHERE id = $1 RETURNING *',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error deleting ASIN:', error);
      throw error;
    }
  }

  static async getASINsForCrawling(customerId, limit = 100) {
    try {
      const result = await db.query(
        `SELECT * FROM asins 
         WHERE customer_id = $1 AND is_active = true 
         AND (last_crawled_at IS NULL OR last_crawled_at < NOW() - INTERVAL '2 hours')
         ORDER BY priority DESC, last_crawled_at ASC NULLS FIRST
         LIMIT $2`,
        [customerId, limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting ASINs for crawling:', error);
      throw error;
    }
  }
}

module.exports = ASIN;