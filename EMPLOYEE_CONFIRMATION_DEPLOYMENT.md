# Employee Confirmation Step - Deployment Guide

## Overview
This update adds an employee confirmation step to the KPI review process. After a manager completes a KPI review, employees must now confirm (approve or reject) the manager's rating before the process is marked as complete.

## New Flow
1. Manager sets KPI and employee acknowledges
2. Manager initiates review period  
3. Employee submits self-rating
4. Manager reviews and rates employee
5. **NEW: Manager rating goes to employee for confirmation**
6. **NEW: Employee can approve (with signature) or reject (with note)**
7. Process completes (if approved) or ends (if rejected)

## Database Changes

### Migration Script
Run the following migration script located at:
`backend/kpi/scripts/run_employee_confirmation_migration.js`

```bash
cd backend/kpi
node scripts/run_employee_confirmation_migration.js
```

### What the Migration Does
1. **Updates review_status constraint** to include new statuses:
   - `awaiting_employee_confirmation` - Manager has rated, waiting for employee
   - `rejected` - Employee rejected the manager's rating
   
2. **Adds new columns** to `kpi_reviews` table:
   - `employee_confirmation_status` VARCHAR(20) - 'approved' or 'rejected'
   - `employee_rejection_note` TEXT - Note provided when rejecting
   - `employee_confirmation_signature` TEXT - Signature when approving
   - `employee_confirmation_signed_at` TIMESTAMP - When confirmed/rejected

3. **Updates existing data**: All records with status 'manager_submitted' are migrated to 'awaiting_employee_confirmation'

4. **Adds index** on `review_status` for better query performance

## Backend Changes

### Modified Files

#### 1. `routes/kpiReview.js`
- **Line 380**: Changed manager submit status from `'manager_submitted'` to `'awaiting_employee_confirmation'`
- **Lines 423-461**: Updated notifications to reflect new status
- **Lines 465-600 (NEW)**: Added POST `/kpi-review/:reviewId/employee-confirmation` endpoint
  - Validates confirmation_status ('approved' or 'rejected')
  - Requires rejection note if rejecting
  - Requires signature if approving
  - Updates review status to 'completed' (approved) or 'rejected'
  - Sends notifications to manager and HR
  - Sends email to manager

#### 2. `routes/departments.js`
- **Lines 108-114**: Updated statistics query CASE statement to include new statuses
- **Lines 125-127**: Added new category counts in SELECT
- **Lines 144-148**: Updated statistics mapping to include new categories
- **Lines 173-175**: Added new categories to validCategories array
- **Lines 250-254**: Updated employee detail query CASE statement

### New Endpoint

**POST** `/kpi-review/:reviewId/employee-confirmation`
- **Auth**: Employee only
- **Body**:
  ```json
  {
    "confirmation_status": "approved" | "rejected",
    "rejection_note": "string (required if rejected)",
    "signature": "string (required if approved)"
  }
  ```
- **Response**:
  ```json
  {
    "review": { /* updated review object */ },
    "message": "Review approved/rejected successfully"
  }
  ```

## Frontend Changes

### Modified Files

#### 1. Manager Dashboard (`pages/manager/Dashboard.tsx`)
- **Lines 18-20**: Updated DepartmentStatistic interface with new categories
- **Lines 256-280**: Updated category labels, colors, and icons
- **Lines 426-430**: Updated Total KPIs calculation
- **Lines 456-462**: Updated KPI Setting Completed calculation  
- **Lines 491-497**: Updated department card totals

**New Status Display**:
- Awaiting Employee Confirmation: Indigo color with bell icon
- Review Rejected: Red color with edit icon

#### 2. HR Dashboard (`pages/hr/Dashboard.tsx`)
- **Lines 8-18**: Updated DepartmentStatistic interface
- **Lines 270-310**: Updated category labels, colors, and icons
- **Lines 459-465**: Updated Total KPIs calculation
- **Lines 489-497**: Updated KPI Setting Completed calculation
- **Lines 522-530**: Updated department card totals

#### 3. Employee Dashboard (`pages/employee/Dashboard.tsx`)
- **Lines 69-99**: Updated getKPIStage to handle new statuses
- **Lines 275-295 (NEW)**: Added "Awaiting Your Confirmation" status card
- **Lines 305-308**: Updated completed reviews filter
- **Lines 450-461 (NEW)**: Added "Confirm" button for awaiting_employee_confirmation status
- **Lines 463-465**: Updated Edit button condition

#### 4. NEW: Employee Confirmation Page (`pages/employee/KPIConfirmation.tsx`)
Complete new page (340 lines) featuring:
- Display of KPI details
- Employee's self-rating review
- Manager's rating and comments (highlighted)
- Approve/Reject decision UI
- Signature field (for approval)
- Rejection note textarea (for rejection)
- Form validation and submission

