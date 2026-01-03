const axios = require('axios');
const { query } = require('../database/db');
require('dotenv').config();

/**
 * Send email via Microsoft Power Automate
 * @param {number} companyId - Company ID
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlBody - Email HTML body
 * @param {string} textBody - Email text body (optional)
 * @param {Object} additionalData - Additional data to include in the webhook payload
 * @returns {Promise<Object>} Response object with success status
 */
const sendEmailViaPowerAutomate = async (companyId, to, subject, htmlBody, textBody = '', additionalData = {}) => {
  try {
    // Get Power Automate webhook URL for this company
    const configResult = await query(
      'SELECT webhook_url, is_active FROM power_automate_config WHERE company_id = $1 AND is_active = true',
      [companyId]
    );

    if (configResult.rows.length === 0) {
      console.log(`⚠️  Power Automate not configured for company ${companyId}. Email not sent to ${to}`);
      return { success: false, error: 'Power Automate not configured', skipped: true };
    }

    const webhookUrl = configResult.rows[0].webhook_url;

    // Prepare payload for Power Automate
    const payload = {
      to: to,
      subject: subject,
      htmlBody: htmlBody,
      textBody: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML tags if no text body provided
      ...additionalData, // Include any additional data (e.g., employeeName, managerName, meetingDate, etc.)
    };

    // Send HTTP POST request to Power Automate webhook
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    console.log(`✅ Power Automate email sent to ${to}: ${subject} (Status: ${response.status})`);
    return { success: true, status: response.status, messageId: response.data?.messageId || 'sent' };
  } catch (error) {
    console.error(`❌ Power Automate email send error to ${to}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return { success: false, error: error.message, skipped: false };
  }
};

/**
 * Get email template from database
 * @param {number} companyId - Company ID
 * @param {string} templateType - Template type (e.g., 'kpi_setting_reminder')
 * @returns {Promise<Object|null>} Template object or null if not found
 */
const getEmailTemplate = async (companyId, templateType) => {
  try {
    const result = await query(
      'SELECT * FROM email_templates WHERE company_id = $1 AND template_type = $2 AND is_active = true',
      [companyId, templateType]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error fetching email template:', error);
    return null;
  }
};

/**
 * Render email template with variables
 * @param {string} templateBody - Template body with placeholders like {{variableName}}
 * @param {Object} variables - Object with variable values
 * @returns {string} Rendered template
 */
const renderTemplate = (templateBody, variables) => {
  let rendered = templateBody;
  
  // Replace {{variableName}} with actual values
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(regex, variables[key] || '');
  });

  return rendered;
};

/**
 * Send email using template from database or fallback to default
 * @param {number} companyId - Company ID
 * @param {string} to - Recipient email address
 * @param {string} templateType - Template type
 * @param {Object} variables - Variables for template rendering
 * @param {Object} additionalData - Additional data for Power Automate payload
 * @returns {Promise<Object>} Response object
 */
const sendTemplatedEmail = async (companyId, to, templateType, variables = {}, additionalData = {}) => {
  try {
    // Try to get template from database
    const template = await getEmailTemplate(companyId, templateType);

    let subject, htmlBody;

    if (template) {
      // Use database template
      subject = renderTemplate(template.subject, variables);
      htmlBody = renderTemplate(template.body_html, variables);
    } else {
      // Fallback to default templates (from emailService.js)
      const { emailTemplates } = require('./emailService');
      
      // Map template types to default template functions
      const defaultTemplates = {
        kpi_setting_reminder: emailTemplates.kpiSettingReminder,
        kpi_review_reminder: emailTemplates.kpiReviewReminder,
        kpi_assigned: emailTemplates.kpiAssigned,
        kpi_acknowledged: emailTemplates.kpiAcknowledged,
        self_rating_submitted: emailTemplates.selfRatingSubmitted,
        review_completed: emailTemplates.reviewCompleted,
      };

      const defaultTemplateFn = defaultTemplates[templateType];
      if (!defaultTemplateFn) {
        throw new Error(`Unknown template type: ${templateType}`);
      }

      // Call default template function with variables
      // Adjust parameters based on template function signature
      if (templateType === 'kpi_setting_reminder') {
        htmlBody = defaultTemplateFn(
          variables.employeeName || '',
          variables.managerName || '',
          variables.meetingDate || '',
          variables.reminderType || '',
          variables.link || ''
        );
      } else if (templateType === 'kpi_review_reminder') {
        htmlBody = defaultTemplateFn(
          variables.employeeName || '',
          variables.period || '',
          variables.dueDate || '',
          variables.link || ''
        );
      } else if (templateType === 'kpi_assigned') {
        htmlBody = defaultTemplateFn(
          variables.employeeName || '',
          variables.managerName || '',
          variables.link || ''
        );
      } else if (templateType === 'kpi_acknowledged') {
        htmlBody = defaultTemplateFn(
          variables.managerName || '',
          variables.employeeName || '',
          variables.link || ''
        );
      } else if (templateType === 'self_rating_submitted') {
        htmlBody = defaultTemplateFn(
          variables.managerName || '',
          variables.employeeName || '',
          variables.link || ''
        );
      } else if (templateType === 'review_completed') {
        htmlBody = defaultTemplateFn(
          variables.employeeName || '',
          variables.managerName || '',
          variables.link || ''
        );
      }
      
      subject = `KPI ${templateType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
    }

    // Send via Power Automate
    return await sendEmailViaPowerAutomate(companyId, to, subject, htmlBody, '', {
      templateType,
      ...additionalData,
    });
  } catch (error) {
    console.error('Error sending templated email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmailViaPowerAutomate,
  getEmailTemplate,
  renderTemplate,
  sendTemplatedEmail,
};

