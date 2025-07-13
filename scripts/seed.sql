-- COM2000 Platform Database Seed Data
-- This file contains sample data for development and testing

-- Clear existing data (be careful in production!)
DELETE FROM user_investment_cache;
DELETE FROM ido_pool_cache;
DELETE FROM project_cache;
DELETE FROM price_cache;
DELETE FROM analytics_events;
DELETE FROM system_metrics;
DELETE FROM error_logs;
DELETE FROM rate_limits;
DELETE FROM cache_metadata;

-- Insert sample projects
INSERT INTO project_cache (
    id, name, symbol, description, website, whitepaper, logo, banner, category, tags,
    total_supply, circulating_supply, market_cap, price, change_24h, volume_24h,
    status, social_links, team, roadmap, created_at, updated_at
) VALUES 
(
    'proj_com2000', 'COM2000 Platform', 'COM', 
    'Revolutionary blockchain platform for IDO launches and decentralized project funding. COM2000 provides a comprehensive ecosystem for project discovery, investment, and community building.',
    'https://com2000.org', 'https://docs.com2000.org/whitepaper.pdf',
    'https://assets.com2000.org/logos/com2000.png', 'https://assets.com2000.org/banners/com2000.jpg',
    'Launchpad', '["DeFi", "IDO", "Launchpad", "Platform"]',
    1000000000, 500000000, 50000000, 0.05, 5.2, 1000000,
    'active', 
    '{"twitter": "@com2000org", "telegram": "@com2000platform", "discord": "https://discord.gg/com2000", "medium": "@com2000"}',
    '[{"name": "Alex Chen", "role": "CEO", "avatar": "https://assets.com2000.org/team/alex.jpg"}, {"name": "Sarah Johnson", "role": "CTO", "avatar": "https://assets.com2000.org/team/sarah.jpg"}]',
    '[{"phase": "Q1 2024", "title": "Platform Launch", "status": "completed"}, {"phase": "Q2 2024", "title": "Mobile App", "status": "in_progress"}]',
    strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
),
(
    'proj_defiswap', 'DeFiSwap Protocol', 'DEFI', 
    'Next generation automated market maker with advanced yield farming capabilities and cross-chain support.',
    'https://defiswap.org', 'https://docs.defiswap.org/whitepaper.pdf',
    'https://assets.com2000.org/logos/defiswap.png', 'https://assets.com2000.org/banners/defiswap.jpg',
    'DeFi', '["DeFi", "AMM", "Yield Farming", "Cross-chain"]',
    500000000, 250000000, 25000000, 0.1, -2.1, 500000,
    'active',
    '{"twitter": "@defiswap", "telegram": "@defiswapprotocol"}',
    '[{"name": "Michael Rodriguez", "role": "Founder", "avatar": "https://assets.com2000.org/team/michael.jpg"}]',
    '[{"phase": "Q2 2024", "title": "V2 Launch", "status": "upcoming"}]',
    strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
),
(
    'proj_nftmarket', 'NFT Marketplace', 'NFT', 
    'Decentralized NFT marketplace with creator royalties and community governance.',
    'https://nftmarket.org', 'https://docs.nftmarket.org/whitepaper.pdf',
    'https://assets.com2000.org/logos/nftmarket.png', 'https://assets.com2000.org/banners/nftmarket.jpg',
    'NFT', '["NFT", "Marketplace", "Art", "Gaming"]',
    100000000, 60000000, 12000000, 0.2, 8.5, 300000,
    'active',
    '{"twitter": "@nftmarketplace", "discord": "https://discord.gg/nftmarket"}',
    '[{"name": "Emma Wilson", "role": "CEO", "avatar": "https://assets.com2000.org/team/emma.jpg"}]',
    '[{"phase": "Q3 2024", "title": "Gaming Integration", "status": "upcoming"}]',
    strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
),
(
    'proj_gamefi', 'GameFi Universe', 'GAME', 
    'Play-to-earn gaming ecosystem with NFT integration and metaverse capabilities.',
    'https://gamefi.universe', 'https://docs.gamefi.universe/whitepaper.pdf',
    'https://assets.com2000.org/logos/gamefi.png', 'https://assets.com2000.org/banners/gamefi.jpg',
    'Gaming', '["GameFi", "P2E", "Metaverse", "NFT"]',
    2000000000, 800000000, 40000000, 0.05, 12.3, 800000,
    'active',
    '{"twitter": "@gamefiuniverse", "telegram": "@gameficommunity"}',
    '[{"name": "David Kim", "role": "Game Director", "avatar": "https://assets.com2000.org/team/david.jpg"}]',
    '[{"phase": "Q4 2024", "title": "Beta Launch", "status": "upcoming"}]',
    strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
),
(
    'proj_metaverse', 'MetaVerse Land', 'META', 
    'Virtual real estate platform with social features and economic opportunities.',
    'https://metaverse.land', 'https://docs.metaverse.land/whitepaper.pdf',
    'https://assets.com2000.org/logos/metaverse.png', 'https://assets.com2000.org/banners/metaverse.jpg',
    'Metaverse', '["Metaverse", "VR", "Real Estate", "Social"]',
    1500000000, 600000000, 30000000, 0.05, -1.8, 600000,
    'upcoming',
    '{"twitter": "@metaverseland", "discord": "https://discord.gg/metaverse"}',
    '[{"name": "Lisa Zhang", "role": "CEO", "avatar": "https://assets.com2000.org/team/lisa.jpg"}]',
    '[{"phase": "Q1 2025", "title": "Alpha Release", "status": "upcoming"}]',
    strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
);

