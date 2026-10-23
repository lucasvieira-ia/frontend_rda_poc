import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  RdaStepId,
  RdaSubmissionForm,
  Step,
  UploadedFile,
} from '../../models/rda-review.models';
import { RdaHeaderComponent } from '../rda-header/rda-header.component';
import { RdaPreparationStepComponent } from '../rda-preparation-step/rda-preparation-step.component';
import { RdaStepperComponent } from '../rda-stepper/rda-stepper.component';

const EMPTY_UPLOADED_FILE: UploadedFile = {
  file: null,
  name: '',
  size: 0,
  isValid: false,
};

const RDA_API_BASE_URL = 'http://localhost:8000';
const RDA_EVALUATE_URL = `${RDA_API_BASE_URL}/api/v1/rda/evaluate`;

interface RdaEvaluationResponse {
  arquivo_docx_comentarios: string | null;
  arquivo_xlsx_comentarios: string | null;
  download_url_docx: string | null;
  download_url_xlsx: string | null;
}

@Component({
  selector: 'app-rda-review-container',
  standalone: true,
  imports: [RdaHeaderComponent, RdaStepperComponent, RdaPreparationStepComponent],
  templateUrl: './rda-review-container.component.html',
  styleUrl: './rda-review-container.component.scss',
})
export class RdaReviewContainerComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly generatedObjectUrls: string[] = [];

  protected readonly systemPrompt =
    'Act as a specialist in financial analysis of R&D&I projects. Your role is to check the files for financial inconsistencies. Present the results in text format.';
  protected readonly customPrompt = signal(
    'Act as a specialist in financial analysis of R&D&I projects. Your role is to check the files for financial inconsistencies. Present the results in',
  );
  protected readonly promptSaved = signal(false);
  protected readonly promptUpdatedAt = signal('10/22/2026 at 3:34 PM');
  protected readonly activeNavigationTab = signal<'analysis' | 'skills'>('analysis');
  protected readonly activeStep = signal<RdaStepId>('preparation');
  protected readonly minutaFile = signal<UploadedFile | null>(null);
  protected readonly planilhaFile = signal<UploadedFile | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly generatedRdaUrl = signal<string | null>(null);
  protected readonly generatedRdaName = signal<string | null>(null);
  protected readonly returnedSpreadsheetUrl = signal<string | null>(null);
  protected readonly returnedSpreadsheetName = signal<string | null>(null);

  protected readonly submissionForm = computed<RdaSubmissionForm>(() => ({
    minutaDocument: this.minutaFile() ?? EMPTY_UPLOADED_FILE,
    planilhaDocument: this.planilhaFile() ?? EMPTY_UPLOADED_FILE,
  }));

  protected readonly isSubmitDisabled = computed(() => {
    const form = this.submissionForm();
    const minuta = form.minutaDocument;
    const planilha = form.planilhaDocument;
    return (
      !minuta.file ||
      !minuta.isValid ||
      !planilha.file ||
      !planilha.isValid ||
      this.isSubmitting()
    );
  });

  protected readonly steps = computed<Step[]>(() => [
    {
      id: 'preparation',
      label: 'Preparation',
      description: '',
      isActive: this.activeStep() === 'preparation',
      isCompleted: this.activeStep() === 'analysis',
    },
    {
      id: 'analysis',
      label: 'Analysis',
      description: '',
      isActive: this.activeStep() === 'analysis',
      isCompleted: false,
    },
  ]);

  ngOnDestroy(): void {
    this.revokeGeneratedFiles();
  }

  protected onMinutaFileChange(file: UploadedFile | null): void {
    this.minutaFile.set(file);
    this.submitError.set(null);
  }

  protected onPlanilhaFileChange(file: UploadedFile | null): void {
    this.planilhaFile.set(file);
    this.submitError.set(null);
  }

  protected selectStep(step: RdaStepId): void {
    if (step === 'preparation' || this.activeStep() === 'analysis') {
      this.activeStep.set(step);
    }
  }

  protected selectNavigationTab(tab: 'analysis' | 'skills'): void {
    this.activeNavigationTab.set(tab);
  }

  protected updateCustomPrompt(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement) {
      this.customPrompt.set(event.target.value);
      this.promptSaved.set(false);
    }
  }

  protected saveCustomPrompt(): void {
    this.promptSaved.set(true);
    this.promptUpdatedAt.set(
      new Date().toLocaleString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).replace(',', ' at'),
    );
  }

  protected async onSubmit(): Promise<void> {
    if (this.isSubmitDisabled()) {
      return;
    }

    const form = this.submissionForm();
    const minuta = form.minutaDocument.file;
    const planilha = form.planilhaDocument.file;
    if (!minuta || !planilha) {
      return;
    }

    this.isSubmitting.set(true);
    this.activeStep.set('analysis');
    this.submitError.set(null);
    this.revokeGeneratedFiles();
    this.generatedRdaUrl.set(null);
    this.generatedRdaName.set(null);
    this.returnedSpreadsheetUrl.set(null);
    this.returnedSpreadsheetName.set(null);

    try {
      const formData = new FormData();
      formData.append('docx_file', minuta, form.minutaDocument.name);
      if (planilha) {
        formData.append('xlsx_file', planilha, form.planilhaDocument.name);
      }

      const result = await firstValueFrom(
        this.http.post<RdaEvaluationResponse>(
          `${RDA_EVALUATE_URL}?include_feedback=true`,
          formData,
        ),
      );

      if (result.download_url_docx) {
        const docx = await firstValueFrom(
          this.http.get(this.apiUrl(result.download_url_docx), {
            responseType: 'blob',
          }),
        );
        const rdaUrl = URL.createObjectURL(docx);
        this.generatedObjectUrls.push(rdaUrl);
        this.generatedRdaUrl.set(rdaUrl);
        this.generatedRdaName.set(result.arquivo_docx_comentarios ?? 'rda_feedback.docx');
      }

      if (result.download_url_xlsx) {
        const spreadsheet = await firstValueFrom(
          this.http.get(this.apiUrl(result.download_url_xlsx), {
            responseType: 'blob',
          }),
        );
        const spreadsheetUrl = URL.createObjectURL(spreadsheet);
        this.generatedObjectUrls.push(spreadsheetUrl);
        this.returnedSpreadsheetUrl.set(spreadsheetUrl);
        this.returnedSpreadsheetName.set(
          result.arquivo_xlsx_comentarios ?? 'spreadsheet_feedback.xlsx',
        );
      }

      this.activeStep.set('analysis');
    } catch (error: unknown) {
      console.error('Document submission failed:', error);
      this.submitError.set(
        "We couldn't process your files right now. Please try again.",
      );
      this.activeStep.set('preparation');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected startNewSubmission(): void {
    this.revokeGeneratedFiles();
    this.generatedRdaUrl.set(null);
    this.generatedRdaName.set(null);
    this.returnedSpreadsheetUrl.set(null);
    this.returnedSpreadsheetName.set(null);
    this.minutaFile.set(null);
    this.planilhaFile.set(null);
    this.submitError.set(null);
    this.activeStep.set('preparation');
  }

  private revokeGeneratedFiles(): void {
    for (const url of this.generatedObjectUrls.splice(0)) {
      URL.revokeObjectURL(url);
    }
  }

  private apiUrl(path: string): string {
    return new URL(path, RDA_API_BASE_URL).toString();
  }
}
