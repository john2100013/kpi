import { BaseController } from './BaseController.js';
import { query } from '../database/db.js';
import { sendEmailWithFallback, emailTemplates, shouldSendHRNotification, getHREmails } from '../services/emailService.js';
import { generateAcknowledgedKPIPDF, generateCompletedReviewPDF } from '../services/pdfService.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * KpisController
 * Handles all KPI-related operations including:
 * - KPI creation, retrieval, and updates
 * - KPI status filtering (pending, acknowledged, completed)
 * - PDF generation for acknowledged and reviewed KPIs
 * - Employee performance tracking
 * - Dashboard statistics
 */
class KpisController extends BaseController {
  /**
   * Get all KPIs based on user role
   * GET /
   */
  async getAll(req, res) {
    try {
      let result;
      
      if (req.user.role === 'employee') {
        result = await query(
          `SELECT k.*, 
           e.name as employee_name, e.department as employee_department,
           m.name as manager_name
           FROM kpis k
           JOIN users e ON k.employee_id = e.id
           JOIN users m ON k.manager_id = m.id
           WHERE k.employee_id = $1 AND k.company_id = $2
           ORDER BY k.created_at DESC`,
          [req.user.id, req.user.company_id]
        );
      } else if (req.user.role === 'manager') {
        result = await query(
          `SELECT k.*, 
           e.name as employee_name, e.department as employee_department,
           m.name as manager_name
           FROM kpis k
           JOIN users e ON k.employee_id = e.id
           JOIN users m ON k.manager_id = m.id
           WHERE k.manager_id = $1 AND k.company_id = $2
           ORDER BY k.created_at DESC`,
          [req.user.id, req.user.company_id]
        );
      } else {
        // HR sees all in their company
        result = await query(
          `SELECT k.*, 
           e.name as employee_name, e.department as employee_department,
           m.name as manager_name
           FROM kpis k
           JOIN users e ON k.employee_id = e.id
           JOIN users m ON k.manager_id = m.id
           WHERE k.company_id = $1
           ORDER BY k.created_at DESC`,
          [req.user.company_id]
        );
      }

      // Fetch items for each KPI
      const kpisWithItems = await Promise.all(
        result.rows.map(async (kpi) => {
          const itemsResult = await query(
            'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
            [kpi.id]
          );
          return {
            ...kpi,
            items: itemsResult.rows,
            item_count: itemsResult.rows.length,
          };
        })
      );

      return this.success(res, { kpis: kpisWithItems });
    } catch (error) {
      console.error('Get KPIs error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get paginated KPIs with filters (for HR) - optimized for large datasets
   * GET /paginated
   */
  async getPaginated(req, res) {
    try {
      const { page = 1, limit = 25, department, status, period, manager, search } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build dynamic WHERE clauses
      const conditions = ['k.company_id = $1'];
      const params = [req.user.company_id];
      let paramIndex = 2;

      // Department filter
      if (department) {
        conditions.push(`e.department = $${paramIndex}`);
        params.push(department);
        paramIndex++;
      }

      // Manager filter
      if (manager) {
        conditions.push(`k.manager_id = $${paramIndex}`);
        params.push(parseInt(manager));
        paramIndex++;
      }

      // Employee filter
      if (req.query.employee_id) {
        conditions.push(`k.employee_id = $${paramIndex}`);
        params.push(parseInt(req.query.employee_id));
        paramIndex++;
      }

      // Period filter
      if (period) {
        const [periodType, quarter, year] = period.split('|');
        if (periodType === 'quarterly' && quarter) {
          conditions.push(`k.period = 'quarterly' AND k.quarter = $${paramIndex} AND k.year = $${paramIndex + 1}`);
          params.push(quarter, parseInt(year));
          paramIndex += 2;
        } else if (periodType === 'annual') {
          conditions.push(`k.period = 'annual' AND k.year = $${paramIndex}`);
          params.push(parseInt(year));
          paramIndex++;
        }
      }

      // Status filter
      if (status) {
        if (status === 'pending') {
          conditions.push(`k.status = 'pending'`);
        } else if (status === 'acknowledged') {
          conditions.push(`k.status = 'acknowledged' AND NOT EXISTS (SELECT 1 FROM kpi_reviews kr WHERE kr.kpi_id = k.id)`);
        } else if (status === 'employee_submitted') {
          conditions.push(`EXISTS (SELECT 1 FROM kpi_reviews kr WHERE kr.kpi_id = k.id AND kr.review_status = 'employee_submitted')`);
        } else if (status === 'completed') {
          conditions.push(`EXISTS (SELECT 1 FROM kpi_reviews kr WHERE kr.kpi_id = k.id AND kr.review_status IN ('manager_submitted', 'completed'))`);
        } else if (status === 'rejected') {
          conditions.push(`EXISTS (SELECT 1 FROM kpi_reviews kr WHERE kr.kpi_id = k.id AND kr.review_status = 'rejected')`);
        }
      }

      // Search filter
      if (search) {
        conditions.push(`(
          e.name ILIKE $${paramIndex} OR 
          e.department ILIKE $${paramIndex} OR 
          e.payroll_number ILIKE $${paramIndex} OR
          m.name ILIKE $${paramIndex} OR
          k.title ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await query(
        `SELECT COUNT(DISTINCT k.id) as total
         FROM kpis k
         JOIN users e ON k.employee_id = e.id
         JOIN users m ON k.manager_id = m.id
         WHERE ${whereClause}`,
        params
      );

      const total = parseInt(countResult.rows[0].total);

      // Get paginated results - optimized with indexes
      const result = await query(
        `SELECT k.*, 
         e.name as employee_name, 
         e.department as employee_department,
         e.payroll_number as employee_payroll_number,
         m.name as manager_name
         FROM kpis k
         JOIN users e ON k.employee_id = e.id
         JOIN users m ON k.manager_id = m.id
         WHERE ${whereClause}
         ORDER BY k.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parseInt(limit), offset]
      );

      return this.success(res, { 
        kpis: result.rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      });
    } catch (error) {
      console.error('Get paginated KPIs error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get KPIs that are acknowledged but don't have reviews yet
   * GET /acknowledged-review-pending
   */
  async getAcknowledgedReviewPending(req, res) {
    try {
      let result;
      
      if (req.user.role === 'manager') {
        // Managers see only their team's KPIs
        result = await query(
          `SELECT k.*, 
           e.name as employee_name, e.department as employee_department,
           e.payroll_number as employee_payroll_number,
           m.name as manager_name
           FROM kpis k
           JOIN users e ON k.employee_id = e.id
           JOIN users m ON k.manager_id = m.id
           LEFT JOIN kpi_reviews kr ON k.id = kr.kpi_id
           WHERE k.manager_id = $1 
             AND k.company_id = $2
             AND k.status = 'acknowledged'
             AND kr.id IS NULL
           ORDER BY k.employee_signed_at DESC, k.created_at DESC`,
          [req.user.id, req.user.company_id]
        );
      } else {
        // HR sees all in their company
        result = await query(
          `SELECT k.*, 
           e.name as employee_name, e.department as employee_department,
           e.payroll_number as employee_payroll_number,
           m.name as manager_name
           FROM kpis k
           JOIN users e ON k.employee_id = e.id
           JOIN users m ON k.manager_id = m.id
           LEFT JOIN kpi_reviews kr ON k.id = kr.kpi_id
           WHERE k.company_id = $1
             AND k.status = 'acknowledged'
             AND kr.id IS NULL
           ORDER BY k.employee_signed_at DESC, k.created_at DESC`,
          [req.user.company_id]
        );
      }

      // Fetch items for each KPI
      const kpisWithItems = await Promise.all(
        result.rows.map(async (kpi) => {
          const itemsResult = await query(
            'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
            [kpi.id]
          );
          return {
            ...kpi,
            items: itemsResult.rows,
            item_count: itemsResult.rows.length,
          };
        })
      );

      return this.success(res, { kpis: kpisWithItems });
    } catch (error) {
      console.error('Get acknowledged-review-pending KPIs error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get KPIs where KPI setting is fully completed (acknowledged and signed)
   * GET /setting-completed
   */
  async getSettingCompleted(req, res) {
    try {
      let result;

      if (req.user.role === 'employee') {
        // Employees see only their own KPIs
        result = await query(
          `SELECT k.*, 
           e.name as employee_name, e.department as employee_department,
           e.payroll_number as employee_payroll_number,
           m.name as manager_name
           FROM kpis k
           JOIN users e ON k.employee_id = e.id
           JOIN users m ON k.manager_id = m.id
           WHERE k.employee_id = $1 
             AND k.company_id = $2
             AND k.status = 'acknowledged'
             AND k.employee_signature IS NOT NULL
             AND k.manager_signature IS NOT NULL
           ORDER BY k.employee_signed_at DESC, k.created_at DESC`,
          [req.user.id, req.user.company_id]
        );
      } else if (req.user.role === 'manager') {
        // Managers see only their team's KPIs
        result = await query(
          `SELECT k.*, 
           e.name as employee_name, e.department as employee_department,
           e.payroll_number as employee_payroll_number,
           m.name as manager_name
           FROM kpis k
           JOIN users e ON k.employee_id = e.id
           JOIN users m ON k.manager_id = m.id
           WHERE k.manager_id = $1 
             AND k.company_id = $2
             AND k.status = 'acknowledged'
             AND k.employee_signature IS NOT NULL
             AND k.manager_signature IS NOT NULL
           ORDER BY k.employee_signed_at DESC, k.created_at DESC`,
          [req.user.id, req.user.company_id]
        );
      } else {
        // HR sees all in their company
        result = await query(
          `SELECT k.*, 
           e.name as employee_name, e.department as employee_department,
           e.payroll_number as employee_payroll_number,
           m.name as manager_name
           FROM kpis k
           JOIN users e ON k.employee_id = e.id
           JOIN users m ON k.manager_id = m.id
           WHERE k.company_id = $1
             AND k.status = 'acknowledged'
             AND k.employee_signature IS NOT NULL
             AND k.manager_signature IS NOT NULL
           ORDER BY k.employee_signed_at DESC, k.created_at DESC`,
          [req.user.company_id]
        );
      }

      // Fetch items for each KPI
      const kpisWithItems = await Promise.all(
        result.rows.map(async (kpi) => {
          const itemsResult = await query(
            'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
            [kpi.id]
          );
          return {
            ...kpi,
            items: itemsResult.rows,
            item_count: itemsResult.rows.length,
          };
        })
      );

      return this.success(res, { kpis: kpisWithItems });
    } catch (error) {
      console.error('Get setting-completed KPIs error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Download PDF for acknowledged KPI
   * GET /:kpiId/download-pdf
   */
  async downloadPDF(req, res) {
    try {
      const { kpiId } = req.params;

      // Get KPI with all necessary data including signatures
      const kpiResult = await query(
        `SELECT k.id, k.employee_id, k.manager_id, k.company_id, k.title, k.description,
         k.period, k.quarter, k.year, k.meeting_date, k.status,
         k.manager_signature, k.manager_signed_at,
         k.employee_signature, k.employee_signed_at,
         k.created_at, k.updated_at,
         e.name as employee_name, e.department as employee_department,
         e.payroll_number as employee_payroll_number, e.position as employee_position,
         e.signature as employee_user_signature,
         m.name as manager_name, m.position as manager_position,
         m.signature as manager_user_signature
         FROM kpis k
         JOIN users e ON k.employee_id = e.id
         JOIN users m ON k.manager_id = m.id
         WHERE k.id = $1 AND k.company_id = $2`,
        [kpiId, req.user.company_id]
      );

      if (kpiResult.rows.length === 0) {
        return this.notFound(res, 'KPI not found');
      }

      const kpi = kpiResult.rows[0];

      // Verify access
      if (req.user.role === 'employee' && kpi.employee_id !== req.user.id) {
        return this.forbidden(res, 'Access denied');
      }
      if (req.user.role === 'manager' && kpi.manager_id !== req.user.id) {
        return this.forbidden(res, 'Access denied');
      }

      // Get KPI items
      const itemsResult = await query(
        'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
        [kpiId]
      );

      const kpiItems = itemsResult.rows;

      console.log('PDF Generation - Signature Debug:', {
        kpiId: kpiId,
        hasKpiManagerSignature: !!kpi.manager_signature,
        managerSignatureLength: kpi.manager_signature ? kpi.manager_signature.length : 0,
        hasKpiEmployeeSignature: !!kpi.employee_signature,
        employeeSignatureLength: kpi.employee_signature ? kpi.employee_signature.length : 0,
        hasUserManagerSignature: !!kpi.manager_user_signature,
        hasUserEmployeeSignature: !!kpi.employee_user_signature,
      });

      // Prepare data for PDF
      const employeeData = {
        name: kpi.employee_name,
        position: kpi.employee_position,
        department: kpi.employee_department,
        payroll_number: kpi.employee_payroll_number,
        signature: kpi.employee_user_signature, // From users table (fallback)
      };

      const managerData = {
        name: kpi.manager_name,
        position: kpi.manager_position,
        signature: kpi.manager_user_signature, // From users table (fallback)
      };

      // Log for debugging
      console.log('PDF Generation - Signature Check:', {
        kpiId: kpiId,
        hasKpiManagerSignature: !!kpi.kpi_manager_signature,
        hasKpiEmployeeSignature: !!kpi.kpi_employee_signature,
        hasUserManagerSignature: !!kpi.manager_user_signature,
        hasUserEmployeeSignature: !!kpi.employee_user_signature,
      });

      // Generate PDF
      const { filePath, fileName } = await generateAcknowledgedKPIPDF(
        kpi,
        kpiItems,
        employeeData,
        managerData
      );

      // Send file to client
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Error sending PDF:', err);
          if (!res.headersSent) {
            return this.error(res, 'Error downloading PDF');
          }
        }
      });
    } catch (error) {
      console.error('Download PDF error:', error);
      return this.error(res, error.message || 'Internal server error');
    }
  }

  /**
   * Download PDF for completed review
   * GET /:kpiId/review-download-pdf
   */
  async downloadReviewPDF(req, res) {
    try {
      const { kpiId } = req.params;

      // Get KPI with all necessary data including signatures
      const kpiResult = await query(
        `SELECT k.id, k.employee_id, k.manager_id, k.company_id, k.title, k.description,
         k.period, k.quarter, k.year, k.meeting_date, k.status,
         k.manager_signature, k.manager_signed_at,
         k.employee_signature, k.employee_signed_at,
         k.created_at, k.updated_at,
         e.name as employee_name, e.department as employee_department,
         e.payroll_number as employee_payroll_number, e.position as employee_position,
         e.signature as employee_user_signature,
         m.name as manager_name, m.position as manager_position,
         m.signature as manager_user_signature
         FROM kpis k
         JOIN users e ON k.employee_id = e.id
         JOIN users m ON k.manager_id = m.id
         WHERE k.id = $1 AND k.company_id = $2`,
        [kpiId, req.user.company_id]
      );

      if (kpiResult.rows.length === 0) {
        return this.notFound(res, 'KPI not found');
      }

      const kpi = kpiResult.rows[0];

      // Verify access
      if (req.user.role === 'employee' && kpi.employee_id !== req.user.id) {
        return this.forbidden(res, 'Access denied');
      }
      if (req.user.role === 'manager' && kpi.manager_id !== req.user.id) {
        return this.forbidden(res, 'Access denied');
      }

      // Get review data
      const reviewResult = await query(
        `SELECT kr.*, 
         kr.employee_signature as review_employee_signature,
         kr.manager_signature as review_manager_signature
         FROM kpi_reviews kr
         WHERE kr.kpi_id = $1 AND kr.company_id = $2
         AND (kr.review_status = 'manager_submitted' OR kr.review_status = 'completed')
         ORDER BY kr.updated_at DESC
         LIMIT 1`,
        [kpiId, req.user.company_id]
      );

      if (reviewResult.rows.length === 0) {
        return this.notFound(res, 'Review not found or not completed');
      }

      const review = reviewResult.rows[0];

      // Get KPI items
      const itemsResult = await query(
        'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
        [kpiId]
      );

      const kpiItems = itemsResult.rows;

      // Prepare data for PDF
      const employeeData = {
        name: kpi.employee_name,
        position: kpi.employee_position,
        department: kpi.employee_department,
        payroll_number: kpi.employee_payroll_number,
        signature: kpi.employee_user_signature, // From users table (fallback)
      };

      const managerData = {
        name: kpi.manager_name,
        position: kpi.manager_position,
        signature: kpi.manager_user_signature, // From users table (fallback)
      };

      // Prepare review data with signatures
      const reviewData = {
        ...review,
        manager_signature: review.review_manager_signature || kpi.manager_signature,
        employee_signature: review.review_employee_signature || kpi.employee_signature,
      };

      // Generate PDF
      const { filePath, fileName } = await generateCompletedReviewPDF(
        kpi,
        kpiItems,
        reviewData,
        employeeData,
        managerData
      );

      // Send file to client
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Error sending PDF:', err);
          if (!res.headersSent) {
            return this.error(res, 'Error sending PDF file');
          }
        }
      });
    } catch (error) {
      console.error('Download review PDF error:', error);
      return this.error(res, error.message || 'Internal server error');
    }
  }

  /**
   * Get KPIs with completed reviews
   * GET /review-completed
   */
  async getReviewCompleted(req, res) {
    try {
      let result;
      
      if (req.user.role === 'employee') {
        // Employees see only their own KPIs with completed reviews
        result = await query(
          `SELECT k.*, 
           e.name as employee_name, e.department as employee_department,
           e.payroll_number as employee_payroll_number,
           m.name as manager_name,
           kr.id as review_id,
           kr.review_status,
           kr.manager_rating,
           kr.employee_rating,
           kr.manager_signed_at,
           kr.pdf_generated,
           kr.pdf_path
           FROM kpis k
           JOIN users e ON k.employee_id = e.id
           JOIN users m ON k.manager_id = m.id
           JOIN kpi_reviews kr ON k.id = kr.kpi_id AND kr.company_id = k.company_id
           WHERE k.employee_id = $1 
             AND k.company_id = $2
             AND (kr.review_status = 'manager_submitted' OR kr.review_status = 'completed')
           ORDER BY COALESCE(kr.manager_signed_at, kr.updated_at) DESC, kr.updated_at DESC`,
          [req.user.id, req.user.company_id]
        );
      } else if (req.user.role === 'manager') {
        // Managers see only their team's KPIs with completed reviews
        result = await query(
          `SELECT k.*, 
           e.name as employee_name, e.department as employee_department,
           e.payroll_number as employee_payroll_number,
           m.name as manager_name,
           kr.id as review_id,
           kr.review_status,
           kr.manager_rating,
           kr.employee_rating,
           kr.manager_signed_at,
           kr.pdf_generated,
           kr.pdf_path
           FROM kpis k
           JOIN users e ON k.employee_id = e.id
           JOIN users m ON k.manager_id = m.id
           JOIN kpi_reviews kr ON k.id = kr.kpi_id AND kr.company_id = k.company_id
           WHERE k.manager_id = $1 
             AND k.company_id = $2
             AND (kr.review_status = 'manager_submitted' OR kr.review_status = 'completed')
           ORDER BY COALESCE(kr.manager_signed_at, kr.updated_at) DESC, kr.updated_at DESC`,
          [req.user.id, req.user.company_id]
        );
      } else {
        // HR sees all in their company
        result = await query(
          `SELECT k.*, 
           e.name as employee_name, e.department as employee_department,
           e.payroll_number as employee_payroll_number,
           m.name as manager_name,
           kr.id as review_id,
           kr.review_status,
           kr.manager_rating,
           kr.employee_rating,
           kr.manager_signed_at,
           kr.pdf_generated,
           kr.pdf_path
           FROM kpis k
           JOIN users e ON k.employee_id = e.id
           JOIN users m ON k.manager_id = m.id
           JOIN kpi_reviews kr ON k.id = kr.kpi_id AND kr.company_id = k.company_id
           WHERE k.company_id = $1
             AND (kr.review_status = 'manager_submitted' OR kr.review_status = 'completed')
           ORDER BY COALESCE(kr.manager_signed_at, kr.updated_at) DESC, kr.updated_at DESC`,
          [req.user.company_id]
        );
      }

      // Fetch items for each KPI
      const kpisWithItems = await Promise.all(
        result.rows.map(async (kpi) => {
          const itemsResult = await query(
            'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
            [kpi.id]
          );
          return {
            ...kpi,
            items: itemsResult.rows,
            item_count: itemsResult.rows.length,
          };
        })
      );

      return this.success(res, { kpis: kpisWithItems });
    } catch (error) {
      console.error('Get review-completed KPIs error:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      return this.error(res, error.message || 'Internal server error');
    }
  }

  /**
   * Get employee performance data (all completed reviews for an employee)
   * GET /employee-performance/:employeeId
   */
  async getEmployeePerformance(req, res) {
    try {
      const { employeeId } = req.params;
      
      // Verify access
      if (req.user.role === 'manager') {
        // Manager can only see their direct reports
        const employeeCheck = await query(
          'SELECT id FROM users WHERE id = $1 AND manager_id = $2 AND company_id = $3',
          [employeeId, req.user.id, req.user.company_id]
        );
        if (employeeCheck.rows.length === 0) {
          return this.forbidden(res, 'Access denied: Employee not in your team');
        }
      } else if (req.user.role === 'hr') {
        // HR can see all employees in their company
        const employeeCheck = await query(
          'SELECT id FROM users WHERE id = $1 AND company_id = $2',
          [employeeId, req.user.company_id]
        );
        if (employeeCheck.rows.length === 0) {
          return this.forbidden(res, 'Access denied: Employee not in your company');
        }
      }

      // Get all completed reviews for this employee
      const result = await query(
        `SELECT k.*, 
         e.name as employee_name, e.department as employee_department,
         e.payroll_number as employee_payroll_number,
         m.name as manager_name,
         kr.id as review_id,
         kr.review_status,
         kr.manager_rating,
         kr.employee_rating,
         kr.manager_comment,
         kr.employee_comment,
         kr.manager_signed_at,
         kr.review_quarter,
         kr.review_year
         FROM kpis k
         JOIN users e ON k.employee_id = e.id
         JOIN users m ON k.manager_id = m.id
         JOIN kpi_reviews kr ON k.id = kr.kpi_id AND kr.company_id = k.company_id
         WHERE k.employee_id = $1 
           AND k.company_id = $2
           AND (kr.review_status = 'manager_submitted' OR kr.review_status = 'completed')
         ORDER BY k.year DESC, k.quarter DESC, k.period DESC`,
        [employeeId, req.user.company_id]
      );

      // Fetch items and calculate final ratings for each KPI
      const performanceData = await Promise.all(
        result.rows.map(async (kpi) => {
          const itemsResult = await query(
            'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
            [kpi.id]
          );
          
          // Parse manager ratings from JSON
          let managerItemRatings = {};
          try {
            const mgrData = JSON.parse(kpi.manager_comment || '{}');
            if (mgrData.items && Array.isArray(mgrData.items)) {
              mgrData.items.forEach((item) => {
                if (item.item_id) {
                  managerItemRatings[item.item_id] = parseFloat(item.rating) || 0;
                }
              });
            }
          } catch {
            // Not JSON, use legacy format
          }

          // Calculate final rating: Σ(manager_rating * goal_weight)
          let finalRating = 0;
          let totalWeight = 0;
          const itemCalculations = itemsResult.rows.map((item) => {
            let mgrRating = managerItemRatings[item.id] || 0;
            // Parse goal_weight as percentage (e.g., "40%" or "0.4" or "40")
            let weight = 0;
            if (item.goal_weight) {
              const weightStr = String(item.goal_weight).trim();
              if (weightStr.endsWith('%')) {
                weight = parseFloat(weightStr.replace('%', '')) / 100;
              } else {
                weight = parseFloat(weightStr);
                // If weight > 1, assume it's a percentage (e.g., 40 means 40%)
                if (weight > 1) {
                  weight = weight / 100;
                }
              }
            }
            // Ensure weight and rating are valid numbers
            if (isNaN(weight)) weight = 0;
            if (isNaN(mgrRating)) mgrRating = 0;
            const contribution = mgrRating * weight;
            finalRating += contribution;
            totalWeight += weight;
            return {
              item_id: item.id,
              title: item.title,
              manager_rating: mgrRating,
              goal_weight: weight,
              contribution: contribution,
            };
          });

          // Ensure finalRating and totalWeight are valid numbers
          if (isNaN(finalRating)) finalRating = 0;
          if (isNaN(totalWeight)) totalWeight = 0;

          return {
            ...kpi,
            items: itemsResult.rows,
            item_count: itemsResult.rows.length,
            final_rating: finalRating,
            total_weight: totalWeight,
            item_calculations: itemCalculations,
          };
        })
      );

      return this.success(res, { performance: performanceData });
    } catch (error) {
      console.error('Get employee performance error:', error);
      return this.error(res, error.message || 'Internal server error');
    }
  }

  /**
   * Get KPI by ID
   * GET /:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT k.*, 
         e.name as employee_name, e.department as employee_department, e.position as employee_position,
         e.payroll_number as employee_payroll, e.payroll_number as employee_payroll_number,
         e.employment_date as employee_employment_date,
         m.name as manager_name, m.position as manager_position
         FROM kpis k
         JOIN users e ON k.employee_id = e.id
         JOIN users m ON k.manager_id = m.id
         WHERE k.id = $1 AND k.company_id = $2`,
        [id, req.user.company_id]
      );

      if (result.rows.length === 0) {
        return this.notFound(res, 'KPI not found');
      }

      const kpi = result.rows[0];

      // Check access permissions
      if (req.user.role === 'employee' && kpi.employee_id !== req.user.id) {
        return this.forbidden(res, 'Access denied');
      }
      if (req.user.role === 'manager' && kpi.manager_id !== req.user.id) {
        return this.forbidden(res, 'Access denied');
      }

      // Fetch KPI items
      const itemsResult = await query(
        'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
        [id]
      );

      return this.success(res, { 
        kpi: {
          ...kpi,
          items: itemsResult.rows,
          item_count: itemsResult.rows.length,
        }
      });
    } catch (error) {
      console.error('Get KPI error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Create KPI Form with multiple items (Manager only)
   * POST /
   */
  async create(req, res) {
    try {
      const {
        employee_id,
        period,
        quarter,
        year,
        meeting_date,
        manager_signature,
        kpi_items,
      } = req.body;

      // Support legacy single KPI format for backward compatibility
      const legacyTitle = req.body.title;
      const legacyDescription = req.body.description;
      const legacyTargetValue = req.body.target_value;
      const legacyMeasureUnit = req.body.measure_unit;
      const legacyMeasureCriteria = req.body.measure_criteria;

      if (!employee_id || !period) {
        return this.validationError(res, 'Employee ID and period are required');
      }

      // Verify employee exists and is under this manager and same company
      const employeeCheck = await query(
        'SELECT id, name, email, manager_id, company_id FROM users WHERE id = $1 AND role = $2 AND company_id = $3',
        [employee_id, 'employee', req.user.company_id]
      );

      if (employeeCheck.rows.length === 0) {
        return this.notFound(res, 'Employee not found');
      }

      if (employeeCheck.rows[0].manager_id !== req.user.id) {
        return this.forbidden(res, 'You can only set KPIs for your team members');
      }

      // Validate that the period matches an active period setting in the database
      if (period === 'quarterly' && !quarter) {
        return this.validationError(res, 'quarter is required for quarterly KPIs');
      }

      let periodQuery = `
        SELECT * FROM kpi_period_settings 
        WHERE company_id = $1 AND period_type = $2 AND year = $3 AND is_active = true
      `;
      const periodParams = [req.user.company_id, period, year || new Date().getFullYear()];
      
      if (period === 'quarterly') {
        periodQuery += ` AND quarter = $4`;
        periodParams.push(quarter);
      } else {
        periodQuery += ` AND quarter IS NULL`;
      }

      const periodCheck = await query(periodQuery, periodParams);
      
      if (periodCheck.rows.length === 0) {
        return this.validationError(res, 
          `No active ${period} period setting found for ${quarter || ''} ${year || new Date().getFullYear()}. Please ensure HR has configured this period in Settings.`
        );
      }

      const periodSetting = periodCheck.rows[0];
      
      // Validate meeting_date is within the period range (optional validation - just log warning)
      if (meeting_date) {
        const meetingDateObj = new Date(meeting_date);
        const startDate = new Date(periodSetting.start_date);
        const endDate = new Date(periodSetting.end_date);
        
        if (meetingDateObj < startDate || meetingDateObj > endDate) {
          // Warning but not blocking - meeting can be scheduled outside period
          console.log(`⚠️  Meeting date ${meeting_date} is outside period range ${periodSetting.start_date} - ${periodSetting.end_date}`);
        }
      }

      // Prepare KPI items array
      let itemsToCreate = [];
      if (kpi_items && Array.isArray(kpi_items) && kpi_items.length > 0) {
        // New format: multiple items
        itemsToCreate = kpi_items.filter(item => item.title && item.title.trim() !== '');
      } else if (legacyTitle) {
        // Legacy format: single KPI
        itemsToCreate = [{
          title: legacyTitle,
          description: legacyDescription,
          target_value: legacyTargetValue,
          measure_unit: legacyMeasureUnit,
          measure_criteria: legacyMeasureCriteria,
        }];
      } else {
        return this.validationError(res, 'At least one KPI item is required');
      }

      if (itemsToCreate.length === 0) {
        return this.validationError(res, 'At least one valid KPI item is required');
      }

      // Generate a title for the KPI form (use first item's title or a generic one)
      const formTitle = itemsToCreate.length === 1 
        ? itemsToCreate[0].title 
        : `${itemsToCreate.length} KPIs - ${quarter || ''} ${year || ''}`;

      // Insert KPI Form (main record)
      const result = await query(
        `INSERT INTO kpis (
          employee_id, manager_id, company_id, title, description, period, quarter, year, 
          meeting_date, manager_signature, manager_signed_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 'pending')
        RETURNING *`,
        [
          employee_id,
          req.user.id,
          req.user.company_id,
          formTitle,
          `KPI Form with ${itemsToCreate.length} item(s)`,
          period,
          quarter,
          year,
          meeting_date,
          manager_signature,
        ]
      );

      const kpi = result.rows[0];

      // Insert KPI Items
      for (let i = 0; i < itemsToCreate.length; i++) {
        const item = itemsToCreate[i];
        await query(
          `INSERT INTO kpi_items (
            kpi_id, title, description, current_performance_status, target_value, expected_completion_date, measure_unit, goal_weight, item_order, is_qualitative
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            kpi.id,
            item.title,
            item.description || '',
            item.current_performance_status || '',
            item.target_value || '',
            item.expected_completion_date || null,
            item.measure_unit || '',
            item.goal_weight || item.measure_criteria || '', // Support legacy field name
            i + 1,
            item.is_qualitative || false, // Support qualitative items
          ]
        );
      }

      // Create reminders for KPI setting meeting
      if (meeting_date) {
        const reminderTypes = ['2_weeks', '1_week', '3_days', '2_days', '1_day', 'meeting_day'];
        for (const reminderType of reminderTypes) {
          await query(
            `INSERT INTO kpi_setting_reminders (kpi_id, employee_id, manager_id, company_id, meeting_date, reminder_type)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [kpi.id, employee_id, req.user.id, req.user.company_id, meeting_date, reminderType]
          );
        }
      }

      // Send email notification to employee
      const employee = employeeCheck.rows[0];
      const link = `${FRONTEND_URL}/employee/kpi-acknowledgement/${kpi.id}`;
      const emailHtml = emailTemplates.kpiAssigned(employee.name, req.user.name, link);
      
      await sendEmailWithFallback(
        req.user.company_id,
        employee.email,
        'New KPI Assigned',
        emailHtml,
        '',
        'kpi_assigned',
        {
          employeeName: employee.name,
          managerName: req.user.name,
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
            'New KPI Assigned',
            emailHtml,
            '',
            'kpi_assigned',
            {
              employeeName: employee.name,
              managerName: req.user.name,
              link: `${FRONTEND_URL}/hr/kpi-details/${kpi.id}`,
            }
          );
        }
      }

      // Create in-app notification
      await query(
        `INSERT INTO notifications (recipient_id, message, type, related_kpi_id, company_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          employee_id,
          `New KPI form with ${itemsToCreate.length} item(s) assigned by ${req.user.name}`,
          'kpi_assigned',
          kpi.id,
          req.user.company_id,
        ]
      );

      // Notify HR in the same company (in-app notifications)
      const hrUsers = await query("SELECT id, email FROM users WHERE role = 'hr' AND company_id = $1", [req.user.company_id]);
      for (const hr of hrUsers.rows) {
          await query(
            `INSERT INTO notifications (recipient_id, message, type, related_kpi_id, company_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              hr.id,
              `New KPI form set for ${employee.name} by ${req.user.name}`,
              'kpi_set',
              kpi.id,
              req.user.company_id,
            ]
          );
      }

      // Fetch the created KPI with its items
      const kpiWithItems = await query(
        `SELECT k.*, 
         e.name as employee_name, e.department as employee_department,
         m.name as manager_name
         FROM kpis k
         JOIN users e ON k.employee_id = e.id
         JOIN users m ON k.manager_id = m.id
         WHERE k.id = $1`,
        [kpi.id]
      );

      const items = await query(
        'SELECT * FROM kpi_items WHERE kpi_id = $1 ORDER BY item_order',
        [kpi.id]
      );

      return this.success(res, { 
        kpi: { ...kpiWithItems.rows[0], items: items.rows } 
      }, 201);
    } catch (error) {
      console.error('Create KPI error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Update KPI
   * PATCH /:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Check if KPI exists and belongs to this manager
      const kpiCheck = await query('SELECT * FROM kpis WHERE id = $1', [id]);
      if (kpiCheck.rows.length === 0) {
        return this.notFound(res, 'KPI not found');
      }

      if (kpiCheck.rows[0].manager_id !== req.user.id) {
        return this.forbidden(res, 'Access denied');
      }

      // Build update query dynamically
      const allowedFields = [
        'title', 'description', 'target_value', 'measure_unit', 'measure_criteria',
        'period', 'quarter', 'year', 'meeting_date', 'manager_signature', 'status'
      ];
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateFields.push(`${field} = $${paramCount}`);
          values.push(updates[field]);
          paramCount++;
        }
      }

      if (updateFields.length === 0) {
        return this.validationError(res, 'No valid fields to update');
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await query(
        `UPDATE kpis SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      return this.success(res, { kpi: result.rows[0] });
    } catch (error) {
      console.error('Update KPI error:', error);
      return this.error(res, 'Internal server error');
    }
  }

  /**
   * Get KPIs for dashboard statistics
   * GET /dashboard/stats
   */
  async getStats(req, res) {
    try {
      let stats = {};

      if (req.user.role === 'manager') {
        const totalEmployees = await query(
          'SELECT COUNT(*) FROM users WHERE manager_id = $1 AND company_id = $2',
          [req.user.id, req.user.company_id]
        );

        const pendingKPIs = await query(
          "SELECT COUNT(*) FROM kpis WHERE manager_id = $1 AND company_id = $2 AND status = 'pending'",
          [req.user.id, req.user.company_id]
        );

        const completedKPIs = await query(
          "SELECT COUNT(*) FROM kpis WHERE manager_id = $1 AND company_id = $2 AND status = 'completed'",
          [req.user.id, req.user.company_id]
        );

        stats = {
          totalEmployees: parseInt(totalEmployees.rows[0].count),
          pendingKPIs: parseInt(pendingKPIs.rows[0].count),
          completedKPIs: parseInt(completedKPIs.rows[0].count),
        };
      } else if (req.user.role === 'employee') {
        const myKPIs = await query(
          'SELECT COUNT(*) FROM kpis WHERE employee_id = $1 AND company_id = $2',
          [req.user.id, req.user.company_id]
        );

        const pendingKPIs = await query(
          "SELECT COUNT(*) FROM kpis WHERE employee_id = $1 AND company_id = $2 AND status = 'pending'",
          [req.user.id, req.user.company_id]
        );

        const completedKPIs = await query(
          "SELECT COUNT(*) FROM kpis WHERE employee_id = $1 AND company_id = $2 AND status = 'completed'",
          [req.user.id, req.user.company_id]
        );

        stats = {
          totalKPIs: parseInt(myKPIs.rows[0].count),
          pendingKPIs: parseInt(pendingKPIs.rows[0].count),
          completedKPIs: parseInt(completedKPIs.rows[0].count),
        };
      }

      return this.success(res, { stats });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      return this.error(res, 'Internal server error');
    }
  }
}

export default new KpisController();
