# PrimePulse 144 Development Guide

*The definitive project bible for Amazon Prime Day price monitoring system development*

## Project Context

### Overview
**PrimePulse 144** is an Amazon Prime Day price monitoring system that provides ML-powered price drop predictions and real-time Slack alerts. The system is designed to help users identify the best deals and price drop opportunities during Prime Day and year-round.

### Project Classification
- **Type**: Price Monitoring System
- **Complexity Level**: STANDARD (not enterprise)
- **Timeline**: 2-3 day MVP development cycles
- **Scale**: MVP with 1000 ASINs (scalable to 60k later)
- **Architecture**: Single customer focus for MVP

### Business Requirements
- Detect price changes within 120 minutes
- Send formatted Slack alerts for significant drops
- Handle 1000 ASINs reliably for MVP
- Provide ML-powered threat assessment
- Support automated crawling every 2 hours
- Enable manual triggering of price checks

---

## Current Phase Status

### ✅ Phase 1: Core Infrastructure (COMPLETED)
All foundational components have been implemented and are production-ready:

#### Completed Components
- **Express API Server** with authentication and rate limiting
- **PostgreSQL Database Schema** with all required tables:
  - `customers` - Customer accounts and API keys
  - `asins` - Product identifiers and metadata
  - `price_history` - Historical price data and features
  - `price_alerts` - Generated alerts and notifications
  - `crawl_jobs` - Job tracking and monitoring
  - `system_logs` - Application logging
- **Database Models** with full CRUD operations:
  - Customer.js - Account management
  - ASIN.js - Product tracking
  - PriceHistory.js - Price data storage
- **Authentication Middleware** with API key validation
- **Error Handling** with comprehensive logging
- **Docker Configuration** with multi-service stack
- **Environment Setup** with complete .env template

#### API Endpoints Implemented
```
GET  /api/health                 - Health checks
GET  /api/health/detailed        - Detailed system status
GET  /api/asins                  - List customer ASINs
POST /api/asins                  - Add single ASIN
POST /api/asins/bulk             - Add multiple ASINs
GET  /api/asins/:asin            - Get ASIN details
DEL  /api/asins/:asin            - Remove ASIN
GET  /api/prices/:asin/history   - Price history
POST /api/prices/current         - Current prices
GET  /api/prices/:asin/alerts    - Price alerts
GET  /api/prices/:asin/predictions - ML predictions
GET  /api/alerts/config          - Alert configuration
PUT  /api/alerts/config          - Update alerts
POST /api/alerts/test            - Test notifications
GET  /api/alerts/recent          - Recent alerts
GET  /api/alerts/stats           - Alert statistics
```

### ✅ Phase 2: Amazon Scraping Engine (COMPLETED)
Distributed crawling infrastructure is fully operational:

#### Completed Components
- **Cloudflare Workers** for distributed ASIN scraping
- **BrightData Proxy Integration** with rotation support
- **Scraper Service** with fallback to direct scraping
- **Rate Limiting** and retry mechanisms
- **Price Data Extraction** with comprehensive parsing
- **Error Handling** for failed scrapes
- **Worker Deployment Configuration** (wrangler.toml)

#### Scraping Capabilities
- Extracts: title, price, list price, availability, Prime eligibility
- Handles: ratings, reviews, seller information, coupons
- Supports: concurrent processing, proxy rotation, retries
- Includes: User-Agent rotation, rate limiting, error recovery

### ✅ Phase 3: Analytics & Detection (COMPLETED)
Price analysis and ML prediction framework is operational:

#### Completed Components
- **DuckDB Analytics Engine** for feature extraction
- **Price Change Detection** with configurable thresholds
- **ML Prediction Framework** (rule-based for MVP)
- **Threat Assessment Scoring** based on multiple factors
- **Alert Generation Logic** with severity classification
- **Feature Engineering** (price_delta, coupon_flip, seller_count)

#### Analytics Features
- Real-time feature extraction from price history
- Price volatility calculations
- Drop probability scoring
- Threat prioritization (top 5 per customer)
- Historical pattern analysis

### ✅ Phase 4: Workflow & Notifications (COMPLETED)
Automated workflows and alerting system are functional:

#### Completed Components
- **Scheduler Service** with cron-based automation
- **Slack Webhook Integration** with formatted messages
- **Alert Prioritization** and rate limiting
- **System Monitoring** and health checks
- **Error Notification** system
- **Weekly Reporting** automation

