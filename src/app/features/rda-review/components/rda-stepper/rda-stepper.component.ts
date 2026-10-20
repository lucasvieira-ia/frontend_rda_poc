import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Step } from '../../models/rda-review.models';

@Component({
  selector: 'app-rda-stepper',
  standalone: true,
  template: `
    <nav class="stepper" aria-label="Submission progress">
      <ol class="step-list">
        @for (step of steps; track step.id; let last = $last) {
          <li class="step-item" [class.completed]="step.isCompleted">
            <button
              class="step-button"
              type="button"
              [disabled]="!step.isActive && !step.isCompleted"
              [class.active]="step.isActive"
              [attr.aria-current]="step.isActive ? 'step' : null"
              (click)="stepSelected.emit(step.id)"
            >
              <span class="step-indicator" aria-hidden="true">
                @if (step.isCompleted || step.isActive) {
                  ✓
                } @else {
                  {{ $index + 1 }}
                }
              </span>
              <span class="step-copy">
                <strong>{{ step.label }}</strong>
                <span>{{ step.description }}</span>
              </span>
            </button>
            @if (!last) {
              <span class="step-connector" aria-hidden="true"></span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styleUrl: './rda-stepper.component.scss',
})
export class RdaStepperComponent {
  @Input() steps: Step[] = [];
  @Output() readonly stepSelected = new EventEmitter<Step['id']>();
}
