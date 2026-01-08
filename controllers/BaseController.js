/**
 * Base Controller Class
 * Provides common utility methods for all controllers
 */
export class BaseController {
  /**
   * Handle success response
   */
  success(res, data, statusCode = 200) {
    return res.status(statusCode).json(data);
  }

  /**
   * Handle error response
   */
  error(res, message, statusCode = 500) {
    console.error('Controller error:', message);
    return res.status(statusCode).json({ error: message });
  }

  /**
   * Handle validation error
   */
  validationError(res, message) {
    return this.error(res, message, 400);
  }

  /**
   * Handle not found error
   */
  notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404);
  }

  /**
   * Handle unauthorized error
   */
  unauthorized(res, message = 'Unauthorized') {
    return this.error(res, message, 401);
  }

  /**
   * Handle forbidden error
   */
  forbidden(res, message = 'Forbidden') {
    return this.error(res, message, 403);
  }

  /**
   * Wrap async route handler to catch errors
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

export default BaseController;
