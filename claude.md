# PrimePulse 144 Development Guide

## Project Overview
**PrimePulse 144** - Amazon Prime Day price monitoring system with ML-powered price drop predictions and real-time Slack alerts.

## Project Configuration
- **Name**: PrimePulse 144
- **Type**: Price Monitoring System
- **Complexity**: STANDARD (1-3 days timeline)
- **Current Status**: MVP Complete ✅
- **Repository**: https://github.com/AI-IAN/primepulse-144

## STANDARD Complexity Rules & Constraints

### Timeline & Scope
- **Maximum Timeline**: 1-3 days development cycles
- **Production-ready features**: All code must be deployment-ready
- **Modern tech stack**: Node.js, PostgreSQL, DuckDB, Cloudflare Workers
- **Basic authentication**: API key-based security
- **Docker deployment**: Complete containerization required

### Core Technology Stack (Fixed)
- **Backend**: Node.js 18+ with Express API
- **Database**: PostgreSQL 15+ for customer/subscription data
- **Analytics**: DuckDB for real-time feature extraction
- **Crawling**: Cloudflare Workers with BrightData proxy rotation
- **ML/AI**: XGBoost predictive model (AWS Lambda wrapper)
- **Orchestration**: n8n workflow automation
- **Notifications**: Slack webhook integration
- **Monitoring**: Grafana dashboards
- **Containerization**: Docker with Docker Compose

## MVP Feature Boundaries

### ✅ INCLUDED in MVP (Current Implementation)
- Single customer ASIN list management
- Basic crawling workflow (1000 ASINs for testing)
- Simple price change detection algorithms
- Slack webhook integration with formatted alerts
- Basic admin dashboard via API endpoints
- Environment configuration for all APIs
- PostgreSQL schema with all required tables
- DuckDB analytics and feature extraction
- Cloudflare Workers for distributed crawling
- Automated scheduler (120-minute intervals)
- Docker deployment configuration
- Comprehensive error handling and logging

### ❌ EXCLUDED from MVP (Future Phases)
- **Multi-tenant architecture** (build for single customer first)
- **Payment processing** (focus on data pipeline)
- **Advanced UI** (API-first approach for MVP)
- **Complex authentication** (basic API keys only)
- **Full 60k ASIN scale** (start with 1000 for MVP)
- **Advanced ML models** (use rule-based predictions for MVP)
- **Email notifications** (Slack only for MVP)
- **Advanced analytics dashboard** (basic monitoring only)

## Phase-by-Phase Development Approach

### Phase 1: Core Infrastructure ✅ COMPLETED
- [x] Project setup and dependencies
- [x] Database schema and models
- [x] Basic Express API server
- [x] Authentication and middleware
- [x] Docker configuration
- [x] Environment setup

### Phase 2: Amazon Scraping Engine ✅ COMPLETED
- [x] Cloudflare Workers for scraping
- [x] BrightData proxy integration
- [x] ASIN scraping logic with error handling
- [x] Rate limiting and retry mechanisms
- [x] Price data extraction and storage

### Phase 3: Analytics & Detection ✅ COMPLETED
- [x] DuckDB feature extraction
- [x] Price change detection algorithms
- [x] ML prediction framework (rule-based)
- [x] Threat assessment scoring
- [x] Alert generation logic

### Phase 4: Workflow & Notifications ✅ COMPLETED
- [x] Automated scheduler service
- [x] Slack webhook integration
- [x] Alert formatting and prioritization
- [x] Error handling and monitoring
- [x] System health checks

### Phase 5: Deployment & Documentation ✅ COMPLETED
- [x] Docker containerization
- [x] Complete documentation
- [x] API documentation
- [x] Setup and testing scripts
- [x] Production deployment configuration

## Current Implementation Status

### ✅ Working Features
1. **Complete Express API** with authentication and rate limiting
2. **PostgreSQL Database** with full schema and relationships
3. **DuckDB Analytics Engine** for feature extraction
4. **Cloudflare Workers** for distributed Amazon scraping
5. **Price Change Detection** with configurable thresholds
6. **Slack Integration** with formatted alerts and threat summaries
7. **Automated Scheduler** for crawling every 120 minutes
8. **Docker Deployment** ready with multi-service stack
9. **Comprehensive Documentation** with API docs and setup guides
10. **Error Handling** throughout the application

### 🔄 Next Development Phases (Post-MVP)

#### Phase 6: Enhanced ML & Predictions
- Implement actual XGBoost model training
- AWS Lambda integration for ML inference
- Historical data analysis and model improvement
- Advanced threat scoring algorithms

#### Phase 7: Multi-Tenant Architecture
- Customer management and isolation
- Per-customer rate limiting and quotas
- Billing and subscription management
- Customer-specific alert configurations

#### Phase 8: Advanced Features
- Advanced web UI with React dashboard
- Email notification support
- CSV/Excel export functionality
- Mobile app integration
- Advanced monitoring and alerting

## Development Guidelines

### Code Quality Standards
- **Error Handling**: Every service must have comprehensive error handling
- **Logging**: Use Winston logger for all operations
- **Validation**: Joi schemas for all API inputs
- **Security**: API key authentication for all protected endpoints
- **Testing**: Include test coverage for new features

### Architecture Principles
- **API-First**: Build robust APIs before UI
- **Single Responsibility**: Each service handles one concern
- **Error Isolation**: Failures in one component don't break others
- **Scalable Design**: Architecture ready for 60k ASIN scale
- **Observable**: Comprehensive logging and monitoring

### Development Commands
```bash
# Core development workflow
"Implement feature: [description] for PrimePulse 144 following STANDARD complexity guidelines"
"Add comprehensive testing with proper error handling"
"Update documentation for new feature"
"Deploy to staging environment with monitoring"
```

### Success Criteria for New Features
- **Functionality**: All features working as specified
- **Error Handling**: Comprehensive error handling and recovery
- **Security**: Following established authentication patterns
- **Documentation**: Complete API docs and setup instructions
- **Deployment**: Docker-ready with health checks
- **Monitoring**: Proper logging and alerting integration

## Key Environment Variables
```bash
# Core Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/primepulse
API_KEY=your-secure-api-key
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Scraping Configuration
BRIGHTDATA_USERNAME=your-brightdata-username
BRIGHTDATA_PASSWORD=your-brightdata-password
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token

# Feature Flags
ENABLE_SCHEDULER=true
ENABLE_ML_PREDICTIONS=true
ENABLE_SLACK_ALERTS=true
```

## Quick Start Commands
```bash
# Development setup
cp .env.example .env  # Configure environment
npm install           # Install dependencies
docker-compose up -d  # Start services
npm run dev          # Start development server

# Testing
node test-setup.js   # Validate setup
npm test            # Run test suite

# Deployment
docker build -t primepulse-144 .
wrangler deploy     # Deploy Cloudflare Workers
```

## Complexity Control Reminders

### 🚫 AVOID Feature Creep
- **Stay within 2-3 day development cycles**
- **Don't add enterprise features** (keep to STANDARD complexity)
- **No advanced authentication** (API keys sufficient for MVP)
- **No advanced UI** (focus on API functionality)
- **No payment processing** (out of scope)

### ✅ MAINTAIN Standards
- **All code must be production-ready**
- **Include comprehensive error handling**
- **Follow established architecture patterns**
- **Maintain Docker deployment capability**
- **Keep documentation up-to-date**

---

**Continue PrimePulse 144 development within STANDARD complexity constraints. Focus on incremental improvements to existing features rather than major new components.**
