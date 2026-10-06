# Administrator-only collection review

Collection review, candidate previews/imports/decisions/undo, structural operations,
conflicts and audit history are protected on the server and in the interface.
The music graph, catalogue and sourced published facts remain separate.

## Identity and authorization

This hosted Worker is supported only behind Sites dispatch. Dispatch performs
ChatGPT sign-in and supplies the Site-scoped `oai-authenticated-user-id`.
`SITE_REVIEW_ADMIN_USER_IDS` is a server-only JSON array of explicitly verified
Site-scoped IDs. `SITE_REVIEW_MODE=owner-private` enables this policy but does not
make an arbitrary signed-in visitor an administrator. Missing, malformed or empty
configuration denies all collection-review access. There is no first-visitor
registration, default password, client role flag or email-based authorization.
The Sites service credential alone is insufficient for review.

Keep the Site owner-private. Do not assume a Sites account_user_id is the
Site-scoped identity: the values have different semantics. Do not embed the
allowlist in public JavaScript or add a raw/direct Worker origin that permits
caller-supplied identity headers. Local serving strips caller identity headers.
`LOCAL_REVIEW=1` enables a loopback-only development fixture and is not a
production login mechanism. The separately maintained Linux deployment has its
own authentication and must not be replaced with this platform-specific policy.

## Initial binding

1. Verify in Sites access settings that the Site is owner-private.
2. The owner signs in with their own ChatGPT account and opens Collection review.
3. While no administrator ID is configured, the protected screen displays only
   the signed-in visitor's own non-secret Current account ID (当前账户识别码).
   `/api/review-session` returns that value only for this setup state, no email,
   no tokens and no list of administrators or other users.
4. Verify the owner supplied that exact ID; do not auto-enroll an arbitrary first
   visitor. Set the server runtime `SITE_REVIEW_ADMIN_USER_IDS` to a JSON array
   containing that ID, then deploy through Sites. This configuration is a security
   change and needs the applicable explicit authorization.
5. Verify the actual owner browser can enter review; non-admin and service-only
   access must still be denied. Preserve Site sharing.

Until binding is complete, review is intentionally unavailable to everyone.
The interface offers platform-owned top-level sign-in/sign-out links. The app
never requests a password, creates credentials or implements its own session.

## Security behavior

- All methods under `/api/review` and `/api/operations`, including unknown
  subpaths, are authorized before database work, seed import or body processing.
- Missing/non-admin identity returns a no-store 403 with no review records.
- Administrator mutations still require POST, exact configured Origin,
  same-origin Sec-Fetch-Site when supplied, JSON content type, and the existing
  body-size, version, graph-token and atomic concurrency checks. No cross-origin
  CORS permission is supplied. Existing Origin plus non-simple JSON requests
  provide CSRF defense within the platform-managed browser session.
- Auth checks and protected responses use no-store. On 401/403, the UI clears
  queues, histories, previews, decisions and drafts, and invalidates late results.
  Entering review and restoring a background/bfcache page rechecks identity before
  displaying cached review data.
- Public graph responses omit administrative operation conflict diagnostics.

`npm run build && npm test` runs the full existing suite plus the authorization
matrix and administrator UI tests. These tests use isolated fixture databases;
they never approve, reject, undo or import a real production review operation.
