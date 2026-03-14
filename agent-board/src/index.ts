import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerStoryTools } from './tools/stories.js';
import { registerTransitionTools } from './tools/transitions.js';
import { registerCommentTools } from './tools/comments.js';
import { registerBoardTools } from './tools/board.js';
import { registerWorkflowTools } from './tools/workflow.js';
import { registerBoardStateResource } from './resources/board-state.js';
import { registerStoryDetailResource } from './resources/story-detail.js';
import { registerMyWorkResource } from './resources/my-work.js';
import { closeDb } from './db/connection.js';
import type { Role } from './types.js';

const role = (process.env.AGENT_BOARD_ROLE || 'human') as Role;

const server = new McpServer({
  name: 'agent-board',
  version: '1.0.0',
});

// Register all tools with role enforcement
registerStoryTools(server, role);
registerTransitionTools(server, role);
registerCommentTools(server, role);
registerBoardTools(server, role);
registerWorkflowTools(server, role);

// Register resources
registerBoardStateResource(server);
registerStoryDetailResource(server);
registerMyWorkResource(server);

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
