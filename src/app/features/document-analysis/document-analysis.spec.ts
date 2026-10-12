import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentAnalysis } from './document-analysis';

describe('DocumentAnalysis', () => {
  let component: DocumentAnalysis;
  let fixture: ComponentFixture<DocumentAnalysis>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentAnalysis],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentAnalysis);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
