# Agent Board

A local MCP server for coordinating work between two Claude Code agents — a **Product Manager** and a **Developer** — running on the same machine. Replaces GitHub Issues and Project Boards with a faster, fully local workflow.

## How It Works

Both Claude Code sessions connect to the same MCP server, which reads and writes a shared SQLite database. The PM creates stories with specs and acceptance criteria, the Developer picks them up and implements them, and they coordinate through a structured review cycle — all without touching GitHub.

```
 PM Claude Code Session              Developer Claude Code Session
 ┌─────────────────────┐             ┌─────────────────────────┐
 │ Role: pm             │             │ Role: dev               │
 │ Skills: /pm-*        │             │ Skills: /dev-*          │
 └──────┬──────────────┘             └──────┬──────────────────┘
        │ stdio                              │ stdio
        ▼                                    ▼
 board-server (process A)            board-server (process B)
 role=pm (enforced)                  role=dev (enforced)
        │                                    │
        └──────────┬─────────────────────────┘
                   ▼
            ~/.agent-board/board.db  (SQLite, WAL mode)
```

Each agent spawns its own server process. SQLite WAL mode handles concurrent access safely. Role permissions are enforced server-side — the PM can't pick up stories, the Developer can't approve reviews.

## Quick Start

### 1. Build the server

```bash
cd agent-board
npm install
npm run build
```

### 2. Configure your project

Copy the `.mcp.json` from this repo into any project you want to coordinate on. Edit the `AGENT_BOARD_PROJECT` value to match your project name, and update the path to the server:

```json
{
  "mcpServers": {
    "agent-board": {
      "command": "node",
      "args": ["/absolute/path/to/agent-board/dist/index.js"],
      "env": {
        "AGENT_BOARD_ROLE": "${AGENT_BOARD_ROLE}",
        "AGENT_BOARD_PROJECT": "my-project-name"
      }
    }
  }
}
```

Also copy the `.claude/` directory (commands and settings) and `CLAUDE.md` into your project root. These give each agent its slash commands, hooks, and role-aware instructions.

### 3. Launch the agents

Open two terminals in your project directory:

```bash
# Terminal 1: Product Manager
AGENT_BOARD_ROLE=pm claude

# Terminal 2: Developer
AGENT_BOARD_ROLE=dev claude
```

Optionally, open a third terminal to observe as a human:

```bash
# Terminal 3: Human observer (can do everything)
AGENT_BOARD_ROLE=human claude
```

That's it. The PM can start creating stories with `/pm-create-story`, and the Developer can pick them up with `/dev-pickup`.

## Workflow

Stories move through seven states:

```
Backlog → Todo → In Progress → Agent Review → Human Review → Done
                      ↑               ↓
                      └── Changes Requested
```

### Typical cycle

1. **PM** creates a story with `/pm-create-story "Add user auth"` — writes description, tech spec, acceptance criteria
2. **PM** moves it to `todo` when ready for development
3. **Dev** runs `/dev-pickup` — finds the highest priority available story, moves it to `in_progress`
4. **Dev** implements the code
5. **Dev** runs `/dev-submit <story_id>` — writes a summary of what was done, moves to `agent_review`
6. **PM** runs `/pm-review <story_id>` — checks acceptance criteria against the implementation
7. **PM** either approves (moves to `human_review`) or requests changes (moves to `changes_requested`)
8. If changes requested, **Dev** addresses them and resubmits (back to step 5)
9. **Human** does final review and marks as `done`

### State transitions

| From | Valid targets |
|------|--------------|
| `backlog` | `todo` |
| `todo` | `in_progress`, `backlog` |
| `in_progress` | `agent_review`, `todo` |
| `agent_review` | `human_review`, `changes_requested` |
| `changes_requested` | `in_progress` |
| `human_review` | `done`, `changes_requested` |
| `done` | `backlog` (reopen) |

Invalid transitions are rejected by the server.

## Slash Commands

### PM Commands

| Command | Description |
|---------|-------------|
| `/pm-create-story [title]` | Create a story with structured description, tech spec, and acceptance criteria |
| `/pm-review [story_id]` | Review a submitted story against its acceptance criteria |

### Developer Commands

| Command | Description |
|---------|-------------|
| `/dev-pickup` | Find and claim the highest-priority available story |
| `/dev-submit [story_id]` | Submit completed work for PM review with a summary |
| `/dev-status` | Check current board state and find pending work |

## MCP Tools Reference

### Story CRUD

| Tool | Description | Allowed Roles |
|------|-------------|---------------|
| `board_create_story` | Create a new story | PM |
| `board_update_story` | Update story fields (title, description, spec, criteria, priority) | PM |
| `board_delete_story` | Delete a story (only in backlog/done) | PM |
| `board_get_story` | Get a story with all comments and activity | PM, Dev |

**`board_create_story` parameters:**
- `title` (string, required) — Story title
- `description` (string) — Problem statement and summary
- `technical_spec` (string) — Implementation details, files to modify, approach
- `acceptance_criteria` (string) — Markdown checklist of criteria
- `priority` (enum: critical, high, medium, low) — Defaults to medium

### State Transitions

