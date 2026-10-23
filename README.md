# RDA Review Frontend

This is the Angular frontend for the RDA Review application. You can install
and run the frontend on its own; a separate backend is not required just to
open and navigate the interface.

## Requirements

- Node.js (use an LTS release compatible with Angular 22).
- npm, which is installed with Node.js.

Check that Node.js and npm are installed:

```bash
node --version
npm --version
```

## Install

Open a terminal in the `frontend_rda_poc` directory (the directory containing
`package.json`), then install the project dependencies:

```bash
npm ci
```

## Start the frontend

From the same directory, run:

```bash
npm start
```

This runs Angular's development server. Open
[http://localhost:4200](http://localhost:4200) in your browser. The server
rebuilds the frontend when source files change. Stop it with `Ctrl+C`.

You can also start the development server directly with the local Angular CLI:

```bash
ng serve --open
```

There is no need to install Angular CLI globally.

## Backend requirement for submitting documents

The frontend interface can run without the backend, but document submission
requires the API to be running at `http://localhost:8000`. The frontend sends
the RDA and spreadsheet to:

```text
POST http://localhost:8000/api/v1/rda/evaluate?include_feedback=true
```

The request contains `docx_file` and `xlsx_file` multipart fields. Both files
are required by the frontend. Without the backend, the application still opens,
but submissions will fail and display an error.
