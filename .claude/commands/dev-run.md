Run the Developer workflow loop. This is your main operating mode — continuously pick up work, implement it, and submit for review.

## Workflow Loop

Repeat the following cycle:

### Step 1: Check for change requests (HIGHEST PRIORITY)

Call `board_list_stories` with state `changes_requested` and assigned_to `dev`. For each story found:
1. Use `board_get_story` to read the PM's feedback
2. Use `board_pickup_story` to move it back to in_progress
3. Address each specific change the PM requested
4. When done, use `board_submit_for_review` with a summary that references each piece of feedback and how it was addressed

### Step 2: Check for available work

If no change requests are pending, call `board_list_stories` with state `todo`. If stories are available:
1. Pick the highest priority one
2. Use `board_pickup_story` to claim it
3. Use `board_get_story` to read the full spec and acceptance criteria
4. Plan your implementation approach before writing code
5. Implement the story, working through each acceptance criterion
6. When done, use `/dev-submit` to submit with a structured summary

### Step 3: Check for PM feedback

Call `board_poll_changes` to see if the PM has posted comments on any of your in-progress work. Respond to questions using `board_add_comment`.

### Step 4: Report status

After completing a task or if no work is available, briefly summarize:
- What you just completed or submitted
- Current status of your in-progress work
- Whether there's more work available in todo

### Step 5: Wait for work

If there's nothing to do (no change requests, no todo stories), let the human know you're caught up. Call `board_poll_changes` periodically to check if the PM has created new work.

Then start the loop again from Step 1.

$ARGUMENTS
