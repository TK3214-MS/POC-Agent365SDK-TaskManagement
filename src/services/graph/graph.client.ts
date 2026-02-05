import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';
import { env } from '../../config/env.js';

/**
 * Create Microsoft Graph client with Client Credentials authentication
 */
export function createGraphClient(): Client {
  const credential = new ClientSecretCredential(
    env.graphTenantId,
    env.graphClientId,
    env.graphClientSecret
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  return Client.initWithMiddleware({
    authProvider,
  });
}
