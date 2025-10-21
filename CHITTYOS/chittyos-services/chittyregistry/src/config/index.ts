// Configuration Management for ChittyRegistry

import dotenv from 'dotenv';
import { RegistryConfigSchema, AuthorityServices } from '../types';

// Load environment variables
dotenv.config();

// Authority service configurations
const authorityConfig: AuthorityServices = {
  chittySchema: {
    url: 'https://schema.chitty.cc',
    endpoints: {
      validateSchema: '/validate',
      getSchema: '/schema',
      listSchemas: '/schemas'
    }
  },
  chittyCanon: {
    url: 'https://canon.chitty.cc',
    endpoints: {
      getCanonical: '/canonical',
      validateData: '/validate',
      getStandards: '/standards'
    }
  },
  chittyId: {
    url: 'https://id.chitty.cc' as const,
    endpoints: {
      validateToken: '/validate',
      generateToken: '/token',
      refreshToken: '/refresh'
    }
  },
  chittyTrust: {
    url: 'https://trust.chitty.cc',
    endpoints: {
      getTrustScore: '/score',
      validateTrust: '/validate',
      updateScore: '/update'
    }
  }
};

// Main configuration object
const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Service configuration
  serviceName: process.env.SERVICE_NAME || 'chittyregistry',
  serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  serviceUrl: process.env.SERVICE_URL || 'https://registry.chitty.cc',

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    db: parseInt(process.env.REDIS_DB || '0', 10)
  },

  // ChittyID integration
  chittyId: {
    url: process.env.CHITTYID_URL || 'https://id.chitty.cc',
    clientId: process.env.CHITTYID_CLIENT_ID || 'chittyregistry',
    clientSecret: process.env.CHITTYID_CLIENT_SECRET || ''
  },

  // Health monitoring
  healthCheck: {
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
    retries: parseInt(process.env.HEALTH_CHECK_RETRIES || '3', 10)
  },

  // Security
  security: {
    requireAuthentication: process.env.NODE_ENV === 'production',
    allowedOrigins: (process.env.CORS_ORIGINS || 'https://chitty.cc,https://*.chitty.cc').split(','),
    rateLimiting: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
    }
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },

  // Authority services
  authorities: authorityConfig,

  // Cache settings
  cache: {
    ttl: 300, // 5 minutes
    maxSize: 1000
  }
};

// Validate configuration
try {
  RegistryConfigSchema.parse({
    authorities: config.authorities,
    cache: config.cache,
    healthCheck: config.healthCheck,
    security: config.security
  });

  console.log('✅ Configuration validated successfully');
} catch (error) {
  console.error('❌ Configuration validation failed:', error);
  process.exit(1);
}

// Environment-specific overrides
if (config.nodeEnv === 'development') {
  config.security.requireAuthentication = false;
  config.logging.level = 'debug';
  config.logging.format = 'console';
}

if (config.nodeEnv === 'test') {
  config.redis.url = 'redis://localhost:6379/1'; // Use test database
  config.logging.level = 'error';
}

export default config;

// Named exports for convenience
export const {
  port,
  nodeEnv,
  serviceName,
  serviceVersion,
  serviceUrl,
  redis,
  chittyId,
  healthCheck,
  security,
  logging,
  authorities,
  cache
} = config;
