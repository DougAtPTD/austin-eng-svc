import type { StoryState, Role } from './types.js';

export const VALID_TRANSITIONS: Record<StoryState, StoryState[]> = {
  backlog: ['todo'],
  todo: ['in_progress', 'backlog'],
  in_progress: ['agent_review', 'todo'],
  agent_review: ['changes_requested', 'human_review'],
  changes_requested: ['in_progress'],
  human_review: ['done', 'changes_requested'],
  done: ['backlog'],
};

export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

export const STORY_STATES: StoryState[] = [
  'backlog', 'todo', 'in_progress', 'agent_review',
  'changes_requested', 'human_review', 'done',
];

// Role-based tool permissions
// Tools not listed here are available to all roles
export const TOOL_PERMISSIONS: Record<string, Role[]> = {
  board_create_story: ['pm'],
  board_update_story: ['pm'],
  board_delete_story: ['pm'],
  board_assign_story: ['pm'],
  board_pickup_story: ['dev'],
  board_submit_for_review: ['dev'],
  board_approve_review: ['pm'],
  board_request_changes: ['pm'],
};

export function canUseRole(tool: string, role: Role): boolean {
  if (role === 'human') return true; // human can do everything
  const allowed = TOOL_PERMISSIONS[tool];
  if (!allowed) return true; // no restriction
  return allowed.includes(role);
}

export function isValidTransition(from: StoryState, to: StoryState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