-- Insert sample IDO pools
INSERT INTO ido_pool_cache (
    id, project_id, name, symbol, total_tokens, token_price, min_investment, max_investment,
    soft_cap, hard_cap, start_time, end_time, vesting_schedule, status,
    total_raised, participant_count, created_at, updated_at
) VALUES 
(
    'ido_com2000_001', 'proj_com2000', 'COM2000 Platform IDO', 'COM', 
    10000000, 0.05, 100, 10000, 500000, 2000000,
    strftime('%s', 'now') * 1000, (strftime('%s', 'now') + 604800) * 1000,
    '[{"cliff": 30, "duration": 180, "percentage": 25}, {"cliff": 90, "duration": 270, "percentage": 75}]',
    'active', 750000, 150,
    strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
),
(
    'ido_defiswap_001', 'proj_defiswap', 'DeFiSwap Protocol IDO', 'DEFI',
    5000000, 0.1, 50, 5000, 250000, 1000000,
    (strftime('%s', 'now') + 86400) * 1000, (strftime('%s', 'now') + 691200) * 1000,
    '[{"cliff": 0, "duration": 365, "percentage": 100}]',
    'upcoming', 0, 0,
    strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
),
(
    'ido_nftmarket_001', 'proj_nftmarket', 'NFT Marketplace IDO', 'NFT',
    2000000, 0.2, 200, 20000, 400000, 1600000,
    (strftime('%s', 'now') + 172800) * 1000, (strftime('%s', 'now') + 777600) * 1000,
    '[{"cliff": 60, "duration": 240, "percentage": 50}, {"cliff": 120, "duration": 360, "percentage": 50}]',
    'upcoming', 0, 0,
    strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
);

