-- PrimePulse 144 Database Schema
-- PostgreSQL initialization script

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    slack_webhook_url TEXT,
    google_sheets_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create ASINs table
CREATE TABLE asins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    asin VARCHAR(10) NOT NULL,
    title VARCHAR(500),
    category VARCHAR(100),
    brand VARCHAR(255),
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    is_active BOOLEAN DEFAULT true,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_crawled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, asin)
);

-- Create price_history table
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asin_id UUID NOT NULL REFERENCES asins(id) ON DELETE CASCADE,
    price DECIMAL(10, 2),
    list_price DECIMAL(10, 2),
    discount_percent DECIMAL(5, 2),
    has_coupon BOOLEAN DEFAULT false,
    coupon_amount DECIMAL(10, 2),
    seller_name VARCHAR(255),
    seller_count INTEGER DEFAULT 1,
    availability VARCHAR(50),
    prime_eligible BOOLEAN DEFAULT false,
    rating DECIMAL(3, 2),
    review_count INTEGER,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create price_alerts table
CREATE TABLE price_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    asin_id UUID NOT NULL REFERENCES asins(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'price_drop', 'coupon_added', 'back_in_stock'
    threshold_value DECIMAL(10, 2),
    threshold_percent DECIMAL(5, 2),
    current_price DECIMAL(10, 2),
    previous_price DECIMAL(10, 2),
    price_change DECIMAL(10, 2),
    price_change_percent DECIMAL(5, 2),
    message TEXT,
    channels TEXT[], -- ['slack', 'email']
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create crawl_jobs table
CREATE TABLE crawl_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    total_asins INTEGER NOT NULL,
    processed_asins INTEGER DEFAULT 0,
    successful_crawls INTEGER DEFAULT 0,
    failed_crawls INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create system_logs table
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(20) NOT NULL, -- 'error', 'warn', 'info', 'debug'
    message TEXT NOT NULL,
    component VARCHAR(100), -- 'crawler', 'api', 'alerts', 'ml'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_asins_customer_id ON asins(customer_id);
CREATE INDEX idx_asins_asin ON asins(asin);
CREATE INDEX idx_asins_priority ON asins(priority);
CREATE INDEX idx_asins_is_active ON asins(is_active);
CREATE INDEX idx_asins_last_crawled ON asins(last_crawled_at);

CREATE INDEX idx_price_history_asin_id ON price_history(asin_id);
CREATE INDEX idx_price_history_scraped_at ON price_history(scraped_at);
CREATE INDEX idx_price_history_price ON price_history(price);
CREATE INDEX idx_price_history_has_coupon ON price_history(has_coupon);

CREATE INDEX idx_price_alerts_customer_id ON price_alerts(customer_id);
CREATE INDEX idx_price_alerts_asin_id ON price_alerts(asin_id);
CREATE INDEX idx_price_alerts_sent_at ON price_alerts(sent_at);
CREATE INDEX idx_price_alerts_type ON price_alerts(alert_type);

CREATE INDEX idx_crawl_jobs_customer_id ON crawl_jobs(customer_id);
CREATE INDEX idx_crawl_jobs_status ON crawl_jobs(status);
CREATE INDEX idx_crawl_jobs_created_at ON crawl_jobs(created_at);

CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_component ON system_logs(component);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_asins_updated_at BEFORE UPDATE ON asins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default customer for MVP
INSERT INTO customers (name, email, api_key, slack_webhook_url) VALUES (
    'MVP Customer',
    'mvp@primepulse.com',
    'pp144-mvp-api-key-2024',
    'https://hooks.slack.com/services/CHANGE/THIS/WEBHOOK'
);

-- Create n8n database for workflow orchestration
CREATE DATABASE n8n;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE primepulse TO primepulse;
GRANT ALL PRIVILEGES ON DATABASE n8n TO primepulse;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO primepulse;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO primepulse;