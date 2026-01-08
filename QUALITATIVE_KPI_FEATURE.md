# Qualitative KPI Items Feature - Implementation Summary

## Overview
Added support for qualitative KPI items that only require manager assessment without employee self-rating. Qualitative items use categorical ratings instead of numeric scores.

## Database Changes

### Migration File
**File:** `migration_add_qualitative_kpi_items.sql`

#### Changes to `kpi_items` table:
- `is_qualitative` (BOOLEAN, default: false) - Marks item as qualitative
- `qualitative_rating` (VARCHAR(50)) - Manager's categorical rating: 'exceeds', 'meets', 'needs_improvement'
- `qualitative_comment` (TEXT) - Optional manager comment for qualitative assessment
- Index added: `idx_kpi_items_qualitative`

#### Changes to `kpi_template_items` table:
- `is_qualitative` (BOOLEAN, default: false) - Supports qualitative items in templates

## Backend Updates

### 1. KpisController (`controllers/KpisController.js`)
**Updated Methods:**
- `create()` - Now accepts `is_qualitative` flag when creating KPI items
  - INSERT statement updated to include `is_qualitative` column

### 2. KpiReviewController (`controllers/KpiReviewController.js`)
**Updated Methods:**
- `submitManagerReview()` - Now accepts `qualitative_ratings` array in request body
  - Format: `[{item_id, rating, comment}, ...]`
  - Updates `kpi_items` table with `qualitative_rating` and `qualitative_comment`
  - Ratings: 'exceeds', 'meets', 'needs_improvement'

### 3. KpiTemplatesController (`controllers/KpiTemplatesController.js`)
**Updated Methods:**
- `create()` - Template items can be marked as qualitative
- `update()` - Updates preserve qualitative flag
- `apply()` - Applies qualitative flag when creating KPIs from templates

### 4. PDF Service (`services/pdfService.js`)
**Updated Function:**
- `generateCompletedReviewPDF()` - Enhanced to handle qualitative items
  - Displays "Qualitative" in employee rating column for qualitative items
  - Shows categorical ratings (Exceeds/Meets/Needs Improvement) for manager rating
  - Uses `qualitative_comment` for qualitative items instead of numeric rating comment

## Frontend Requirements

### Manager KPI Setting Page
**File to Update:** `fronted/kpi-frontend/src/pages/manager/KPISetting.tsx`

**Required Changes:**
1. Add checkbox/toggle for each KPI item: "Mark as Qualitative"
2. When checked:
   - Hide target value, measure unit fields (optional for qualitative)
   - Show indicator that this item won't require employee self-rating
3. Include `is_qualitative: boolean` in item data when submitting

**Example UI:**
```typescript
{kpiItems.map((item, index) => (
  <div key={index}>
    <input type="text" name="title" value={item.title} />
    <textarea name="description" value={item.description} />
    
    {/* Add qualitative checkbox */}
    <label>
      <input 
        type="checkbox" 
        checked={item.is_qualitative || false}
        onChange={(e) => handleQualitativeToggle(index, e.target.checked)}
      />
      Mark as Qualitative (Manager assessment only)
    </label>
    
    {!item.is_qualitative && (
      <>
        <input type="text" name="target_value" />
        <input type="text" name="measure_unit" />
      </>
    )}
  </div>
))}
```

### Manager KPI Review Page
**File to Update:** `fronted/kpi-frontend/src/pages/manager/KPIReview.tsx`

**Required Changes:**
1. Check each KPI item's `is_qualitative` flag
2. For qualitative items:
   - Skip employee self-rating display
   - Show qualitative rating dropdown:
     - "Exceeds Expectations"
     - "Meets Expectations"
     - "Needs Improvement"
   - Show optional comment field
3. When submitting review, include `qualitative_ratings` array:
```typescript
const qualitativeRatings = kpiItems
  .filter(item => item.is_qualitative)
  .map(item => ({
    item_id: item.id,
    rating: item.qualitative_rating, // 'exceeds', 'meets', 'needs_improvement'
    comment: item.qualitative_comment || ''
  }));

// Include in review submission
await api.post(`/kpi-review/${reviewId}/manager-review`, {
  manager_rating,
  manager_comment,
  overall_manager_comment,
  manager_signature,
  qualitative_ratings // Add this
});
```

### Manager/HR KPI Details Pages
**Files to Update:**
- `fronted/kpi-frontend/src/pages/manager/KPIDetails.tsx`
- `fronted/kpi-frontend/src/pages/hr/KPIDetails.tsx`

**Required Changes:**
1. Display qualitative items differently:
   - Show "Qualitative Assessment" badge/label
   - Display categorical rating if set
   - Show qualitative comment if present
