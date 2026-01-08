# KPI Templates Feature - Deployment Guide

## Overview
This feature allows managers to create reusable KPI templates that can be quickly applied to multiple employees at once. Each employee receives their own individual KPI form with notifications, and all existing functionality continues to work normally.

## What's New
- **KPI Templates Management**: Managers can create, edit, delete, and use KPI templates
- **Batch KPI Assignment**: Apply a template to multiple employees in one action
- **Template Library**: Store and organize reusable KPI templates by period type
- **Individual KPI Forms**: Each employee gets their own KPI form (not shared)
- **Full Notifications**: All employees receive notifications and emails as normal
- **Digital Signatures**: Manager signs once, applied to all KPIs created from template

## Files Added/Modified

### Backend Files

#### New Files:
1. **`c:\kpi\backend\kpi\database\migration_kpi_templates.sql`**
   - Creates `kpi_templates` table
   - Creates `kpi_template_items` table
   - Adds necessary indexes

2. **`c:\kpi\backend\kpi\routes\kpiTemplates.js`**
   - GET `/api/kpi-templates` - List all templates for manager
   - GET `/api/kpi-templates/:id` - Get template with items
   - POST `/api/kpi-templates` - Create new template
   - PUT `/api/kpi-templates/:id` - Update template
   - DELETE `/api/kpi-templates/:id` - Delete template
   - POST `/api/kpi-templates/:id/apply` - Apply template to multiple employees

#### Modified Files:
1. **`c:\kpi\backend\kpi\server.js`** (Line ~69)
   - Added route: `app.use('/api/kpi-templates', require('./routes/kpiTemplates'));`

### Frontend Files

#### New Files:
1. **`c:\kpi\fronted\kpi-frontend\src\pages\manager\KPITemplates.tsx`**
   - Template list view
   - Create/Edit/Delete/Use template buttons

2. **`c:\kpi\fronted\kpi-frontend\src\pages\manager\KPITemplateForm.tsx`**
   - Template creation and editing form
   - Supports multiple KPI items per template
   - Period type selection (quarterly/annual)

3. **`c:\kpi\fronted\kpi-frontend\src\pages\manager\ApplyKPITemplate.tsx`**
   - Employee selection interface (multi-select with checkboxes)
   - Template preview
   - Period/meeting date/signature fields
   - Batch KPI creation

#### Modified Files:
1. **`c:\kpi\fronted\kpi-frontend\src\App.tsx`**
   - Added imports for 3 new components
   - Added 4 new routes:
     - `/manager/kpi-templates` - List templates
     - `/manager/kpi-templates/create` - Create template
     - `/manager/kpi-templates/:id/edit` - Edit template
     - `/manager/kpi-templates/:id/apply` - Apply template

2. **`c:\kpi\fronted\kpi-frontend\src\pages\manager\Dashboard.tsx`** (Line ~766)
   - Added "KPI Templates" quick action button (5th button in grid)

3. **`c:\kpi\fronted\kpi-frontend\src\components\Sidebar.tsx`** (Line ~106)
   - Added "KPI Templates" navigation item

## Database Schema

