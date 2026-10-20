import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DragAndDropDirective } from '../../directives/drag-and-drop.directive';
import { UploadedFile } from '../../models/rda-review.models';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

@Component({
  selector: 'app-file-upload-box',
  standalone: true,
  imports: [DragAndDropDirective],
  template: `
    <section class="upload-card" [attr.aria-labelledby]="inputId + '-title'">
      <div class="upload-card-heading">
        <div>
          <h2 [id]="inputId + '-title'">{{ title }}</h2>
          <p>{{ description }}</p>
        </div>
        @if (required) {
          <span class="required-badge">Required</span>
        } @else {
          <span class="optional-badge">Optional</span>
        }
      </div>

      <div
        class="drop-zone"
        appDragAndDrop
        (fileDropped)="onFileDropped($event)"
        [class.has-file]="uploadedFile?.isValid"
        [class.has-error]="uploadedFile && !uploadedFile.isValid"
      >
        <input
          #fileInput
          class="visually-hidden"
          type="file"
          [id]="inputId"
          [accept]="accept"
          [attr.aria-label]="'Choose ' + title"
          (change)="onFileSelected($event)"
        />
        <span class="upload-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 15V4m0 0L8 8m4-4 4 4M5 14v5h14v-5"></path>
          </svg>
        </span>
        <strong>Drag and drop your file here</strong>
        <span class="drop-hint">or</span>
        <button class="browse-button" type="button" (click)="fileInput.click()">
          Browse files
        </button>
        <span class="file-constraints">Accepted: {{ acceptedExtensions }}</span>
      </div>

      @if (uploadedFile) {
        <div
          class="selected-file"
          [class.invalid-file]="!uploadedFile.isValid"
          [attr.role]="uploadedFile.error ? 'alert' : null"
        >
          <span class="selected-file-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M6 3.75h8l4 4v12.5H6z"></path>
              <path d="M14 3.75v4h4"></path>
            </svg>
          </span>
          <span class="selected-file-copy">
            <strong [title]="uploadedFile.name">{{ uploadedFile.name }}</strong>
            @if (uploadedFile.error; as error) {
              <span class="file-error">{{ error }}</span>
            } @else {
              <span>{{ formatFileSize(uploadedFile.size) }}</span>
            }
          </span>
          <button
            class="remove-file"
            type="button"
            [attr.aria-label]="'Remove ' + uploadedFile.name"
            (click)="fileChange.emit(null)"
          >
            Remove
          </button>
        </div>
      }
    </section>
  `,
  styleUrl: './file-upload-box.component.scss',
})
export class FileUploadBoxComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() inputId = 'document-upload';
  @Input() accept = '.docx';
  @Input() acceptedExtensions = '.DOCX';
  @Input() required = false;
  @Input() uploadedFile: UploadedFile | null = null;
  @Output() readonly fileChange = new EventEmitter<UploadedFile | null>();

  protected onFileSelected(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      const file = event.target.files?.item(0);
      if (file) {
        this.setFile(file);
      }
      event.target.value = '';
    }
  }

  protected onFileDropped(file: File): void {
    this.setFile(file);
  }

  protected formatFileSize(size: number): string {
    return size < 1024 * 1024
      ? `${Math.max(1, Math.round(size / 1024))} KB`
      : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private setFile(file: File): void {
    const acceptedExtensions = this.accept
      .split(',')
      .map((extension) => extension.trim().toLocaleLowerCase())
      .filter(Boolean);
    const hasAcceptedExtension = acceptedExtensions.some((extension) =>
      file.name.toLocaleLowerCase().endsWith(extension),
    );
    let error: string | undefined;

    if (!hasAcceptedExtension) {
      error = `Choose a file with one of these extensions: ${this.acceptedExtensions}.`;
    } else if (file.size === 0) {
      error = 'The selected file is empty.';
    } else if (file.size > MAX_FILE_SIZE_BYTES) {
      error = 'The file must be no larger than 20 MB.';
    }

    this.fileChange.emit({
      file,
      name: file.name,
      size: file.size,
      isValid: !error,
      error,
    });
  }
}
