#!/bin/bash
# Seed the board with sample stories for testing
# Uses the MCP server process to create stories via JSON-RPC
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER="$SCRIPT_DIR/../dist/index.js"

if [ ! -f "$SERVER" ]; then
  echo "Error: Server not built. Run 'npm run build' first."
  exit 1
fi

echo "Seeding board with sample stories..."

AGENT_BOARD_ROLE=pm node "$SERVER" <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"seed","version":"1.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"board_create_story","arguments":{"title":"Add user authentication","description":"Implement login/signup flow for the application","technical_spec":"Use JWT tokens with bcrypt password hashing. Store refresh tokens in httpOnly cookies.","acceptance_criteria":"- [ ] Users can sign up with email/password\n- [ ] Users can log in and receive a JWT\n- [ ] Passwords are hashed with bcrypt\n- [ ] JWT tokens expire after 1 hour","priority":"high"}}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"board_create_story","arguments":{"title":"Create API rate limiter","description":"Add rate limiting middleware to prevent API abuse","technical_spec":"Use a sliding window algorithm. Store counters in memory (Map) with cleanup interval.","acceptance_criteria":"- [ ] Rate limit enforced per IP address\n- [ ] Returns 429 status when exceeded\n- [ ] Configurable limits per endpoint\n- [ ] Includes Retry-After header","priority":"medium"}}}
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"board_create_story","arguments":{"title":"Fix mobile navigation overlap","description":"Navigation menu overlaps page content on small screens","technical_spec":"Use CSS Flexbox to fix the layout. Add hamburger menu for screens < 768px.","acceptance_criteria":"- [ ] Menu does not overlap content on screens < 768px\n- [ ] Hamburger icon toggles menu visibility\n- [ ] Menu is keyboard accessible","priority":"critical"}}}
EOF

echo ""
echo "Done! 3 sample stories created in backlog."
echo "Use board_transition_story to move them to 'todo' when ready."
