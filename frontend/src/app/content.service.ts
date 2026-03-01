import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoggerService } from './logger.service';

export interface FolderNode {
  files: string[];
  subdirs: { [name: string]: FolderNode };
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

  getHierarchy(): Observable<{ [key: string]: FolderNode }> {
    this.logger.debug({ service: 'ContentService', method: 'getHierarchy' }, 'requesting hierarchy');
    return this.http.get<{ [key: string]: FolderNode }>('/api/hierarchy');
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
}