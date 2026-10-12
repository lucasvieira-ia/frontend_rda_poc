import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnalysisResult } from './analysis-result';

describe('AnalysisResult', () => {
  let component: AnalysisResult;
  let fixture: ComponentFixture<AnalysisResult>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisResult],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalysisResult);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
