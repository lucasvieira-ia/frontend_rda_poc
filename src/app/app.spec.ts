import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpHeaders } from '@angular/common/http';
import { vi } from 'vitest';
import { App } from './app';

function createMultipartResponse(includeSpreadsheet: boolean): {
  body: Blob;
  headers: HttpHeaders;
} {
  const boundary = 'test-boundary';
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="rda"; filename="Mock_RDA.docx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\ngenerated RDA\r\n`,
  ];
  if (includeSpreadsheet) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="spreadsheet"; filename="spreadsheet.xls"\r\nContent-Type: application/vnd.ms-excel\r\n\r\nreturned spreadsheet\r\n`,
    );
  }
  parts.push(`--${boundary}--\r\n`);
  return {
    body: new Blob(parts, { type: `multipart/form-data; boundary=${boundary}` }),
    headers: new HttpHeaders({
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    }),
  };
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    TestBed.inject(HttpTestingController).verify();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should show Upload documents as the first workflow step by default', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const workflowSteps = compiled.querySelectorAll<HTMLButtonElement>('.workflow-step-button');

    expect(compiled.querySelector('.primary-tab')?.textContent).toContain('RDAs');
    expect(workflowSteps[0].textContent).toContain('Upload documents');
    expect(workflowSteps[1].textContent).toContain('To review');
    expect(workflowSteps[2].textContent).toContain('Feedbacks');
    expect(workflowSteps[0].getAttribute('aria-current')).toBe('step');
    const spreadsheetInput = compiled.querySelector<HTMLInputElement>(
      'input[type="file"][aria-label="Choose the optional spreadsheet"]',
    );
    expect(spreadsheetInput?.accept).toBe('.xls,.xlsx');
    expect(compiled.querySelector('.upload-section')).not.toBeNull();
    expect(compiled.querySelectorAll('.review-card').length).toBe(0);
  });

  it('should show the No Skills page and return to the queue', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = compiled.querySelectorAll<HTMLButtonElement>('.primary-tab');

    tabs[1].click();
    fixture.detectChanges();
    expect(compiled.querySelector('#skills-page-title')?.textContent).toContain('No Skills');
    expect(compiled.querySelector('.upload-section')).toBeNull();
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');

    tabs[0].click();
    fixture.detectChanges();
    expect(compiled.querySelector('.upload-section')).not.toBeNull();
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('should switch from uploads to the selected review queue', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const workflowSteps = compiled.querySelectorAll<HTMLButtonElement>('.workflow-step-button');

    workflowSteps[1].click();
    fixture.detectChanges();
    expect(compiled.querySelector('.upload-section')).toBeNull();
    expect(workflowSteps[1].getAttribute('aria-current')).toBe('step');
    expect(workflowSteps[0].closest('.workflow-step')?.classList.contains('completed'))
      .toBe(true);
    expect(workflowSteps[0].querySelector('.workflow-step-indicator')?.textContent?.trim())
      .toBe('✓');
    expect(workflowSteps[2].querySelector('.workflow-step-indicator')?.textContent?.trim())
      .toBe('');

    workflowSteps[2].click();
    fixture.detectChanges();

    expect(compiled.querySelector('#queue-panel')).not.toBeNull();
    expect(workflowSteps[2].getAttribute('aria-current')).toBe('step');
    expect(workflowSteps[0].closest('.workflow-step')?.classList.contains('completed'))
      .toBe(true);
    expect(workflowSteps[1].closest('.workflow-step')?.classList.contains('completed'))
      .toBe(true);
    expect(compiled.querySelectorAll('.review-card').length).toBe(0);
    expect(compiled.querySelector('.empty-state h2')?.textContent)
      .toContain('No matching reviews');
  });

  it('should provide spreadsheet and backend-generated RDA downloads in feedback', async () => {
    const fixture = TestBed.createComponent(App);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob: Blob) =>
        blob.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ? 'blob:generated-rda'
          : 'blob:returned-spreadsheet',
      ),
      revokeObjectURL: vi.fn(),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const firstFile = new File(['docx data'], 'RDA.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const secondFile = new File(['spreadsheet data'], 'spreadsheet.xls', {
      type: 'application/vnd.ms-excel',
    });
    const fileInputs = fixture.nativeElement.querySelectorAll('input[type="file"]');

    for (const [index, file] of [firstFile, secondFile].entries()) {
      Object.defineProperty(fileInputs[index], 'files', { value: [file] });
      fileInputs[index].dispatchEvent(new Event('change'));
    }

    fixture.nativeElement.querySelector<HTMLButtonElement>('.finalize-upload').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector<HTMLAnchorElement>('a[download="RDA.docx"]'))
      .not.toBeNull();
    expect(fixture.nativeElement.querySelector<HTMLAnchorElement>(
      'a[download="spreadsheet.xls"]',
    )).not.toBeNull();
    fixture.nativeElement.querySelector<HTMLButtonElement>('.start-review').click();

    const request = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:8000/api/reviews/ingest',
    );
    expect(request.request.method).toBe('POST');
    expect(((request.request.body as FormData).get('file_1') as File).name).toBe('RDA.docx');
    expect(((request.request.body as FormData).get('file_2') as File).name)
      .toBe('spreadsheet.xls');
    const multipartResponse = createMultipartResponse(true);
    request.flush(multipartResponse.body, { headers: multipartResponse.headers });
    await fixture.whenStable();
    fixture.detectChanges();
    const workflowSteps = fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
      '.workflow-step-button',
    );
    expect(workflowSteps[2].getAttribute('aria-current')).toBe('step');
    expect(fixture.nativeElement.querySelector('.start-review')?.textContent)
      .toContain('Review started');
    const generatedRda = fixture.nativeElement.querySelector<HTMLAnchorElement>(
      '.feedback-download[download="Mock_RDA.docx"]',
    );
    expect(generatedRda?.getAttribute('href')).toBe('blob:generated-rda');
    const spreadsheet = fixture.nativeElement.querySelector<HTMLAnchorElement>(
      '.feedback-download[download="spreadsheet.xls"]',
    );
    expect(spreadsheet?.getAttribute('aria-label')).toContain('Download spreadsheet');
    expect(spreadsheet?.textContent).toContain('Download');
    expect(spreadsheet?.getAttribute('href')).toBe('blob:returned-spreadsheet');
    expect(fixture.nativeElement.querySelectorAll('.feedback-file-card').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.docx-preview')).toBeNull();
    expect(fixture.nativeElement.querySelector('.document-comments')).toBeNull();
    expect(fixture.nativeElement.querySelector('.review-file-list')).toBeNull();
    expect(fixture.nativeElement.querySelector('.metrics-column')).toBeNull();
  });

  it('should provide only the generated RDA download when no spreadsheet was uploaded', async () => {
    const fixture = TestBed.createComponent(App);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:generated-rda'),
      revokeObjectURL: vi.fn(),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const rda = new File(['docx data'], 'RDA.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const fileInputs = fixture.nativeElement.querySelectorAll('input[type="file"]');
    Object.defineProperty(fileInputs[0], 'files', { value: [rda] });
    fileInputs[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const finalizeButton = fixture.nativeElement.querySelector<HTMLButtonElement>('.finalize-upload');
    expect(finalizeButton?.disabled).toBe(false);
    finalizeButton?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector<HTMLAnchorElement>('a[download="RDA.docx"]'))
      .not.toBeNull();
    expect(fixture.nativeElement.querySelector<HTMLAnchorElement>('a[download="spreadsheet.xlsx"]'))
      .toBeNull();
    fixture.nativeElement.querySelector<HTMLButtonElement>('.start-review').click();

    const request = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:8000/api/reviews/ingest',
    );
    expect(((request.request.body as FormData).get('file_1') as File).name).toBe('RDA.docx');
    expect((request.request.body as FormData).has('file_2')).toBe(false);
    const multipartResponse = createMultipartResponse(false);
    request.flush(multipartResponse.body, { headers: multipartResponse.headers });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.feedback-download[download="spreadsheet.xlsx"]'))
      .toBeNull();
    expect(fixture.nativeElement.querySelector('.feedback-download[download="Mock_RDA.docx"]')
      ?.getAttribute('aria-label'))
      .toContain('Download generated RDA');
    expect(fixture.nativeElement.querySelector('.review-file-list')).toBeNull();
  });
});
