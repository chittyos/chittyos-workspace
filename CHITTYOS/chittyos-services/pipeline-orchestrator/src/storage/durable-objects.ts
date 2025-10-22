import { DurableObject } from 'cloudflare:workers';

// PipelineState: Stores project metadata and state
export class PipelineState extends DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    switch (path) {
      case '/create':
        return await this.handleCreate(request);
      case '/get':
        return await this.handleGet();
      case '/update':
        return await this.handleUpdate(request);
      case '/history':
        return await this.handleHistory(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async handleCreate(request: Request) {
    const data = await request.json();
    await this.state.storage.put('project', data);
    await this.state.storage.put('history', []);
    return new Response(JSON.stringify({ success: true }));
  }

  private async handleGet() {
    const project = await this.state.storage.get('project');
    return new Response(JSON.stringify(project || {}));
  }

  private async handleUpdate(request: Request) {
    const updates = await request.json();
    const project = await this.state.storage.get('project') || {};
    const updated = { ...project, ...updates };
    await this.state.storage.put('project', updated);
    return new Response(JSON.stringify({ success: true }));
  }

  private async handleHistory(request: Request) {
    const event = await request.json();
    const history = await this.state.storage.get('history') || [];
    history.push(event);
    await this.state.storage.put('history', history);
    return new Response(JSON.stringify({ success: true }));
  }
}

// ProjectStorage: Stores project files and artifacts
export class ProjectStorage extends DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    switch (path) {
      case '/store':
        return await this.handleStore(request);
      case '/get':
        return await this.handleGetFile(url);
      case '/exists':
        return await this.handleExists(url);
      case '/list':
        return await this.handleList();
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async handleStore(request: Request) {
    const { projectId, files, stage } = await request.json();
    const key = `${stage}/${projectId}`;
    await this.state.storage.put(key, files);
    return new Response(JSON.stringify({ success: true }));
  }

  private async handleGetFile(url: URL) {
    const file = url.searchParams.get('file');
    if (!file) {
      return new Response('File parameter required', { status: 400 });
    }
    const content = await this.state.storage.get(file);
    return new Response(JSON.stringify(content || null));
  }

  private async handleExists(url: URL) {
    const file = url.searchParams.get('file');
    if (!file) {
      return new Response('File parameter required', { status: 400 });
    }
    const content = await this.state.storage.get(file);
    return new Response(JSON.stringify({ passed: !!content }));
  }

  private async handleList() {
    const files = await this.state.storage.list();
    return new Response(JSON.stringify(Array.from(files.keys())));
  }
}
