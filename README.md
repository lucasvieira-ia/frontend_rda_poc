# FrontendRdaPoc

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Mock Python RAG upload endpoint

The `backend` folder contains a mock FastAPI endpoint used by the **Start Review** button. It accepts two multipart files and returns a mock submission ID and file metadata. It does not save files or perform text extraction, chunking, embedding, or vector database operations.

From the project root, create and activate a Python virtual environment, then install and run the API:

```bash
python -m venv .venv
```

Activate the environment (`source .venv/bin/activate` on Linux/macOS, or `.\.venv\Scripts\Activate.ps1` in Windows PowerShell), then install and run the API:

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

The Angular development server must run at `http://localhost:4200` for the configured CORS rule. Upload two files, finalize the upload, and click **Start Review** to send both files to `http://localhost:8000/api/reviews/ingest`. Interactive API documentation is available at `http://localhost:8000/docs`.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
