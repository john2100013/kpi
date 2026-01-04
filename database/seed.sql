-- Seed data for development and testing
-- Updated to match multi-company database structure

-- Password hash for 'password123': $2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC

-- ============================================================================
-- STEP 1: Create Companies
-- ============================================================================
INSERT INTO companies (name, domain) VALUES
('ICT AFRICA', 'ict-africa.com'),
('ASL PACKAGING LTD', 'aslpackaging.com'),
('PLATINUM PACKAGING', 'platinum-packaging.com'),
('SAI OFFICE', 'saioffice.com'),
('CREATIVE EDGE LTD', 'creativeedge.com')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- STEP 2: Create Departments for Each Company
-- ============================================================================
-- ICT AFRICA Departments
INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Sales & Marketing', 'Sales and marketing operations'
FROM companies c WHERE c.name = 'ICT AFRICA'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Customer Success', 'Customer support and success management'
FROM companies c WHERE c.name = 'ICT AFRICA'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Engineering', 'Software development and technical operations'
FROM companies c WHERE c.name = 'ICT AFRICA'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'HR', 'Human resources and administration'
FROM companies c WHERE c.name = 'ICT AFRICA'
ON CONFLICT (company_id, name) DO NOTHING;

-- ASL PACKAGING LTD Departments
INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Production', 'Manufacturing and production operations'
FROM companies c WHERE c.name = 'ASL PACKAGING LTD'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Quality Control', 'Quality assurance and control'
FROM companies c WHERE c.name = 'ASL PACKAGING LTD'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Sales', 'Sales and business development'
FROM companies c WHERE c.name = 'ASL PACKAGING LTD'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'HR', 'Human resources and administration'
FROM companies c WHERE c.name = 'ASL PACKAGING LTD'
ON CONFLICT (company_id, name) DO NOTHING;

-- PLATINUM PACKAGING Departments
INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Operations', 'Day-to-day business operations'
FROM companies c WHERE c.name = 'PLATINUM PACKAGING'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Sales & Marketing', 'Sales and marketing operations'
FROM companies c WHERE c.name = 'PLATINUM PACKAGING'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'HR', 'Human resources and administration'
FROM companies c WHERE c.name = 'PLATINUM PACKAGING'
ON CONFLICT (company_id, name) DO NOTHING;

-- SAI OFFICE Departments
INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Administration', 'Administrative operations'
FROM companies c WHERE c.name = 'SAI OFFICE'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Sales', 'Sales operations'
FROM companies c WHERE c.name = 'SAI OFFICE'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'HR', 'Human resources and administration'
FROM companies c WHERE c.name = 'SAI OFFICE'
ON CONFLICT (company_id, name) DO NOTHING;

-- CREATIVE EDGE LTD Departments
INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Creative', 'Creative design and development'
FROM companies c WHERE c.name = 'CREATIVE EDGE LTD'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'Client Services', 'Client relationship management'
FROM companies c WHERE c.name = 'CREATIVE EDGE LTD'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO departments (company_id, name, description)
SELECT c.id, 'HR', 'Human resources and administration'
FROM companies c WHERE c.name = 'CREATIVE EDGE LTD'
ON CONFLICT (company_id, name) DO NOTHING;

-- ============================================================================
-- STEP 3: Create Users (Managers, HR, Employees)
-- ============================================================================

-- ICT AFRICA Users
INSERT INTO users (name, email, password_hash, role, payroll_number, national_id, company_id, department_id, position, employment_date, manager_id) VALUES
-- Managers
('John Manager', 'john.manager@ict-africa.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'manager', 'ICT-MGR-001', 'NAT-001', 
 (SELECT id FROM companies WHERE name = 'ICT AFRICA'),
 (SELECT id FROM departments WHERE name = 'Customer Success' AND company_id = (SELECT id FROM companies WHERE name = 'ICT AFRICA')),
 'Department Manager', '2020-01-15', NULL),
