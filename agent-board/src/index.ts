import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerStoryTools } from './tools/stories.js';
import { registerTransitionTools } from './tools/transitions.js';
import { registerCommentTools } from './tools/comments.js';
import { registerBoardTools } from './tools/board.js';
import { registerWorkflowTools } from './tools/workflow.js';
import { registerProjectTools } from './tools/projects.js';
import { registerBoardStateResource } from './resources/board-state.js';
import { registerStoryDetailResource } from './resources/story-detail.js';
import { registerMyWorkResource } from './resources/my-work.js';
import { closeDb, getDb } from './db/connection.js';
import type { Role } from './types.js';
import { basename } from 'path';
import { nanoid } from 'nanoid';

const role = (process.env.AGENT_BOARD_ROLE || 'human') as Role;

// Auto-detect project: use AGENT_BOARD_PROJECT env, or fall back to cwd basename
const projectSlug = process.env.AGENT_BOARD_PROJECT || basename(process.cwd());
const projectId = `proj_${projectSlug.toLowerCase().replace(/[^a-z0-9-_]/g, '-')}`;

// Ensure the project exists in the database
const db = getDb();
const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
if (!existing) {
  db.prepare('INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)').run(
    projectId,
    projectSlug,
    new Date().toISOString(),
  );
}

const server = new McpServer({
  name: 'agent-board',
  version: '1.0.0',
});

// Register all tools with role enforcement and project scoping
registerProjectTools(server);
registerStoryTools(server, role, projectId);
registerTransitionTools(server, role, projectId);
registerCommentTools(server, role, projectId);
registerBoardTools(server, role, projectId);
registerWorkflowTools(server, role, projectId);

// Register resources
registerBoardStateResource(server, projectId);
registerStoryDetailResource(server, projectId);
registerMyWorkResource(server, projectId);

// Start the server
const transport = new StdioServerTransport();

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

await server.connect(transport);
