import { Request, Response, NextFunction } from 'express';
import { verifyJwt, validateClaims } from '../utils/jwt.util.js';
import { EntraJWTPayload } from '../types/index.js';

/**
 * Authentication middleware for Entra ID JWT Bearer token
 */
export async function authenticateJwt(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT signature and claims
    let payload: EntraJWTPayload;
    try {
      payload = await verifyJwt(token);
    } catch (error) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired JWT token',
        details: (error as Error).message,
      });
      return;
    }

    // Validate additional claims
    const validation = validateClaims(payload);
    if (!validation.valid) {
      res.status(403).json({
        error: 'Forbidden',
        message: validation.error,
      });
      return;
    }

    // Attach user info to request object
    (req as Request & { user: EntraJWTPayload }).user = payload;

    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during authentication',
    });
  }
}
