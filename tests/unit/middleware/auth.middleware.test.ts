import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock env before importing middleware
vi.mock('@/config/env', () => ({
  env: {
    tenantId: '12345678-1234-1234-1234-123456789012',
    apiAudience: 'api://test-api',
    allowedAppIds: ['app-id-1'],
    requiredRoles: [],
    requiredScopes: ['api://test-api/.default'],
  },
}));

// Import after mocking
const { authenticateJwt } = await import('@/middleware/auth.middleware');
const jwtUtil = await import('@/utils/jwt.util');

describe('authenticateJwt middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('should return 401 if Authorization header is missing', async () => {
    await authenticateJwt(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization header does not start with Bearer', async () => {
    mockReq.headers = { authorization: 'Basic abc123' };

    await authenticateJwt(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 if JWT verification fails', async () => {
    mockReq.headers = { authorization: 'Bearer invalid.jwt.token' };
    vi.spyOn(jwtUtil, 'verifyJwt').mockRejectedValue(new Error('Invalid token'));

    await authenticateJwt(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid or expired JWT token',
      details: 'Invalid token',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 if claims validation fails', async () => {
    mockReq.headers = { authorization: 'Bearer valid.jwt.token' };
    const mockPayload = { iss: 'https://sts.windows.net/tenant/', aud: 'api://test' };
    vi.spyOn(jwtUtil, 'verifyJwt').mockResolvedValue(mockPayload);
    vi.spyOn(jwtUtil, 'validateClaims').mockReturnValue({
      valid: false,
      error: 'Invalid audience',
    });

    await authenticateJwt(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Invalid audience',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() if authentication succeeds', async () => {
    mockReq.headers = { authorization: 'Bearer valid.jwt.token' };
    const mockPayload = {
      iss: 'https://sts.windows.net/tenant/',
      aud: 'api://test',
      sub: 'user123',
    };
    vi.spyOn(jwtUtil, 'verifyJwt').mockResolvedValue(mockPayload);
    vi.spyOn(jwtUtil, 'validateClaims').mockReturnValue({ valid: true });

    await authenticateJwt(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect((mockReq as Request & { user: unknown }).user).toEqual(mockPayload);
  });
});
