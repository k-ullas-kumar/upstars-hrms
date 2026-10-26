import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { UniqueConstraintError, ValidationError } from 'sequelize';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
  request_id?: string;
}

function send(req: Request, res: Response, status: number, code: string, message: string, details?: unknown) {
  const body: ErrorBody = { success: false, error: { code, message } };
  if (details !== undefined) body.error.details = details;
  if (req.requestId) body.request_id = req.requestId;
  res.status(status).json(body);
}

export function notFoundHandler(req: Request, res: Response) {
  send(req, res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`);
}

// Express identifies error handlers by their 4-argument signature.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return send(req, res, err.status, err.code, err.message, err.details);
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const first = details[0];
    const message = first ? `${first.path ? `${first.path}: ` : ''}${first.message}` : 'Validation failed';
    return send(req, res, 400, 'VALIDATION_ERROR', message, details);
  }
  if (err instanceof UniqueConstraintError) {
    const fields = Object.keys(err.fields ?? {}).filter((f) => f !== 'tenant_id');
    const label = fields.length ? fields.join(', ') : 'value';
    return send(req, res, 409, 'CONFLICT', `A record with this ${label} already exists`, { fields });
  }
  if (err instanceof ValidationError) {
    const details = err.errors.map((e) => ({ path: e.path, message: e.message }));
    return send(req, res, 400, 'VALIDATION_ERROR', details[0]?.message ?? 'Validation failed', details);
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return send(req, res, status, 'UPLOAD_ERROR', err.message);
  }
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    return send(req, res, 400, 'BAD_REQUEST', 'Malformed JSON body');
  }

  // eslint-disable-next-line no-console
  console.error(`[${req.requestId ?? '-'}] Unhandled error:`, err);
  const message = env.isProduction ? 'Internal server error' : err instanceof Error ? err.message : 'Internal server error';
  return send(req, res, 500, 'INTERNAL_ERROR', message);
}
