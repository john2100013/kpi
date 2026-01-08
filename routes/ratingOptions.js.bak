const express = require('express');
const { query } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Log when router is loaded
console.log('✅ [ratingOptions] Router module loaded');
console.log('✅ [ratingOptions] Available routes will be:');
console.log('   - GET  /test');
console.log('   - POST /test-post');
console.log('   - GET  /');
console.log('   - GET  /manage');
console.log('   - POST /');
console.log('   - PUT  /:id');
console.log('   - DELETE /:id');

// Test endpoint - no auth required - to verify route is accessible
router.get('/test', (req, res) => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 [ratingOptions] ===== TEST ENDPOINT HIT =====');
  console.log('🔍 [ratingOptions] Request method:', req.method);
  console.log('🔍 [ratingOptions] Request path:', req.path);
  console.log('🔍 [ratingOptions] Request URL:', req.url);
  console.log('🔍 [ratingOptions] Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('🔍 [ratingOptions] Timestamp:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════');
  res.json({ 
    message: 'Rating options route is accessible',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    availableRoutes: ['GET /', 'GET /test', 'GET /manage', 'POST /', 'PUT /:id', 'DELETE /:id']
  });
});

// Test POST endpoint - no auth - to verify POST route is registered
router.post('/test-post', (req, res) => {
  console.log('🔍 [ratingOptions] POST /test-post hit');
  res.json({ 
    message: 'POST route is accessible',
    method: req.method,
    body: req.body
  });
});

