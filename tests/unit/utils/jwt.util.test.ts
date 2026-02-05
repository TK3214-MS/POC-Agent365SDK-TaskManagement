import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateClaims, clearJwksCache } from '@/utils/jwt.util';

// Mock environment config
vi.mock('@/config/env', () => ({
  env: {
    tenantId: '12345678-1234-1234-1234-123456789012',
    apiAudience: 'api://test-api',
    allowedAppIds: ['app-id-1', 'app-id-2'],
    requiredRoles: ['TaskManager.ReadWrite'],
    requiredScopes: ['api://test-api/.default'],
  },
}));

describe('JWT Utils', () => {
  beforeEach(() => {
    clearJwksCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateClaims', () => {
    const validPayload = {
      iss: 'https://sts.windows.net/12345678-1234-1234-1234-123456789012/',
      aud: 'api://test-api',
      appid: 'app-id-1',
      roles: ['TaskManager.ReadWrite'],
      scp: 'api://test-api/.default',
      sub: 'user123',
      exp: Math.floor(Date.now() / 1000) + 3600,
      nbf: Math.floor(Date.now() / 1000) - 60,
      iat: Math.floor(Date.now() / 1000) - 60,
    };

    it('should validate a correct payload', () => {
      const result = validateClaims(validPayload);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid issuer', () => {
      const payload = { ...validPayload, iss: 'https://invalid-issuer/' };
      const result = validateClaims(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid issuer');
    });

    it('should reject invalid audience', () => {
      const payload = { ...validPayload, aud: 'api://wrong-audience' };
      const result = validateClaims(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid audience');
    });

    it('should reject disallowed appid', () => {
      const payload = { ...validPayload, appid: 'unauthorized-app' };
      const result = validateClaims(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Application ID not allowed');
    });

    it('should reject missing required role', () => {
      const payload = { ...validPayload, roles: ['SomeOtherRole'] };
      const result = validateClaims(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required role');
    });

    it('should accept payload with roles even if scopes are missing', () => {
      const payload = { ...validPayload, scp: '', roles: ['TaskManager.ReadWrite'] };
      const result = validateClaims(payload);
      expect(result.valid).toBe(true);
    });
  });
});
