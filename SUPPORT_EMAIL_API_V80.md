# Spaces Support Email API — V80

POST /v1/support/email

Server requirements: authenticate the Support agent, require Support/Staff/Founder authorization, resolve the ticket/user recipient where possible, ignore client From/Reply-To values, allow only approved template IDs, validate variables, validate image URLs, rate-limit sends, log an audit event, and return a non-sensitive delivery status.
