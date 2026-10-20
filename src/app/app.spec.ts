import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import { vi } from 'vitest';
import { App } from './app';

async function createMockDocxResponse(): Promise<Blob> {
  const archive = new JSZip();
  archive.file(
    'word/document.xml',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:commentRangeStart w:id="0"/><w:r><w:t>Important passage</w:t></w:r><w:r><w:t xml:space="preserve"> here</w:t></w:r><w:commentRangeEnd w:id="0"/></w:p><w:p><w:commentRangeStart w:id="1"/><w:r><w:t>Second passage</w:t></w:r><w:commentRangeEnd w:id="1"/></w:p></w:body></w:document>',
  );
  archive.file(
    'word/comments.xml',
    '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="RDA Reviewer"><w:p><w:r><w:t>[ERRO] Please revise this section.</w:t></w:r></w:p></w:comment><w:comment w:id="1" w:author="RDA Reviewer"><w:p><w:r><w:t>[AVISO] Check this passage.</w:t></w:r></w:p></w:comment></w:comments>',
  );
  return archive.generateAsync({ type: 'blob' });
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

  it('should send uploaded files and preview the DOCX returned by the backend', async () => {
    const fixture = TestBed.createComponent(App);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:generated-rda'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(mammoth, 'convertToHtml').mockResolvedValue({
      value: '<p>Important passage here</p><p>Second passage</p>',
      messages: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const firstFile = new File(['docx data'], 'RDA.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const secondFile = new File(['spreadsheet data'], 'spreadsheet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
      'a[download="spreadsheet.xlsx"]',
    )).not.toBeNull();
    fixture.nativeElement.querySelector<HTMLButtonElement>('.start-review').click();

    const request = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:8000/api/reviews/ingest',
    );
    expect(request.request.method).toBe('POST');
    expect(((request.request.body as FormData).get('file_1') as File).name).toBe('RDA.docx');
    expect(((request.request.body as FormData).get('file_2') as File).name)
      .toBe('spreadsheet.xlsx');
    request.flush(await createMockDocxResponse());
    await fixture.whenStable();
    fixture.detectChanges();
    const workflowSteps = fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
      '.workflow-step-button',
    );
    expect(workflowSteps[2].getAttribute('aria-current')).toBe('step');
    expect(fixture.nativeElement.querySelector('.start-review')?.textContent)
      .toContain('Review started');
    expect(fixture.nativeElement.querySelector('.docx-preview')?.textContent)
      .toContain('Important passage here');
    expect(fixture.nativeElement.querySelector('.docx-comment-balloon')).toBeNull();
    expect(fixture.nativeElement.querySelector('.document-comments')?.textContent)
      .toContain('Please revise this section.');
    expect(fixture.nativeElement.querySelector('.document-comments blockquote')?.textContent)
      .toContain('Important passage here');
    const generatedRda = fixture.nativeElement.querySelector<HTMLAnchorElement>(
      'a[download="Mock_RDA.docx"]',
    );
    expect(generatedRda?.getAttribute('href')).toBe('blob:generated-rda');
    expect(fixture.nativeElement.querySelector('.review-file-list')).toBeNull();
    expect(fixture.nativeElement.querySelector('.metrics-column')).toBeNull();
  });

  it('should submit an RDA-only review and show the returned DOCX', async () => {
    const fixture = TestBed.createComponent(App);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:generated-rda'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(mammoth, 'convertToHtml').mockResolvedValue({
      value: '<p>Important passage here</p><p>Second passage</p>',
      messages: [],
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
    request.flush(await createMockDocxResponse());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.docx-preview')?.textContent)
      .toContain('Important passage here');
    expect(fixture.nativeElement.querySelector('.docx-comment-balloon'))
      .not.toBeNull();
    expect(fixture.nativeElement.querySelector('.generated-rda-download')?.textContent)
      .toContain('Download generated RDA');
    expect(fixture.nativeElement.querySelector('.review-file-list')).toBeNull();
  });
});
