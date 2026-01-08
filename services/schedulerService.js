import cron from 'node-cron';
import { query } from '../database/db.js';
import { sendEmailWithFallback, shouldSendHRNotification, getHREmails } from './emailService.js';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Schedule KPI Setting Reminders (BEFORE due date)
 * Uses reminder_settings table configured by HR
 */
const scheduleKPISettingReminders = () => {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('🔔 Checking for KPI Setting reminders (before due date)...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all companies
      const companiesResult = await query('SELECT id FROM companies');
      
      for (const company of companiesResult.rows) {
        const companyId = company.id;

        // Get active reminder settings for KPI Setting
        const reminderSettingsResult = await query(`
          SELECT * FROM reminder_settings 
          WHERE company_id = $1 
          AND reminder_type = 'kpi_setting' 
          AND is_active = true
          ORDER BY reminder_days_before DESC
        `, [companyId]);

        if (reminderSettingsResult.rows.length === 0) {
          continue; // No reminder settings for this company
        }

        // Get all KPIs with meeting dates for this company
        const kpisResult = await query(`
          SELECT 
            k.id as kpi_id,
            k.meeting_date,
            k.period,
            k.quarter,
            k.year,
            k.company_id,
            e.id as employee_id,
            e.name as employee_name,
            e.email as employee_email,
            e.payroll_number as employee_payroll,
            m.id as manager_id,
            m.name as manager_name,
            m.email as manager_email
          FROM kpis k
          JOIN users e ON k.employee_id = e.id
          JOIN users m ON k.manager_id = m.id
          WHERE k.company_id = $1
          AND k.meeting_date IS NOT NULL
          AND k.status IN ('pending', 'acknowledged')
        `, [companyId]);

        for (const kpi of kpisResult.rows) {
          const meetingDate = new Date(kpi.meeting_date);
          meetingDate.setHours(0, 0, 0, 0);
          const daysUntilMeeting = Math.ceil((meetingDate - today) / (1000 * 60 * 60 * 24));

          // Check each reminder setting
          for (const reminderSetting of reminderSettingsResult.rows) {
            // Check if period_type matches (or is null/Any)
            if (reminderSetting.period_type && reminderSetting.period_type !== kpi.period) {
              continue; // Skip if period doesn't match
            }

            // Check if this reminder should be sent today
            if (reminderSetting.reminder_days_before === daysUntilMeeting) {
              console.log(`📧 Sending KPI Setting reminder: ${reminderSetting.reminder_label || `${reminderSetting.reminder_days_before} days before`} for KPI ${kpi.kpi_id}`);

              // Get all recipients
              const recipients = {
                managers: [],
                employees: [],
                hr: [],
                cc: []
              };

              // Get ALL managers in company
              const managersResult = await query(
                'SELECT id, name, email FROM users WHERE role = $1 AND company_id = $2 AND email IS NOT NULL',
                ['manager', companyId]
              );
              recipients.managers = managersResult.rows;

              // Get ALL employees in company
              const employeesResult = await query(
                'SELECT id, name, email FROM users WHERE role = $2 AND company_id = $1 AND email IS NOT NULL',
                [companyId, 'employee']
              );
              recipients.employees = employeesResult.rows;

              // Get ALL HR in company
              const hrShouldReceive = await shouldSendHRNotification(companyId);
              if (hrShouldReceive) {
                recipients.hr = await getHREmails(companyId);
              }

              // Prepare email data
              const reminderLabel = reminderSetting.reminder_label || `${reminderSetting.reminder_days_before} day${reminderSetting.reminder_days_before > 1 ? 's' : ''} before`;
              const meetingDateStr = new Date(kpi.meeting_date).toLocaleDateString();
              const link = `${FRONTEND_URL}/employee/kpi-acknowledgement/${kpi.kpi_id}`;

              // Email template variables for Power Automate
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

              const subject = `KPI Setting Reminder: ${reminderLabel} - ${meetingDateStr}`;

              // Send to ALL managers
              for (const manager of recipients.managers) {
                await sendEmailWithFallback(
                  companyId,
                  manager.email,
                  null, // Subject will be generated from template
                  null, // HTML will be generated from template
                  '',
                  'kpi_setting_reminder',
                  { ...emailVariables, recipientType: 'manager', recipientName: manager.name }
                );
              }

              // Send to ALL employees
              for (const employee of recipients.employees) {
                await sendEmailWithFallback(
                  companyId,
                  employee.email,
                  null, // Subject will be generated from template
                  null, // HTML will be generated from template
                  '',
                  'kpi_setting_reminder',
                  { ...emailVariables, recipientType: 'employee', recipientName: employee.name }
                );
              }

              // Send to ALL HR
              for (const hrEmail of recipients.hr) {
                await sendEmailWithFallback(
                  companyId,
                  hrEmail,
                  null, // Subject will be generated from template
                  null, // HTML will be generated from template
                  '',
                  'kpi_setting_reminder',
                  { ...emailVariables, recipientType: 'hr', recipientName: 'HR Team' }
                );
              }

              // Create in-app notifications
              for (const manager of recipients.managers) {
                try {
                  await query(
                    `INSERT INTO notifications (recipient_id, message, type, related_kpi_id, company_id, created_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [
                      manager.id,
                      `Reminder: KPI Setting Meeting ${reminderLabel} - ${meetingDateStr}`,
                      'kpi_setting_reminder',
                      kpi.kpi_id,
                      companyId
                    ]
                  );
                } catch (err) {
                  // Ignore duplicate notification errors
                  console.log(`Notification already exists for manager ${manager.id}`);
                }
              }

              for (const employee of recipients.employees) {
                try {
                  await query(
                    `INSERT INTO notifications (recipient_id, message, type, related_kpi_id, company_id, created_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [
                      employee.id,
                      `Reminder: KPI Setting Meeting ${reminderLabel} - ${meetingDateStr}`,
                      'kpi_setting_reminder',
                      kpi.kpi_id,
                      companyId
                    ]
                  );
                } catch (err) {
                  // Ignore duplicate notification errors
                  console.log(`Notification already exists for employee ${employee.id}`);
                }
              }

              // Mark reminder as sent (create tracking record)
              // Map reminder_days_before to valid reminder_type values for tracking
              // Use a generic format that works with any days_before value
              let reminderTypeValue = 'meeting_day'; // Default
              if (reminderSetting.reminder_days_before === 14) {
                reminderTypeValue = '2_weeks';
              } else if (reminderSetting.reminder_days_before === 7) {
                reminderTypeValue = '1_week';
              } else if (reminderSetting.reminder_days_before === 3) {
                reminderTypeValue = '3_days';
              } else if (reminderSetting.reminder_days_before === 2) {
                reminderTypeValue = '2_days';
              } else if (reminderSetting.reminder_days_before === 1) {
                reminderTypeValue = '1_day';
              } else if (reminderSetting.reminder_days_before === 0) {
                reminderTypeValue = 'meeting_day';
              } else {
                // For any other days_before value, use a generic format
                // Store as 'custom_X_days' where X is the number of days
                reminderTypeValue = `custom_${reminderSetting.reminder_days_before}_days`;
              }

              try {
                await query(`
                  INSERT INTO kpi_setting_reminders 
                  (kpi_id, employee_id, manager_id, meeting_date, reminder_type, sent, sent_at, company_id)
                  VALUES ($1, $2, $3, $4, $5, true, NOW(), $6)
                `, [
                  kpi.kpi_id,
                  kpi.employee_id,
                  kpi.manager_id,
                  kpi.meeting_date,
                  reminderTypeValue,
                  companyId
                ]);
              } catch (err) {
                // Ignore duplicate reminder errors
                console.log(`Reminder already tracked for KPI ${kpi.kpi_id}, reminder type ${reminderTypeValue}`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in KPI Setting reminder scheduler:', error);
    }
  });
};

/**
 * Schedule Daily Reminders (AFTER period end date)
 * Sends daily reminders when KPI period end date has passed
 * Uses KPI Period Settings end_date dynamically from database
 */
const scheduleKPISettingDailyReminders = () => {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('🔔 Checking for KPI Setting daily reminders (after period end date)...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all companies
      const companiesResult = await query('SELECT id FROM companies');
      
      for (const company of companiesResult.rows) {
        const companyId = company.id;

        // Get daily reminder settings
        const dailySettingsResult = await query(`
          SELECT * FROM kpi_setting_daily_reminder_settings 
          WHERE company_id = $1 AND send_daily_reminders = true
        `, [companyId]);

        if (dailySettingsResult.rows.length === 0) {
          continue; // Daily reminders not enabled for this company
        }

        const dailySettings = dailySettingsResult.rows[0];
        const daysAfterEndDate = dailySettings.days_before_meeting || 1; // Days AFTER period end date

        // Parse CC emails
        const ccEmails = dailySettings.cc_emails 
          ? dailySettings.cc_emails.split(',').map(e => e.trim()).filter(e => e)
          : [];

        // Get all active KPI Period Settings for this company
        const periodSettingsResult = await query(`
          SELECT * FROM kpi_period_settings 
          WHERE company_id = $1 AND is_active = true
        `, [companyId]);

        if (periodSettingsResult.rows.length === 0) {
          continue; // No period settings configured
        }

        // For each period setting, find KPIs that match and check if end date has passed
        for (const periodSetting of periodSettingsResult.rows) {
          const periodEndDate = new Date(periodSetting.end_date);
          periodEndDate.setHours(0, 0, 0, 0);
          const daysPastEndDate = Math.ceil((today - periodEndDate) / (1000 * 60 * 60 * 24));

          // Check if we should send daily reminder (every day after the initial delay)
          if (daysPastEndDate >= daysAfterEndDate) {
            // Build query to find matching KPIs
            let kpiQuery = `
              SELECT 
                k.id as kpi_id,
                k.meeting_date,
                k.period,
                k.quarter,
                k.year,
                k.company_id,
                e.id as employee_id,
                e.name as employee_name,
                e.email as employee_email,
                e.payroll_number as employee_payroll,
                m.id as manager_id,
                m.name as manager_name,
                m.email as manager_email
              FROM kpis k
              JOIN users e ON k.employee_id = e.id
              JOIN users m ON k.manager_id = m.id
              WHERE k.company_id = $1
              AND k.period = $2
              AND k.year = $3
              AND k.status IN ('pending', 'acknowledged')
            `;
            const queryParams = [companyId, periodSetting.period_type, periodSetting.year];

            // Add quarter filter if quarterly
            if (periodSetting.period_type === 'quarterly' && periodSetting.quarter) {
              kpiQuery += ` AND k.quarter = $4`;
              queryParams.push(periodSetting.quarter);
            }

            const matchingKpisResult = await query(kpiQuery, queryParams);

            for (const kpi of matchingKpisResult.rows) {
              // Check if we already sent a reminder today for this KPI (to avoid duplicates)
              const todayReminderCheck = await query(`
                SELECT id FROM kpi_setting_reminders 
                WHERE kpi_id = $1 
                AND reminder_type = 'daily_overdue'
                AND DATE(sent_at) = CURRENT_DATE
              `, [kpi.kpi_id]);

              if (todayReminderCheck.rows.length > 0) {
                continue; // Already sent today
              }

              console.log(`📧 Sending daily reminder for KPI ${kpi.kpi_id} (${daysPastEndDate} days after period end date ${periodSetting.end_date})`);

              const periodEndDateStr = new Date(periodSetting.end_date).toLocaleDateString();
              const link = `${FRONTEND_URL}/employee/kpi-acknowledgement/${kpi.kpi_id}`;
              const periodLabel = periodSetting.period_type === 'quarterly' 
                ? `${periodSetting.quarter} ${periodSetting.year} Quarterly` 
                : `${periodSetting.year} Yearly`;

              // Email template variables
              const emailVariables = {
                employeeName: kpi.employee_name,
                employeeEmail: kpi.employee_email,
                employeePayroll: kpi.employee_payroll,
                managerName: kpi.manager_name,
                managerEmail: kpi.manager_email,
                periodEndDate: periodEndDateStr,
                periodLabel: periodLabel,
                daysPastEndDate: daysPastEndDate,
                kpiPeriod: kpi.period === 'quarterly' ? 'Quarterly' : 'Yearly',
                kpiQuarter: kpi.quarter || 'N/A',
                kpiYear: kpi.year,
                link: link,
                kpiId: kpi.kpi_id
              };

              // Send to Manager
              if (kpi.manager_email) {
                await sendEmailWithFallback(
                  companyId,
                  kpi.manager_email,
                  null, // Subject will be generated from template
                  null, // HTML will be generated from template
                  '',
                  'kpi_setting_reminder',
                  { ...emailVariables, recipientType: 'manager', recipientName: kpi.manager_name, daysPastDue: daysPastEndDate }
                );
              }

              // Send to Employee
              if (kpi.employee_email) {
                await sendEmailWithFallback(
                  companyId,
                  kpi.employee_email,
                  null, // Subject will be generated from template
                  null, // HTML will be generated from template
                  '',
                  'kpi_setting_reminder',
                  { ...emailVariables, recipientType: 'employee', recipientName: kpi.employee_name, daysPastDue: daysPastEndDate }
                );
              }

              // Send to HR (ALWAYS for confirmation, regardless of email notification settings)
              const hrEmails = await getHREmails(companyId);
              for (const hrEmail of hrEmails) {
                await sendEmailWithFallback(
                  companyId,
                  hrEmail,
                  null, // Subject will be generated from template
                  null, // HTML will be generated from template
                  '',
                  'kpi_setting_reminder',
                  { ...emailVariables, recipientType: 'hr', recipientName: 'HR Team', daysPastDue: daysPastEndDate }
                );
              }

              // Send CC emails (if any)
              for (const ccEmail of ccEmails) {
                await sendEmailWithFallback(
                  companyId,
                  ccEmail,
                  null, // Subject will be generated from template
                  null, // HTML will be generated from template
                  '',
                  'kpi_setting_reminder',
                  { ...emailVariables, recipientType: 'cc', recipientName: '', daysPastDue: daysPastEndDate }
                );
              }

              // Create in-app notifications
              try {
                await query(
                  `INSERT INTO notifications (recipient_id, message, type, related_kpi_id, company_id, created_at)
                   VALUES ($1, $2, $3, $4, $5, NOW())`,
                  [
                    kpi.manager_id,
                    `⚠️ Period Ended: ${periodLabel} ended ${daysPastEndDate} day${daysPastEndDate > 1 ? 's' : ''} ago (${periodEndDateStr})`,
                    'kpi_setting_reminder',
                    kpi.kpi_id,
                    companyId
                  ]
                );
              } catch (err) {
                console.log(`Notification already exists for manager ${kpi.manager_id}`);
              }

              try {
                await query(
                  `INSERT INTO notifications (recipient_id, message, type, related_kpi_id, company_id, created_at)
                   VALUES ($1, $2, $3, $4, $5, NOW())`,
                  [
                    kpi.employee_id,
                    `⚠️ Period Ended: ${periodLabel} ended ${daysPastEndDate} day${daysPastEndDate > 1 ? 's' : ''} ago (${periodEndDateStr})`,
                    'kpi_setting_reminder',
                    kpi.kpi_id,
                    companyId
                  ]
                );
              } catch (err) {
                console.log(`Notification already exists for employee ${kpi.employee_id}`);
              }

              // Mark reminder as sent
              await query(`
                INSERT INTO kpi_setting_reminders 
                (kpi_id, employee_id, manager_id, meeting_date, reminder_type, sent, sent_at, company_id)
                VALUES ($1, $2, $3, $4, 'daily_overdue', true, NOW(), $5)
              `, [
                kpi.kpi_id,
                kpi.employee_id,
                kpi.manager_id,
                kpi.meeting_date || periodSetting.end_date,
                companyId
              ]);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in KPI Setting daily reminder scheduler:', error);
    }
  });
};

// Schedule KPI Review Reminders (keeping existing logic for now)
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
          await sendEmailWithFallback(
            reminder.company_id || 1,
            reminder.employee_email,
            'KPI Review Reminder',
            `Hello ${reminder.employee_name},<br><br>This is a reminder that your ${period} KPI review is due on <strong>${reminder.due_date}</strong>.<br><br>Please complete your self-rating before the deadline.<br><br><a href="${link}">Complete Self-Rating</a>`,
            '',
            'kpi_review_reminder',
            {
              employeeName: reminder.employee_name,
              period: period,
              dueDate: reminder.due_date,
              link: link
            }
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
  scheduleKPISettingDailyReminders();
  scheduleKPIReviewReminders();
  console.log('✅ Schedulers started');
};

export { startSchedulers };
