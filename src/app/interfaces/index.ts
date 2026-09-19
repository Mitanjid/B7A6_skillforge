import type { Role } from '../../../generated/prisma/client.js';

export type TJwtUserPayload = {
  userId: string;
  email: string;
  role: Role;
};

export interface IQuery {
  searchTerm?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: TJwtUserPayload;
    }
  }
}
