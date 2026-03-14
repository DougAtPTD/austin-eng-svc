import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { STORY_STATES } from '../constants.js';
import type { Role, Story, ActivityLogEntry } from '../types.js';

export function registerBoardTools(server: McpServer, role: Role): void {
  server.tool(
    'board_list_stories',
    'List stories with optional filters.',
    {
      state: z.enum(STORY_STATES as [string, ...string[]]).optional().describe('Filter by state'),
      assigned_to: z.enum(['pm', 'dev']).optional().describe('Filter by assignee'),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Filter by priority'),
      limit: z.number().optional().describe('Max results (default 50)'),
    },
    async (params) => {
      const db = getDb();
      const conditions: string[] = [];
      const values: unknown[] = [];

      if (params.state) { conditions.push('state = ?'); values.push(params.state); }
      if (params.assigned_to) { conditions.push('assigned_to = ?'); values.push(params.assigned_to); }
      if (params.priority) { conditions.push('priority = ?'); values.push(params.priority); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = params.limit ?? 50;

      const stories = db.prepare(
        `SELECT id, title, priority, state, assigned_to, created_at, updated_at FROM stories ${where} ORDER BY
          CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
          updated_at DESC
        LIMIT ?`
      ).all(...values, limit) as Partial<Story>[];

      return { content: [{ type: 'text', text: JSON.stringify(stories, null, 2) }] };
    }
  );

  server.tool(
    'board_get_board',
    'Get the full board: stories grouped by column with counts.',
    {},
    async () => {
      const db = getDb();
      const board: Record<string, { count: number; stories: Partial<Story>[] }> = {};

      for (const state of STORY_STATES) {
        const stories = db.prepare(
          `SELECT id, title, priority, assigned_to, updated_at FROM stories WHERE state = ?
           ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, updated_at DESC`
        ).all(state) as Partial<Story>[];
        board[state] = { count: stories.length, stories };
      }

      return { content: [{ type: 'text', text: JSON.stringify(board, null, 2) }] };
    }
  );

  server.tool(
    'board_search_stories',
    'Full-text search across story title, description, technical_spec, and acceptance_criteria.',
    {
      query: z.string().describe('Search query'),
    },
    async (params) => {
      const db = getDb();
      const pattern = `%${params.query}%`;
      const stories = db.prepare(
        `SELECT id, title, priority, state, assigned_to, updated_at FROM stories
         WHERE title LIKE ? OR description LIKE ? OR technical_spec LIKE ? OR acceptance_criteria LIKE ?
         ORDER BY updated_at DESC LIMIT 20`
      ).all(pattern, pattern, pattern, pattern) as Partial<Story>[];

      return { content: [{ type: 'text', text: JSON.stringify(stories, null, 2) }] };
    }
  );

  server.tool(
    'board_get_activity',
    'Query the activity log.',
    {
      since: z.string().optional().describe('ISO timestamp to filter after'),
      story_id: z.string().optional().describe('Filter by story'),
      actor: z.string().optional().describe('Filter by actor'),
      limit: z.number().optional().describe('Max results (default 50)'),
    },
    async (params) => {
      const db = getDb();
      const conditions: string[] = [];
      const values: unknown[] = [];

      if (params.since) { conditions.push('created_at > ?'); values.push(params.since); }
      if (params.story_id) { conditions.push('story_id = ?'); values.push(params.story_id); }
      if (params.actor) { conditions.push('actor = ?'); values.push(params.actor); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = params.limit ?? 50;

      const entries = db.prepare(
        `SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT ?`
      ).all(...values, limit) as ActivityLogEntry[];

      return { content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }] };
    }
  );

  server.tool(
    'board_poll_changes',
    'Poll for changes relevant to your role since a given timestamp. Core mechanism for agent awareness.',
    {
      since: z.string().describe('ISO timestamp to check for changes after'),
    },
    async (params) => {
      const db = getDb();

      // Get all activity since the timestamp
      const allActivity = db.prepare(
        `SELECT al.*, s.title as story_title, s.state as current_state
         FROM activity_log al
         LEFT JOIN stories s ON al.story_id = s.id
         WHERE al.created_at > ? AND al.actor != ?
         ORDER BY al.created_at ASC`
      ).all(params.since, role) as (ActivityLogEntry & { story_title: string; current_state: string })[];

      // Filter by relevance to role
      let relevant = allActivity;
      if (role === 'pm') {
        // PM cares about: submissions for review, dev comments
        relevant = allActivity.filter(a =>
          a.current_state === 'agent_review' ||
          a.action === 'state_change' && JSON.parse(a.details).to === 'agent_review' ||
          a.actor === 'dev'
        );
      } else if (role === 'dev') {
        // Dev cares about: new stories in todo, change requests, PM comments
        relevant = allActivity.filter(a =>
          a.current_state === 'todo' ||
          a.current_state === 'changes_requested' ||
          a.action === 'state_change' && ['todo', 'changes_requested'].includes(JSON.parse(a.details).to) ||
          a.actor === 'pm'
        );
      }

      const now = new Date().toISOString();
      const summary = relevant.length === 0
        ? `No new changes for role "${role}" since ${params.since}.`
        : `${relevant.length} change(s) found for role "${role}".`;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ summary, current_time: now, changes: relevant }, null, 2),
        }],
      };
    }
  );
}
