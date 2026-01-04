const nodemailer = require('nodemailer');
const { sendTemplatedEmail } = require('./powerAutomateService');
const { query } = require('../database/db');
require('dotenv').config();

// Create transporter only if email credentials are provided
let transporter = null;
const emailEnabled = process.env.EMAIL_USER && process.env.EMAIL_PASS;

if (emailEnabled) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Verify connection (non-blocking)
  transporter.verify((error, success) => {
    if (error) {
      console.log('⚠️  SMTP email service not configured properly:', error.message);
      console.log('   SMTP email notifications will be disabled.');
      console.log('   Note: You can use Power Automate for emails instead (configure in HR Settings).');
      transporter = null;
    } else {
      console.log('✅ SMTP email service ready');
    }
  });
} else {
  console.log('ℹ️  SMTP email service not configured in .env');
  console.log('   Note: You can use Power Automate for emails (configure in HR Settings → Email Templates).');
}

/**
 * Get email template from database or fallback to hardcoded
 * @param {number} companyId - Company ID
 * @param {string} templateType - Template type
 * @param {Object} variables - Variables for template rendering
 * @returns {Promise<{subject: string, html: string, text: string}>} Template content
 */
const getEmailTemplateContent = async (companyId, templateType, variables = {}) => {
  try {
    // Try to get template from database first
    const templateResult = await query(
      'SELECT * FROM email_templates WHERE company_id = $1 AND template_type = $2 AND is_active = true',
      [companyId, templateType]
    );

    if (templateResult.rows.length > 0) {
      const template = templateResult.rows[0];
      // Render template with variables
      let subject = template.subject;
      let htmlBody = template.body_html;
      let textBody = template.body_text || '';

      // Replace {{variableName}} with actual values
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        const value = variables[key] || '';
        subject = subject.replace(regex, value);
        htmlBody = htmlBody.replace(regex, value);
        textBody = textBody.replace(regex, value);
      });

      console.log(`✅ Using database email template: ${templateType}`);
      return { subject, html: htmlBody, text: textBody };
    }
  } catch (error) {
    console.error('Error fetching email template from database:', error);
  }

  // Fallback to hardcoded templates
  console.log(`⚠️  No database template found for ${templateType}, using default template`);
  return getDefaultEmailTemplate(templateType, variables);
};

/**
 * Get default (hardcoded) email template
 * @param {string} templateType - Template type
 * @param {Object} variables - Variables for template rendering
 * @returns {{subject: string, html: string, text: string}} Template content
 */
