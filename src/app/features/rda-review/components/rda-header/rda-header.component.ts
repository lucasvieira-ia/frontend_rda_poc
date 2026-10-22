import { Component } from '@angular/core';

@Component({
  selector: 'app-rda-header',
  standalone: true,
  template: `
    <header class="rda-header">
      <a class="brand" href="#rda-review" aria-label="Dell Technologies">
        <span class="brand-name"><strong>DELL</strong><span>Technologies</span></span>
      </a>
      <button class="user-menu" type="button" aria-label="User Francesca">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="6" r="3"></circle>
          <path d="M4.5 16v-1.5a5.5 5.5 0 0 1 11 0V16z"></path>
        </svg>
        <span>Francesca</span>
        <span class="user-chevron" aria-hidden="true"></span>
      </button>
    </header>
  `,
  styleUrl: './rda-header.component.scss',
})
export class RdaHeaderComponent {}
