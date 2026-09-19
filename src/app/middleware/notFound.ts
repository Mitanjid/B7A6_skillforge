import httpStatus from 'http-status';
import type { Request, Response } from 'express';

export const notFound = (req: Request, res: Response) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'Route not found',
    errors: [{ path: req.originalUrl, message: 'This endpoint does not exist' }],
  });
};
