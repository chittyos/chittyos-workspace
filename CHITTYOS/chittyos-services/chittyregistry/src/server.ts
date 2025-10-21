// ChittyOS Registry Server with Schema Authority Integration
// Main server with canon.chitty.cc and schema.chitty.cc integration

import express from 'express';
import cors from 'cors';
import { NeonService } from './services/NeonService';
import { RegistryService } from './services/RegistryService';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize services
const neon = new NeonService();
const registry = new RegistryService(neon);

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = registry.getHealth();
  res.json({
    status: 'healthy',
    registry: health,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Registry endpoints
app.get('/services', async (req, res) => {
  try {
    const services = await registry.getServices();
    res.json({
      services,
      total: services.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/services/:id', async (req, res) => {
  try {
    const service = await registry.getService(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/services', async (req, res) => {
  try {
    const result = await registry.registerService(req.body);

    if (result.success) {
      res.status(201).json({
        message: 'Service registered successfully',
        warnings: result.warnings || []
      });
    } else {
      res.status(400).json({
        message: 'Service registration failed',
        errors: result.errors || [],
        warnings: result.warnings || []
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schema and canonical services endpoints
app.get('/canonical', async (req, res) => {
  try {
    const canonical = await registry.getCanonicalServices();
    res.json({
      canonical,
      authority: 'schema.chitty.cc',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/schema', async (req, res) => {
  try {
    const schemaInfo = await registry.getSchemaInfo();
    res.json(schemaInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/schema/refresh', async (req, res) => {
  try {
    await registry.refreshSchemas();
    res.json({
      message: 'Schemas refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/services/:id/validate', async (req, res) => {
  try {
    const validation = await registry.validateService(req.params.id);
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registry statistics
app.get('/stats', async (req, res) => {
  try {
    const stats = await registry.getRegistryStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Service health endpoints
app.put('/services/:id/health', async (req, res) => {
  try {
    const { healthStatus } = req.body;
    if (!['healthy', 'unhealthy', 'unknown'].includes(healthStatus)) {
      return res.status(400).json({ error: 'Invalid health status' });
    }

    await registry.updateServiceHealth(req.params.id, healthStatus);
    res.json({
      message: 'Health status updated',
      serviceId: req.params.id,
      healthStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Discovery endpoint for MCP agents
app.get('/discovery', async (req, res) => {
  try {
    const services = await registry.getServices();
    const mcpServices = services.filter(s =>
      s.features?.includes('ai-orchestration') ||
      s.features?.includes('mcp-agent') ||
      s.type === 'core'
    );

    res.json({
      services: mcpServices.map(s => ({
        id: s.id,
        name: s.name,
        baseUrl: s.baseUrl,
        endpoints: s.endpoints,
        features: s.features,
        schemaCompliant: s.schemaValidation?.valid || false
      })),
      authority: 'schema.chitty.cc',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ChittyOS ecosystem info
app.get('/ecosystem', async (req, res) => {
  try {
    const [services, canonical, stats, schemaInfo] = await Promise.all([
      registry.getServices(),
      registry.getCanonicalServices(),
      registry.getRegistryStats(),
      registry.getSchemaInfo()
    ]);

    res.json({
      ecosystem: 'ChittyOS Trust Operating System',
      version: '1.0.0',
      registry: {
        services: services.length,
        canonical: canonical.length,
        stats
      },
      schema: schemaInfo,
      authorities: {
        schema: 'schema.chitty.cc',
        canon: 'canon.chitty.cc'
      },
      coreServices: services.filter(s => s.type === 'core'),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 ChittyOS Registry Server running on port ${port}`);
  console.log(`📋 Registry API: http://localhost:${port}/services`);
  console.log(`🔍 Health Check: http://localhost:${port}/health`);
  console.log(`📜 Schema Info: http://localhost:${port}/schema`);
  console.log(`🌍 Ecosystem: http://localhost:${port}/ecosystem`);
});

export default app;
