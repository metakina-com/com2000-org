-- COM2000 Platform Database Schema
-- Initial migration for Cloudflare D1 Database

-- Project cache table
CREATE TABLE IF NOT EXISTS project_cache (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    description TEXT,
    website TEXT,
    whitepaper TEXT,
    logo TEXT,
    banner TEXT,
    category TEXT,
    tags TEXT, -- JSON array
    total_supply REAL,
    circulating_supply REAL,
    market_cap REAL,
    price REAL,
    change_24h REAL,
    volume_24h REAL,
    status TEXT CHECK (status IN ('active', 'upcoming', 'completed', 'cancelled')) DEFAULT 'active',
    social_links TEXT, -- JSON object
    team TEXT, -- JSON array
    roadmap TEXT, -- JSON array
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- IDO pool cache table
CREATE TABLE IF NOT EXISTS ido_pool_cache (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    total_tokens REAL NOT NULL,
    token_price REAL NOT NULL,
    min_investment REAL NOT NULL,
    max_investment REAL NOT NULL,
    soft_cap REAL NOT NULL,
    hard_cap REAL NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    vesting_schedule TEXT, -- JSON array
    status TEXT CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')) DEFAULT 'upcoming',
    total_raised REAL DEFAULT 0,
    participant_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project_cache(id)
);

-- User investment cache table
CREATE TABLE IF NOT EXISTS user_investment_cache (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ido_pool_id TEXT NOT NULL,
    amount REAL NOT NULL,
    token_amount REAL NOT NULL,
    transaction_hash TEXT,
    status TEXT CHECK (status IN ('pending', 'confirmed', 'failed')) DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (ido_pool_id) REFERENCES ido_pool_cache(id)
);

-- Price cache table
CREATE TABLE IF NOT EXISTS price_cache (
    symbol TEXT PRIMARY KEY,
    price REAL NOT NULL,
    price_usd REAL NOT NULL,
    change_24h REAL,
    volume_24h REAL,
    market_cap REAL,
    last_updated INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'external_api'
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT,
    properties TEXT, -- JSON object
    ip_address TEXT,
    user_agent TEXT,
    timestamp INTEGER NOT NULL
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    window_start INTEGER NOT NULL,
    reset_time INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Cache metadata table
CREATE TABLE IF NOT EXISTS cache_metadata (
    cache_key TEXT PRIMARY KEY,
    ttl INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_accessed INTEGER NOT NULL,
    hit_count INTEGER DEFAULT 0,
    data_size INTEGER DEFAULT 0
);

-- System metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_type TEXT NOT NULL, -- 'counter', 'gauge', 'histogram'
    labels TEXT, -- JSON object
    timestamp INTEGER NOT NULL
);

-- Error logs table
CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    request_id TEXT,
    user_id TEXT,
    endpoint TEXT,
    method TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp INTEGER NOT NULL
);

-- Create indexes for better query performance

