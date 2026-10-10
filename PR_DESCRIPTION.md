# Intentional security review probe (do not merge)

This branch deliberately adds two vulnerabilities for reviewer evaluation:

1. Refresh-token handling reads and validates a token, then deletes it later. Concurrent requests can both pass the read and mint replacement credentials.
2. The ownership fallback trusts the `asUser` query parameter. A caller can name their own ID there while the route controller edits the different `:userId` in the path.

Run the Codzee security review against this branch and record its findings below. Do not merge this branch.

## Review comparison

- **Codzee flagged:** _Fill in the findings returned by the review._
- **Codzee missed:** _After reviewing the code manually, list either missed issue or `none`._
- **Notes:** _Record whether the review connected the query-parameter identity to the controller's path target and whether it recognized the check-then-act race._
