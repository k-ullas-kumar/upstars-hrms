import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Pagination } from './pagination';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function ok<T>(res: Response, data: T, pagination?: Pagination, status = 200) {
  const body: { success: true; data: T; pagination?: Pagination } = { success: true, data };
  if (pagination) body.pagination = pagination;
  return res.status(status).json(body);
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, undefined, 201);
}
