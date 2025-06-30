# PrimePulse 144

Amazon Prime Day price monitoring system with ML-powered price drop predictions and real-time Slack alerts.

## Overview

PrimePulse 144 is a comprehensive price monitoring solution designed for Amazon Prime Day and general e-commerce price tracking. The system uses distributed crawling, machine learning predictions, and real-time alerting to help users identify the best deals and price drop opportunities.

## Features

### Core Functionality
- **Distributed Crawling**: Cloudflare Workers for scalable ASIN scraping
- **ML Predictions**: XGBoost-powered price drop probability analysis
- **Real-time Alerts**: Slack webhook integration with top 5 threats per customer
- **Analytics Engine**: DuckDB for feature extraction and price analysis
- **Workflow Orchestration**: n8n integration for automated processes

### MVP Features (Current Implementation)
- Single customer ASIN list management
- Basic crawling workflow (1000 ASINs for testing)
- Simple price change detection
- Slack webhook integration
- Basic admin dashboard via API
- Environment configuration for all services

## Technology Stack

- **Backend**: Node.js with Express API
- **Database**: PostgreSQL for customer/subscription data
- **Analytics**: DuckDB for real-time analytics and feature extraction
- **Crawling**: Cloudflare Workers with residential proxy support (BrightData)
- **ML/AI**: Python XGBoost model (AWS Lambda wrapper ready)
- **Orchestration**: n8n workflow automation
- **Monitoring**: Grafana dashboards
- **Containerization**: Docker with Docker Compose
- **Notifications**: Slack webhooks

## Quick Start

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 15+
- Cloudflare account (for workers)

### Installation

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd primepulse-144
   npm install
   ```

2. **Environment configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker**:
   ```bash
   docker-compose up -d
   ```

4. **Manual start** (for development):
   ```bash
   # Start PostgreSQL and Redis
   docker-compose up -d postgres redis
   
   # Run migrations
   npm run migrate
   
   # Start the application
   npm run dev
   ```

### Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/primepulse

# Amazon Scraping
BRIGHTDATA_USERNAME=your-brightdata-username
BRIGHTDATA_PASSWORD=your-brightdata-password

# Cloudflare Workers
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token

# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# API Security
API_KEY=your-secure-api-key
```

## API Documentation

### Authentication
All API endpoints (except health checks) require an API key:
```bash
curl -H \"X-API-Key: your-api-key\" http://localhost:3000/api/asins
```

### Core Endpoints

#### ASINs Management
```bash
# Get all ASINs
GET /api/asins

# Add single ASIN
POST /api/asins
{
  \"asin\": \"B08N5WRWNW\",
  \"title\": \"Echo Dot (4th Gen)\",
  \"priority\": 3
}

# Add multiple ASINs
POST /api/asins/bulk
{
  \"asins\": [
    {\"asin\": \"B08N5WRWNW\", \"title\": \"Echo Dot\"},
    {\"asin\": \"B07XJ8C8F5\", \"title\": \"Fire TV Stick\"}
  ]
}
```

#### Price Monitoring
```bash
# Get price history
GET /api/prices/B08N5WRWNW/history?days=30

# Get current prices
POST /api/prices/current
{\"asins\": [\"B08N5WRWNW\", \"B07XJ8C8F5\"]}

# Get ML predictions
GET /api/prices/B08N5WRWNW/predictions
```

#### Alerts Configuration
```bash
# Get alert config
GET /api/alerts/config

# Update alert settings
PUT /api/alerts/config
{
  \"enabled\": true,
  \"thresholds\": {
    \"priceDropPercent\": 15,
    \"minimumDiscount\": 10
  }
}

# Send test alert
POST /api/alerts/test
```

## Cloudflare Workers Deployment

1. **Install Wrangler CLI**:
   ```bash
   npm install -g @cloudflare/wrangler
   ```

2. **Configure and deploy**:
   ```bash
   wrangler login
   wrangler secret put BRIGHTDATA_USERNAME
   wrangler secret put BRIGHTDATA_PASSWORD
   wrangler deploy
   ```