// Get rating options for company
router.get('/', (req, res, next) => {
  console.log('🔍 [ratingOptions] Route handler called - BEFORE authenticateToken');
  console.log('🔍 [ratingOptions] Request method:', req.method);
  console.log('🔍 [ratingOptions] Request path:', req.path);
  next();
}, authenticateToken, async (req, res) => {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 [ratingOptions] ===== REQUEST RECEIVED =====');
    console.log('🔍 [ratingOptions] Route handler INSIDE - AFTER authenticateToken');
    console.log('🔍 [ratingOptions] Timestamp:', new Date().toISOString());
    console.log('🔍 [ratingOptions] Request headers:', JSON.stringify(req.headers, null, 2));
    
    // Log user details
    console.log('🔍 [ratingOptions] User object:', JSON.stringify(req.user, null, 2));
    console.log('🔍 [ratingOptions] User ID:', req.user.id);
    console.log('🔍 [ratingOptions] User Role:', req.user.role);
    console.log('🔍 [ratingOptions] Company ID:', req.user.company_id);
    console.log('🔍 [ratingOptions] Company ID type:', typeof req.user.company_id);
    console.log('🔍 [ratingOptions] Company ID is null?', req.user.company_id === null);
    console.log('🔍 [ratingOptions] Company ID is undefined?', req.user.company_id === undefined);
    
    // First, check what companies have rating options
    const allCompaniesCheck = await query('SELECT DISTINCT company_id FROM rating_options ORDER BY company_id');
    console.log('🔍 [ratingOptions] Companies with rating options:', allCompaniesCheck.rows.map(r => r.company_id));
    
    // Build query based on user role
    let result;
    let queryText;
    let queryParams;
    
    if (req.user.role === 'super_admin' || !req.user.company_id) {
      console.log('🔍 [ratingOptions] Using SUPER_ADMIN query path');
      queryText = `SELECT * FROM rating_options 
                    WHERE is_active = true 
                    ORDER BY rating_value, display_order
                    LIMIT 10`;
      queryParams = [];
      console.log('🔍 [ratingOptions] Query text:', queryText);
      console.log('🔍 [ratingOptions] Query params:', queryParams);
    } else {
      console.log('🔍 [ratingOptions] Using REGULAR USER query path');
      queryText = `SELECT * FROM rating_options 
                   WHERE company_id = $1 AND is_active = true 
                   ORDER BY display_order, rating_value`;
      queryParams = [req.user.company_id];
      console.log('🔍 [ratingOptions] Query text:', queryText);
      console.log('🔍 [ratingOptions] Query params:', JSON.stringify(queryParams));
      console.log('🔍 [ratingOptions] Query param company_id value:', queryParams[0]);
      console.log('🔍 [ratingOptions] Query param company_id type:', typeof queryParams[0]);
    }
    
    console.log('🔍 [ratingOptions] Executing query...');
    result = await query(queryText, queryParams);
    console.log('🔍 [ratingOptions] Query executed successfully');
    console.log('🔍 [ratingOptions] Result row count:', result.rows.length);
    
    if (result.rows.length > 0) {
      console.log('✅ [ratingOptions] Query returned', result.rows.length, 'rows');
      console.log('✅ [ratingOptions] First row:', JSON.stringify(result.rows[0], null, 2));
      result.rows.forEach((row, idx) => {
        console.log(`✅ [ratingOptions] Row ${idx + 1}:`, {
          id: row.id,
          company_id: row.company_id,
          rating_value: row.rating_value,
          label: row.label,
          is_active: row.is_active
        });
      });
    } else {
      console.warn('⚠️ [ratingOptions] Query returned ZERO rows');
      console.warn('⚠️ [ratingOptions] User company_id:', req.user.company_id);
      
      // Check if rating_options table exists and has any data
      const checkTable = await query('SELECT COUNT(*) as count FROM rating_options');
      const totalCount = parseInt(checkTable.rows[0]?.count || '0');
      console.log('🔍 [ratingOptions] Total rating_options in database:', totalCount);
      
      // Check if there are options for other companies
      const checkAll = await query('SELECT company_id, COUNT(*) as count FROM rating_options GROUP BY company_id ORDER BY company_id');
      console.log('🔍 [ratingOptions] Rating options by company:');
      checkAll.rows.forEach(row => {
        console.log(`  - Company ID ${row.company_id}: ${row.count} options`);
      });
      
      // Check if there are options for the specific company_id
      if (req.user.company_id) {
        const checkSpecific = await query('SELECT * FROM rating_options WHERE company_id = $1', [req.user.company_id]);
        console.log('🔍 [ratingOptions] Options for company_id', req.user.company_id, ':', checkSpecific.rows.length);
        if (checkSpecific.rows.length > 0) {
          console.log('🔍 [ratingOptions] Found options but is_active might be false');
          checkSpecific.rows.forEach(row => {
            console.log(`  - ID ${row.id}: rating_value=${row.rating_value}, is_active=${row.is_active}`);
          });
        }
      }
    }
    
    const responseData = { rating_options: result.rows };
    console.log('🔍 [ratingOptions] Response data:', JSON.stringify(responseData, null, 2));
    console.log('🔍 [ratingOptions] Response rating_options array length:', responseData.rating_options.length);
    
    res.json(responseData);
    console.log('✅ [ratingOptions] Response sent successfully');
    console.log('═══════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ [ratingOptions] ===== ERROR OCCURRED =====');
    console.error('❌ [ratingOptions] Error message:', error.message);
    console.error('❌ [ratingOptions] Error name:', error.name);
    console.error('❌ [ratingOptions] Error stack:', error.stack);
    console.error('❌ [ratingOptions] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('═══════════════════════════════════════════════════════════');
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get all rating options for HR management (including inactive)
router.get('/manage', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM rating_options 
       WHERE company_id = $1 
       ORDER BY display_order, rating_value`,
      [req.user.company_id]
    );
    res.json({ rating_options: result.rows });
  } catch (error) {
    console.error('Get rating options for management error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Create rating option (HR only)
router.post('/', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    console.log('🔍 [ratingOptions] POST / - Create rating option');
    console.log('🔍 [ratingOptions] Request body:', req.body);
    console.log('🔍 [ratingOptions] User:', { id: req.user.id, role: req.user.role, company_id: req.user.company_id });
    
    const { rating_value, label, description, is_active, display_order } = req.body;

    // Allow 0 as a valid rating value, so check for null/undefined specifically
    if (rating_value === null || rating_value === undefined || !label || label.trim() === '') {
      console.error('❌ [ratingOptions] Validation failed:', { rating_value, label });
      return res.status(400).json({ error: 'Rating value and label are required' });
    }

    // Check if rating_value already exists for this company
    const existing = await query(
      'SELECT id FROM rating_options WHERE company_id = $1 AND rating_value = $2',
      [req.user.company_id, rating_value]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Rating value already exists for this company' });
    }

    console.log('🔍 [ratingOptions] Inserting rating option with values:', {
      company_id: req.user.company_id,
      rating_value,
      label,
      description: description || null,
      is_active: is_active !== undefined ? is_active : true,
      display_order: display_order || 1
    });

    const result = await query(
      `INSERT INTO rating_options (company_id, rating_value, label, description, is_active, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.user.company_id,
        rating_value,
        label,
        description || null,
        is_active !== undefined ? is_active : true,
        display_order || 1
      ]
    );

    console.log('✅ [ratingOptions] Rating option created:', result.rows[0]);
    res.json({ rating_option: result.rows[0] });
  } catch (error) {
    console.error('❌ [ratingOptions] Create rating option error:', error);
    console.error('❌ [ratingOptions] Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Update rating option (HR only)
router.put('/:id', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rating_value, label, description, is_active, display_order } = req.body;

    // Verify the rating option belongs to the user's company
    const check = await query(
      'SELECT id FROM rating_options WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Rating option not found' });
    }

    // If rating_value is being changed, check for duplicates
    if (rating_value !== undefined) {
      const existing = await query(
        'SELECT id FROM rating_options WHERE company_id = $1 AND rating_value = $2 AND id != $3',
        [req.user.company_id, rating_value, id]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Rating value already exists for this company' });
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (rating_value !== undefined) {
      updates.push(`rating_value = $${paramCount++}`);
      values.push(rating_value);
    }
    if (label !== undefined) {
      updates.push(`label = $${paramCount++}`);
      values.push(label);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramCount++}`);
      values.push(display_order);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Add WHERE clause parameters
    values.push(id, req.user.company_id);
    const whereIdParam = paramCount++;
    const whereCompanyParam = paramCount;

    const result = await query(
      `UPDATE rating_options 
       SET ${updates.join(', ')}
       WHERE id = $${whereIdParam} AND company_id = $${whereCompanyParam}
       RETURNING *`,
      values
    );

    res.json({ rating_option: result.rows[0] });
  } catch (error) {
    console.error('Update rating option error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Delete rating option (HR only)
router.delete('/:id', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify the rating option belongs to the user's company
    const check = await query(
      'SELECT id FROM rating_options WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Rating option not found' });
    }

    await query('DELETE FROM rating_options WHERE id = $1 AND company_id = $2', [id, req.user.company_id]);

    res.json({ message: 'Rating option deleted successfully' });
  } catch (error) {
    console.error('Delete rating option error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;

