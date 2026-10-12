import { Component, computed, signal } from '@angular/core';

type QueueCategory = 'review' | 'feedback' | 'confirmation' | 'peer';

interface ReviewMetric {
  label: string;
  value: number;
  limit: number;
}

interface ReviewItem {
  id: string;
  organization: string;
  organizationInitials: string;
  project: string;
  file: string;
  amount: string;
  version: string;
  age: string;
  overdue: boolean;
  category: QueueCategory;
  metrics: ReviewMetric[];
}

@Component({
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly selectedQueue = signal<QueueCategory>('review');
  protected readonly searchTerm = signal('');
  protected readonly calibrationMode = signal(false);
  protected readonly startedReviewId = signal<string | null>(null);
  protected readonly selectedFiles = signal<Record<number, File | null>>({
    1: null,
    2: null,
  });

  private readonly reviewItems: ReviewItem[] = [
    {
      id: 'PD-2026-0147',
      organization: 'Instituto Meridiano',
      organizationInitials: 'IM',
      project: 'Mobile development training',
      file: 'Document · Training',
      amount: 'R$ 1,200,000.00',
      version: 'v1',
      age: '4 days',
      overdue: true,
      category: 'review',
      metrics: [
        { label: 'Financial', value: 95, limit: 95 },
        { label: 'EPA', value: 100, limit: 100 },
        { label: 'Operational', value: 98, limit: 95 },
      ],
    },
    {
      id: 'PD-2026-0132',
      organization: 'Fundação Horizonte',
      organizationInitials: 'FH',
      project: 'Digital inclusion for youth',
      file: 'Document · Project plan',
      amount: 'R$ 845,500.00',
      version: 'v2',
      age: '1 day',
      overdue: false,
      category: 'review',
      metrics: [
        { label: 'Financial', value: 88, limit: 95 },
        { label: 'EPA', value: 92, limit: 100 },
        { label: 'Operational', value: 96, limit: 95 },
      ],
    },
    {
      id: 'PD-2026-0126',
      organization: 'Associação Novo Rumo',
      organizationInitials: 'NR',
      project: 'Community health initiative',
      file: 'Document · Feedback report',
      amount: 'R$ 620,000.00',
      version: 'v3',
      age: '2 days',
      overdue: false,
      category: 'feedback',
      metrics: [
        { label: 'Financial', value: 91, limit: 95 },
        { label: 'EPA', value: 97, limit: 100 },
        { label: 'Operational', value: 94, limit: 95 },
      ],
    },
    {
      id: 'PD-2026-0119',
      organization: 'Instituto Caminhos',
      organizationInitials: 'IC',
      project: 'Technical education program',
      file: 'Document · Type review',
      amount: 'R$ 980,000.00',
      version: 'v1',
      age: '3 days',
      overdue: false,
      category: 'confirmation',
      metrics: [
        { label: 'Financial', value: 93, limit: 95 },
        { label: 'EPA', value: 89, limit: 100 },
        { label: 'Operational', value: 97, limit: 95 },
      ],
    },
    {
      id: 'PD-2026-0108',
      organization: 'Rede Sementes',
      organizationInitials: 'RS',
      project: 'Sustainable agriculture network',
      file: 'Document · Peer assessment',
      amount: 'R$ 1,450,000.00',
      version: 'v4',
      age: '1 day',
      overdue: false,
      category: 'peer',
      metrics: [
        { label: 'Financial', value: 96, limit: 95 },
        { label: 'EPA', value: 100, limit: 100 },
        { label: 'Operational', value: 92, limit: 95 },
      ],
    },
  ];

  protected readonly queueCounts = computed(() => {
    const counts: Record<QueueCategory, number> = {
      review: 0,
      feedback: 0,
      confirmation: 0,
      peer: 0,
    };

    for (const item of this.reviewItems) {
      counts[item.category] += 1;
    }

    return counts;
  });

  protected readonly queueFilters = computed(() => {
    const counts = this.queueCounts();

    return [
      { key: 'review', label: 'To review', count: counts.review },
      { key: 'feedback', label: 'Feedbacks to approve', count: counts.feedback },
      { key: 'confirmation', label: 'Type confirmation', count: counts.confirmation },
      { key: 'peer', label: 'Peer review', count: counts.peer },
    ] as const;
  });

  protected readonly queueSummary = computed(() => {
    const counts = this.queueCounts();
    const summary = [
      `${counts.review} ${counts.review === 1 ? 'review' : 'reviews'}`,
      `${counts.feedback} ${counts.feedback === 1 ? 'feedback to approve' : 'feedbacks to approve'}`,
      `${counts.confirmation} ${counts.confirmation === 1 ? 'type confirmation' : 'type confirmations'}`,
      `${counts.peer} ${counts.peer === 1 ? 'peer review' : 'peer reviews'}`,
    ];

    return summary.join(' • ');
  });

  protected readonly visibleItems = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();

    return this.reviewItems.filter((item) => {
      const matchesQueue = item.category === this.selectedQueue();
      const searchableText = [
        item.organization,
        item.project,
        item.id,
        item.file,
      ]
        .join(' ')
        .toLocaleLowerCase();

      return matchesQueue && (!query || searchableText.includes(query));
    });
  });

  protected selectQueue(queue: QueueCategory): void {
    this.selectedQueue.set(queue);
  }

  protected onSearch(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchTerm.set(event.target.value);
    }
  }

  protected onFileSelected(event: Event, fileSlot: number): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    this.selectedFiles.update((files) => ({ ...files, [fileSlot]: file }));
  }

  protected finalizeUpload(): void {
    const files = this.selectedFiles();

    if (!files[1] || !files[2]) {
      return;
    }

    this.reviewItems.unshift(
      this.createUploadedReview(files[2], 2),
      this.createUploadedReview(files[1], 1),
    );
    this.selectedFiles.set({ 1: null, 2: null });
    this.selectedQueue.set('review');
  }

  protected toggleCalibrationMode(): void {
    this.calibrationMode.update((enabled) => !enabled);
  }

  protected startReview(itemId: string): void {
    this.startedReviewId.set(itemId);
  }

  private createUploadedReview(file: File, fileSlot: number): ReviewItem {
    const baseName = file.name.includes('.') ? file.name.split('.').slice(0, -1).join('.') : file.name;
    const initials = (baseName || `Upload ${fileSlot}`)
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || `U${fileSlot}`;

    return {
      id: `UP-${Date.now()}-${fileSlot}`,
      organization: `Uploaded document ${fileSlot}`,
      organizationInitials: initials,
      project: `Submission ${fileSlot}`,
      file: `Document · ${file.name}`,
      amount: 'Pending review',
      version: 'v1',
      age: 'Just now',
      overdue: false,
      category: 'review',
      metrics: [
        { label: 'Financial', value: 0, limit: 95 },
        { label: 'EPA', value: 0, limit: 100 },
        { label: 'Operational', value: 0, limit: 95 },
      ],
    };
  }
}
