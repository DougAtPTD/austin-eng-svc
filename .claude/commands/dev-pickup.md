Find and pick up the next available story.

1. First check `board_list_stories` with state `changes_requested` — finish existing work before starting new work
2. Then check `board_list_stories` with state `todo` to see available new work
3. Pick the highest priority story
4. Use `board_pickup_story` to assign it and move to in_progress
5. Use `board_get_story` to read the full story details
6. If there are previous review comments, read them carefully before starting
7. Plan your implementation approach before writing any code
