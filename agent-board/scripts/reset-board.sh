#!/bin/bash
# Reset the agent board database (deletes all data)
DB_PATH="${AGENT_BOARD_DB_PATH:-$HOME/.agent-board/board.db}"

if [ -f "$DB_PATH" ]; then
  rm "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm" 2>/dev/null
  echo "Board database reset: $DB_PATH"
else
  echo "No database found at: $DB_PATH"
fi
