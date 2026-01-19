/**
 * ChittySessionIntelligence - Raw Session Data Analysis & Sync
 *
 * INPUT: Claude Code session JSONL files
 *
 * OUTPUT 1 (Analysis):
 * - Running timeline of functions/CLIs/commands/tools
 * - File extensions read vs written
 * - Directories worked in
 * - Patterns for deduplication and process reinforcement
 *
 * OUTPUT 2 (Sync):
 * - SessionSync: Merge parallel sessions → single --continue target
 * - ProjectSync: GitHub project context across sessions
 * - TopicSync: Topics spanning projects/sessions
 *
 * Canonical URI: chittycanon://services/session-intelligence
 */

import { ChittyConnectClient } from './svc-chittyconnect';

// ============================================
// RAW SESSION DATA TYPES (from Claude Code JSONL)
// ============================================

interface RawSessionEvent {
  type: 'user' | 'assistant' | 'file-history-snapshot' | 'tool_use' | 'tool_result';
  messageId: string;
  parentUuid?: string;
  sessionId: string;
  timestamp: string;
  cwd: string;
  gitBranch?: string;
  version?: string;
  message?: {
    role: string;
    content: string | ContentBlock[];
    model?: string;
  };
  uuid?: string;
}

interface ContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  thinking?: string;
  name?: string;  // Tool name
  input?: Record<string, unknown>;
  tool_use_id?: string;
}

// ============================================
// OUTPUT 1: ANALYSIS TYPES
// ============================================

export interface SessionTimeline {
  sessionId: string;
  projectPath: string;
  projectName: string;
  gitBranch?: string;
  startTime: string;
  endTime: string;
  isActive: boolean;  // Session still running?

  // Tool usage timeline
  toolUsage: ToolUsageEntry[];

  // File operations
  filesRead: FileEntry[];
  filesWritten: FileEntry[];

  // Commands executed
  commands: CommandEntry[];

  // Directories active
  directories: DirectoryActivity[];

  // Todos from this session
  todos: TodoSnapshot[];

  // Aggregated patterns
  patterns: {
    toolFrequency: Record<string, number>;
    extensionActivity: Record<string, { read: number; write: number }>;
    commandPatterns: Record<string, number>;
    focusAreas: string[];  // Most active directories
  };

  // Memory candidates for MemoryCloude
  memoryTriggers: MemoryTrigger[];
}

interface TodoSnapshot {
  timestamp: string;
  todos: {
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm?: string;
  }[];
}

interface MemoryTrigger {
  type: 'decision' | 'discovery' | 'error_resolution' | 'pattern_learned' | 'todo_completed';
  content: string;
  context: string;
  timestamp: string;
  shouldPersist: boolean;
}

interface ToolUsageEntry {
  timestamp: string;
  tool: string;
  summary: string;  // Brief description of what was done
}

interface FileEntry {
  timestamp: string;
  path: string;
  extension: string;
  operation: 'read' | 'write' | 'edit';
}

interface CommandEntry {
  timestamp: string;
  command: string;
  directory: string;
  pattern: string;  // Extracted command pattern (e.g., "git status")
}

interface DirectoryActivity {
  path: string;
  operationCount: number;
  lastAccess: string;
  primaryExtensions: string[];
}

// ============================================
// OUTPUT 2: SYNC TYPES
// ============================================

export interface SessionSyncState {
  // Sessions that should be merged (same project, overlapping time)
  parallelSessions: {
    sessionIds: string[];
    projectName: string;
    shouldMerge: boolean;
    canonicalSession: string;  // The one to --continue to
  }[];

  // Context to inject when starting a new session
  projectContext: ProjectContext[];

  // Cross-session topics
  activeTopics: TopicState[];
}

export interface ProjectContext {
  projectName: string;
  repoPath?: string;  // GitHub org/repo
  lastActivity: string;
  recentFiles: string[];
  recentCommands: string[];
  openTasks: string[];  // From TodoWrite
  gitState?: {
    branch: string;
    uncommittedFiles: number;
    lastCommit?: string;
  };
}

export interface TopicState {
  topic: string;
  sessions: string[];  // Session IDs that touched this topic
  projects: string[];  // Projects that touched this topic
  lastMention: string;
  context: string;  // Summary of what's been done
}

