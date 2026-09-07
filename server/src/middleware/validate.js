/**
 * Zod Validation Middleware
 * Validates req.body, req.query, or req.params against a Zod schema
 */

const { ZodError } = require('zod');

/**
 * Validate request body against a Zod schema.
 * On success, replaces req.body with the parsed (and sanitized) data.
 * On failure, returns 400 with detailed field-level errors.
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const parsed = schema.parse(data);
      if (source === 'body') req.body = parsed;
      else if (source === 'query') req.query = parsed;
      else req.params = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Zod v4 uses `issues`, Zod v3 uses `errors`
        const items = error.issues || error.errors || [];
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: items.map((e) => ({
            field: (e.path || []).join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};

module.exports = { validate };