#### Workflow Automation
- Main crawl cycle every 120 minutes
- Price detection every 30 minutes
- Daily cleanup at 2 AM
- Weekly analytics reports on Sundays
- Manual crawl triggering via API

### ✅ Phase 5: Deployment & Documentation (COMPLETED)
Production deployment and documentation are complete:

#### Completed Components
- **Docker Containerization** with multi-service stack
- **Complete Documentation** (README.md, API docs)
- **Setup Scripts** and validation tools
- **Health Check System** for containers
- **Production Configuration** ready
- **Development Guide** (this document)

---

## What Still Needs to be Done

### 🔄 Immediate MVP Improvements (Phase 1.5)
These items should be completed to make the MVP fully operational:

#### High Priority
1. **Database Migration System**
   - Create `npm run migrate` command
   - Add database initialization scripts
   - Include sample data seeding

2. **PriceAlert Model Implementation**
   - Complete the PriceAlert model (currently referenced but not implemented)
   - Add CRUD operations for alerts
   - Integrate with price detection service

3. **Environment Validation**
   - Add startup checks for required environment variables
   - Validate external service connectivity (DB, Slack, etc.)
   - Graceful degradation for missing optional services

4. **Basic Unit Tests**
   - Test core models and services
   - API endpoint testing
   - Mock external dependencies

#### Medium Priority
5. **Enhanced Error Recovery**
   - Implement circuit breakers for external services
   - Add retry logic with exponential backoff
   - Improve database connection handling

6. **Monitoring Enhancements**
   - Add application metrics collection
   - Implement performance monitoring
   - Create alerting for system failures

### 🚀 Next Development Phase (Phase 6)
After MVP stabilization, the next logical development phase:

#### Enhanced ML & Predictions
- **Real XGBoost Model Training**
  - Replace rule-based predictions with actual ML model
  - Implement model training pipeline
  - Add feature importance analysis
  - Create model versioning system

- **AWS Lambda Integration**
  - Deploy XGBoost model to AWS Lambda
  - Implement inference API
  - Add model performance monitoring
  - Enable A/B testing of models

- **Advanced Feature Engineering**
  - Time-series features (seasonality, trends)
  - External data integration (holidays, events)
  - Cross-product feature correlation
  - Feature selection optimization

---

## Constraints & Boundaries

### 🎯 MVP Scope Limitations
These constraints define what should **NOT** be built in the current phase:

#### Architecture Constraints
- **Single Customer Only**: No multi-tenant architecture
- **1000 ASIN Limit**: Not full 60k scale (validate with subset first)
- **API-First Approach**: No complex UI development
- **Basic Authentication**: API keys only, no OAuth/JWT
- **Rule-Based ML**: No complex machine learning models yet

#### Feature Exclusions
- **❌ Multi-tenant Architecture**
  - Customer isolation
  - Per-customer billing
  - Resource quotas
  - Tenant management UI

- **❌ Advanced UI Components**
  - React dashboard
  - Real-time charts
  - Mobile applications
  - Admin panels

- **❌ Payment Processing**
  - Subscription management
  - Billing integration
  - Usage tracking
  - Payment gateways

- **❌ Enterprise Features**
  - SSO integration
  - Advanced security
  - Audit logging
  - Compliance features

- **❌ Full Scale Operations**
  - 60k ASIN processing
  - Global infrastructure
  - CDN integration
  - Advanced caching

### 🛡️ Technical Constraints

#### Performance Limits
- **Concurrent Requests**: Maximum 10 simultaneous scrapes
- **API Rate Limiting**: 100 requests per 15-minute window
- **Database Connections**: Pool of 20 connections max
- **Memory Usage**: Container limit of 512MB

#### Security Boundaries
- **Authentication**: API key based only
- **Authorization**: Single customer scope
- **Input Validation**: Joi schemas for all inputs
- **Error Exposure**: No sensitive data in error messages

#### Integration Limits
- **Slack Only**: No email notifications in MVP
- **PostgreSQL**: Single database instance
- **No CDN**: Direct file serving only
- **Basic Monitoring**: Logs and health checks only

---

## Tech Stack Decisions

### 🏗️ Core Architecture

