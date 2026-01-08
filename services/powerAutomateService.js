import axios from 'axios';
import { query } from '../database/db.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Send email via Microsoft Power Automate
 * @param {number} companyId - Company ID
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlBody - Email HTML body
 * @param {string} textBody - Email text body (optional)
 * @param {Object} additionalData - Additional data to include in the webhook payload (includes templateType)
 * @returns {Promise<Object>} Response object with success status
 */
const sendEmailViaPowerAutomate = async (companyId, to, subject, htmlBody, textBody = '', additionalData = {}) => {
  try {
    const templateType = additionalData.templateType || null;
    
    // First, try to get template-specific webhook URL
    let configResult;
    if (templateType) {
      configResult = await query(
        'SELECT webhook_url, is_active FROM power_automate_config WHERE company_id = $1 AND template_type = $2 AND is_active = true',
        [companyId, templateType]
      );
    }
    
    // If no template-specific URL found, try to get default URL (template_type IS NULL)
    if (!configResult || configResult.rows.length === 0) {
      configResult = await query(
        'SELECT webhook_url, is_active FROM power_automate_config WHERE company_id = $1 AND template_type IS NULL AND is_active = true',
        [companyId]
      );
    }

    if (configResult.rows.length === 0) {
      console.log(`⚠️  Power Automate not configured for company ${companyId}${templateType ? ` and template type ${templateType}` : ''}. Email not sent to ${to}`);
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
    
    // Log detailed response for troubleshooting
    if (process.env.NODE_ENV === 'development' || process.env.LOG_POWER_AUTOMATE_RESPONSE === 'true') {
      console.log('📧 Power Automate Response Details:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        messageId: response.data?.messageId || response.headers['x-ms-request-id'] || 'unknown'
      });
    }
    
    return { 
      success: true, 
      status: response.status, 
      messageId: response.data?.messageId || response.headers['x-ms-request-id'] || 'sent',
      responseHeaders: response.headers
    };
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
 * Get rendered email template content (database first, then hardcoded)
 * @param {number} companyId - Company ID
 * @param {string} templateType - Template type
 * @param {Object} variables - Variables for template rendering
 * @returns {Promise<{subject: string, html: string, text: string}>} Template content
 */
const getRenderedTemplate = async (companyId, templateType, variables = {}) => {
  try {
    // Try to get template from database
    const template = await getEmailTemplate(companyId, templateType);

    if (template) {
      // Use database template
      const subject = renderTemplate(template.subject, variables);
      const htmlBody = renderTemplate(template.body_html, variables);
      const textBody = template.body_text ? renderTemplate(template.body_text, variables) : '';
      return { subject, html: htmlBody, text: textBody };
    }
  } catch (error) {
    console.error('Error fetching database template:', error);
  }

  // Fallback to default templates (from emailService.js)
  const { getDefaultEmailTemplate } = require('./emailService');
  return getDefaultEmailTemplate(templateType, variables);
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
    // Get rendered template content
    const templateContent = await getRenderedTemplate(companyId, templateType, variables);

    // Send via Power Automate
    // Include both variables and additionalData in the payload so Power Automate has access to all data
    return await sendEmailViaPowerAutomate(companyId, to, templateContent.subject, templateContent.html, templateContent.text, {
      templateType,
      ...variables, // Include all template variables (employeeName, managerName, etc.)
      ...additionalData, // Include any additional data
    });
  } catch (error) {
    console.error('Error sending templated email:', error);
    return { success: false, error: error.message };
  }
};

export {
  sendEmailViaPowerAutomate,
  getEmailTemplate,
  renderTemplate,
  sendTemplatedEmail,
  getRenderedTemplate,
};