('Michael Anderson', 'michael.anderson@ict-africa.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'manager', 'ICT-MGR-002', 'NAT-002',
 (SELECT id FROM companies WHERE name = 'ICT AFRICA'),
 (SELECT id FROM departments WHERE name = 'Sales & Marketing' AND company_id = (SELECT id FROM companies WHERE name = 'ICT AFRICA')),
 'Senior Manager', '2019-03-20', NULL),
-- HR
('HR Admin', 'hr.admin@ict-africa.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'hr', 'ICT-HR-001', 'NAT-009',
 (SELECT id FROM companies WHERE name = 'ICT AFRICA'),
 (SELECT id FROM departments WHERE name = 'HR' AND company_id = (SELECT id FROM companies WHERE name = 'ICT AFRICA')),
 'HR Administrator', '2020-01-01', NULL),
-- Employees
('Sarah Mitchell', 'sarah.mitchell@ict-africa.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'employee', 'ICT-EMP-001', 'NAT-004',
 (SELECT id FROM companies WHERE name = 'ICT AFRICA'),
 (SELECT id FROM departments WHERE name = 'Customer Success' AND company_id = (SELECT id FROM companies WHERE name = 'ICT AFRICA')),
 'Customer Service Lead', '2021-06-10', 
 (SELECT id FROM users WHERE email = 'john.manager@ict-africa.com')),
('Sarah Williams', 'sarah.williams@ict-africa.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'employee', 'ICT-EMP-002', 'NAT-003',
 (SELECT id FROM companies WHERE name = 'ICT AFRICA'),
 (SELECT id FROM departments WHERE name = 'Sales & Marketing' AND company_id = (SELECT id FROM companies WHERE name = 'ICT AFRICA')),
 'Sales Executive', '2022-01-15',
 (SELECT id FROM users WHERE email = 'michael.anderson@ict-africa.com')),
('Michael Chen', 'michael.chen@ict-africa.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'employee', 'ICT-EMP-003', 'NAT-005',
 (SELECT id FROM companies WHERE name = 'ICT AFRICA'),
 (SELECT id FROM departments WHERE name = 'Sales & Marketing' AND company_id = (SELECT id FROM companies WHERE name = 'ICT AFRICA')),
 'Marketing Manager', '2021-08-20',
 (SELECT id FROM users WHERE email = 'michael.anderson@ict-africa.com')),
('David Martinez', 'david.martinez@ict-africa.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'employee', 'ICT-EMP-004', 'NAT-007',
 (SELECT id FROM companies WHERE name = 'ICT AFRICA'),
 (SELECT id FROM departments WHERE name = 'Engineering' AND company_id = (SELECT id FROM companies WHERE name = 'ICT AFRICA')),
 'Software Engineer', '2021-11-01',
 (SELECT id FROM users WHERE email = 'michael.anderson@ict-africa.com'))
ON CONFLICT (email) DO NOTHING;

-- ASL PACKAGING LTD Users
INSERT INTO users (name, email, password_hash, role, payroll_number, national_id, company_id, department_id, position, employment_date, manager_id) VALUES
-- Manager
('James Wilson', 'james.wilson@aslpackaging.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'manager', 'ASL-MGR-001', 'NAT-010',
 (SELECT id FROM companies WHERE name = 'ASL PACKAGING LTD'),
 (SELECT id FROM departments WHERE name = 'Production' AND company_id = (SELECT id FROM companies WHERE name = 'ASL PACKAGING LTD')),
 'Production Manager', '2019-05-10', NULL),
-- HR
('Patricia Brown', 'patricia.brown@aslpackaging.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'hr', 'ASL-HR-001', 'NAT-011',
 (SELECT id FROM companies WHERE name = 'ASL PACKAGING LTD'),
 (SELECT id FROM departments WHERE name = 'HR' AND company_id = (SELECT id FROM companies WHERE name = 'ASL PACKAGING LTD')),
 'HR Manager', '2020-02-01', NULL),
