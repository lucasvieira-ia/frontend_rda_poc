import { Component } from '@angular/core';

@Component({
  selector: 'app-rda-header',
  standalone: true,
  template: `
    <header class="rda-header">
      <a class="brand" href="#rda-review" aria-label="RDA Review home">
        <span class="brand-mark" aria-hidden="true">R</span>
        <span class="brand-name">rda<span>review</span></span>
      </a>
      <span class="header-context">DOCUMENT WORKSPACE</span>
    </header>
  `,
  styleUrl: './rda-header.component.scss',
})
export class RdaHeaderComponent {}
