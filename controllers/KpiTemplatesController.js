import BaseController from './BaseController.js';
import { query } from '../database/db.js';
import { sendEmailWithFallback, emailTemplates, shouldSendHRNotification, getHREmails } from '../services/emailService.js';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

class KpiTemplatesController extends BaseController {
  // Get all templates for the current manager
  async getAll(req, res) {
    const result = await query(
      `SELECT t.*, 
       (SELECT COUNT(*) FROM kpi_template_items WHERE template_id = t.id) as item_count
       FROM kpi_templates t
       WHERE t.manager_id = $1 AND t.company_id = $2
       ORDER BY t.created_at DESC`,
      [req.user.id, req.user.company_id]
    );

    return this.success(res, { templates: result.rows });
  }

  // Get a specific template with its items
  async getById(req, res) {
    const { id } = req.params;

    // Get template
    const templateResult = await query(
      'SELECT * FROM kpi_templates WHERE id = $1 AND manager_id = $2 AND company_id = $3',
      [id, req.user.id, req.user.company_id]
    );

    if (templateResult.rows.length === 0) {
      return this.notFound(res, 'Template not found');
    }

    // Get template items
    const itemsResult = await query(
      'SELECT * FROM kpi_template_items WHERE template_id = $1 ORDER BY item_order',
      [id]
    );

    const template = {
      ...templateResult.rows[0],
      items: itemsResult.rows,
    };

    return this.success(res, { template });
  }