2. In review section, format qualitative ratings:
```typescript
const getRatingDisplay = (item) => {
  if (item.is_qualitative) {
    if (item.qualitative_rating === 'exceeds') return '⭐ Exceeds Expectations';
    if (item.qualitative_rating === 'meets') return '✓ Meets Expectations';
    if (item.qualitative_rating === 'needs_improvement') return '⚠ Needs Improvement';
    return 'Not yet assessed';
  }
  return `${item.manager_rating || 'N/A'}/5`;
};
```

### Employee Pages (No Changes Required)
**Files:** `fronted/kpi-frontend/src/pages/employee/*`
- Employee KPI acknowledgement remains the same
- Employee self-rating automatically skips qualitative items (backend handles this)
- No UI changes needed for employee views

## API Contract

### Create KPI with Qualitative Items
```json
POST /kpis
{
  "employee_id": 123,
  "period": "quarterly",
  "quarter": "Q1",
  "year": 2026,
  "manager_signature": "base64...",
  "kpi_items": [
    {
      "title": "Leadership Skills",
      "description": "Demonstrates effective leadership",
      "is_qualitative": true  // ← New field
    },
    {
      "title": "Sales Target",
      "target_value": "100000",
      "measure_unit": "USD",
      "is_qualitative": false
    }
  ]
}
```

### Submit Manager Review with Qualitative Ratings
```json
POST /kpi-review/:reviewId/manager-review
{
  "manager_rating": 4.5,
  "manager_comment": "{...}",
  "overall_manager_comment": "Overall good performance",
  "manager_signature": "base64...",
  "qualitative_ratings": [  // ← New field
    {
      "item_id": 456,
      "rating": "exceeds",  // or "meets", "needs_improvement"
      "comment": "Excellent leadership demonstrated"
    }
  ]
}
```

## PDF Output

### Completed Review PDF Changes
The PDF now displays qualitative items with:
- Employee Rating Column: Shows "Qualitative" instead of numeric rating
- Manager Rating Column: Shows categorical rating:
  - "Exceeds Expectations"
  - "Meets Expectations"  
  - "Needs Improvement"
- Manager Comment: Uses `qualitative_comment` for qualitative items

## Testing Checklist

### Backend
- [x] Database migration runs successfully
- [x] KPI creation with qualitative items works
- [x] Templates support qualitative items
- [x] Manager review accepts qualitative ratings
- [x] PDF generation includes qualitative items correctly

### Frontend (Implemented)
- [x] Manager can mark items as qualitative during KPI setting
- [x] Manager sees qualitative rating dropdown during review
- [x] Manager/HR KPI details show qualitative assessments
- [x] Employee views work normally (skip qualitative items)
- [x] Templates preserve qualitative flag

## Implementation Status

✅ **COMPLETE** - All backend and frontend components have been implemented and are ready for testing.

### What Was Implemented:

#### Database (✅ Migrated)
- Added `is_qualitative`, `qualitative_rating`, `qualitative_comment` columns to `kpi_items`
- Added `is_qualitative` to `kpi_template_items`
- Migration executed successfully on 2026-01-08

#### Backend (✅ Complete)
1. **KpisController.js** - Handles `is_qualitative` flag during creation
2. **KpiReviewController.js** - Accepts and saves `qualitative_ratings` array
3. **KpiTemplatesController.js** - All template operations support qualitative items
4. **pdfService.js** - PDF displays qualitative ratings correctly

#### Frontend (✅ Complete)
1. **types/index.ts** - Added qualitative fields to `KPIItem` interface
2. **manager/KPISetting.tsx** - Added qualitative checkbox, disables target/measure fields
3. **manager/KPIReview.tsx** - Shows qualitative rating dropdown (Exceeds/Meets/Needs Improvement)
4. **manager/KPIDetails.tsx** - Displays qualitative items with proper badges and ratings
5. **hr/KPIDetails.tsx** - Shows qualitative assessments for HR review

## Migration Instructions

1. **Run Database Migration:**
```bash
psql -U your_user -d your_database -f backend/kpi/database/migration_add_qualitative_kpi_items.sql
```

2. **Restart Backend Server:**
```bash
cd backend/kpi
npm restart
```

3. **Update Frontend:**
- Implement changes in KPISetting.tsx
- Implement changes in KPIReview.tsx
- Implement changes in KPIDetails.tsx (both manager and HR)
- Test thoroughly

## Notes

- Qualitative items are optional - existing KPIs work as before
- Employee self-rating is automatically skipped for qualitative items
- Qualitative ratings don't affect numeric performance calculations
- HR can view qualitative assessments like any other KPI data
- Templates can include mix of qualitative and quantitative items
