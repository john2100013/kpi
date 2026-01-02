const nodemailer = require('nodemailer');
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
      console.log('⚠️  Email service not configured properly:', error.message);
      console.log('   Email notifications will be disabled. Configure EMAIL_USER and EMAIL_PASS in .env to enable.');
    } else {
      console.log('✅ Email service ready');
    }
  });
} else {
  console.log('⚠️  Email service disabled - EMAIL_USER and EMAIL_PASS not configured in .env');
  console.log('   Email notifications will be skipped. Configure email settings to enable.');
}

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

  kpiAcknowledged: (managerName, employeeName) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">KPI Acknowledged</h2>
        <p>Hello ${managerName},</p>
        <p>${employeeName} has acknowledged the assigned KPIs.</p>
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

module.exports = { sendEmail, emailTemplates };

