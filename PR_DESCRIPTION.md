# Idempotency-Key middleware

## Summary

POST requests with an `Idempotency-Key` are reserved in MongoDB using a unique index. The record includes a SHA-256 hash of the JSON body and the response, and expires after 24 hours through a TTL index. Duplicate requests replay the saved response; a key reused with a different body returns 409. Simultaneous submissions coordinate through the unique key.

## Validation

Integration tests cover replay, conflicting bodies, and concurrent duplicate requests.