-- Employees
('Robert Taylor', NULL, NULL, 'employee', 'ASL-EMP-001', 'NAT-012',
 (SELECT id FROM companies WHERE name = 'ASL PACKAGING LTD'),
 (SELECT id FROM departments WHERE name = 'Production' AND company_id = (SELECT id FROM companies WHERE name = 'ASL PACKAGING LTD')),
 'Production Supervisor', '2022-03-15',
 (SELECT id FROM users WHERE email = 'james.wilson@aslpackaging.com')),
('Jennifer Davis', NULL, NULL, 'employee', 'ASL-EMP-002', 'NAT-013',
 (SELECT id FROM companies WHERE name = 'ASL PACKAGING LTD'),
 (SELECT id FROM departments WHERE name = 'Quality Control' AND company_id = (SELECT id FROM companies WHERE name = 'ASL PACKAGING LTD')),
 'Quality Inspector', '2022-06-20',
 (SELECT id FROM users WHERE email = 'james.wilson@aslpackaging.com'))
ON CONFLICT (payroll_number, company_id) DO NOTHING;

-- PLATINUM PACKAGING Users
INSERT INTO users (name, email, password_hash, role, payroll_number, national_id, company_id, department_id, position, employment_date, manager_id) VALUES
-- Manager
('William Johnson', 'william.johnson@platinum-packaging.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'manager', 'PLT-MGR-001', 'NAT-014',
 (SELECT id FROM companies WHERE name = 'PLATINUM PACKAGING'),
 (SELECT id FROM departments WHERE name = 'Operations' AND company_id = (SELECT id FROM companies WHERE name = 'PLATINUM PACKAGING')),
 'Operations Manager', '2020-08-15', NULL),
-- HR
('Mary Smith', 'mary.smith@platinum-packaging.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'hr', 'PLT-HR-001', 'NAT-015',
 (SELECT id FROM companies WHERE name = 'PLATINUM PACKAGING'),
 (SELECT id FROM departments WHERE name = 'HR' AND company_id = (SELECT id FROM companies WHERE name = 'PLATINUM PACKAGING')),
 'HR Administrator', '2021-01-10', NULL),
-- Employees
('Richard White', NULL, NULL, 'employee', 'PLT-EMP-001', 'NAT-016',
 (SELECT id FROM companies WHERE name = 'PLATINUM PACKAGING'),
 (SELECT id FROM departments WHERE name = 'Sales & Marketing' AND company_id = (SELECT id FROM companies WHERE name = 'PLATINUM PACKAGING')),
 'Sales Representative', '2022-09-01',
 (SELECT id FROM users WHERE email = 'william.johnson@platinum-packaging.com'))
ON CONFLICT (payroll_number, company_id) DO NOTHING;

-- SAI OFFICE Users
INSERT INTO users (name, email, password_hash, role, payroll_number, national_id, company_id, department_id, position, employment_date, manager_id) VALUES
-- Manager
('Elizabeth Garcia', 'elizabeth.garcia@saioffice.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'manager', 'SAI-MGR-001', 'NAT-017',
 (SELECT id FROM companies WHERE name = 'SAI OFFICE'),
 (SELECT id FROM departments WHERE name = 'Administration' AND company_id = (SELECT id FROM companies WHERE name = 'SAI OFFICE')),
 'Administration Manager', '2020-11-20', NULL),
-- HR
('Thomas Miller', 'thomas.miller@saioffice.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'hr', 'SAI-HR-001', 'NAT-018',
 (SELECT id FROM companies WHERE name = 'SAI OFFICE'),
 (SELECT id FROM departments WHERE name = 'HR' AND company_id = (SELECT id FROM companies WHERE name = 'SAI OFFICE')),
 'HR Manager', '2021-03-05', NULL),
-- Employees
('Susan Moore', NULL, NULL, 'employee', 'SAI-EMP-001', 'NAT-019',
 (SELECT id FROM companies WHERE name = 'SAI OFFICE'),
 (SELECT id FROM departments WHERE name = 'Sales' AND company_id = (SELECT id FROM companies WHERE name = 'SAI OFFICE')),
 'Sales Associate', '2023-01-15',
 (SELECT id FROM users WHERE email = 'elizabeth.garcia@saioffice.com'))
