// Cloudflare Worker for Amazon ASIN scraping
// This worker handles distributed crawling with proxy rotation

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'
];

const SELECTORS = {
  title: '#productTitle, .product-title, .a-size-large',
  price: '.a-price-whole, .a-offscreen, #priceblock_dealprice, #priceblock_ourprice',
  listPrice: '.a-price.a-text-price .a-offscreen, .a-text-strike',
  coupon: '.a-color-price, .couponText, .a-button-text',
  availability: '#availability span, .a-size-medium.a-color-success, .a-size-medium.a-color-state',
  prime: '.a-icon-prime, [aria-label="Prime"], .prime-logo',
  rating: '.a-icon-alt, .a-star-mini',
  reviewCount: '#acrCustomerReviewText, .a-link-normal',
  seller: '#sellerProfileTriggerId, .tabular-buybox-text',
  images: '#landingImage, .a-image-wrapper img'
};

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/scrape' && request.method === 'POST') {
        return await handleScrapeRequest(request, env, corsHeaders);
      }

      if (path === '/health') {
        return new Response(JSON.stringify({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          worker: 'amazon-scraper'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function handleScrapeRequest(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { asins, proxyConfig, maxConcurrent = 5 } = body;

    if (!asins || !Array.isArray(asins) || asins.length === 0) {
      return new Response(JSON.stringify({ error: 'ASINs array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (asins.length > 100) {
      return new Response(JSON.stringify({ error: 'Maximum 100 ASINs per request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = await scrapeASINs(asins, proxyConfig, maxConcurrent);
    
    return new Response(JSON.stringify({
      success: true,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Scrape request error:', error);
    return new Response(JSON.stringify({ 
      error: 'Scraping failed',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function scrapeASINs(asins, proxyConfig, maxConcurrent) {
  const results = [];
  const chunks = chunkArray(asins, maxConcurrent);

  for (const chunk of chunks) {
    const promises = chunk.map(asin => scrapeASIN(asin, proxyConfig));
    const chunkResults = await Promise.allSettled(promises);
    
    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`Failed to scrape ASIN ${chunk[index]}:`, result.reason);
        results.push({
          asin: chunk[index],
          success: false,
          error: result.reason?.message || 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Rate limiting delay between chunks
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await sleep(2000 + Math.random() * 3000); // 2-5 second delay
    }
  }

  return results;
}

async function scrapeASIN(asin, proxyConfig) {
  const url = `https://www.amazon.com/dp/${asin}`;
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  
  const requestOptions = {
    method: 'GET',
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  };

  // Add proxy configuration if provided
  if (proxyConfig && proxyConfig.enabled) {
    // Cloudflare Workers don't support direct proxy configuration
    // This would need to be implemented via fetch with proxy endpoints
    console.log('Proxy configuration provided but not implemented in this worker');
  }

  try {
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const productData = parseProductHTML(html, asin);
    
    return {
      asin,
      success: true,
      data: productData,
      timestamp: new Date().toISOString(),
      responseTime: response.headers.get('CF-RAY') ? 'cloudflare' : 'direct'
    };
  } catch (error) {
    console.error(`Error scraping ASIN ${asin}:`, error);
    throw error;
  }
}

function parseProductHTML(html, asin) {
  // Simple regex-based parsing (in production, consider using a proper HTML parser)
  const productData = {
    asin,
    title: extractText(html, SELECTORS.title),
    price: extractPrice(html, SELECTORS.price),
    listPrice: extractPrice(html, SELECTORS.listPrice),
    availability: extractText(html, SELECTORS.availability),
    prime: html.includes('prime-logo') || html.includes('a-icon-prime'),
    rating: extractRating(html),
    reviewCount: extractReviewCount(html),
    seller: extractText(html, SELECTORS.seller),
    hasCoupon: html.includes('coupon') || html.includes('Coupon'),
    couponAmount: extractCouponAmount(html),
    images: extractImages(html)
  };

  // Calculate derived fields
  if (productData.price && productData.listPrice) {
    productData.discountPercent = ((productData.listPrice - productData.price) / productData.listPrice) * 100;
  }

  return productData;
}

function extractText(html, selector) {
  // Simple regex extraction (replace with proper HTML parser for production)
  const patterns = {
    '#productTitle': /<span[^>]*id="productTitle"[^>]*>([^<]+)<\/span>/i,
    '.a-size-large': /<span[^>]*class="[^"]*a-size-large[^"]*"[^>]*>([^<]+)<\/span>/i,
    '#availability': /<div[^>]*id="availability"[^>]*>[^<]*<span[^>]*>([^<]+)<\/span>/i
  };

  for (const [sel, pattern] of Object.entries(patterns)) {
    if (selector.includes(sel.substring(1))) {
      const match = html.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
  }

  return null;
}

function extractPrice(html, selector) {
  const pricePatterns = [
    /\$([\d,]+\.\d{2})/g,
    /Price: \$([\d,]+\.\d{2})/i,
    /\$([\d,]+)/g
  ];

  for (const pattern of pricePatterns) {
    const matches = html.match(pattern);
    if (matches) {
      const price = matches[0].replace(/[$,]/g, '');
      return parseFloat(price);
    }
  }

  return null;
}

function extractRating(html) {
  const ratingMatch = html.match(/(\d\.\d) out of 5 stars/i);
  return ratingMatch ? parseFloat(ratingMatch[1]) : null;
}

function extractReviewCount(html) {
  const reviewMatch = html.match(/(\d{1,3}(?:,\d{3})*) ratings/i);
  return reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, '')) : null;
}

function extractCouponAmount(html) {
  const couponMatch = html.match(/Save \$([\d,]+\.\d{2})/i);
  return couponMatch ? parseFloat(couponMatch[1].replace(/,/g, '')) : null;
}

function extractImages(html) {
  const imageMatches = html.match(/https:\/\/[^"]+\.(jpg|jpeg|png|webp)/gi);
  return imageMatches ? imageMatches.slice(0, 5) : []; // Return first 5 images
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}