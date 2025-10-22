export interface MercuryConfig {
  apiKey: string;
  baseUrl: string;
}

export interface CircleConfig {
  apiKey?: string;
  masterWalletId?: string;
}

export interface IssuerConfig {
  stripeApiKey?: string;
  lithicApiKey?: string;
}

export interface IntegrationConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface AppConfig {
  mercury: MercuryConfig;
  circle?: CircleConfig;
  issuers?: IssuerConfig;
  referralBonusUsd?: number;
  baseUrl: string;
  chittyId?: IntegrationConfig;
  chittyTrust?: IntegrationConfig;
  chittyLedger?: IntegrationConfig;
}

export function loadConfig(): AppConfig {
  const {
    MERCURY_API_KEY,
    MERCURY_BASE_URL = 'https://api.mercury.com',
    CIRCLE_API_KEY,
    CIRCLE_MASTER_WALLET_ID,
    STRIPE_ISSUING_KEY,
    LITHIC_API_KEY,
    REFERRAL_BONUS_USD,
    APP_BASE_URL = 'http://localhost:3000',
    CHITTYID_BASE_URL,
    CHITTYID_API_KEY,
    CHITTYTRUST_BASE_URL,
    CHITTYTRUST_API_KEY,
    CHITTYLEDGER_BASE_URL,
    CHITTYLEDGER_API_KEY,
  } = process.env;

  if (!MERCURY_API_KEY) {
    throw new Error('MERCURY_API_KEY is required');
  }

  return {
    mercury: {
      apiKey: MERCURY_API_KEY,
      baseUrl: MERCURY_BASE_URL,
    },
    circle: CIRCLE_API_KEY
      ? {
          apiKey: CIRCLE_API_KEY,
          masterWalletId: CIRCLE_MASTER_WALLET_ID,
        }
      : undefined,
    issuers:
      STRIPE_ISSUING_KEY || LITHIC_API_KEY
        ? {
            stripeApiKey: STRIPE_ISSUING_KEY,
            lithicApiKey: LITHIC_API_KEY,
          }
        : undefined,
    referralBonusUsd: REFERRAL_BONUS_USD ? Number(REFERRAL_BONUS_USD) : undefined,
    baseUrl: APP_BASE_URL,
    chittyId: CHITTYID_BASE_URL
      ? {
          baseUrl: CHITTYID_BASE_URL,
          apiKey: CHITTYID_API_KEY,
        }
      : undefined,
    chittyTrust: CHITTYTRUST_BASE_URL
      ? {
          baseUrl: CHITTYTRUST_BASE_URL,
          apiKey: CHITTYTRUST_API_KEY,
        }
      : undefined,
    chittyLedger: CHITTYLEDGER_BASE_URL
      ? {
          baseUrl: CHITTYLEDGER_BASE_URL,
          apiKey: CHITTYLEDGER_API_KEY,
        }
      : undefined,
  };
}
