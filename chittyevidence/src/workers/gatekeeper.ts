// ============================================
// GATEKEEPER WORKER
// Pre-Workflow deduplication and R2 upload
// ============================================

import { Env, UploadResponse } from '../types';
import { computeHash, generateId } from '../utils';

/**
 * Gatekeeper handles uploads BEFORE triggering the expensive Workflow.
 * 1. Computes/verifies content hash
 * 2. Checks D1 for duplicates
 * 3. If duplicate: returns existing doc ID (no Workflow)
 * 4. If new: uploads to R2, creates D1 record, triggers Workflow
 */
export async function handleUpload(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const precomputedHash = formData.get('hash') as string | null;
    const uploadedBy = formData.get('uploadedBy') as string | null;
    const clientId = formData.get('clientId') as string | null;

    // Validate required fields
    if (!file) {
      return Response.json(
        { error: 'Missing required field: file' },
        { status: 400 }
      );
    }

    if (!uploadedBy) {
      return Response.json(
        { error: 'Missing required field: uploadedBy' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/tiff',
      'image/webp',
    ];
    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        {
          error: `Unsupported file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Get file buffer
    const fileBuffer = await file.arrayBuffer();

    // Compute hash if not provided (single file upload)
    const contentHash = precomputedHash || (await computeHash(fileBuffer));

    // ============================================
    // DUPLICATE CHECK (cheap D1 query)
    // ============================================
    const existing = await env.DB.prepare(
      `SELECT id, r2_key, document_type, processing_status, file_name
       FROM documents
       WHERE content_hash = ?`
    )
      .bind(contentHash)
      .first<{
        id: string;
        r2_key: string;
        document_type: string | null;
        processing_status: string;
        file_name: string;
      }>();

    if (existing) {
      // Document already exists - return immediately, NO Workflow triggered
      const response: UploadResponse = {
        status: 'duplicate',
        existingDocumentId: existing.id,
        message: `Document already exists as "${existing.file_name}" (${existing.processing_status})`,
      };
      return Response.json(response);
    }

    // ============================================
    // NEW DOCUMENT - Upload to R2
    // ============================================
    const documentId = generateId();
    const datePrefix = new Date().toISOString().slice(0, 10);
    const r2Key = `documents/${datePrefix}/${documentId}/${file.name}`;

    await env.DOCUMENTS.put(r2Key, fileBuffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        documentId,
        uploadedBy,
        contentHash,
        originalFileName: file.name,
      },
    });

    // ============================================
    // Create initial D1 record (reserves hash)
    // ============================================
    await env.DB.prepare(
      `INSERT INTO documents
       (id, workflow_instance_id, r2_key, content_hash, file_name, file_size, mime_type, processing_status, uploaded_by, client_id)
       VALUES (?, '', ?, ?, ?, ?, ?, 'queued', ?, ?)`
    )
      .bind(
        documentId,
        r2Key,
        contentHash,
        file.name,
        fileBuffer.byteLength,
        file.type,
        uploadedBy,
        clientId || null
      )
      .run();

    // ============================================
    // Trigger Workflow (document already in R2 and D1)
    // ============================================
    const instance = await env.DOCUMENT_WORKFLOW.create({
      params: {
        documentId,
        r2Key,
        contentHash,
        fileName: file.name,
        contentType: file.type,
        uploadedBy,
        clientId: clientId || undefined,
      },
    });

    // Update document with workflow instance ID
    await env.DB.prepare(
      `UPDATE documents SET workflow_instance_id = ? WHERE id = ?`
    )
      .bind(instance.id, documentId)
      .run();

    const response: UploadResponse = {
      status: 'processing',
      documentId,
      workflowInstanceId: instance.id,
      message: 'Document uploaded and processing started',
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: `Upload failed: ${error}` },
      { status: 500 }
    );
  }
}

/**
 * Bulk upload handler - processes manifest of pre-hashed files
 */
export async function handleBulkUpload(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const formData = await request.formData();
    const manifestFile = formData.get('manifest') as File | null;
    const uploadedBy = formData.get('uploadedBy') as string | null;
    const clientId = formData.get('clientId') as string | null;

    if (!manifestFile || !uploadedBy) {
      return Response.json(
        { error: 'Missing required fields: manifest, uploadedBy' },
        { status: 400 }
      );
    }

    const manifestText = await manifestFile.text();
    const lines = manifestText.trim().split('\n');
    const header = lines[0];
    const rows = lines.slice(1);

    // Parse CSV header
    const columns = header.split(',');
    const hashIndex = columns.findIndex((c) =>
      c.toLowerCase().includes('hash') || c.toLowerCase().includes('sha256')
    );
    const fileIndex = columns.findIndex(
      (c) => c.toLowerCase().includes('file') || c.toLowerCase().includes('path')
    );

    if (hashIndex === -1 || fileIndex === -1) {
      return Response.json(
        { error: 'Manifest must have hash and file columns' },
        { status: 400 }
      );
    }

    // Check all hashes against D1 in batch
    const hashes = rows.map((row) => row.split(',')[hashIndex]);
    const placeholders = hashes.map(() => '?').join(',');

    const existingDocs = await env.DB.prepare(
      `SELECT content_hash FROM documents WHERE content_hash IN (${placeholders})`
    )
      .bind(...hashes)
      .all();

    const existingHashes = new Set(
      (existingDocs.results as any[]).map((d) => d.content_hash)
    );

    // Filter to only new documents
    const newRows = rows.filter((row) => {
      const hash = row.split(',')[hashIndex];
      return !existingHashes.has(hash);
    });

    return Response.json({
      totalInManifest: rows.length,
      duplicatesSkipped: rows.length - newRows.length,
      newToProcess: newRows.length,
      message: `${newRows.length} new documents ready for upload. Use /upload endpoint for each.`,
      newHashes: newRows.slice(0, 100).map((r) => r.split(',')[hashIndex]),
    });
  } catch (error) {
    console.error('Bulk upload check error:', error);
    return Response.json(
      { error: `Bulk check failed: ${error}` },
      { status: 500 }
    );
  }
}

/**
 * Check processing status of a document
 */
export async function handleStatusCheck(
  documentId: string,
  env: Env
): Promise<Response> {
  const doc = await env.DB.prepare(
    `SELECT id, workflow_instance_id, file_name, document_type, processing_status, created_at, updated_at
     FROM documents
     WHERE id = ?`
  )
    .bind(documentId)
    .first();

  if (!doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }

  // If processing, get workflow status
  let workflowStatus = null;
  if ((doc as any).workflow_instance_id && (doc as any).processing_status === 'processing') {
    try {
      const instance = await env.DOCUMENT_WORKFLOW.get(
        (doc as any).workflow_instance_id
      );
      workflowStatus = await instance.status();
    } catch {
      // Workflow may have completed
    }
  }

  return Response.json({
    document: doc,
    workflowStatus,
  });
}
