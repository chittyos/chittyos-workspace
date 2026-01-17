# @chittyos/cli

Developer CLI for the ChittyOS ecosystem - Initialize, deploy, and manage services.

**Commands:** `chittyos`, `chitty`

## Installation

```bash
# Via npm
npm install -g @chittyos/cli

# Via quick install
curl -fsSL https://git.chitty.cc/cli | bash
```

## Commands

### `chittyos init [project-name]`

Initialize a new ChittyOS project.

```bash
chittyos init my-service
chittyos init my-service --template worker
chittyos init my-service --registry --ai --bridge
chittyos init --skip-install
```

**Options:**
| Flag | Description |
|------|-------------|
| `-t, --template` | Project template (default: service) |
| `-r, --registry` | Include service registry setup |
| `-a, --ai` | Include AI orchestration setup |
| `-b, --bridge` | Include context bridge setup |
| `--skip-install` | Skip dependency installation |

### `chittyos status`

Check ChittyOS ecosystem status.

```bash
chittyos status
chittyos status --services
chittyos status --health
chittyos status --ai
chittyos status --json
```

**Options:**
| Flag | Description |
|------|-------------|
| `-s, --services` | Show detailed service status |
| `-h, --health` | Show health monitoring data |
| `-a, --ai` | Show AI infrastructure status |
| `--json` | Output in JSON format |

### `chittyos deploy [environment]`

Deploy ChittyOS services.

```bash
chittyos deploy
chittyos deploy production
chittyos deploy --service auth
chittyos deploy --ai --cloudflare
chittyos deploy --dry-run
```

**Options:**
| Flag | Description |
|------|-------------|
| `-s, --service` | Deploy specific service |
| `-a, --ai` | Deploy AI infrastructure |
| `-c, --cloudflare` | Deploy to Cloudflare Workers |
| `--dry-run` | Show plan without executing |

### `chittyos services`

Manage ChittyOS services.

```bash
chittyos services --list
chittyos services --discover authentication
chittyos services --register
chittyos services --unregister my-service
chittyos services --health-check auth
```

**Options:**
| Flag | Description |
|------|-------------|
| `-l, --list` | List all available services |
| `-d, --discover` | Discover services by capability |
| `-r, --register` | Register a new service |
| `-u, --unregister` | Unregister a service |
| `--health-check` | Run health check on service |

### `chittyos ai`

AI orchestration and management.

```bash
chittyos ai --orchestrate pattern-name
chittyos ai --gateway
chittyos ai --langchain
chittyos ai --mcp
chittyos ai --vectorize
chittyos ai --test
```

**Options:**
| Flag | Description |
|------|-------------|
| `-o, --orchestrate` | Run AI orchestration pattern |
| `-g, --gateway` | Manage AI Gateway |
| `-l, --langchain` | Manage LangChain agents |
| `-m, --mcp` | Manage MCP agents |
| `-v, --vectorize` | Manage vector indexes |
| `--test` | Run AI infrastructure tests |

### `chittyos bridge`

Context bridge management.

```bash
chittyos bridge --start
chittyos bridge --stop
chittyos bridge --sync
chittyos bridge --notion
chittyos bridge --status
```

**Options:**
| Flag | Description |
|------|-------------|
| `-s, --start` | Start context bridge service |
| `-t, --stop` | Stop context bridge service |
| `--sync` | Trigger session sync |
| `--notion` | Manage Notion integration |
| `--status` | Show bridge status |

### `chittyos project`

Project detection and configuration.

```bash
chittyos project --detect
chittyos project --configure
chittyos project --hooks
chittyos project --link /path/to/project
chittyos project --status
```

### `chittyos trust`

Trust score and authentication management.

```bash
chittyos trust --score CHITTYID
chittyos trust --update CHITTYID
chittyos trust --auth
chittyos trust --verify TOKEN
```

### `chittyos dev`

Development tools and utilities.

```bash
chittyos dev --watch
chittyos dev --logs my-service
chittyos dev --proxy
chittyos dev --tunnel
```

### `chittyos mcp`

Manage MCP servers for Claude Desktop.

```bash
chittyos mcp --install
chittyos mcp --uninstall
chittyos mcp --list
chittyos mcp --status
chittyos mcp --json
```

**Options:**
| Flag | Description |
|------|-------------|
| `-i, --install` | Install ChittyOS MCP servers to Claude Desktop |
| `-u, --uninstall` | Remove ChittyOS MCP servers |
| `-l, --list` | List available MCP servers |
| `-s, --status` | Check MCP server status |

