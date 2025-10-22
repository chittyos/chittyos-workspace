/**
 * ChittyGov Service
 *
 * Governance and compliance service with evidentiary audit trails.
 * Driven by ChittyFoundation standards (DNA/ID/Canon/Register).
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { ComplianceService } from "./services/ComplianceService";
import { EvidenceService } from "./services/EvidenceService";
import { AuditService } from "./services/AuditService";

type Bindings = {
  DB: D1Database;
  CACHE: KVNamespace;
  CHITTY_ID_TOKEN: string;
  CHITTY_CANON_URL: string;
  CHITTY_REGISTER_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS middleware
app.use(
  "/*",
  cors({
    origin: ["https://chittygov.app", "http://localhost:5173"],
    credentials: true,
  }),
);

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    service: "chittygov-service",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Compliance API
app.post("/api/compliance/check", async (c) => {
  const { entityId, standards } = await c.req.json();
  const complianceService = new ComplianceService(c.env);

  const result = await complianceService.checkCompliance(entityId, standards);
  return c.json(result);
});

app.get("/api/compliance/:entityId", async (c) => {
  const entityId = c.req.param("entityId");
  const complianceService = new ComplianceService(c.env);

  const status = await complianceService.getComplianceStatus(entityId);
  return c.json(status);
});

// Evidence API
app.post("/api/evidence/collect", async (c) => {
  const evidenceData = await c.req.json();
  const evidenceService = new EvidenceService(c.env);

  const evidence = await evidenceService.collectEvidence(evidenceData);
  return c.json(evidence);
});

app.get("/api/evidence/:evidenceId", async (c) => {
  const evidenceId = c.req.param("evidenceId");
  const evidenceService = new EvidenceService(c.env);

  const evidence = await evidenceService.getEvidence(evidenceId);
  return c.json(evidence);
});

// Audit Trail API
app.post("/api/audit/log", async (c) => {
  const auditData = await c.req.json();
  const auditService = new AuditService(c.env);

  const auditEntry = await auditService.logAudit(auditData);
  return c.json(auditEntry);
});

app.get("/api/audit/:entityId", async (c) => {
  const entityId = c.req.param("entityId");
  const auditService = new AuditService(c.env);

  const auditTrail = await auditService.getAuditTrail(entityId);
  return c.json(auditTrail);
});

// Governance Reports
app.get("/api/reports/compliance/:entityId", async (c) => {
  const entityId = c.req.param("entityId");
  const complianceService = new ComplianceService(c.env);

  const report = await complianceService.generateComplianceReport(entityId);
  return c.json(report);
});

export default app;
