import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";

export interface InitOptions {
  template?: string;
  registry?: boolean;
  ai?: boolean;
  bridge?: boolean;
  skipInstall?: boolean;
}

export async function initCommand(
  projectName?: string,
  options: InitOptions = {},
) {
  console.log(chalk.blue("🚀 Initializing ChittyOS project...\n"));

  // Get project name if not provided
  if (!projectName) {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "projectName",
        message: "Project name:",
        default: "my-chittyos-project",
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return "Project name is required";
          }
          if (!/^[a-z0-9-_]+$/.test(input)) {
            return "Project name must contain only lowercase letters, numbers, hyphens, and underscores";
          }
          return true;
        },
      },
    ]);
    projectName = answers.projectName;
  }

  // Template selection if not specified
  if (!options.template) {
    const templateAnswer = await inquirer.prompt([
      {
        type: "list",
        name: "template",
        message: "Choose a project template:",
        choices: [
          {
            name: "🔧 Service - Basic ChittyOS service with registry integration",
            value: "service",
          },
          {
            name: "🤖 AI Service - Service with AI orchestration capabilities",
            value: "ai-service",
          },
          {
            name: "🌉 Bridge Service - Service with context bridge integration",
            value: "bridge-service",
          },
          {
            name: "📊 Full Stack - Complete ChittyOS ecosystem with all features",
            value: "fullstack",
          },
          {
            name: "🧪 QA Framework - Testing and penetration testing setup",
            value: "qa-framework",
          },
        ],
      },
    ]);
    options.template = templateAnswer.template;
  }

  // Feature selection for fullstack template
  if (options.template === "fullstack") {
    const features = await inquirer.prompt([
      {
        type: "checkbox",
        name: "features",
        message: "Select features to include:",
        choices: [
          {
            name: "🔍 Service Registry & Discovery",
            value: "registry",
            checked: true,
          },
          {
            name: "🤖 AI Orchestration (Cloudflare)",
            value: "ai",
            checked: true,
          },
          {
            name: "🌉 Context Bridge & Session Sync",
            value: "bridge",
            checked: true,
          },
          { name: "🔐 Pipeline Authentication", value: "auth", checked: true },
          { name: "🧪 QA & Penetration Testing", value: "qa", checked: true },
          { name: "📊 Health Monitoring", value: "monitoring", checked: true },
          {
            name: "🗄️ Database Integration (Neon)",
            value: "database",
            checked: true,
          },
        ],
      },
    ]);

    options.registry = features.features.includes("registry");
    options.ai = features.features.includes("ai");
    options.bridge = features.features.includes("bridge");
  }

  const projectPath = path.resolve(projectName!);

  // Check if directory exists
  if (await fs.pathExists(projectPath)) {
    const overwrite = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: `Directory ${projectName} already exists. Overwrite?`,
        default: false,
      },
    ]);

    if (!overwrite.overwrite) {
      console.log(chalk.yellow("❌ Project initialization cancelled"));
      return;
    }

    await fs.remove(projectPath);
  }

  const spinner = ora("Creating project structure...").start();

  try {
    // Create project directory
    await fs.ensureDir(projectPath);

    // Generate project structure based on template
    await generateProjectStructure(projectPath, options.template!, options);

    // Generate package.json
    await generatePackageJson(projectPath, projectName!, options);

    // Generate configuration files
    await generateConfigFiles(projectPath, options);

    // Generate source code
    await generateSourceCode(projectPath, options.template!, options);

    // Generate QA and testing framework if selected
    if (
      options.template === "qa-framework" ||
      options.template === "fullstack"
    ) {
      await generateQAFramework(projectPath);
    }

    spinner.succeed("Project structure created");

    // Install dependencies
    if (!options.skipInstall) {
      const installSpinner = ora("Installing dependencies...").start();
      try {
        process.chdir(projectPath);
        execSync("npm install", { stdio: "pipe" });
        installSpinner.succeed("Dependencies installed");
      } catch (error) {
        installSpinner.fail("Failed to install dependencies");
        console.log(
          chalk.yellow("You can install them manually with: npm install"),
        );
      }
    }

    // Success message
    console.log(
      chalk.green("\n🎉 ChittyOS project created successfully!\n") +
        chalk.white("📁 Project: ") +
        chalk.cyan(projectName) +
        "\n" +
        chalk.white("📍 Path: ") +
        chalk.gray(projectPath) +
        "\n",
    );

    // Next steps
    console.log(chalk.blue("🚀 Next steps:"));
    console.log(chalk.gray(`  cd ${projectName}`));

    if (options.skipInstall) {
      console.log(chalk.gray("  npm install"));
    }

    if (
      options.template === "qa-framework" ||
      options.template === "fullstack"
    ) {
      console.log(
        chalk.gray("  npm run test:qa:smoke        # Run smoke tests"),
      );
      console.log(
        chalk.gray("  npm run test:security        # Run security audit"),
      );
      console.log(chalk.gray("  npm run test:load           # Run load tests"));
    }

    console.log(
      chalk.gray("  npm run dev                 # Start development"),
    );
    console.log(
      chalk.gray("  chittyos status             # Check ecosystem status"),
    );

    if (options.ai) {
      console.log(
        chalk.gray("  chittyos ai --test          # Test AI infrastructure"),
      );
    }

    if (options.bridge) {
      console.log(
        chalk.gray("  chittyos bridge --start     # Start context bridge"),
      );
    }
  } catch (error) {
    spinner.fail("Failed to create project");
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}

