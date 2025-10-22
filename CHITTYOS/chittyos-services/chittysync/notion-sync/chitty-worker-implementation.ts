// Cloudflare Worker for ChittyOS Legal Evidence Management
// Place this in chitty-worker/src/index.ts

import { Client } from '@neondatabase/serverless';
import { z } from 'zod';

export interface Env {
  NEON_URL: string;
  NOTION_API_KEY?: string;
  NOTION_DB_COMMAND_CENTER?: string;
}

// Response wrapper
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Error wrapper
function errorResponse(message: string, status = 500) {
  return jsonResponse({ ok: false, error: message }, status);
}

// Generate ChittyID
function generateChittyId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Health check
    if (path === '/health') {
      return jsonResponse({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
    }

    // Initialize Neon client
    const client = new Client(env.NEON_URL);
    await client.connect();

    try {
      // Route: POST /v1/case/items - Create case
      if (method === 'POST' && path === '/v1/case/items') {
        const body = await request.json() as any;
        const chittyId = generateChittyId('CASE');

        const result = await client.query(
          `INSERT INTO "case" (chitty_id, name, jurisdiction, case_type, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [chittyId, body.name, body.jurisdiction || null, body.case_type || null, body.status || 'open']
        );

        return jsonResponse({
          ok: true,
          result: result.rows[0],
          chitty_id: chittyId,
        });
      }

      // Route: POST /v1/evidence/items - Add evidence
      if (method === 'POST' && path === '/v1/evidence/items') {
        const body = await request.json() as any;
        const chittyId = generateChittyId('DOC');

        // Get case UUID if case_id provided
        let caseUuid = null;
        if (body.case_id) {
          const caseResult = await client.query(
            `SELECT id FROM "case" WHERE chitty_id = $1`,
            [body.case_id]
          );
          caseUuid = caseResult.rows[0]?.id || null;
        }

        const result = await client.query(
          `INSERT INTO document (chitty_id, case_id, title, file_url, file_hash, storage_provider)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            chittyId,
            caseUuid,
            body.title,
            body.file_url,
            body.file_hash || null,
            body.storage_provider || 'external',
          ]
        );

        return jsonResponse({
          ok: true,
          result: result.rows[0],
          chitty_id: chittyId,
        });
      }

      // Route: POST /v1/verify/events - Log verification event
      if (method === 'POST' && path === '/v1/verify/events') {
        const body = await request.json() as any;

        const result = await client.query(
          `INSERT INTO verification_event (chitty_id, event_type, actor, proof_url, blockchain_tx)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            body.chitty_id,
            body.event_type,
            body.actor,
            body.proof_url || null,
            body.blockchain_tx || null,
          ]
        );

        return jsonResponse({
          ok: true,
          result: result.rows[0],
        });
      }

      // Route: GET /v1/case/timeline - Get case timeline
      if (method === 'GET' && path === '/v1/case/timeline') {
        const caseId = url.searchParams.get('case_id');
        if (!caseId) {
          return errorResponse('case_id parameter required', 400);
        }

        // Get case details
        const caseResult = await client.query(
          `SELECT * FROM "case" WHERE chitty_id = $1`,
          [caseId]
        );

        if (caseResult.rows.length === 0) {
          return errorResponse('Case not found', 404);
        }

        const caseData = caseResult.rows[0];

        // Get documents
        const docsResult = await client.query(
          `SELECT d.*,
                  (SELECT array_agg(row_to_json(ve))
                   FROM verification_event ve
                   WHERE ve.chitty_id = d.chitty_id) as verifications
           FROM document d
           WHERE d.case_id = $1
           ORDER BY d.created_at DESC`,
          [caseData.id]
        );

        // Get legal units (facts/allegations)
        const unitsResult = await client.query(
          `SELECT * FROM legal_unit
           WHERE case_id = $1
           ORDER BY created_at DESC`,
          [caseId]
        );

        // Get verified facts
        const factsResult = await client.query(
          `SELECT * FROM v_verified_facts
           WHERE case_id = $1
           ORDER BY stamped_date DESC`,
          [caseId]
        );

        return jsonResponse({
          ok: true,
          result: {
            case: caseData,
            documents: docsResult.rows,
            legal_units: unitsResult.rows,
            verified_facts: factsResult.rows,
            statistics: {
              total_documents: docsResult.rows.length,
              total_legal_units: unitsResult.rows.length,
              verified_facts: factsResult.rows.length,
            },
          },
          citations: factsResult.rows.map((f: any) => ({
            label: f.label,
            text: f.text_excerpt,
            date: f.stamped_date,
            page: f.page,
          })),
          meta: {
            case_id: caseId,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Route: GET /v1/memory/search - Search
      if (method === 'GET' && path === '/v1/memory/search') {
        const query = url.searchParams.get('q');
        const limit = parseInt(url.searchParams.get('limit') || '20');

        if (!query) {
          return errorResponse('q parameter required', 400);
        }

        // Search across documents and legal units
        const searchResults = await client.query(
          `SELECT 'document' as type, chitty_id, title as name, content, created_at
           FROM document
           WHERE title ILIKE $1 OR content ILIKE $1
           UNION ALL
           SELECT 'legal_unit' as type, case_id as chitty_id, text_excerpt as name,
                  label::text as content, created_at
           FROM legal_unit
           WHERE text_excerpt ILIKE $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [`%${query}%`, limit]
        );

        return jsonResponse({
          ok: true,
          result: searchResults.rows,
          meta: {
            query,
            limit,
            count: searchResults.rows.length,
          },
        });
      }

      // Route: POST /v1/registry/tools - Register tools
      if (method === 'POST' && path === '/v1/registry/tools') {
        const tools = await request.json() as any[];
        return jsonResponse({
          ok: true,
          result: {
            registered: tools.length,
            tools: tools.map(t => t.name),
          },
        });
      }

      // 404 for unknown routes
      return errorResponse('Not found', 404);

    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse(error instanceof Error ? error.message : 'Internal server error');
    } finally {
      await client.end();
    }
  },
};