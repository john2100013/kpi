# Manager Department Assignment - Backend Implementation Guide

## Overview
Managers can now be assigned to multiple departments. This allows a manager to see employees from all assigned departments in their dashboard.

## Required Backend Changes

### 1. Database Changes

Create a new table for manager-department assignments:

```sql
CREATE TABLE IF NOT EXISTS manager_departments (
  id SERIAL PRIMARY KEY,
  manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(manager_id, department_id)
);

CREATE INDEX idx_manager_departments_manager ON manager_departments(manager_id);
CREATE INDEX idx_manager_departments_department ON manager_departments(department_id);
```

### 2. New API Endpoints

#### POST /api/users/assign-manager-departments
Assign a manager to multiple departments

**Request Body:**
```json
{
  "manager_id": 123,
  "department_ids": [1, 2, 3]
}
```

**Implementation:**
```javascript
router.post('/assign-manager-departments', authorizeRoles('super_admin'), async (req, res) => {
  const { manager_id, department_ids } = req.body;
  
  try {
    // Delete existing assignments
    await query('DELETE FROM manager_departments WHERE manager_id = $1', [manager_id]);
    
    // Insert new assignments
    for (const dept_id of department_ids) {
      await query(
        'INSERT INTO manager_departments (manager_id, department_id) VALUES ($1, $2)',
        [manager_id, dept_id]
      );
    }
    
    res.json({ message: 'Manager assigned to departments successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### GET /api/users/:id/departments
Get departments assigned to a manager

**Response:**
```json
{
  "department_ids": [1, 2, 3]
}
```

**Implementation:**
```javascript
router.get('/:id/departments', authorizeRoles('super_admin'), async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await query(
      'SELECT department_id FROM manager_departments WHERE manager_id = $1',
      [id]
    );
    
    const department_ids = result.rows.map(row => row.department_id);
    res.json({ department_ids });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3. Update Department Statistics Endpoint

Modify GET /api/departments/statistics to return all departments where manager has employees:

**Current logic:** Filter by manager's single department
**New logic:** 
1. Get all departments assigned to manager from manager_departments table
2. For each department, get employee statistics
3. Return aggregated data for all departments

```javascript
router.get('/statistics', authorize, async (req, res) => {
  try {
    const { period } = req.query;
    const user = req.user;
    
    if (user.role === 'manager') {
      // Get departments assigned to this manager
      const deptResult = await query(
        `SELECT DISTINCT d.id, d.name 
         FROM manager_departments md
         JOIN departments d ON d.id = md.department_id
         WHERE md.manager_id = $1`,
        [user.id]
      );
      
      const departments = deptResult.rows;
      const statistics = [];
      
      // Get statistics for each department
      for (const dept of departments) {
        const stats = await getDepartmentStats(dept.id, dept.name, period, user.company_id, user.id);
        statistics.push(stats);
      }
      
      return res.json({ statistics });
    }
    
    // ... rest of the code for HR/super_admin
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4. Update Employee Filtering

Modify GET /api/employees to use manager_departments when filtering:

```javascript
if (role === 'manager' && managerId) {
  // Get departments assigned to this manager
  const deptResult = await query(
    'SELECT department_id FROM manager_departments WHERE manager_id = $1',
    [managerId]
  );
  
  const deptIds = deptResult.rows.map(r => r.department_id);
  
  if (deptIds.length > 0) {
    // Filter employees by departments OR manager_id
    filters.push(`(u.manager_id = $${paramIndex} OR d.id = ANY($${paramIndex + 1}))`);
    params.push(managerId, deptIds);
    paramIndex += 2;
  } else {
    // Fallback to manager_id only
    filters.push(`u.manager_id = $${paramIndex}`);
    params.push(managerId);
    paramIndex++;
  }
}
```

## Migration File

Create: `database/migration_manager_departments.sql`

```sql
-- Migration: Manager Department Assignments
-- This allows managers to be assigned to multiple departments

CREATE TABLE IF NOT EXISTS manager_departments (
  id SERIAL PRIMARY KEY,
  manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(manager_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_manager_departments_manager ON manager_departments(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_departments_department ON manager_departments(department_id);

-- Migrate existing data: Assign managers to their current department (if they have one)
INSERT INTO manager_departments (manager_id, department_id)
SELECT u.id as manager_id, d.id as department_id
FROM users u
JOIN departments d ON d.name = u.department AND d.company_id = u.company_id
WHERE u.role = 'manager' AND u.department IS NOT NULL
ON CONFLICT (manager_id, department_id) DO NOTHING;
```

## Testing

1. Assign a manager to multiple departments via super admin
2. Login as that manager
3. Verify dashboard shows:
   - Correct total employee count across all departments
   - Each department listed separately
   - Employees from all assigned departments in employee list
4. Verify KPI template application shows employees from all departments grouped by department