async function generateProjectStructure(
  projectPath: string,
  template: string,
  options: InitOptions,
) {
  const dirs = [
    "src",
    "src/services",
    "src/middleware",
    "src/routes",
    "src/utils",
    "src/types",
    "config",
    "scripts",
  ];

  if (options.registry) {
    dirs.push("src/registry");
  }

  if (options.ai) {
    dirs.push("src/ai", "src/mcp-agents");
  }

  if (options.bridge) {
    dirs.push("src/bridge");
  }

  if (template === "qa-framework" || template === "fullstack") {
    dirs.push(
      "tests",
      "tests/qa",
      "tests/security",
      "tests/load",
      "tests/integration",
    );
  }

  for (const dir of dirs) {
    await fs.ensureDir(path.join(projectPath, dir));
  }
}

async function generatePackageJson(
  projectPath: string,
  projectName: string,
  options: InitOptions,
) {
  const packageJson = {
    name: projectName,
    version: "1.0.0",
    description: "ChittyOS service built with the Trust Operating System",
    main: "dist/index.js",
    scripts: {
      build: "tsc",
      dev: "tsx src/index.ts",
      start: "node dist/index.js",
      "type-check": "tsc --noEmit",
      lint: "eslint src --ext .ts,.tsx",
      "lint:fix": "eslint src --ext .ts,.tsx --fix",
    },
    dependencies: {
      "@chittyos/standard": "^1.0.0",
      express: "^4.18.0",
      winston: "^3.10.0",
      cors: "^2.8.5",
      helmet: "^7.0.0",
      "express-rate-limit": "^6.10.0",
    },
    devDependencies: {
      "@types/node": "^20.0.0",
      "@types/express": "^4.17.0",
      "@types/cors": "^2.8.0",
      typescript: "^5.0.0",
      tsx: "^4.0.0",
      eslint: "^8.0.0",
      "@typescript-eslint/parser": "^6.0.0",
      "@typescript-eslint/eslint-plugin": "^6.0.0",
    },
  };

  // Add AI dependencies
  if (options.ai) {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      "@cloudflare/mcp-agent-api": "^1.0.0",
      "@langchain/core": "^0.2.0",
      "@langchain/cloudflare": "^0.1.0",
    };
  }

  // Add bridge dependencies
  if (options.bridge) {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      ws: "^8.13.0",
      // Note: Use ChittyID service instead of local UUID generation
    };
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      "@types/ws": "^8.5.0",
    };
  }

  // Add QA testing dependencies
  if (options.template === "qa-framework" || options.template === "fullstack") {
    packageJson.scripts = {
      ...packageJson.scripts,
      test: "jest",
      "test:watch": "jest --watch",
      "test:coverage": "jest --coverage",
      "test:qa:smoke": "jest tests/qa/smoke.test.ts",
      "test:qa:integration": "jest tests/qa/integration.test.ts",
      "test:qa:compliance": "jest tests/qa/compliance.test.ts",
      "test:security": "jest tests/security",
      "test:security:critical":
        'jest tests/security --testNamePattern="critical"',
      "test:security:high": 'jest tests/security --testNamePattern="high"',
      "test:load": "jest tests/load",
      "qa:audit": "tsx scripts/run-security-audit.ts",
      "qa:suite": "tsx scripts/run-qa-suite.ts",
    };

    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      jest: "^29.0.0",
      "@types/jest": "^29.0.0",
      "ts-jest": "^29.0.0",
      supertest: "^6.3.0",
      "@types/supertest": "^2.0.0",
    };
  }

  await fs.writeJSON(path.join(projectPath, "package.json"), packageJson, {
    spaces: 2,
  });
}

