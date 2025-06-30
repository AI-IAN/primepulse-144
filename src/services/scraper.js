const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const ASIN = require('../models/ASIN');
const PriceHistory = require('../models/PriceHistory');
const analytics = require('../analytics/duckdb');

class ScraperService {
  constructor() {
    this.workerUrl = process.env.CLOUDFLARE_WORKER_URL || 'http://localhost:8787';
    this.brightDataConfig = {
      username: process.env.BRIGHTDATA_USERNAME,
      password: process.env.BRIGHTDATA_PASSWORD,
      endpoint: process.env.BRIGHTDATA_ENDPOINT || 'zproxy.lum-superproxy.io:22225',
      enabled: !!(process.env.BRIGHTDATA_USERNAME && process.env.BRIGHTDATA_PASSWORD)
    };
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 10;
    this.requestTimeout = parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000;
    this.retryAttempts = parseInt(process.env.RETRY_ATTEMPTS) || 3;
  }

  async scrapeCustomerASINs(customerId, options = {}) {
    try {
      const { limit = 100, priority } = options;
      
      // Get ASINs to scrape
      const asins = await ASIN.getASINsForCrawling(customerId, limit);
      
      if (asins.length === 0) {
        logger.info('No ASINs to scrape for customer', { customerId });
        return { success: true, results: [], message: 'No ASINs to scrape' };
      }

      logger.info('Starting scrape job', { 
        customerId, 
        asinCount: asins.length, 
        priority 
      });

      // Scrape via Cloudflare Workers
      const results = await this.scrapeWithWorkers(asins.map(a => a.asin));
      
      // Process results and update database
      const processedResults = await this.processScrapingResults(asins, results);
      
      logger.info('Scrape job completed', {
        customerId,
        total: asins.length,
        successful: processedResults.successful,
        failed: processedResults.failed
      });

      return processedResults;
    } catch (error) {
      logger.error('Error scraping customer ASINs:', error);
      throw error;
    }
  }

  async scrapeWithWorkers(asins) {
    try {
      const payload = {
        asins,
        proxyConfig: this.brightDataConfig,
        maxConcurrent: this.maxConcurrent
      };

      const response = await axios.post(`${this.workerUrl}/scrape`, payload, {
        timeout: this.requestTimeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PrimePulse-144/1.0'
        }
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Worker scraping failed');
      }

      return response.data.results;
    } catch (error) {
      logger.error('Error scraping with workers:', error);
      
      // Fallback to direct scraping if workers fail
      logger.info('Falling back to direct scraping');
      return await this.scrapeDirectly(asins);
    }
  }

