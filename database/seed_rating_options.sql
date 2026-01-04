-- Seed default rating options for all companies
-- Rating scale: 1.00 (Below Expectation), 1.25 (Meets Expectation), 1.50 (Exceeds Expectation)

-- Insert rating options for each company
INSERT INTO rating_options (company_id, rating_value, label, description, is_active, display_order)
SELECT 
    c.id as company_id,
    1.00 as rating_value,
    'Below Expectation' as label,
    'Performance is below the expected standard' as description,
    true as is_active,
    1 as display_order
FROM companies c
ON CONFLICT (company_id, rating_value) DO NOTHING;

INSERT INTO rating_options (company_id, rating_value, label, description, is_active, display_order)
SELECT 
    c.id as company_id,
    1.25 as rating_value,
    'Meets Expectation' as label,
    'Performance meets the expected standard' as description,
    true as is_active,
    2 as display_order
FROM companies c
ON CONFLICT (company_id, rating_value) DO NOTHING;

INSERT INTO rating_options (company_id, rating_value, label, description, is_active, display_order)
SELECT 
    c.id as company_id,
    1.50 as rating_value,
    'Exceeds Expectation' as label,
    'Performance exceeds the expected standard' as description,
    true as is_active,
    3 as display_order
FROM companies c
ON CONFLICT (company_id, rating_value) DO NOTHING;

