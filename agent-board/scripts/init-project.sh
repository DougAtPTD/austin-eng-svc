#!/bin/bash
# Initialize or add agent-board coordination to a project directory.
# Safe to run on existing projects — appends to CLAUDE.md and merges hooks.
#
# Usage:
#   /path/to/agent-board/scripts/init-project.sh [project-name] [target-dir]
#
# If project-name is omitted, uses the target directory's basename.
# If target-dir is omitted, uses the current directory.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_BOARD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_DIR="${2:-.}"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
PROJECT_NAME="${1:-$(basename "$TARGET_DIR")}"

echo "Initializing agent-board for project: $PROJECT_NAME"
echo "Target directory: $TARGET_DIR"
echo "Agent board server: $AGENT_BOARD_DIR/dist/index.js"
echo ""

# Check that the server is built
if [ ! -f "$AGENT_BOARD_DIR/dist/index.js" ]; then
  echo "Error: Agent board server not built. Run 'npm run build' in $AGENT_BOARD_DIR first."
  exit 1
fi

# --- .mcp.json ---
# Create or update. If it exists, add the agent-board server entry.
if [ -f "$TARGET_DIR/.mcp.json" ]; then
  if grep -q "agent-board" "$TARGET_DIR/.mcp.json" 2>/dev/null; then
    echo ".mcp.json already has agent-board configured — skipping"
  else
    # Merge: add agent-board to existing mcpServers
    python3 -c "
import json, sys
with open('$TARGET_DIR/.mcp.json') as f:
    config = json.load(f)
config.setdefault('mcpServers', {})['agent-board'] = {
    'command': 'node',
    'args': ['$AGENT_BOARD_DIR/dist/index.js'],
    'env': {
        'AGENT_BOARD_ROLE': '\${AGENT_BOARD_ROLE}',
        'AGENT_BOARD_PROJECT': '$PROJECT_NAME'
    }
}
with open('$TARGET_DIR/.mcp.json', 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')
" 2>/dev/null && echo "Updated .mcp.json — added agent-board server" || {
      echo "Warning: Could not merge .mcp.json automatically. Creating fresh."
      cat > "$TARGET_DIR/.mcp.json" <<MCPEOF
{
  "mcpServers": {
    "agent-board": {
      "command": "node",
      "args": ["$AGENT_BOARD_DIR/dist/index.js"],
      "env": {
        "AGENT_BOARD_ROLE": "\${AGENT_BOARD_ROLE}",
        "AGENT_BOARD_PROJECT": "$PROJECT_NAME"
      }
    }
  }
}
MCPEOF
      echo "Created .mcp.json"
    }
  fi
else
  cat > "$TARGET_DIR/.mcp.json" <<MCPEOF
{
  "mcpServers": {
    "agent-board": {
      "command": "node",
      "args": ["$AGENT_BOARD_DIR/dist/index.js"],
      "env": {
        "AGENT_BOARD_ROLE": "\${AGENT_BOARD_ROLE}",
        "AGENT_BOARD_PROJECT": "$PROJECT_NAME"
      }
    }
  }
}
MCPEOF
  echo "Created .mcp.json"
fi

# --- CLAUDE.md ---
# Append the board coordination section if not already present.
BOARD_MARKER="# Agent Board Coordination"

if [ -f "$TARGET_DIR/CLAUDE.md" ]; then
  if grep -q "$BOARD_MARKER" "$TARGET_DIR/CLAUDE.md" 2>/dev/null; then
    echo "CLAUDE.md already has board coordination section — skipping"
  else
    cat >> "$TARGET_DIR/CLAUDE.md" <<'CLAUDEEOF'

---

# Agent Board Coordination

This project uses a local MCP-based board (`agent-board`) for coordinating work between a PM agent and a Developer agent.

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

- Run `/pm-start` to get your full role briefing
- Run `/pm-run` to enter your main workflow loop
- Use `/pm-create-story` to create individual stories
- Use `/pm-review` to review individual submissions

## For the Developer Agent

- Run `/dev-start` to get your full role briefing
- Run `/dev-run` to enter your main workflow loop
- Use `/dev-pickup` to pick up individual stories
- Use `/dev-submit` to submit individual pieces of work

## Polling Cadence

Before starting any new action, call `board_poll_changes` with your last known timestamp to check if the other agent has done anything relevant.
CLAUDEEOF
    echo "Appended board coordination section to existing CLAUDE.md"
  fi
