import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../db/connection.js';
import { canUseRole } from '../constants.js';
import type { Role, Story } from '../types.js';

export function registerStoryTools(server: McpServer, role: Role, projectId: string): void {
  server.tool(
    'board_create_story',
    'Create a new story on the board. PM only.',
    {
      title: z.string().describe('Story title'),
      description: z.string().optional().describe('Problem statement and summary'),
      technical_spec: z.string().optional().describe('Technical specification'),
      acceptance_criteria: z.string().optional().describe('Markdown checklist of acceptance criteria'),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Story priority'),
    },
    async (params) => {
      if (!canUseRole('board_create_story', role)) {
        return { content: [{ type: 'text', text: `Error: Role "${role}" cannot create stories. Only PM can.` }], isError: true };
      }
      const db = getDb();
      const id = `story_${nanoid(8)}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO stories (id, project_id, title, description, technical_spec, acceptance_criteria, priority, state, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'backlog', ?, ?, ?)
      `).run(
        id,
        projectId,
        params.title,
        params.description ?? '',
        params.technical_spec ?? '',
        params.acceptance_criteria ?? '',
        params.priority ?? 'medium',
        role,
        now,
        now,
      );

      const logId = `log_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO activity_log (id, project_id, story_id, actor, action, details, created_at)
        VALUES (?, ?, ?, ?, 'created', ?, ?)
      `).run(logId, projectId, id, role, JSON.stringify({ title: params.title }), now);

      const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as Story;
      return { content: [{ type: 'text', text: JSON.stringify(story, null, 2) }] };
    }
  );

  server.tool(
    'board_update_story',
    'Update fields on an existing story. PM only.',
    {
      story_id: z.string().describe('Story ID'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      technical_spec: z.string().optional().describe('New technical spec'),
      acceptance_criteria: z.string().optional().describe('New acceptance criteria'),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('New priority'),
    },
    async (params) => {
      if (!canUseRole('board_update_story', role)) {
        return { content: [{ type: 'text', text: `Error: Role "${role}" cannot update stories. Only PM can.` }], isError: true };
      }
      const db = getDb();
      const story = db.prepare('SELECT * FROM stories WHERE id = ? AND project_id = ?').get(params.story_id, projectId) as Story | undefined;
      if (!story) {
        return { content: [{ type: 'text', text: `Error: Story "${params.story_id}" not found in this project.` }], isError: true };
      }

      const updates: string[] = [];
      const values: unknown[] = [];
      const changes: Record<string, unknown> = {};

      for (const field of ['title', 'description', 'technical_spec', 'acceptance_criteria', 'priority'] as const) {
        const val = params[field];
        if (val !== undefined) {
          updates.push(`${field} = ?`);
          values.push(val);
          changes[field] = { from: story[field], to: val };
        }
      }

      if (updates.length === 0) {
        return { content: [{ type: 'text', text: 'No fields to update.' }] };
      }

      const now = new Date().toISOString();
      updates.push('updated_at = ?');
      values.push(now);
      values.push(params.story_id);

      db.prepare(`UPDATE stories SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      const logId = `log_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO activity_log (id, project_id, story_id, actor, action, details, created_at)
        VALUES (?, ?, ?, ?, 'updated', ?, ?)
      `).run(logId, projectId, params.story_id, role, JSON.stringify(changes), now);

      const updated = db.prepare('SELECT * FROM stories WHERE id = ?').get(params.story_id) as Story;
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    'board_delete_story',
    'Delete a story. Only allowed in backlog or done states. PM only.',
    {
      story_id: z.string().describe('Story ID'),
    },
    async (params) => {
      if (!canUseRole('board_delete_story', role)) {
        return { content: [{ type: 'text', text: `Error: Role "${role}" cannot delete stories. Only PM can.` }], isError: true };
      }
      const db = getDb();
      const story = db.prepare('SELECT * FROM stories WHERE id = ? AND project_id = ?').get(params.story_id, projectId) as Story | undefined;
      if (!story) {
        return { content: [{ type: 'text', text: `Error: Story "${params.story_id}" not found in this project.` }], isError: true };
      }
      if (story.state !== 'backlog' && story.state !== 'done') {
        return { content: [{ type: 'text', text: `Error: Can only delete stories in "backlog" or "done" state. Current state: "${story.state}".` }], isError: true };
      }

      db.prepare('DELETE FROM stories WHERE id = ?').run(params.story_id);
      return { content: [{ type: 'text', text: `Story "${params.story_id}" deleted.` }] };
    }
  );

  server.tool(
    'board_get_story',
    'Get a story with all its comments and activity.',
    {
      story_id: z.string().describe('Story ID'),
    },
    async (params) => {
      const db = getDb();
      const story = db.prepare('SELECT * FROM stories WHERE id = ? AND project_id = ?').get(params.story_id, projectId) as Story | undefined;
      if (!story) {
        return { content: [{ type: 'text', text: `Error: Story "${params.story_id}" not found in this project.` }], isError: true };
      }

      const comments = db.prepare('SELECT * FROM comments WHERE story_id = ? ORDER BY created_at ASC').all(params.story_id);
      const activity = db.prepare('SELECT * FROM activity_log WHERE story_id = ? ORDER BY created_at ASC').all(params.story_id);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ story, comments, activity }, null, 2),
        }],
      };
    }
  );
}