// ============================================
// TODO/TASK SYNC TYPES
// ============================================

export interface UniversalTodo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;

  // Tracking
  sourceSession: string;
  sourceProject: string;
  createdAt: string;
  updatedAt: string;

  // Parallel work tracking
  activeInSession?: string;  // Which session is currently working on this
  activeSessionStarted?: string;

  // Hierarchy
  parentTodoId?: string;
  projectFilter?: string;  // If scoped to a project
}

export interface TodoSyncState {
  // Universal list (all todos across all sessions)
  universalTodos: UniversalTodo[];

  // Grouped by project
  byProject: Record<string, UniversalTodo[]>;

  // Active work (what's being executed right now)
  activeWork: {
    todoId: string;
    sessionId: string;
    project: string;
    startedAt: string;
    content: string;
  }[];

  // Interrupted work (in_progress but session ended)
  interruptedWork: {
    todoId: string;
    lastSession: string;
    project: string;
    content: string;
    interruptedAt: string;
  }[];
}

export interface TaskSyncState {
  // Tasks by stage
  byStage: {
    pending: UniversalTodo[];
    in_progress: UniversalTodo[];
    completed: UniversalTodo[];
  };

  // Session activity
  sessionActivity: Record<string, {
    activeTasks: number;
    completedTasks: number;
    lastActivity: string;
  }>;

  // Parallel execution warnings (multiple sessions on same task)
  conflicts: {
    todoId: string;
    content: string;
    sessions: string[];
  }[];
}

// ============================================
// PARSER: Raw JSONL → Structured Data
// ============================================

export function parseSessionJSONL(content: string): SessionTimeline {
  const lines = content.split('\n').filter(l => l.trim());
  const events: RawSessionEvent[] = [];

  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }

  if (events.length === 0) {
    throw new Error('No valid events in session');
  }

  const firstEvent = events.find(e => e.timestamp && e.sessionId);
  const lastEvent = [...events].reverse().find(e => e.timestamp);

  // Check if session is still active (ended less than 5 minutes ago)
  const endTime = lastEvent?.timestamp || new Date().toISOString();
  const isActive = (Date.now() - new Date(endTime).getTime()) < 5 * 60 * 1000;

  const timeline: SessionTimeline = {
    sessionId: firstEvent?.sessionId || 'unknown',
    projectPath: firstEvent?.cwd || 'unknown',
    projectName: extractProjectName(firstEvent?.cwd || ''),
    gitBranch: firstEvent?.gitBranch,
    startTime: firstEvent?.timestamp || new Date().toISOString(),
    endTime,
    isActive,
    toolUsage: [],
    filesRead: [],
    filesWritten: [],
    commands: [],
    directories: [],
    todos: [],
    patterns: {
      toolFrequency: {},
      extensionActivity: {},
      commandPatterns: {},
      focusAreas: [],
    },
    memoryTriggers: [],
  };

  // Extract data from events
  for (const event of events) {
    if (event.type === 'assistant' && event.message?.content) {
      const content = event.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use' && block.name) {
            extractToolUsage(timeline, block, event);
          }
        }
      }
    }
  }

  // Aggregate patterns
  aggregatePatterns(timeline);

  return timeline;
}

