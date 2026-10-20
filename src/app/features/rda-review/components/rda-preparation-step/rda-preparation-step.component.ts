import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UploadedFile } from '../../models/rda-review.models';
import { FileUploadBoxComponent } from '../file-upload-box/file-upload-box.component';
import { RdaSubmitActionsComponent } from '../rda-submit-actions/rda-submit-actions.component';

@Component({
  selector: 'app-rda-preparation-step',
  standalone: true,
  imports: [FileUploadBoxComponent, RdaSubmitActionsComponent],
  template: `
    <section class="preparation-step" aria-labelledby="preparation-title">
      <div class="section-heading">
        <h2 id="preparation-title">Prepare your documents</h2>
        <p>Add both the RDA document and its spreadsheet to continue.</p>
      </div>

      <div class="upload-grid">
        <app-file-upload-box
          inputId="minuta-document"
          title="RDA document"
          description="Upload the document to be reviewed."
          accept=".docx"
          acceptedExtensions=".DOCX"
          [required]="true"
          [uploadedFile]="minutaFile"
          (fileChange)="minutaFileChange.emit($event)"
        />
        <app-file-upload-box
          inputId="planilha-document"
          title="Spreadsheet"
          description="Upload the spreadsheet to be reviewed."
          accept=".xls,.xlsx"
          acceptedExtensions=".XLS, .XLSX"
          [required]="true"
          [uploadedFile]="planilhaFile"
          (fileChange)="planilhaFileChange.emit($event)"
        />
      </div>

      @if (submitError) {
        <p class="submit-error" role="alert">{{ submitError }}</p>
      }

      <app-rda-submit-actions
        [disabled]="submitDisabled"
        [submitting]="submitting"
        (submitRequested)="submitRequested.emit()"
      />
    </section>
  `,
  styleUrl: './rda-preparation-step.component.scss',
})
export class RdaPreparationStepComponent {
  @Input() minutaFile: UploadedFile | null = null;
  @Input() planilhaFile: UploadedFile | null = null;
  @Input() submitDisabled = true;
  @Input() submitting = false;
  @Input() submitError: string | null = null;
  @Output() readonly minutaFileChange = new EventEmitter<UploadedFile | null>();
  @Output() readonly planilhaFileChange = new EventEmitter<UploadedFile | null>();
  @Output() readonly submitRequested = new EventEmitter<void>();
}
