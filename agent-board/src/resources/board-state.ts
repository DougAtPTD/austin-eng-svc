import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDb } from '../db/connection.js';
import { STORY_STATES } from '../constants.js';
import type { Story } from '../types.js';

export function registerBoardStateResource(server: McpServer, projectId: string): void {
  server.resource(
    'board-state',
    'board://state',
    { description: 'Full board view: stories grouped by column with counts', mimeType: 'application/json' },
    async () => {
      const db = getDb();
      const board: Record<string, { count: number; stories: Partial<Story>[] }> = {};

      for (const state of STORY_STATES) {
        const stories = db.prepare(
          `SELECT id, title, priority, assigned_to, updated_at FROM stories WHERE project_id = ? AND state = ?
           ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, updated_at DESC`
        ).all(projectId, state) as Partial<Story>[];
        board[state] = { count: stories.length, stories };
      }

      return { contents: [{ uri: 'board://state', text: JSON.stringify(board, null, 2), mimeType: 'application/json' }] };
    }
  );
}