const getDefaultEmailTemplate = (templateType, variables = {}) => {
  const {
    employeeName = '',
    managerName = '',
    meetingDate = '',
    reminderType = '',
    reminderLabel = '',
    reminderDaysBefore = '',
    daysPastDue = '',
    daysPastEndDate = '',
    periodEndDate = '',
    periodLabel = '',
    period = '',
    dueDate = '',
    link = '',
    kpiPeriod = '',
    kpiQuarter = '',
    kpiYear = '',
  } = variables;

  const templates = {
    kpi_setting_reminder: {
      subject: `KPI Setting Reminder: ${reminderLabel || reminderType || 'Reminder'} - ${meetingDate || 'Meeting'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6366f1;">KPI Setting Meeting Reminder</h2>
          <p>Hello {{recipientName}},</p>
          <p>This is a reminder that a KPI Setting Meeting is scheduled <strong>{{reminderType}}</strong> ({{meetingDate}}).</p>
          <p><strong>Employee:</strong> {{employeeName}}</p>
          <p><strong>Manager:</strong> {{managerName}}</p>
          <p><strong>Meeting Date:</strong> {{meetingDate}}</p>
          <p>Please prepare for the meeting and review any relevant materials.</p>
          <a href="{{link}}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">View KPI Details</a>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated reminder from KPI Manager Performance System.</p>
        </div>
      `,
      text: `KPI Setting Meeting Reminder\n\nHello {{recipientName}},\n\nThis is a reminder that a KPI Setting Meeting is scheduled {{reminderType}} ({{meetingDate}}).\n\nEmployee: {{employeeName}}\nManager: {{managerName}}\nMeeting Date: {{meetingDate}}\n\nView KPI Details: {{link}}`
    },
    kpi_review_reminder: {
      subject: `KPI Review Reminder - {{dueDate}}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f59e0b;">KPI Review Reminder</h2>
          <p>Hello {{employeeName}},</p>
          <p>This is a reminder that your {{period}} KPI review is due on <strong>{{dueDate}}</strong>.</p>
          <p>Please complete your self-rating before the deadline.</p>
          <a href="{{link}}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">Complete Self-Rating</a>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated reminder from KPI Manager Performance System.</p>
        </div>
      `,
      text: `KPI Review Reminder\n\nHello {{employeeName}},\n\nThis is a reminder that your {{period}} KPI review is due on {{dueDate}}.\n\nPlease complete your self-rating before the deadline.\n\nComplete Self-Rating: {{link}}`
    },
    kpi_assigned: {
      subject: `New KPI Assigned`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6366f1;">New KPI Assigned</h2>
          <p>Hello {{employeeName}},</p>
          <p>Your manager {{managerName}} has set new KPIs for you. Please review and acknowledge them.</p>
          <a href="{{link}}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">Review KPIs</a>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated notification from KPI Manager Performance System.</p>
        </div>
      `,
      text: `New KPI Assigned\n\nHello {{employeeName}},\n\nYour manager {{managerName}} has set new KPIs for you. Please review and acknowledge them.\n\nReview KPIs: {{link}}`
    },
    kpi_acknowledged: {
      subject: `KPI Acknowledged`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">KPI Acknowledged</h2>
          <p>Hello {{managerName}},</p>
          <p>{{employeeName}} has acknowledged the assigned KPIs.</p>
          <a href="{{link}}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">View KPIs</a>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated notification from KPI Manager Performance System.</p>
        </div>
      `,
      text: `KPI Acknowledged\n\nHello {{managerName}},\n\n{{employeeName}} has acknowledged the assigned KPIs.\n\nView KPIs: {{link}}`
    },
    self_rating_submitted: {
      subject: `Self-Rating Submitted`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">Self-Rating Submitted</h2>
          <p>Hello {{managerName}},</p>
          <p>{{employeeName}} has submitted their self-rating for KPI review. Please review and provide your ratings.</p>
          <a href="{{link}}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">Review Now</a>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated notification from KPI Manager Performance System.</p>
        </div>
      `,
      text: `Self-Rating Submitted\n\nHello {{managerName}},\n\n{{employeeName}} has submitted their self-rating for KPI review. Please review and provide your ratings.\n\nReview Now: {{link}}`
    },
    review_completed: {
      subject: `KPI Review Completed`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">KPI Review Completed</h2>
          <p>Hello {{employeeName}},</p>
          <p>Your manager {{managerName}} has completed the KPI review.</p>
          <a href="{{link}}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">View Review</a>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated notification from KPI Manager Performance System.</p>
        </div>
      `,
      text: `KPI Review Completed\n\nHello {{employeeName}},\n\nYour manager {{managerName}} has completed the KPI review.\n\nView Review: {{link}}`
    },
  };

  const template = templates[templateType];
  if (!template) {
    return {
      subject: `KPI Notification`,
      html: `<p>Hello,</p><p>This is a KPI notification.</p>`,
      text: `KPI Notification\n\nHello,\n\nThis is a KPI notification.`
    };
  }

  // Render template with variables
  let subject = template.subject;
  let html = template.html;
  let text = template.text;

  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    const value = variables[key] || '';
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
    text = text.replace(regex, value);
  });

  return { subject, html, text };
};

/**
 * Send email with fallback: Database Template → Hardcoded Template → Power Automate → SMTP
 * @param {number} companyId - Company ID
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject (optional, will be generated from template if not provided)
 * @param {string} html - Email HTML body (optional, will be generated from template if not provided)
 * @param {string} text - Email text body (optional)
 * @param {string} templateType - Template type for Power Automate
 * @param {Object} variables - Variables for template rendering
 * @returns {Promise<Object>} Response object with success status
 */
const sendEmailWithFallback = async (companyId, to, subject = null, html = null, text = '', templateType = null, variables = {}) => {
  let result = null;
  let method = 'none';
  let finalSubject = subject;
  let finalHtml = html;
  let finalText = text;

  // If templateType is provided, get template content (database first, then hardcoded)
  if (templateType && companyId) {
    try {
      const templateContent = await getEmailTemplateContent(companyId, templateType, variables);
      finalSubject = subject || templateContent.subject;
      finalHtml = html || templateContent.html;
      finalText = text || templateContent.text;
    } catch (error) {
      console.error(`Error getting email template: ${error.message}`);
    }
  }

  // If we still don't have subject/html, use defaults
  if (!finalSubject || !finalHtml) {
    console.error(`⚠️  Missing email content. Subject: ${finalSubject}, HTML: ${finalHtml}`);
    return { success: false, error: 'Missing email content', method: 'none', skipped: true };
  }

  // Try Power Automate first (if templateType is provided)
  if (templateType && companyId) {
    try {
      console.log(`📧 Attempting to send email via Power Automate to ${to} (${templateType})`);
      result = await sendTemplatedEmail(companyId, to, templateType, variables);
      
      if (result.success && !result.skipped) {
        method = 'power-automate';
        console.log(`✅ Email sent successfully via Power Automate to ${to}`);
        return { ...result, method: 'power-automate' };
      } else if (result.skipped) {
        console.log(`⚠️  Power Automate not configured, falling back to SMTP...`);
      } else {
        console.log(`❌ Power Automate failed: ${result.error}, falling back to SMTP...`);
      }
    } catch (error) {
      console.error(`❌ Power Automate error: ${error.message}, falling back to SMTP...`);
    }
  }

  // Fallback to SMTP
  if (emailEnabled && transporter) {
    try {
      console.log(`📧 Attempting to send email via SMTP to ${to}`);
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@kpimanager.com',
        to,
        subject: finalSubject,
        text: finalText || finalHtml.replace(/<[^>]*>/g, ''),
        html: finalHtml,
      };

      const info = await transporter.sendMail(mailOptions);
      method = 'smtp';
      console.log(`✅ Email sent successfully via SMTP to ${to} (MessageID: ${info.messageId})`);
      return { success: true, messageId: info.messageId, method: 'smtp' };
    } catch (error) {
      console.error(`❌ SMTP send error to ${to}:`, error.message);
      return { success: false, error: error.message, method: 'smtp-failed' };
    }
  }

  // No email method available
  console.log(`⚠️  No email method available. Email not sent to ${to}: ${finalSubject}`);
  return { success: false, error: 'No email method configured', method: 'none', skipped: true };
};

