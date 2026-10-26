import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import * as authService from '../../services/auth.service';
import { getAuditContext } from '../../utils/audit';
import { asyncHandler, ok } from '../../utils/http';
import { AppError } from '../../utils/errors';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a digit');

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
const forgotSchema = z.object({ email: z.string().trim().email() });
const resetSchema = z.object({ token: z.string().min(10).max(256), password: passwordSchema });

export const authPublicRouter = Router();
export const authRouter = Router();

authPublicRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    ok(res, await authService.login(body.email, body.password, getAuditContext(req)));
  }),
);

authPublicRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const body = forgotSchema.parse(req.body);
    ok(res, await authService.forgotPassword(body.email, getAuditContext(req)));
  }),
);

authPublicRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const body = resetSchema.parse(req.body);
    ok(res, await authService.resetPassword(body.token, body.password, getAuditContext(req)));
  }),
);

authRouter.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.unauthorized();
    ok(res, await authService.logout(getAuditContext(req), req.auth.userId));
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.auth) throw AppError.unauthorized();
    ok(res, await authService.buildUserPayload(req.auth));
  }),
);
