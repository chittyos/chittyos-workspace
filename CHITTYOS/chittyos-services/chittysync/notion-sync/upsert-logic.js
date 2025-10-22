/**
 * Robust Upsert Logic with Idempotency
 * Handles create vs update with proper deduplication
 */

import { NOTION_CONFIG } from './notion-sync-config.js';
import { transformToNotionPayload } from './schema-validator.js';

/**
 * Upsert AtomicFact to Notion with idempotency
 */
export async function upsertAtomicFact(notionClient, atomicFact, options = {}) {
  const { dryRun = false } = options;
  const metrics = {
    operation: null,
    factId: atomicFact.factId,
    startTime: Date.now(),
    error: null,
    skipped: false
  };

  try {
    // Transform to Notion payload
    const transformation = transformToNotionPayload(atomicFact);
    if (!transformation.isValid) {
      metrics.error = `Schema validation failed: ${transformation.errors.join(', ')}`;
      throw new Error(metrics.error);
    }

    // Check for existing page by Fact ID
    const existing = await findExistingPage(notionClient, atomicFact.factId);

    if (dryRun) {
      metrics.operation = existing ? 'would_update' : 'would_create';
      metrics.payload = transformation.properties;
      return metrics;
    }

    if (existing) {
      // Update existing page
      const updateResult = await updatePageIfChanged(
        notionClient,
        existing.id,
        transformation.properties,
        existing.properties
      );

      metrics.operation = updateResult.changed ? 'updated' : 'skipped';
      metrics.pageId = existing.id;
      metrics.changed = updateResult.changed;
      metrics.changedFields = updateResult.changedFields;

    } else {
      // Create new page
      const createResult = await createPage(
        notionClient,
        transformation.properties,
        atomicFact.factId
      );

      metrics.operation = 'created';
      metrics.pageId = createResult.id;
    }

    metrics.duration = Date.now() - metrics.startTime;
    return metrics;

  } catch (error) {
    metrics.error = error.message;
    metrics.duration = Date.now() - metrics.startTime;
    throw error;
  }
}

/**
 * Find existing page by Fact ID
 */
async function findExistingPage(notionClient, factId) {
  const { fieldMap, database } = NOTION_CONFIG;

  try {
    const response = await notionClient.databases.query({
      database_id: database.atomicFactsId,
      filter: {
        property: fieldMap.factId,
        title: {
          equals: factId
        }
      },
      page_size: 1
    });

    return response.results.length > 0 ? response.results[0] : null;

  } catch (error) {
    // Fallback to external_id if title search fails
    try {
      const fallbackResponse = await notionClient.databases.query({
        database_id: database.atomicFactsId,
        filter: {
          property: fieldMap.externalId,
          rich_text: {
            equals: factId
          }
        },
        page_size: 1
      });

      return fallbackResponse.results.length > 0 ? fallbackResponse.results[0] : null;

    } catch (fallbackError) {
      console.warn(`Failed to find existing page for ${factId}:`, fallbackError.message);
      return null;
    }
  }
}

/**
 * Update page only if properties have changed
 */
async function updatePageIfChanged(notionClient, pageId, newProperties, existingProperties) {
  const changedFields = [];
  const updatePayload = {};

  // Compare each property
  for (const [propName, newValue] of Object.entries(newProperties)) {
    const existing = existingProperties[propName];

    if (hasPropertyChanged(existing, newValue)) {
      updatePayload[propName] = newValue;
      changedFields.push(propName);
    }
  }

  if (changedFields.length === 0) {
    return { changed: false, changedFields: [] };
  }

  // Perform update
  await notionClient.pages.update({
    page_id: pageId,
    properties: updatePayload
  });

  return {
    changed: true,
    changedFields,
    updatedProperties: Object.keys(updatePayload)
  };
}

/**
 * Create new page with idempotency key
 */