function extractToolUsage(
  timeline: SessionTimeline,
  block: ContentBlock,
  event: RawSessionEvent
): void {
  const tool = block.name!;
  const input = block.input || {};
  const timestamp = event.timestamp;

  // Track tool frequency
  timeline.patterns.toolFrequency[tool] = (timeline.patterns.toolFrequency[tool] || 0) + 1;

  // Extract file operations
  if (tool === 'Read' && typeof input.file_path === 'string') {
    const ext = extractExtension(input.file_path);
    timeline.filesRead.push({
      timestamp,
      path: input.file_path,
      extension: ext,
      operation: 'read',
    });
    timeline.toolUsage.push({
      timestamp,
      tool,
      summary: `Read ${shortenPath(input.file_path)}`,
    });
    trackExtension(timeline, ext, 'read');
    trackDirectory(timeline, input.file_path, timestamp);
  } else if ((tool === 'Write' || tool === 'Edit') && typeof input.file_path === 'string') {
    const ext = extractExtension(input.file_path);
    timeline.filesWritten.push({
      timestamp,
      path: input.file_path,
      extension: ext,
      operation: tool.toLowerCase() as 'write' | 'edit',
    });
    timeline.toolUsage.push({
      timestamp,
      tool,
      summary: `${tool} ${shortenPath(input.file_path)}`,
    });
    trackExtension(timeline, ext, 'write');
    trackDirectory(timeline, input.file_path, timestamp);
  } else if (tool === 'Bash' && typeof input.command === 'string') {
    const pattern = extractCommandPattern(input.command);
    timeline.commands.push({
      timestamp,
      command: sanitizeCommand(input.command),
      directory: event.cwd,
      pattern,
    });
    timeline.patterns.commandPatterns[pattern] = (timeline.patterns.commandPatterns[pattern] || 0) + 1;
    timeline.toolUsage.push({
      timestamp,
      tool,
      summary: `Run: ${pattern}`,
    });
  } else if (tool === 'Grep' || tool === 'Glob') {
    timeline.toolUsage.push({
      timestamp,
      tool,
      summary: `${tool}: ${(input.pattern as string)?.substring(0, 30) || 'search'}`,
    });
  } else if (tool === 'TodoWrite') {
    // Extract todo state
    const todos = input.todos as Array<{ content: string; status: string; activeForm?: string }> || [];
    timeline.todos.push({
      timestamp,
      todos: todos.map(t => ({
        content: t.content,
        status: t.status as 'pending' | 'in_progress' | 'completed',
        activeForm: t.activeForm,
      })),
    });
    timeline.toolUsage.push({
      timestamp,
      tool,
      summary: `Todos: ${todos.filter(t => t.status === 'in_progress').length} active, ${todos.filter(t => t.status === 'completed').length} done`,
    });

    // Check for memory triggers (completed todos)
    const completed = todos.filter(t => t.status === 'completed');
    for (const todo of completed) {
      timeline.memoryTriggers.push({
        type: 'todo_completed',
        content: todo.content,
        context: timeline.projectName,
        timestamp,
        shouldPersist: true,
      });
    }
  } else {
    timeline.toolUsage.push({
      timestamp,
      tool,
      summary: `${tool} call`,
    });
  }
}

function trackExtension(timeline: SessionTimeline, ext: string, op: 'read' | 'write'): void {
  if (!timeline.patterns.extensionActivity[ext]) {
    timeline.patterns.extensionActivity[ext] = { read: 0, write: 0 };
  }
  timeline.patterns.extensionActivity[ext][op]++;
}

function trackDirectory(timeline: SessionTimeline, filePath: string, timestamp: string): void {
  const dir = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
  let dirEntry = timeline.directories.find(d => d.path === dir);

  if (!dirEntry) {
    dirEntry = {
      path: dir,
      operationCount: 0,
      lastAccess: timestamp,
      primaryExtensions: [],
    };
    timeline.directories.push(dirEntry);
  }

  dirEntry.operationCount++;
  dirEntry.lastAccess = timestamp;

  const ext = extractExtension(filePath);
  if (!dirEntry.primaryExtensions.includes(ext)) {
    dirEntry.primaryExtensions.push(ext);
  }
}

function aggregatePatterns(timeline: SessionTimeline): void {
  // Identify focus areas (top directories by activity)
  const sortedDirs = [...timeline.directories].sort((a, b) => b.operationCount - a.operationCount);
  timeline.patterns.focusAreas = sortedDirs.slice(0, 5).map(d => shortenPath(d.path));
}

// ============================================
// SYNC LOGIC
// ============================================

export function identifyParallelSessions(
  timelines: SessionTimeline[]
): SessionSyncState['parallelSessions'] {
  const byProject: Record<string, SessionTimeline[]> = {};

  for (const t of timelines) {
    if (!byProject[t.projectName]) {
      byProject[t.projectName] = [];
    }
    byProject[t.projectName].push(t);
  }

  const result: SessionSyncState['parallelSessions'] = [];

  for (const [projectName, sessions] of Object.entries(byProject)) {
    if (sessions.length > 1) {
      // Sort by end time, newest first
      sessions.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

      // Check for time overlap
      const hasOverlap = sessions.some((s, i) => {
        if (i === 0) return false;
        const prevEnd = new Date(sessions[i - 1].endTime).getTime();
        const currStart = new Date(s.startTime).getTime();
        return currStart < prevEnd;
      });

      result.push({
        sessionIds: sessions.map(s => s.sessionId),
        projectName,
        shouldMerge: hasOverlap,
        canonicalSession: sessions[0].sessionId,  // Most recent is canonical
      });
    }
  }

  return result;
}

