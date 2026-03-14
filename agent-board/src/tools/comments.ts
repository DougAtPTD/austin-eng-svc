import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../db/connection.js';
import type { Role, Story, Comment } from '../types.js';

export function registerCommentTools(server: McpServer, role: Role, projectId: string): void {
  server.tool(
    'board_add_comment',
    'Add a comment to a story discussion thread.',
    {
      story_id: z.string().describe('Story ID'),
      content: z.string().describe('Comment content'),
      comment_type: z.enum(['comment', 'review_approve', 'review_reject', 'change_request', 'submission', 'status_change'])
        .optional()
        .describe('Type of comment'),
    },
    async (params) => {
      const db = getDb();
      const story = db.prepare('SELECT * FROM stories WHERE id = ? AND project_id = ?').get(params.story_id, projectId) as Story | undefined;
      if (!story) {
        return { content: [{ type: 'text', text: `Error: Story "${params.story_id}" not found in this project.` }], isError: true };
      }

      const now = new Date().toISOString();
      const id = `cmt_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO comments (id, story_id, author, content, comment_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, params.story_id, role, params.content, params.comment_type ?? 'comment', now);

      const logId = `log_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO activity_log (id, project_id, story_id, actor, action, details, created_at)
        VALUES (?, ?, ?, ?, 'comment', ?, ?)
      `).run(logId, projectId, params.story_id, role, JSON.stringify({ comment_id: id, type: params.comment_type ?? 'comment' }), now);

      const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as Comment;
      return { content: [{ type: 'text', text: JSON.stringify(comment, null, 2) }] };
    }
  );

  server.tool(
    'board_list_comments',
    'List comments on a story, optionally filtered by timestamp.',
    {
      story_id: z.string().describe('Story ID'),
      since: z.string().optional().describe('ISO timestamp to filter comments after'),
    },
    async (params) => {
      const db = getDb();
      let comments: Comment[];
      if (params.since) {
        comments = db.prepare('SELECT * FROM comments WHERE story_id = ? AND created_at > ? ORDER BY created_at ASC')
          .all(params.story_id, params.since) as Comment[];
      } else {
        comments = db.prepare('SELECT * FROM comments WHERE story_id = ? ORDER BY created_at ASC')
          .all(params.story_id) as Comment[];
      }
      return { content: [{ type: 'text', text: JSON.stringify(comments, null, 2) }] };
    }
  );
}
