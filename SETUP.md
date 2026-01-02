# Backend Setup Guide

## Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up PostgreSQL Database

#### Create Database
```bash
psql -U postgres
CREATE DATABASE kpi_management;
\q
```

#### Run Schema
```bash
psql -U postgres -d kpi_management -f database/schema.sql
```

#### Generate Password Hashes (Optional)
```bash
node scripts/generatePasswordHash.js
```

Copy the generated hash and update `database/seed.sql` with it.

#### Seed Database (Optional)
```bash
psql -U postgres -d kpi_management -f database/seed.sql
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kpi_management
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=5000
NODE_ENV=development

# Email Configuration (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@kpimanager.com

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173
```

### 4. Start the Server

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000`

## Testing the API

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Login (Example)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "payrollNumber": "MGR-2024-0089",
    "nationalId": "NAT-001"
  }'
```

## Notes

- For email notifications to work, configure your email service credentials in `.env`
- The scheduler service runs automatically and sends reminders based on KPI meeting dates and review due dates
- PDF generation requires the `uploads/pdfs` directory to exist (created automatically on first use)

