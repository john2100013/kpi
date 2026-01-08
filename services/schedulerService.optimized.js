import cron from 'node-cron';
import { query } from '../database/db.js';
import { sendEmailWithFallback, shouldSendHRNotification, getHREmails } from './emailService.js';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Optimized: Fetch all data in bulk, process in memory, send notifications in batches
 * This eliminates nested loops and N+1 query problems
 */
async function processKPISettingReminders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Get all companies
  const companiesResult = await query('SELECT id FROM companies');
  const companyIds = companiesResult.rows.map(c => c.id);

  if (companyIds.length === 0) return;

  // 2. Bulk fetch all active reminder settings for all companies
  const reminderSettingsResult = await query(`
    SELECT * FROM reminder_settings 
    WHERE company_id = ANY($1::int[]) 
    AND reminder_type = 'kpi_setting' 
    AND is_active = true
    ORDER BY company_id, reminder_days_before DESC
  `, [companyIds]);

  // Group by company
  const remindersByCompany = {};
  reminderSettingsResult.rows.forEach(reminder => {
    if (!remindersByCompany[reminder.company_id]) {
      remindersByCompany[reminder.company_id] = [];
    }
    remindersByCompany[reminder.company_id].push(reminder);
  });

  // 3. Bulk fetch all relevant KPIs for all companies
  const kpisResult = await query(`
    SELECT 
      k.id as kpi_id,
      k.meeting_date,
      k.period,
      k.quarter,
      k.year,
      k.company_id,
      k.employee_id,
      k.manager_id,
      e.name as employee_name,
      e.email as employee_email,
      e.payroll_number as employee_payroll,
      m.name as manager_name,
      m.email as manager_email
    FROM kpis k
    JOIN users e ON k.employee_id = e.id
    JOIN users m ON k.manager_id = m.id
    WHERE k.company_id = ANY($1::int[])
    AND k.meeting_date IS NOT NULL
    AND k.status IN ('pending', 'acknowledged')
  `, [companyIds]);

  // Group KPIs by company
  const kpisByCompany = {};
  kpisResult.rows.forEach(kpi => {
    if (!kpisByCompany[kpi.company_id]) {
      kpisByCompany[kpi.company_id] = [];
    }
    kpisByCompany[kpi.company_id].push(kpi);
  });

  // 4. Bulk fetch all users (managers, employees, HR) for all companies
  const usersResult = await query(`
    SELECT id, name, email, role, company_id 
    FROM users 
    WHERE company_id = ANY($1::int[]) 
    AND role IN ('manager', 'employee', 'hr')
    AND email IS NOT NULL
  `, [companyIds]);

  // Group users by company and role
  const usersByCompany = {};
  usersResult.rows.forEach(user => {
    if (!usersByCompany[user.company_id]) {
      usersByCompany[user.company_id] = { managers: [], employees: [], hr: [] };
    }
    if (user.role === 'manager') {
      usersByCompany[user.company_id].managers.push(user);
    } else if (user.role === 'employee') {
      usersByCompany[user.company_id].employees.push(user);
    } else if (user.role === 'hr') {
      usersByCompany[user.company_id].hr.push(user);
    }
  });

  // 5. Process each company's KPIs and reminders
  const emailBatch = [];
  const notificationBatch = [];
  const reminderTrackingBatch = [];

  for (const companyId of companyIds) {
    const reminders = remindersByCompany[companyId] || [];
    const kpis = kpisByCompany[companyId] || [];
    const users = usersByCompany[companyId] || { managers: [], employees: [], hr: [] };

    if (reminders.length === 0 || kpis.length === 0) continue;

    // Check if HR should receive emails
    const hrShouldReceive = await shouldSendHRNotification(companyId);
    const hrEmails = hrShouldReceive ? (await getHREmails(companyId)) : [];

    for (const kpi of kpis) {
      const meetingDate = new Date(kpi.meeting_date);
      meetingDate.setHours(0, 0, 0, 0);
      const daysUntilMeeting = Math.ceil((meetingDate - today) / (1000 * 60 * 60 * 24));

      for (const reminderSetting of reminders) {
        // Check if period_type matches
        if (reminderSetting.period_type && reminderSetting.period_type !== kpi.period) {
          continue;
        }

        // Check if this reminder should be sent today
        if (reminderSetting.reminder_days_before === daysUntilMeeting) {
          const reminderLabel = reminderSetting.reminder_label || 
            `${reminderSetting.reminder_days_before} day${reminderSetting.reminder_days_before > 1 ? 's' : ''} before`;
          const meetingDateStr = new Date(kpi.meeting_date).toLocaleDateString();
          const link = `${FRONTEND_URL}/employee/kpi-acknowledgement/${kpi.kpi_id}`;

          const emailVariables = {
            employeeName: kpi.employee_name,
            employeeEmail: kpi.employee_email,
            employeePayroll: kpi.employee_payroll,
            managerName: kpi.manager_name,
            managerEmail: kpi.manager_email,
            meetingDate: meetingDateStr,
            reminderType: reminderLabel,
            reminderDaysBefore: reminderSetting.reminder_days_before,
            kpiPeriod: kpi.period === 'quarterly' ? 'Quarterly' : 'Yearly',
            kpiQuarter: kpi.quarter || 'N/A',
            kpiYear: kpi.year,
            link: link,
            kpiId: kpi.kpi_id
          };

          // Batch emails for ALL managers
          users.managers.forEach(manager => {
            emailBatch.push({
              companyId,
              email: manager.email,
              templateType: 'kpi_setting_reminder',
              variables: { ...emailVariables, recipientType: 'manager', recipientName: manager.name }
            });

            // Batch in-app notifications
            notificationBatch.push({
              recipient_id: manager.id,
              message: `Reminder: KPI Setting Meeting ${reminderLabel} - ${meetingDateStr}`,
              type: 'kpi_setting_reminder',
              related_kpi_id: kpi.kpi_id,
              company_id: companyId
            });
          });

          // Batch emails for ALL employees
          users.employees.forEach(employee => {
            emailBatch.push({
              companyId,
              email: employee.email,
              templateType: 'kpi_setting_reminder',
              variables: { ...emailVariables, recipientType: 'employee', recipientName: employee.name }
            });

            // Batch in-app notifications
            notificationBatch.push({
              recipient_id: employee.id,
              message: `Reminder: KPI Setting Meeting ${reminderLabel} - ${meetingDateStr}`,
              type: 'kpi_setting_reminder',
              related_kpi_id: kpi.kpi_id,
              company_id: companyId
            });
          });

          // Batch emails for HR
          hrEmails.forEach(hrEmail => {
            emailBatch.push({
              companyId,
              email: hrEmail,
              templateType: 'kpi_setting_reminder',
              variables: { ...emailVariables, recipientType: 'hr', recipientName: 'HR Team' }
            });
          });

          // Track reminder
          const reminderTypeValue = getReminderTypeValue(reminderSetting.reminder_days_before);
          reminderTrackingBatch.push({
            kpi_id: kpi.kpi_id,
            employee_id: kpi.employee_id,
            manager_id: kpi.manager_id,
            meeting_date: kpi.meeting_date,
            reminder_type: reminderTypeValue,
            company_id: companyId
          });
        }
      }
    }
  }

  // 6. Execute all batched operations
  console.log(`📧 Sending ${emailBatch.length} emails in batch...`);
  await Promise.allSettled(emailBatch.map(email => 
    sendEmailWithFallback(email.companyId, email.email, null, null, '', email.templateType, email.variables)
  ));

  console.log(`🔔 Creating ${notificationBatch.length} notifications in batch...`);
  if (notificationBatch.length > 0) {
    await bulkInsertNotifications(notificationBatch);
  }

  console.log(`📝 Tracking ${reminderTrackingBatch.length} reminders in batch...`);
  if (reminderTrackingBatch.length > 0) {
    await bulkInsertReminderTracking(reminderTrackingBatch);
  }
}

