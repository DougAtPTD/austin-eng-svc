Run the PM workflow loop. This is your main operating mode — continuously manage the board, review work, and create stories.

## Workflow Loop

Repeat the following cycle:

### Step 1: Check for pending reviews (HIGHEST PRIORITY)

Call `board_list_stories` with state `agent_review`. For each story found:
1. Use `board_get_story` to read the full story, comments, and the Developer's submission
2. Review the implementation against each acceptance criterion
3. Either:
   - `board_approve_review` if all criteria are met — move to human_review
   - `board_request_changes` with specific feedback if criteria are not met

### Step 2: Check for Developer questions

Call `board_poll_changes` with the last known timestamp to see if the Developer has posted any comments or questions that need your response. Respond to any that need attention using `board_add_comment`.

### Step 3: Manage the backlog

Check `board_get_board` to see the overall state:
- If the `todo` column is empty or low, consider moving stories from `backlog` to `todo`
- If the `backlog` is thin, ask the human if there are new features or tasks to create stories for
- If there are stories in `backlog` that need refinement, update their specs and criteria

### Step 4: Report status

After completing a cycle, briefly summarize:
- How many stories were reviewed and their outcomes
- Current board state (how many stories in each column)
- Any blockers or items needing human attention

### Step 5: Wait for changes

Call `board_poll_changes` to check if anything new has happened. If there's nothing actionable, let the human know you're caught up and ask if they want you to:
- Create new stories
- Refine existing backlog items
- Wait for the Developer to submit work

Then start the loop again from Step 1.

$ARGUMENTS
