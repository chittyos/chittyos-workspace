import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

interface CreateProjectInput {
  name: string;
  description: string;
  model_preference?: string;
}

export class CreateProjectWorkflow extends WorkflowEntrypoint<Env, CreateProjectInput> {
  async run(event: WorkflowEvent<CreateProjectInput>, step: WorkflowStep) {
    const { name, description, model_preference } = event.payload;

    // Step 1: Generate unique project ID
    const projectId = await step.do('generate-id', async () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 10);
      return `proj_${timestamp}_${random}`;
    });

    // Step 2: Create project metadata in Durable Object
    await step.do('create-metadata', async () => {
      const id = this.env.PIPELINE_STATE.idFromName(projectId);
      const obj = this.env.PIPELINE_STATE.get(id);

      await obj.fetch('http://internal/create', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          name,
          description,
          model_preference: model_preference || '@cf/meta/llama-4-scout',
          current_stage: '00-intake',
          created_at: Date.now(),
          metadata: {}
        })
      });

      return projectId;
    });

    // Step 3: Initialize project with AI
    const aiResult = await step.do('ai-init', async () => {
      const model = model_preference || '@cf/meta/llama-4-scout';

      const response = await this.env.AI.run(model, {
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant that creates project scaffolds and initial documentation.'
          },
          {
            role: 'user',
            content: `Create initial README.md and PLAN.md for a project called "${name}" with description: ${description}`
          }
        ]
      });

      return response;
    });

    // Step 4: Store AI-generated files
    await step.do('store-files', async () => {
      const id = this.env.PROJECT_STORAGE.idFromName(projectId);
      const obj = this.env.PROJECT_STORAGE.get(id);

      await obj.fetch('http://internal/store', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          files: aiResult,
          stage: '00-intake'
        })
      });

      return true;
    });

    // Step 5: Record creation in history
    await step.do('record-history', async () => {
      const id = this.env.PIPELINE_STATE.idFromName(projectId);
      const obj = this.env.PIPELINE_STATE.get(id);

      await obj.fetch('http://internal/history', {
        method: 'POST',
        body: JSON.stringify({
          event: 'created',
          stage: '00-intake',
          timestamp: Date.now()
        })
      });

      return true;
    });

    return {
      success: true,
      projectId,
      stage: '00-intake',
      message: `Project ${name} created successfully in intake stage`
    };
  }
}