#### 5. App Routing (`App.tsx`)
- **Line 24**: Added KPIConfirmation import
- **Lines 394-402**: Added route `/employee/kpi-confirmation/:reviewId`

## UI/UX Changes

### Manager Dashboard
- New status card: "Awaiting Employee Confirmation" (Indigo)
- New status card: "Review Rejected by Employee" (Red)
- Both included in total counts and department breakdowns

### HR Dashboard  
- Same new status cards as manager dashboard
- Can view employees in each status category
- Receives notifications when employees reject reviews

### Employee Dashboard
- New status card showing count of reviews awaiting confirmation
- "Confirm" button appears for reviews in awaiting_employee_confirmation status
- Clicking "Confirm" navigates to dedicated confirmation page

### Employee Confirmation Page
New dedicated page (`/employee/kpi-confirmation/:reviewId`) with:
- Side-by-side comparison of employee vs manager ratings
- Clear approve/reject decision buttons
- Conditional fields:
  - Approve: Requires signature
  - Reject: Requires written explanation
- Visual distinction between employee rating (purple) and manager rating (yellow/orange)

## Notifications

### When Manager Submits Review
- **To Employee**: "Your manager [Name] has completed your KPI review - Please confirm"
- **To HR**: "KPI review submitted by [Manager] for [Employee] - Awaiting employee confirmation"
- **Type**: `awaiting_employee_confirmation`

### When Employee Approves
- **To Manager**: "[Employee] has approved the KPI review"
- **To HR**: "KPI review for [Employee] completed and approved"  
- **Type**: `review_completed`

### When Employee Rejects
- **To Manager**: "[Employee] has rejected the KPI review with note: '[note]'"
- **To HR**: "KPI review for [Employee] rejected by employee"
- **Type**: `review_rejected`

## Testing Checklist

### Database
- [ ] Migration runs successfully
- [ ] Existing reviews updated to new status
- [ ] New columns added correctly
- [ ] Index created

### Backend
- [ ] Manager submit changes status to awaiting_employee_confirmation
- [ ] Employee confirmation endpoint accepts approvals
- [ ] Employee confirmation endpoint accepts rejections
- [ ] Rejection requires note
- [ ] Approval requires signature
- [ ] Notifications sent correctly
- [ ] Statistics queries include new statuses

### Frontend - Manager
- [ ] Dashboard shows new status cards
- [ ] Can view employees in each status
- [ ] Receives notification when employee approves
- [ ] Receives notification when employee rejects
- [ ] Totals calculate correctly

### Frontend - HR
- [ ] Dashboard shows new status cards
- [ ] Can view employees in each status
- [ ] Receives notifications for both approve/reject
- [ ] Totals calculate correctly

### Frontend - Employee
- [ ] Dashboard shows awaiting confirmation count
- [ ] Confirm button appears for correct reviews
- [ ] Confirmation page loads correctly
- [ ] Can approve with signature
- [ ] Can reject with note
- [ ] Validation works (required fields)
- [ ] Success redirects to dashboard
- [ ] Notifications received

### End-to-End Flow
- [ ] Manager sets KPI → Employee acknowledges
- [ ] Employee submits self-rating
- [ ] Manager submits review
- [ ] Employee sees notification
- [ ] Employee can view confirmation page
- [ ] Employee approves → Status becomes 'completed'
- [ ] Manager/HR receive approval notification
- [ ] OR Employee rejects → Status becomes 'rejected'
- [ ] Manager/HR receive rejection with note

## Rollback Plan

If issues arise, you can rollback by:

1. **Revert database constraint**:
```sql
ALTER TABLE kpi_reviews DROP CONSTRAINT IF EXISTS kpi_reviews_review_status_check;
ALTER TABLE kpi_reviews ADD CONSTRAINT kpi_reviews_review_status_check 
CHECK (review_status IN ('pending', 'employee_submitted', 'manager_submitted', 'hr_reviewed', 'completed'));
```

2. **Update existing data back**:
```sql
UPDATE kpi_reviews 
SET review_status = 'manager_submitted' 
WHERE review_status = 'awaiting_employee_confirmation';
```

3. **Revert backend code** to previous version

4. **Remove frontend route** for /employee/kpi-confirmation

## Notes

- **Breaking Change**: Existing reviews in 'manager_submitted' status will automatically become 'awaiting_employee_confirmation'
- **User Training**: Employees need to be informed about the new confirmation step
- **Email Templates**: You may want to customize the email content in `services/emailService.js`
- **PDF Generation**: Currently happens when manager submits. Consider if you want to regenerate after employee approval.

## Support

If you encounter issues:
1. Check migration ran successfully
2. Verify all files updated correctly
3. Check browser console for frontend errors
4. Check backend logs for API errors
5. Verify notifications table has new notification types

## Version
- **Created**: January 7, 2026
- **Backend Version**: Requires KPI system v1.x
- **Database**: PostgreSQL with kpi_reviews table
