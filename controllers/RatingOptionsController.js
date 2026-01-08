import BaseController from './BaseController.js';
import { query } from '../database/db.js';

class RatingOptionsController extends BaseController {
  // Get rating options for company
  async getAll(req, res) {
    const { rating_type, period } = req.query;
    let result;
    let queryText;
    let queryParams;
    
    // Determine rating_type from period if not explicitly provided
    let effectiveRatingType = rating_type;
    if (!effectiveRatingType && period) {
      effectiveRatingType = period; // 'yearly' or 'quarterly'
    }
    
    if (req.user.role === 'super_admin' || !req.user.company_id) {
      if (effectiveRatingType) {
        queryText = `SELECT * FROM rating_options 
                      WHERE is_active = true AND rating_type = $1
                      ORDER BY display_order, rating_value`;
        queryParams = [effectiveRatingType];
      } else {
        queryText = `SELECT * FROM rating_options 
                      WHERE is_active = true 
                      ORDER BY rating_type, display_order, rating_value`;
        queryParams = [];
      }
    } else {
      if (effectiveRatingType) {
        queryText = `SELECT * FROM rating_options 
                     WHERE company_id = $1 AND is_active = true AND rating_type = $2
                     ORDER BY display_order, rating_value`;
        queryParams = [req.user.company_id, effectiveRatingType];
      } else {
        queryText = `SELECT * FROM rating_options 
                     WHERE company_id = $1 AND is_active = true 
                     ORDER BY rating_type, display_order, rating_value`;
        queryParams = [req.user.company_id];
      }
    }
    
    result = await query(queryText, queryParams);

    return this.success(res, { rating_options: result.rows });
  }

  // Get all rating options for HR management (including inactive)
  async getAllForManagement(req, res) {
    const result = await query(
      `SELECT * FROM rating_options 
       WHERE company_id = $1 
       ORDER BY rating_type, display_order, rating_value`,
      [req.user.company_id]
    );

    return this.success(res, { rating_options: result.rows });
  }

  // Create rating option (HR only)
  async create(req, res) {
    const { rating_value, label, description, is_active, display_order, rating_type } = req.body;

    // Validate rating_type
    const validRatingTypes = ['yearly', 'quarterly', 'qualitative'];
    if (!rating_type || !validRatingTypes.includes(rating_type)) {
      return this.validationError(res, 'Valid rating_type is required (yearly, quarterly, or qualitative)');
    }

    // For qualitative, rating_value is optional (string-based ratings)
    // For quantitative (yearly/quarterly), rating_value is required
    if (rating_type !== 'qualitative' && (rating_value === null || rating_value === undefined)) {
      return this.validationError(res, 'Rating value is required for yearly and quarterly ratings');
    }

    if (!label || label.trim() === '') {
      return this.validationError(res, 'Label is required');
    }

    // Check if rating_value already exists for this company and rating_type
    if (rating_value !== null && rating_value !== undefined) {
      const existing = await query(
        'SELECT id FROM rating_options WHERE company_id = $1 AND rating_value = $2 AND rating_type = $3',
        [req.user.company_id, rating_value, rating_type]
      );

      if (existing.rows.length > 0) {
        return this.validationError(res, `Rating value already exists for ${rating_type} ratings`);
      }
    }

    const result = await query(
      `INSERT INTO rating_options (company_id, rating_value, label, description, is_active, display_order, rating_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.company_id,
        rating_value,
        label,
        description || null,
        is_active !== undefined ? is_active : true,
        display_order || 1,
        rating_type
      ]
    );

    return this.success(res, { rating_option: result.rows[0] });
  }

  // Update rating option (HR only)
  async update(req, res) {
    const { id } = req.params;
    const { rating_value, label, description, is_active, display_order } = req.body;

    // Verify the rating option belongs to the user's company
    const check = await query(
      'SELECT id FROM rating_options WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (check.rows.length === 0) {
      return this.notFound(res, 'Rating option not found');
    }

    // If rating_value is being changed, check for duplicates
    if (rating_value !== undefined) {
      const existing = await query(
        'SELECT id FROM rating_options WHERE company_id = $1 AND rating_value = $2 AND id != $3',
        [req.user.company_id, rating_value, id]
      );

      if (existing.rows.length > 0) {
        return this.validationError(res, 'Rating value already exists for this company');
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
    if (req.body.rating_type !== undefined) {
      const validRatingTypes = ['yearly', 'quarterly', 'qualitative'];
      if (!validRatingTypes.includes(req.body.rating_type)) {
        return this.validationError(res, 'Valid rating_type is required (yearly, quarterly, or qualitative)');
      }
      updates.push(`rating_type = $${paramCount++}`);
      values.push(req.body.rating_type);
    }

    if (updates.length === 0) {
      return this.validationError(res, 'No fields to update');
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

    return this.success(res, { rating_option: result.rows[0] });
  }

  // Delete rating option (HR only)
  async delete(req, res) {
    const { id } = req.params;

    // Verify the rating option belongs to the user's company
    const check = await query(
      'SELECT id FROM rating_options WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (check.rows.length === 0) {
      return this.notFound(res, 'Rating option not found');
    }

    await query('DELETE FROM rating_options WHERE id = $1 AND company_id = $2', [id, req.user.company_id]);

    return this.success(res, { message: 'Rating option deleted successfully' });
  }
}

export default new RatingOptionsController();
