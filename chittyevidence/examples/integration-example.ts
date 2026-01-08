// ============================================
// CHITTY EVIDENCE PLATFORM - INTEGRATION EXAMPLE
// Shows how to use ChittyID, ContextConsciousness,
// provenance tracking, and accountability
// ============================================

/**
 * This example demonstrates the full lifecycle of:
 * 1. Registering a ChittyID (identity)
 * 2. Starting a context-aware session
 * 3. Uploading documents with provenance
 * 4. Tracking expertise growth
 * 5. Recording accountability
 */

const API_URL = 'https://your-evidence-platform.workers.dev';

// ============================================
// 1. REGISTER IDENTITY (ChittyID)
// ============================================

async function registerIdentity() {
  // Register a new AI agent identity
  const response = await fetch(`${API_URL}/chitty/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'agent',
      name: 'Document Processor Agent v1',
      metadata: {
        version: '1.0.0',
        capabilities: ['ocr', 'extraction', 'classification'],
        owner: 'chitty_user_123',
      },
    }),
  });

  const chittyId = await response.json();
  console.log('Registered ChittyID:', chittyId);
  // { id: "chitty_abc123", type: "agent", name: "Document Processor Agent v1", ... }

  return chittyId;
}

// ============================================
// 2. ADD ATTESTATIONS (Claims about identity)
// ============================================

async function addAttestation(chittyId: string) {
  // Add a certification attestation
  const response = await fetch(`${API_URL}/chitty/${chittyId}/attestations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuer: 'ChittyOS Core',
      claim: 'certified_document_processor',
      evidence: 'Passed accuracy benchmarks with 98.5% success rate',
      expiresAt: '2026-01-01T00:00:00Z',
    }),
  });

  const attestation = await response.json();
  console.log('Added attestation:', attestation);

  return attestation;
}

// ============================================
// 3. START CONTEXT SESSION (ContextConsciousness)
// ============================================

async function startSession(chittyId: string) {
  // Start an extraction session
  const response = await fetch(`${API_URL}/chitty/${chittyId}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionType: 'extraction',
      initialState: {
        purpose: 'Process batch of LLC formation documents',
        expectedDocuments: 50,
        clientId: 'client_xyz',
      },
      metadata: {
        startedBy: 'automated_pipeline',
        batchId: 'batch_20250107_001',
      },
    }),
  });

  const session = await response.json();
  console.log('Started session:', session);
  // { id: "session_xyz", chittyId: "chitty_abc123", sessionType: "extraction", ... }

  return session;
}

// ============================================
// 4. PROCESS DOCUMENT WITH FULL TRACKING
// ============================================

async function processDocumentWithTracking(
  chittyId: string,
  sessionId: string,
  documentFile: File
) {
  // Upload document
  const formData = new FormData();
  formData.append('file', documentFile);
  formData.append('uploadedBy', chittyId); // Track who uploaded
  formData.append('sessionId', sessionId); // Link to session

  const uploadResponse = await fetch(`${API_URL}/documents`, {
    method: 'POST',
    body: formData,
  });

  const uploadResult = await uploadResponse.json();
  const documentId = uploadResult.documentId;

  // Update session state with progress
  await fetch(`${API_URL}/sessions/${sessionId}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: {
        documentsProcessed: 1,
        lastDocumentId: documentId,
        status: 'processing',
      },
    }),
  });

  // Record provenance (document creation)
  await fetch(`${API_URL}/provenance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entityType: 'document',
      entityId: documentId,
      action: 'created',
      chittyId: chittyId,
      sessionId: sessionId,
      newState: {
        fileName: documentFile.name,
        status: 'processing',
        uploadedAt: new Date().toISOString(),
      },
    }),
  });

  // Wait for processing to complete (simplified)
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Get processed document
  const docResponse = await fetch(`${API_URL}/documents/${documentId}`);
  const processedDoc = await docResponse.json();

  // Record provenance (processing completed)
  await fetch(`${API_URL}/provenance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entityType: 'document',
      entityId: documentId,
      action: 'processed',
      chittyId: chittyId,
      sessionId: sessionId,
      previousState: {
        status: 'processing',
      },
      newState: {
        status: 'completed',
        documentType: processedDoc.document?.document_type,
        entitiesFound: processedDoc.entities?.length || 0,
        processedAt: new Date().toISOString(),
      },
    }),
  });

  // Record action for expertise tracking
  await fetch(`${API_URL}/chitty/${chittyId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'document_processing',
      action: 'extract_document',
      success: processedDoc.document?.processing_status === 'completed',
      competencyDemonstrated: `${processedDoc.document?.document_type}_extraction`,
    }),
  });

  return processedDoc;
}

// ============================================
// 5. RECORD ACCOUNTABILITY FOR BATCH
// ============================================

async function recordBatchAccountability(
  chittyId: string,
  sessionId: string,
  results: { success: number; failed: number; documents: string[] }
) {
  // Record accountability for the batch processing
  const response = await fetch(`${API_URL}/accountability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chittyId: chittyId,
      sessionId: sessionId,
      action: 'batch_document_processing',
      outcome: results.failed === 0 ? 'success' : results.failed > results.success ? 'failure' : 'success',
      impact: {
        documentsAffected: results.documents.length,
        entitiesAffected: 0, // Would be calculated from actual results
        authoritiesAffected: 0,
      },
    }),
  });

  const accountabilityRecord = await response.json();
  console.log('Accountability recorded:', accountabilityRecord);

  return accountabilityRecord;
}

