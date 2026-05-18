import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadGatewayError,
} from '../../src/errors.js';

describe('errors', () => {
  it('AppError captures statusCode, message, and optional code', () => {
    const e = new AppError(418, "I'm a teapot", 'TEAPOT');
    expect(e).toBeInstanceOf(Error);
    expect(e.statusCode).toBe(418);
    expect(e.message).toBe("I'm a teapot");
    expect(e.code).toBe('TEAPOT');
    expect(e.name).toBe('AppError');
  });

  it('AppError works without code', () => {
    const e = new AppError(500, 'boom');
    expect(e.code).toBeUndefined();
  });

  it('NotFoundError defaults to "Resource"', () => {
    const e = new NotFoundError();
    expect(e.statusCode).toBe(404);
    expect(e.message).toBe('Resource not found');
    expect(e.code).toBe('NOT_FOUND');
  });

  it('NotFoundError accepts resource name', () => {
    expect(new NotFoundError('Camera').message).toBe('Camera not found');
  });

  it('UnauthorizedError defaults', () => {
    const e = new UnauthorizedError();
    expect(e.statusCode).toBe(401);
    expect(e.message).toBe('Unauthorized');
    expect(e.code).toBe('UNAUTHORIZED');
  });

  it('UnauthorizedError accepts custom message', () => {
    expect(new UnauthorizedError('bad token').message).toBe('bad token');
  });

  it('ForbiddenError defaults', () => {
    const e = new ForbiddenError();
    expect(e.statusCode).toBe(403);
    expect(e.message).toBe('Insufficient permissions');
    expect(e.code).toBe('FORBIDDEN');
  });

  it('ForbiddenError accepts custom message', () => {
    expect(new ForbiddenError('nope').message).toBe('nope');
  });

  it('ConflictError', () => {
    const e = new ConflictError('dup');
    expect(e.statusCode).toBe(409);
    expect(e.message).toBe('dup');
    expect(e.code).toBe('CONFLICT');
  });

  it('BadGatewayError', () => {
    const e = new BadGatewayError('upstream down');
    expect(e.statusCode).toBe(502);
    expect(e.message).toBe('upstream down');
    expect(e.code).toBe('BAD_GATEWAY');
  });
});
