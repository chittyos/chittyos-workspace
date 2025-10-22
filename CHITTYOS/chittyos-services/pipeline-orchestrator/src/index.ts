import { CreateProjectWorkflow } from './workflows/create-project';
import { ProgressStageWorkflow } from './workflows/progress-stage';
import { PipelineState, ProjectStorage } from './storage/durable-objects';

export { PipelineState, ProjectStorage };

interface Env {
  PIPELINE_STATE: DurableObjectNamespace;
  PROJECT_STORAGE: DurableObjectNamespace;
  AI: any;
  AI_GATEWAY: any;
  CREATE_PROJECT: Workflow;
  PROGRESS_STAGE: Workflow;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Routes
      switch (true) {
        // Health check
        case path === '/health':
          return new Response(JSON.stringify({
            status: 'healthy',
            service: 'chittyos-pipeline-orchestrator',
            version: '2.0.0',
            timestamp: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        // Create new project
        case path === '/api/projects' && request.method === 'POST':
          return await handleCreateProject(request, env, corsHeaders);

        // Progress project to next stage
        case path.startsWith('/api/projects/') && path.endsWith('/progress') && request.method === 'POST':
          return await handleProgressProject(request, env, path, corsHeaders);

        // Approve project for stage progression
        case path.startsWith('/api/projects/') && path.endsWith('/approve') && request.method === 'POST':
          return await handleApproveProject(request, env, path, corsHeaders);

        // Get project status
        case path.startsWith('/api/projects/') && request.method === 'GET':
          return await handleGetProject(env, path, corsHeaders);

        // List projects
        case path === '/api/projects' && request.method === 'GET':
          return await handleListProjects(url, env, corsHeaders);

        // Get pending approvals
        case path === '/api/approvals/pending' && request.method === 'GET':
          return await handlePendingApprovals(env, corsHeaders);

        default:
          return new Response('Not found', {
            status: 404,
            headers: corsHeaders
          });
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function handleCreateProject(request: Request, env: Env, corsHeaders: any) {
  const { name, description, model_preference } = await request.json();

  // Start workflow
  const instance = await env.CREATE_PROJECT.create({
    params: { name, description, model_preference }
  });

  const result = await instance.wait();

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleProgressProject(request: Request, env: Env, path: string, corsHeaders: any) {
  const projectId = path.split('/')[3];
  const { targetStage, skipGates } = await request.json();

  // Start workflow
  const instance = await env.PROGRESS_STAGE.create({
    params: { projectId, targetStage, skipGates }
  });

  const result = await instance.wait();

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleApproveProject(request: Request, env: Env, path: string, corsHeaders: any) {
  const projectId = path.split('/')[3];
  const { approved, approver, reason } = await request.json();

  // Resume paused workflow
  // Note: This requires the workflow instance ID which should be stored in project metadata
  const id = env.PIPELINE_STATE.idFromName(projectId);
  const obj = env.PIPELINE_STATE.get(id);
  const response = await obj.fetch('http://internal/get');
  const project = await response.json();

  if (!project.workflow_instance_id) {
    return new Response(JSON.stringify({
      error: 'No pending approval for this project'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Resume workflow with approval decision
  const workflow = await env.PROGRESS_STAGE.get(project.workflow_instance_id);
  await workflow.resume({
    approved,
    approver,
    reason,
    timestamp: Date.now()
  });

  return new Response(JSON.stringify({
    success: true,
    projectId,
    approved,
    approver
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleGetProject(env: Env, path: string, corsHeaders: any) {
  const projectId = path.split('/')[3];

  const id = env.PIPELINE_STATE.idFromName(projectId);
  const obj = env.PIPELINE_STATE.get(id);
  const response = await obj.fetch('http://internal/get');
  const project = await response.json();

  // Get history
  const historyResponse = await obj.fetch('http://internal/history');
  const history = await historyResponse.json();

  return new Response(JSON.stringify({
    ...project,
    history
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleListProjects(url: URL, env: Env, corsHeaders: any) {
  const stage = url.searchParams.get('stage');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  // TODO: Implement project listing
  // This would require maintaining an index of all projects

  return new Response(JSON.stringify({
    projects: [],
    message: 'Project listing not yet implemented'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handlePendingApprovals(env: Env, corsHeaders: any) {
  // TODO: Implement pending approvals listing
  // This would require maintaining an index of paused workflows

  return new Response(JSON.stringify({
    pending: [],
    message: 'Pending approvals listing not yet implemented'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
