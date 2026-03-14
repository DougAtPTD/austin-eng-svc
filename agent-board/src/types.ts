export type Role = 'pm' | 'dev' | 'human';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type StoryState =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'agent_review'
  | 'changes_requested'
  | 'human_review'
  | 'done';

export type CommentType =
  | 'comment'
  | 'review_approve'
  | 'review_reject'
  | 'change_request'
  | 'submission'
  | 'status_change';

export interface Story {
  id: string;
  title: string;
  description: string;
  technical_spec: string;
  acceptance_criteria: string;
  priority: Priority;
  state: StoryState;
  assigned_to: Role | null;
  created_by: Role;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Comment {
  id: string;
  story_id: string;
  author: Role | 'system';
  content: string;
  comment_type: CommentType;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  story_id: string | null;
  actor: Role | 'system';
  action: string;
  details: string;
  created_at: string;
}
