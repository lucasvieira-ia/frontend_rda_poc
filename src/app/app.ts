import { Component, computed, OnDestroy, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

type QueueCategory = 'review' | 'feedback' | 'confirmation' | 'peer';

interface ReviewMetric {
  label: string;
  value: number;
  limit: number;
}

interface ReviewAttachment {
  name: string;
  downloadUrl: string;
  file: File;
}

interface IngestResponse {
  submission_id: string;
  status: string;
  processing: string;
  message: string;
  files: Array<{
    filename: string;
    content_type: string | null;
    size_bytes: number;
  }>;
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
  attachments?: ReviewAttachment[];
}

@Component({
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnDestroy {
  private readonly apiUrl = 'http://localhost:8000/api/reviews/ingest';

  protected readonly selectedQueue = signal<QueueCategory>('review');
  protected readonly searchTerm = signal('');
  protected readonly calibrationMode = signal(false);
  protected readonly startedReviewId = signal<string | null>(null);
  protected readonly uploadingReviewId = signal<string | null>(null);
  protected readonly uploadErrors = signal<Record<string, string>>({});
  protected readonly selectedFiles = signal<Record<1 | 2, File | null>>({
    1: null,
    2: null,
  });

  private readonly reviewItems = signal<ReviewItem[]>([]);
  private readonly uploadObjectUrls: string[] = [];

  constructor(private readonly http: HttpClient) {}

  protected readonly queueCounts = computed(() => {
    const counts: Record<QueueCategory, number> = {
      review: 0,
      feedback: 0,
      confirmation: 0,
      peer: 0,
    };

    for (const item of this.reviewItems()) {
      counts[item.category] += 1;
    }

    return counts;
  });

  protected readonly totalQueueCount = computed(() =>
    Object.values(this.queueCounts()).reduce((total, count) => total + count, 0),
  );

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

    return this.reviewItems().filter((item) => {
      const matchesQueue = item.category === this.selectedQueue();
      const searchableText = [
        item.organization,
        item.project,
        item.id,
        item.file,
        ...(item.attachments?.map((attachment) => attachment.name) ?? []),
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

  protected onFileSelected(event: Event, fileSlot: 1 | 2): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    this.selectedFiles.update((files) => ({ ...files, [fileSlot]: file }));
    input.value = '';
  }

  protected finalizeUpload(): void {
    const files = this.selectedFiles();
    const firstFile = files[1];
    const secondFile = files[2];

    if (!firstFile || !secondFile) {
      return;
    }

    this.reviewItems.update((items) => [
      this.createUploadedReview([firstFile, secondFile]),
      ...items,
    ]);
    this.selectedFiles.set({ 1: null, 2: null });
    this.selectedQueue.set('review');
  }

  ngOnDestroy(): void {
    for (const objectUrl of this.uploadObjectUrls) {
      URL.revokeObjectURL(objectUrl);
    }
  }

  protected toggleCalibrationMode(): void {
    this.calibrationMode.update((enabled) => !enabled);
  }

  protected startReview(itemId: string): void {
    const item = this.reviewItems().find((review) => review.id === itemId);
    const attachments = item?.attachments;

    if (!attachments || attachments.length !== 2 || this.uploadingReviewId()) {
      return;
    }

    const formData = new FormData();
    formData.append('file_1', attachments[0].file, attachments[0].name);
    formData.append('file_2', attachments[1].file, attachments[1].name);
    this.uploadingReviewId.set(itemId);
    this.uploadErrors.update((errors) => {
      const { [itemId]: _previousError, ...remainingErrors } = errors;
      return remainingErrors;
    });

    this.http.post<IngestResponse>(this.apiUrl, formData).subscribe({
      next: () => this.startedReviewId.set(itemId),
      error: (error: unknown) => {
        const message = error instanceof HttpErrorResponse
          ? `Could not send documents to the backend (HTTP ${error.status || 'network error'}).`
          : 'Could not send documents to the backend.';
        this.uploadErrors.update((errors) => ({ ...errors, [itemId]: message }));
        this.uploadingReviewId.set(null);
      },
      complete: () => this.uploadingReviewId.set(null),
    });
  }

  private createUploadedReview(files: File[]): ReviewItem {
    return {
      id: `UP-${Date.now()}`,
      organization: 'New submission',
      organizationInitials: 'NS',
      project: 'Uploaded files',
      file: `${files.length} uploaded documents`,
      amount: 'Pending review',
      version: 'v1',
      age: 'Just now',
      overdue: false,
      category: 'review',
      attachments: files.map((file) => {
        const downloadUrl = URL.createObjectURL(file);
        this.uploadObjectUrls.push(downloadUrl);
        return { name: file.name, downloadUrl, file };
      }),
      metrics: [
        { label: 'Financial', value: 0, limit: 95 },
        { label: 'EPA', value: 0, limit: 100 },
        { label: 'Operational', value: 0, limit: 95 },
      ],
    };
  }
}
