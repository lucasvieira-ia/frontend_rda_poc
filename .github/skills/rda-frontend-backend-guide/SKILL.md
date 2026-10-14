---
name: rda-frontend-backend-guide
description: "Explain this RDA Review repository and guide frontend/backend integration. Use when exploring the app architecture, connecting Angular to FastAPI, implementing document upload or review APIs, or planning the mock-to-production RAG workflow."
argument-hint: "Ask about the repository, an API integration task, or a backend migration."
---

# RDA Review: Repository and Integration Guide

Use this skill to explain the current project from its source and to make grounded recommendations for connecting the Angular UI to its Python API. Treat the repository as the source of truth: inspect files before implementing because this guide can become stale as the project changes.

## Repository at a glance

- This workspace contains the `frontend_rda_poc` project directory. Run project commands from that directory, not its parent.
- The frontend is an Angular 22 standalone application using TypeScript, SCSS, Angular signals, and `HttpClient`.
- The backend is a small FastAPI app in `backend/main.py`.
- The backend is currently a mock ingestion API. It accepts the files and returns metadata; it does not store documents, extract text, create embeddings, run retrieval, or persist review state.
- `README.md` documents setup, local run commands, the upload flow, and the mock API limitations. Re-check it and the dependency manifests for current commands and versions.

## Important files

- `src/app/app.ts`: queue and upload UI state, in-memory `File` handling, object URL cleanup, and the current HTTP request.
- `src/app/app.html` and `src/app/app.scss`: application markup and styling.
- `src/app/app.config.ts`: application-level providers, including `provideHttpClient()`.
- `src/app/app.spec.ts`: UI and HTTP tests, including the multipart upload contract.
- `src/app/features/document-analysis/`: a feature area scaffold; inspect its contents before assuming it owns the live upload flow.
- `backend/main.py`: health check, CORS configuration, upload size/non-empty checks, and mock ingest response.
- `backend/requirements.txt`: Python API dependencies.
- `package.json`: Angular scripts and frontend dependencies.
- `README.md`: local development workflow and current behavior.

## Current frontend/backend contract

1. The user selects two files in the UI. Angular holds them in browser memory and creates a local review-queue item; this does not upload or persist them yet.
2. Starting a review submits `FormData` with fields `file_1` and `file_2` to `http://localhost:8000/api/reviews/ingest`.
3. FastAPI requires both fields, checks that each file is non-empty and no larger than 20 MiB, then returns a mock submission ID, `accepted` status, `mock_only` processing marker, message, and file metadata.
4. The UI marks the item as sent on any successful HTTP response. Errors are displayed on the queue card. The current submission ID and returned metadata are not used to update a durable review record.
5. FastAPI allows CORS from `http://localhost:4200`; changing the frontend origin requires coordinating this configuration.

Keep request field names and response shapes aligned across both sides. When changing the contract, update the Angular response/request types, FastAPI endpoint, and `app.spec.ts` together.

## Recommended integration direction

### 1. Define the workflow before extending the endpoint

Clarify whether upload should only accept documents or synchronously complete document processing. For a real extraction/embedding/RAG pipeline, prefer accepting an upload quickly, returning a durable submission/job ID, and processing asynchronously. Do not present mock acceptance as completed analysis.

### 2. Give the frontend an API boundary

When the integration grows beyond this prototype, move HTTP calls and API types out of `App` into an Angular service (for example, an ingestion/reviews service under `src/app/core/services/` or the appropriate feature folder). Keep components responsible for UI state and presentation. Inject the configured API base URL rather than hardcoding the localhost endpoint in the component.

Use the repository's established Angular configuration pattern if one exists by then. Keep development and production URLs outside component code, and configure the deployed backend's allowed CORS origins explicitly.

### 3. Make upload and processing states explicit

Represent at least `uploading`, `accepted/queued`, `processing`, `completed`, and `failed` states using the backend contract. Prevent duplicate submissions while in flight, show actionable failures, and distinguish upload success from analysis success. If processing is asynchronous, add a status endpoint keyed by submission ID; choose polling, server-sent events, or WebSockets only after the expected update latency and scale are known.

### 4. Persist and validate on the backend

Replace mock behavior in `backend/main.py` with a deliberate ingestion pipeline: validate allowed file types and request constraints, store/process the contents securely, persist submission status, and return stable IDs and structured errors. Keep secrets and backend credentials on the server. Add authentication/authorization and retention/access controls before handling real or sensitive documents.

Treat browser-side checks as user experience only; enforce all security and size constraints on the server. Ensure limits apply to the entire request as well as each file if needed, and avoid reading an unbounded upload into memory.

### 5. Evolve UI data ownership

The current review queue and selected files are transient browser state. For a production workflow, load review items and status from backend APIs, update local presentation from responses, and make refresh/reconnect behavior recover from persisted backend state. Avoid claiming a submission is durable unless the backend confirms persistence.

### 6. Test both sides of the contract

- Keep Angular HTTP tests using `HttpTestingController` to assert URL, HTTP method, multipart field names, successful responses, loading state, and errors.
- Add backend tests for required files, empty files, size limits, validation failures, and the success response.
- Add integration coverage for the upload-to-job-status lifecycle when asynchronous processing is introduced.
- Update `README.md` whenever endpoints, startup commands, configuration, or behavior change.

## How to work with this repository

When asked to explain the project:

1. Describe the Angular UI and FastAPI API separately.
2. Trace the actual request from the UI handler in `src/app/app.ts` through the endpoint in `backend/main.py`.
3. Clearly label current mock behavior versus proposed production work.
4. Link recommendations to the files that would be changed.

When asked to implement an integration change:

1. Read the current component, template, tests, API implementation, and README relevant to the requested behavior.
2. Confirm the request/response contract and expected user-visible states before editing.
3. Update backend, frontend, and tests as one coherent change; preserve the existing UX unless the request explicitly changes it.
4. Run the narrowest applicable frontend and backend checks available in the repository.
5. Report what is implemented and what remains mock, unconfigured, or dependent on infrastructure.

Do not assume there is a real RAG pipeline, database, authentication system, file storage, job queue, or production deployment configuration unless the repository now contains it.
