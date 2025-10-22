/**
 * Notion Webhooks Handler
 *
 * Handles incoming webhooks from Notion for bidirectional sync
 * Processes updates from Notion databases and propagates to ChittyOS services
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const router = Router();

// Notion webhook signature verification
function verifyNotionSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Webhook authentication middleware
function authenticateWebhook(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-notion-signature'] as string;
  const webhookSecret = process.env.NOTION_WEBHOOK_SECRET || 'chitty-notion-secret';

  if (!signature) {
    logger.warn('Webhook received without signature');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const payload = JSON.stringify(req.body);
  const isValid = verifyNotionSignature(payload, signature, webhookSecret);

  if (!isValid) {
    logger.warn('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

/**
 * Main webhook endpoint
 * Receives updates from all Notion databases
 */
router.post('/webhook/notion', authenticateWebhook, async (req: Request, res: Response) => {
  try {
    const { type, database_id } = req.body;

    logger.info(`Received Notion webhook: type=${type}, database_id=${database_id}`);

    // Acknowledge receipt immediately
    res.status(200).json({ received: true, timestamp: new Date().toISOString() });

    // Process webhook asynchronously
    processNotionWebhook(req.body).catch((error) => {
      logger.error('Failed to process Notion webhook:', error);
    });
  } catch (error: any) {
    logger.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Process Notion webhook data
 */
async function processNotionWebhook(webhookData: any): Promise<void> {
  const { type, database_id, page_id, properties } = webhookData;

  // Determine which database was updated
  const databaseType = identifyDatabase(database_id);

  if (!databaseType) {
    logger.warn(`Unknown database ID: ${database_id}`);
    return;
  }

  logger.info(`Processing ${type} event for ${databaseType} database`);

  switch (databaseType) {
    case 'ChittyRegistry':
      await handleRegistryUpdate(page_id, properties, type);
      break;

    case 'ChittySchema':
      await handleSchemaUpdate(page_id, properties, type);
      break;

    case 'ChittyGov':
      await handleGovUpdate(page_id, properties, type);
      break;

    case 'ChittyChronicle':
      // Chronicle is write-only from ChittyOS, ignore updates from Notion
      logger.warn('Received update for ChittyChronicle (write-only database)');
      break;

    default:
      logger.warn(`Unhandled database type: ${databaseType}`);
  }
}

/**
 * Identify database type from database ID
 */
function identifyDatabase(databaseId: string): string | null {
  // Load database mappings from environment variables
  const dbMapping: Record<string, string> = {
    [process.env.CHITTYREGISTRY_NOTION_DB_ID || '']: 'ChittyRegistry',
    [process.env.CHITTYSCHEMA_NOTION_DB_ID || '']: 'ChittySchema',
    [process.env.CHITTYGOV_NOTION_DB_ID || '']: 'ChittyGov',
    [process.env.CHITTYCHRONICLE_NOTION_DB_ID || '']: 'ChittyChronicle',
  };

  // Remove empty key if no database IDs configured
  delete dbMapping[''];

  return dbMapping[databaseId] || null;
}

/**
 * Handle ChittyRegistry updates from Notion
 */
async function handleRegistryUpdate(
  pageId: string,
  properties: any,
  eventType: string
): Promise<void> {
  try {
    logger.info(`Handling registry update: page=${pageId}, type=${eventType}`);

    // Extract properties
    const chittyId = properties.ChittyID?.title?.[0]?.text?.content;
    const name = properties.Name?.rich_text?.[0]?.text?.content;
    const category = properties.Category?.select?.name;
    const status = properties.Status?.select?.name;
    const health = properties.Health?.select?.name;

    if (!chittyId) {
      logger.warn('Registry update missing ChittyID');
      return;
    }

    // Update ChittyOS registry
    const registryUpdate = {
      chittyId,
      name,
      category,
      status,
      health,
      lastUpdated: new Date().toISOString(),
      source: 'notion',
      notionPageId: pageId,
    };

    // Send to ChittyRegistry API
    await updateChittyRegistry(registryUpdate);

    logger.info(`Successfully synced registry update for ${chittyId}`);
  } catch (error: any) {
    logger.error('Failed to handle registry update:', error);
    throw error;
  }
}

/**
 * Handle ChittySchema updates from Notion
 */
async function handleSchemaUpdate(
  pageId: string,
  properties: any,
  eventType: string
): Promise<void> {
  try {
    logger.info(`Handling schema update: page=${pageId}, type=${eventType}`);

    const chittyId = properties.ChittyID?.title?.[0]?.text?.content;
    const entityType = properties.EntityType?.select?.name;
    const schemaVersion = properties.SchemaVersion?.rich_text?.[0]?.text?.content;
    const fieldsJson = properties.Fields?.rich_text?.[0]?.text?.content;

    if (!chittyId || !entityType) {
      logger.warn('Schema update missing required fields');
      return;
    }

    const schemaUpdate = {
      chittyId,
      entityType,
      schemaVersion,
      fields: fieldsJson ? JSON.parse(fieldsJson) : {},
      source: 'notion',
      notionPageId: pageId,
    };

    // Send to ChittySchema service
    await updateChittySchema(schemaUpdate);

    logger.info(`Successfully synced schema update for ${chittyId}`);
  } catch (error: any) {
    logger.error('Failed to handle schema update:', error);
    throw error;
  }
}

/**
 * Handle ChittyGov updates from Notion
 */
async function handleGovUpdate(
  pageId: string,
  properties: any,
  eventType: string
): Promise<void> {
  try {
    logger.info(`Handling governance update: page=${pageId}, type=${eventType}`);

    const chittyId = properties.ChittyID?.title?.[0]?.text?.content;
    const policyName = properties.PolicyName?.rich_text?.[0]?.text?.content;
    const status = properties.Status?.select?.name;
    const complianceLevel = properties.ComplianceLevel?.select?.name;

    if (!chittyId || !policyName) {
      logger.warn('Governance update missing required fields');
      return;
    }

    const govUpdate = {
      chittyId,
      policyName,
      status,
      complianceLevel,
      source: 'notion',
      notionPageId: pageId,
    };

    // Send to ChittyGov service
    await updateChittyGov(govUpdate);

    logger.info(`Successfully synced governance update for ${chittyId}`);
  } catch (error: any) {
    logger.error('Failed to handle governance update:', error);
    throw error;
  }
}

/**
 * Update ChittyRegistry via API
 */
async function updateChittyRegistry(update: any): Promise<void> {
  const registryEndpoint = process.env.REGISTRY_SERVICE || 'https://registry.chitty.cc';

  try {
    const response = await fetch(`${registryEndpoint}/api/v1/tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CHITTY_ID_TOKEN}`,
      },
      body: JSON.stringify(update),
    });

    if (!response.ok) {
      throw new Error(`Registry update failed: ${response.statusText}`);
    }

    logger.info('ChittyRegistry updated successfully');
  } catch (error: any) {
    logger.error('Failed to update ChittyRegistry:', error);
    throw error;
  }
}

/**
 * Update ChittySchema via API
 */
async function updateChittySchema(update: any): Promise<void> {
  const schemaEndpoint = process.env.SCHEMA_SERVICE || 'https://schema.chitty.cc';

  try {
    const response = await fetch(`${schemaEndpoint}/api/v1/entities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CHITTY_ID_TOKEN}`,
      },
      body: JSON.stringify(update),
    });

    if (!response.ok) {
      throw new Error(`Schema update failed: ${response.statusText}`);
    }

    logger.info('ChittySchema updated successfully');
  } catch (error: any) {
    logger.error('Failed to update ChittySchema:', error);
    throw error;
  }
}

/**
 * Update ChittyGov via API
 */
async function updateChittyGov(update: any): Promise<void> {
  const govEndpoint = process.env.GOV_SERVICE || 'https://gov.chitty.cc';

  try {
    const response = await fetch(`${govEndpoint}/api/v1/policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CHITTY_ID_TOKEN}`,
      },
      body: JSON.stringify(update),
    });

    if (!response.ok) {
      throw new Error(`Governance update failed: ${response.statusText}`);
    }

    logger.info('ChittyGov updated successfully');
  } catch (error: any) {
    logger.error('Failed to update ChittyGov:', error);
    throw error;
  }
}

/**
 * Health check endpoint for webhook system
 */
router.get('/webhook/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'notion-webhooks',
    timestamp: new Date().toISOString(),
    endpoints: ['/webhook/notion'],
  });
});

export default router;