async function generateConfigFiles(projectPath: string, options: InitOptions) {
  // TypeScript config
  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      lib: ["ES2022"],
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist", "tests"],
  };

  await fs.writeJSON(path.join(projectPath, "tsconfig.json"), tsConfig, {
    spaces: 2,
  });

  // Environment config
  const envExample = `# ChittyOS Configuration
NODE_ENV=development
PORT=3000

# ChittyOS Registry
CHITTYOS_REGISTRY_URL=http://localhost:3001
CHITTYOS_SERVICE_NAME=${path.basename(projectPath)}

# Authentication
CHITTYOS_JWT_SECRET=your-jwt-secret-here
CHITTYOS_API_KEY=your-api-key-here

# Database (if using Neon)
NEON_DATABASE_URL=postgresql://user:password@host:5432/database

# Redis (if using caching)
REDIS_URL=redis://localhost:6379
`;

  await fs.writeFile(path.join(projectPath, ".env.example"), envExample);

  // AI configuration
  if (options.ai) {
    const aiConfig = `# AI Infrastructure
CLOUDFLARE_AI_GATEWAY_TOKEN=your-gateway-token
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Cloudflare Workers
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
`;

    await fs.appendFile(path.join(projectPath, ".env.example"), aiConfig);
  }
}

async function generateSourceCode(
  projectPath: string,
  template: string,
  options: InitOptions,
) {
  // Main application file
  const mainApp = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger';
${options.registry ? "import { registerWithChittyOS } from './services/registry';" : ""}
${options.ai ? "import { setupAIOrchestration } from './ai/orchestration';" : ""}
${options.bridge ? "import { setupContextBridge } from './bridge/client';" : ""}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://chitty.cc' : true
}));
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: process.env.CHITTYOS_SERVICE_NAME || '${path.basename(projectPath)}',
    version: '1.0.0'
  });
});

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'ChittyOS Service Running',
    service: process.env.CHITTYOS_SERVICE_NAME || '${path.basename(projectPath)}',
    features: {
      registry: ${options.registry || false},
      ai: ${options.ai || false},
      bridge: ${options.bridge || false}
    }
  });
});

async function startServer() {
  try {
    ${options.registry ? "await registerWithChittyOS();" : ""}
    ${options.ai ? "await setupAIOrchestration();" : ""}
    ${options.bridge ? "await setupContextBridge();" : ""}

    app.listen(PORT, () => {
      logger.info(\`ChittyOS service started on port \${PORT}\`);
    });
  } catch (error) {
    logger.error('Failed to start service:', error);
    process.exit(1);
  }
}

startServer();
`;

  await fs.writeFile(path.join(projectPath, "src/index.ts"), mainApp);

  // Logger utility
  const loggerCode = `import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.CHITTYOS_SERVICE_NAME || 'chittyos-service'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
`;

  await fs.writeFile(path.join(projectPath, "src/utils/logger.ts"), loggerCode);
}

async function generateQAFramework(projectPath: string) {
  // Jest configuration
  const jestConfig = `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000
};
`;

  await fs.writeFile(path.join(projectPath, "jest.config.js"), jestConfig);

  // Test setup
  const testSetup = `import { logger } from '../src/utils/logger';

// Suppress logs during testing
logger.level = 'error';

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.CHITTYOS_REGISTRY_URL = 'http://localhost:3001';
`;

  await fs.writeFile(path.join(projectPath, "tests/setup.ts"), testSetup);

  // Smoke test
  const smokeTest = `import request from 'supertest';
import express from 'express';

describe('ChittyOS Smoke Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });
  });

  test('should have working health endpoint', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'healthy');
  });

  test('should have test environment configured', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  test('should be able to import TypeScript modules', () => {
    expect(() => require('../src/utils/logger')).not.toThrow();
  });
});
`;

  await fs.writeFile(
    path.join(projectPath, "tests/qa/smoke.test.ts"),
    smokeTest,
  );

  // Security test template
  const securityTest = `describe('Security Tests', () => {
  describe('Authentication Bypass', () => {
    test('should prevent unauthorized access to protected endpoints', async () => {
      // Test authentication bypass attempts
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Injection Protection', () => {
    test('should prevent SQL injection attacks', async () => {
      // Test SQL injection protection
      expect(true).toBe(true); // Placeholder
    });

    test('should prevent XSS attacks', async () => {
      // Test XSS protection
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Registry Security', () => {
    test('should validate service registration tokens', async () => {
      // Test service registration security
      expect(true).toBe(true); // Placeholder
    });
  });
});
`;

  await fs.writeFile(
    path.join(projectPath, "tests/security/security.test.ts"),
    securityTest,
  );

  // Load test template
  const loadTest = `describe('Load Tests', () => {
  test('should handle concurrent requests', async () => {
    // Test concurrent request handling
    expect(true).toBe(true); // Placeholder
  });

  test('should maintain performance under load', async () => {
    // Test performance under load
    expect(true).toBe(true); // Placeholder
  });
});
`;

  await fs.writeFile(
    path.join(projectPath, "tests/load/performance.test.ts"),
    loadTest,
  );
}
