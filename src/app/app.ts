import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import * as mammoth from 'mammoth';
import { firstValueFrom } from 'rxjs';
import { DocxComment, extractDocxComments } from './docx-comments';

type QueueCategory = 'review' | 'feedback';
type QueueTab = 'upload' | QueueCategory;
type PrimaryPage = 'queue' | 'skills';

interface QueueFilter {
  key: QueueTab;
  label: string;
}

interface ReviewMetric {
  label: string;
  value: number;
  limit: number;
}

interface ReviewAttachment {
  name: string;
  role: 'RDA' | 'Spreadsheet';
  downloadUrl: string;
  file: File;
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
  reviewStarted?: boolean;
  preparingPreview?: boolean;
  docxPreviewHtml?: string;
  generatedRdaUrl?: string;
  comments?: DocxComment[];
  previewError?: string;
  commentError?: string;
}

@Component({
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnDestroy {
  private readonly http = inject(HttpClient);
  protected readonly activePage = signal<PrimaryPage>('queue');
  protected readonly selectedQueue = signal<QueueTab>('upload');
  protected readonly selectedFiles = signal<Record<1 | 2, File | null>>({
    1: null,
    2: null,
  });

  private readonly reviewItems = signal<ReviewItem[]>([]);
  private readonly uploadObjectUrls: string[] = [];

  protected readonly queueCounts = computed(() => {
    const counts: Record<QueueCategory, number> = {
      review: 0,
      feedback: 0,
    };

    for (const item of this.reviewItems()) {
      counts[item.category] += 1;
    }

    return counts;
  });

  protected readonly totalQueueCount = computed(() =>
    Object.values(this.queueCounts()).reduce((total, count) => total + count, 0),
  );

  protected readonly queueFilters = computed<QueueFilter[]>(() => {
    return [
      { key: 'upload', label: 'Upload documents' },
      { key: 'review', label: 'To review' },
      { key: 'feedback', label: 'Feedbacks' },
    ];
  });

  protected readonly visibleItems = computed(() => {
    const selectedQueue = this.selectedQueue();

    return this.reviewItems().filter(
      (item) => selectedQueue !== 'upload' && item.category === selectedQueue,
    );
  });

  protected selectQueue(queue: QueueTab): void {
    this.selectedQueue.set(queue);
  }

  protected isStepCompleted(step: QueueTab): boolean {
    const stepOrder: QueueTab[] = ['upload', 'review', 'feedback'];
    return stepOrder.indexOf(step) < stepOrder.indexOf(this.selectedQueue());
  }

  protected selectPage(page: PrimaryPage): void {
    this.activePage.set(page);
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

    if (!firstFile) {
      return;
    }

    this.reviewItems.update((items) => [
      this.createUploadedReview(secondFile ? [firstFile, secondFile] : [firstFile]),
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

  protected async startReview(itemId: string): Promise<void> {
    const item = this.reviewItems().find((review) => review.id === itemId);
    const rda = item?.attachments?.find((attachment) => attachment.role === 'RDA');

    if (!item || !rda || item.reviewStarted) {
      return;
    }

    this.reviewItems.update((items) => items.map((review) =>
      review.id === itemId
        ? { ...review, category: 'feedback', reviewStarted: true, preparingPreview: true }
        : review,
    ));
    this.selectedQueue.set('feedback');

    try {
      const formData = new FormData();
      formData.append('file_1', rda.file, rda.name);
      const spreadsheet = item.attachments?.find(
        (attachment) => attachment.role === 'Spreadsheet',
      );
      if (spreadsheet) {
        formData.append('file_2', spreadsheet.file, spreadsheet.name);
      }

      const mockRda = await firstValueFrom(
        this.http.post('http://localhost:8000/api/reviews/ingest', formData, {
          responseType: 'blob',
        }),
      );
      const generatedRdaUrl = URL.createObjectURL(mockRda);
      this.uploadObjectUrls.push(generatedRdaUrl);
      this.updateReview(itemId, { generatedRdaUrl });
      const result = await mammoth.convertToHtml({
        arrayBuffer: await mockRda.arrayBuffer(),
      });
      if (!result.value.trim()) {
        throw new Error('The document contains no previewable text.');
      }
      let comments: DocxComment[] = [];
      let commentError: string | undefined;
      try {
        comments = await extractDocxComments(mockRda);
      } catch (error: unknown) {
        const reason = error instanceof Error ? ` ${error.message}` : '';
        commentError = `Could not display DOCX comments.${reason}`;
      }
      this.updateReview(itemId, {
        docxPreviewHtml: result.value,
        comments,
        commentError,
      });
    } catch (error: unknown) {
      const reason = error instanceof HttpErrorResponse
        ? ` Request failed (${error.status}): ${error.message}`
        : error instanceof Error
          ? ` ${error.message}`
          : ' An unknown error occurred.';
      this.updateReview(itemId, {
        previewError: `Could not display the DOCX preview.${reason}`,
      });
    } finally {
      this.updateReview(itemId, { preparingPreview: false });
    }
  }

  private updateReview(itemId: string, changes: Partial<ReviewItem>): void {
    this.reviewItems.update((items) => items.map((item) =>
      item.id === itemId ? { ...item, ...changes } : item,
    ));
  }

  private createUploadedReview(files: File[]): ReviewItem {
    return {
      id: `UP-${Date.now()}`,
      organization: 'New RDA Submitted',
      organizationInitials: 'NR',
      project: 'Uploaded files',
      file: `${files.length} uploaded documents`,
      amount: 'Pending review',
      version: 'v1',
      age: 'Just now',
      overdue: false,
      category: 'review',
      attachments: files.map((file, index) => {
        const downloadUrl = URL.createObjectURL(file);
        this.uploadObjectUrls.push(downloadUrl);
        return {
          name: file.name,
          role: index === 0 ? 'RDA' : 'Spreadsheet',
          downloadUrl,
          file,
        };
      }),
      metrics: [
        { label: 'Financial', value: 0, limit: 95 },
        { label: 'EPA', value: 0, limit: 100 },
        { label: 'Operational', value: 0, limit: 95 },
      ],
    };
  }
}