export function extractProjectContext(timelines: SessionTimeline[]): ProjectContext[] {
  const byProject: Record<string, SessionTimeline[]> = {};

  for (const t of timelines) {
    if (!byProject[t.projectName]) {
      byProject[t.projectName] = [];
    }
    byProject[t.projectName].push(t);
  }

  const contexts: ProjectContext[] = [];

  for (const [projectName, sessions] of Object.entries(byProject)) {
    // Merge data from all sessions for this project
    const allFiles = new Set<string>();
    const allCommands = new Set<string>();
    let lastActivity = '';
    let lastBranch: string | undefined;

    for (const session of sessions) {
      for (const f of [...session.filesRead, ...session.filesWritten].slice(-10)) {
        allFiles.add(f.path);
      }
      for (const c of session.commands.slice(-5)) {
        allCommands.add(c.pattern);
      }
      if (!lastActivity || session.endTime > lastActivity) {
        lastActivity = session.endTime;
        lastBranch = session.gitBranch;
      }
    }

    contexts.push({
      projectName,
      lastActivity,
      recentFiles: [...allFiles].slice(-20),
      recentCommands: [...allCommands].slice(-10),
      openTasks: [],  // Would need to extract from TodoWrite
      gitState: lastBranch ? { branch: lastBranch, uncommittedFiles: 0 } : undefined,
    });
  }

  return contexts;
}

export function extractTopics(timelines: SessionTimeline[]): TopicState[] {
  // Extract topics from file paths, commands, and patterns
  const topicMentions: Record<string, {
    sessions: Set<string>;
    projects: Set<string>;
    lastMention: string;
  }> = {};

  // Topic patterns to look for
  const topicPatterns = [
    { pattern: /edrm|evidence|collection|preservation/i, topic: 'EDRM Evidence Processing' },
    { pattern: /chitty(id|auth|connect|canon|dna)/i, topic: 'ChittyOS Core Services' },
    { pattern: /pipeline|cloudflare|worker/i, topic: 'Infrastructure/Deployment' },
    { pattern: /migration|schema|d1|neon/i, topic: 'Database/Schema' },
    { pattern: /mcp|agent|ai|llm/i, topic: 'AI/MCP Integration' },
    { pattern: /hook|plugin|skill/i, topic: 'Extensibility/Plugins' },
    { pattern: /test|spec|coverage/i, topic: 'Testing' },
    { pattern: /pr|review|git/i, topic: 'Code Review/Git' },
  ];

  for (const timeline of timelines) {
    // Check file paths
    const allPaths = [...timeline.filesRead, ...timeline.filesWritten].map(f => f.path);
    const searchText = allPaths.join(' ') + ' ' + timeline.commands.map(c => c.command).join(' ');

    for (const { pattern, topic } of topicPatterns) {
      if (pattern.test(searchText)) {
        if (!topicMentions[topic]) {
          topicMentions[topic] = {
            sessions: new Set(),
            projects: new Set(),
            lastMention: '',
          };
        }
        topicMentions[topic].sessions.add(timeline.sessionId);
        topicMentions[topic].projects.add(timeline.projectName);
        if (!topicMentions[topic].lastMention || timeline.endTime > topicMentions[topic].lastMention) {
          topicMentions[topic].lastMention = timeline.endTime;
        }
      }
    }
  }

  return Object.entries(topicMentions).map(([topic, data]) => ({
    topic,
    sessions: [...data.sessions],
    projects: [...data.projects],
    lastMention: data.lastMention,
    context: `Active in ${data.projects.size} project(s), ${data.sessions.size} session(s)`,
  }));
}

// ============================================
// SYNC TO CHITTYCONNECT
// ============================================

