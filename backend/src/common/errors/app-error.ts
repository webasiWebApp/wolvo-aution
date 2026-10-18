import { HttpException, HttpStatus } from '@nestjs/common';

// Body of every error response (see HttpExceptionFilter).
export interface ErrorBody {
  statusCode: number;
  error: string; // machine-readable code, e.g. LISTING_FIELDS_LOCKED
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

// Throw this for domain errors so the response carries a stable code.
export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details?: unknown) {
    super({ code, message, details }, status);
  }
}

export const notFound = (code = 'NOT_FOUND', message = 'Not found.') =>
  new AppError(HttpStatus.NOT_FOUND, code, message);

export const forbidden = (code: string, message: string, details?: unknown) =>
  new AppError(HttpStatus.FORBIDDEN, code, message, details);

export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(HttpStatus.CONFLICT, code, message, details);

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(HttpStatus.BAD_REQUEST, code, message, details);

export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(HttpStatus.UNPROCESSABLE_ENTITY, code, message, details);