async function createPage(notionClient, properties, factId) {
  const { database } = NOTION_CONFIG;

  const createPayload = {
    parent: {
      database_id: database.atomicFactsId
    },
    properties
  };

  // Add idempotency key header
  const headers = {
    'Notion-Version': '2022-06-28',
    'X-Idempotency-Key': `fact-${factId}-${Date.now()}`
  };

  return await notionClient.pages.create(createPayload, { headers });
}

/**
 * Compare Notion property values to detect changes
 */
function hasPropertyChanged(existing, newValue) {
  if (!existing && !newValue) return false;
  if (!existing || !newValue) return true;

  // Title property comparison
  if (newValue.title) {
    const existingText = existing.title?.[0]?.text?.content || '';
    const newText = newValue.title[0]?.text?.content || '';
    return existingText !== newText;
  }

  // Rich text comparison
  if (newValue.rich_text) {
    const existingText = existing.rich_text?.[0]?.text?.content || '';
    const newText = newValue.rich_text[0]?.text?.content || '';
    return existingText !== newText;
  }

  // Select comparison
  if (newValue.select) {
    const existingSelect = existing.select?.name || '';
    const newSelect = newValue.select.name || '';
    return existingSelect !== newSelect;
  }

  // Multi-select comparison
  if (newValue.multi_select) {
    const existingNames = (existing.multi_select || []).map(s => s.name).sort();
    const newNames = newValue.multi_select.map(s => s.name).sort();
    return JSON.stringify(existingNames) !== JSON.stringify(newNames);
  }

  // Number comparison
  if (newValue.number !== undefined) {
    return existing.number !== newValue.number;
  }

  // Date comparison
  if (newValue.date) {
    const existingDate = existing.date?.start || '';
    const newDate = newValue.date.start || '';
    return existingDate !== newDate;
  }

  return false;
}

/**
 * Batch upsert multiple facts
 */
export async function batchUpsertFacts(notionClient, atomicFacts, options = {}) {
  const {
    batchSize = NOTION_CONFIG.sync.batchSize,
    delayBetweenBatches = NOTION_CONFIG.sync.batchDelay,
    dryRun = false
  } = options;

  const results = {
    total: atomicFacts.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    processed: [],
    startTime: Date.now()
  };

  // Process in batches
  for (let i = 0; i < atomicFacts.length; i += batchSize) {
    const batch = atomicFacts.slice(i, i + batchSize);

    // Process batch concurrently
    const batchPromises = batch.map(async (fact) => {
      try {
        const result = await upsertAtomicFact(notionClient, fact, { dryRun });

        switch (result.operation) {
          case 'created':
          case 'would_create':
            results.created++;
            break;
          case 'updated':
          case 'would_update':
            results.updated++;
            break;
          default:
            results.skipped++;
        }

        results.processed.push(result);
        return result;

      } catch (error) {
        const errorResult = {
          factId: fact.factId,
          operation: 'error',
          error: error.message,
          fact
        };

        results.errors.push(errorResult);
        return errorResult;
      }
    });

    await Promise.all(batchPromises);

    // Delay between batches to respect rate limits
    if (i + batchSize < atomicFacts.length && delayBetweenBatches > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  results.duration = Date.now() - results.startTime;
  results.successRate = (results.total - results.errors.length) / results.total;

  return results;
}

/**
 * Deduplicate facts by factId before processing
 */
export function deduplicateFacts(atomicFacts) {
  const seen = new Set();
  const unique = [];
  const duplicates = [];

  for (const fact of atomicFacts) {
    if (!fact.factId) {
      duplicates.push({ fact, reason: 'missing_factId' });
      continue;
    }

    if (seen.has(fact.factId)) {
      duplicates.push({ fact, reason: 'duplicate_factId' });
      continue;
    }

    seen.add(fact.factId);
    unique.push(fact);
  }

  return {
    unique,
    duplicates,
    originalCount: atomicFacts.length,
    uniqueCount: unique.length,
    duplicateCount: duplicates.length
  };
}