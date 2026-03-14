import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDb } from '../db/connection.js';
import type { Story, Comment, ActivityLogEntry } from '../types.js';

export function registerStoryDetailResource(server: McpServer): void {
  server.resource(
    'story-detail',
    new ResourceTemplate('board://story/{storyId}', { list: undefined }),
    { description: 'Single story with all comments and activity', mimeType: 'application/json' },
    async (uri, params) => {
      const storyId = params.storyId as string;
      const db = getDb();

      const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(storyId) as Story | undefined;
      if (!story) {
        return { contents: [{ uri: uri.href, text: JSON.stringify({ error: `Story "${storyId}" not found` }), mimeType: 'application/json' }] };
      }

      const comments = db.prepare('SELECT * FROM comments WHERE story_id = ? ORDER BY created_at ASC').all(storyId) as Comment[];
      const activity = db.prepare('SELECT * FROM activity_log WHERE story_id = ? ORDER BY created_at ASC').all(storyId) as ActivityLogEntry[];

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ story, comments, activity }, null, 2),
          mimeType: 'application/json',
        }],
      };
    }
  );

  server.resource(
    'stories-by-state',
    new ResourceTemplate('board://stories/{state}', { list: undefined }),
    { description: 'All stories in a given state', mimeType: 'application/json' },
    async (uri, params) => {
      const state = params.state as string;
      const db = getDb();

      const stories = db.prepare(
        `SELECT * FROM stories WHERE state = ?
         ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, updated_at DESC`
      ).all(state) as Story[];

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(stories, null, 2),
          mimeType: 'application/json',
        }],
      };
    }
  );
}
