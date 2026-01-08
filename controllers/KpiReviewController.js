import BaseController from './BaseController.js';
import { query } from '../database/db.js';
import { sendEmailWithFallback, emailTemplates, shouldSendHRNotification, getHREmails } from '../services/emailService.js';
import { generateKPIReviewPDF } from '../services/pdfService.js';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

class KpiReviewController extends BaseController {
  // Get all KPI reviews
  async getAll(req, res) {
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
         e.name as employee_name, m.name as manager_name,
         hr_resolver.name as rejection_resolved_by_name
         FROM kpi_reviews kr
         JOIN kpis k ON kr.kpi_id = k.id
         JOIN users e ON kr.employee_id = e.id
         JOIN users m ON kr.manager_id = m.id
         LEFT JOIN users hr_resolver ON kr.rejection_resolved_by = hr_resolver.id
         WHERE kr.company_id = $1
         ORDER BY kr.created_at DESC`,
        [req.user.company_id]
      );
    }

    return this.success(res, { reviews: result.rows });
  }

  // Get count of pending reviews (employee_submitted status) for manager
  async getPendingCount(req, res) {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM kpi_reviews kr
       JOIN kpis k ON kr.kpi_id = k.id
       WHERE kr.manager_id = $1 
         AND kr.company_id = $2
         AND kr.review_status = 'employee_submitted'`,
      [req.user.id, req.user.company_id]
    );

