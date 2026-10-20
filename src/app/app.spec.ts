import { provideHttpClient } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      `--${boundary}\r\nContent-Disposition: form-data; name="spreadsheet"; filename="spreadsheet.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\nreturned spreadsheet\r\n`,
    );
  }
  parts.push(`--${boundary}--\r\n`);
  return {
    body: new Blob(parts),
    headers: new HttpHeaders({
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    }),
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

    expect(compiled.querySelector('.skills-placeholder h1')?.textContent).toContain('AI Skills');
    expect(compiled.querySelector('.navigation-tab[aria-current="page"]')?.textContent)
      .toContain('AI Skills');

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
      'http://localhost:8000/api/reviews/ingest',
    );
    const formData = request.request.body as FormData;
    expect((formData.get('file_1') as File).name).toBe('RDA.docx');
    expect((formData.get('file_2') as File).name).toBe('costs.xlsx');

    fixture.detectChanges();
    expect(compiled.querySelector('.analysis-loading')?.textContent)
      .toContain('Your files are being analyzed');
    expect(compiled.querySelector('[aria-busy="true"]')).not.toBeNull();

    const multipart = createMultipartResponse(true);
    request.flush(multipart.body, { headers: multipart.headers });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector('.analysis-step')).not.toBeNull();
    expect(compiled.querySelector('.analysis-loading')).toBeNull();
    expect(compiled.querySelector<HTMLAnchorElement>(
      'a[download="Mock_RDA.docx"]',
    )?.getAttribute('href')).toBe('blob:result-1');
    expect(compiled.querySelector<HTMLAnchorElement>(
      'a[download="costs.xlsx"]',
    )?.getAttribute('href')).toBe('blob:result-2');
    expect(compiled.querySelector<HTMLButtonElement>('.step-button[aria-current="step"]')
      ?.textContent)
      .toContain('Analysis');
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
      'http://localhost:8000/api/reviews/ingest',
    );
  });
});
