import { ContentSection } from './content-common.interface';

export interface CreateContentPayload {
  path: string;
  title: string;
  markdown: string;
}

export interface CreateContentResponse {
  status: string;
  file?: string;
  error?: string;
}

export interface DeleteFilePayload {
  section: ContentSection;
  filename: string;
}

export interface DeleteFolderPayload {
  path: string;
}

export interface UpdateFilePayload {
  section: ContentSection;
  filename: string;
  markdown: string;
}

export interface ContentFileResponse {
  filename: string;
  type: string;
  content: string;
}
