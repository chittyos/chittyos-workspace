/**
 * Template Engine for CLAUDE.md and workflow generation
 */

import Handlebars from 'handlebars';
import fs from 'fs-extra';
import path from 'path';

export interface TemplateContext {
  serviceName: string;
  description?: string;
  runtime?: 'Cloudflare Workers' | 'Node.js' | 'Deno';
  framework?: 'Hono' | 'Express' | 'Fastify' | 'None';
  database?: 'D1' | 'Postgres' | 'Neon' | 'None';
  packageManager?: 'pnpm' | 'npm' | 'yarn';
  domain?: string;
  githubRepo?: string;
  // Capabilities
  hasMcp?: boolean;
  hasApi?: boolean;
  hasDocs?: boolean;
  hasHealth?: boolean;
  // ChittyOS-specific
  tier?: number;
  category?: string;
  integrations?: string[];
}

export interface TemplateInfo {
  name: string;
  description: string;
  path: string;
}

// Register Handlebars helpers
Handlebars.registerHelper('if_eq', function(this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
  if (a === b) {
    return options.fn(this);
  }
  return options.inverse(this);
});

Handlebars.registerHelper('uppercase', function(str: string) {
  return str?.toUpperCase() || '';
});

Handlebars.registerHelper('lowercase', function(str: string) {
  return str?.toLowerCase() || '';
});

