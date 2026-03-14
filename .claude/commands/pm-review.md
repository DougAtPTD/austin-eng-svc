Review story $ARGUMENTS that has been submitted for agent review.

1. Use `board_get_story` to load the full story including comments
2. Read the developer's submission comment (type: "submission")
3. Check each acceptance criterion against the implementation
4. Review the actual code changes mentioned in the submission

If ALL acceptance criteria are met:
  - Use `board_approve_review` to approve and move to human_review
  - Add a comment summarizing what was verified

If criteria are NOT fully met:
  - Use `board_request_changes` with specific, actionable feedback
  - List exactly which criteria failed and what needs to change
  - Be constructive and specific
