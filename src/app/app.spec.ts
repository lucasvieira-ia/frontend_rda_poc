import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render an empty review queue before files are uploaded', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('My Queue');
    expect(compiled.querySelectorAll('.review-card').length).toBe(0);
    expect(compiled.querySelector('.empty-state h2')?.textContent)
      .toContain('No matching reviews');
  });

  it('should filter the queue by review type', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const feedbackTab = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.queue-tab'))
      .find((tab) => tab.textContent?.includes('Feedbacks to approve'));

    feedbackTab?.click();
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.review-card').length).toBe(1);
    expect(compiled.querySelector('.empty-state h2')?.textContent)
      .toContain('No matching reviews');
  });

  it('should send both uploaded files to the mock backend when starting a review', async () => {
    const fixture = TestBed.createComponent(App);
    const httpTesting = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    fixture.detectChanges();

    const firstFile = new File(['first document'], 'first.pdf', { type: 'application/pdf' });
    const secondFile = new File(['second document'], 'second.pdf', { type: 'application/pdf' });
    const fileInputs = fixture.nativeElement.querySelectorAll('input[type="file"]');

    for (const [index, file] of [firstFile, secondFile].entries()) {
      Object.defineProperty(fileInputs[index], 'files', { value: [file] });
      fileInputs[index].dispatchEvent(new Event('change'));
    }

    fixture.nativeElement.querySelector<HTMLButtonElement>('.finalize-upload').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector<HTMLButtonElement>('.start-review').click();

    const request = httpTesting.expectOne('http://localhost:8000/api/reviews/ingest');
    expect(request.request.method).toBe('POST');
    expect((request.request.body.get('file_1') as File).name).toBe('first.pdf');
    expect((request.request.body.get('file_2') as File).name).toBe('second.pdf');

    request.flush({
      submission_id: 'mock-submission-123',
      status: 'accepted',
      processing: 'mock_only',
      message: 'Files received.',
      files: [],
    });

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.start-review')?.textContent)
      .toContain('Documents sent');
    httpTesting.verify();
  });
});
