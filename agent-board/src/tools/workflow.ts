import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../db/connection.js';
import { canUseRole, isValidTransition } from '../constants.js';
import type { Role, Story } from '../types.js';

export function registerWorkflowTools(server: McpServer, role: Role, projectId: string): void {
  server.tool(
    'board_pickup_story',
    'Pick up a story: assigns to you and moves to in_progress. Dev only.',
    {
      story_id: z.string().describe('Story ID to pick up'),
    },
    async (params) => {
      if (!canUseRole('board_pickup_story', role)) {
        return { content: [{ type: 'text', text: `Error: Role "${role}" cannot pick up stories. Only dev can.` }], isError: true };
      }
      const db = getDb();
      const story = db.prepare('SELECT * FROM stories WHERE id = ? AND project_id = ?').get(params.story_id, projectId) as Story | undefined;
      if (!story) {
        return { content: [{ type: 'text', text: `Error: Story "${params.story_id}" not found in this project.` }], isError: true };
      }

      if (!isValidTransition(story.state, 'in_progress')) {
        return {
          content: [{ type: 'text', text: `Error: Cannot pick up story in state "${story.state}". Must be in "todo" or "changes_requested".` }],
          isError: true,
        };
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE stories SET state = ?, assigned_to = ?, updated_at = ? WHERE id = ?')
        .run('in_progress', 'dev', now, params.story_id);

      const logId = `log_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO activity_log (id, project_id, story_id, actor, action, details, created_at)
        VALUES (?, ?, ?, ?, 'state_change', ?, ?)
      `).run(logId, projectId, params.story_id, role, JSON.stringify({ from: story.state, to: 'in_progress', pickup: true }), now);

      const updated = db.prepare('SELECT * FROM stories WHERE id = ?').get(params.story_id) as Story;
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    'board_submit_for_review',
    'Submit work for PM review: moves to agent_review and adds a submission comment. Dev only.',
    {
      story_id: z.string().describe('Story ID'),
      summary: z.string().describe('Submission summary describing what was done and how acceptance criteria were met'),
    },
    async (params) => {
      if (!canUseRole('board_submit_for_review', role)) {
        return { content: [{ type: 'text', text: `Error: Role "${role}" cannot submit for review. Only dev can.` }], isError: true };
      }
      const db = getDb();
      const story = db.prepare('SELECT * FROM stories WHERE id = ? AND project_id = ?').get(params.story_id, projectId) as Story | undefined;
      if (!story) {
        return { content: [{ type: 'text', text: `Error: Story "${params.story_id}" not found in this project.` }], isError: true };
      }
      if (story.state !== 'in_progress') {
        return { content: [{ type: 'text', text: `Error: Story must be "in_progress" to submit. Current state: "${story.state}".` }], isError: true };
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE stories SET state = ?, updated_at = ? WHERE id = ?')
        .run('agent_review', now, params.story_id);

      const commentId = `cmt_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO comments (id, story_id, author, content, comment_type, created_at)
        VALUES (?, ?, ?, ?, 'submission', ?)
      `).run(commentId, params.story_id, role, params.summary, now);

      const logId = `log_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO activity_log (id, project_id, story_id, actor, action, details, created_at)
        VALUES (?, ?, ?, ?, 'state_change', ?, ?)
      `).run(logId, projectId, params.story_id, role, JSON.stringify({ from: 'in_progress', to: 'agent_review', submission: true }), now);

      const updated = db.prepare('SELECT * FROM stories WHERE id = ?').get(params.story_id) as Story;
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    'board_approve_review',
    'Approve a story in agent_review, moving it to human_review. PM only.',
    {
      story_id: z.string().describe('Story ID'),
      comment: z.string().optional().describe('Approval comment'),
    },
    async (params) => {
      if (!canUseRole('board_approve_review', role)) {
        return { content: [{ type: 'text', text: `Error: Role "${role}" cannot approve reviews. Only PM can.` }], isError: true };
      }
      const db = getDb();
      const story = db.prepare('SELECT * FROM stories WHERE id = ? AND project_id = ?').get(params.story_id, projectId) as Story | undefined;
      if (!story) {
        return { content: [{ type: 'text', text: `Error: Story "${params.story_id}" not found in this project.` }], isError: true };
      }
      if (story.state !== 'agent_review') {
        return { content: [{ type: 'text', text: `Error: Story must be in "agent_review" to approve. Current state: "${story.state}".` }], isError: true };
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE stories SET state = ?, updated_at = ? WHERE id = ?')
        .run('human_review', now, params.story_id);

      if (params.comment) {
        const commentId = `cmt_${nanoid(8)}`;
        db.prepare(`
          INSERT INTO comments (id, story_id, author, content, comment_type, created_at)
          VALUES (?, ?, ?, ?, 'review_approve', ?)
        `).run(commentId, params.story_id, role, params.comment, now);
      }

      const logId = `log_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO activity_log (id, project_id, story_id, actor, action, details, created_at)
        VALUES (?, ?, ?, ?, 'state_change', ?, ?)
      `).run(logId, projectId, params.story_id, role, JSON.stringify({ from: 'agent_review', to: 'human_review', approved: true }), now);

      const updated = db.prepare('SELECT * FROM stories WHERE id = ?').get(params.story_id) as Story;
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    'board_request_changes',
    'Request changes on a story in agent_review. Moves to changes_requested. PM only.',
    {
      story_id: z.string().describe('Story ID'),
      feedback: z.string().describe('Specific, actionable feedback on what needs to change'),
    },
    async (params) => {
      if (!canUseRole('board_request_changes', role)) {
        return { content: [{ type: 'text', text: `Error: Role "${role}" cannot request changes. Only PM can.` }], isError: true };
      }
      const db = getDb();
      const story = db.prepare('SELECT * FROM stories WHERE id = ? AND project_id = ?').get(params.story_id, projectId) as Story | undefined;
      if (!story) {
        return { content: [{ type: 'text', text: `Error: Story "${params.story_id}" not found in this project.` }], isError: true };
      }
      if (story.state !== 'agent_review') {
        return { content: [{ type: 'text', text: `Error: Story must be in "agent_review" to request changes. Current state: "${story.state}".` }], isError: true };
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE stories SET state = ?, updated_at = ? WHERE id = ?')
        .run('changes_requested', now, params.story_id);

      const commentId = `cmt_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO comments (id, story_id, author, content, comment_type, created_at)
        VALUES (?, ?, ?, ?, 'change_request', ?)
      `).run(commentId, params.story_id, role, params.feedback, now);

      const logId = `log_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO activity_log (id, project_id, story_id, actor, action, details, created_at)
        VALUES (?, ?, ?, ?, 'state_change', ?, ?)
      `).run(logId, projectId, params.story_id, role, JSON.stringify({ from: 'agent_review', to: 'changes_requested' }), now);

      const updated = db.prepare('SELECT * FROM stories WHERE id = ?').get(params.story_id) as Story;
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
    }
  );
}
