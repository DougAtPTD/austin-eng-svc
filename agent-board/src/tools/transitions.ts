import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../db/connection.js';
import { isValidTransition, canUseRole, STORY_STATES } from '../constants.js';
import type { Role, Story, StoryState } from '../types.js';

export function registerTransitionTools(server: McpServer, role: Role): void {
  server.tool(
    'board_transition_story',
    'Move a story to a new state. Validates the transition is legal.',
    {
      story_id: z.string().describe('Story ID'),
      to_state: z.enum(STORY_STATES as [string, ...string[]]).describe('Target state'),
      comment: z.string().optional().describe('Optional comment explaining the transition'),
    },
    async (params) => {
      const db = getDb();
      const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(params.story_id) as Story | undefined;
      if (!story) {
        return { content: [{ type: 'text', text: `Error: Story "${params.story_id}" not found.` }], isError: true };
      }

      const toState = params.to_state as StoryState;
      if (!isValidTransition(story.state, toState)) {
        return {
          content: [{ type: 'text', text: `Error: Invalid transition from "${story.state}" to "${toState}". Valid targets: ${JSON.stringify(isValidTransition)}` }],
          isError: true,
        };
      }

      const now = new Date().toISOString();
      const completedAt = toState === 'done' ? now : null;

      db.prepare(`
        UPDATE stories SET state = ?, updated_at = ?, completed_at = COALESCE(?, completed_at)
        WHERE id = ?
      `).run(toState, now, completedAt, params.story_id);

      const logId = `log_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO activity_log (id, story_id, actor, action, details, created_at)
        VALUES (?, ?, ?, 'state_change', ?, ?)
      `).run(logId, params.story_id, role, JSON.stringify({ from: story.state, to: toState }), now);

      if (params.comment) {
        const commentId = `cmt_${nanoid(8)}`;
        db.prepare(`
          INSERT INTO comments (id, story_id, author, content, comment_type, created_at)
          VALUES (?, ?, ?, ?, 'status_change', ?)
        `).run(commentId, params.story_id, role, params.comment, now);
      }

      const updated = db.prepare('SELECT * FROM stories WHERE id = ?').get(params.story_id) as Story;
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    'board_assign_story',
    'Assign or unassign a story to a role. PM only.',
    {
      story_id: z.string().describe('Story ID'),
      assign_to: z.enum(['pm', 'dev']).nullable().describe('Role to assign to, or null to unassign'),
    },
    async (params) => {
      if (!canUseRole('board_assign_story', role)) {
        return { content: [{ type: 'text', text: `Error: Role "${role}" cannot assign stories. Only PM can.` }], isError: true };
      }
      const db = getDb();
      const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(params.story_id) as Story | undefined;
      if (!story) {
        return { content: [{ type: 'text', text: `Error: Story "${params.story_id}" not found.` }], isError: true };
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE stories SET assigned_to = ?, updated_at = ? WHERE id = ?')
        .run(params.assign_to, now, params.story_id);

      const logId = `log_${nanoid(8)}`;
      db.prepare(`
        INSERT INTO activity_log (id, story_id, actor, action, details, created_at)
        VALUES (?, ?, ?, 'assigned', ?, ?)
      `).run(logId, params.story_id, role, JSON.stringify({ assigned_to: params.assign_to }), now);

      const updated = db.prepare('SELECT * FROM stories WHERE id = ?').get(params.story_id) as Story;
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
    }
  );
}