ON CONFLICT (payroll_number, company_id) DO NOTHING;

-- CREATIVE EDGE LTD Users
INSERT INTO users (name, email, password_hash, role, payroll_number, national_id, company_id, department_id, position, employment_date, manager_id) VALUES
-- Manager
('Christopher Lee', 'christopher.lee@creativeedge.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'manager', 'CRE-MGR-001', 'NAT-020',
 (SELECT id FROM companies WHERE name = 'CREATIVE EDGE LTD'),
 (SELECT id FROM departments WHERE name = 'Creative' AND company_id = (SELECT id FROM companies WHERE name = 'CREATIVE EDGE LTD')),
 'Creative Director', '2019-07-10', NULL),
-- HR
('Jessica Thompson', 'jessica.thompson@creativeedge.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'hr', 'CRE-HR-001', 'NAT-021',
 (SELECT id FROM companies WHERE name = 'CREATIVE EDGE LTD'),
 (SELECT id FROM departments WHERE name = 'HR' AND company_id = (SELECT id FROM companies WHERE name = 'CREATIVE EDGE LTD')),
 'HR Administrator', '2020-04-12', NULL),
-- Employees
('Daniel Harris', NULL, NULL, 'employee', 'CRE-EMP-001', 'NAT-022',
 (SELECT id FROM companies WHERE name = 'CREATIVE EDGE LTD'),
 (SELECT id FROM departments WHERE name = 'Creative' AND company_id = (SELECT id FROM companies WHERE name = 'CREATIVE EDGE LTD')),
 'Graphic Designer', '2022-05-20',
 (SELECT id FROM users WHERE email = 'christopher.lee@creativeedge.com'))
ON CONFLICT (payroll_number, company_id) DO NOTHING;

-- ============================================================================
-- STEP 4: Create User-Companies Associations
-- ============================================================================
-- Associate users with their companies (primary company)
INSERT INTO user_companies (user_id, company_id, is_primary)
SELECT u.id, u.company_id, true
FROM users u
WHERE u.company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Example: Add HR Admin from ICT AFRICA to ASL PACKAGING LTD (multi-company HR)
INSERT INTO user_companies (user_id, company_id, is_primary)
SELECT 
    (SELECT id FROM users WHERE email = 'hr.admin@ict-africa.com'),
    (SELECT id FROM companies WHERE name = 'ASL PACKAGING LTD'),
    false
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'hr.admin@ict-africa.com')
ON CONFLICT (user_id, company_id) DO NOTHING;

-- ============================================================================
-- STEP 5: Create Manager-Departments Associations
-- ============================================================================
-- ICT AFRICA: John Manager manages Customer Success
INSERT INTO manager_departments (manager_id, department_id, company_id)
SELECT 
    (SELECT id FROM users WHERE email = 'john.manager@ict-africa.com'),
    (SELECT id FROM departments WHERE name = 'Customer Success' AND company_id = (SELECT id FROM companies WHERE name = 'ICT AFRICA')),
    (SELECT id FROM companies WHERE name = 'ICT AFRICA')
ON CONFLICT (manager_id, department_id) DO NOTHING;

-- ICT AFRICA: Michael Anderson manages Sales & Marketing
INSERT INTO manager_departments (manager_id, department_id, company_id)
SELECT 
    (SELECT id FROM users WHERE email = 'michael.anderson@ict-africa.com'),
    (SELECT id FROM departments WHERE name = 'Sales & Marketing' AND company_id = (SELECT id FROM companies WHERE name = 'ICT AFRICA')),
    (SELECT id FROM companies WHERE name = 'ICT AFRICA')
ON CONFLICT (manager_id, department_id) DO NOTHING;

