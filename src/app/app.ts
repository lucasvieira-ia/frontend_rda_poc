import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

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
  generatingFiles?: boolean;
  generatedRdaUrl?: string;
  generationError?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
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
    const spreadsheet = item?.attachments?.find(
      (attachment) => attachment.role === 'Spreadsheet',
    );

    if (!item || !rda || item.reviewStarted) {
      return;
    }

    this.reviewItems.update((items) => items.map((review) =>
      review.id === itemId
        ? {
            ...review,
            category: 'feedback',
            reviewStarted: true,
            generatingFiles: true,
            spreadsheetName: spreadsheet?.name,
          }
        : review,
    ));
    this.selectedQueue.set('feedback');

    await this.requestReviewFiles(itemId, rda, spreadsheet);
  }

  private async requestReviewFiles(
    itemId: string,
    rda: ReviewAttachment,
    spreadsheet?: ReviewAttachment,
  ): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file_1', rda.file, rda.name);
      if (spreadsheet) {
        formData.append('file_2', spreadsheet.file, spreadsheet.name);
      }
      const response = await firstValueFrom(
        this.http.post('http://localhost:8000/api/reviews/ingest', formData, {
          observe: 'response',
          responseType: 'blob',
        }),
      );
      if (!response.body) {
        throw new Error('The API response did not contain downloadable files.');
      }
      const contentType = response.headers.get('Content-Type');
      if (!contentType?.toLocaleLowerCase().startsWith('multipart/form-data;')) {
        throw new Error('The API response was not multipart/form-data.');
      }
      const multipartResponse = new Response(response.body, {
        headers: { 'Content-Type': contentType },
      });
      const files = await multipartResponse.formData();
      const rdaFile = files.get('rda');
      if (!(rdaFile instanceof Blob)) {
        throw new Error('The API response does not contain the RDA file part.');
      }
      let spreadsheetFile: Blob | null = null;
      if (spreadsheet) {
        const returnedSpreadsheet = files.get('spreadsheet');
        if (!(returnedSpreadsheet instanceof Blob)) {
          throw new Error('The API response does not contain the spreadsheet file part.');
        }
        spreadsheetFile = returnedSpreadsheet;
      }
      const generatedRdaUrl = URL.createObjectURL(
        new Blob([rdaFile], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      );
      this.uploadObjectUrls.push(generatedRdaUrl);
      const changes: Partial<ReviewItem> = { generatedRdaUrl };
      if (spreadsheet && spreadsheetFile) {
        const spreadsheetUrl = URL.createObjectURL(
          new Blob([spreadsheetFile], { type: spreadsheet.file.type }),
        );
        this.uploadObjectUrls.push(spreadsheetUrl);
        changes.spreadsheetUrl = spreadsheetUrl;
      }
      this.updateReview(itemId, changes);
    } catch (error: unknown) {
      this.updateReview(itemId, {
        generationError: `Could not generate the RDA.${this.errorReason(error)}`,
      });
    } finally {
      this.updateReview(itemId, { generatingFiles: false });
    }
  }

  private errorReason(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return ` Request failed (${error.status}): ${error.message}`;
    }
    if (error instanceof Error) {
      return ` ${error.message}`;
    }
    return ' An unknown error occurred.';
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
