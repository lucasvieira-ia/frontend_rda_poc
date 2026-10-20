import { Component } from '@angular/core';
import { RdaReviewContainerComponent } from './features/rda-review/components/rda-review-container/rda-review-container.component';

@Component({
  imports: [RdaReviewContainerComponent],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {}
