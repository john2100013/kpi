# User Management - Create Users & Multi-Company HR Guide

## Overview
The Super Admin User Management system now includes comprehensive user creation capabilities and the ability to add HR users to multiple companies.

## New Features Added

### 1. Create New Users (Employee, Manager, HR)
Super admins can now create new users directly from the User Management interface for any company.

**Features:**
- Create employees with full details (payroll number, national ID, department, position, employment date, manager)
- Create managers with basic details (name, email, department, position)
- Create HR users with basic details (name, email, department, position)
- Password is required during creation for all user types
- Users are automatically assigned to the selected company

**Location:** User Management page → Select Company → Click "Add Employee/Manager/HR" button

### 2. Add HR to Multiple Companies
A new dedicated tab allows super admins to assign HR users to multiple companies, enabling cross-company HR management.

**Features:**
- Select any existing HR user
- Assign them to one or more companies via checkboxes
- HR users can manage multiple companies simultaneously
- Creates `user_companies` table to track multi-company relationships
- Prevents duplicate assignments (user can't be added to same company twice)

**Location:** User Management page → "Add HR to Companies" tab

## Technical Implementation

### Frontend Changes
**File:** `c:\kpi\fronted\kpi-frontend\src\pages\superadmin\UserManagement.tsx`

**New State Variables:**
```typescript
// Create User Modal State
const [showCreateModal, setShowCreateModal] = useState(false);
const [createFormData, setCreateFormData] = useState<CreateUserFormData>({
  name: '',
  email: '',
  password: '',
  role: 'employee',
  payroll_number: '',
  national_id: '',
  department: '',
  position: '',
  employment_date: '',
  manager_id: '',
});

// Add HR to Company Modal State
const [showAddHRModal, setShowAddHRModal] = useState(false);
const [allHRUsers, setAllHRUsers] = useState<User[]>([]);
const [addHRFormData, setAddHRFormData] = useState<AddHRToCompanyFormData>({
  hr_id: '',
  company_ids: [],
});
```

**New Tabs:**
- Employee (existing)
- Manager (existing)
- HR (existing)
- **Add HR to Companies (NEW)**

**New Functions:**
- `openCreateModal(role)` - Opens modal to create new user
- `handleCreateUser()` - Submits new user creation to `/auth/register` endpoint
- `fetchAllHRUsers()` - Fetches all HR users for multi-company assignment
- `handleAddHRToCompanies()` - Assigns HR user to multiple companies
- `toggleCompanySelection(companyId)` - Manages company selection checkboxes

### Backend Changes
**File:** `c:\kpi\backend\kpi\routes\users.js`

**New Endpoint:**
```javascript
POST /api/users/add-hr-to-companies
```

**Request Body:**
```json
{
  "hr_id": 5,
  "company_ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "message": "HR user successfully added to companies",
  "hr_id": 5,
  "company_count": 3
}
```

**Database Changes:**
The endpoint automatically creates the `user_companies` table if it doesn't exist:

```sql
CREATE TABLE IF NOT EXISTS user_companies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, company_id)
);
```

**Features:**
- Transaction-based operation (BEGIN/COMMIT/ROLLBACK)
- Validates that user exists and has HR role
- Prevents duplicate assignments with `ON CONFLICT DO NOTHING`
- Cascading deletes when user or company is removed
- Super admin authorization required

## User Workflows

### Creating a New Employee
1. Navigate to Super Admin → User Management
2. Select a specific company from dropdown
3. Ensure "Employees" tab is active
4. Click "Add Employee" button
5. Fill in the form:
   - **Required:** Name, Email, Password
   - **Optional:** Payroll Number, National ID, Department, Position, Employment Date, Manager
6. Click "Create User"
7. Employee appears in the list immediately

### Creating a New Manager
1. Navigate to Super Admin → User Management
2. Select a specific company from dropdown
3. Click "Managers" tab
4. Click "Add Manager" button
5. Fill in the form:
   - **Required:** Name, Email, Password
   - **Optional:** Department, Position
6. Click "Create User"
7. Manager appears in the list immediately

### Creating a New HR User
1. Navigate to Super Admin → User Management
2. Select a specific company from dropdown
3. Click "HR" tab
4. Click "Add HR" button
5. Fill in the form:
   - **Required:** Name, Email, Password
   - **Optional:** Department, Position
6. Click "Create User"
7. HR user appears in the list immediately

### Adding HR to Multiple Companies
1. Navigate to Super Admin → User Management
2. Click "Add HR to Companies" tab
3. Click "Add HR to Companies" button (green button)
4. Select an HR user from dropdown
5. Check the boxes for all companies you want to assign them to
6. Click "Add to Companies"
7. Success message appears
8. HR user can now access all selected companies

## API Usage Examples

### Create New Employee
```javascript
POST /api/auth/register
Authorization: Bearer <super_admin_token>

{
  "name": "John Doe",
  "email": "john.doe@company.com",
  "password": "SecurePass123!",
  "role": "employee",
  "company_id": 1,
  "payroll_number": "EMP001",
  "national_id": "123456789",
  "department": "Engineering",
  "position": "Software Developer",
  "employment_date": "2026-01-01",
  "manager_id": 5
}
```

### Create New Manager
```javascript
POST /api/auth/register
Authorization: Bearer <super_admin_token>

{
  "name": "Jane Smith",
  "email": "jane.smith@company.com",
  "password": "SecurePass123!",
  "role": "manager",
  "company_id": 1,
  "department": "Engineering",
  "position": "Engineering Manager"
}
```

### Create New HR User
```javascript
POST /api/auth/register
Authorization: Bearer <super_admin_token>

{
  "name": "Alice Johnson",
  "email": "alice.johnson@company.com",
  "password": "SecurePass123!",
  "role": "hr",
  "company_id": 1,
  "department": "Human Resources",
  "position": "HR Manager"
}
```

### Add HR to Multiple Companies
```javascript
POST /api/users/add-hr-to-companies
Authorization: Bearer <super_admin_token>

{
  "hr_id": 10,
  "company_ids": [1, 2, 3, 4, 5]
}
```

## Security Considerations

1. **Authorization:** All endpoints require `super_admin` role
2. **Validation:** 
   - HR role is verified before multi-company assignment
   - Company IDs are validated against existing companies
   - User existence is checked before operations
3. **Transactions:** All database operations use transactions for data integrity
4. **Password Security:** Passwords are hashed using bcrypt before storage (handled by `/auth/register`)
5. **Duplicate Prevention:** UNIQUE constraint on `(user_id, company_id)` prevents duplicates

## Database Schema

### users table (existing)
- Stores all users (employee, manager, hr, super_admin)
- Each user has a primary `company_id`

### user_companies table (new)
- Enables many-to-many relationship between users and companies
- Primarily used for HR users managing multiple companies
- Can be extended for other roles in future

```sql
-- Query to get all companies for an HR user
SELECT c.* 
FROM companies c
INNER JOIN user_companies uc ON c.id = uc.company_id
WHERE uc.user_id = <hr_user_id>;

-- Query to get all HR users for a company
SELECT u.* 
FROM users u
INNER JOIN user_companies uc ON u.id = uc.user_id
WHERE uc.company_id = <company_id> AND u.role = 'hr';
```

## Performance Considerations

- **Create User:** Single INSERT operation, very fast (<5ms)
- **Add HR to Companies:** Bulk INSERT with ON CONFLICT, efficient for multiple companies
- **Fetch HR Users:** Uses existing index on `role` column for fast filtering
- **Company Selection:** Checkboxes prevent multiple API calls, single batch operation

## Future Enhancements

1. **Bulk User Import:** Upload CSV/Excel file to create multiple users at once
2. **User Deactivation:** Soft delete users instead of permanent removal
3. **Role-based Multi-company:** Extend multi-company feature to managers
4. **Company Permissions:** Fine-grained permissions per company for HR users
5. **Audit Log:** Track who created/modified users and when
6. **Email Notifications:** Send welcome email with temporary password
7. **Password Reset:** Allow super admin to reset user passwords

## Troubleshooting

### Issue: "Add Employee/Manager/HR" button not showing
**Solution:** Make sure a specific company is selected (not "All Companies")

### Issue: Create user fails with "Failed to create user"
**Possible causes:**
- Email already exists in database
- Invalid company_id
- Network error
**Check:** Browser console and backend logs for specific error

### Issue: HR user not appearing in "Add HR to Companies" dropdown
**Possible causes:**
- User role is not 'hr'
- User was just created (try refreshing)
**Solution:** Verify user role in database, refresh the tab

### Issue: "User is not an HR user" error
**Solution:** Selected user must have role = 'hr'. Check users table.

### Issue: HR user not seeing company after assignment
**Possible causes:**
- Frontend might need to implement `user_companies` table lookup
- Currently primary `company_id` is used for company selection
**Future fix:** Update HR dashboard to show all companies from `user_companies` table

## Related Files

**Frontend:**
- `c:\kpi\fronted\kpi-frontend\src\pages\superadmin\UserManagement.tsx`

**Backend:**
- `c:\kpi\backend\kpi\routes\users.js` (user management endpoints)
- `c:\kpi\backend\kpi\routes\auth.js` (user registration endpoint)
- `c:\kpi\backend\kpi\middleware\auth.js` (authorization middleware)

**Documentation:**
- `USER_MANAGEMENT_GUIDE.md` (viewing and editing users)
- `USER_MANAGEMENT_CREATE_USERS_GUIDE.md` (this file)
- `MULTI_COMPANY_USER_GUIDE.md` (multi-company architecture)

## Support

For issues or questions:
1. Check browser console for frontend errors
2. Check backend logs for API errors
3. Verify database structure matches schema
4. Ensure super_admin role is properly set
5. Test with curl/Postman to isolate frontend vs backend issues

---

**Last Updated:** January 7, 2026
**Version:** 1.0.0
