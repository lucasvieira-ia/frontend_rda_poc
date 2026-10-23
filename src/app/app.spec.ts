import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

function createEvaluationResponse(includeSpreadsheet: boolean, includeRda = true) {
  return {
    arquivo_docx_comentarios: includeRda ? 'MOCK_feedback_RDA.docx' : null,
    arquivo_xlsx_comentarios: includeSpreadsheet ? 'MOCK_feedback_costs.xlsx' : null,
    download_url_docx: includeRda ? '/api/v1/rda/download-feedback/docx-id' : null,
    download_url_xlsx: includeSpreadsheet
      ? '/api/v1/rda/download-feedback/xlsx-id'
      : null,
  };
}

describe('RdaReviewContainer', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    TestBed.inject(HttpTestingController).verify();
  });

  it('starts on Preparation and disables forward navigation until submit', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const steps = compiled.querySelectorAll<HTMLButtonElement>('.step-button');

    expect(compiled.querySelector('app-rda-header')).not.toBeNull();
    expect(compiled.querySelector('.navigation-tab[aria-current="page"]')?.textContent)
      .toContain('Analysis');
    expect(compiled.querySelectorAll('.navigation-tab')).toHaveLength(2);
    expect(compiled.querySelector('app-rda-preparation-step')).not.toBeNull();
    expect(steps).toHaveLength(2);
    expect(steps[0].textContent).toContain('Preparation');
    expect(steps[1].textContent).toContain('Analysis');
    expect(steps[1].disabled).toBe(true);
    expect(compiled.querySelector<HTMLButtonElement>('.submit-button')?.disabled).toBe(true);
    expect(compiled.querySelectorAll('.required-badge')).toHaveLength(2);
    expect(compiled.querySelectorAll('.optional-badge')).toHaveLength(0);
  });

  it('switches between the Analysis and AI Skills navigation tabs', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const skillsTab = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.navigation-tab'))
      .find((tab) => tab.textContent?.includes('AI Skills'));
    skillsTab?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('#skills-title')?.textContent).toContain('AI Skills');
    expect(compiled.querySelector('.navigation-tab[aria-current="page"]')?.textContent)
      .toContain('AI Skills');
    expect(compiled.querySelector('#system-prompt')).not.toBeNull();
    expect(compiled.querySelector('#custom-prompt')).not.toBeNull();

    const customPrompt = compiled.querySelector<HTMLTextAreaElement>('#custom-prompt');
    if (!customPrompt) {
      throw new Error('The custom prompt editor was not rendered.');
    }
    customPrompt.value = 'Prompt personalizado';
    customPrompt.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.save-prompt-button')?.click();
    fixture.detectChanges();
    expect(compiled.querySelector('.custom-badge')?.textContent)
      .toContain('Saved');

    compiled.querySelector<HTMLButtonElement>('.navigation-tab')?.click();
    fixture.detectChanges();
    expect(compiled.querySelector('app-rda-preparation-step')).not.toBeNull();
  });

  it('validates file extensions and accepts RDA and spreadsheet files', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const inputs = compiled.querySelectorAll<HTMLInputElement>('input[type="file"]');

    const invalidRda = new File(['text'], 'RDA.pdf', { type: 'application/pdf' });
    Object.defineProperty(inputs[0], 'files', {
      configurable: true,
      value: [invalidRda],
    });
    inputs[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(compiled.querySelector('.file-error')?.textContent).toContain('.DOCX');
    expect(compiled.querySelector<HTMLButtonElement>('.submit-button')?.disabled).toBe(true);

    const validRda = new File(['docx'], 'RDA.docx');
    const dropZone = compiled.querySelector('.drop-zone');
    const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
    dropZone?.dispatchEvent(dragOver);
    fixture.detectChanges();
    expect(dropZone?.classList.contains('is-dragging')).toBe(true);

    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: { item: (index: number) => index === 0 ? validRda : null } },
    });
    dropZone?.dispatchEvent(drop);
    fixture.detectChanges();
    expect(compiled.querySelector<HTMLButtonElement>('.submit-button')?.disabled).toBe(true);

    const invalidSpreadsheet = new File(['csv'], 'costs.csv');
    Object.defineProperty(inputs[1], 'files', {
      configurable: true,
      value: [invalidSpreadsheet],
    });
    inputs[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(compiled.querySelector<HTMLButtonElement>('.submit-button')?.disabled).toBe(true);

    const spreadsheet = new File(['xlsx'], 'costs.xlsx');
    Object.defineProperty(inputs[1], 'files', {
      configurable: true,
      value: [spreadsheet],
    });
    inputs[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.selected-file-copy strong')[0].textContent)
      .toContain('RDA.docx');
    expect(compiled.querySelectorAll('.selected-file-copy strong')[1].textContent)
      .toContain('costs.xlsx');
    expect(compiled.querySelector<HTMLButtonElement>('.submit-button')?.disabled).toBe(false);
  });

  it('submits both files once and shows each backend result in Analysis', async () => {
    const fixture = TestBed.createComponent(App);
    let createdUrl = 0;
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:result-${++createdUrl}`),
      revokeObjectURL: vi.fn(),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const inputs = compiled.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const minuta = new File(['docx input'], 'RDA.docx');
    const planilha = new File(['xlsx input'], 'costs.xlsx');
    Object.defineProperty(inputs[0], 'files', { value: [minuta] });
    inputs[0].dispatchEvent(new Event('change'));
    Object.defineProperty(inputs[1], 'files', { value: [planilha] });
    inputs[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    compiled.querySelector<HTMLButtonElement>('.submit-button')?.click();
    const request = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:8000/api/v1/rda/evaluate?include_feedback=true',
    );
    const formData = request.request.body as FormData;
    expect((formData.get('docx_file') as File).name).toBe('RDA.docx');
    expect((formData.get('xlsx_file') as File).name).toBe('costs.xlsx');

    fixture.detectChanges();
    expect(compiled.querySelector('.analysis-loading')?.textContent)
      .toContain('Your files are being analyzed');
    expect(compiled.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(compiled.querySelector('.step-item.completed .step-connector')).not.toBeNull();

    request.flush(createEvaluationResponse(true));
    await Promise.resolve();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('http://localhost:8000/api/v1/rda/download-feedback/docx-id')
      .flush(new Blob(['generated RDA']));
    http.expectOne('http://localhost:8000/api/v1/rda/download-feedback/xlsx-id')
      .flush(new Blob(['generated spreadsheet']));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector('.analysis-step')).not.toBeNull();
    expect(compiled.querySelector('.analysis-loading')).toBeNull();
    expect(compiled.querySelector<HTMLAnchorElement>(
      'a[download="MOCK_feedback_RDA.docx"]',
    )?.getAttribute('href')).toBe('blob:result-1');
    expect(compiled.querySelector<HTMLAnchorElement>(
      'a[download="MOCK_feedback_costs.xlsx"]',
    )?.getAttribute('href')).toBe('blob:result-2');
    expect(compiled.querySelector<HTMLButtonElement>('.step-button[aria-current="step"]')
      ?.textContent)
      .toContain('Analysis');
  });

  it('shows the spreadsheet and reports the missing RDA document', async () => {
    const fixture = TestBed.createComponent(App);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:spreadsheet-result'),
      revokeObjectURL: vi.fn(),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const inputs = compiled.querySelectorAll<HTMLInputElement>('input[type="file"]');
    for (const [input, file] of [
      [inputs[0], new File(['docx'], 'RDA.docx')],
      [inputs[1], new File(['xlsx'], 'costs.xlsx')],
    ] as const) {
      Object.defineProperty(input, 'files', { value: [file] });
      input.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.submit-button')?.click();

    const request = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:8000/api/v1/rda/evaluate?include_feedback=true',
    );
    request.flush(createEvaluationResponse(true, false));
    await Promise.resolve();
    TestBed.inject(HttpTestingController)
      .expectOne('http://localhost:8000/api/v1/rda/download-feedback/xlsx-id')
      .flush(new Blob(['generated spreadsheet']));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector('a[download="MOCK_feedback_costs.xlsx"]')?.getAttribute('href'))
      .toBe('blob:spreadsheet-result');
    expect(compiled.querySelector('.result-unavailable')?.textContent)
      .toContain('The RDA document is not available.');
  });

  it('shows the RDA document and reports the missing spreadsheet', async () => {
    const fixture = TestBed.createComponent(App);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:rda-result'),
      revokeObjectURL: vi.fn(),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const inputs = compiled.querySelectorAll<HTMLInputElement>('input[type="file"]');
    for (const [input, file] of [
      [inputs[0], new File(['docx'], 'RDA.docx')],
      [inputs[1], new File(['xlsx'], 'costs.xlsx')],
    ] as const) {
      Object.defineProperty(input, 'files', { value: [file] });
      input.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.submit-button')?.click();

    const request = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:8000/api/v1/rda/evaluate?include_feedback=true',
    );
    request.flush(createEvaluationResponse(false, true));
    await Promise.resolve();
    TestBed.inject(HttpTestingController)
      .expectOne('http://localhost:8000/api/v1/rda/download-feedback/docx-id')
      .flush(new Blob(['generated RDA']));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector('a[download="MOCK_feedback_RDA.docx"]')?.getAttribute('href'))
      .toBe('blob:rda-result');
    expect(compiled.querySelector('.result-unavailable')?.textContent)
      .toContain('The spreadsheet is not available.');
  });

  it('shows a friendly message instead of backend error details', async () => {
    const fixture = TestBed.createComponent(App);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const inputs = compiled.querySelectorAll<HTMLInputElement>('input[type="file"]');
    for (const [input, file] of [
      [inputs[0], new File(['docx'], 'RDA.docx')],
      [inputs[1], new File(['xlsx'], 'costs.xlsx')],
    ] as const) {
      Object.defineProperty(input, 'files', { value: [file] });
      input.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.submit-button')?.click();

    const request = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:8000/api/v1/rda/evaluate?include_feedback=true',
    );
    request.flush(
      { detail: 'Sensitive internal backend failure' },
      { status: 500, statusText: 'Internal Server Error' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = compiled.querySelector('[role="alert"]');
    expect(alert?.textContent)
      .toContain("We couldn't process your files right now. Please try again.");
    expect(alert?.textContent).not.toContain('Sensitive internal backend failure');
    expect(alert?.textContent).not.toContain('500');
    expect(consoleError).toHaveBeenCalled();
  });

  it('requires a spreadsheet before submitting the RDA', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const inputs = compiled.querySelectorAll<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(inputs[0], 'files', {
      value: [new File(['docx'], 'RDA.docx')],
    });
    inputs[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(compiled.querySelector<HTMLButtonElement>('.submit-button')?.disabled).toBe(true);
    compiled.querySelector<HTMLButtonElement>('.submit-button')?.click();
    TestBed.inject(HttpTestingController).expectNone(
      'http://localhost:8000/api/v1/rda/evaluate?include_feedback=true',
    );
  });
});