  // Create a new template
  async create(req, res) {
    const { template_name, description, period, items } = req.body;

    if (!template_name || !period || !items || items.length === 0) {
      return this.validationError(res, 'Template name, period, and at least one item are required');
    }

    // Insert template
    const templateResult = await query(
      `INSERT INTO kpi_templates (manager_id, company_id, template_name, description, period)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, req.user.company_id, template_name, description, period]
    );

    const template = templateResult.rows[0];

    // Insert template items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.title && item.title.trim()) {
        await query(
          `INSERT INTO kpi_template_items (
            template_id, title, description, current_performance_status, 
            target_value, expected_completion_date, measure_unit, goal_weight, item_order, is_qualitative
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            template.id,
            item.title,
            item.description || '',
            item.current_performance_status || '',
            item.target_value || '',
            item.expected_completion_date || '',
            item.measure_unit || '',
            item.goal_weight || '',
            i + 1,
            item.is_qualitative || false,
          ]
        );
      }
    }

    return this.success(res, { 
      message: 'Template created successfully',
      templateId: template.id 
    }, 201);
  }

  // Update a template
  async update(req, res) {
    const { id } = req.params;
    const { template_name, description, period, items } = req.body;

    // Verify template belongs to manager
    const templateCheck = await query(
      'SELECT id FROM kpi_templates WHERE id = $1 AND manager_id = $2 AND company_id = $3',
      [id, req.user.id, req.user.company_id]
    );

    if (templateCheck.rows.length === 0) {
      return this.notFound(res, 'Template not found');
    }

    // Update template
    await query(
      `UPDATE kpi_templates 
       SET template_name = $1, description = $2, period = $3, updated_at = NOW()
       WHERE id = $4`,
      [template_name, description, period, id]
    );

    // Delete existing items
    await query('DELETE FROM kpi_template_items WHERE template_id = $1', [id]);

    // Insert new items
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.title && item.title.trim()) {
          await query(
            `INSERT INTO kpi_template_items (
              template_id, title, description, current_performance_status, 
              target_value, expected_completion_date, measure_unit, goal_weight, item_order, is_qualitative
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              id,
              item.title,
              item.description || '',
              item.current_performance_status || '',
              item.target_value || '',
              item.expected_completion_date || '',
              item.measure_unit || '',
              item.goal_weight || '',
              i + 1,
              item.is_qualitative || false,
            ]
          );
        }
      }
    }

    return this.success(res, { message: 'Template updated successfully' });
  }

  // Delete a template
  async delete(req, res) {
    const { id } = req.params;

    // Verify template belongs to manager
    const templateCheck = await query(
      'SELECT id FROM kpi_templates WHERE id = $1 AND manager_id = $2 AND company_id = $3',
      [id, req.user.id, req.user.company_id]
    );

    if (templateCheck.rows.length === 0) {
      return this.notFound(res, 'Template not found');
    }

    // Delete template (items will be deleted automatically due to CASCADE)
    await query('DELETE FROM kpi_templates WHERE id = $1', [id]);

    return this.success(res, { message: 'Template deleted successfully' });
  }

  // Use a template to create KPIs for multiple employees
  async apply(req, res) {
    const { id } = req.params;
    const { employee_ids, quarter, year, meeting_date, manager_signature } = req.body;

    if (!employee_ids || employee_ids.length === 0) {
      return this.validationError(res, 'At least one employee must be selected');
    }

    if (!manager_signature) {
      return this.validationError(res, 'Manager signature is required');
    }

    // Get template with items
    const templateResult = await query(
      'SELECT * FROM kpi_templates WHERE id = $1 AND manager_id = $2 AND company_id = $3',
      [id, req.user.id, req.user.company_id]
    );

    if (templateResult.rows.length === 0) {
      return this.notFound(res, 'Template not found');
    }

    const template = templateResult.rows[0];

    // Get template items
    const itemsResult = await query(
      'SELECT * FROM kpi_template_items WHERE template_id = $1 ORDER BY item_order',
      [id]
    );

    if (itemsResult.rows.length === 0) {
      return this.validationError(res, 'Template has no items');
    }

    // Validate period settings
    let periodQuery = `
      SELECT * FROM kpi_period_settings 
      WHERE company_id = $1 AND period_type = $2 AND year = $3 AND is_active = true
    `;
    const periodParams = [req.user.company_id, template.period, year || new Date().getFullYear()];
    
    if (template.period === 'quarterly') {
      if (!quarter) {
        return this.validationError(res, 'Quarter is required for quarterly templates');
      }
      periodQuery += ` AND quarter = $4`;
      periodParams.push(quarter);
    } else {
      periodQuery += ` AND quarter IS NULL`;
    }

    const periodCheck = await query(periodQuery, periodParams);
    
    if (periodCheck.rows.length === 0) {
      return this.validationError(res, 
        `No active ${template.period} period setting found for ${quarter || ''} ${year || new Date().getFullYear()}`
      );
    }

    const createdKPIs = [];

    // Create KPI for each selected employee
    for (const employee_id of employee_ids) {
      // Verify employee exists and is under this manager
      const employeeCheck = await query(
        'SELECT id, name, email, manager_id, company_id, department FROM users WHERE id = $1 AND role = $2 AND company_id = $3',
        [employee_id, 'employee', req.user.company_id]
      );

      if (employeeCheck.rows.length === 0) {
        console.warn(`Employee ${employee_id} not found, skipping`);
        continue;
      }

      // Get manager's department to verify employee is in same department
      const managerResult = await query(
        'SELECT department FROM users WHERE id = $1',
        [req.user.id]
      );

      if (managerResult.rows.length === 0 || 
          employeeCheck.rows[0].department !== managerResult.rows[0].department) {
        console.warn(`Employee ${employee_id} not in manager's department, skipping`);
        continue;
      }

      const employee = employeeCheck.rows[0];

      // Generate form title
      const formTitle = itemsResult.rows.length === 1 
        ? itemsResult.rows[0].title 
        : `${template.template_name} - ${itemsResult.rows.length} KPIs`;

      // Insert KPI form
      const kpiResult = await query(
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
          `KPI Form from template: ${template.template_name}`,
          template.period,
          quarter || null,
          year || new Date().getFullYear(),
          meeting_date,
          manager_signature,
        ]
      );

      const kpi = kpiResult.rows[0];

      // Insert KPI items from template
      for (let i = 0; i < itemsResult.rows.length; i++) {
        const item = itemsResult.rows[i];
        await query(
          `INSERT INTO kpi_items (
            kpi_id, title, description, current_performance_status, target_value, 
            expected_completion_date, measure_unit, goal_weight, item_order, is_qualitative
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            kpi.id,
            item.title,
            item.description,
            item.current_performance_status,
            item.target_value,
            item.expected_completion_date,
            item.measure_unit,
            item.goal_weight,
            i + 1,
            item.is_qualitative || false,
          ]
        );
      }

      // Create reminders if meeting date provided
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

      // Create notification for employee
      await query(
        `INSERT INTO notifications (recipient_id, company_id, message, type, related_kpi_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [employee_id, req.user.company_id, `New KPI assigned by ${req.user.name}`, 'kpi_assigned', kpi.id]
      );

      createdKPIs.push({
        employee_id: employee_id,
        employee_name: employee.name,
        kpi_id: kpi.id,
      });
    }

    return this.success(res, { 
      message: `KPIs created successfully for ${createdKPIs.length} employee(s)`,
      created: createdKPIs 
    });
  }
}

export default new KpiTemplatesController();
