import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Env, ErrorResponse } from '../types/env';

export function errorHandler(err: Error, c: Context<{ Bindings: Env }>) {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: c.req.url,
    method: c.req.method,
    headers: Object.fromEntries(c.req.raw.headers.entries()),
    timestamp: new Date().toISOString()
  });

  // Generate request ID for tracking
  const requestId = generateRequestId();
  
  // Log error to analytics
  try {
    c.env.ANALYTICS.writeDataPoint({
      blobs: ['error', err.message, c.req.url, c.req.method],
      doubles: [Date.now()],
      indexes: ['error', requestId]
    });
  } catch (analyticsError) {
    console.error('Failed to log error to analytics:', analyticsError);
  }

  // Handle HTTP exceptions
  if (err instanceof HTTPException) {
    const errorResponse: ErrorResponse = {
      error: getErrorName(err.status),
      message: err.message,
      code: `HTTP_${err.status}`,
      timestamp: new Date().toISOString(),
      requestId
    };

    return c.json(errorResponse, err.status);
  }

  // Handle validation errors
  if (err.name === 'ValidationError' || err.message.includes('validation')) {
    const errorResponse: ErrorResponse = {
      error: 'Validation Error',
      message: err.message,
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };

    return c.json(errorResponse, 400);
  }

  // Handle JWT errors
  if (err.name === 'JWTError' || err.message.includes('JWT')) {
    const errorResponse: ErrorResponse = {
      error: 'Authentication Error',
      message: 'Invalid or expired token',
      code: 'AUTH_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };

    return c.json(errorResponse, 401);
  }

  // Handle database errors
  if (err.message.includes('D1_') || err.message.includes('database')) {
    const errorResponse: ErrorResponse = {
      error: 'Database Error',
      message: c.env.ENVIRONMENT === 'production' 
        ? 'A database error occurred' 
        : err.message,
      code: 'DATABASE_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };

    return c.json(errorResponse, 500);
  }

  // Handle KV errors
  if (err.message.includes('KV') || err.message.includes('key-value')) {
    const errorResponse: ErrorResponse = {
      error: 'Cache Error',
      message: c.env.ENVIRONMENT === 'production' 
        ? 'A cache error occurred' 
        : err.message,
      code: 'CACHE_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };

    return c.json(errorResponse, 500);
  }

  // Handle R2 errors
  if (err.message.includes('R2') || err.message.includes('storage')) {
    const errorResponse: ErrorResponse = {
      error: 'Storage Error',
      message: c.env.ENVIRONMENT === 'production' 
        ? 'A storage error occurred' 
        : err.message,
      code: 'STORAGE_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };

    return c.json(errorResponse, 500);
  }

  // Handle network/fetch errors
  if (err.message.includes('fetch') || err.message.includes('network')) {
    const errorResponse: ErrorResponse = {
      error: 'Network Error',
      message: 'External service unavailable',
      code: 'NETWORK_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };

    return c.json(errorResponse, 503);
  }

  // Handle timeout errors
  if (err.message.includes('timeout') || err.message.includes('deadline')) {
    const errorResponse: ErrorResponse = {
      error: 'Timeout Error',
      message: 'Request timeout',
      code: 'TIMEOUT_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };

    return c.json(errorResponse, 504);
  }

  // Handle rate limit errors
  if (err.message.includes('rate limit') || err.message.includes('too many requests')) {
    const errorResponse: ErrorResponse = {
      error: 'Rate Limit Exceeded',
      message: 'Too many requests',
      code: 'RATE_LIMIT_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };

    return c.json(errorResponse, 429);
  }

  // Handle generic errors
  const errorResponse: ErrorResponse = {
    error: 'Internal Server Error',
    message: c.env.ENVIRONMENT === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
    code: 'INTERNAL_ERROR',
    details: c.env.ENVIRONMENT === 'production' ? undefined : {
      stack: err.stack,
      name: err.name
    },
    timestamp: new Date().toISOString(),
    requestId
  };

  return c.json(errorResponse, 500);
}

function getErrorName(status: number): string {
  switch (status) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 405: return 'Method Not Allowed';
    case 409: return 'Conflict';
    case 422: return 'Unprocessable Entity';
    case 429: return 'Too Many Requests';
    case 500: return 'Internal Server Error';
    case 501: return 'Not Implemented';
    case 502: return 'Bad Gateway';
    case 503: return 'Service Unavailable';
    case 504: return 'Gateway Timeout';
    default: return 'Error';
  }
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ExternalServiceError extends Error {
  constructor(service: string, message?: string) {
    super(message || `External service ${service} is unavailable`);
    this.name = 'ExternalServiceError';
  }
}

// Error handling utilities
export function handleAsyncError<T>(promise: Promise<T>): Promise<[T | null, Error | null]> {
  return promise
    .then<[T, null]>((data: T) => [data, null])
    .catch<[null, Error]>((error: Error) => [null, error]);
}

export function createErrorResponse(error: string, message: string, code?: string, details?: any): ErrorResponse {
  return {
    error,
    message,
    code,
    details,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  };
}