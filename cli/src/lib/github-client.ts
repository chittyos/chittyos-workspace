/**
 * GitHub API Client for ChittyOS CI/CD Management
 */

import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import { ORGANIZATIONS, type Organization } from './organizations';

export interface Repository {
  name: string;
  full_name: string;
  owner: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  html_url: string;
}

export interface Workflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'disabled' | 'unknown';
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  head_sha: string;
  head_branch: string;
}

export interface Secret {
  name: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubClient {
  octokit: Octokit;

  // Repository operations
  listRepos(org: Organization): Promise<Repository[]>;
  listAllRepos(): Promise<Map<Organization, Repository[]>>;
  getRepo(owner: string, repo: string): Promise<Repository | null>;

  // Workflow operations
  listWorkflows(owner: string, repo: string): Promise<Workflow[]>;
  getWorkflowRuns(owner: string, repo: string, workflowId: number, perPage?: number): Promise<WorkflowRun[]>;
  triggerWorkflow(owner: string, repo: string, workflowId: number, ref: string, inputs?: Record<string, string>): Promise<void>;
  getLatestRun(owner: string, repo: string, workflow: string): Promise<WorkflowRun | null>;

  // File operations
  getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string | null>;
  createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, branch?: string): Promise<void>;
  fileExists(owner: string, repo: string, path: string): Promise<boolean>;

  // Secrets operations
  listSecrets(owner: string, repo: string): Promise<Secret[]>;
  listOrgSecrets(org: Organization): Promise<Secret[]>;
}

function getGitHubToken(): string {
  // First check environment variable
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  // Fall back to gh CLI
  try {
    const token = execSync('gh auth token', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    if (token) {
      return token;
    }
  } catch {
    // gh CLI not available or not authenticated
  }

  throw new Error(
    'GitHub token not found. Set GITHUB_TOKEN environment variable or run: gh auth login'
  );
}

export function createGitHubClient(token?: string): GitHubClient {
  const authToken = token || getGitHubToken();

  const octokit = new Octokit({
    auth: authToken,
    userAgent: 'ChittyOS-CLI/1.0.0'
  });

  return {
    octokit,

    async listRepos(org: Organization): Promise<Repository[]> {
      const repos: Repository[] = [];
      let page = 1;

      while (true) {
        const { data } = await octokit.repos.listForOrg({
          org,
          per_page: 100,
          page,
          type: 'all'
        });

        if (data.length === 0) break;

        repos.push(...data.map(repo => ({
          name: repo.name,
          full_name: repo.full_name,
          owner: repo.owner.login,
          default_branch: repo.default_branch || 'main',
          private: repo.private,
          archived: repo.archived || false,
          html_url: repo.html_url
        })));

        page++;
      }

      return repos.filter(r => !r.archived);
    },

    async listAllRepos(): Promise<Map<Organization, Repository[]>> {
      const results = new Map<Organization, Repository[]>();

      // Process orgs in parallel with concurrency limit
      const batchSize = 3;
      for (let i = 0; i < ORGANIZATIONS.length; i += batchSize) {
        const batch = ORGANIZATIONS.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async org => {
            try {
              const repos = await this.listRepos(org);
              return { org, repos };
            } catch (error) {
              console.warn(`Failed to list repos for ${org}:`, error);
              return { org, repos: [] };
            }
          })
        );

        for (const { org, repos } of batchResults) {
          results.set(org, repos);
        }
      }

      return results;
    },

    async getRepo(owner: string, repo: string): Promise<Repository | null> {
      try {
        const { data } = await octokit.repos.get({ owner, repo });
        return {
          name: data.name,
          full_name: data.full_name,
          owner: data.owner.login,
          default_branch: data.default_branch || 'main',
          private: data.private,
          archived: data.archived || false,
          html_url: data.html_url
        };
      } catch {
        return null;
      }
    },

    async listWorkflows(owner: string, repo: string): Promise<Workflow[]> {
      try {
        const { data } = await octokit.actions.listRepoWorkflows({
          owner,
          repo,
          per_page: 100
        });

        return data.workflows.map(w => ({
          id: w.id,
          name: w.name,
          path: w.path,
          state: w.state as Workflow['state']
        }));
      } catch {
        return [];
      }
    },

    async getWorkflowRuns(owner: string, repo: string, workflowId: number, perPage = 10): Promise<WorkflowRun[]> {
      try {
        const { data } = await octokit.actions.listWorkflowRuns({
          owner,
          repo,
          workflow_id: workflowId,
          per_page: perPage
        });

        return data.workflow_runs.map(run => ({
          id: run.id,
          name: run.name || '',
          status: run.status as WorkflowRun['status'],
          conclusion: run.conclusion as WorkflowRun['conclusion'],
          html_url: run.html_url,
          created_at: run.created_at,
          updated_at: run.updated_at,
          head_sha: run.head_sha,
          head_branch: run.head_branch || ''
        }));
      } catch {
        return [];
      }
    },

    async triggerWorkflow(owner: string, repo: string, workflowId: number, ref: string, inputs?: Record<string, string>): Promise<void> {
      await octokit.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: workflowId,
        ref,
        inputs
      });
    },

    async getLatestRun(owner: string, repo: string, workflow: string): Promise<WorkflowRun | null> {
      try {
        const workflows = await this.listWorkflows(owner, repo);
        const wf = workflows.find(w => w.path.endsWith(workflow) || w.name === workflow);

        if (!wf) return null;

        const runs = await this.getWorkflowRuns(owner, repo, wf.id, 1);
        return runs[0] || null;
      } catch {
        return null;
      }
    },

    async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string | null> {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path,
          ref
        });

        if ('content' in data && data.type === 'file') {
          return Buffer.from(data.content, 'base64').toString('utf-8');
        }
        return null;
      } catch {
        return null;
      }
    },

    async createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, branch?: string): Promise<void> {
      const repository = await this.getRepo(owner, repo);
      if (!repository) {
        throw new Error(`Repository ${owner}/${repo} not found`);
      }

      const targetBranch = branch || repository.default_branch;

      // Check if file exists to get SHA
      let sha: string | undefined;
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: targetBranch
        });
        if ('sha' in data) {
          sha = data.sha;
        }
      } catch {
        // File doesn't exist, that's fine
      }

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch: targetBranch,
        sha
      });
    },

    async fileExists(owner: string, repo: string, path: string): Promise<boolean> {
      const content = await this.getFileContent(owner, repo, path);
      return content !== null;
    },

    async listSecrets(owner: string, repo: string): Promise<Secret[]> {
      try {
        const { data } = await octokit.actions.listRepoSecrets({
          owner,
          repo
        });

        return data.secrets.map(s => ({
          name: s.name,
          created_at: s.created_at,
          updated_at: s.updated_at
        }));
      } catch {
        return [];
      }
    },

    async listOrgSecrets(org: Organization): Promise<Secret[]> {
      try {
        const { data } = await octokit.actions.listOrgSecrets({
          org
        });

        return data.secrets.map(s => ({
          name: s.name,
          created_at: s.created_at,
          updated_at: s.updated_at
        }));
      } catch {
        return [];
      }
    }
  };
}
