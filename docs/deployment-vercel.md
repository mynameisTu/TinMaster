# Vercel deployment

## Local development

Use Node.js and npm, then run:

```sh
npm install
npm run dev
```

The local workflow remains the Express server in `server.ts` and is available at
`http://localhost:3000`. It serves Vite middleware in development and keeps the
existing `/api/*` routes. Set `GEMINI_API_KEY` in an ignored local `.env` file to
enable Gemini. Without it, the existing API fallbacks remain available.

Run `npm run lint`, `npm run build`, and `npm run test:api` before pushing
changes.

## GitHub and Vercel

1. Push the feature branch to the GitHub repository; do not commit `.env` files.
2. In Vercel, import the GitHub repository and keep the repository root as the
   project root.
3. The checked-in `vercel.json` runs `npm run build`, serves `dist`, and rewrites
   unmatched client-side routes to `index.html`. API requests use the shared
   Express handlers in `src/server/api.ts`, exposed through
   `api/[...path].ts`.
4. Add `GEMINI_API_KEY` in Vercel Project Settings → Environment Variables for
   the environments that should serve Gemini requests. It is server-only and
   must not use a `VITE_` prefix.
5. Keep preview deployment variables separate from production values. A GitHub
   pull request can then create a preview deployment without changing the
   production deployment.
6. Document extraction uses `GEMINI_PRIMARY_MODEL` when set, otherwise
   `gemini-3.8-flash`. Set `GEMINI_FALLBACK_MODEL` only after enabling and
   validating the model for the same Gemini API project. For example,
   `gemini-2.5-flash` supports the PDF/image input and JSON output used here.
   The fallback is opt-in because it can incur additional Gemini usage costs.
   `GEMINI_ATTEMPT_TIMEOUT_MS` defaults to 30 seconds per attempt, and
   `GEMINI_EXTRACTION_DEADLINE_MS` defaults to 180 seconds for the extraction
   generation sequence. Keep the latter below the deployed Function timeout.

The client uses same-origin `/api/*` paths. Do not add a hard-coded deployment
URL or expose server secrets through Vite environment variables.

## Preview and production

Preview deployments are produced from non-production Git branches after the
Vercel project is connected to GitHub. Test the preview URL and its configured
environment variables before promoting a deployment. Production deployment
should be enabled only for the chosen production branch and promoted manually
after preview validation. This project has not been deployed by this change.

## Supabase Storage upload prerequisites

**Large document uploads are not yet supported on Vercel.** The upload UI still
sends the file (and optional answer key) as base64 JSON to
`/api/exercises/extract-file`; direct-to-Storage upload has not been implemented.
Local Express keeps its existing 50 MB parser limit. Vercel Functions have a
4.5 MB request/response payload limit, and this app limits Vercel JSON parsing to
4 MB, so larger encoded requests will fail rather than being processed. Do not
use this Vercel endpoint for large documents. The current sign-in UI is not
verified authentication and must not authorize uploads.

Before enabling private direct uploads, configure:

- A Supabase project URL.
- The Supabase anon/publishable key for a future browser Auth client (public,
  but only safe when policies are correctly restricted).
- A **private** bucket, recommended name `exercise-uploads`, with no public
  read policy or anonymous write policy.
- Supabase Auth with a real user session and a defined owner identity.
- A server-only Supabase service-role/secret key in Vercel. Never use it in
  browser code or a `VITE_` variable.
- A short-lived signed-upload endpoint that validates the user's Supabase JWT,
  permitted DOCX/PDF/JPEG/PNG content types, a configured maximum object size,
  and an object path derived from the verified user ID. The service key must
  remain server-side; generated object paths must not be user supplied.

The Vercel upload request must contain only metadata, never the document bytes.
The browser should send the file directly to the signed Supabase Storage upload
URL and then submit an object identifier for processing. Do not make documents
public or treat the current Gmail form, a client-provided user ID, or a filename
as proof of ownership.
See [Supabase upload guidance](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
when choosing the upload method and bucket size limits.

Supabase's standard `createSignedUploadUrl` token currently has a fixed
two-hour validity. If the product requires a shorter upload capability, use a
short-expiry S3-compatible SigV4 presigned PUT instead. Supabase S3 access keys
bypass Storage RLS and grant broad Storage access, so they may only be used by
the server-side signer and must never reach the browser. This choice and its
one-object path/overwrite handling will be implemented with the authenticated
upload flow, not as a public or anonymous upload path.

## Document-processing limitation

The existing extraction handler downloads/holds the document in process memory,
parses DOCX with Mammoth, and sends PDFs/images inline to Gemini. Storage removes
the Vercel ingress-body limit but does not remove the memory, Gemini latency, or
function-duration limits. Vercel's current [Functions limits](https://vercel.com/docs/functions/limitations)
document a 4.5 MB request/response payload limit and a default maximum duration of 300
seconds on Hobby; Pro/Enterprise can configure higher durations. Gemini's
[document guidance](https://ai.google.dev/gemini-api/docs/document-processing)
recommends its Files API for larger PDFs.

Document extraction retries transient Gemini overload/rate-limit failures at
most twice on the primary model with jittered backoff, honors `Retry-After`,
uses a per-attempt timeout, and stops before its overall deadline to preserve
time for an HTTP response. The Google SDK's own retry layer is disabled for
these calls so attempts stay bounded. After primary retries are exhausted, a
configured fallback gets one attempt. A 429 quota/billing exhaustion is
reported separately and is not retried. Cross-model failover runs only after
transient failures and only when `GEMINI_FALLBACK_MODEL` is configured.
The SDK abort signal bounds client-side waiting; cancelling a request cannot
guarantee Gemini has stopped server-side processing or that usage charges are
avoided.

These limits bound Gemini request time, not document parsing or arbitrary
upload sizes. The synchronous path still cannot be represented as reliable for
arbitrary uploaded documents on a Vercel Function. The migration needs an
approved maximum file size and an architecture decision: bounded synchronous
processing for small files, or a separate asynchronous worker for
unrestricted/long-running extraction. This change does not move extraction to
a worker or change upload semantics.

## Troubleshooting

- **Gemini fallback responses:** confirm `GEMINI_API_KEY` is set for the
  deployment environment; do not add it to frontend variables.
- **Function payload too large / HTTP 413:** this is a Vercel request-body
  limit. Use the planned direct-to-private-Storage upload flow; do not increase
  the Vercel function's Express JSON parser limit.
- **API 404:** verify the deployment includes `api/[...path].ts` and that Vercel
  is building from the repository root.
- **Client-side route 404:** verify the SPA rewrite in `vercel.json`.
- **Local port already in use:** `npm run dev` defaults to port 3000 and can
  use `PORT` to select a different local port.
