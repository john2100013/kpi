# Manager Dashboard Fix - Deployment Guide

## Issue
Managers are getting 403 Forbidden errors when accessing dashboard endpoints because:
1. Authentication middleware was only checking `user_companies` table (for multi-company HR users)
2. Managers and employees only have `company_id` in the `users` table
3. Some endpoints were restricted to HR only

## Files Modified

### 1. `middleware/auth.js`
**Line ~42-62**: Fixed authentication to check both `users.company_id` and `user_companies` table

**Old Code:**
```javascript
// Verify user has access to this company
if (decoded.companyId) {
  const companyCheck = await query(
    'SELECT company_id FROM user_companies WHERE user_id = $1 AND company_id = $2',
    [req.user.id, decoded.companyId]
  );
  console.log('🔍 [auth] Company check result:', companyCheck.rows.length, 'rows');

  if (companyCheck.rows.length === 0) {
    console.error('❌ [auth] User does not have access to company:', decoded.companyId);
    return res.status(403).json({ error: 'User does not have access to this company' });
  }
}
```

**New Code:**
```javascript
// Verify user has access to this company
if (decoded.companyId) {
  // First check if user's primary company_id matches
  const userResult = await query(
    'SELECT company_id FROM users WHERE id = $1',
    [req.user.id]
  );
  
  const userCompanyId = userResult.rows[0]?.company_id;
  console.log('🔍 [auth] User primary company_id:', userCompanyId);
  
  // Check if decoded company matches user's primary company OR user_companies table (for HR with multiple companies)
  if (userCompanyId && userCompanyId === decoded.companyId) {
    console.log('✅ [auth] User has access via primary company_id');
  } else {
    // Check user_companies table (for HR users with multi-company access)
    const companyCheck = await query(
      'SELECT company_id FROM user_companies WHERE user_id = $1 AND company_id = $2',
      [req.user.id, decoded.companyId]
    );
    console.log('🔍 [auth] Company check result:', companyCheck.rows.length, 'rows');

    if (companyCheck.rows.length === 0) {
      console.error('❌ [auth] User does not have access to company:', decoded.companyId);
      return res.status(403).json({ error: 'User does not have access to this company' });
    }
    console.log('✅ [auth] User has access via user_companies table');
  }
}
```

### 2. `routes/settings.js`
**Line 9**: Added 'manager' to authorized roles for period settings

**Change:**
```javascript
// OLD
router.get('/period-settings', authenticateToken, authorizeRoles('hr'), async (req, res) => {

// NEW
router.get('/period-settings', authenticateToken, authorizeRoles('hr', 'manager'), async (req, res) => {
```

## Already Correct (No Changes Needed)

These routes already have manager access:
- ✅ `/api/departments/statistics` - authorizeRoles('hr', 'manager')
- ✅ `/api/departments/statistics/:department/:category` - authorizeRoles('hr', 'manager')
- ✅ `/api/kpis` - No role restriction (authenticateToken only)
- ✅ `/api/kpi-review` - No role restriction (authenticateToken only)
- ✅ `/api/notifications` - No role restriction (authenticateToken only)
- ✅ `/api/notifications/activity` - No role restriction (authenticateToken only)
- ✅ `/api/employees` - authorizeRoles('manager', 'hr', 'super_admin')
- ✅ `/api/kpis/dashboard/stats` - No role restriction (authenticateToken only)

## Deployment Steps

### Option 1: Full Redeployment
1. Stop the production Node.js server
2. Pull/upload the latest code with these changes
3. Restart the server:
   ```bash
   cd /path/to/kpi/backend/kpi
   node server.js
   ```
   or if using PM2:
   ```bash
   pm2 restart kpi-backend
   ```

### Option 2: Manual File Update (Quick Fix)
If you can't do a full redeployment:

1. **Update `middleware/auth.js`:**
   - Locate lines 42-62 (the company verification section)
   - Replace with the new code above
   
2. **Update `routes/settings.js`:**
   - Find line 9: `router.get('/period-settings'...`
   - Add 'manager' to the authorizeRoles array

3. **Restart the server**

### Option 3: Using Git (Recommended)
```bash
# On production server
cd /path/to/kpi/backend/kpi
git pull origin main  # or your branch name
npm install  # if dependencies changed
pm2 restart kpi-backend  # or your restart command
```

## Verification

After deployment, managers should be able to:
1. ✅ View their dashboard without 403 errors
2. ✅ See department statistics cards
3. ✅ Use period filters
4. ✅ Click on category cards to view employee lists
5. ✅ Access KPIs, reviews, notifications, and employees

## Testing Checklist

Login as a manager and verify:
- [ ] Dashboard loads without 403 errors in browser console
- [ ] 5 statistics cards show correct data (Total Employees, Total KPIs, etc.)
- [ ] Period filter dropdown is populated
- [ ] Department overview section displays with clickable cards
- [ ] Clicking a category card shows employee list
- [ ] Notifications panel loads
- [ ] Recent activity panel loads
- [ ] Quick Actions section is visible at the bottom

## Rollback Plan

If issues occur after deployment:
1. Revert `middleware/auth.js` to previous version
2. Revert `routes/settings.js` to previous version
3. Restart server
4. Managers will get 403 errors again but system will be stable

## Database Schema Reference

**users table** (for regular managers/employees):
- `id` - User ID
- `company_id` - Primary company assignment
- `role` - 'manager', 'employee', 'hr', 'super_admin'

**user_companies table** (for multi-company HR):
- `user_id` - User ID
- `company_id` - Additional company access
- Used only for HR users who manage multiple companies

## Notes

- The fix maintains backward compatibility with HR multi-company access
- Super admins are unaffected (they have company_id = null)
- Employees are also fixed by this change (they use users.company_id too)
- No database migrations required
- No frontend changes required (already using correct endpoints)

## Support

If you encounter issues:
1. Check server logs for authentication errors
2. Verify user has `company_id` set in users table
3. Check JWT token contains `companyId` field
4. Ensure user role is exactly 'manager' (not 'Manager' or other variants)

---
**Last Updated:** January 7, 2026
**Tested On:** Local development environment
**Production Ready:** Yes ✅
