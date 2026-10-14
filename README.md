# RDA Review

RDA Review is an Angular prototype for uploading an RDA document and a spreadsheet, reviewing the submission in a queue, and sending both files to a mock Python API.

The repository contains:

- **Frontend:** Angular 22, TypeScript, and SCSS.
- **Mock backend:** FastAPI endpoint that accepts two files and returns metadata.

> The mock API does not save uploaded files or run a RAG pipeline. Text extraction, chunking, embeddings, vector storage, and retrieval are not implemented.

## Requirements

- Node.js and npm compatible with Angular CLI 22.
- Python 3.10 or newer.
- A terminal in the repository root (`frontend_rda_poc`).

Check that Node.js, npm, and Python are available:

```bash
node --version
npm --version
python3 --version
```

## Install dependencies

Install the frontend dependencies:

```bash
npm ci
```

Create and activate a Python virtual environment, then install the backend dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

Activate `.venv` again in any new terminal where you run the backend:

```bash
source .venv/bin/activate
```

## Run the project

Run the backend and frontend in separate terminals from the repository root.

### Terminal 1: start the mock API

Activate the virtual environment if it is not already active, then start FastAPI:

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The API provides:

- Health check: `http://localhost:8000/health`
- Interactive API documentation: `http://localhost:8000/docs`
- File ingestion: `POST http://localhost:8000/api/reviews/ingest`

### Terminal 2: start Angular

```bash
npm start
```

Open `http://localhost:4200` in a browser. The Angular development server reloads the page when source files change.

## Try the upload flow

1. In **RDAs**, select one file in the **RDA** field and one in the **Spreadsheet** field.
2. Select **Finalize upload**. A new card appears in the **To review** queue. The selected files are kept in browser memory for this session.
3. Select **Start Review** on the card. Angular sends both files to the mock API as multipart form fields named `file_1` and `file_2`.
4. On success, the button changes to **Documents sent**. On failure, an error appears on the card.

The mock endpoint accepts two non-empty files up to 20 MB each. It returns a mock submission ID, file names, content types, and sizes. It does not retain the file contents after responding.

The API's CORS configuration allows the Angular origin `http://localhost:4200`. If you run Angular on another origin, update `allow_origins` in `backend/main.py`.

## Other commands

Build the Angular application:

```bash
npm run build
```

Run the Angular unit tests:

```bash
npm test
```

Run the built server-side-rendered application after building:

```bash
npm run serve:ssr:frontend_rda_poc
```

## Project layout

```text
backend/
  main.py                 FastAPI mock upload endpoint
  requirements.txt        Python dependencies
src/
  app/
    app.ts                Queue state, uploads, and API request
    app.html              Dashboard and Skills tab templates
    app.scss              Application styles
    app.spec.ts           Angular unit tests
  main.ts                 Browser application entry point
  main.server.ts          Server-side rendering entry point
```

## Before connecting a real RAG pipeline

Replace the mock behavior in `backend/main.py` with the actual ingestion workflow. A production backend should validate supported file types and sizes, securely store or process the uploaded contents, return clear job/submission status, and protect the endpoint with appropriate authentication and authorization. Configure the frontend API URL and CORS origins for the deployment environment rather than relying on local development addresses.
