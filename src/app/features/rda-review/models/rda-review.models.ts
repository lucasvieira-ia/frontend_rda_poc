export type RdaStepId = 'preparation' | 'analysis';

export interface Step {
  id: RdaStepId;
  label: string;
  description: string;
  isActive: boolean;
  isCompleted: boolean;
}

export interface UploadedFile {
  file: File | null;
  name: string;
  size: number;
  isValid: boolean;
  error?: string;
}

export interface RdaSubmissionForm {
  minutaDocument: UploadedFile;
  planilhaDocument: UploadedFile;
}