| Tool | Description | Allowed Roles |
|------|-------------|---------------|
| `board_transition_story` | Move a story to a new state (validates transition) | PM, Dev |
| `board_assign_story` | Assign or unassign a story | PM |
| `board_pickup_story` | Assign to dev and move to in_progress | Dev |
| `board_submit_for_review` | Move to agent_review with a submission comment | Dev |

### Review Workflow

| Tool | Description | Allowed Roles |
|------|-------------|---------------|
| `board_approve_review` | Approve and move to human_review | PM |
| `board_request_changes` | Request changes with specific feedback | PM |

### Comments

| Tool | Description | Allowed Roles |
|------|-------------|---------------|
| `board_add_comment` | Add a comment to a story thread | PM, Dev |
| `board_list_comments` | List comments, optionally filtered by timestamp | PM, Dev |

### Board Queries

| Tool | Description | Allowed Roles |
|------|-------------|---------------|
| `board_list_stories` | List stories with filters (state, assignee, priority) | PM, Dev |
| `board_get_board` | Full board view grouped by column | PM, Dev |
| `board_search_stories` | Full-text search across all story fields | PM, Dev |
| `board_get_activity` | Query the activity log | PM, Dev |
| `board_poll_changes` | Poll for changes relevant to your role since a timestamp | PM, Dev |

### Project Management

| Tool | Description | Allowed Roles |
|------|-------------|---------------|
| `board_list_projects` | List all projects with story counts | All |

## Multi-Project Support

The board supports multiple projects simultaneously. Each project directory has its own `.mcp.json` that sets the project name:

```json
{
  "mcpServers": {
    "agent-board": {
      "command": "node",
      "args": ["/path/to/agent-board/dist/index.js"],
      "env": {
        "AGENT_BOARD_ROLE": "${AGENT_BOARD_ROLE}",
        "AGENT_BOARD_PROJECT": "project-name-here"
      }
    }
  }
}
```

All stories, activity, and queries are automatically scoped to the current project. The shared database at `~/.agent-board/board.db` holds data for all projects, but agents only see their project's board.

Use `board_list_projects` to see all projects across the board.

## Hooks

Hooks are configured in `.claude/settings.json` and fire automatically:

- **SessionStart** — Sets `LAST_POLL_TIME` to the current UTC timestamp so agents know when to poll from
- **Stop** — Before an agent goes idle, a prompt hook reminds it to call `board_poll_changes` to check for pending work from the other agent

These ensure agents stay aware of each other's work without manual intervention.

## MCP Resources

Resources can be referenced with `@` in Claude Code prompts:

| URI | Description |
|-----|-------------|
| `board://state` | Full board view with stories grouped by column |
| `board://story/{storyId}` | Single story with all comments and activity |
| `board://stories/{state}` | All stories in a given state |
| `board://my-work/{role}` | Stories relevant to a specific role |
| `board://activity` | Last 50 activity log entries |

## Database

The database lives at `~/.agent-board/board.db` by default. Override with the `AGENT_BOARD_DB_PATH` environment variable.

### Tables

- **projects** — Project registry (id, name)
- **stories** — Stories with title, description, tech spec, acceptance criteria, priority, state, assignment
- **comments** — Discussion thread per story with typed comments (comment, submission, change_request, review_approve, etc.)
- **activity_log** — Audit trail of all actions (state changes, comments, assignments)

### Utility Scripts

```bash
# Reset the database (deletes all data)
./scripts/reset-board.sh

# Seed with sample stories for testing
./scripts/seed-board.sh
```

## Role Permissions

The server enforces role-based access. The `human` role can do everything.

| Tool | PM | Dev | Human |
|------|:--:|:---:|:-----:|
| Create/update/delete stories | Y | - | Y |
| Assign stories | Y | - | Y |
| Pick up stories | - | Y | Y |
| Submit for review | - | Y | Y |
| Approve/request changes | Y | - | Y |
| Comment, query, poll | Y | Y | Y |

## Configuration Reference

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_BOARD_ROLE` | Agent role: `pm`, `dev`, or `human` | `human` |
| `AGENT_BOARD_PROJECT` | Project identifier | basename of cwd |
| `AGENT_BOARD_DB_PATH` | Path to SQLite database | `~/.agent-board/board.db` |

### File Layout

To set up a new project with agent-board coordination, copy these files into the project root:

```
your-project/
├── .mcp.json                  # MCP server config (set AGENT_BOARD_PROJECT)
├── CLAUDE.md                  # Role-aware instructions for both agents
└── .claude/
    ├── settings.json          # SessionStart + Stop hooks
    └── commands/
        ├── pm-create-story.md # /pm-create-story slash command
        ├── pm-review.md       # /pm-review slash command
        ├── dev-pickup.md      # /dev-pickup slash command
        ├── dev-submit.md      # /dev-submit slash command
        └── dev-status.md      # /dev-status slash command
```

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build

# Run directly
AGENT_BOARD_ROLE=pm AGENT_BOARD_PROJECT=test node dist/index.js
```

The server communicates over stdio using the MCP JSON-RPC protocol. Each Claude Code session spawns its own process — there's no long-running daemon to manage.
