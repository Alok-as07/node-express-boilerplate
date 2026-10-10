# Refresh token reuse detection

## Summary

Refresh tokens now carry a family identifier from login through every rotation. A refresh atomically marks its token as used and blacklisted before issuing replacements. A replay of a used token revokes all tokens in that family and returns 401.

## Trade-offs

Keeping spent-token records uses more database space than deleting them, but provides the evidence needed to detect replay and revoke the compromised session family. An atomic conditional update ensures only one concurrent refresh can claim a token.

## Validation

Tests cover a normal rotation, replay revocation, and two parallel refreshes where only one request succeeds.
