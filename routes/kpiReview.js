const express = require('express');
const { query } = require('../database/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { sendEmailWithFallback, emailTemplates, shouldSendHRNotification, getHREmails } = require('../services/emailService');
const { generateKPIReviewPDF } = require('../services/pdfService');
const router = express.Router();
require('dotenv').config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Get all KPI reviews
router.get('/', authenticateToken, async (req, res) => {
  try {
    let result;
    
    if (req.user.role === 'employee') {
      result = await query(
        `SELECT kr.*, k.title as kpi_title, k.description as kpi_description,
         k.target_value, k.measure_unit,
         e.name as employee_name, m.name as manager_name
         FROM kpi_reviews kr
         JOIN kpis k ON kr.kpi_id = k.id
         JOIN users e ON kr.employee_id = e.id
         JOIN users m ON kr.manager_id = m.id
         WHERE kr.employee_id = $1 AND kr.company_id = $2
         ORDER BY kr.created_at DESC`,
        [req.user.id, req.user.company_id]
      );
    } else if (req.user.role === 'manager') {
      result = await query(
        `SELECT kr.*, k.title as kpi_title, k.description as kpi_description,
         k.target_value, k.measure_unit,
         e.name as employee_name, e.department as employee_department,
         m.name as manager_name
         FROM kpi_reviews kr
         JOIN kpis k ON kr.kpi_id = k.id
         JOIN users e ON kr.employee_id = e.id
         JOIN users m ON kr.manager_id = m.id
         WHERE kr.manager_id = $1 AND kr.company_id = $2
         ORDER BY kr.created_at DESC`,
        [req.user.id, req.user.company_id]
      );
    } else {
      // HR sees all in their company
      result = await query(
        `SELECT kr.*, k.title as kpi_title, k.description as kpi_description,
         k.target_value, k.measure_unit,
         e.name as employee_name, m.name as manager_name
         FROM kpi_reviews kr
         JOIN kpis k ON kr.kpi_id = k.id
         JOIN users e ON kr.employee_id = e.id
         JOIN users m ON kr.manager_id = m.id
         WHERE kr.company_id = $1
         ORDER BY kr.created_at DESC`,
        [req.user.company_id]
      );
    }

    res.json({ reviews: result.rows });
  } catch (error) {
    console.error('Get KPI reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get KPI review by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT kr.*, k.*,
       e.name as employee_name, e.department as employee_department, e.position as employee_position,
       e.payroll_number as employee_payroll,
       m.name as manager_name, m.position as manager_position
       FROM kpi_reviews kr
       JOIN kpis k ON kr.kpi_id = k.id
       JOIN users e ON kr.employee_id = e.id
       JOIN users m ON kr.manager_id = m.id
       WHERE kr.id = $1 AND kr.company_id = $2`,
      [id, req.user.company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'KPI review not found' });
    }

    const review = result.rows[0];

    // Check access permissions
    if (req.user.role === 'employee' && review.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'manager' && review.manager_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ review });
  } catch (error) {
    console.error('Get KPI review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get review by KPI ID (for creating review from acknowledged KPI)
router.get('/kpi/:kpiId', authenticateToken, async (req, res) => {
  try {
    const { kpiId } = req.params;

    const result = await query(
      `SELECT kr.*, k.*,
       e.name as employee_name, e.department as employee_department, e.position as employee_position,
       e.payroll_number as employee_payroll,
       m.name as manager_name, m.position as manager_position
       FROM kpis k
       LEFT JOIN kpi_reviews kr ON kr.kpi_id = k.id
       JOIN users e ON k.employee_id = e.id
       JOIN users m ON k.manager_id = m.id
       WHERE k.id = $1`,
      [kpiId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    const data = result.rows[0];

    // Check access permissions
    if (req.user.role === 'employee' && data.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'manager' && data.manager_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If review exists, return it; otherwise return KPI data for creating review
    if (data.id) {
      res.json({ review: data });
    } else {
      // Return KPI data formatted as review structure
      res.json({ 
        review: {
          kpi_id: data.id,
          employee_id: data.employee_id,
          manager_id: data.manager_id,
          review_period: data.period,
          review_quarter: data.quarter,
          review_year: data.year,
          kpi_title: data.title,
          kpi_description: data.description,
          target_value: data.target_value,
          measure_unit: data.measure_unit,
          employee_name: data.employee_name,
          employee_department: data.employee_department,
          employee_position: data.employee_position,
          employee_payroll: data.employee_payroll,
          manager_name: data.manager_name,
          manager_position: data.manager_position,
          review_status: 'pending',
        }
      });
    }
  } catch (error) {
    console.error('Get KPI review by KPI ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit employee self-rating
router.post('/:kpiId/self-rating', authenticateToken, async (req, res) => {
  try {
    const { kpiId } = req.params;
    const { employee_rating, employee_comment, employee_signature, review_period, review_quarter, review_year } = req.body;

    if (!employee_rating || !employee_signature) {
      return res.status(400).json({ error: 'Employee rating and signature are required' });
    }

    // Get KPI
    const kpiResult = await query(
      `SELECT k.*, e.name as employee_name, e.email as employee_email,
       m.name as manager_name, m.email as manager_email
       FROM kpis k
       JOIN users e ON k.employee_id = e.id
       JOIN users m ON k.manager_id = m.id
       WHERE k.id = $1`,
      [kpiId]
    );

    if (kpiResult.rows.length === 0) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    const kpi = kpiResult.rows[0];

    // Verify employee owns this KPI
    if (req.user.role !== 'employee' || kpi.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if review already exists
    let reviewResult = await query(
      'SELECT * FROM kpi_reviews WHERE kpi_id = $1',
      [kpiId]
    );

    let review;
    if (reviewResult.rows.length === 0) {
      // Create new review
      const insertResult = await query(
        `INSERT INTO kpi_reviews (
          kpi_id, employee_id, manager_id, company_id, review_period, review_quarter, review_year,
          employee_rating, employee_comment, employee_signature, employee_signed_at, review_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 'employee_submitted')
        RETURNING *`,
        [
          kpiId,
          req.user.id,
          kpi.manager_id,
          req.user.company_id,
          review_period || kpi.period,
          review_quarter || kpi.quarter,
          review_year || kpi.year,
          employee_rating,
          employee_comment,
          employee_signature,
        ]
      );
      review = insertResult.rows[0];
    } else {
      // Update existing review
      const updateResult = await query(
        `UPDATE kpi_reviews 
         SET employee_rating = $1, employee_comment = $2, employee_signature = $3,
         employee_signed_at = NOW(), review_status = 'employee_submitted', updated_at = NOW()
         WHERE kpi_id = $4
         RETURNING *`,
        [employee_rating, employee_comment, employee_signature, kpiId]
      );
      review = updateResult.rows[0];
    }

    // Send email notification to manager
    const link = `${FRONTEND_URL}/manager/kpi-review/${review.id}`;
    const emailHtml = emailTemplates.selfRatingSubmitted(kpi.manager_name, kpi.employee_name, link);
    
    await sendEmailWithFallback(
      req.user.company_id,
      kpi.manager_email,
      'Self-Rating Submitted',
      emailHtml,
      '',
      'self_rating_submitted',
      {
        managerName: kpi.manager_name,
        employeeName: kpi.employee_name,
        link: link,
      }
    );

    // Send email to HR if enabled
    const hrShouldReceive = await shouldSendHRNotification(req.user.company_id);
    if (hrShouldReceive) {
      const hrEmails = await getHREmails(req.user.company_id);
      for (const hrEmail of hrEmails) {
        await sendEmailWithFallback(
          req.user.company_id,
          hrEmail,
          'Self-Rating Submitted',
          emailHtml,
          '',
          'self_rating_submitted',
          {
            managerName: kpi.manager_name,
            employeeName: kpi.employee_name,
            link: `${FRONTEND_URL}/hr/kpi-details/${kpiId}`,
          }
        );
      }
    }

    // Create in-app notification for manager
    await query(
      `INSERT INTO notifications (recipient_id, message, type, related_review_id, company_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        kpi.manager_id,
        `${kpi.employee_name} has submitted self-rating for KPI review`,
        'self_rating_submitted',
        review.id,
        req.user.company_id,
      ]
    );

    // Create in-app notification for HR
    const hrUsers = await query(
      "SELECT id FROM users WHERE role = 'hr' AND company_id = $1",
      [req.user.company_id]
    );
    for (const hr of hrUsers.rows) {
      await query(
        `INSERT INTO notifications (recipient_id, message, type, related_review_id, company_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          hr.id,
          `${kpi.employee_name} has submitted self-rating for KPI review`,
          'self_rating_submitted',
          review.id,
          req.user.company_id,
        ]
      );
    }

    res.json({ review });
  } catch (error) {
    console.error('Submit self-rating error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit manager review
router.post('/:reviewId/manager-review', authenticateToken, authorizeRoles('manager'), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { manager_rating, manager_comment, overall_manager_comment, manager_signature } = req.body;

    if (!manager_rating || !manager_signature) {
      return res.status(400).json({ error: 'Manager rating and signature are required' });
    }

    // Get review
    const reviewResult = await query(
      `SELECT kr.*, k.*,
       e.name as employee_name, e.email as employee_email,
       m.name as manager_name, m.email as manager_email
       FROM kpi_reviews kr
       JOIN kpis k ON kr.kpi_id = k.id
       JOIN users e ON kr.employee_id = e.id
       JOIN users m ON kr.manager_id = m.id
       WHERE kr.id = $1`,
      [reviewId]
    );

    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'KPI review not found' });
    }

    const review = reviewResult.rows[0];

    // Verify manager owns this review
    if (review.manager_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update review
    const updateResult = await query(
      `UPDATE kpi_reviews 
       SET manager_rating = $1, manager_comment = $2, overall_manager_comment = $3,
       manager_signature = $4, manager_signed_at = NOW(), review_status = 'manager_submitted', updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [manager_rating, manager_comment, overall_manager_comment, manager_signature, reviewId]
    );

    const updatedReview = updateResult.rows[0];

    // Generate PDF
    const kpiData = [{
      title: review.title || 'KPI',
      description: review.description,
      target_value: review.target_value,
      measure_unit: review.measure_unit,
    }];

    const employeeData = {
      name: review.employee_name,
      position: review.employee_position,
      department: review.employee_department,
      payroll_number: review.employee_payroll,
    };

    const managerData = {
      name: review.manager_name,
      position: review.manager_position,
    };

    try {
      const { filePath, fileName } = await generateKPIReviewPDF(
        updatedReview,
        kpiData,
        employeeData,
        managerData
      );

      // Update review with PDF path
      await query(
        'UPDATE kpi_reviews SET pdf_generated = true, pdf_path = $1 WHERE id = $2',
        [filePath, reviewId]
      );

      // Send email notification to employee
      const link = `${FRONTEND_URL}/kpi-review/${reviewId}`;
      await sendEmail(
        review.employee_email,
        'KPI Review Completed',
        emailTemplates.reviewCompleted(review.employee_name, review.manager_name, link)
      );

      // Notify HR in the same company
      const hrUsers = await query("SELECT id, email FROM users WHERE role = 'hr' AND company_id = $1", [req.user.company_id]);
      for (const hr of hrUsers.rows) {
        await query(
          `INSERT INTO notifications (recipient_id, message, type, related_review_id, company_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            hr.id,
            `KPI review completed for ${review.employee_name} by ${review.manager_name}`,
            'review_completed',
            reviewId,
            req.user.company_id,
          ]
        );
      }

      // Create in-app notification for employee
      await query(
        `INSERT INTO notifications (recipient_id, message, type, related_review_id, company_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          review.employee_id,
          `Your manager ${review.manager_name} has completed your KPI review`,
          'review_completed',
          reviewId,
          req.user.company_id,
        ]
      );
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      // Continue even if PDF generation fails
    }

    res.json({ review: updatedReview });
  } catch (error) {
    console.error('Submit manager review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
