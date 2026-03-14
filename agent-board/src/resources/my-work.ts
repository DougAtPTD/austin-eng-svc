import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDb } from '../db/connection.js';
import type { Story } from '../types.js';

export function registerMyWorkResource(server: McpServer): void {
  server.resource(
    'my-work',
    new ResourceTemplate('board://my-work/{role}', { list: undefined }),
    { description: 'Stories assigned to a role or relevant to their workflow', mimeType: 'application/json' },
    async (uri, params) => {
      const role = params.role as string;
      const db = getDb();

      let stories: Story[];
      if (role === 'pm') {
        // PM cares about stories in agent_review (need their review)
        stories = db.prepare(
          `SELECT * FROM stories WHERE state IN ('agent_review', 'backlog', 'todo') OR assigned_to = 'pm'
           ORDER BY CASE state WHEN 'agent_review' THEN 0 WHEN 'todo' THEN 1 WHEN 'backlog' THEN 2 ELSE 3 END,
           CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END`
        ).all() as Story[];
      } else if (role === 'dev') {
        // Dev cares about stories assigned to them or available for pickup
        stories = db.prepare(
          `SELECT * FROM stories WHERE state IN ('in_progress', 'changes_requested', 'todo') OR assigned_to = 'dev'
           ORDER BY CASE state WHEN 'changes_requested' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
           CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END`
        ).all() as Story[];
      } else {
        // Human sees everything
        stories = db.prepare(
          `SELECT * FROM stories ORDER BY
           CASE state WHEN 'human_review' THEN 0 WHEN 'agent_review' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'todo' THEN 3 ELSE 4 END,
           updated_at DESC`
        ).all() as Story[];
      }

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(stories, null, 2),
          mimeType: 'application/json',
        }],
      };
    }
  );

  server.resource(
    'activity-feed',
    'board://activity',
    { description: 'Last 50 activity log entries', mimeType: 'application/json' },
    async () => {
      const db = getDb();
      const entries = db.prepare(
        `SELECT al.*, s.title as story_title FROM activity_log al
         LEFT JOIN stories s ON al.story_id = s.id
         ORDER BY al.created_at DESC LIMIT 50`
      ).all();

      return { contents: [{ uri: 'board://activity', text: JSON.stringify(entries, null, 2), mimeType: 'application/json' }] };
    }
  );
}
