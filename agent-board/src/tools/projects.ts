import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDb } from '../db/connection.js';
import type { Project } from '../types.js';

export function registerProjectTools(server: McpServer): void {
  server.tool(
    'board_list_projects',
    'List all projects on the board.',
    {},
    async () => {
      const db = getDb();
      const projects = db.prepare(
        `SELECT p.*,
           (SELECT COUNT(*) FROM stories s WHERE s.project_id = p.id) as story_count,
           (SELECT COUNT(*) FROM stories s WHERE s.project_id = p.id AND s.state NOT IN ('done', 'backlog')) as active_count
         FROM projects p ORDER BY p.name`
      ).all() as (Project & { story_count: number; active_count: number })[];

      return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
    }
  );
}