3. **Update environment**:
   ```bash
   CLOUDFLARE_WORKER_URL=https://primepulse-144-scraper.your-subdomain.workers.dev
   ```

## Architecture

### Data Flow
1. **Scheduler** triggers crawling jobs every 120 minutes
2. **Scraper Service** coordinates with Cloudflare Workers
3. **Workers** scrape Amazon product pages with proxy rotation
4. **Price Detection** analyzes changes and generates alerts
5. **DuckDB Analytics** extracts features for ML predictions
6. **Slack Service** sends formatted alerts and threat summaries

### Database Schema
- `customers` - Customer accounts and API keys
- `asins` - Product identifiers and metadata
- `price_history` - Historical price data and features
- `price_alerts` - Generated alerts and notifications
- `crawl_jobs` - Job tracking and monitoring

### ML Pipeline
1. **Feature Extraction**: DuckDB calculates price_delta, coupon_flip, seller_count
2. **Prediction Generation**: XGBoost model (placeholder implementation)
3. **Threat Assessment**: Rule-based scoring with ML features
4. **Alert Prioritization**: Top 5 threats per customer every 2 hours

## Monitoring and Alerts

### Health Checks
```bash
# Application health
GET /api/health

# Detailed health with dependencies
GET /api/health/detailed

# Worker health
GET https://your-worker-url.workers.dev/health
```

### Slack Notifications
- **Price Drop Alerts**: Immediate notifications for significant drops
- **Top Threats**: Summary of top 5 predicted price drops
- **System Alerts**: Errors, job completions, and status updates
- **Weekly Reports**: Analytics summary every Sunday

### Grafana Dashboards
Access Grafana at `http://localhost:3001` (admin/admin) for:
- Real-time scraping metrics
- Price change analytics
- System performance monitoring
- Alert frequency tracking

## Development

### Project Structure
```
src/
├── models/           # Database models (Customer, ASIN, PriceHistory)
├── routes/           # Express API routes
├── services/         # Business logic (scraper, detection, slack)
├── middleware/       # Authentication and error handling
├── utils/            # Logging and utilities
├── analytics/        # DuckDB integration and ML features
└── db/              # Database connection and queries

workers/             # Cloudflare Worker scripts
sql/                # Database schemas and migrations
```

### Testing
```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Test specific service
npm test -- --grep \"ScraperService\"
```

### Linting
```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

## Production Deployment

### Docker Production
```bash
# Build production image
docker build -t primepulse-144:latest .

# Run production stack
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Environment Setup
- Set `NODE_ENV=production`
- Configure proper database URLs
- Set up SSL certificates
- Configure monitoring and alerting
- Set up backup procedures

### Scaling Considerations
- **Database**: Consider read replicas for high query loads
- **Workers**: Scale Cloudflare Workers automatically handle traffic
- **Rate Limiting**: Monitor API rate limits and implement backoff
- **Data Retention**: Implement proper cleanup policies

## Success Criteria (MVP)

✅ **Detect price changes within 120 minutes**
✅ **Send formatted Slack alerts**
✅ **Handle 1000 ASINs reliably**
✅ **Include comprehensive error handling**
✅ **Docker deployment ready**
✅ **Complete documentation**

## Future Enhancements

### Planned Features
- Multi-tenant architecture for multiple customers
- Payment processing integration
- Advanced web UI with React dashboard
- Mobile app with push notifications
- Full 60k ASIN scale support
- Advanced ML models with historical training
- Email notification support
- CSV/Excel export functionality

### Technical Improvements
- Redis caching layer
- Elasticsearch for advanced search
- Kubernetes deployment
- Advanced security features
- API rate limiting per customer
- Real-time WebSocket updates

## Support and Contributing

### Getting Help
- Check the logs in `./logs/` directory
- Use health check endpoints for debugging
- Monitor Slack for system alerts
- Check Grafana dashboards for metrics

### Known Issues
- Large ASIN lists may hit rate limits
- Some Amazon pages require additional parsing
- Proxy rotation may occasionally fail

### Contributing
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with Claude Code for rapid development and deployment**