### `chittyos claude`

Manage CLAUDE.md files for projects.

```bash
chittyos claude init                    # Interactive CLAUDE.md creation
chittyos claude init -t worker          # Use worker template
chittyos claude template -t service     # Apply service template
chittyos claude validate                # Validate CLAUDE.md structure
chittyos claude list                    # List available templates
chittyos claude init --preview          # Preview without writing
```

**Options:**
| Flag | Description |
|------|-------------|
| `-t, --template` | Template to use (service, worker, minimal) |
| `-p, --path` | Target directory |
| `-f, --force` | Overwrite existing file |
| `--preview` | Preview without writing |

**Templates:**
- `service` - ChittyOS service with API and MCP endpoints
- `worker` - Cloudflare Worker with standard patterns
- `minimal` - Minimal CLAUDE.md with essential sections

### `chittyos config`

Manage Claude configuration (Claude Desktop & Claude Code).

```bash
chittyos config show                    # Show current configuration
chittyos config status                  # Check config status
chittyos config mcp list                # List configured MCP servers
chittyos config mcp add                 # Add an MCP server
chittyos config mcp remove              # Remove an MCP server
chittyos config mcp install             # Install all ChittyOS MCP servers
chittyos config mcp uninstall           # Remove all ChittyOS MCP servers
```

**Options:**
| Flag | Description |
|------|-------------|
| `--mcp <action>` | MCP server management (list, add, remove, install) |
| `--json` | Output in JSON format |

### `chittyos discover`

Discover available commands, skills, agents, and MCP tools.

```bash
chittyos discover                       # Discover all resources
chittyos discover --commands            # List CLI commands
chittyos discover --skills              # List available skills
chittyos discover --agents              # List available agents
chittyos discover --tools               # List MCP tools from gateway
chittyos discover --json                # Output in JSON format
```

**Options:**
| Flag | Description |
|------|-------------|
| `--commands` | List CLI commands |
| `--skills` | List available skills |
| `--agents` | List available agents |
| `--tools` | List MCP tools |
| `--json` | Output in JSON format |

### `chittyos cicd`

CI/CD management across all ChittyOS organizations.

```bash
chittyos cicd audit                     # Audit all orgs
chittyos cicd audit --org CHITTYOS      # Audit specific org
chittyos cicd sync --dry-run            # Preview workflow sync
chittyos cicd sync --org CHITTYOS       # Sync workflows to org
chittyos cicd deploy --repo CHITTYOS/chittyconnect
chittyos cicd secrets --org CHITTYOS    # Audit secrets
chittyos cicd status                    # Check GitHub Actions status
```

**Actions:**
| Action | Description |
|--------|-------------|
| `audit` | Audit workflow status across all repos |
| `sync` | Push workflow templates to repos |
| `deploy` | Trigger deployments |
| `secrets` | Audit/manage secrets configuration |
| `status` | Check GitHub Actions run status |

**Options:**
| Flag | Description |
|------|-------------|
| `--org <name>` | Target organization |
| `--repo <owner/name>` | Target repository |
| `--workflow <name>` | Target workflow file |
| `--dry-run` | Preview without making changes |
| `--force` | Skip confirmation prompts |
| `--json` | Output in JSON format |

**Organizations:**
- `CHITTYFOUNDATION` - Core infrastructure & trust services
- `CHITTYOS` - Platform services & utilities
- `CHITTYAPPS` - User-facing applications
- `CHITTYCORP` - Corporate/enterprise services
- `CHICAGOAPPS` - Legal tech applications
- `FURNISHED-CONDOS` - Property management apps

## Global Options

| Flag | Description |
|------|-------------|
| `-v, --verbose` | Enable verbose logging |
| `--registry` | ChittyOS Registry URL (default: https://registry.chitty.cc) |
| `--no-banner` | Skip ASCII art banner |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CHITTYOS_NO_BANNER` | Disable banner display |
| `GITHUB_TOKEN` | GitHub token for CI/CD commands (or use `gh auth login`) |

## Banner

The CLI displays an ASCII art banner on startup. Disable with `--no-banner` or `CHITTYOS_NO_BANNER=1`.

## Development

```bash
cd /Volumes/chitty/workspace/cli

# Build
pnpm build

# Test
pnpm test

# Link for local testing
npm link
```

## License

UNLICENSED - ChittyOS Internal
