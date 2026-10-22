import { Component } from '@angular/core';

@Component({
  selector: 'app-rda-header',
  standalone: true,
  template: `
    <header class="rda-header">
      <a class="brand" href="#rda-review" aria-label="Dell Technologies">
        <span class="brand-name"><strong>DELL</strong><span>Technologies</span></span>
      </a>
    </header>
  `,
  styleUrl: './rda-header.component.scss',
})
export class RdaHeaderComponent {}