export async function syncToChittyConnect(
  client: ChittyConnectClient,
  sessionId: string,
  timeline: SessionTimeline,
  syncState: SessionSyncState
): Promise<void> {
  // Sync session state
  await client.syncSession(sessionId, {
    timeline: {
      projectName: timeline.projectName,
      toolUsage: timeline.toolUsage.length,
      filesRead: timeline.filesRead.length,
      filesWritten: timeline.filesWritten.length,
      commands: timeline.commands.length,
      focusAreas: timeline.patterns.focusAreas,
    },
    parallelSessions: syncState.parallelSessions.find(p =>
      p.sessionIds.includes(sessionId)
    ),
    topics: syncState.activeTopics.filter(t =>
      t.sessions.includes(sessionId)
    ),
    lastSync: new Date().toISOString(),
  });
}

// ============================================
// UTILITIES
// ============================================

function extractProjectName(path: string): string {
  const parts = path.split('/').filter(p => p);
  // Look for workspace or github.com patterns
  const wsIdx = parts.indexOf('workspace');
  if (wsIdx >= 0 && parts[wsIdx + 1]) {
    return parts[wsIdx + 1];
  }
  const ghIdx = parts.indexOf('github.com');
  if (ghIdx >= 0 && parts[ghIdx + 2]) {
    return `${parts[ghIdx + 1]}/${parts[ghIdx + 2]}`;
  }
  return parts[parts.length - 1] || 'unknown';
}

function extractExtension(filePath: string): string {
  const match = filePath.match(/\.([^./]+)$/);
  return match ? match[1] : 'none';
}

function extractCommandPattern(command: string): string {
  const words = command.trim().split(/\s+/);
  const base = words[0];
  if (['git', 'npm', 'pnpm', 'wrangler', 'curl', 'gh'].includes(base)) {
    return `${base} ${words[1] || ''}`.trim();
  }
  return base;
}

function sanitizeCommand(command: string): string {
  return command
    .replace(/--token\s+\S+/g, '--token [REDACTED]')
    .replace(/Bearer\s+\S+/g, 'Bearer [REDACTED]')
    .replace(/password\s*=\s*\S+/gi, 'password=[REDACTED]')
    .replace(/api[_-]?key\s*=\s*\S+/gi, 'api_key=[REDACTED]');
}

function shortenPath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 3) return path;
  return `.../${parts.slice(-3).join('/')}`;
}

// ============================================
// MAIN ENTRY POINT
// ============================================

export interface IntelligenceReport {
  // Analysis output
  timelines: SessionTimeline[];
  aggregatedPatterns: {
    topTools: [string, number][];
    topExtensions: [string, { read: number; write: number }][];
    topCommands: [string, number][];
    mostActiveProjects: [string, number][];
  };

  // Sync output
  syncState: SessionSyncState;

  // Recommendations
  deduplicationOpportunities: string[];
  processReinforcements: string[];
}