    return this.success(res, { count: parseInt(result.rows[0].count) || 0 });
  }

  // Get KPI review by ID
  async getById(req, res) {
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
      return this.notFound(res, 'KPI review not found');
    }

    const review = result.rows[0];

    // Check access permissions
    if (req.user.role === 'employee' && review.employee_id !== req.user.id) {
      return this.forbidden(res, 'Access denied');
    }
    if (req.user.role === 'manager' && review.manager_id !== req.user.id) {
      return this.forbidden(res, 'Access denied');
    }

    return this.success(res, { review });
  }

  // Get review by KPI ID (for creating review from acknowledged KPI)
  async getByKpiId(req, res) {
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
      return this.notFound(res, 'KPI not found');
    }

    const data = result.rows[0];

    // Check access permissions
    if (req.user.role === 'employee' && data.employee_id !== req.user.id) {
      return this.forbidden(res, 'Access denied');
    }
    if (req.user.role === 'manager' && data.manager_id !== req.user.id) {
      return this.forbidden(res, 'Access denied');
    }

    // If review exists, return it; otherwise return KPI data for creating review
    if (data.id) {
      return this.success(res, { review: data });
    } else {
      // Return KPI data formatted as review structure
      return this.success(res, { 
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
  }

  // Submit employee self-rating
  async submitSelfRating(req, res) {
    const { kpiId } = req.params;
    const { 
      employee_rating, 
      employee_comment, 
      employee_signature, 
      review_period, 
      review_quarter, 
      review_year,
      major_accomplishments,
      disappointments
    } = req.body;

    if (!employee_rating || !employee_signature) {
      return this.validationError(res, 'Employee rating and signature are required');
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
      return this.notFound(res, 'KPI not found');
    }

    const kpi = kpiResult.rows[0];

    // Verify employee owns this KPI
    if (req.user.role !== 'employee' || kpi.employee_id !== req.user.id) {
      return this.forbidden(res, 'Access denied');
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
          employee_rating, employee_comment, employee_signature, employee_signed_at, review_status,
          major_accomplishments, disappointments
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 'employee_submitted', $11, $12)
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
          major_accomplishments,
          disappointments,
        ]
      );
      review = insertResult.rows[0];
    } else {
      // Update existing review
      const updateResult = await query(
        `UPDATE kpi_reviews 
         SET employee_rating = $1, employee_comment = $2, employee_signature = $3,
         employee_signed_at = NOW(), review_status = 'employee_submitted', updated_at = NOW(),
         major_accomplishments = $5, disappointments = $6
         WHERE kpi_id = $4
         RETURNING *`,
        [employee_rating, employee_comment, employee_signature, kpiId, major_accomplishments, disappointments]
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

    return this.success(res, { review });
  }

  // Submit manager review
  async submitManagerReview(req, res) {
    const { reviewId } = req.params;
    const { 
      manager_rating, 
      manager_comment, 
      overall_manager_comment, 
      manager_signature, 
      qualitative_ratings,
      major_accomplishments_manager_comment,
      disappointments_manager_comment
    } = req.body;

    if (!manager_rating || !manager_signature) {
      return this.validationError(res, 'Manager rating and signature are required');
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
      return this.notFound(res, 'KPI review not found');
    }

    const review = reviewResult.rows[0];

    // Verify manager owns this review
    if (review.manager_id !== req.user.id) {
      return this.forbidden(res, 'Access denied');
    }

    // Update qualitative ratings for KPI items if provided
    if (qualitative_ratings && Array.isArray(qualitative_ratings)) {
      for (const qRating of qualitative_ratings) {
        if (qRating.item_id && qRating.rating) {
          await query(
            `UPDATE kpi_items 
             SET qualitative_rating = $1, qualitative_comment = $2, updated_at = NOW()
             WHERE id = $3 AND kpi_id = $4`,
            [qRating.rating, qRating.comment || null, qRating.item_id, review.kpi_id]
          );
        }
      }
    }

    // Update review with new status: awaiting_employee_confirmation
    const updateResult = await query(
      `UPDATE kpi_reviews 
       SET manager_rating = $1, manager_comment = $2, overall_manager_comment = $3,
       manager_signature = $4, manager_signed_at = NOW(), review_status = 'awaiting_employee_confirmation', 
       updated_at = NOW(), major_accomplishments_manager_comment = $6, disappointments_manager_comment = $7
       WHERE id = $5
       RETURNING *`,
      [manager_rating, manager_comment, overall_manager_comment, manager_signature, reviewId, 
       major_accomplishments_manager_comment, disappointments_manager_comment]
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

      // Send email notification to employee for confirmation
      const link = `${FRONTEND_URL}/employee/kpi-confirmation/${reviewId}`;
      await sendEmailWithFallback(
        req.user.company_id,
        review.employee_email,
        'KPI Review - Please Confirm Manager Rating',
        emailTemplates.reviewCompleted(review.employee_name, review.manager_name, link),
        '',
        'review_completed',
        {
          employeeName: review.employee_name,
          managerName: review.manager_name,
          link: link,
        }
      );

      // Notify HR in the same company
      const hrUsers = await query("SELECT id, email FROM users WHERE role = 'hr' AND company_id = $1", [req.user.company_id]);
      for (const hr of hrUsers.rows) {
        await query(
          `INSERT INTO notifications (recipient_id, message, type, related_review_id, company_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            hr.id,
            `KPI review submitted by ${review.manager_name} for ${review.employee_name} - Awaiting employee confirmation`,
            'awaiting_employee_confirmation',
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
          `Your manager ${review.manager_name} has completed your KPI review - Please confirm`,
          'awaiting_employee_confirmation',
          reviewId,
          req.user.company_id,
        ]
      );
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      // Continue even if PDF generation fails
    }

    return this.success(res, { review: updatedReview });
  }

  // Employee confirms or rejects manager rating
  async submitEmployeeConfirmation(req, res) {
    const { reviewId } = req.params;
    const { confirmation_status, rejection_note, signature } = req.body;

    // Validate confirmation status
    if (!['approved', 'rejected'].includes(confirmation_status)) {
      return this.validationError(res, 'Confirmation status must be either "approved" or "rejected"');
    }

    // If rejected, note is required
    if (confirmation_status === 'rejected' && !rejection_note) {
      return this.validationError(res, 'Rejection note is required when rejecting the review');
    }

    // If approved, signature is required
    if (confirmation_status === 'approved' && !signature) {
      return this.validationError(res, 'Signature is required when approving the review');
    }

    // Get review
    const reviewResult = await query(
      `SELECT kr.*, k.*,
       e.name as employee_name, e.email as employee_email,
       m.name as manager_name, m.email as manager_email, m.id as manager_id
       FROM kpi_reviews kr
       JOIN kpis k ON kr.kpi_id = k.id
       JOIN users e ON kr.employee_id = e.id
       JOIN users m ON kr.manager_id = m.id
       WHERE kr.id = $1`,
      [reviewId]
    );

    if (reviewResult.rows.length === 0) {
      return this.notFound(res, 'KPI review not found');
    }

    const review = reviewResult.rows[0];

    // Verify employee owns this review
    if (review.employee_id !== req.user.id) {
      return this.forbidden(res, 'Access denied');
    }

    // Verify review is awaiting confirmation
    if (review.review_status !== 'awaiting_employee_confirmation') {
      return this.validationError(res, 'Review is not awaiting employee confirmation');
    }

    // Update review based on confirmation status
    const newReviewStatus = confirmation_status === 'approved' ? 'completed' : 'rejected';
    
    const updateResult = await query(
      `UPDATE kpi_reviews 
       SET employee_confirmation_status = $1,
           employee_rejection_note = $2,
           employee_confirmation_signature = $3,
           employee_confirmation_signed_at = NOW(),
           review_status = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [confirmation_status, rejection_note || null, signature || null, newReviewStatus, reviewId]
    );

    const updatedReview = updateResult.rows[0];

    // Notify manager
    await query(
      `INSERT INTO notifications (recipient_id, message, type, related_review_id, company_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        review.manager_id,
        confirmation_status === 'approved' 
          ? `${review.employee_name} has approved the KPI review`
          : `${review.employee_name} has rejected the KPI review with note: "${rejection_note}"`,
        confirmation_status === 'approved' ? 'review_completed' : 'review_rejected',
        reviewId,
        req.user.company_id,
      ]
    );

    // Notify HR
    const hrUsers = await query("SELECT id FROM users WHERE role = 'hr' AND company_id = $1", [req.user.company_id]);
    for (const hr of hrUsers.rows) {
      await query(
        `INSERT INTO notifications (recipient_id, message, type, related_review_id, company_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          hr.id,
          confirmation_status === 'approved'
            ? `KPI review for ${review.employee_name} completed and approved`
            : `KPI review for ${review.employee_name} rejected by employee`,
          confirmation_status === 'approved' ? 'review_completed' : 'review_rejected',
          reviewId,
          req.user.company_id,
        ]
      );
    }

    // Send email to manager
    try {
      const managerLink = `${FRONTEND_URL}/manager/kpi-review/${reviewId}`;
      await sendEmailWithFallback(
        req.user.company_id,
        review.manager_email,
        confirmation_status === 'approved' 
          ? 'KPI Review Approved by Employee'
          : 'KPI Review Rejected by Employee',
        confirmation_status === 'approved'
          ? `Hello ${review.manager_name},\n\n${review.employee_name} has approved their KPI review.\n\nView details: ${managerLink}`
          : `Hello ${review.manager_name},\n\n${review.employee_name} has rejected their KPI review with the following note:\n\n"${rejection_note}"\n\nView details: ${managerLink}`,
        '',
        confirmation_status === 'approved' ? 'review_approved' : 'review_rejected_by_employee',
        {
          managerName: review.manager_name,
          employeeName: review.employee_name,
          link: managerLink,
          rejectionNote: rejection_note || '',
        }
      );
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Continue even if email fails
    }

    return this.success(res, {
      review: updatedReview,
      message: confirmation_status === 'approved' 
        ? 'Review approved successfully'
        : 'Review rejected successfully'
    });
  }

  // Mark rejection as resolved (HR only)
  async resolveRejection(req, res) {
    const { reviewId } = req.params;
    const { note } = req.body;

    // Update the review to mark rejection as resolved
    const result = await query(
      `UPDATE kpi_reviews 
       SET rejection_resolved_status = 'resolved',
           rejection_resolved_at = NOW(),
           rejection_resolved_by = $1,
           rejection_resolved_note = $2
       WHERE id = $3 AND company_id = $4
       RETURNING *`,
      [req.user.id, note || null, reviewId, req.user.company_id]
    );

    if (result.rows.length === 0) {
      return this.notFound(res, 'Review not found');
    }

    // Get the review with employee and manager info for notification
    const reviewInfo = await query(
      `SELECT kr.*, 
              e.name as employee_name, e.email as employee_email,
              m.name as manager_name, m.email as manager_email,
              k.title as kpi_title,
              hr.name as hr_name
       FROM kpi_reviews kr
       JOIN users e ON kr.employee_id = e.id
       JOIN users m ON kr.manager_id = m.id
       JOIN kpis k ON kr.kpi_id = k.id
       LEFT JOIN users hr ON kr.rejection_resolved_by = hr.id
       WHERE kr.id = $1`,
      [reviewId]
    );

    const review = reviewInfo.rows[0];

    // Send notification to employee and manager
    try {
      await sendEmailWithFallback(
        req.user.company_id,
        review.employee_email,
        'KPI Rejection Issue Resolved',
        emailTemplates.rejectionResolved(review.employee_name, review.kpi_title, review.hr_name || 'HR'),
        `<p>Dear ${review.employee_name},</p>
         <p>The rejection issue for your KPI "<strong>${review.kpi_title}</strong>" has been marked as resolved by ${review.hr_name || 'HR'}.</p>
         <p>If you have any questions, please contact your HR department.</p>
         <p>Thank you.</p>`,
        'rejection_resolved',
        {
          employeeName: review.employee_name,
          kpiTitle: review.kpi_title,
          hrName: review.hr_name || 'HR',
        }
      );

      await sendEmailWithFallback(
        req.user.company_id,
        review.manager_email,
        'KPI Rejection Issue Resolved',
        emailTemplates.rejectionResolved(review.manager_name, review.kpi_title, review.hr_name || 'HR'),
        `<p>Dear ${review.manager_name},</p>
         <p>The rejection issue for the KPI "<strong>${review.kpi_title}</strong>" for employee ${review.employee_name} has been marked as resolved by ${review.hr_name || 'HR'}.</p>
         <p>Thank you.</p>`,
        'rejection_resolved',
        {
          managerName: review.manager_name,
          employeeName: review.employee_name,
          kpiTitle: review.kpi_title,
          hrName: review.hr_name || 'HR',
        }
      );
    } catch (emailError) {
      console.error('Error sending resolution notification emails:', emailError);
    }

    return this.success(res, { 
      message: 'Rejection marked as resolved successfully',
      review: result.rows[0]
    });
  }
}

export default new KpiReviewController();
