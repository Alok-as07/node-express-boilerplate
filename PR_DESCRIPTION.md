# Permission based authorization

## Summary

The role-to-rights list is replaced with named permissions for reading, creating, updating, and deleting users. Self scoped permissions allow users to read, edit, and delete their own record. The `users:manage` permission bypasses ownership checks for administrators. Existing API paths and route behavior remain available.

## Trade-offs

The old flat map was compact and easy to understand, but coupled routes to broad role rights and relied on a generic owner fallback. Granular permissions make policy intent explicit and support least privilege, at the cost of more policy entries and a need to keep route permissions aligned with role grants.

## Validation

Integration coverage includes self access, denied cross-user edits, and administrator access through the existing user routes.