#### Backend Framework
**Node.js 18+ with Express**
- **Why**: Fast development, excellent ecosystem
- **Constraints**: Use Express middleware patterns
- **Standards**: RESTful API design, JSON responses

#### Primary Database
**PostgreSQL 15+**
- **Why**: ACID compliance, excellent JSON support, reliable
- **Usage**: Customer data, ASINs, price history, alerts
- **Schema**: Normalized with proper indexes
- **Backup**: Daily automated backups (production)

#### Analytics Database
**DuckDB**
- **Why**: Columnar storage, excellent for analytics
- **Usage**: Feature extraction, ML data preparation
- **Integration**: File-based, embedded with application
- **Performance**: Optimized for analytical queries

#### Distributed Crawling
**Cloudflare Workers**
- **Why**: Global distribution, excellent performance
- **Usage**: Amazon ASIN scraping with proxy rotation
- **Deployment**: Wrangler CLI with automated deployment
- **Scaling**: Automatic scaling based on demand

#### Proxy Services
**BrightData Residential Proxies**
- **Why**: High success rate, rotating IPs
- **Usage**: Bypass rate limiting and geo-restrictions
- **Integration**: HTTP proxy with authentication
- **Fallback**: Direct scraping if proxy fails

### 🔧 Supporting Services

#### Workflow Orchestration
**n8n**
- **Why**: Visual workflow designer, flexible
- **Usage**: Complex automation workflows
- **Integration**: REST API and webhook triggers
- **Deployment**: Docker container in stack

#### Notifications
**Slack Webhooks**
- **Why**: Simple integration, rich formatting
- **Usage**: Price alerts, system notifications
- **Format**: Structured messages with attachments
- **Rate Limiting**: Respect Slack API limits

#### Monitoring
**Grafana + PostgreSQL**
- **Why**: Excellent visualization, familiar interface
- **Usage**: System metrics, performance monitoring
- **Data Source**: PostgreSQL metrics tables
- **Dashboards**: Pre-configured for key metrics

#### Containerization
**Docker + Docker Compose**
- **Why**: Consistent deployment, easy development
- **Usage**: All services containerized
- **Networking**: Internal Docker network
- **Volumes**: Persistent data storage

### 🔒 Security Stack

#### Authentication
**API Keys**
- **Storage**: Environment variables and database
- **Validation**: Middleware on protected routes
- **Scope**: Single customer per key
- **Rotation**: Manual rotation supported

#### Input Validation
**Joi Schema Validation**
- **Usage**: All API inputs validated
- **Error Handling**: Structured error responses
- **Security**: Prevent injection attacks
- **Documentation**: Schemas document API contracts

#### Rate Limiting
**rate-limiter-flexible**
- **Usage**: Per-IP rate limiting
- **Storage**: In-memory for development, Redis for production
- **Limits**: Configurable per endpoint
- **Response**: 429 status with retry headers

### 📦 Development Tools

#### Logging
**Winston**
- **Levels**: error, warn, info, debug
- **Transports**: File and console
- **Format**: JSON structured logging
- **Rotation**: Daily log rotation

#### Code Quality
**ESLint + Prettier**
- **Standards**: Airbnb style guide
- **Integration**: Pre-commit hooks
- **Automation**: CI/CD linting
- **Configuration**: Consistent across team

#### Testing
**Jest + Supertest**
- **Unit Tests**: Models and services
- **Integration Tests**: API endpoints
- **Mocking**: External dependencies
- **Coverage**: Minimum 70% target

---

## Development Standards

### 📋 Code Quality Requirements

#### Error Handling
- **Every service** must have comprehensive error handling
- **Database operations** must handle connection failures
- **External API calls** must implement retry logic
- **User inputs** must be validated and sanitized
- **Errors** must be logged with context

#### Logging Standards
- **Use Winston logger** for all operations
- **Include context** (user ID, request ID, timestamps)
- **Log levels**: error (failures), warn (degraded), info (operations), debug (details)
- **Structured format** for log aggregation
- **No sensitive data** in logs

#### API Design
- **RESTful endpoints** with proper HTTP methods
- **Consistent response format** with status codes
- **Joi validation** for all inputs
- **Pagination** for list endpoints
- **Error responses** with helpful messages

#### Database Practices
- **Use transactions** for multi-table operations
- **Proper indexing** for query performance
- **Connection pooling** for efficiency
- **Migration scripts** for schema changes
- **Backup verification** for data safety