-- ASL PACKAGING: James Wilson manages Production
INSERT INTO manager_departments (manager_id, department_id, company_id)
SELECT 
    (SELECT id FROM users WHERE email = 'james.wilson@aslpackaging.com'),
    (SELECT id FROM departments WHERE name = 'Production' AND company_id = (SELECT id FROM companies WHERE name = 'ASL PACKAGING LTD')),
    (SELECT id FROM companies WHERE name = 'ASL PACKAGING LTD')
ON CONFLICT (manager_id, department_id) DO NOTHING;

-- PLATINUM PACKAGING: William Johnson manages Operations
INSERT INTO manager_departments (manager_id, department_id, company_id)
SELECT 
    (SELECT id FROM users WHERE email = 'william.johnson@platinum-packaging.com'),
    (SELECT id FROM departments WHERE name = 'Operations' AND company_id = (SELECT id FROM companies WHERE name = 'PLATINUM PACKAGING')),
    (SELECT id FROM companies WHERE name = 'PLATINUM PACKAGING')
ON CONFLICT (manager_id, department_id) DO NOTHING;

-- SAI OFFICE: Elizabeth Garcia manages Administration
INSERT INTO manager_departments (manager_id, department_id, company_id)
SELECT 
    (SELECT id FROM users WHERE email = 'elizabeth.garcia@saioffice.com'),
    (SELECT id FROM departments WHERE name = 'Administration' AND company_id = (SELECT id FROM companies WHERE name = 'SAI OFFICE')),
    (SELECT id FROM companies WHERE name = 'SAI OFFICE')
ON CONFLICT (manager_id, department_id) DO NOTHING;

-- CREATIVE EDGE: Christopher Lee manages Creative
INSERT INTO manager_departments (manager_id, department_id, company_id)
SELECT 
    (SELECT id FROM users WHERE email = 'christopher.lee@creativeedge.com'),
    (SELECT id FROM departments WHERE name = 'Creative' AND company_id = (SELECT id FROM companies WHERE name = 'CREATIVE EDGE LTD')),
    (SELECT id FROM companies WHERE name = 'CREATIVE EDGE LTD')
ON CONFLICT (manager_id, department_id) DO NOTHING;

-- ============================================================================
-- STEP 6: Create KPIs (with KPI Items)
-- ============================================================================

-- ICT AFRICA: KPI for Sarah Mitchell (Customer Success)
DO $$
DECLARE
    kpi_id_var INTEGER;
    employee_id_var INTEGER;
    manager_id_var INTEGER;
BEGIN
    -- Get IDs
    SELECT id INTO employee_id_var FROM users WHERE email = 'sarah.mitchell@ict-africa.com';
    SELECT id INTO manager_id_var FROM users WHERE email = 'john.manager@ict-africa.com';
    
    -- Insert KPI
    INSERT INTO kpis (employee_id, manager_id, period, quarter, year, status, meeting_date)
    VALUES (employee_id_var, manager_id_var, 'quarterly', 'Q1', 2026, 'acknowledged', '2026-01-15')
    ON CONFLICT DO NOTHING
    RETURNING id INTO kpi_id_var;
    
    -- If KPI was inserted, get its ID
    IF kpi_id_var IS NULL THEN
        SELECT id INTO kpi_id_var FROM kpis WHERE employee_id = employee_id_var AND quarter = 'Q1' AND year = 2026 LIMIT 1;
    END IF;
    
    -- Insert KPI Items
    IF kpi_id_var IS NOT NULL THEN
        INSERT INTO kpi_items (kpi_id, title, description, target_value, measure_unit, goal_weight, current_performance_status, expected_completion_date, item_order)
        VALUES
        (kpi_id_var, 'Customer Service Excellence', 'Improve customer satisfaction by resolving customer issues within agreed timelines', '95', 'Percentage', '40%', 'On Track', '2026-03-31', 1),
        (kpi_id_var, 'Task Completion', 'Complete assigned work tasks within defined deadlines', '90', 'Percentage', '30%', 'On Track', '2026-03-31', 2),
        (kpi_id_var, 'Attendance & Punctuality', 'Maintain consistent attendance and punctuality throughout the quarter', '100', 'Percentage', '30%', 'Exceeding', '2026-03-31', 3)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ICT AFRICA: KPI for Sarah Williams (Sales & Marketing)
