# Leaderboard data requirements

TinMaster currently has no persistent Supabase exam-attempt table or trusted
leaderboard query. Exam history is stored in the browser under
`tinmaster_student_exam_history_v1`; those records are useful to the same
browser for personal history, but are not shared, identity-verified, or safe to
use for public rankings. The leaderboard therefore stays empty until a
server-verified source of results is implemented.

## Requirements before publishing rankings

1. Add a Supabase exam-attempt table keyed by an immutable attempt UUID, with
   `user_id` referencing `auth.users(id)`, exam identifier, validated score and
   maximum score, completion timestamp, and the minimum result fields needed
   for review. Do not accept a client-supplied user ID or rank.
2. Submit answers to a trusted server-side grader that uses the canonical exam
   and answer key. The current client-side scoring flow cannot establish that a
   browser-submitted score or answer result is genuine. Keep the existing
   scoring rules unchanged while moving authoritative validation into that
   trusted boundary.
3. Make completion idempotent: require a server-issued attempt identifier and
   enforce a unique constraint so retries cannot create duplicate results.
   Validate that the attempt belongs to the authenticated user, the exam is
   valid, the attempt is complete, and the computed score is within the exam's
   allowed range.
4. Enable RLS. Deny direct client inserts or updates to authoritative score
   fields. Permit users to read only their own detailed attempts. Expose
   leaderboard rows through a narrowly scoped authenticated RPC or server
   endpoint that derives the user from the verified Supabase JWT and returns
   only approved profile display fields and aggregates.
5. Compute aggregate scores and ranks from validated attempt rows in the
   database or trusted server code, with deterministic tie-breaking. Never
   accept ranks, totals, accuracy, streaks, or profile identity as authority
   from the browser. Apply pagination and any public-display privacy choices
   in that trusted query.
6. Add tests for user isolation, role/identity enforcement, score validation,
   duplicate attempt rejection, completed-only ranking, and tie ordering
   before connecting the UI to the query.

Existing browser exam history is not deleted or uploaded by this change.
Legacy records remain available to the local exam-history view, but must not
be treated as verified shared leaderboard results.
