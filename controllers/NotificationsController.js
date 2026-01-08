import BaseController from './BaseController.js';
import { query } from '../database/db.js';

class NotificationsController extends BaseController {
  // Get all notifications for current user
  async getAll(req, res) {
    const { read, limit = 50, type } = req.query;

    let queryText = `
      SELECT n.*, 
       k.title as kpi_title,
       k.quarter as kpi_quarter,
       k.year as kpi_year,
       k.period as kpi_period,
       e.name as employee_name,
       m.name as manager_name,
       kr.id as review_id,
       kr.review_status
       FROM notifications n
       LEFT JOIN kpis k ON n.related_kpi_id = k.id
       LEFT JOIN kpi_reviews kr ON n.related_review_id = kr.id
       LEFT JOIN users e ON k.employee_id = e.id
       LEFT JOIN users m ON k.manager_id = m.id
       WHERE n.recipient_id = $1 AND (n.company_id = $2 OR n.company_id IS NULL)
    `;

    const params = [req.user.id, req.user.company_id];
    let paramIndex = 3;

    if (read !== undefined) {
      queryText += ` AND n.read = $${paramIndex}`;
      params.push(read === 'true');
      paramIndex++;
    }

    if (type) {
      queryText += ` AND n.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    queryText += ` ORDER BY n.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await query(queryText, params);

    return this.success(res, { notifications: result.rows });
  }

  // Get recent activity (last 10 notifications)
  async getActivity(req, res) {
    let queryText = `
      SELECT n.*, 
       k.title as kpi_title,
       k.quarter as kpi_quarter,
       k.year as kpi_year,
       e.name as employee_name,
       m.name as manager_name
       FROM notifications n
       LEFT JOIN kpis k ON n.related_kpi_id = k.id
       LEFT JOIN users e ON k.employee_id = e.id
       LEFT JOIN users m ON k.manager_id = m.id
       WHERE (n.company_id = $1 OR n.company_id IS NULL)
    `;
    
    const params = [req.user.company_id];
    
    // For non-HR users, also filter by recipient
    if (req.user.role !== 'hr') {
      queryText += ` AND n.recipient_id = $2`;
      params.push(req.user.id);
    }
    
    queryText += ` ORDER BY n.created_at DESC LIMIT 10`;

    const result = await query(queryText, params);

    return this.success(res, { activities: result.rows });
  }

  // Mark notification as read
  async markAsRead(req, res) {
    const { id } = req.params;

    const result = await query(
      'UPDATE notifications SET read = true WHERE id = $1 AND recipient_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return this.notFound(res, 'Notification not found');
    }

    return this.success(res, { notification: result.rows[0] });
  }

  // Mark all notifications as read
  async markAllAsRead(req, res) {
    await query(
      'UPDATE notifications SET read = true WHERE recipient_id = $1 AND (company_id = $2 OR company_id IS NULL) AND read = false',
      [req.user.id, req.user.company_id]
    );

    return this.success(res, { message: 'All notifications marked as read' });
  }

  // Get unread notification count
  async getUnreadCount(req, res) {
    const result = await query(
      'SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND (company_id = $2 OR company_id IS NULL) AND read = false',
      [req.user.id, req.user.company_id]
    );

    return this.success(res, { count: parseInt(result.rows[0].count) });
  }
}

export default new NotificationsController();
