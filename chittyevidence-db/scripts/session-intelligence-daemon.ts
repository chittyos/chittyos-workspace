#!/usr/bin/env npx ts-node

/**
 * Session Intelligence Daemon
 *
 * Runs as a background process to continuously analyze Claude Code sessions.
 * Outputs:
 * 1. Running timeline of activity (to stdout/file)
 * 2. Sync state for parallel session merging
 * 3. Recommendations for deduplication and process improvement
 *
 * Usage:
 *   npx ts-node scripts/session-intelligence-daemon.ts [--watch] [--output <file>]
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  parseSessionJSONL,
  generateIntelligenceReport,
  SessionTimeline,
  IntelligenceReport,
} from '../src/services/svc-session-intelligence';

const SESSIONS_DIR = process.env.CLAUDE_SESSIONS_DIR || `${process.env.HOME}/.claude/projects`;
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '60000', 10); // 1 minute default

interface DaemonState {
  processedSessions: Set<string>;
  lastCheck: Date;
  report: IntelligenceReport | null;
}

const state: DaemonState = {
  processedSessions: new Set(),
  lastCheck: new Date(),
  report: null,
};

/**
 * Find all session JSONL files
 */
function findSessionFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.name.endsWith('.jsonl') && !entry.name.startsWith('agent-')) {
          // Only main session files, not subagent logs
          files.push(fullPath);
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }

  walk(dir);
  return files;
}

/**
 * Parse a session file
 */
function parseSessionFile(filePath: string): SessionTimeline | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseSessionJSONL(content);
  } catch (err) {
    console.error(`Failed to parse ${filePath}:`, err);
    return null;
  }
}

/**
 * Run analysis on all sessions
 */
function runAnalysis(): IntelligenceReport {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Session Intelligence Analysis - ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  const sessionFiles = findSessionFiles(SESSIONS_DIR);
  console.log(`Found ${sessionFiles.length} session files\n`);

  const timelines: SessionTimeline[] = [];
  let newSessions = 0;

  for (const file of sessionFiles) {
    const sessionId = path.basename(file, '.jsonl');

    if (!state.processedSessions.has(sessionId)) {
      const timeline = parseSessionFile(file);
      if (timeline) {
        timelines.push(timeline);
        state.processedSessions.add(sessionId);
        newSessions++;
      }
    } else {
      // Still need timeline for aggregation
      const timeline = parseSessionFile(file);
      if (timeline) {
        timelines.push(timeline);
      }
    }
  }

  console.log(`Processed ${newSessions} new sessions (${timelines.length} total)\n`);

  const report = generateIntelligenceReport(timelines);
  state.report = report;

  return report;
}

/**
 * Print analysis report
 */
function printReport(report: IntelligenceReport): void {
  // Top tools
  console.log('📊 TOP TOOLS:');
  for (const [tool, count] of report.aggregatedPatterns.topTools.slice(0, 5)) {
    console.log(`   ${tool}: ${count} calls`);
  }
  console.log();

  // Top file extensions
  console.log('📁 FILE ACTIVITY (by extension):');
  for (const [ext, counts] of report.aggregatedPatterns.topExtensions.slice(0, 5)) {
    console.log(`   .${ext}: R:${counts.read} / W:${counts.write}`);
  }
  console.log();

  // Top commands
  console.log('🖥️  TOP COMMANDS:');
  for (const [cmd, count] of report.aggregatedPatterns.topCommands.slice(0, 5)) {
    console.log(`   ${cmd}: ${count}x`);
  }
  console.log();

  // Most active projects
  console.log('🎯 MOST ACTIVE PROJECTS:');
  for (const [project, activity] of report.aggregatedPatterns.mostActiveProjects.slice(0, 5)) {
    console.log(`   ${project}: ${activity} operations`);
  }
  console.log();

  // Topics
  console.log('🏷️  ACTIVE TOPICS:');
  for (const topic of report.syncState.activeTopics.slice(0, 5)) {
    console.log(`   ${topic.topic}: ${topic.projects.length} projects, ${topic.sessions.length} sessions`);
  }
  console.log();

  // Parallel sessions
  if (report.syncState.parallelSessions.length > 0) {
    console.log('⚡ PARALLEL SESSIONS (merge candidates):');
    for (const ps of report.syncState.parallelSessions.filter(p => p.shouldMerge)) {
      console.log(`   ${ps.projectName}: ${ps.sessionIds.length} sessions → canonical: ${ps.canonicalSession.slice(0, 8)}`);
    }
    console.log();
  }

  // Recommendations
  if (report.deduplicationOpportunities.length > 0) {
    console.log('🔄 DEDUPLICATION OPPORTUNITIES:');
    for (const opp of report.deduplicationOpportunities) {
      console.log(`   • ${opp}`);
    }
    console.log();
  }

  if (report.processReinforcements.length > 0) {
    console.log('⚠️  PROCESS REINFORCEMENTS:');
    for (const pr of report.processReinforcements) {
      console.log(`   • ${pr}`);
    }
    console.log();
  }

  // Project context summary
  console.log('📋 PROJECT CONTEXTS:');
  for (const ctx of report.syncState.projectContext.slice(0, 5)) {
    console.log(`   ${ctx.projectName}:`);
    console.log(`      Last active: ${ctx.lastActivity}`);
    console.log(`      Recent files: ${ctx.recentFiles.length}`);
    console.log(`      Git branch: ${ctx.gitState?.branch || 'unknown'}`);
  }
  console.log();
}

/**
 * Write report to JSON file
 */
function writeReportFile(report: IntelligenceReport, outputPath: string): void {
  const output = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSessions: report.timelines.length,
      topTools: report.aggregatedPatterns.topTools.slice(0, 10),
      topExtensions: report.aggregatedPatterns.topExtensions.slice(0, 10),
      topCommands: report.aggregatedPatterns.topCommands.slice(0, 10),
      activeProjects: report.aggregatedPatterns.mostActiveProjects,
      activeTopics: report.syncState.activeTopics,
    },
    syncState: report.syncState,
    recommendations: {
      deduplication: report.deduplicationOpportunities,
      processReinforcements: report.processReinforcements,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`📄 Report written to: ${outputPath}`);
}

/**
 * Main daemon loop
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch');
  const outputIdx = args.indexOf('--output');
  const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : null;

  console.log('🔍 Session Intelligence Daemon');
  console.log(`   Sessions dir: ${SESSIONS_DIR}`);
  console.log(`   Watch mode: ${watchMode}`);
  console.log(`   Output file: ${outputPath || 'stdout only'}`);
  console.log();

  // Initial analysis
  const report = runAnalysis();
  printReport(report);

  if (outputPath) {
    writeReportFile(report, outputPath);
  }

  // Watch mode
  if (watchMode) {
    console.log(`\n👀 Watching for new sessions (checking every ${CHECK_INTERVAL / 1000}s)...\n`);

    setInterval(() => {
      const newReport = runAnalysis();

      // Only print if there are changes
      if (newReport.timelines.length !== state.report?.timelines.length) {
        printReport(newReport);
        if (outputPath) {
          writeReportFile(newReport, outputPath);
        }
      }

      state.lastCheck = new Date();
    }, CHECK_INTERVAL);

    // Keep process alive
    process.stdin.resume();
  }
}

// Run
main().catch((err) => {
  console.error('Daemon error:', err);
  process.exit(1);
});
