import { Command } from "commander";
import { ChittyIDService } from "../services/chittyId";
import { ChittyIDValidator } from "../guards/validator";
import { ChittyIDMonitor } from "../monitoring/idMonitor";
import { logger } from "../utils/logger";
import { formatOutput } from "../utils/formatter";
import chalk from "chalk";
import ora from "ora";

export function idCommands(program: Command) {
  const id = program
    .command("id")
    .description("ChittyID management and validation");

  // Generate new ChittyID (mint via central service only)
  id.command("generate <type>")
    .alias("gen")
    .description("Generate new ChittyID via central service")
    .option(
      "--source <source>",
      "Source system (notion/drive/github/financial)",
      "generic",
    )
    .option("--metadata <json>", "Additional metadata as JSON")
    .action(async (type, options) => {
      const spinner = ora("Generating ChittyID...").start();
      try {
        const service = new ChittyIDService();
        const metadata = options.metadata ? JSON.parse(options.metadata) : {};

        const result = await service.mintChittyId(type, {
          source: options.source,
          ...metadata,
        });

        spinner.succeed(`ChittyID generated: ${chalk.green(result.chittyId)}`);

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatOutput(result));
        }
      } catch (error: any) {
        spinner.fail(`Failed to generate ChittyID: ${error.message}`);
        process.exit(1);
      }
    });

  // Validate ChittyID
  id.command("validate <chittyId>")
    .description("Validate a ChittyID against central service")
    .option("--local", "Perform local format check only")
    .option("--cache", "Use cached results if available")
    .action(async (chittyId, options) => {
      const validator = new ChittyIDValidator();

      // Local format check first
      if (!validator.isValidFormat(chittyId)) {
        console.error(chalk.red("❌ Invalid ChittyID format"));
        if (!options.local) {
          console.log("Run with --local to see format requirements");
        }
        process.exit(1);
      }

      if (options.local) {
        console.log(chalk.green("✓ Valid format (local check only)"));
        return;
      }

      const spinner = ora("Validating with central service...").start();
      try {
        const result = await validator.validateRemote(chittyId, {
          useCache: options.cache,
        });

        if (result.valid) {
          spinner.succeed(chalk.green("✓ Valid ChittyID"));
        } else {
          spinner.fail(chalk.red(`✗ Invalid: ${result.reason}`));
          process.exit(1);
        }

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (program.opts().verbose) {
          console.log(formatOutput(result));
        }
      } catch (error: any) {
        spinner.fail(`Validation error: ${error.message}`);
        process.exit(1);
      }
    });

  // Batch validation
  id.command("validate-batch <file>")
    .description("Validate multiple ChittyIDs from file")
    .option("--output <file>", "Output results to file")
    .option("--invalid-only", "Show only invalid IDs")
    .action(async (file, options) => {
      const validator = new ChittyIDValidator();
      const spinner = ora("Loading IDs from file...").start();

      try {
        const results = await validator.validateBatch(file);
        spinner.stop();

        const invalid = results.filter((r) => !r.valid);
        const toShow = options.invalidOnly ? invalid : results;

        console.log(
          `\nValidation Results: ${results.length} total, ${invalid.length} invalid\n`,
        );

        if (options.output) {
          await validator.saveResults(toShow, options.output);
          console.log(`Results saved to ${options.output}`);
        } else {
          toShow.forEach((r) => {
            const status = r.valid ? chalk.green("✓") : chalk.red("✗");
            console.log(`${status} ${r.id}: ${r.reason || "valid"}`);
          });
        }
      } catch (error: any) {
        spinner.fail(`Batch validation failed: ${error.message}`);
        process.exit(1);
      }
    });

  // Monitoring commands
  const monitor = id
    .command("monitor")
    .description("ChittyID monitoring operations");

  monitor
    .command("start")
    .description("Start ChittyID monitoring daemon")
    .option("--interval <seconds>", "Check interval", "300")
    .option("--batch-size <size>", "IDs per batch", "10000")
    .option(
      "--alert-threshold <percent>",
      "Alert threshold for invalid IDs",
      "0.01",
    )
    .action(async (options) => {
      const monitor = new ChittyIDMonitor({
        intervalSeconds: parseInt(options.interval),
        batchSize: parseInt(options.batchSize),
        alertThreshold: parseFloat(options.alertThreshold),
      });

      console.log(chalk.blue("Starting ChittyID monitor..."));
      console.log(`Check interval: ${options.interval}s`);
      console.log(`Batch size: ${options.batchSize}`);
      console.log(`Alert threshold: ${options.alertThreshold * 100}%`);

      await monitor.start();
    });

  monitor
    .command("status")
    .description("Check monitoring status")
    .action(async () => {
      const monitor = new ChittyIDMonitor();
      const status = await monitor.getStatus();

      if (program.opts().json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(formatOutput(status));
      }
    });

  monitor
    .command("stop")
    .description("Stop monitoring daemon")
    .action(async () => {
      const monitor = new ChittyIDMonitor();
      await monitor.stop();
      console.log(chalk.yellow("Monitor stopped"));
    });

  // Minting status commands
  id.command("status <chittyId>")
    .description("Check minting status of ChittyID")
    .action(async (chittyId) => {
      const service = new ChittyIDService();
      const spinner = ora("Checking status...").start();

      try {
        const status = await service.getMintingStatus(chittyId);
        spinner.stop();

        const statusColor =
          {
            PENDING: chalk.yellow,
            SOFT_MINTED: chalk.blue,
            HARD_MINTED: chalk.green,
            FAILED: chalk.red,
          }[status.mintingStatus] || chalk.white;

        console.log(`Status: ${statusColor(status.mintingStatus)}`);

        if (status.txHash) {
          console.log(`Transaction: ${status.txHash}`);
        }
        if (status.irreversibleAt) {
          console.log(`Irreversible since: ${status.irreversibleAt}`);
        }

        if (program.opts().json) {
          console.log(JSON.stringify(status, null, 2));
        }
      } catch (error: any) {
        spinner.fail(`Failed to get status: ${error.message}`);
        process.exit(1);
      }
    });

  // Soft mint command
  id.command("soft-mint <chittyId>")
    .description("Perform soft mint (off-chain attestation)")
    .action(async (chittyId) => {
      const service = new ChittyIDService();
      const spinner = ora("Performing soft mint...").start();

      try {
        const result = await service.softMint(chittyId);
        spinner.succeed(chalk.green("✓ Soft mint completed"));

        console.log(`ChittyID: ${result.chittyId}`);
        console.log(`Status: ${chalk.blue(result.status)}`);
        console.log(`Timestamp: ${result.at}`);

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (error: any) {
        spinner.fail(`Soft mint failed: ${error.message}`);
        process.exit(1);
      }
    });

  // Hard mint command
  id.command("hard-mint <chittyId>")
    .description("Perform hard mint (on-chain anchor)")
    .option("--max-gas <wei>", "Maximum gas in wei")
    .option("--no-confirm", "Skip confirmation prompt")
    .action(async (chittyId, options) => {
      const service = new ChittyIDService();

      if (options.confirm !== false) {
        console.log(
          chalk.yellow(
            "\n⚠️  Hard minting is irreversible and incurs gas costs.",
          ),
        );
        const inquirer = await import("inquirer");
        const { confirm } = await inquirer.default.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: "Do you confirm irreversibility?",
            default: false,
          },
        ]);

        if (!confirm) {
          console.log("Hard mint cancelled");
          return;
        }
      }

      const spinner = ora("Performing hard mint...").start();

      try {
        const result = await service.hardMint(chittyId, {
          confirmIrreversible: true,
          maxGasWei: options.maxGas,
        });

        spinner.succeed(chalk.green("✓ Hard mint completed"));

        console.log(`ChittyID: ${result.chittyId}`);
        console.log(`Status: ${chalk.green(result.status)}`);
        console.log(`Transaction: ${result.txHash}`);
        console.log(`Gas used: ${result.gas}`);
        console.log(`Irreversible at: ${result.at}`);

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (error: any) {
        spinner.fail(`Hard mint failed: ${error.message}`);
        process.exit(1);
      }
    });

  // Audit trail command
  id.command("audit")
    .description("Export audit trail for ChittyID validations")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--id <chittyId>", "Filter by specific ChittyID")
    .option("--output <file>", "Export to file")
    .action(async (options) => {
      const service = new ChittyIDService();
      const spinner = ora("Fetching audit trail...").start();

      try {
        const audit = await service.getAuditTrail({
          from: options.from,
          to: options.to,
          chittyId: options.id,
        });

        spinner.stop();

        if (options.output) {
          await service.exportAudit(audit, options.output);
          console.log(`Audit trail exported to ${options.output}`);
        } else {
          console.log(formatOutput(audit));
        }
      } catch (error: any) {
        spinner.fail(`Failed to fetch audit trail: ${error.message}`);
        process.exit(1);
      }
    });

  // Metrics command
  id.command("metrics")
    .description("Display ChittyID validation metrics")
    .action(async () => {
      const monitor = new ChittyIDMonitor();
      const metrics = await monitor.getMetrics();

      if (program.opts().json) {
        console.log(JSON.stringify(metrics, null, 2));
      } else {
        console.log("\nChittyID Metrics:");
        console.log(`  Valid IDs: ${chalk.green(metrics.validTotal)}`);
        console.log(`  Invalid IDs: ${chalk.red(metrics.invalidTotal)}`);
        console.log(`  Validation rate: ${metrics.validationRate}/s`);
        console.log(`  Avg latency: ${metrics.avgLatencyMs}ms`);
        console.log(`  Cache hit rate: ${metrics.cacheHitRate}%`);
      }
    });
}
