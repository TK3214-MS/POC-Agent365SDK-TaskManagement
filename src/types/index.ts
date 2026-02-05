import { JWTPayload as JoseJWTPayload } from 'jose';

/**
 * Common type definitions for the external agent
 */

export interface EnvConfig {
  port: number;
  nodeEnv: string;
  tenantId: string;
  apiClientId: string;
  apiAudience: string;
  requiredScopes: string[];
  requiredRoles: string[];
  allowedAppIds: string[];
  githubToken: string;
  githubModelsEndpoint: string;
  githubModelsList: string[];
  githubModelsDefault: string;
  graphClientId: string;
  graphClientSecret: string;
  graphTenantId: string;
  plannerPlanId: string;
  plannerBucketId: string;
  otelExporterType: 'console' | 'otlp';
  otelExporterOtlpEndpoint?: string;
  otelServiceName: string;
  otelLogLevel: string;
  piiFilterEnabled: boolean;
}

/**
 * Entra ID JWT Payload (extends jose JWTPayload)
 */
export interface EntraJWTPayload extends JoseJWTPayload {
  appid?: string;
  roles?: string[];
  scp?: string;
}

export interface AuthenticatedRequest extends Express.Request {
  user?: EntraJWTPayload;
  traceId?: string;
}
