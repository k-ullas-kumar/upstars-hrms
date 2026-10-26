import { NextFunction, Request, Response } from 'express';
import { PermissionKey } from '../config/permissions';
import { AppError } from '../utils/errors';

/** Caller must hold ALL listed permissions. */
export function requirePermission(...keys: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(AppError.unauthorized());
    const auth = req.auth;
    if (!keys.every((k) => auth.permissions.has(k))) return next(AppError.forbidden());
    return next();
  };
}

/** Caller must hold AT LEAST ONE of the listed permissions. */
export function requireAnyPermission(...keys: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(AppError.unauthorized());
    const auth = req.auth;
    if (!keys.some((k) => auth.permissions.has(k))) return next(AppError.forbidden());
    return next();
  };
}