else
  cat > "$TARGET_DIR/CLAUDE.md" <<'CLAUDEEOF'
# Agent Board Coordination

This project uses a local MCP-based board (`agent-board`) for coordinating work between a PM agent and a Developer agent.

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

- Run `/pm-start` to get your full role briefing
- Run `/pm-run` to enter your main workflow loop
- Use `/pm-create-story` to create individual stories
- Use `/pm-review` to review individual submissions

## For the Developer Agent

- Run `/dev-start` to get your full role briefing
- Run `/dev-run` to enter your main workflow loop
- Use `/dev-pickup` to pick up individual stories
- Use `/dev-submit` to submit individual pieces of work

## Polling Cadence

Before starting any new action, call `board_poll_changes` with your last known timestamp to check if the other agent has done anything relevant.
CLAUDEEOF
  echo "Created CLAUDE.md"
fi

# --- .claude directory ---
mkdir -p "$TARGET_DIR/.claude/commands"

# --- .claude/settings.json ---
# Merge hooks if settings.json already exists.
if [ -f "$TARGET_DIR/.claude/settings.json" ]; then
  if grep -q "LAST_POLL_TIME" "$TARGET_DIR/.claude/settings.json" 2>/dev/null; then
    echo ".claude/settings.json already has board hooks — skipping"
  else
    python3 -c "
import json
with open('$TARGET_DIR/.claude/settings.json') as f:
    config = json.load(f)

hooks = config.setdefault('hooks', {})

# Add SessionStart hook
ss = hooks.setdefault('SessionStart', [])
ss.append({
    'hooks': [{
        'type': 'command',
        'command': \"echo '{\\\"environmentVariables\\\": {\\\"LAST_POLL_TIME\\\": \\\"'\$(date -u +%Y-%m-%dT%H:%M:%SZ)'\\\"}}'\"
    }]
})

# Add Stop hook
stop = hooks.setdefault('Stop', [])
stop.append({
    'hooks': [{
        'type': 'prompt',
        'prompt': 'Before stopping, check board_poll_changes for any new work or feedback from the other agent since \$LAST_POLL_TIME. If there is actionable work (new story to review, change requests, etc.), describe it and ask the user if they want to handle it now. Otherwise, confirm there is nothing pending.',
        'timeout': 30
    }]
})

with open('$TARGET_DIR/.claude/settings.json', 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')
" 2>/dev/null && echo "Merged board hooks into existing .claude/settings.json" || {
      echo "Warning: Could not merge settings.json. Board hooks not added."
      echo "You may need to manually add SessionStart and Stop hooks."
    }
  fi
else
  cat > "$TARGET_DIR/.claude/settings.json" <<'SETTINGSEOF'
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"environmentVariables\": {\"LAST_POLL_TIME\": \"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'\"}}'"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Before stopping, check board_poll_changes for any new work or feedback from the other agent since $LAST_POLL_TIME. If there is actionable work (new story to review, change requests, etc.), describe it and ask the user if they want to handle it now. Otherwise, confirm there is nothing pending.",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
SETTINGSEOF
  echo "Created .claude/settings.json"
fi

# --- Slash commands ---
# Always copy/overwrite command files (they're agent-board specific)
for cmd in pm-start pm-run pm-create-story pm-review dev-start dev-run dev-pickup dev-submit dev-status; do
  SRC="$AGENT_BOARD_DIR/../.claude/commands/$cmd.md"
  if [ -f "$SRC" ]; then
    cp "$SRC" "$TARGET_DIR/.claude/commands/$cmd.md"
    echo "Installed .claude/commands/$cmd.md"
  else
    echo "Warning: $SRC not found — skipping"
  fi
done

echo ""
echo "Done! Project '$PROJECT_NAME' is ready for agent-board coordination."
echo ""
echo "To start:"
echo "  Terminal 1:  cd $TARGET_DIR && AGENT_BOARD_ROLE=pm claude"
echo "  Terminal 2:  cd $TARGET_DIR && AGENT_BOARD_ROLE=dev claude"
echo ""
echo "Then in each session:"
echo "  PM:   /pm-start    (role briefing)  then  /pm-run   (workflow loop)"
echo "  Dev:  /dev-start   (role briefing)  then  /dev-run  (workflow loop)"
