# Agent Board Coordination

This project uses a local MCP-based board (`agent-board`) for coordinating work between a PM agent and a Developer agent.

## Project

This board is configured for project **austin-eng-svc**. The project name is set in `.mcp.json` via `AGENT_BOARD_PROJECT`. Each project you work on gets its own `.mcp.json` with its project name, and all stories/activity are scoped to that project automatically. The same shared database supports multiple projects.

## Your Role

Check the `AGENT_BOARD_ROLE` environment variable to determine your role:
- `pm` — Product Manager: creates stories, reviews work, manages the backlog
- `dev` — Developer: picks up stories, implements code, submits for review
- `human` — Observer: can view and manage everything

## Board Workflow

Stories flow through these states:

```
Backlog → Todo → In Progress → Agent Review → Human Review → Done
                      ↑              ↓
                      └── Changes Requested
```

## For the PM Agent

- Create stories with clear technical specs and acceptance criteria using `/pm-create-story`
- After creating a story, transition it to `todo` when it's ready for development
- Regularly check for stories in `agent_review` using `board_poll_changes`
- Use `/pm-review` to review submitted work against acceptance criteria
- Approve stories that meet ALL acceptance criteria
- Request specific, actionable changes when criteria aren't fully met

## For the Developer Agent

- Use `/dev-pickup` to find and claim available work
- Prioritize `changes_requested` stories over new `todo` stories
- Work on one story at a time
- Use `/dev-submit` when implementation is complete
- Address change requests promptly and specifically
- Check `board_poll_changes` regularly for new work or feedback

## Polling Cadence

Before starting any new action, call `board_poll_changes` with your last known timestamp to check if the other agent has done anything relevant. This is how you stay aware of each other's work.
