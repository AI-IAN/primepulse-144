const db = require('../db');
const logger = require('../utils/logger');

class Customer {
  static async findById(id) {
    try {
      const result = await db.query(
        'SELECT * FROM customers WHERE id = $1 AND is_active = true',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding customer by ID:', error);
      throw error;
    }
  }

  static async findByApiKey(apiKey) {
    try {
      const result = await db.query(
        'SELECT * FROM customers WHERE api_key = $1 AND is_active = true',
        [apiKey]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding customer by API key:', error);
      throw error;
    }
  }

  static async create(customerData) {
    try {
      const { name, email, apiKey, slackWebhookUrl, googleSheetsId } = customerData;
      const result = await db.query(
        `INSERT INTO customers (name, email, api_key, slack_webhook_url, google_sheets_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, email, apiKey, slackWebhookUrl, googleSheetsId]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw error;
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
        `UPDATE customers SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating customer:', error);
      throw error;
    }
  }

  static async getAll() {
    try {
      const result = await db.query(
        'SELECT * FROM customers WHERE is_active = true ORDER BY created_at DESC'
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting all customers:', error);
      throw error;
    }
  }
}

module.exports = Customer;