DO $$
DECLARE
    kpi_id_var INTEGER;
    employee_id_var INTEGER;
    manager_id_var INTEGER;
BEGIN
    -- Get IDs
    SELECT id INTO employee_id_var FROM users WHERE email = 'sarah.williams@ict-africa.com';
    SELECT id INTO manager_id_var FROM users WHERE email = 'michael.anderson@ict-africa.com';
    
    -- Insert KPI
    INSERT INTO kpis (employee_id, manager_id, period, quarter, year, status, meeting_date)
    VALUES (employee_id_var, manager_id_var, 'quarterly', 'Q1', 2026, 'acknowledged', '2026-01-15')
    ON CONFLICT DO NOTHING
    RETURNING id INTO kpi_id_var;
    
    -- If KPI was inserted, get its ID
    IF kpi_id_var IS NULL THEN
        SELECT id INTO kpi_id_var FROM kpis WHERE employee_id = employee_id_var AND quarter = 'Q1' AND year = 2026 LIMIT 1;
    END IF;
    
    -- Insert KPI Items
    IF kpi_id_var IS NOT NULL THEN
        INSERT INTO kpi_items (kpi_id, title, description, target_value, measure_unit, goal_weight, current_performance_status, expected_completion_date, item_order)
        VALUES
        (kpi_id_var, 'Sales Target Achievement', 'Achieve monthly sales targets consistently', '100', 'Percentage', '50%', 'On Track', '2026-03-31', 1),
        (kpi_id_var, 'Client Relationship Management', 'Maintain and strengthen relationships with key clients', '85', 'Percentage', '50%', 'On Track', '2026-03-31', 2)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- STEP 7: Create KPI Reviews (with new rating system: 1.00, 1.25, 1.50)
-- ============================================================================

-- Review for Sarah Mitchell - Q1 2026
DO $$
DECLARE
    kpi_id_var INTEGER;
    employee_id_var INTEGER;
    manager_id_var INTEGER;
BEGIN
    -- Get IDs
    SELECT id INTO employee_id_var FROM users WHERE email = 'sarah.mitchell@ict-africa.com';
    SELECT id INTO manager_id_var FROM users WHERE email = 'john.manager@ict-africa.com';
    SELECT id INTO kpi_id_var FROM kpis WHERE employee_id = employee_id_var AND quarter = 'Q1' AND year = 2026 LIMIT 1;
    
    -- Insert review if KPI exists
    IF kpi_id_var IS NOT NULL THEN
        INSERT INTO kpi_reviews (
            kpi_id, employee_id, manager_id, review_period, review_quarter, review_year,
            employee_rating, employee_comment, manager_rating, manager_comment,
            employee_self_rating_signature, employee_self_rating_signed_at,
            manager_review_signature, manager_review_signed_at,
            review_status
        )
        VALUES (
            kpi_id_var,
            employee_id_var,
            manager_id_var,
            'quarterly', 'Q1', 2026,
            1.25, -- Meets Expectation
            '{"items":[{"item_id":1,"rating":1.25,"comment":"I consistently met resolution timelines and received positive customer feedback throughout Q1."},{"item_id":2,"rating":1.25,"comment":"Most tasks were completed on time."},{"item_id":3,"rating":1.50,"comment":"Perfect attendance record throughout Q1."}],"average_rating":1.33,"rounded_rating":1.25}',
            1.25, -- Meets Expectation
            '{"items":[{"item_id":1,"rating":1.25,"comment":"Good resolution, timely response"},{"item_id":2,"rating":1.25,"comment":"Tasks completed on time"},{"item_id":3,"rating":1.50,"comment":"Excellent attendance"}],"average_rating":1.33,"rounded_rating":1.25}',
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            '2026-01-20 10:00:00',
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            '2026-01-25 14:30:00',
            'manager_submitted'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