Handlebars.registerHelper('capitalize', function(str: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

/**
 * Get the templates directory path
 */
export function getTemplatesDir(): string {
  // Check for templates in the CLI package
  const cliTemplates = path.join(__dirname, '..', 'templates');
  if (fs.existsSync(cliTemplates)) {
    return cliTemplates;
  }

  // Fallback to dist/templates
  const distTemplates = path.join(__dirname, '..', '..', 'templates');
  if (fs.existsSync(distTemplates)) {
    return distTemplates;
  }

  return cliTemplates;
}

/**
 * List available CLAUDE.md templates
 */
export async function listClaudeTemplates(): Promise<TemplateInfo[]> {
  const templatesDir = path.join(getTemplatesDir(), 'claude');

  try {
    if (!await fs.pathExists(templatesDir)) {
      return getBuiltinTemplates();
    }

    const files = await fs.readdir(templatesDir);
    const templates: TemplateInfo[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const name = file.replace('.md', '');
        templates.push({
          name,
          description: getTemplateDescription(name),
          path: path.join(templatesDir, file)
        });
      }
    }

    return templates.length > 0 ? templates : getBuiltinTemplates();
  } catch {
    return getBuiltinTemplates();
  }
}

/**
 * Get built-in templates when files don't exist
 */
function getBuiltinTemplates(): TemplateInfo[] {
  return [
    { name: 'service', description: 'ChittyOS service with API/MCP', path: '' },
    { name: 'worker', description: 'Cloudflare Worker', path: '' },
    { name: 'minimal', description: 'Minimal CLAUDE.md', path: '' }
  ];
}

/**
 * Get template description by name
 */
function getTemplateDescription(name: string): string {
  const descriptions: Record<string, string> = {
    service: 'ChittyOS service with API and MCP endpoints',
    worker: 'Cloudflare Worker with standard patterns',
    minimal: 'Minimal CLAUDE.md with essential sections',
    mcp: 'MCP server implementation',
    application: 'Full application with frontend and backend'
  };
  return descriptions[name] || `${name} template`;
}

/**
 * Load and compile a template
 */
export async function loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate | null> {
  const templatesDir = path.join(getTemplatesDir(), 'claude');
  const templatePath = path.join(templatesDir, `${templateName}.md`);

  // Try to load from file
  if (await fs.pathExists(templatePath)) {
    const content = await fs.readFile(templatePath, 'utf-8');
    return Handlebars.compile(content);
  }

  // Fall back to built-in templates
  const builtinTemplate = getBuiltinTemplate(templateName);
  if (builtinTemplate) {
    return Handlebars.compile(builtinTemplate);
  }

  return null;
}

/**
 * Get built-in template content
 */
function getBuiltinTemplate(name: string): string | null {
  const templates: Record<string, string> = {
    service: `# {{serviceName}}

{{#if description}}
{{description}}
{{/if}}

## Tech Stack

- **Runtime**: {{runtime}}
{{#if framework}}- **Framework**: {{framework}}{{/if}}
{{#if database}}- **Database**: {{database}}{{/if}}
- **Domain**: {{domain}}

## Directory Structure

\`\`\`
src/
├── index.ts              # Main entry point
├── types/                # TypeScript definitions
{{#if hasMcp}}
├── mcp/                  # MCP server implementation
{{/if}}
{{#if hasApi}}
├── api/                  # API routes
{{/if}}
└── lib/                  # Shared utilities
\`\`\`

## Development Commands

\`\`\`bash
# Install dependencies
{{packageManager}} install

# Run locally
{{packageManager}} dev

# Deploy
{{packageManager}} deploy
\`\`\`

## Endpoints

{{#if hasHealth}}
- \`GET /health\` - Health check endpoint
{{/if}}
{{#if hasApi}}
- \`GET /api/*\` - API endpoints
{{/if}}
{{#if hasMcp}}
- \`POST /mcp\` - MCP server endpoint
{{/if}}

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| \`ENVIRONMENT\` | Deployment environment | No |

## Integration with ChittyOS

{{#if integrations}}
Integrates with:
{{#each integrations}}
- {{this}}
{{/each}}
{{/if}}

## Key Patterns

- Follow ChittyOS coding standards
- Use ChittyID for entity identification
- Register with ChittyRegistry for service discovery
`,

    worker: `# {{serviceName}}

Cloudflare Worker for {{description}}.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Domain**: {{domain}}

## Directory Structure

\`\`\`
src/
├── index.ts              # Worker entry point
└── types.ts              # Type definitions
\`\`\`

## Development Commands

\`\`\`bash
# Install dependencies
{{packageManager}} install

# Run locally
{{packageManager}} dev

# Deploy to Cloudflare
{{packageManager}} deploy

# View logs
{{packageManager}} tail
\`\`\`

## Wrangler Configuration

Update \`wrangler.toml\` with:
- Custom domain bindings
- Environment variables
- KV/R2/D1 bindings as needed

## Environment Variables

| Variable | Description |
|----------|-------------|
| \`ENVIRONMENT\` | production / staging / development |
`,

    minimal: `# {{serviceName}}

{{#if description}}{{description}}{{/if}}

## Commands

\`\`\`bash
{{packageManager}} install
{{packageManager}} dev
{{packageManager}} build
\`\`\`

## Key Files

- \`src/index.ts\` - Main entry point
- \`package.json\` - Dependencies and scripts
`
  };

  return templates[name] || null;
}

/**
 * Render a template with context
 */
export async function renderTemplate(templateName: string, context: TemplateContext): Promise<string> {
  const template = await loadTemplate(templateName);

  if (!template) {
    throw new Error(`Template '${templateName}' not found`);
  }

  // Apply defaults
  const fullContext: TemplateContext = {
    runtime: 'Cloudflare Workers',
    packageManager: 'pnpm',
    hasHealth: true,
    ...context
  };

  return template(fullContext);
}

/**
 * Preview a template without writing
 */
export async function previewTemplate(templateName: string, context: TemplateContext): Promise<string> {
  return renderTemplate(templateName, context);
}

/**
 * Render and write a template to a file
 */
export async function writeTemplate(templateName: string, context: TemplateContext, outputPath: string): Promise<void> {
  const content = await renderTemplate(templateName, context);
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, content, 'utf-8');
}

/**
 * List available workflow templates
 */
export async function listWorkflowTemplates(): Promise<TemplateInfo[]> {
  const templatesDir = path.join(getTemplatesDir(), 'workflows');

  try {
    if (!await fs.pathExists(templatesDir)) {
      return [
        { name: 'chittyconnect-sync', description: 'ChittyConnect sync workflow', path: '' },
        { name: 'deploy', description: 'Standard deploy workflow', path: '' }
      ];
    }

    const files = await fs.readdir(templatesDir);
    return files
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map(f => ({
        name: f.replace(/\.ya?ml$/, ''),
        description: `${f} workflow`,
        path: path.join(templatesDir, f)
      }));
  } catch {
    return [];
  }
}