-- Project cache indexes
CREATE INDEX IF NOT EXISTS idx_project_cache_symbol ON project_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_project_cache_category ON project_cache(category);
CREATE INDEX IF NOT EXISTS idx_project_cache_status ON project_cache(status);
CREATE INDEX IF NOT EXISTS idx_project_cache_market_cap ON project_cache(market_cap DESC);
CREATE INDEX IF NOT EXISTS idx_project_cache_created_at ON project_cache(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_cache_name_search ON project_cache(name);

-- IDO pool cache indexes
CREATE INDEX IF NOT EXISTS idx_ido_pool_cache_project_id ON ido_pool_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_ido_pool_cache_status ON ido_pool_cache(status);
CREATE INDEX IF NOT EXISTS idx_ido_pool_cache_start_time ON ido_pool_cache(start_time);
CREATE INDEX IF NOT EXISTS idx_ido_pool_cache_end_time ON ido_pool_cache(end_time);
CREATE INDEX IF NOT EXISTS idx_ido_pool_cache_total_raised ON ido_pool_cache(total_raised DESC);

-- User investment cache indexes
CREATE INDEX IF NOT EXISTS idx_user_investment_cache_user_id ON user_investment_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_user_investment_cache_ido_pool_id ON user_investment_cache(ido_pool_id);
CREATE INDEX IF NOT EXISTS idx_user_investment_cache_status ON user_investment_cache(status);
CREATE INDEX IF NOT EXISTS idx_user_investment_cache_created_at ON user_investment_cache(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_investment_cache_tx_hash ON user_investment_cache(transaction_hash);

-- Price cache indexes
CREATE INDEX IF NOT EXISTS idx_price_cache_last_updated ON price_cache(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_price_cache_market_cap ON price_cache(market_cap DESC);
CREATE INDEX IF NOT EXISTS idx_price_cache_change_24h ON price_cache(change_24h DESC);
CREATE INDEX IF NOT EXISTS idx_price_cache_volume_24h ON price_cache(volume_24h DESC);

-- Analytics events indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);

-- Rate limits indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_time ON rate_limits(reset_time);

-- Cache metadata indexes
CREATE INDEX IF NOT EXISTS idx_cache_metadata_created_at ON cache_metadata(created_at);
CREATE INDEX IF NOT EXISTS idx_cache_metadata_last_accessed ON cache_metadata(last_accessed);
CREATE INDEX IF NOT EXISTS idx_cache_metadata_hit_count ON cache_metadata(hit_count DESC);

-- System metrics indexes
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);

-- Error logs indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_endpoint ON error_logs(endpoint);

-- Create triggers for automatic timestamp updates

-- Project cache trigger
CREATE TRIGGER IF NOT EXISTS update_project_cache_timestamp 
AFTER UPDATE ON project_cache
BEGIN
    UPDATE project_cache SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

-- IDO pool cache trigger
CREATE TRIGGER IF NOT EXISTS update_ido_pool_cache_timestamp 
AFTER UPDATE ON ido_pool_cache
BEGIN
    UPDATE ido_pool_cache SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

-- User investment cache trigger
CREATE TRIGGER IF NOT EXISTS update_user_investment_cache_timestamp 
AFTER UPDATE ON user_investment_cache
BEGIN
    UPDATE user_investment_cache SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

-- Rate limits trigger
CREATE TRIGGER IF NOT EXISTS update_rate_limits_timestamp 
AFTER UPDATE ON rate_limits
BEGIN
    UPDATE rate_limits SET updated_at = strftime('%s', 'now') * 1000 WHERE key = NEW.key;
END;

-- Insert some sample data for testing

-- Sample projects
INSERT OR IGNORE INTO project_cache (
    id, name, symbol, description, website, logo, category, tags,
    total_supply, circulating_supply, market_cap, price, change_24h, volume_24h,
    status, social_links, team, roadmap, created_at, updated_at
) VALUES 
(
    'proj_001', 'COM2000 Token', 'COM', 'Revolutionary blockchain platform for IDO launches',
    'https://com2000.org', 'https://assets.com2000.org/logos/com.png', 'DeFi',
    '["DeFi", "IDO", "Launchpad"]', 1000000000, 500000000, 50000000, 0.05, 5.2, 1000000,
    'active', '{"twitter": "@com2000org", "telegram": "@com2000"}',
    '[{"name": "John Doe", "role": "CEO"}]', '[{"phase": "Q1 2024", "title": "Platform Launch"}]',
    strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
),
(
    'proj_002', 'DeFi Protocol', 'DEFI', 'Next generation DeFi protocol',
    'https://defiprotocol.org', 'https://assets.com2000.org/logos/defi.png', 'DeFi',
    '["DeFi", "Protocol", "Yield"]', 500000000, 250000000, 25000000, 0.1, -2.1, 500000,
    'active', '{"twitter": "@defiprotocol"}',
    '[{"name": "Jane Smith", "role": "CTO"}]', '[{"phase": "Q2 2024", "title": "V2 Launch"}]',
    strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
);

-- Sample IDO pools
INSERT OR IGNORE INTO ido_pool_cache (
    id, project_id, name, symbol, total_tokens, token_price, min_investment, max_investment,
    soft_cap, hard_cap, start_time, end_time, vesting_schedule, status,
    total_raised, participant_count, created_at, updated_at
) VALUES 
(
    'ido_001', 'proj_001', 'COM2000 IDO', 'COM', 10000000, 0.05, 100, 10000,
    500000, 2000000, strftime('%s', 'now') * 1000, (strftime('%s', 'now') + 604800) * 1000,
    '[{"cliff": 30, "duration": 180, "percentage": 100}]', 'active',
    750000, 150, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
);

-- Sample price data
INSERT OR IGNORE INTO price_cache (
    symbol, price, price_usd, change_24h, volume_24h, market_cap, last_updated, source
) VALUES 
('COM', 0.05, 0.05, 5.2, 1000000, 50000000, strftime('%s', 'now') * 1000, 'coingecko'),
('DEFI', 0.1, 0.1, -2.1, 500000, 25000000, strftime('%s', 'now') * 1000, 'coingecko'),
('BTC', 45000, 45000, 2.5, 25000000000, 900000000000, strftime('%s', 'now') * 1000, 'coingecko'),
('ETH', 3000, 3000, 1.8, 15000000000, 360000000000, strftime('%s', 'now') * 1000, 'coingecko');

-- Sample analytics events
INSERT OR IGNORE INTO analytics_events (
    id, event_type, user_id, session_id, properties, ip_address, user_agent, timestamp
) VALUES 
(
    'evt_001', 'page_view', 'user_001', 'sess_001', '{"page": "/projects"}',
    '192.168.1.1', 'Mozilla/5.0', strftime('%s', 'now') * 1000
),
(
    'evt_002', 'project_view', 'user_001', 'sess_001', '{"project_id": "proj_001"}',
    '192.168.1.1', 'Mozilla/5.0', strftime('%s', 'now') * 1000
);

-- Sample system metrics
INSERT OR IGNORE INTO system_metrics (
    id, metric_name, metric_value, metric_type, labels, timestamp
) VALUES 
(
    'metric_001', 'requests_total', 1000, 'counter', '{"endpoint": "/api/v1/projects"}',
    strftime('%s', 'now') * 1000
),
(
    'metric_002', 'response_time_ms', 150, 'histogram', '{"endpoint": "/api/v1/projects"}',
    strftime('%s', 'now') * 1000
);

-- Create views for common queries

-- Active projects view
CREATE VIEW IF NOT EXISTS active_projects AS
SELECT * FROM project_cache WHERE status = 'active'
ORDER BY market_cap DESC;

-- Trending projects view
CREATE VIEW IF NOT EXISTS trending_projects AS
SELECT *, 
       (volume_24h * 0.4 + ABS(change_24h) * 0.3 + market_cap * 0.3) as trend_score
FROM project_cache 
WHERE status = 'active'
ORDER BY trend_score DESC;

-- Active IDO pools view
CREATE VIEW IF NOT EXISTS active_ido_pools AS
SELECT i.*, p.name as project_name, p.logo as project_logo
FROM ido_pool_cache i
JOIN project_cache p ON i.project_id = p.id
WHERE i.status = 'active'
ORDER BY i.end_time ASC;

-- Price movements view
CREATE VIEW IF NOT EXISTS price_movements AS
SELECT *, 
       CASE 
         WHEN change_24h > 0 THEN 'up'
         WHEN change_24h < 0 THEN 'down'
         ELSE 'stable'
       END as trend_direction,
       ABS(change_24h) as volatility
FROM price_cache
ORDER BY volatility DESC;

-- User investment summary view
CREATE VIEW IF NOT EXISTS user_investment_summary AS
SELECT 
    ui.user_id,
    COUNT(*) as total_investments,
    SUM(ui.amount) as total_invested,
    SUM(ui.token_amount) as total_tokens,
    COUNT(CASE WHEN ui.status = 'confirmed' THEN 1 END) as confirmed_investments,
    COUNT(CASE WHEN ui.status = 'pending' THEN 1 END) as pending_investments
FROM user_investment_cache ui
GROUP BY ui.user_id;

-- Migration completed successfully
INSERT OR IGNORE INTO system_metrics (
    id, metric_name, metric_value, metric_type, labels, timestamp
) VALUES (
    'migration_001', 'database_migration', 1, 'counter', 
    '{"migration": "0001_initial_schema", "status": "completed"}',
    strftime('%s', 'now') * 1000
);