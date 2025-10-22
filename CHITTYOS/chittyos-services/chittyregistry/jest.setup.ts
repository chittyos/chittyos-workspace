import { logger } from './src/utils/logger';

// Silence logs during tests to keep output clean
logger.silent = true;

// Ensure test environment
process.env.NODE_ENV = 'test';