### 🏛️ Architecture Principles

#### Single Responsibility
- **Each service** handles one business concern
- **Models** focus on data operations only
- **Routes** handle HTTP concerns only
- **Middleware** has specific, reusable functions

#### Error Isolation
- **Service failures** don't cascade to other services
- **Circuit breakers** for external dependencies
- **Graceful degradation** when possible
- **Health checks** for service monitoring

#### Scalability Preparation
- **Stateless design** for horizontal scaling
- **Database indexes** for performance
- **Caching strategies** where appropriate
- **Configuration** via environment variables

### 🔄 Development Workflow

#### Feature Development
1. **Update documentation** before coding
2. **Write tests** for new functionality
3. **Implement feature** following standards
4. **Update API documentation** if needed
5. **Test deployment** in development environment

#### Code Review Checklist
- [ ] Error handling implemented
- [ ] Logging added with proper levels
- [ ] Input validation using Joi
- [ ] Database operations use transactions
- [ ] Tests cover new functionality
- [ ] Documentation updated
- [ ] Security considerations addressed

#### Deployment Process
1. **Run tests** and ensure they pass
2. **Update environment** configuration if needed
3. **Deploy to staging** first
4. **Run integration tests** on staging
5. **Deploy to production** with monitoring

---

## Quick Reference

### 🚀 Essential Commands

```bash
# Development Setup
cp .env.example .env          # Configure environment
npm install                   # Install dependencies
docker-compose up -d          # Start services
npm run dev                   # Start development server

# Testing
node test-setup.js           # Validate setup
npm test                     # Run test suite
npm run test:coverage        # Test with coverage

# Database
npm run migrate              # Run migrations (TODO: implement)
npm run seed                 # Seed sample data (TODO: implement)

# Deployment
docker build -t primepulse-144 .  # Build container
wrangler deploy              # Deploy Cloudflare Workers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Monitoring
docker-compose logs -f       # View logs
curl http://localhost:3000/api/health  # Health check
```

### 🔧 Key Environment Variables

```bash
# Core Configuration
NODE_ENV=development
PORT=3000
API_KEY=pp144-mvp-api-key-2024
DATABASE_URL=postgresql://username:password@localhost:5432/primepulse

# External Services
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
BRIGHTDATA_USERNAME=your-brightdata-username
BRIGHTDATA_PASSWORD=your-brightdata-password
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token

# Feature Flags
ENABLE_SCHEDULER=true
ENABLE_ML_PREDICTIONS=true
ENABLE_SLACK_ALERTS=true
```

### 📊 Success Metrics

#### MVP Success Criteria
- [ ] Detect price changes within 120 minutes
- [ ] Send formatted Slack alerts
- [ ] Handle 1000 ASINs reliably
- [ ] Include comprehensive error handling
- [ ] Docker deployment ready
- [ ] Complete documentation

#### Performance Targets
- **API Response Time**: < 200ms for most endpoints
- **Scraping Success Rate**: > 90% for valid ASINs
- **Uptime**: > 99% for core services
- **Alert Latency**: < 5 minutes from price change to notification

#### Quality Metrics
- **Test Coverage**: > 70% for core functionality
- **Error Rate**: < 1% for API endpoints
- **Log Quality**: All errors logged with context
- **Documentation**: All APIs documented with examples

---

## Project Contacts & Resources

### 📚 Documentation
- **GitHub Repository**: https://github.com/AI-IAN/primepulse-144
- **API Documentation**: See README.md
- **Development Guide**: This document
- **Environment Setup**: .env.example

### 🔗 External Services
- **BrightData**: Residential proxy service
- **Cloudflare**: Workers platform for distributed scraping
- **Slack**: Webhook notifications
- **Amazon**: Target scraping platform

### 🎯 Development Philosophy

**Build incrementally, deploy frequently, monitor continuously.**

- **MVP First**: Get basic functionality working before adding features
- **Quality Over Quantity**: Better to have fewer features that work well
- **Documentation Driven**: Document decisions and architecture
- **Error Handling**: Plan for failures, they will happen
- **Monitoring**: You can't improve what you can't measure

---

*This development guide serves as the definitive reference for PrimePulse 144. Update this document as the project evolves to maintain its accuracy and usefulness.*