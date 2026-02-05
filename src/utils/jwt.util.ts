import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { env } from '../config/env.js';
import { EntraJWTPayload } from '../types/index.js';

/**
 * JWKS cache for public key retrieval
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Get JWKS URL for a given tenant
 */
function getJwksUrl(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
}

/**
 * Get or create JWKS remote key set with caching
 */
function getJwks(tenantId: string): ReturnType<typeof createRemoteJWKSet> {
  if (!jwksCache.has(tenantId)) {
    const jwksUrl = new URL(getJwksUrl(tenantId));
    jwksCache.set(tenantId, createRemoteJWKSet(jwksUrl));
  }
  return jwksCache.get(tenantId)!;
}

/**
 * Verify JWT token and return payload
 */
export async function verifyJwt(token: string): Promise<EntraJWTPayload> {
  const jwks = getJwks(env.tenantId);

  // Verify token with JWKS
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://sts.windows.net/${env.tenantId}/`,
    audience: env.apiAudience,
    clockTolerance: 60, // 60 seconds clock skew tolerance
  });

  return payload as EntraJWTPayload;
}

/**
 * Validate token claims according to environment configuration
 */
export function validateClaims(payload: JWTPayload): {
  valid: boolean;
  error?: string;
} {
  // Validate issuer
  const expectedIss = `https://sts.windows.net/${env.tenantId}/`;
  if (payload.iss !== expectedIss) {
    return {
      valid: false,
      error: `Invalid issuer. Expected: ${expectedIss}, Got: ${String(payload.iss)}`,
    };
  }

  // Validate audience
  if (payload.aud !== env.apiAudience) {
    return {
      valid: false,
      error: `Invalid audience. Expected: ${env.apiAudience}, Got: ${String(payload.aud)}`,
    };
  }

  // Validate appid (caller application)
  const appid = payload.appid as string | undefined;
  if (env.allowedAppIds.length > 0 && appid) {
    if (!env.allowedAppIds.includes(appid)) {
      return {
        valid: false,
        error: `Application ID not allowed: ${appid}`,
      };
    }
  }

  // Validate roles (if REQUIRED_ROLES is set)
  if (env.requiredRoles.length > 0) {
    const roles = (payload.roles as string[] | undefined) || [];
    const hasRequiredRole = env.requiredRoles.some((role) => roles.includes(role));
    if (!hasRequiredRole) {
      return {
        valid: false,
        error: `Missing required role. Required: ${env.requiredRoles.join(', ')}, Got: ${roles.join(', ')}`,
      };
    }
  }

  // Validate scopes (if REQUIRED_SCOPES is set and scp claim exists)
  if (env.requiredScopes.length > 0) {
    const scp = (payload.scp as string | undefined) || '';
    const scopes = scp.split(' ').filter(Boolean);
    const hasRequiredScope = env.requiredScopes.some((scope) => scopes.includes(scope));

    // For /.default scope, also check roles
    const roles = (payload.roles as string[] | undefined) || [];
    const hasRequiredScopeOrRole = hasRequiredScope || roles.length > 0;

    if (!hasRequiredScopeOrRole) {
      return {
        valid: false,
        error: `Missing required scope or role. Required scopes: ${env.requiredScopes.join(', ')}, Got scopes: ${scopes.join(', ')}, Got roles: ${roles.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Clear JWKS cache (useful for testing)
 */
export function clearJwksCache(): void {
  jwksCache.clear();
}