### kpi_templates Table
```sql
CREATE TABLE kpi_templates (
    id SERIAL PRIMARY KEY,
    manager_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    template_name VARCHAR(255) NOT NULL,
    description TEXT,
    period VARCHAR(50) NOT NULL CHECK (period IN ('quarterly', 'annual')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### kpi_template_items Table
```sql
CREATE TABLE kpi_template_items (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES kpi_templates(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    current_performance_status VARCHAR(255),
    target_value VARCHAR(255),
    expected_completion_date VARCHAR(100),
    measure_unit VARCHAR(100),
    goal_weight TEXT,
    item_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Deployment Steps

### 1. Database Migration
```bash
# Run migration
psql -U postgres -d kpi_db -f database/migration_kpi_templates.sql

# Verify tables created (optional)
psql -U postgres -d kpi_db -c "\dt kpi_templates"
psql -U postgres -d kpi_db -c "\dt kpi_template_items"
```

### 2. Backend Deployment
```bash
cd c:/kpi/backend/kpi

# No new dependencies needed
# Restart server
node server.js
# or if using PM2:
pm2 restart kpi-backend
```

### 3. Frontend Deployment
```bash
cd c:/kpi/fronted/kpi-frontend

# No new dependencies needed
# Build for production
npm run build

# Deploy dist/ folder to your web server
```

## How It Works

### Manager Workflow

#### 1. Create Template
1. Navigate to Dashboard → "KPI Templates" (Quick Actions or Sidebar)
2. Click "Create Template"
3. Fill in:
   - Template Name (e.g., "Sales Team Q1 Goals")
   - Description (optional)
   - Period Type (Quarterly or Annual)
   - Add KPI Items (minimum 1, can add more)
4. Click "Create Template"

#### 2. Use Template
1. Go to "KPI Templates"
2. Click "Use Template" on any template card
3. **Select Employees** (checkboxes, multi-select)
4. **Select Period** (Q1 2024, Q2 2024, etc.)
5. **Set Meeting Date** (optional)
6. **Sign** (digital signature)
7. Click "Send to X Employee(s)"

#### 3. What Happens
- One KPI form is created **for each selected employee**
- Each KPI form has all items from the template
- Each employee receives:
  - Email notification with link to acknowledge KPI
  - In-app notification
  - Individual KPI form (not shared)
- HR receives notifications (if enabled)
- Reminders are scheduled for each employee
- All existing workflows continue normally

### Template Management
- **Edit Template**: Update template name, items, or period type
- **Delete Template**: Remove template (does not affect KPIs already created)
- **View Templates**: See all your saved templates with item counts

## Key Features

### ✅ Maintains All Existing Functionality
- Regular KPI creation still works exactly the same
- Employee acknowledgment workflow unchanged
- Review process unchanged
- Notifications and emails work as before
- PDF generation works as before

### ✅ Individual KPI Forms
- Each employee gets their own KPI form with unique ID
- KPIs are NOT shared between employees
- Each employee can acknowledge independently
- Each employee's review is separate

### ✅ Full Notification Support
- Email notifications sent to each employee
- In-app notifications created
- HR notifications (if enabled)
- Reminders scheduled for each employee
- All standard notification types supported

### ✅ Multi-Employee Assignment
- Select 1 to all employees at once
- "Select All" / "Deselect All" buttons
- Visual checkboxes with employee details
- Counter shows how many selected

### ✅ Template Reusability
- Save templates for future use
- Edit templates anytime
- One template can be used multiple times
- Templates organized by period type

## API Endpoints

### Templates CRUD
- `GET /api/kpi-templates` - List manager's templates
- `GET /api/kpi-templates/:id` - Get template details
- `POST /api/kpi-templates` - Create template
- `PUT /api/kpi-templates/:id` - Update template
- `DELETE /api/kpi-templates/:id` - Delete template

### Apply Template
- `POST /api/kpi-templates/:id/apply` - Create KPIs for multiple employees
  - Body: `{ employee_ids: [1,2,3], quarter, year, meeting_date, manager_signature }`
  - Returns: `{ message, created: [{employee_id, employee_name, kpi_id}] }`

## Security & Permissions

### Authorization
- Only managers can access template routes
- Managers can only see their own templates
- Managers can only apply templates to employees in their department
- Department check enforced in backend

### Validation
- Template must have at least 1 item
- Period settings must be active in database
- Employee must exist and be in manager's department
- Manager signature required
- Period must match template type

## Testing Checklist

After deployment, test the following:

### Template Creation
- [ ] Create template with 1 item
- [ ] Create template with 5 items
- [ ] Create quarterly template
- [ ] Create annual template
- [ ] Edit existing template
- [ ] Delete template

### Template Application
- [ ] Apply template to 1 employee
- [ ] Apply template to 3+ employees
- [ ] Verify each employee receives separate KPI form
- [ ] Verify each employee receives email notification
- [ ] Verify each employee receives in-app notification
- [ ] Verify HR receives notification (if enabled)

### Existing Functionality
- [ ] Regular KPI creation still works
- [ ] Employee can acknowledge template-created KPI
- [ ] Review process works for template-created KPI
- [ ] PDF generation works
- [ ] Dashboard statistics update correctly

### Edge Cases
- [ ] Try to use template with no active period settings
- [ ] Try to apply template to employee in different department
- [ ] Try to apply template with no signature
- [ ] Try to apply template with no employees selected

## Troubleshooting

### Issue: "Template not found"
- Ensure user is a manager
- Verify template belongs to the logged-in manager
- Check company_id matches

### Issue: "No active period setting found"
- HR must create period settings in Settings page
- Period type must match template type (quarterly/annual)
- Period must be marked as active (is_active = true)

### Issue: "Employee not found" or "not in manager's department"
- Verify employee exists in database
- Check employee's department matches manager's department
- Ensure employee role is exactly 'employee'

### Issue: KPIs created but no notifications
- Check email service configuration (.env file)
- Verify SMTP settings
- Check notification settings (HR Settings → Email Notifications)
- Look for errors in server logs

## Rollback Plan

If issues occur, you can rollback:

### 1. Remove Routes (Frontend)
```typescript
// In App.tsx, comment out these routes:
// <Route path="/manager/kpi-templates" ... />
// <Route path="/manager/kpi-templates/create" ... />
// <Route path="/manager/kpi-templates/:id/edit" ... />
// <Route path="/manager/kpi-templates/:id/apply" ... />
```

### 2. Remove Backend Route
```javascript
// In server.js, comment out:
// app.use('/api/kpi-templates', require('./routes/kpiTemplates'));
```

### 3. Database (Optional - Only if needed)
```sql
-- Remove tables (this will delete all templates)
DROP TABLE IF EXISTS kpi_template_items CASCADE;
DROP TABLE IF EXISTS kpi_templates CASCADE;
```

**Note**: Removing tables does NOT affect KPIs that were already created from templates. Those KPIs are stored in the regular `kpis` and `kpi_items` tables.

## Benefits

1. **Time Savings**: Create KPI once, assign to many employees
2. **Consistency**: All employees get the same KPI structure
3. **Flexibility**: Can still create individual KPIs manually
4. **Reusability**: Save templates for quarterly/annual use
5. **No Breaking Changes**: All existing features work exactly as before

## Support

For issues or questions:
1. Check server logs for error messages
2. Verify database migration ran successfully
3. Ensure all employees are in manager's department
4. Confirm period settings are configured by HR

---
**Version**: 1.0.0  
**Date**: January 2026  
**Compatible with**: KPI Management System v2.x