export function generateIntelligenceReport(
  timelines: SessionTimeline[]
): IntelligenceReport {
  // Aggregate patterns across all sessions
  const toolCounts: Record<string, number> = {};
  const extCounts: Record<string, { read: number; write: number }> = {};
  const cmdCounts: Record<string, number> = {};
  const projectActivity: Record<string, number> = {};

  for (const t of timelines) {
    for (const [tool, count] of Object.entries(t.patterns.toolFrequency)) {
      toolCounts[tool] = (toolCounts[tool] || 0) + count;
    }
    for (const [ext, counts] of Object.entries(t.patterns.extensionActivity)) {
      if (!extCounts[ext]) extCounts[ext] = { read: 0, write: 0 };
      extCounts[ext].read += counts.read;
      extCounts[ext].write += counts.write;
    }
    for (const [cmd, count] of Object.entries(t.patterns.commandPatterns)) {
      cmdCounts[cmd] = (cmdCounts[cmd] || 0) + count;
    }
    projectActivity[t.projectName] = (projectActivity[t.projectName] || 0) + t.toolUsage.length;
  }

  // Build sync state
  const parallelSessions = identifyParallelSessions(timelines);
  const projectContext = extractProjectContext(timelines);
  const activeTopics = extractTopics(timelines);

  // Generate recommendations
  const deduplicationOpportunities: string[] = [];
  const processReinforcements: string[] = [];

  // Check for parallel sessions needing merge
  for (const ps of parallelSessions) {
    if (ps.shouldMerge && ps.sessionIds.length > 1) {
      deduplicationOpportunities.push(
        `Project "${ps.projectName}" has ${ps.sessionIds.length} parallel sessions that should be merged. Canonical: ${ps.canonicalSession}`
      );
    }
  }

  // Check for repeated file reads (efficiency issue)
  for (const t of timelines) {
    const readCounts: Record<string, number> = {};
    for (const f of t.filesRead) {
      readCounts[f.path] = (readCounts[f.path] || 0) + 1;
    }
    const repeated = Object.entries(readCounts).filter(([, c]) => c > 3);
    if (repeated.length > 0) {
      processReinforcements.push(
        `Session ${t.sessionId.slice(0, 8)} has ${repeated.length} files read 3+ times. Consider caching.`
      );
    }
  }

  // Check for missing PR workflow
  for (const t of timelines) {
    if (t.filesWritten.length > 5 && !t.patterns.commandPatterns['git checkout'] && !t.patterns.commandPatterns['gh pr']) {
      processReinforcements.push(
        `Session ${t.sessionId.slice(0, 8)} modified ${t.filesWritten.length} files without PR workflow.`
      );
    }
  }

  return {
    timelines,
    aggregatedPatterns: {
      topTools: Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
      topExtensions: Object.entries(extCounts).sort((a, b) => (b[1].read + b[1].write) - (a[1].read + a[1].write)).slice(0, 10),
      topCommands: Object.entries(cmdCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
      mostActiveProjects: Object.entries(projectActivity).sort((a, b) => b[1] - a[1]).slice(0, 10),
    },
    syncState: {
      parallelSessions,
      projectContext,
      activeTopics,
    },
    deduplicationOpportunities,
    processReinforcements,
  };
}

// ============================================
// TODO/TASK SYNC EXTRACTION
// ============================================

export function extractTodoSync(timelines: SessionTimeline[]): TodoSyncState {
  const allTodos: Map<string, UniversalTodo> = new Map();
  const activeWork: TodoSyncState['activeWork'] = [];
  const interruptedWork: TodoSyncState['interruptedWork'] = [];

  for (const timeline of timelines) {
    if (timeline.todos.length === 0) continue;

    // Get the latest todo snapshot from this session
    const latestSnapshot = timeline.todos[timeline.todos.length - 1];

    for (const todo of latestSnapshot.todos) {
      // Generate a content-based ID for deduplication across sessions
      const todoId = generateTodoId(todo.content);

      const existing = allTodos.get(todoId);

      if (!existing || new Date(timeline.endTime) > new Date(existing.updatedAt)) {
        allTodos.set(todoId, {
          id: todoId,
          content: todo.content,
          status: todo.status,
          activeForm: todo.activeForm,
          sourceSession: timeline.sessionId,
          sourceProject: timeline.projectName,
          createdAt: existing?.createdAt || latestSnapshot.timestamp,
          updatedAt: latestSnapshot.timestamp,
          activeInSession: todo.status === 'in_progress' && timeline.isActive ? timeline.sessionId : undefined,
          activeSessionStarted: todo.status === 'in_progress' && timeline.isActive ? latestSnapshot.timestamp : undefined,
          projectFilter: timeline.projectName,
        });
      }

      // Track active work (in_progress in active session)
      if (todo.status === 'in_progress' && timeline.isActive) {
        activeWork.push({
          todoId,
          sessionId: timeline.sessionId,
          project: timeline.projectName,
          startedAt: latestSnapshot.timestamp,
          content: todo.content,
        });
      }

      // Track interrupted work (in_progress in ended session)
      if (todo.status === 'in_progress' && !timeline.isActive) {
        interruptedWork.push({
          todoId,
          lastSession: timeline.sessionId,
          project: timeline.projectName,
          content: todo.content,
          interruptedAt: timeline.endTime,
        });
      }
    }
  }

  // Group by project
  const byProject: Record<string, UniversalTodo[]> = {};
  for (const todo of allTodos.values()) {
    const project = todo.projectFilter || 'unassigned';
    if (!byProject[project]) byProject[project] = [];
    byProject[project].push(todo);
  }

  return {
    universalTodos: [...allTodos.values()],
    byProject,
    activeWork,
    interruptedWork,
  };
}

export function extractTaskSync(timelines: SessionTimeline[]): TaskSyncState {
  const todoSync = extractTodoSync(timelines);

  const byStage: TaskSyncState['byStage'] = {
    pending: todoSync.universalTodos.filter(t => t.status === 'pending'),
    in_progress: todoSync.universalTodos.filter(t => t.status === 'in_progress'),
    completed: todoSync.universalTodos.filter(t => t.status === 'completed'),
  };

  // Calculate session activity
  const sessionActivity: TaskSyncState['sessionActivity'] = {};
  for (const timeline of timelines) {
    if (timeline.todos.length === 0) continue;

    const latestSnapshot = timeline.todos[timeline.todos.length - 1];
    sessionActivity[timeline.sessionId] = {
      activeTasks: latestSnapshot.todos.filter(t => t.status === 'in_progress').length,
      completedTasks: latestSnapshot.todos.filter(t => t.status === 'completed').length,
      lastActivity: timeline.endTime,
    };
  }

  // Detect conflicts (same todo in_progress in multiple sessions)
  const inProgressByTodo: Record<string, string[]> = {};
  for (const work of todoSync.activeWork) {
    if (!inProgressByTodo[work.todoId]) inProgressByTodo[work.todoId] = [];
    inProgressByTodo[work.todoId].push(work.sessionId);
  }

  const conflicts: TaskSyncState['conflicts'] = [];
  for (const [todoId, sessions] of Object.entries(inProgressByTodo)) {
    if (sessions.length > 1) {
      const todo = todoSync.universalTodos.find(t => t.id === todoId);
      conflicts.push({
        todoId,
        content: todo?.content || 'Unknown',
        sessions,
      });
    }
  }

  return {
    byStage,
    sessionActivity,
    conflicts,
  };
}

function generateTodoId(content: string): string {
  // Simple hash for deduplication
  const normalized = content.toLowerCase().trim().replace(/\s+/g, ' ');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `todo_${Math.abs(hash).toString(36)}`;
}

// ============================================
// MEMORY PERSISTENCE TO MEMORYCLOUDE
// ============================================

export interface MemoryCloudEntry {
  id: string;
  type: 'decision' | 'discovery' | 'error_resolution' | 'pattern_learned' | 'todo_completed' | 'session_summary';
  content: string;
  context: {
    project: string;
    session: string;
    timestamp: string;
  };
  tags: string[];
  importance: 'low' | 'medium' | 'high';
}

export function extractMemoryEntries(timelines: SessionTimeline[]): MemoryCloudEntry[] {
  const entries: MemoryCloudEntry[] = [];

  for (const timeline of timelines) {
    // Memory triggers from the session
    for (const trigger of timeline.memoryTriggers) {
      if (trigger.shouldPersist) {
        entries.push({
          id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: trigger.type,
          content: trigger.content,
          context: {
            project: timeline.projectName,
            session: timeline.sessionId,
            timestamp: trigger.timestamp,
          },
          tags: [timeline.projectName, trigger.type],
          importance: trigger.type === 'error_resolution' ? 'high' : 'medium',
        });
      }
    }

    // Session summary as memory (for long sessions)
    if (timeline.toolUsage.length > 50) {
      entries.push({
        id: `mem_summary_${timeline.sessionId.slice(0, 8)}`,
        type: 'session_summary',
        content: `Session in ${timeline.projectName}: ${timeline.toolUsage.length} operations, focused on ${timeline.patterns.focusAreas.slice(0, 3).join(', ')}`,
        context: {
          project: timeline.projectName,
          session: timeline.sessionId,
          timestamp: timeline.endTime,
        },
        tags: [timeline.projectName, 'session_summary', ...(timeline.patterns.focusAreas.slice(0, 3))],
        importance: 'low',
      });
    }
  }

  return entries;
}

export default {
  parseSessionJSONL,
  identifyParallelSessions,
  extractProjectContext,
  extractTopics,
  extractTodoSync,
  extractTaskSync,
  extractMemoryEntries,
  syncToChittyConnect,
  generateIntelligenceReport,
};
