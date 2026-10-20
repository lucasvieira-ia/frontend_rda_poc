import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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

  protected readonly activeNavigationTab = signal<'analysis' | 'skills'>('analysis');
  protected readonly activeStep = signal<RdaStepId>('preparation');
  protected readonly minutaFile = signal<UploadedFile | null>(null);
  protected readonly planilhaFile = signal<UploadedFile | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly generatedRdaUrl = signal<string | null>(null);
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
      description: 'Upload your documents',
      isActive: this.activeStep() === 'preparation',
      isCompleted: this.activeStep() === 'analysis' && !this.isSubmitting(),
    },
    {
      id: 'analysis',
      label: 'Analysis',
      description: 'Download the results',
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
    this.returnedSpreadsheetUrl.set(null);
    this.returnedSpreadsheetName.set(null);

    try {
      const formData = new FormData();
      formData.append('file_1', minuta, form.minutaDocument.name);
      formData.append('file_2', planilha, form.planilhaDocument.name);

      const response = await firstValueFrom(
        this.http.post('http://localhost:8000/api/reviews/ingest', formData, {
          observe: 'response',
          responseType: 'blob',
        }),
      );
      if (!response.body) {
        throw new Error('The API response did not contain the result files.');
      }

      const contentType = response.headers.get('Content-Type');
      if (!contentType?.toLocaleLowerCase().startsWith('multipart/form-data;')) {
        throw new Error('The API response was not multipart/form-data.');
      }

      const multipartResponse = new Response(response.body, {
        headers: { 'Content-Type': contentType },
      });
      const resultFiles = await multipartResponse.formData();
      const rda = resultFiles.get('rda');
      if (!(rda instanceof Blob)) {
        throw new Error('The API response does not contain an RDA document.');
      }

      const spreadsheet = resultFiles.get('spreadsheet');
      if (!(spreadsheet instanceof Blob)) {
        throw new Error('The API response does not contain the spreadsheet.');
      }

      const rdaUrl = URL.createObjectURL(
        new Blob([rda], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      );
      this.generatedObjectUrls.push(rdaUrl);
      this.generatedRdaUrl.set(rdaUrl);

      const spreadsheetUrl = URL.createObjectURL(
        new Blob([spreadsheet], { type: planilha.type }),
      );
      this.generatedObjectUrls.push(spreadsheetUrl);
      this.returnedSpreadsheetUrl.set(spreadsheetUrl);
      this.returnedSpreadsheetName.set(form.planilhaDocument.name);

      this.activeStep.set('analysis');
    } catch (error: unknown) {
      this.submitError.set(`Could not submit the documents.${this.errorReason(error)}`);
      this.activeStep.set('preparation');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected startNewSubmission(): void {
    this.revokeGeneratedFiles();
    this.generatedRdaUrl.set(null);
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

  private errorReason(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return ` Request failed (${error.status}): ${error.message}`;
    }
    if (error instanceof Error) {
      return ` ${error.message}`;
    }
    return ' An unknown error occurred.';
  }
}