/**
 * Send email (legacy function for backward compatibility)
 */
const sendEmail = async (to, subject, html, text = '') => {
  // If email is not configured, just log and return success (don't block the process)
  if (!emailEnabled || !transporter) {
    console.log(`📧 Email would be sent to ${to}: ${subject} (email service disabled)`);
    return { success: true, messageId: 'email-disabled', skipped: true };
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@kpimanager.com',
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send error:', error.message);
    // Don't throw - just log the error so it doesn't break the app
    return { success: false, error: error.message, skipped: false };
  }
};

/**
 * Check if HR should receive email notifications
 */
const shouldSendHRNotification = async (companyId) => {
  try {
    const result = await query(
      'SELECT receive_email_notifications FROM hr_email_notification_settings WHERE company_id = $1',
      [companyId]
    );

    if (result.rows.length === 0) {
      // Default to true if no setting exists
      return true;
    }

    return result.rows[0].receive_email_notifications !== false;
  } catch (error) {
    console.error('Error checking HR email notification settings:', error);
    // Default to true on error
    return true;
  }
};

/**
 * Get HR email addresses for a company
 */
const getHREmails = async (companyId) => {
  try {
    const result = await query(
      'SELECT email FROM users WHERE role = $1 AND company_id = $2 AND email IS NOT NULL',
      ['hr', companyId]
    );
    return result.rows.map(row => row.email);
  } catch (error) {
    console.error('Error fetching HR emails:', error);
    return [];
  }
};

// Email templates
const emailTemplates = {
  kpiSettingReminder: (employeeName, managerName, meetingDate, reminderType, link) => {
    const reminderText = {
      '2_weeks': '2 weeks',
      '1_week': '1 week',
      '3_days': '3 days',
      '2_days': '2 days',
      '1_day': '1 day',
      'meeting_day': 'today',
    }[reminderType] || 'soon';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">KPI Setting Meeting Reminder</h2>
        <p>Hello ${employeeName},</p>
        <p>This is a reminder that your KPI Setting Meeting with ${managerName} is scheduled in <strong>${reminderText}</strong> (${meetingDate}).</p>
        <p>Please prepare for the meeting and review any relevant materials.</p>
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">View KPI Details</a>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated reminder from KPI Manager Performance System.</p>
      </div>
    `;
  },

  kpiAssigned: (employeeName, managerName, link) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">New KPI Assigned</h2>
        <p>Hello ${employeeName},</p>
        <p>Your manager ${managerName} has set new KPIs for you. Please review and acknowledge them.</p>
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">Review KPIs</a>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated notification from KPI Manager Performance System.</p>
      </div>
    `;
  },

  kpiAcknowledged: (managerName, employeeName, link) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">KPI Acknowledged</h2>
        <p>Hello ${managerName},</p>
        <p>${employeeName} has acknowledged the assigned KPIs.</p>
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">View KPIs</a>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated notification from KPI Manager Performance System.</p>
      </div>
    `;
  },

  kpiReviewReminder: (employeeName, period, dueDate, link) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">KPI Review Reminder</h2>
        <p>Hello ${employeeName},</p>
        <p>This is a reminder that your ${period} KPI review is due on <strong>${dueDate}</strong>.</p>
        <p>Please complete your self-rating before the deadline.</p>
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">Complete Self-Rating</a>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated reminder from KPI Manager Performance System.</p>
      </div>
    `;
  },

  selfRatingSubmitted: (managerName, employeeName, link) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Self-Rating Submitted</h2>
        <p>Hello ${managerName},</p>
        <p>${employeeName} has submitted their self-rating for KPI review. Please review and provide your ratings.</p>
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">Review Now</a>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated notification from KPI Manager Performance System.</p>
      </div>
    `;
  },

  reviewCompleted: (employeeName, managerName, link) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">KPI Review Completed</h2>
        <p>Hello ${employeeName},</p>
        <p>Your manager ${managerName} has completed the KPI review. Please find the review document attached.</p>
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px;">View Review</a>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated notification from KPI Manager Performance System.</p>
      </div>
    `;
  },
};

module.exports = { 
  sendEmail, 
  sendEmailWithFallback,
  emailTemplates,
  shouldSendHRNotification,
  getHREmails,
};
