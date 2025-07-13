import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../src/index';

describe('Auth Routes', () => {
  let env: any;
  let ctx: any;

  beforeEach(() => {
    env = global.testUtils.createMockEnv();
    ctx = global.testUtils.createMockContext();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const request = global.testUtils.createMockRequest('http://localhost:8787/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@example.com',
          password: 'SecurePass123!'
        })
      });

      const response = await app.fetch(request, env, ctx);
      const data = await global.testUtils.parseResponse(response);

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.message).toBe('User registered successfully');
      expect(data.data).toHaveProperty('user');
      expect(data.data).toHaveProperty('token');
    });

    it('should return 400 for invalid email', async () => {
      const request = global.testUtils.createMockRequest('http://localhost:8787/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: 'testuser',
          email: 'invalid-email',
          password: 'SecurePass123!'
        })
      });

      const response = await app.fetch(request, env, ctx);
      const data = await global.testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('validation');
    });

    it('should return 400 for weak password', async () => {
      const request = global.testUtils.createMockRequest('http://localhost:8787/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@example.com',
          password: '123'
        })
      });

      const response = await app.fetch(request, env, ctx);
      const data = await global.testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('password');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Mock user exists in database
      env.DB.prepare = () => ({
        bind: () => ({
          first: () => Promise.resolve({
            id: '1',
            username: 'testuser',
            email: 'test@example.com',
            password_hash: '$2a$10$hashedpassword',
            status: 'active',
            created_at: new Date().toISOString()
          })
        })
      });

      const request = global.testUtils.createMockRequest('http://localhost:8787/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'SecurePass123!'
        })
      });

      const response = await app.fetch(request, env, ctx);
      const data = await global.testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('user');
      expect(data.data).toHaveProperty('token');
    });

    it('should return 401 for invalid credentials', async () => {
      // Mock user not found
      env.DB.prepare = () => ({
        bind: () => ({
          first: () => Promise.resolve(null)
        })
      });

      const request = global.testUtils.createMockRequest('http://localhost:8787/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        })
      });

      const response = await app.fetch(request, env, ctx);
      const data = await global.testUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid credentials');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const token = 'valid-jwt-token';
      const request = global.testUtils.createAuthenticatedRequest(
        'http://localhost:8787/api/auth/logout',
        token,
        { method: 'POST' }
      );

      const response = await app.fetch(request, env, ctx);
      const data = await global.testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Logged out successfully');
    });

    it('should return 401 without authentication', async () => {
      const request = global.testUtils.createMockRequest('http://localhost:8787/api/auth/logout', {
        method: 'POST'
      });

      const response = await app.fetch(request, env, ctx);
      const data = await global.testUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication required');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      // Mock authenticated user
      env.SESSION_STORE.get = () => Promise.resolve(JSON.stringify({
        userId: '1',
        username: 'testuser',
        email: 'test@example.com'
      }));

      const token = 'valid-jwt-token';
      const request = global.testUtils.createAuthenticatedRequest(
        'http://localhost:8787/api/auth/me',
        token
      );

      const response = await app.fetch(request, env, ctx);
      const data = await global.testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('user');
      expect(data.data.user).toHaveProperty('username');
      expect(data.data.user).toHaveProperty('email');
    });

    it('should return 401 without authentication', async () => {
      const request = global.testUtils.createMockRequest('http://localhost:8787/api/auth/me');

      const response = await app.fetch(request, env, ctx);
      const data = await global.testUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication required');
    });
  });
});