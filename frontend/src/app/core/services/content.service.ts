import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { LoggerService } from './logger.service';
import {
  ContentFileResponse,
  CreateContentPayload,
  CreateContentResponse,
  DeleteFilePayload,
  DeleteFolderPayload,
  FolderNode,
  IngredientFamiliesResponse,
  IngredientFamilyByNameResponse,
  IndexInfo,
  IndexSearchResponse,
  IndexSnapshot,
  IngredientSuggestionsResponse,
  LastShoppingListResponse,
  SendShoppingListResponse,
  TelegramTargetsResponse,
  UpdateFilePayload
} from '../interfaces/content';

@Injectable({
  providedIn: 'root'
})
export class ContentService {
  private hierarchyCache$?: Observable<{ [key: string]: FolderNode }>;
  private ingredientSuggestionsCache$?: Observable<IngredientSuggestionsResponse>;
  private ingredientFamiliesCache$?: Observable<IngredientFamiliesResponse>;

  constructor(private http: HttpClient, private logger: LoggerService) {}

  sync(): Observable<{ status: string; message?: string }> {
    this.logger.info({ service: 'ContentService', method: 'sync' }, 'triggering backend sync');
    return this.http.post<{ status: string; message?: string }>('/api/sync', {}).pipe(
      tap(() => this.invalidateContentCaches())
    );
  }

  forceIndexing(): Observable<{ status: string; message?: string }> {
    this.logger.info({ service: 'ContentService', method: 'forceIndexing' }, 'triggering full index rebuild');
    return this.http.post<{ status: string; message?: string }>('/api/indexes/rebuild', {}).pipe(
      tap(() => this.invalidateContentCaches())
    );
  }

  getHierarchy(forceRefresh = false): Observable<{ [key: string]: FolderNode }> {
    if (forceRefresh || !this.hierarchyCache$) {
      this.logger.debug({ service: 'ContentService', method: 'getHierarchy' }, 'requesting hierarchy');
      this.hierarchyCache$ = this.http.get<{ [key: string]: FolderNode }>('/api/hierarchy').pipe(
        catchError((err) => {
          this.invalidateHierarchyCache();
          return throwError(() => err);
        }),
        shareReplay(1)
      );
    }

    return this.hierarchyCache$;
  }

  getIndexes(): Observable<{ indexes: IndexInfo[] }> {
    this.logger.debug({ service: 'ContentService', method: 'getIndexes' }, 'requesting index list');
    return this.http.get<{ indexes: IndexInfo[] }>('/api/indexes');
  }

  getIngredientSuggestions(forceRefresh = false): Observable<IngredientSuggestionsResponse> {
    if (forceRefresh || !this.ingredientSuggestionsCache$) {
      this.logger.debug({ service: 'ContentService', method: 'getIngredientSuggestions' }, 'requesting ingredient suggestions');
      this.ingredientSuggestionsCache$ = this.http.get<IngredientSuggestionsResponse>('/api/ingredients/suggestions').pipe(
        catchError((err) => {
          this.invalidateIngredientSuggestionsCache();
          return throwError(() => err);
        }),
        shareReplay(1)
      );
    }

    return this.ingredientSuggestionsCache$;
  }

  getIngredientFamilies(forceRefresh = false): Observable<IngredientFamiliesResponse> {
    if (forceRefresh || !this.ingredientFamiliesCache$) {
      this.logger.debug({ service: 'ContentService', method: 'getIngredientFamilies' }, 'requesting ingredient families');
      this.ingredientFamiliesCache$ = this.http.get<IngredientFamiliesResponse>('/api/ingredients/families').pipe(
        catchError((err) => {
          this.invalidateIngredientFamiliesCache();
          return throwError(() => err);
        }),
        shareReplay(1)
      );
    }

    return this.ingredientFamiliesCache$;
  }

  getIngredientFamilyByName(name: string): Observable<IngredientFamilyByNameResponse> {
    const encodedName = encodeURIComponent(String(name || '').trim());
    return this.http.get<IngredientFamilyByNameResponse>(`/api/ingredients/families/${encodedName}`);
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
  getFile(section: string, filename: string): Observable<ContentFileResponse | null> {
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
    return this.http.get<ContentFileResponse | null>(url);
  }

  createContent(payload: CreateContentPayload): Observable<CreateContentResponse> {
    this.logger.info({ service: 'ContentService', method: 'createContent', data: payload.path }, 'creating content file');
    return this.http.post<CreateContentResponse>('/api/addFile', payload).pipe(
      tap(() => this.invalidateContentCaches())
    );
  }

  updateFile(payload: UpdateFilePayload): Observable<CreateContentResponse> {
    this.logger.info({ service: 'ContentService', method: 'updateFile', data: payload }, 'updating content file');
    return this.http.post<CreateContentResponse>('/api/updateFile', payload).pipe(
      tap(() => this.invalidateContentCaches())
    );
  }

  deleteFile(payload: DeleteFilePayload): Observable<{ status: string; error?: string }> {
    this.logger.info({ service: 'ContentService', method: 'deleteFile', data: payload }, 'deleting content file');
    return this.http.post<{ status: string; error?: string }>('/api/deleteFile', payload).pipe(
      tap(() => this.invalidateContentCaches())
    );
  }

  deleteFolder(payload: DeleteFolderPayload): Observable<{ status: string; error?: string }> {
    this.logger.info({ service: 'ContentService', method: 'deleteFolder', data: payload.path }, 'deleting folder hierarchy');
    return this.http.post<{ status: string; error?: string }>('/api/deleteFolder', payload).pipe(
      tap(() => this.invalidateContentCaches())
    );
  }

  private invalidateContentCaches(): void {
    this.invalidateHierarchyCache();
    this.invalidateIngredientSuggestionsCache();
    this.invalidateIngredientFamiliesCache();
  }

  private invalidateHierarchyCache(): void {
    this.hierarchyCache$ = undefined;
  }

  private invalidateIngredientSuggestionsCache(): void {
    this.ingredientSuggestionsCache$ = undefined;
  }

  private invalidateIngredientFamiliesCache(): void {
    this.ingredientFamiliesCache$ = undefined;
  }

  sendShoppingListToTelegram(items: string[], targetId: string): Observable<SendShoppingListResponse> {
    this.logger.info(
      { service: 'ContentService', method: 'sendShoppingListToTelegram', data: { count: items.length, targetId } },
      'sending shopping list to telegram'
    );
    return this.http.post<SendShoppingListResponse>('/api/shopping-list/telegram', { items, targetId });
  }

  getLastShoppingListFromTelegram(targetId: string): Observable<LastShoppingListResponse> {
    this.logger.info({ service: 'ContentService', method: 'getLastShoppingListFromTelegram', data: targetId }, 'loading last shopping list sent to telegram');
    return this.http.get<LastShoppingListResponse>(`/api/shopping-list/telegram/last?targetId=${encodeURIComponent(targetId)}`);
  }

  getTelegramTargets(): Observable<TelegramTargetsResponse> {
    this.logger.info({ service: 'ContentService', method: 'getTelegramTargets' }, 'loading telegram targets');
    return this.http.get<TelegramTargetsResponse>('/api/shopping-list/telegram/targets');
  }
}