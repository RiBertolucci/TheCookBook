import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ContentBrowserComponent } from './features/content/browser/content-browser.component';
import { SearchTabComponent } from './features/search/search-tab.component';
import { EditRequest } from './features/content/models/content-shell.models';
import { LoggerService } from './core/services/logger.service';
import { ContentService } from './core/services/content.service';
import { ContentSection, FolderNode, ImportContentKind, IndexSearchFile } from './core/interfaces/content';

type MainTab = 'overview' | 'search' | 'shopping' | 'mixer';

interface OpenContentFileRef {
  section: ContentSection;
  filename: string;
}

type CreateEditorMode = 'frontend';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit {
  private contentBrowserInstance?: ContentBrowserComponent;
  private searchTabInstance?: SearchTabComponent;
  private overviewActiveRestoreIntervalId: number | null = null;

  @ViewChild(ContentBrowserComponent)
  set contentBrowser(component: ContentBrowserComponent | undefined) {
    this.contentBrowserInstance = component;
    if (component) {
      this.restoreOverviewOpenFiles(component);
    }
  }

  @ViewChild(SearchTabComponent)
  set searchTab(component: SearchTabComponent | undefined) {
    this.searchTabInstance = component;
    if (component) {
      this.restoreSearchOpenedFile(component);
    }
  }

  title = 'TheCookBook';
  isEditPage = false;
  isSettingsOpen = false;
  isCreateMenuOpen = false;
  isSyncing = false;
  isForceIndexing = false;
  isAddingTelegramUser = false;
  telegramAddUserMessage = '';
  telegramAddUserError = false;
  activeMainTab: MainTab = 'overview';
  theme: 'light' | 'dark' = 'light';
  activeEditRequest: EditRequest | null = null;

  isImportModalOpen = false;
  isImporting = false;
  importKind: ImportContentKind = 'ingredient';
  importPath = '';
  importDragActive = false;
  importSelectedFile: File | null = null;
  importError = '';
  importSuccess = '';
  private importHierarchy: { [key: string]: FolderNode } = {};

  constructor(
    private router: Router,
    private logger: LoggerService,
    private content: ContentService
  ) {}

  ngOnInit(): void {
    this.loadTheme();
    this.updateRouteState(this.router.url);
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => this.updateRouteState((event as NavigationEnd).urlAfterRedirects));
  }

  goToEdit(): void {
    this.persistCurrentMainTabState();
    this.isCreateMenuOpen = false;
    this.activeEditRequest = null;
    this.router.navigate(['/edit']);
  }

  toggleCreateMenu(): void {
    this.isCreateMenuOpen = !this.isCreateMenuOpen;
    if (this.isCreateMenuOpen) {
      this.isSettingsOpen = false;
      this.telegramAddUserMessage = '';
      this.telegramAddUserError = false;
    }
  }

  openCreateEditor(_mode: CreateEditorMode): void {
    this.isCreateMenuOpen = false;
    this.goToEdit();
  }

  openImportModal(): void {
    this.isCreateMenuOpen = false;
    this.isSettingsOpen = false;
    this.importError = '';
    this.importSuccess = '';
    this.importDragActive = false;
    this.isImportModalOpen = true;
    this.loadImportHierarchy();
  }

  closeImportModal(): void {
    this.isImportModalOpen = false;
    this.importDragActive = false;
    this.importError = '';
    this.importSuccess = '';
    this.importSelectedFile = null;
    this.importPath = '';
    this.importKind = 'ingredient';
    this.isImporting = false;
  }

  onImportKindChanged(): void {
    this.importPath = '';
  }

  onImportPathInputChange(value: string): void {
    const currentValue = String(value || '').replace(/\\/g, '/');
    const allFolders = this.getAllFolderPathsForImportKind();
    if (allFolders.includes(currentValue) && !currentValue.endsWith('/')) {
      this.importPath = `${currentValue}/`;
      return;
    }
    this.importPath = currentValue;
  }

  getImportBaseFolder(): string {
    return this.importKind === 'recipe' ? 'Recipes' : 'Ingredients';
  }

  getImportPathSuggestions(): string[] {
    const rootNode = this.getImportRootNode();
    if (!rootNode) return [];

    const normalized = (this.importPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const hasTrailingSlash = normalized.endsWith('/');
    const segments = normalized.split('/').filter(Boolean);

    const parentSegments = hasTrailingSlash ? segments : segments.slice(0, -1);
    const currentPartial = hasTrailingSlash ? '' : (segments[segments.length - 1] || '');

    let node: FolderNode | null = rootNode;
    for (const segment of parentSegments) {
      if (!node?.subdirs?.[segment]) return [];
      node = node.subdirs[segment];
    }

    return Object.keys(node?.subdirs || {})
      .filter((name) => name.toLowerCase().startsWith(currentPartial.toLowerCase()))
      .map((name) => [...parentSegments, name].join('/'));
  }

  openImportFilePicker(input: HTMLInputElement): void {
    if (this.isImporting) return;
    input.click();
  }

  onImportFileInputChanged(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] || null;
    if (!file) return;

    this.setImportFile(file);
  }

  onImportDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.isImporting) return;
    this.importDragActive = true;
  }

  onImportDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.importDragActive = false;
  }

  onImportDrop(event: DragEvent): void {
    event.preventDefault();
    this.importDragActive = false;
    if (this.isImporting) return;

    const file = event.dataTransfer?.files?.[0] || null;
    if (!file) return;

    this.setImportFile(file);
  }

  submitImport(): void {
    this.importError = '';
    this.importSuccess = '';

    if (!this.importSelectedFile) {
      this.importError = 'Select a markdown file to import.';
      return;
    }

    const file = this.importSelectedFile;
    this.isImporting = true;

    this.readFileAsText(file)
      .then((markdown) => {
        this.content.importMarkdown({
          path: this.importPath,
          kind: this.importKind,
          originalFilename: file.name,
          markdown,
        }).subscribe({
          next: (response) => {
            this.isImporting = false;
            this.importSuccess = `Imported: ${response.file || file.name}`;
            this.importSelectedFile = null;
            this.importPath = '';
          },
          error: (err) => {
            this.isImporting = false;
            this.importError = err?.error?.error || err?.message || 'Import failed.';
          }
        });
      })
      .catch((err) => {
        this.isImporting = false;
        this.importError = err?.message || 'Unable to read selected file.';
      });
  }

  goToBrowse(): void {
    this.router.navigate(['/']);
  }

  runSync(): void {
    if (this.isEditPage || this.isSyncing) return;

    const browser = this.contentBrowserInstance;
    if (!browser) return;

    this.isSyncing = true;
    browser.runSync();
  }

  runForceIndexing(): void {
    if (this.isForceIndexing) return;

    this.isForceIndexing = true;
    this.content.forceIndexing().subscribe({
      next: () => {
        this.isForceIndexing = false;
        this.isSettingsOpen = false;
        this.logger.info({ service: 'AppComponent', method: 'runForceIndexing' }, 'force indexing completed');
      },
      error: (err) => {
        this.isForceIndexing = false;
        this.logger.error(
          { service: 'AppComponent', method: 'runForceIndexing', data: err?.message || err?.error?.message || 'unknown error' },
          'force indexing failed'
        );
      }
    });
  }

  addTelegramUser(): void {
    if (this.isAddingTelegramUser) return;

    this.isAddingTelegramUser = true;
    this.telegramAddUserMessage = '';
    this.telegramAddUserError = false;

    this.content.addTelegramTargetFromLatestMessage().subscribe({
      next: (response) => {
        this.isAddingTelegramUser = false;

        const targetName = String(response?.target?.name || '').trim() || 'Telegram user';
        const targetId = String(response?.target?.id || '').trim();
        const actionLabel = response?.created ? 'Added' : 'Already available';
        this.telegramAddUserMessage = targetId
          ? `${actionLabel}: ${targetName} (${targetId})`
          : `${actionLabel}: ${targetName}`;
        this.telegramAddUserError = false;

        window.dispatchEvent(new Event('telegram-targets-updated'));
      },
      error: (err) => {
        this.isAddingTelegramUser = false;
        this.telegramAddUserError = true;
        this.telegramAddUserMessage = err?.error?.error || err?.message || 'Failed to add Telegram user.';

        this.logger.error(
          { service: 'AppComponent', method: 'addTelegramUser', data: this.telegramAddUserMessage },
          'add telegram user failed'
        );
      }
    });
  }

  setMainTab(tab: MainTab): void {
    if (tab === this.activeMainTab) return;

    this.persistCurrentMainTabState();
    this.activeMainTab = tab;
  }

  onEditRequested(request: EditRequest): void {
    this.persistCurrentMainTabState();
    this.activeEditRequest = request;
    this.router.navigate(['/edit']);
  }

  onExistingSaved(): void {
    this.activeEditRequest = null;
    this.router.navigate(['/']);
  }

  onSyncStateChanged(syncing: boolean): void {
    this.isSyncing = syncing;
  }

  toggleSettings(): void {
    this.isSettingsOpen = !this.isSettingsOpen;
    if (this.isSettingsOpen) {
      this.isCreateMenuOpen = false;
    }
    if (!this.isSettingsOpen) {
      this.telegramAddUserMessage = '';
      this.telegramAddUserError = false;
    }
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    this.isSettingsOpen = false;
    try {
      localStorage.setItem('cookbook-theme', theme);
    } catch {
      this.logger.warn({ service: 'AppComponent', method: 'setTheme', data: theme }, 'could not persist theme');
    }
    this.logger.info({ service: 'AppComponent', method: 'setTheme', data: theme }, 'theme updated');
  }

  private updateRouteState(url: string): void {
    this.isEditPage = url.startsWith('/edit');
    if (this.isEditPage) {
      this.isCreateMenuOpen = false;
      this.isSettingsOpen = false;
      this.isImportModalOpen = false;
    }
  }

  private loadImportHierarchy(): void {
    this.content.getHierarchy().subscribe({
      next: (hierarchy) => {
        this.importHierarchy = hierarchy || {};
      },
      error: (err) => {
        this.importError = err?.error?.error || err?.message || 'Unable to load folders for import.';
      }
    });
  }

  private getImportRootNode(): FolderNode | null {
    return this.importHierarchy?.[this.getImportBaseFolder()] || null;
  }

  private getAllFolderPathsForImportKind(): string[] {
    const rootNode = this.getImportRootNode();
    if (!rootNode) return [];

    const folders: string[] = [];
    const walk = (node: FolderNode, currentPath: string) => {
      for (const sub of Object.keys(node.subdirs || {})) {
        const nextPath = currentPath ? `${currentPath}/${sub}` : sub;
        folders.push(nextPath);
        walk(node.subdirs[sub], nextPath);
      }
    };

    walk(rootNode, '');
    return folders;
  }

  private setImportFile(file: File): void {
    this.importSelectedFile = file;
    this.importError = '';
    this.importSuccess = '';
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read file content.'));
      reader.readAsText(file);
    });
  }

  private loadTheme(): void {
    try {
      const saved = localStorage.getItem('cookbook-theme');
      if (saved === 'dark' || saved === 'light') {
        this.theme = saved;
      }
    } catch {
      this.logger.warn({ service: 'AppComponent', method: 'loadTheme' }, 'could not read theme from storage');
    }
  }

  private persistCurrentMainTabState(): void {
    if (this.activeMainTab === 'overview') {
      this.persistOverviewOpenFilesState();
      return;
    }

    if (this.activeMainTab === 'search') {
      this.persistSearchOpenedFileState();
    }
  }

  private persistOverviewOpenFilesState(): void {
    const component = this.contentBrowserInstance;
    if (!component) return;

    const openFiles = component.tabs
      .map((tab) => {
        const section = this.toContentSection(tab.section);
        if (!section) return null;
        return { section, filename: tab.filename };
      })
      .filter((file): file is OpenContentFileRef => file !== null);

    const activeFile = component.activeTabId === null
      ? null
      : component.tabs
        .filter((tab) => tab.id === component.activeTabId)
        .map((tab) => {
          const section = this.toContentSection(tab.section);
          return section ? { section, filename: tab.filename } : null;
        })
        .find((tab): tab is OpenContentFileRef => tab !== null) || null;

    this.content.setOverviewOpenFilesState(openFiles, activeFile);
  }

  private restoreOverviewOpenFiles(component: ContentBrowserComponent): void {
    const state = this.content.getOverviewOpenFilesState();
    if (!state.openFiles.length) return;

    state.openFiles.forEach((file) => component.openTab(file.section, file.filename));
    if (state.activeFile) {
      this.restoreOverviewActiveTabWhenReady(component, state.activeFile);
    }
  }

  private restoreOverviewActiveTabWhenReady(component: ContentBrowserComponent, activeFile: OpenContentFileRef): void {
    if (this.overviewActiveRestoreIntervalId !== null) {
      window.clearInterval(this.overviewActiveRestoreIntervalId);
      this.overviewActiveRestoreIntervalId = null;
    }

    let attempts = 0;
    this.overviewActiveRestoreIntervalId = window.setInterval(() => {
      attempts += 1;

      const matchingTab = component.tabs.find((tab) => tab.section === activeFile.section && tab.filename === activeFile.filename);
      if (matchingTab) {
        component.activeTabId = matchingTab.id;
        if (this.overviewActiveRestoreIntervalId !== null) {
          window.clearInterval(this.overviewActiveRestoreIntervalId);
          this.overviewActiveRestoreIntervalId = null;
        }
        return;
      }

      if (attempts >= 40 && this.overviewActiveRestoreIntervalId !== null) {
        window.clearInterval(this.overviewActiveRestoreIntervalId);
        this.overviewActiveRestoreIntervalId = null;
      }
    }, 50);
  }

  private persistSearchOpenedFileState(): void {
    const openedResult = this.searchTabInstance?.openedResult;
    if (!openedResult) {
      this.content.setSearchOpenedFileState(null);
      return;
    }

    this.content.setSearchOpenedFileState({
      section: openedResult.section,
      filename: openedResult.filename
    });
  }

  private restoreSearchOpenedFile(component: SearchTabComponent): void {
    const openedFile = this.content.getSearchOpenedFileState();
    if (!openedFile) return;

    const searchFile: IndexSearchFile = {
      path: '',
      section: openedFile.section,
      filename: openedFile.filename
    };

    component.openSearchResult(searchFile);
  }

  private toContentSection(section: string): ContentSection | null {
    if (section === 'Recipes' || section === 'Ingredients' || section === 'SpicesAndHerbs') {
      return section;
    }

    return null;
  }
}
