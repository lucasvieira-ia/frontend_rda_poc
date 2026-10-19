import { TestBed } from '@angular/core/testing';
import * as mammoth from 'mammoth';
import { vi } from 'vitest';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should show Upload documents as the first queue tab by default', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const queueTabs = compiled.querySelectorAll<HTMLButtonElement>('.queue-tab');

    expect(compiled.querySelector('.primary-tab')?.textContent).toContain('RDAs');
    expect(queueTabs[0].textContent).toContain('Upload documents');
    expect(queueTabs[1].textContent).toContain('To review');
    expect(queueTabs[0].getAttribute('aria-selected')).toBe('true');
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
    const queueTabs = compiled.querySelectorAll<HTMLButtonElement>('.queue-tab');

    queueTabs[1].click();
    fixture.detectChanges();
    expect(compiled.querySelector('.upload-section')).toBeNull();
    expect(queueTabs[1].getAttribute('aria-selected')).toBe('true');

    queueTabs[2].click();
    fixture.detectChanges();

    expect(compiled.querySelector('#queue-panel')).not.toBeNull();
    expect(queueTabs[2].getAttribute('aria-selected')).toBe('true');
    expect(compiled.querySelectorAll('.review-card').length).toBe(0);
    expect(compiled.querySelector('.empty-state h2')?.textContent)
      .toContain('No matching reviews');
  });

  it('should mock-start a review and show the DOCX in Feedbacks to approve', async () => {
    const fixture = TestBed.createComponent(App);
    vi.spyOn(mammoth, 'convertToHtml').mockResolvedValue({
      value: '<p>Mock RDA contents</p>',
      messages: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const firstFile = new File(['docx data'], 'RDA.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    Object.defineProperty(firstFile, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
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
    await fixture.whenStable();
    fixture.detectChanges();
    const queueTabs = fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.queue-tab');
    expect(queueTabs[2].getAttribute('aria-selected')).toBe('true');
    expect(fixture.nativeElement.querySelector('.start-review')?.textContent)
      .toContain('Review started');
    expect(fixture.nativeElement.querySelector('.docx-preview')?.textContent)
      .toContain('Mock RDA contents');
    expect(fixture.nativeElement.querySelector<HTMLAnchorElement>(
      'a[download="spreadsheet.xlsx"]',
    )).not.toBeNull();
  });

  it('should mock-start an RDA-only review without calling the backend', async () => {
    const fixture = TestBed.createComponent(App);
    vi.spyOn(mammoth, 'convertToHtml').mockResolvedValue({
      value: '<p>RDA without spreadsheet</p>',
      messages: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const rda = new File(['docx data'], 'RDA.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    Object.defineProperty(rda, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
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
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.docx-preview')?.textContent)
      .toContain('RDA without spreadsheet');
    expect(fixture.nativeElement.querySelectorAll('.review-file').length).toBe(1);
  });
});