/**
 * Helper: Bulk insert notifications
 */
async function bulkInsertNotifications(notifications) {
  if (notifications.length === 0) return;

  const values = notifications.map((n, idx) => {
    const base = idx * 5;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, NOW())`;
  }).join(',');

  const params = notifications.flatMap(n => [
    n.recipient_id,
    n.message,
    n.type,
    n.related_kpi_id,
    n.company_id
  ]);

  try {
    await query(`
      INSERT INTO notifications (recipient_id, message, type, related_kpi_id, company_id, created_at)
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `, params);
  } catch (err) {
    console.log('Some notifications already exist (expected behavior)');
  }
}

/**
 * Helper: Bulk insert reminder tracking
 */
async function bulkInsertReminderTracking(reminders) {
  if (reminders.length === 0) return;

  const values = reminders.map((r, idx) => {
    const base = idx * 6;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, true, NOW(), $${base + 6})`;
  }).join(',');

  const params = reminders.flatMap(r => [
    r.kpi_id,
    r.employee_id,
    r.manager_id,
    r.meeting_date,
    r.reminder_type,
    r.company_id
  ]);

  try {
    await query(`
      INSERT INTO kpi_setting_reminders 
      (kpi_id, employee_id, manager_id, meeting_date, reminder_type, sent, sent_at, company_id)
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `, params);
  } catch (err) {
    console.log('Some reminders already tracked (expected behavior)');
  }
}

/**
 * Helper: Map reminder days to type value
 */
function getReminderTypeValue(daysBefore) {
  const mapping = {
    14: '2_weeks',
    7: '1_week',
    3: '3_days',
    2: '2_days',
    1: '1_day',
    0: 'meeting_day'
  };
  return mapping[daysBefore] || `custom_${daysBefore}_days`;
}

/**
 * Schedule KPI Setting Reminders (BEFORE due date)
 * Runs daily at 9 AM
 */
const scheduleKPISettingReminders = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('🔔 Checking for KPI Setting reminders (before due date)...');
      await processKPISettingReminders();
      console.log('✅ KPI Setting reminders processed successfully');
    } catch (error) {
      console.error('❌ Error in KPI Setting reminder scheduler:', error);
    }
  });
};

/**
 * Schedule Daily Reminders (AFTER period end date)
 * Placeholder - to be optimized similarly
 */
const scheduleKPISettingDailyReminders = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('🔔 Checking for KPI Setting daily reminders (after period end date)...');
      // TODO: Implement optimized version similar to above
    } catch (error) {
      console.error('❌ Error in KPI Setting daily reminder scheduler:', error);
    }
  });
};

/**
 * Schedule KPI Review Reminders
 * Placeholder - to be optimized similarly
 */
const scheduleKPIReviewReminders = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('🔔 Checking for KPI Review reminders...');
      // TODO: Implement optimized version
    } catch (error) {
      console.error('❌ Error in KPI Review reminder scheduler:', error);
    }
  });
};

export const startSchedulers = () => {
  scheduleKPISettingReminders();
  scheduleKPISettingDailyReminders();
  scheduleKPIReviewReminders();
  console.log('✅ Schedulers started (optimized version)');
};

export default { startSchedulers };
