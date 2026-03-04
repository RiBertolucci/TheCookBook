import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoggerService } from './logger.service';

export interface FolderNode {
  files: string[];
  subdirs: { [name: string]: FolderNode };
}

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
  section: 'Recipes' | 'Ingredients' | 'SpicesAndHerbs';
  filename: string;
}

export interface DeleteFolderPayload {
  path: string;
}

export interface UpdateFilePayload {
  section: 'Recipes' | 'Ingredients' | 'SpicesAndHerbs';
  filename: string;
  markdown: string;
}

export interface IndexInfo {
  name: string;
  version: number;
  strategy: string;
}

export interface IndexSnapshot {
  name: string;
  version: number;
  strategy: string;
  updatedAt?: string;
  entries: { [key: string]: string[] };
}

export interface IndexSearchFile {
  path: string;
  section: 'Recipes' | 'Ingredients' | 'SpicesAndHerbs';
  filename: string;
  matchedTerms?: number;
  totalSelectedTerms?: number;
}

export interface IndexSearchGroup {
  matchedTerms: number;
  totalSelectedTerms: number;
  files: IndexSearchFile[];
}

export interface IndexSearchResponse {
  indexName: string;
  terms: string[];
  files: IndexSearchFile[];
  groupedByMatchedTerms?: IndexSearchGroup[];
}

@Injectable({
  providedIn: 'root'
})
export class ContentService {
  constructor(private http: HttpClient, private logger: LoggerService) {}

  sync(): Observable<{ status: string; message?: string }> {
    this.logger.info({ service: 'ContentService', method: 'sync' }, 'triggering backend sync');
    return this.http.post<{ status: string; message?: string }>('/api/sync', {});
  }

  forceIndexing(): Observable<{ status: string; message?: string }> {
    this.logger.info({ service: 'ContentService', method: 'forceIndexing' }, 'triggering full index rebuild');
    return this.http.post<{ status: string; message?: string }>('/api/indexes/rebuild', {});
  }

  getHierarchy(): Observable<{ [key: string]: FolderNode }> {
    this.logger.debug({ service: 'ContentService', method: 'getHierarchy' }, 'requesting hierarchy');
    return this.http.get<{ [key: string]: FolderNode }>('/api/hierarchy');
  }

  getIndexes(): Observable<{ indexes: IndexInfo[] }> {
    this.logger.debug({ service: 'ContentService', method: 'getIndexes' }, 'requesting index list');
    return this.http.get<{ indexes: IndexInfo[] }>('/api/indexes');
  }

  getIndexSnapshot(indexName: string): Observable<IndexSnapshot> {
    this.logger.debug({ service: 'ContentService', method: 'getIndexSnapshot', data: indexName }, 'requesting index snapshot');
    return this.http.get<IndexSnapshot>(`/api/indexes/${encodeURIComponent(indexName)}`);
  }

  searchIndexFiles(indexName: string, terms: string[]): Observable<IndexSearchResponse> {
    this.logger.info({ service: 'ContentService', method: 'searchIndexFiles', data: { indexName, terms } }, 'searching files by index');
    return this.http.post<IndexSearchResponse>(`/api/indexes/${encodeURIComponent(indexName)}/search`, { terms });
  }

  /**
   * Fetch the markdown content for a particular file. The `section`
   * should be one of "Recipes", "Ingredients" or "SpicesAndHerbs";
   * this helper constructs the correct API path and returns whatever the
   * server sends back ({ filename, type, content }).
   */
  getFile(section: string, filename: string): Observable<{ filename: string; type: string; content: string } | null> {
    // log call
    this.logger.debug({ service: 'ContentService', method: 'getFile', data: { section, filename } }, 'fetching file');
    // map section name to API endpoint segment
    let url: string;
    switch (section) {
      case 'Recipes':
        url = `/api/recipes/${filename}`;
        break;
      case 'Ingredients':
        url = `/api/ingredients/${filename}`;
        break;
      case 'SpicesAndHerbs':
        url = `/api/spices/${filename}`;
        break;
      default:
        throw new Error(`Unknown section ${section}`);
    }
    return this.http.get<{ filename: string; type: string; content: string } | null>(url);
  }

  createContent(payload: CreateContentPayload): Observable<CreateContentResponse> {
    this.logger.info({ service: 'ContentService', method: 'createContent', data: payload.path }, 'creating content file');
    return this.http.post<CreateContentResponse>('/api/addFile', payload);
  }

  updateFile(payload: UpdateFilePayload): Observable<CreateContentResponse> {
    this.logger.info({ service: 'ContentService', method: 'updateFile', data: payload }, 'updating content file');
    return this.http.post<CreateContentResponse>('/api/updateFile', payload);
  }

  deleteFile(payload: DeleteFilePayload): Observable<{ status: string; error?: string }> {
    this.logger.info({ service: 'ContentService', method: 'deleteFile', data: payload }, 'deleting content file');
    return this.http.post<{ status: string; error?: string }>('/api/deleteFile', payload);
  }

  deleteFolder(payload: DeleteFolderPayload): Observable<{ status: string; error?: string }> {
    this.logger.info({ service: 'ContentService', method: 'deleteFolder', data: payload.path }, 'deleting folder hierarchy');
    return this.http.post<{ status: string; error?: string }>('/api/deleteFolder', payload);
  }
}