  async scrapeDirectly(asins) {
    const results = [];
    const chunks = this.chunkArray(asins, this.maxConcurrent);

    for (const chunk of chunks) {
      const promises = chunk.map(asin => this.scrapeASINDirect(asin));
      const chunkResults = await Promise.allSettled(promises);
      
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error(`Failed to scrape ASIN ${chunk[index]}:`, result.reason);
          results.push({
            asin: chunk[index],
            success: false,
            error: result.reason?.message || 'Unknown error',
            timestamp: new Date().toISOString()
          });
        }
      });

      // Rate limiting delay
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.sleep(2000 + Math.random() * 3000);
      }
    }

    return results;
  }

  async scrapeASINDirect(asin) {
    const url = `https://www.amazon.com/dp/${asin}`;
    const userAgent = this.getRandomUserAgent();
    
    let attempt = 0;
    while (attempt < this.retryAttempts) {
      try {
        const response = await axios.get(url, {
          timeout: this.requestTimeout,
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });

        const productData = this.parseProductHTML(response.data, asin);
        
        return {
          asin,
          success: true,
          data: productData,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        attempt++;
        logger.warn(`Scraping attempt ${attempt} failed for ASIN ${asin}:`, error.message);
        
        if (attempt < this.retryAttempts) {
          await this.sleep(1000 * attempt); // Exponential backoff
        } else {
          throw error;
        }
      }
    }
  }

  parseProductHTML(html, asin) {
    const $ = cheerio.load(html);
    
    const productData = {
      asin,
      title: this.extractTitle($),
      price: this.extractPrice($),
      listPrice: this.extractListPrice($),
      availability: this.extractAvailability($),
      primeEligible: this.checkPrimeEligible($),
      rating: this.extractRating($),
      reviewCount: this.extractReviewCount($),
      seller: this.extractSeller($),
      hasCoupon: this.checkCoupon($),
      couponAmount: this.extractCouponAmount($),
      sellerCount: this.extractSellerCount($)
    };

    // Calculate discount percentage
    if (productData.price && productData.listPrice && productData.listPrice > productData.price) {
      productData.discountPercent = ((productData.listPrice - productData.price) / productData.listPrice) * 100;
    }

    return productData;
  }

  extractTitle($) {
    return $('#productTitle').text().trim() || 
           $('.product-title').text().trim() || 
           $('.a-size-large.product-title-word-break').text().trim() || 
           null;
  }

  extractPrice($) {
    const priceSelectors = [
      '.a-price-whole',
      '.a-offscreen',
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen'
    ];

    for (const selector of priceSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const price = element.text().replace(/[$,]/g, '').trim();
        const parsed = parseFloat(price);
        if (!isNaN(parsed)) return parsed;
      }
    }

    return null;
  }

  extractListPrice($) {
    const listPriceSelectors = [
      '.a-price.a-text-price .a-offscreen',
      '.a-text-strike .a-offscreen',
      '#listPrice',
      '.a-price-base .a-offscreen'
    ];

    for (const selector of listPriceSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const price = element.text().replace(/[$,]/g, '').trim();
        const parsed = parseFloat(price);
        if (!isNaN(parsed)) return parsed;
      }
    }

    return null;
  }

  extractAvailability($) {
    const availabilityText = $('#availability span').text().trim().toLowerCase();
    
    if (availabilityText.includes('in stock')) return 'in stock';
    if (availabilityText.includes('out of stock')) return 'out of stock';
    if (availabilityText.includes('limited')) return 'limited';
    if (availabilityText.includes('unavailable')) return 'unavailable';
    
    return 'unknown';
  }

  checkPrimeEligible($) {
    return $('.a-icon-prime').length > 0 || 
           $('[aria-label="Prime"]').length > 0 ||
           $('.prime-logo').length > 0;
  }

  extractRating($) {
    const ratingText = $('.a-icon-alt').first().text();
    const match = ratingText.match(/(\d\.\d) out of/);
    return match ? parseFloat(match[1]) : null;
  }

  extractReviewCount($) {
    const reviewText = $('#acrCustomerReviewText').text();
    const match = reviewText.match(/(\d{1,3}(?:,\d{3})*) ratings/);
    return match ? parseInt(match[1].replace(/,/g, '')) : null;
  }

  extractSeller($) {
    return $('#sellerProfileTriggerId').text().trim() ||
           $('.tabular-buybox-text[tabular-attribute-name="Sold by"] span').text().trim() ||
           null;
  }

  checkCoupon($) {
    return $('.couponText').length > 0 || 
           $('.a-color-price').text().toLowerCase().includes('coupon');
  }

  extractCouponAmount($) {
    const couponText = $('.couponText, .a-color-price').text();
    const match = couponText.match(/Save \$([\d,]+\.\d{2})/);
    return match ? parseFloat(match[1].replace(/,/g, '')) : null;
  }

  extractSellerCount($) {
    // This is complex to extract reliably, default to 1
    return 1;
  }

  async processScrapingResults(asins, results) {
    let successful = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const asinRecord = asins.find(a => a.asin === result.asin);
      
      if (!asinRecord) {
        logger.warn('ASIN record not found for result:', result.asin);
        continue;
      }

      try {
        if (result.success && result.data) {
          // Update ASIN last crawled time
          await ASIN.updateLastCrawled(asinRecord.id);
          
          // Save price history
          const priceData = {
            asinId: asinRecord.id,
            price: result.data.price,
            listPrice: result.data.listPrice,
            discountPercent: result.data.discountPercent,
            hasCoupon: result.data.hasCoupon,
            couponAmount: result.data.couponAmount,
            sellerName: result.data.seller,
            sellerCount: result.data.sellerCount,
            availability: result.data.availability,
            primeEligible: result.data.primeEligible,
            rating: result.data.rating,
            reviewCount: result.data.reviewCount,
            scrapedAt: new Date(result.timestamp)
          };
          
          const priceHistory = await PriceHistory.create(priceData);
          
          // Extract features for analytics
          if (analytics.initialized) {
            const recentHistory = await PriceHistory.findByASIN(asinRecord.id, { limit: 10 });
            await analytics.extractPriceFeatures(recentHistory);
          }
          
          successful++;
        } else {
          failed++;
          errors.push({ asin: result.asin, error: result.error });
        }
      } catch (error) {
        logger.error('Error processing scraping result:', { asin: result.asin, error });
        failed++;
        errors.push({ asin: result.asin, error: error.message });
      }
    }

    return {
      success: true,
      total: asins.length,
      successful,
      failed,
      errors: errors.slice(0, 10) // Return first 10 errors
    };
  }

  getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const scraperService = new ScraperService();

module.exports = scraperService;