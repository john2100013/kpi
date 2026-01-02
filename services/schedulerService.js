const cron = require('node-cron');
const { query } = require('../database/db');
const { sendEmail, emailTemplates } = require('./emailService');
require('dotenv').config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Schedule KPI Setting Reminders
const scheduleKPISettingReminders = () => {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('🔔 Checking for KPI Setting reminders...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all pending reminders
      const reminders = await query(`
        SELECT 
          ksr.*,
          k.meeting_date,
          e.name as employee_name,
          e.email as employee_email,
          m.name as manager_name,
          m.email as manager_email,
          hr.email as hr_email
        FROM kpi_setting_reminders ksr
        JOIN kpis k ON ksr.kpi_id = k.id
        JOIN users e ON ksr.employee_id = e.id
        JOIN users m ON ksr.manager_id = m.id
        LEFT JOIN users hr ON hr.role = 'hr'
        WHERE ksr.sent = false
        AND k.meeting_date IS NOT NULL
      `);

      for (const reminder of reminders.rows) {
        const meetingDate = new Date(reminder.meeting_date);
        const daysUntilMeeting = Math.ceil((meetingDate - today) / (1000 * 60 * 60 * 24));

        let shouldSend = false;
        const reminderDays = {
          '2_weeks': 14,
          '1_week': 7,
          '3_days': 3,
          '2_days': 2,
          '1_day': 1,
          'meeting_day': 0,
        };

        if (reminderDays[reminder.reminder_type] === daysUntilMeeting) {
          shouldSend = true;
        }

        if (shouldSend) {
          const link = `${FRONTEND_URL}/kpi-acknowledgement/${reminder.kpi_id}`;
          
          // Send to employee
          await sendEmail(
            reminder.employee_email,
            'KPI Setting Meeting Reminder',
            emailTemplates.kpiSettingReminder(
              reminder.employee_name,
              reminder.manager_name,
              reminder.meeting_date,
              reminder.reminder_type,
              link
            )
          );

          // Send to manager
          await sendEmail(
            reminder.manager_email,
            'KPI Setting Meeting Reminder',
            emailTemplates.kpiSettingReminder(
              reminder.employee_name,
              reminder.manager_name,
              reminder.meeting_date,
              reminder.reminder_type,
              link
            )
          );

          // Mark as sent
          await query(
            'UPDATE kpi_setting_reminders SET sent = true, sent_at = NOW() WHERE id = $1',
            [reminder.id]
          );

          // Create in-app notification
          await query(
            `INSERT INTO notifications (recipient_id, message, type, related_kpi_id, scheduled_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [
              reminder.employee_id,
              `Reminder: KPI Setting Meeting with ${reminder.manager_name} in ${reminder.reminder_type.replace('_', ' ')}`,
              'kpi_setting_reminder',
              reminder.kpi_id,
            ]
          );
        }
      }
    } catch (error) {
      console.error('❌ Error in KPI Setting reminder scheduler:', error);
    }
  });
};

// Schedule KPI Review Reminders
const scheduleKPIReviewReminders = () => {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('🔔 Checking for KPI Review reminders...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all pending review reminders
      const reminders = await query(`
        SELECT 
          krr.*,
          kr.due_date,
          e.name as employee_name,
          e.email as employee_email,
          m.name as manager_name,
          m.email as manager_email
        FROM kpi_review_reminders krr
        JOIN kpi_reviews kr ON krr.review_id = kr.id
        JOIN users e ON krr.employee_id = e.id
        JOIN users m ON krr.manager_id = m.id
        WHERE krr.sent = false
      `);

      for (const reminder of reminders.rows) {
        const dueDate = new Date(reminder.due_date);
        const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

        // Send reminder 7 days before, 3 days before, 1 day before, and on due date
        if ([7, 3, 1, 0].includes(daysUntilDue)) {
          const link = `${FRONTEND_URL}/kpi-review/${reminder.review_id}`;
          const period = reminder.reminder_type === 'quarterly_3_months' ? 'Quarterly' : 'Yearly';
          
          // Send to employee
          await sendEmail(
            reminder.employee_email,
            'KPI Review Reminder',
            emailTemplates.kpiReviewReminder(
              reminder.employee_name,
              period,
              reminder.due_date,
              link
            )
          );

          // Mark as sent
          await query(
            'UPDATE kpi_review_reminders SET sent = true, sent_at = NOW() WHERE id = $1',
            [reminder.id]
          );

          // Create in-app notification
          await query(
            `INSERT INTO notifications (recipient_id, message, type, related_review_id, scheduled_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [
              reminder.employee_id,
              `Reminder: ${period} KPI review due in ${daysUntilDue} day(s)`,
              'kpi_review_reminder',
              reminder.review_id,
            ]
          );
        }
      }
    } catch (error) {
      console.error('❌ Error in KPI Review reminder scheduler:', error);
    }
  });
};

const startSchedulers = () => {
  scheduleKPISettingReminders();
  scheduleKPIReviewReminders();
  console.log('✅ Schedulers started');
};

module.exports = { startSchedulers };

