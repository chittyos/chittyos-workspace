#!/usr/bin/env node
import { generate, register, validate } from "../src/index.mjs";
import { DataOrchestrator } from "../src/data-architecture.mjs";
import { AdvancedOrchestrator } from "../src/cloudflare-advanced.mjs";
import PipelineOrchestrator from "../src/pipeline-orchestrator.mjs";

const [,, cmd, arg, ...rest] = process.argv;

(async () => {
  try {
    if (cmd === "gen" || cmd === "generate") {
      const kind = arg || "generic";
      const attrs = rest[0] ? JSON.parse(rest[0]) : {};
      const id = await generate({ kind, attrs });
      console.log(id);
      return;
    }
    if (cmd === "register") {
      const chittyId = arg;
      if (!chittyId) throw new Error("usage: chitty register <ChittyID> [proof_url]");
      const proof_url = rest[0];
      await register(chittyId, { proof_url });
      console.log("registered");
      return;
    }
    if (cmd === "validate") {
      const chittyId = arg;
      if (!chittyId) throw new Error("usage: chitty validate <ChittyID>");
      await validate(chittyId);
      console.log("valid");
      return;
    }
    if (cmd === "store") {
      const chittyId = arg;
      if (!chittyId) throw new Error("usage: chitty store <ChittyID> <file>");
      const filePath = rest[0];
      if (!filePath) throw new Error("File path required");

      // Store evidence in data architecture
      const orchestrator = new DataOrchestrator();
      const fs = await import('fs');
      const file = fs.readFileSync(filePath);
      const result = await orchestrator.processEvidence(chittyId, file);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (cmd === "status") {
      // Check system status
      const orchestrator = new DataOrchestrator();
      const status = await orchestrator.getSystemStatus();
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    if (cmd === "process") {
      // Advanced evidence processing
      const chittyId = arg;
      if (!chittyId) throw new Error("usage: chitty process <ChittyID> <file> [--redact-pii]");
      const filePath = rest[0];
      if (!filePath) throw new Error("File path required");

      const advanced = new AdvancedOrchestrator();
      const fs = await import('fs');
      const file = fs.readFileSync(filePath);

      const result = await advanced.processEvidenceAdvanced(chittyId, {
        content: file.toString(),
        type: filePath.endsWith('.png') || filePath.endsWith('.jpg') ? 'image' : 'document',
        data: file
      }, {
        redactPII: rest.includes('--redact-pii')
      });

      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (cmd === "capture") {
      // Capture web evidence
      const chittyId = arg;
      if (!chittyId) throw new Error("usage: chitty capture <ChittyID> <url>");
      const url = rest[0];
      if (!url) throw new Error("URL required");

      const { BrowserRendering } = await import('../src/cloudflare-advanced.mjs');
      const browser = new BrowserRendering();
      const result = await browser.captureWebEvidence(url, chittyId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (cmd === "pipeline") {
      const subCmd = arg;
      const pipeline = new PipelineOrchestrator();

      if (subCmd === "init") {
        const advanced = new AdvancedOrchestrator();
        const results = await advanced.initializePipelines();
        console.log("Pipelines initialized:", results);
        return;
      }

      if (subCmd === "run") {
        const chittyId = rest[0];
        const filePath = rest[1];
        if (!chittyId || !filePath) {
          throw new Error("usage: chitty pipeline run <ChittyID> <file>");
        }

        const fs = await import('fs');
        const evidence = {
          content: fs.readFileSync(filePath),
          type: filePath.split('.').pop(),
          metadata: { source: 'cli' }
        };

        const result = await pipeline.execute(chittyId, evidence, {
          redactPII: rest.includes('--redact-pii'),
          createIssue: rest.includes('--github'),
          useContainer: rest.includes('--container')
        });

        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (subCmd === "trace") {
        const chittyId = rest[0];
        if (!chittyId) throw new Error("usage: chitty pipeline trace <ChittyID>");

        // Get pipeline execution trace
        console.log(`🔍 Pipeline trace for ${chittyId}:`);
        console.log("Feature coming soon...");
        return;
      }

      throw new Error("usage: chitty pipeline [init|run|trace]");
    }

    // Initialize new project with full configuration
    if (cmd === "init") {
      const { execSync } = await import('child_process');
      const projectName = arg || process.cwd().split('/').pop();

      console.log(`🚀 INITIALIZING PROJECT: ${projectName}`);
      console.log("════════════════════════════════════════════");
      console.log("");

      // Create CLAUDE.md if it doesn't exist
      const fs = await import('fs');
      const claudeMdPath = 'CLAUDE.md';
      if (!fs.existsSync(claudeMdPath)) {
        const claudeContent = `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this project.

## Project Overview
${projectName} - Part of the ChittyOS ecosystem

## Slash Commands (EXECUTE IMMEDIATELY)
- \`/chittycheck\` - Run ChittyID compliance check
- \`/status\` - System status
- \`/deploy\` - Smart deployment
- \`/commit\` - Commit with ChittyID

## ChittyID Integration
ALL IDs must be minted from https://id.chitty.cc
NO local generation allowed - SERVICE OR FAIL

## Development
\`\`\`bash
npm install
npm run dev
npm test
\`\`\`

Generated by ChittyCheck on ${new Date().toLocaleString()}
`;
        fs.writeFileSync(claudeMdPath, claudeContent);
        console.log("✅ Created CLAUDE.md");
      }

      // Create .env and .env.example if they don't exist
      if (!fs.existsSync('.env')) {
        const envContent = `# ChittyID Service Configuration (REQUIRED)
CHITTY_ID_TOKEN=chitty-dev-token-2025

# ChittyOS Integration
CHITTYOS_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541
`;
        fs.writeFileSync('.env', envContent);
        console.log("✅ Created .env");
      }

      if (!fs.existsSync('.env.example')) {
        const envExampleContent = `# ChittyID Service Configuration (REQUIRED)
CHITTY_ID_TOKEN=your_chittyid_token_here

# ChittyOS Integration
CHITTYOS_ACCOUNT_ID=your_account_id_here
`;
        fs.writeFileSync('.env.example', envExampleContent);
        console.log("✅ Created .env.example");
      }

      // Create .gitignore if it doesn't exist
      if (!fs.existsSync('.gitignore')) {
        const gitignoreContent = `node_modules/
.env
.env.local
.wrangler/
dist/
build/
*.log
.DS_Store
coverage/
.vscode/
.idea/
`;
        fs.writeFileSync('.gitignore', gitignoreContent);
        console.log("✅ Created .gitignore");
      }

      // Initialize git if needed
      if (!fs.existsSync('.git')) {
        try {
          execSync('git init', { stdio: 'pipe' });
          console.log("✅ Initialized git repository");
        } catch (e) {
          console.log("⚠️  Could not initialize git");
        }
      }

      // Run project configuration
      console.log("");
      console.log("📋 Now let's configure your project...");
      console.log("");

      try {
        const scriptPath = '/Users/nb/.claude/projects/-/chittychat/project-orchestrator.sh';
        const command = `source ${scriptPath} && project config set ${projectName}`.trim();
        execSync(command, {
          shell: '/bin/bash',
          stdio: 'inherit',
          env: { ...process.env, PROJECTS_DIR: process.cwd() }
        });
      } catch (error) {
        console.error(`Error during configuration: ${error.message}`);
      }

      console.log("");
      console.log("✅ Project initialization complete!");
      console.log("");
      console.log("Next steps:");
      console.log("  1. Review and update CLAUDE.md");
      console.log("  2. Update .env with your actual tokens");
      console.log("  3. Run 'chitty project show " + projectName + "' to view configuration");
      console.log("  4. Run '/chittycheck' to validate ChittyID compliance");
      return;
    }

    // Sync commands (sync.chitty.cc integration)
    if (cmd === "sync") {
      const { execSync } = await import('child_process');
      const subCmd = arg || "help";
      const syncClient = '/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/chitty-sync';

      if (subCmd === "help" || !subCmd) {
        console.log(`📡 SYNC COMMANDS (sync.chitty.cc)
═════════════════════════════════

Usage: chitty sync <command>

Commands:
  project/ps       - Sync current project across AI instances
  session/ss       - Register current session for cross-AI coordination
  topic/ts         - Categorize conversations by topic
  all/syncall      - Run all sync operations
  status/stat      - Show sync status across platforms
  help             - Show this help message

Platforms:
  sync.chitty.cc/neon        - PostgreSQL sync
  sync.chitty.cc/notion      - Workspace sync
  sync.chitty.cc/github      - Repository sync
  sync.chitty.cc/drive       - Google Drive sync
  sync.chitty.cc/cloudflare  - R2/KV sync
  sync.chitty.cc/local       - Local files sync

Examples:
  chitty sync project
  chitty sync session
  chitty sync all
  chitty sync status`);
        return;
      }

      // Map sync commands to chitty-sync client
      const commandMap = {
        'project': 'projectsync',
        'ps': 'projectsync',
        'session': 'sessionsync',
        'ss': 'sessionsync',
        'topic': 'topicsync',
        'ts': 'topicsync',
        'all': 'syncall',
        'syncall': 'syncall',
        'status': 'status',
        'stat': 'status'
      };

      const syncCommand = commandMap[subCmd];
      if (!syncCommand) {
        console.error(`Unknown sync command: ${subCmd}`);
        console.log('Run "chitty sync help" for available commands');
        process.exit(1);
      }

      try {
        execSync(`${syncClient} ${syncCommand}`, {
          stdio: 'inherit',
          shell: '/bin/bash'
        });
      } catch (error) {
        console.error(`Sync error: ${error.message}`);
        process.exit(1);
      }
      return;
    }

    // Project configuration commands
    if (cmd === "project") {
      const { execSync } = await import('child_process');
      const subCmd = arg;

      if (!subCmd || subCmd === "help") {
        console.log(`📖 PROJECT CONFIGURATION COMMANDS
═════════════════════════════════

Usage: chitty project <command> [project_name]

Commands:
  list/ls              - List all projects and their config status
  show <project>       - Show configuration for a specific project
  set <project>        - Create or update project configuration
  apply <project>      - Apply saved configuration to project
  export [project]     - Export configuration(s) to file
  help                 - Show this help message

Examples:
  chitty project list
  chitty project show chittychat
  chitty project set chittyrouter
  chitty project apply chittyschema
  chitty project export`);
        return;
      }

      // Load and execute project orchestrator config
      try {
        const scriptPath = '/Users/nb/.claude/projects/-/chittychat/project-orchestrator.sh';
        const command = `source ${scriptPath} && project config ${subCmd} ${rest.join(' ')}`.trim();
        const output = execSync(command, {
          shell: '/bin/bash',
          stdio: 'inherit',
          env: { ...process.env, PROJECTS_DIR: '/Users/nb/.claude/projects/-' }
        });
      } catch (error) {
        console.error(`Error executing project command: ${error.message}`);
      }
      return;
    }

    console.error(`commands:
  chitty gen [kind] [attrs_json]           # Generate ChittyID
  chitty register <ChittyID> [proof_url]   # Register to ledger
  chitty validate <ChittyID>                # Validate ID
  chitty store <ChittyID> <file>            # Store evidence
  chitty process <ChittyID> <file> [--redact-pii]  # Advanced processing
  chitty capture <ChittyID> <url>           # Capture web evidence
  chitty pipeline init                       # Initialize pipelines
  chitty pipeline run <ChittyID> <file>     # Full pipeline execution
  chitty pipeline trace <ChittyID>          # Trace pipeline execution
  chitty sync [project|session|topic|all|status]  # Cross-AI sync (sync.chitty.cc)
  chitty project [list|show|set|apply|export]  # Project configuration
  chitty status                              # System status`);
    process.exit(1);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
})();