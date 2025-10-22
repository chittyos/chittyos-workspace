#!/usr/bin/env node
import { Command } from "commander";
import { config } from "dotenv";
import { idCommands } from "./commands/id";
import { serviceCommands } from "./commands/service";
import { configCommands } from "./commands/config";
import { systemCommands } from "./commands/system";
import { authCommands } from "./commands/auth";
import { dataCommands } from "./commands/data";
import { version } from "../package.json";

// Load environment variables
config();

const program = new Command();

program
  .name("chitty")
  .description("ChittyOS CLI - Unified interface for managing Chitty services")
  .version(version);

// Register command modules
idCommands(program);
serviceCommands(program);
configCommands(program);
systemCommands(program);
authCommands(program);
dataCommands(program);

// Global options
program.option("-j, --json", "Output in JSON format");
program.option("-q, --quiet", "Suppress non-essential output");
program.option("-v, --verbose", "Verbose output for debugging");
program.option("--no-color", "Disable colored output");

// Error handling
program.exitOverride();

process.on("SIGINT", () => {
  console.log("\n⚠️  Operation cancelled");
  process.exit(1);
});

process.on("unhandledRejection", (reason: Error) => {
  console.error("⚠️  Unhandled error:", reason.message);
  if (program.opts().verbose) {
    console.error(reason.stack);
  }
  process.exit(1);
});

// Parse and execute
program.parse(process.argv);