// ============================================
// 6. END SESSION WITH FINAL STATE
// ============================================

async function endSession(sessionId: string, summary: any) {
  await fetch(`${API_URL}/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      finalState: {
        status: 'completed',
        summary: summary,
        completedAt: new Date().toISOString(),
      },
    }),
  });

  console.log('Session ended');
}

// ============================================
// 7. QUERY PROVENANCE & ACCOUNTABILITY
// ============================================

async function queryProvenance(documentId: string) {
  // Get full provenance chain
  const response = await fetch(`${API_URL}/provenance/document/${documentId}`);
  const chain = await response.json();

  console.log('Provenance chain:');
  for (const record of chain) {
    console.log(`  ${record.timestamp}: ${record.action} by ${record.chittyId}`);
  }

  // Verify chain integrity
  const verifyResponse = await fetch(`${API_URL}/provenance/document/${documentId}/verify`);
  const verification = await verifyResponse.json();

  console.log('Chain valid:', verification.valid);
  if (!verification.valid) {
    console.log('Breaks found:', verification.breaks);
  }

  return { chain, verification };
}

async function getAccountabilityReport(chittyId: string) {
  const response = await fetch(`${API_URL}/chitty/${chittyId}/accountability`);
  const report = await response.json();

  console.log('Accountability Report:');
  console.log(`  Total actions: ${report.stats.totalActions}`);
  console.log(`  Success rate: ${(report.stats.successRate * 100).toFixed(1)}%`);
  console.log(`  Dispute rate: ${(report.stats.disputeRate * 100).toFixed(1)}%`);
  console.log(`  Verification rate: ${(report.stats.verificationRate * 100).toFixed(1)}%`);

  console.log('\nExpertise:');
  for (const exp of report.expertise) {
    console.log(`  ${exp.domain}: ${exp.metrics.totalActions} actions, ${(exp.metrics.accuracyRate * 100).toFixed(1)}% accuracy`);
  }

  return report;
}

// ============================================
// 8. HANDLE DISPUTES
// ============================================

async function raiseDispute(accountabilityId: string, reason: string) {
  await fetch(`${API_URL}/accountability/${accountabilityId}/dispute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      disputedBy: 'reviewer_user_456',
      reason: reason,
    }),
  });

  console.log('Dispute raised');
}

async function resolveDispute(accountabilityId: string, resolution: string, outcome: 'success' | 'failure') {
  await fetch(`${API_URL}/accountability/${accountabilityId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resolution: resolution,
      newOutcome: outcome,
    }),
  });

  console.log('Dispute resolved');
}

// ============================================
// FULL EXAMPLE FLOW
// ============================================

async function fullExampleFlow() {
  console.log('=== CHITTY EVIDENCE PLATFORM INTEGRATION EXAMPLE ===\n');

  // 1. Register identity
  console.log('1. Registering ChittyID...');
  const chittyId = await registerIdentity();

  // 2. Add attestation
  console.log('\n2. Adding attestation...');
  await addAttestation(chittyId.id);

  // 3. Start session
  console.log('\n3. Starting context session...');
  const session = await startSession(chittyId.id);

  // 4. Process documents (simulated)
  console.log('\n4. Processing documents...');
  const mockFile = new File(['mock content'], 'llc_formation.pdf', { type: 'application/pdf' });

  // In real usage, you'd loop through actual files
  const results = { success: 1, failed: 0, documents: ['doc_123'] };

  // 5. Record accountability
  console.log('\n5. Recording accountability...');
  await recordBatchAccountability(chittyId.id, session.id, results);

  // 6. End session
  console.log('\n6. Ending session...');
  await endSession(session.id, results);

  // 7. Query provenance and accountability
  console.log('\n7. Querying provenance and accountability...');
  await getAccountabilityReport(chittyId.id);

  console.log('\n=== EXAMPLE COMPLETE ===');
}

// Export for use
export {
  registerIdentity,
  addAttestation,
  startSession,
  processDocumentWithTracking,
  recordBatchAccountability,
  endSession,
  queryProvenance,
  getAccountabilityReport,
  raiseDispute,
  resolveDispute,
  fullExampleFlow,
};
