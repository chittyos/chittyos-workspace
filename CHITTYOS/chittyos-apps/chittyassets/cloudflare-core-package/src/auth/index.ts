/**
 * ChittyOS Authentication Integration
 */

export interface ChittyServiceToken {
  clientId: string;
  clientSecret: string;
  service: string;
  environment: string;
}

export interface ChittyAuthHeaders {
  'CF-Access-Client-Id': string;
  'CF-Access-Client-Secret': string;
  'X-Chitty-Service-Token'?: string;
  'Authorization'?: string;
}

export class ChittyAuthClient {
  private tokens: Map<string, ChittyServiceToken> = new Map();

  addServiceToken(service: string, token: ChittyServiceToken) {
    this.tokens.set(service, token);
  }

  getAuthHeaders(service: string): ChittyAuthHeaders {
    const token = this.tokens.get(service);
    if (!token) {
      throw new Error(`No service token configured for ${service}`);
    }

    return {
      'CF-Access-Client-Id': token.clientId,
      'CF-Access-Client-Secret': token.clientSecret,
      'X-Chitty-Service-Token': `${service}:${token.environment}`
    };
  }

  async authenticateRequest(request: Request, requiredService?: string): Promise<boolean> {
    const clientId = request.headers.get('CF-Access-Client-Id');
    const clientSecret = request.headers.get('CF-Access-Client-Secret');

    if (!clientId || !clientSecret) {
      return false;
    }

    // Validate against stored tokens
    for (const [service, token] of this.tokens) {
      if (requiredService && service !== requiredService) {
        continue;
      }

      if (token.clientId === clientId && token.clientSecret === clientSecret) {
        return true;
      }
    }

    return false;
  }

  createServiceRequest(url: string, service: string, options: RequestInit = {}): Request {
    const headers = {
      ...this.getAuthHeaders(service),
      'Content-Type': 'application/json',
      ...options.headers
    };

    return new Request(url, {
      ...options,
      headers
    });
  }
}

// Default service token configuration for ChittyOS
export const CHITTY_SERVICE_TOKENS = {
  schema: 'CHITTY_SCHEMA_SERVICE_TOKEN',
  id: 'CHITTY_ID_SERVICE_TOKEN',
  canon: 'CHITTY_CANON_SERVICE_TOKEN',
  registry: 'CHITTY_REGISTRY_SERVICE_TOKEN',
  auth: 'CHITTY_AUTH_SERVICE_TOKEN',
  chat: 'CHITTY_CHAT_SERVICE_TOKEN',
  assets: 'CHITTY_ASSETS_SERVICE_TOKEN'
} as const;

export function createChittyAuthClient(env: Record<string, string>, environment: string = 'production'): ChittyAuthClient {
  const client = new ChittyAuthClient();

  for (const [service, envVar] of Object.entries(CHITTY_SERVICE_TOKENS)) {
    const tokenValue = env[envVar];
    if (tokenValue) {
      const [clientId, clientSecret] = tokenValue.split(':');
      client.addServiceToken(service, {
        clientId,
        clientSecret,
        service,
        environment
      });
    }
  }

  return client;
}