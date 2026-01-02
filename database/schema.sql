-- KPI Management System Database Schema

-- Users table (Employees, Managers, HR)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('employee', 'manager', 'hr')),
    payroll_number VARCHAR(100) UNIQUE NOT NULL,
    national_id VARCHAR(100) UNIQUE,
    department VARCHAR(255),
    position VARCHAR(255),
    employment_date DATE,
    manager_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KPIs table
CREATE TABLE IF NOT EXISTS kpis (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    target_value VARCHAR(255),
    measure_unit VARCHAR(100),
    measure_criteria TEXT,
    period VARCHAR(50) NOT NULL CHECK (period IN ('quarterly', 'yearly')),
    quarter VARCHAR(20),
    year INTEGER,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed', 'overdue')),
    meeting_date DATE,
    manager_signature TEXT,
    manager_signed_at TIMESTAMP,
    employee_signature TEXT,
    employee_signed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KPI Reviews table
CREATE TABLE IF NOT EXISTS kpi_reviews (
    id SERIAL PRIMARY KEY,
    kpi_id INTEGER NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_period VARCHAR(50) NOT NULL,
    review_quarter VARCHAR(20),
    review_year INTEGER,
    employee_rating DECIMAL(3,1) CHECK (employee_rating >= 1 AND employee_rating <= 5),
    employee_comment TEXT,
    employee_signature TEXT,
    employee_signed_at TIMESTAMP,
    manager_rating DECIMAL(3,1) CHECK (manager_rating >= 1 AND manager_rating <= 5),
    manager_comment TEXT,
    manager_signature TEXT,
    manager_signed_at TIMESTAMP,
    overall_manager_comment TEXT,
    review_status VARCHAR(50) DEFAULT 'pending' CHECK (review_status IN ('pending', 'employee_submitted', 'manager_submitted', 'hr_reviewed', 'completed')),
    pdf_generated BOOLEAN DEFAULT FALSE,
    pdf_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    related_kpi_id INTEGER REFERENCES kpis(id) ON DELETE SET NULL,
    related_review_id INTEGER REFERENCES kpi_reviews(id) ON DELETE SET NULL,
    read BOOLEAN DEFAULT FALSE,
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KPI Setting Reminders table
CREATE TABLE IF NOT EXISTS kpi_setting_reminders (
    id SERIAL PRIMARY KEY,
    kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meeting_date DATE NOT NULL,
    reminder_type VARCHAR(50) NOT NULL CHECK (reminder_type IN ('2_weeks', '1_week', '3_days', '2_days', '1_day', 'meeting_day')),
    sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KPI Review Reminders table
CREATE TABLE IF NOT EXISTS kpi_review_reminders (
    id SERIAL PRIMARY KEY,
    review_id INTEGER REFERENCES kpi_reviews(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    reminder_type VARCHAR(50) NOT NULL CHECK (reminder_type IN ('quarterly_3_months', 'yearly_end')),
    sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_payroll ON users(payroll_number);
CREATE INDEX IF NOT EXISTS idx_kpis_employee ON kpis(employee_id);
CREATE INDEX IF NOT EXISTS idx_kpis_manager ON kpis(manager_id);
CREATE INDEX IF NOT EXISTS idx_kpis_status ON kpis(status);
CREATE INDEX IF NOT EXISTS idx_kpi_reviews_kpi ON kpi_reviews(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_reviews_employee ON kpi_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

