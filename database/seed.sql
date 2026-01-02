-- Seed data for development and testing

-- Insert sample users (password is 'password123' hashed with bcrypt)
-- Proper bcrypt hash for 'password123': $2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC
INSERT INTO users (name, email, password_hash, role, payroll_number, national_id, department, position, employment_date, manager_id) VALUES
('John Manager', 'john.manager@company.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'manager', 'MGR-2024-0089', 'NAT-001', 'Customer Success', 'Department Manager', '2020-01-15', NULL),
('Michael Anderson', 'michael.anderson@company.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'manager', 'MGR-2024-0090', 'NAT-002', 'Sales & Marketing', 'Senior Manager', '2019-03-20', NULL),
('Sarah Williams', 'sarah.williams@company.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'employee', 'EMP-2024-0145', 'NAT-003', 'Sales & Marketing', 'Sales Executive', '2022-01-15', 2),
('Sarah Mitchell', 'sarah.mitchell@company.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'employee', 'EMP-2024-1547', 'NAT-004', 'Customer Success', 'Customer Service Lead', '2021-06-10', 1),
('Michael Chen', 'michael.chen@company.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'employee', 'EMP-2024-0150', 'NAT-005', 'Sales & Marketing', 'Marketing Manager', '2021-08-20', 2),
('Emily Johnson', 'emily.johnson@company.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'employee', 'EMP-2024-0151', 'NAT-006', 'Product', 'Product Designer', '2022-03-15', 2),
('David Martinez', 'david.martinez@company.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'employee', 'EMP-2024-0152', 'NAT-007', 'Engineering', 'Software Engineer', '2021-11-01', 2),
('Lisa Anderson', 'lisa.anderson@company.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'employee', 'EMP-2024-0153', 'NAT-008', 'HR', 'HR Specialist', '2022-05-10', 2),
('HR Admin', 'hr.admin@company.com', '$2a$10$8Pio3SlGOHzEDRyBUyYE2OkFn7P/iJG9R69UUVxv7wHvZyrfOYjmC', 'hr', 'HR-2024-0001', 'NAT-009', 'HR', 'HR Administrator', '2020-01-01', NULL)
ON CONFLICT (email) DO NOTHING;

-- Insert sample KPIs
INSERT INTO kpis (employee_id, manager_id, title, description, target_value, measure_unit, measure_criteria, period, quarter, year, status, meeting_date) VALUES
(3, 2, 'Customer Service', 'Improve customer satisfaction by resolving customer issues within agreed timelines', '95', 'Percentage', 'Resolution within SLA', 'quarterly', 'Q1', 2024, 'acknowledged', '2024-01-15'),
(3, 2, 'Task Completion', 'Complete assigned work tasks within defined deadlines', '90', 'Percentage', 'On-time completion', 'quarterly', 'Q1', 2024, 'acknowledged', '2024-01-15'),
(3, 2, 'Attendance & Punctuality', 'Maintain consistent attendance and punctuality throughout the quarter', '100', 'Percentage', 'No absences', 'quarterly', 'Q1', 2024, 'completed', '2024-01-15'),
(4, 1, 'Customer Service', 'Improve customer satisfaction by resolving customer issues within agreed timelines', '95', 'Percentage', 'Resolution within SLA', 'quarterly', 'Q4', 2024, 'acknowledged', '2024-10-15'),
(4, 1, 'Task Completion', 'Complete assigned work tasks within defined deadlines', '90', 'Percentage', 'On-time completion', 'quarterly', 'Q4', 2024, 'acknowledged', '2024-10-15'),
(4, 1, 'Attendance & Punctuality', 'Maintain consistent attendance and punctuality throughout the quarter', '100', 'Percentage', 'No absences', 'quarterly', 'Q4', 2024, 'acknowledged', '2024-10-15')
ON CONFLICT DO NOTHING;

-- Insert sample KPI Reviews
INSERT INTO kpi_reviews (kpi_id, employee_id, manager_id, review_period, review_quarter, review_year, employee_rating, employee_comment, manager_rating, manager_comment, review_status) VALUES
(4, 4, 1, 'quarterly', 'Q4', 2024, 4.0, 'I consistently met resolution timelines and received positive customer feedback throughout Q4.', 4.0, 'Good resolution, timely response', 'manager_submitted'),
(5, 4, 1, 'quarterly', 'Q4', 2024, 3.0, 'Most tasks were completed on time, though a few complex cases required extensions.', 3.0, 'Needs improvement on meeting some deadlines', 'manager_submitted'),
(6, 4, 1, 'quarterly', 'Q4', 2024, 5.0, 'Perfect attendance record throughout Q4. Always punctual and reliable.', 5.0, 'Excellent attendance', 'manager_submitted')
ON CONFLICT DO NOTHING;

