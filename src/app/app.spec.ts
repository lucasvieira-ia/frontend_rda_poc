import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the queue dashboard with two reviews', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('My Queue');
    expect(compiled.querySelectorAll('.review-card').length).toBe(2);
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
    expect(compiled.querySelector('.organization-line h2')?.textContent)
      .toContain('Associação Novo Rumo');
  });
});
