/**
 * ChittyOS Gateway Configuration
 */

export interface ChittyGatewayRoute {
  pattern: string;
  service: string;
  methods?: string[];
  auth?: boolean;
}

export interface ChittyAccessPolicy {
  name: string;
  decision: 'allow' | 'deny' | 'bypass' | 'service_auth';
  priority: number;
  include?: any[];
  require?: any[];
  exclude?: any[];
  path_rules?: string[];
  description?: string;
}

export class ChittyGatewayConfig {
  private routes: ChittyGatewayRoute[] = [];
  private policies: ChittyAccessPolicy[] = [];

  addRoute(route: ChittyGatewayRoute) {
    this.routes.push(route);
  }

  addPolicy(policy: ChittyAccessPolicy) {
    this.policies.push(policy);
  }

  getRoutes(): ChittyGatewayRoute[] {
    return this.routes;
  }

  getPolicies(): ChittyAccessPolicy[] {
    return this.policies;
  }

  generateCloudflareConfig() {
    return {
      routes: this.routes,
      access_policies: this.policies
    };
  }
}

// Pre-configured ChittyOS routes
export const DEFAULT_CHITTY_ROUTES: ChittyGatewayRoute[] = [
  { pattern: 'schema.chitty.cc/*', service: 'schema', auth: true },
  { pattern: 'id.chitty.cc/*', service: 'id', auth: true },
  { pattern: 'canon.chitty.cc/*', service: 'canon', auth: true },
  { pattern: 'registry.chitty.cc/*', service: 'registry', auth: false },
  { pattern: 'auth.chitty.cc/*', service: 'auth', auth: false },
  { pattern: 'chat.chitty.cc/*', service: 'chat', auth: true },
  { pattern: 'assets.chitty.cc/*', service: 'assets', auth: true }
];