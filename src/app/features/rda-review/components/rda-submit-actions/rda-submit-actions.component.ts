import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-rda-submit-actions',
  standalone: true,
  template: `
    <div class="submit-actions">
      <span class="required-note">
        <span aria-hidden="true">*</span> RDA document and spreadsheet are required
      </span>
      <button
        class="submit-button"
        type="button"
        [disabled]="disabled || submitting"
        (click)="submitRequested.emit()"
      >
        @if (submitting) {
          <span class="button-spinner" aria-hidden="true"></span>
          Submitting...
        } @else {
          Continue to analysis
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 10h13m-5-5 5 5-5 5"></path>
          </svg>
        }
      </button>
    </div>
  `,
  styleUrl: './rda-submit-actions.component.scss',
})
export class RdaSubmitActionsComponent {
  @Input() disabled = false;
  @Input() submitting = false;
  @Output() readonly submitRequested = new EventEmitter<void>();
}
