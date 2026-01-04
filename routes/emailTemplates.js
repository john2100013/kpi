const express = require('express');
const { query } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get all email templates for the company (HR only)
router.get('/', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM email_templates WHERE company_id = $1 ORDER BY template_type',
      [req.user.company_id]
    );

    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Get email templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific email template (HR only)
router.get('/:id', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM email_templates WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Get email template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to convert HTML to plain text
const htmlToText = (html) => {
  if (!html) return '';
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
};

// Create or update email template (HR only)
router.post('/', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { template_type, subject, body_html, body_text, is_active } = req.body;

    if (!template_type || !subject || !body_html) {
      return res.status(400).json({ error: 'template_type, subject, and body_html are required' });
    }

    // Auto-generate text body from HTML if not provided
    const finalBodyText = body_text && body_text.trim() !== '' 
      ? body_text 
      : htmlToText(body_html);

    // Validate template_type
    const validTypes = [
      'kpi_setting_reminder',
      'kpi_review_reminder',
      'kpi_assigned',
      'kpi_acknowledged',
      'self_rating_submitted',
      'review_completed',
    ];

    if (!validTypes.includes(template_type)) {
      return res.status(400).json({ error: 'Invalid template_type' });
    }

    // Check if template already exists (upsert)
    const existingResult = await query(
      'SELECT id FROM email_templates WHERE company_id = $1 AND template_type = $2',
      [req.user.company_id, template_type]
    );

    if (existingResult.rows.length > 0) {
      // Update existing template
      const result = await query(
        `UPDATE email_templates 
         SET subject = $1, body_html = $2, body_text = $3, is_active = $4, updated_at = NOW()
         WHERE id = $5 AND company_id = $6
         RETURNING *`,
        [
          subject,
          body_html,
          finalBodyText || null,
          is_active !== undefined ? is_active : true,
          existingResult.rows[0].id,
          req.user.company_id,
        ]
      );

      res.json({ template: result.rows[0], created: false });
    } else {
      // Create new template
      const result = await query(
        `INSERT INTO email_templates (company_id, template_type, subject, body_html, body_text, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          req.user.company_id,
          template_type,
          subject,
          body_html,
          finalBodyText || null,
          is_active !== undefined ? is_active : true,
        ]
      );

      res.status(201).json({ template: result.rows[0], created: true });
    }
  } catch (error) {
    console.error('Create/Update email template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update email template (HR only)
router.patch('/:id', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body_html, body_text, is_active } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (subject !== undefined) {
      updateFields.push(`subject = $${paramCount}`);
      values.push(subject);
      paramCount++;
    }

    if (body_html !== undefined) {
      updateFields.push(`body_html = $${paramCount}`);
      values.push(body_html);
      paramCount++;
    }

    if (body_text !== undefined) {
      updateFields.push(`body_text = $${paramCount}`);
      values.push(body_text);
      paramCount++;
    }

    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id, req.user.company_id);

    const result = await query(
      `UPDATE email_templates 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramCount} AND company_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Update email template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete email template (HR only)
router.delete('/:id', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM email_templates WHERE id = $1 AND company_id = $2 RETURNING *',
      [id, req.user.company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete email template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

