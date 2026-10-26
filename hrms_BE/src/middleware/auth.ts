import { NextFunction, Request, Response } from 'express';
import { asyncHandler } from '../utils/http';
import { AppError } from '../utils/errors';
import { verifyToken } from '../utils/crypto';
import { loadAuthContext } from '../services/auth.service';

/** Requires a valid Bearer JWT, then loads user, roles, permissions and linked employee. */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw AppError.unauthorized();

  let payload;
  try {
    payload = verifyToken(match[1].trim());
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }

  const auth = await loadAuthContext(payload.sub, payload.tenant_id);
  if (!auth) throw AppError.unauthorized('Invalid or expired token');
  req.auth = auth;
  next();
});