-- Insert sample user investments
INSERT INTO user_investment_cache (
    id, user_id, ido_pool_id, amount, token_amount, transaction_hash, status, created_at, updated_at
) VALUES 
('inv_001', 'user_001', 'ido_com2000_001', 1000, 20000, '0x1234567890abcdef', 'confirmed', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('inv_002', 'user_002', 'ido_com2000_001', 500, 10000, '0xabcdef1234567890', 'confirmed', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('inv_003', 'user_003', 'ido_com2000_001', 2000, 40000, '0x567890abcdef1234', 'pending', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Insert comprehensive price data
INSERT INTO price_cache (
    symbol, price, price_usd, change_24h, volume_24h, market_cap, last_updated, source
) VALUES 
('COM', 0.05, 0.05, 5.2, 1000000, 50000000, strftime('%s', 'now') * 1000, 'coingecko'),
('DEFI', 0.1, 0.1, -2.1, 500000, 25000000, strftime('%s', 'now') * 1000, 'coingecko'),
('NFT', 0.2, 0.2, 8.5, 300000, 12000000, strftime('%s', 'now') * 1000, 'coingecko'),
('GAME', 0.05, 0.05, 12.3, 800000, 40000000, strftime('%s', 'now') * 1000, 'coingecko'),
('META', 0.05, 0.05, -1.8, 600000, 30000000, strftime('%s', 'now') * 1000, 'coingecko'),
('BTC', 45000, 45000, 2.5, 25000000000, 900000000000, strftime('%s', 'now') * 1000, 'coingecko'),
('ETH', 3000, 3000, 1.8, 15000000000, 360000000000, strftime('%s', 'now') * 1000, 'coingecko'),
('BNB', 300, 300, 0.5, 1000000000, 45000000000, strftime('%s', 'now') * 1000, 'coingecko'),
('ADA', 0.5, 0.5, 3.2, 500000000, 18000000000, strftime('%s', 'now') * 1000, 'coingecko'),
('SOL', 100, 100, 4.1, 2000000000, 45000000000, strftime('%s', 'now') * 1000, 'coingecko');

-- Insert sample analytics events
INSERT INTO analytics_events (
    id, event_type, user_id, session_id, properties, ip_address, user_agent, timestamp
) VALUES 
('evt_001', 'page_view', 'user_001', 'sess_001', '{"page": "/projects", "referrer": "https://google.com"}', '192.168.1.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', strftime('%s', 'now') * 1000),
('evt_002', 'project_view', 'user_001', 'sess_001', '{"project_id": "proj_com2000", "duration": 45}', '192.168.1.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', strftime('%s', 'now') * 1000),
('evt_003', 'ido_investment', 'user_001', 'sess_001', '{"ido_id": "ido_com2000_001", "amount": 1000}', '192.168.1.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', strftime('%s', 'now') * 1000),
('evt_004', 'user_registration', 'user_002', 'sess_002', '{"method": "email", "referral_code": "REF123"}', '192.168.1.2', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', strftime('%s', 'now') * 1000),
('evt_005', 'search', 'user_003', 'sess_003', '{"query": "defi projects", "results_count": 15}', '192.168.1.3', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', strftime('%s', 'now') * 1000);

-- Insert sample system metrics
INSERT INTO system_metrics (
    id, metric_name, metric_value, metric_type, labels, timestamp
) VALUES 
('metric_001', 'requests_total', 1000, 'counter', '{"endpoint": "/api/v1/projects", "method": "GET", "status": "200"}', strftime('%s', 'now') * 1000),
('metric_002', 'response_time_ms', 150, 'histogram', '{"endpoint": "/api/v1/projects", "method": "GET"}', strftime('%s', 'now') * 1000),
('metric_003', 'active_users', 250, 'gauge', '{"timeframe": "24h"}', strftime('%s', 'now') * 1000),
('metric_004', 'database_connections', 15, 'gauge', '{"pool": "main"}', strftime('%s', 'now') * 1000),
('metric_005', 'cache_hit_rate', 0.85, 'gauge', '{"cache_type": "project_cache"}', strftime('%s', 'now') * 1000),
('metric_006', 'error_rate', 0.02, 'gauge', '{"timeframe": "1h"}', strftime('%s', 'now') * 1000);

-- Insert sample cache metadata
INSERT INTO cache_metadata (
    cache_key, ttl, created_at, last_accessed, hit_count, data_size
) VALUES 
('projects:trending', 900, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000, 45, 2048),
('prices:all', 300, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000, 120, 1024),
('ido:active', 600, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000, 30, 4096),
('user:user_001:profile', 3600, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000, 5, 512);

-- Insert sample rate limit data
INSERT INTO rate_limits (
    key, count, window_start, reset_time, created_at, updated_at
) VALUES 
('ip:192.168.1.1:/api/v1/projects', 25, strftime('%s', 'now') * 1000, (strftime('%s', 'now') + 900) * 1000, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('user:user_001:/api/v1/ido/invest', 3, strftime('%s', 'now') * 1000, (strftime('%s', 'now') + 3600) * 1000, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Insert sample error logs
INSERT INTO error_logs (
    id, error_type, error_message, stack_trace, request_id, user_id, endpoint, method, ip_address, user_agent, timestamp
) VALUES 
('err_001', 'ValidationError', 'Invalid email format', 'ValidationError: Invalid email format\n    at validateEmail (utils/validation.ts:15)', 'req_12345', 'user_001', '/api/v1/auth/register', 'POST', '192.168.1.1', 'Mozilla/5.0', strftime('%s', 'now') * 1000),
('err_002', 'DatabaseError', 'Connection timeout', 'DatabaseError: Connection timeout\n    at Database.query (utils/database.ts:45)', 'req_12346', NULL, '/api/v1/projects', 'GET', '192.168.1.2', 'Mozilla/5.0', strftime('%s', 'now') * 1000);

-- Update statistics
INSERT INTO system_metrics (
    id, metric_name, metric_value, metric_type, labels, timestamp
) VALUES (
    'seed_complete', 'database_seed', 1, 'counter', 
    '{"seed_file": "seed.sql", "status": "completed", "records_inserted": 50}',
    strftime('%s', 'now') * 1000
);

-- Verify data insertion
SELECT 'Projects inserted: ' || COUNT(*) FROM project_cache;
SELECT 'IDO pools inserted: ' || COUNT(*) FROM ido_pool_cache;
SELECT 'Investments inserted: ' || COUNT(*) FROM user_investment_cache;
SELECT 'Prices inserted: ' || COUNT(*) FROM price_cache;
SELECT 'Analytics events inserted: ' || COUNT(*) FROM analytics_events;
SELECT 'System metrics inserted: ' || COUNT(*) FROM system_metrics;