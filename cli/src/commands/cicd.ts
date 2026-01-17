/**
 * CI/CD Command - Manage CI/CD across organizations
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import {
  createGitHubClient,
  type GitHubClient,
  type Repository,
  type WorkflowRun
} from '../lib/github-client';
import {
  ORGANIZATIONS,
  ORGANIZATION_INFO,
  REQUIRED_SECRETS,
  STANDARD_WORKFLOWS,
  isValidOrganization,
  type Organization
} from '../lib/organizations';

export interface CicdOptions {
  org?: string;
  repo?: string;
  workflow?: string;
  dryRun?: boolean;
  force?: boolean;
  json?: boolean;
}

interface AuditResult {
  organization: string;
  repository: string;
  hasChittyConnectSync: boolean;
  hasDeployWorkflow: boolean;
  workflows: string[];
  lastRun?: WorkflowRun;
  issues: string[];
}

interface SyncResult {
  repository: string;
  action: 'created' | 'updated' | 'skipped' | 'error';
  message: string;
}

export async function cicdCommand(action?: string, options: CicdOptions = {}): Promise<void> {
  switch (action) {
    case 'audit':
      await auditWorkflows(options);
      break;
    case 'sync':
      await syncWorkflows(options);
      break;
    case 'deploy':
      await triggerDeploy(options);
      break;
    case 'secrets':
      await auditSecrets(options);
      break;
    case 'status':
      await checkStatus(options);
      break;
    default:
      await showCicdHelp();
  }
}

async function showCicdHelp(): Promise<void> {
  console.log(chalk.cyan('\nCI/CD Management Across Organizations\n'));
  console.log('Commands:');
  console.log('  chitty cicd audit          Audit workflow status across all repos');
  console.log('  chitty cicd sync           Push workflow templates to repos');
  console.log('  chitty cicd deploy         Trigger deployments');
  console.log('  chitty cicd secrets        Audit secrets configuration');
  console.log('  chitty cicd status         Check GitHub Actions run status');
  console.log('\nOptions:');
  console.log('  --org <name>               Target specific organization');
  console.log('  --repo <owner/name>        Target specific repository');
  console.log('  --workflow <name>          Target specific workflow');
  console.log('  --dry-run                  Preview without making changes');
  console.log('  --json                     Output in JSON format');
  console.log('\nOrganizations:');
  for (const org of ORGANIZATIONS) {
    const info = ORGANIZATION_INFO[org];
    console.log(chalk.gray(`  ${org.padEnd(20)} ${info.description}`));
  }
}

async function auditWorkflows(options: CicdOptions): Promise<void> {
  const spinner = ora('Auditing workflows across organizations...').start();

  try {
    const github = createGitHubClient();
    const results: AuditResult[] = [];

    // Determine which orgs to audit
    const orgsToAudit = options.org && isValidOrganization(options.org)
      ? [options.org as Organization]
      : [...ORGANIZATIONS];

    let repoCount = 0;
    let withSyncCount = 0;

    for (const org of orgsToAudit) {
      spinner.text = `Auditing ${org}...`;

      const repos = await github.listRepos(org);

      for (const repo of repos) {
        // Skip if specific repo is requested and this isn't it
        if (options.repo && repo.full_name !== options.repo) {
          continue;
        }

        repoCount++;
        const auditResult = await auditRepository(github, repo);
        results.push(auditResult);

        if (auditResult.hasChittyConnectSync) {
          withSyncCount++;
        }
      }
    }

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    // Display audit report
    displayAuditReport(results, repoCount, withSyncCount);
  } catch (error: any) {
    spinner.fail(`Audit failed: ${error.message}`);
    if (error.message.includes('token')) {
      console.log(chalk.gray('\nSet GITHUB_TOKEN or run: gh auth login'));
    }
  }
}

async function auditRepository(github: GitHubClient, repo: Repository): Promise<AuditResult> {
  const result: AuditResult = {
    organization: repo.owner,
    repository: repo.name,
    hasChittyConnectSync: false,
    hasDeployWorkflow: false,
    workflows: [],
    issues: []
  };

  try {
    const workflows = await github.listWorkflows(repo.owner, repo.name);
    result.workflows = workflows.map(w => w.path.replace('.github/workflows/', ''));

    // Check for standard workflows
    result.hasChittyConnectSync = workflows.some(w =>
      w.path.includes('chittyconnect-sync')
    );
    result.hasDeployWorkflow = workflows.some(w =>
      w.path.includes('deploy')
    );

    // Check for issues
    if (!result.hasChittyConnectSync) {
      result.issues.push('Missing chittyconnect-sync.yml');
    }

    // Get latest run for sync workflow
    if (result.hasChittyConnectSync) {
      const latestRun = await github.getLatestRun(
        repo.owner,
        repo.name,
        'chittyconnect-sync.yml'
      );
      if (latestRun) {
        result.lastRun = latestRun;
        if (latestRun.conclusion === 'failure') {
          result.issues.push('Last sync workflow failed');
        }
      }
    }
  } catch {
    result.issues.push('Could not fetch workflow information');
  }

  return result;
}

function displayAuditReport(results: AuditResult[], totalRepos: number, withSyncCount: number): void {
  console.log(chalk.cyan('\n📊 CI/CD Audit Report\n'));

  // Summary
  const syncPercentage = totalRepos > 0 ? ((withSyncCount / totalRepos) * 100).toFixed(1) : '0';
  console.log(chalk.white.bold('Summary:'));
  console.log(`  Total Repositories: ${totalRepos}`);
  console.log(`  With chittyconnect-sync: ${withSyncCount} (${syncPercentage}%)`);

  // Group by organization
  const byOrg = new Map<string, AuditResult[]>();
  for (const result of results) {
    if (!byOrg.has(result.organization)) {
      byOrg.set(result.organization, []);
    }
    byOrg.get(result.organization)!.push(result);
  }

  console.log(chalk.white.bold('\nOrganization Breakdown:'));
  console.log(chalk.gray('  Organization'.padEnd(25) + 'Repos'.padEnd(8) + 'Synced'.padEnd(10) + 'Issues'));
  console.log(chalk.gray('  ' + '-'.repeat(55)));

  for (const [org, orgResults] of byOrg) {
    const synced = orgResults.filter(r => r.hasChittyConnectSync).length;
    const withIssues = orgResults.filter(r => r.issues.length > 0).length;

    const syncStatus = synced === orgResults.length
      ? chalk.green(`${synced}/${orgResults.length}`)
      : chalk.yellow(`${synced}/${orgResults.length}`);

    const issueStatus = withIssues > 0
      ? chalk.red(withIssues.toString())
      : chalk.green('0');

    console.log(`  ${org.padEnd(25)}${orgResults.length.toString().padEnd(8)}${syncStatus.padEnd(18)}${issueStatus}`);
  }

  // List repos with issues
  const withIssues = results.filter(r => r.issues.length > 0);
  if (withIssues.length > 0) {
    console.log(chalk.white.bold('\nRepositories with Issues:'));
    for (const result of withIssues.slice(0, 20)) {
      console.log(chalk.yellow(`  ${result.organization}/${result.repository}`));
      for (const issue of result.issues) {
        console.log(chalk.gray(`    • ${issue}`));
      }
    }
    if (withIssues.length > 20) {
      console.log(chalk.gray(`  ... and ${withIssues.length - 20} more`));
    }
  }

  // Recommendations
  console.log(chalk.white.bold('\nRecommendations:'));
  if (withSyncCount < totalRepos) {
    console.log(chalk.gray(`  • Run 'chitty cicd sync' to add chittyconnect-sync.yml to ${totalRepos - withSyncCount} repos`));
  }
  const failedRuns = results.filter(r => r.lastRun?.conclusion === 'failure');
  if (failedRuns.length > 0) {
    console.log(chalk.gray(`  • Check ${failedRuns.length} repos with failed sync workflows`));
  }
}

async function syncWorkflows(options: CicdOptions): Promise<void> {
  const spinner = ora('Preparing workflow sync...').start();

  try {
    const github = createGitHubClient();

    // Determine target repos
    const repos = await getTargetRepos(github, options);

    spinner.stop();

    if (repos.length === 0) {
      console.log(chalk.yellow('\nNo repositories to sync'));
      return;
    }

    // Confirm sync
    console.log(chalk.cyan(`\n📦 Workflow Sync\n`));
    console.log(`Target repositories: ${repos.length}`);
    console.log(`Workflow: ${options.workflow || 'chittyconnect-sync.yml'}`);

    if (options.dryRun) {
      console.log(chalk.yellow('\n[DRY RUN] The following repos would be updated:'));
      for (const repo of repos.slice(0, 20)) {
        console.log(chalk.gray(`  • ${repo.full_name}`));
      }
      if (repos.length > 20) {
        console.log(chalk.gray(`  ... and ${repos.length - 20} more`));
      }
      return;
    }

    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Sync workflow to ${repos.length} repositories?`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.gray('Cancelled'));
        return;
      }
    }

    // Perform sync
    const results: SyncResult[] = [];
    const syncSpinner = ora('Syncing workflows...').start();

    for (const repo of repos) {
      syncSpinner.text = `Syncing ${repo.full_name}...`;
      const result = await syncWorkflowToRepo(github, repo, options);
      results.push(result);
    }

    syncSpinner.stop();

    // Display results
    displaySyncResults(results, options);
  } catch (error: any) {
    spinner.fail(`Sync failed: ${error.message}`);
  }
}

async function getTargetRepos(github: GitHubClient, options: CicdOptions): Promise<Repository[]> {
  if (options.repo) {
    const [owner, name] = options.repo.split('/');
    const repo = await github.getRepo(owner, name);
    return repo ? [repo] : [];
  }

  if (options.org && isValidOrganization(options.org)) {
    return github.listRepos(options.org as Organization);
  }

  // All orgs
  const allRepos = await github.listAllRepos();
  const repos: Repository[] = [];
  for (const orgRepos of allRepos.values()) {
    repos.push(...orgRepos);
  }
  return repos;
}

async function syncWorkflowToRepo(
  github: GitHubClient,
  repo: Repository,
  options: CicdOptions
): Promise<SyncResult> {
  const workflowName = options.workflow || 'chittyconnect-sync.yml';
  const workflowPath = `.github/workflows/${workflowName}`;

  try {
    // Check if workflow already exists
    const existing = await github.getFileContent(repo.owner, repo.name, workflowPath);

    // Get template content
    const templateContent = getWorkflowTemplate(workflowName);

    if (existing === templateContent) {
      return {
        repository: repo.full_name,
        action: 'skipped',
        message: 'Already up to date'
      };
    }

    // Create or update
    await github.createOrUpdateFile(
      repo.owner,
      repo.name,
      workflowPath,
      templateContent,
      existing ? `chore: Update ${workflowName}` : `chore: Add ${workflowName}`
    );

    return {
      repository: repo.full_name,
      action: existing ? 'updated' : 'created',
      message: existing ? 'Workflow updated' : 'Workflow created'
    };
  } catch (error: any) {
    return {
      repository: repo.full_name,
      action: 'error',
      message: error.message
    };
  }
}

function getWorkflowTemplate(name: string): string {
  // Standard chittyconnect-sync.yml template
  if (name === 'chittyconnect-sync.yml') {
    return `name: ChittyConnect Sync
on:
  push:
    branches: [main, master]
  schedule:
    - cron: "0 */6 * * *"
  workflow_dispatch:
env:
  CHITTYCONNECT_ENDPOINT: https://connect.chitty.cc
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sync to ChittyConnect
        run: |
          curl -X POST "\${{ env.CHITTYCONNECT_ENDPOINT }}/api/github/sync" \\
            -H "Authorization: Bearer \${{ secrets.CHITTYCONNECT_SERVICE_TOKEN }}" \\
            -H "Content-Type: application/json" \\
            -d '{"repository":"\${{ github.repository }}","commit":"\${{ github.sha }}"}' || true
`;
  }

  throw new Error(`Unknown workflow template: ${name}`);
}

function displaySyncResults(results: SyncResult[], options: CicdOptions): void {
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log(chalk.cyan('\n📊 Sync Results\n'));

  const created = results.filter(r => r.action === 'created');
  const updated = results.filter(r => r.action === 'updated');
  const skipped = results.filter(r => r.action === 'skipped');
  const errors = results.filter(r => r.action === 'error');

  console.log(`  Created: ${chalk.green(created.length)}`);
  console.log(`  Updated: ${chalk.blue(updated.length)}`);
  console.log(`  Skipped: ${chalk.gray(skipped.length)}`);
  console.log(`  Errors:  ${chalk.red(errors.length)}`);

  if (errors.length > 0) {
    console.log(chalk.red('\nErrors:'));
    for (const err of errors) {
      console.log(chalk.red(`  ${err.repository}: ${err.message}`));
    }
  }
}

async function triggerDeploy(options: CicdOptions): Promise<void> {
  const spinner = ora('Preparing deployment...').start();

  try {
    const github = createGitHubClient();

    // Get target repos
    const repos = await getTargetRepos(github, options);

    spinner.stop();

    if (repos.length === 0) {
      console.log(chalk.yellow('\nNo repositories found'));
      return;
    }

    // Filter to repos with deploy workflow
    const deployableRepos: Array<{ repo: Repository; workflowId: number }> = [];

    for (const repo of repos) {
      const workflows = await github.listWorkflows(repo.owner, repo.name);
      const deployWorkflow = workflows.find(w => w.path.includes('deploy'));

      if (deployWorkflow) {
        deployableRepos.push({ repo, workflowId: deployWorkflow.id });
      }
    }

    if (deployableRepos.length === 0) {
      console.log(chalk.yellow('\nNo repositories with deploy workflow found'));
      return;
    }

    console.log(chalk.cyan('\n🚀 Trigger Deployments\n'));
    console.log(`Found ${deployableRepos.length} deployable repositories`);

    if (options.dryRun) {
      console.log(chalk.yellow('\n[DRY RUN] The following deployments would be triggered:'));
      for (const { repo } of deployableRepos) {
        console.log(chalk.gray(`  • ${repo.full_name}`));
      }
      return;
    }

    // Select repos to deploy
    const { selectedRepos } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedRepos',
        message: 'Select repositories to deploy:',
        choices: deployableRepos.map(({ repo }) => ({
          name: repo.full_name,
          value: repo.full_name,
          checked: deployableRepos.length === 1
        }))
      }
    ]);

    if (selectedRepos.length === 0) {
      console.log(chalk.gray('No repositories selected'));
      return;
    }

    // Trigger deployments
    const deploySpinner = ora('Triggering deployments...').start();

    for (const repoName of selectedRepos) {
      const item = deployableRepos.find(d => d.repo.full_name === repoName);
      if (!item) continue;

      deploySpinner.text = `Triggering ${repoName}...`;

      try {
        await github.triggerWorkflow(
          item.repo.owner,
          item.repo.name,
          item.workflowId,
          item.repo.default_branch
        );
        console.log(chalk.green(`✓ ${repoName}`));
      } catch (error: any) {
        console.log(chalk.red(`✗ ${repoName}: ${error.message}`));
      }
    }

    deploySpinner.succeed('Deployments triggered');
    console.log(chalk.gray('\nView status: chitty cicd status'));
  } catch (error: any) {
    spinner.fail(`Deploy failed: ${error.message}`);
  }
}

async function auditSecrets(options: CicdOptions): Promise<void> {
  const spinner = ora('Auditing secrets across organizations...').start();

  try {
    const github = createGitHubClient();

    const orgsToAudit = options.org && isValidOrganization(options.org)
      ? [options.org as Organization]
      : [...ORGANIZATIONS];

    const results: Array<{
      org: string;
      orgSecrets: string[];
      repos: Array<{ name: string; secrets: string[]; missing: string[] }>;
    }> = [];

    for (const org of orgsToAudit) {
      spinner.text = `Auditing ${org}...`;

      const orgSecrets = await github.listOrgSecrets(org);
      const orgSecretNames = orgSecrets.map(s => s.name);

      const repos = await github.listRepos(org);
      const repoResults: Array<{ name: string; secrets: string[]; missing: string[] }> = [];

      for (const repo of repos.slice(0, 10)) { // Limit to avoid rate limits
        const repoSecrets = await github.listSecrets(repo.owner, repo.name);
        const repoSecretNames = repoSecrets.map(s => s.name);

        // Check for required secrets
        const allSecrets = [...new Set([...orgSecretNames, ...repoSecretNames])];
        const missing = REQUIRED_SECRETS['chittyconnect-sync'].filter(
          s => !allSecrets.includes(s)
        );

        repoResults.push({
          name: repo.name,
          secrets: repoSecretNames,
          missing
        });
      }

      results.push({
        org,
        orgSecrets: orgSecretNames,
        repos: repoResults
      });
    }

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    // Display results
    console.log(chalk.cyan('\n🔐 Secrets Audit Report\n'));

    for (const { org, orgSecrets, repos } of results) {
      console.log(chalk.white.bold(`${org}:`));
      console.log(chalk.gray(`  Org-level secrets: ${orgSecrets.join(', ') || 'none'}`));

      const reposWithMissing = repos.filter(r => r.missing.length > 0);
      if (reposWithMissing.length > 0) {
        console.log(chalk.yellow(`  Repos missing secrets:`));
        for (const repo of reposWithMissing) {
          console.log(chalk.yellow(`    • ${repo.name}: ${repo.missing.join(', ')}`));
        }
      } else {
        console.log(chalk.green(`  All repos have required secrets`));
      }
      console.log();
    }
  } catch (error: any) {
    spinner.fail(`Secrets audit failed: ${error.message}`);
  }
}

async function checkStatus(options: CicdOptions): Promise<void> {
  const spinner = ora('Checking workflow status...').start();

  try {
    const github = createGitHubClient();
    const repos = await getTargetRepos(github, options);

    spinner.stop();

    if (repos.length === 0) {
      console.log(chalk.yellow('\nNo repositories found'));
      return;
    }

    const statusResults: Array<{
      repo: string;
      workflow: string;
      status: string;
      conclusion: string | null;
      url: string;
      updatedAt: string;
    }> = [];

    console.log(chalk.cyan('\n📊 Workflow Status\n'));

    for (const repo of repos.slice(0, 20)) { // Limit display
      const workflows = await github.listWorkflows(repo.owner, repo.name);

      for (const workflow of workflows.slice(0, 3)) {
        const runs = await github.getWorkflowRuns(repo.owner, repo.name, workflow.id, 1);
        const latestRun = runs[0];

        if (latestRun) {
          statusResults.push({
            repo: repo.full_name,
            workflow: workflow.name,
            status: latestRun.status,
            conclusion: latestRun.conclusion,
            url: latestRun.html_url,
            updatedAt: latestRun.updated_at
          });
        }
      }
    }

    if (options.json) {
      console.log(JSON.stringify(statusResults, null, 2));
      return;
    }

    // Display status
    for (const result of statusResults) {
      const icon = result.conclusion === 'success'
        ? chalk.green('●')
        : result.conclusion === 'failure'
          ? chalk.red('●')
          : chalk.yellow('○');

      const status = result.conclusion || result.status;
      console.log(`${icon} ${result.repo} - ${result.workflow}: ${status}`);
    }

    if (repos.length > 20) {
      console.log(chalk.gray(`\n... and ${repos.length - 20} more repos`));
    }
  } catch (error: any) {
    spinner.fail(`Status check failed: ${error.message}`);
  }
}
