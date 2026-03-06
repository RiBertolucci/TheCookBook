import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ContentBrowserComponent } from './features/content/browser/content-browser.component';
import { SearchTabComponent } from './features/search/search-tab.component';
import { EditRequest } from './features/content/models/content-shell.models';
import { LoggerService } from './core/services/logger.service';
import { ContentService } from './core/services/content.service';
import { ContentSection, IndexSearchFile } from './core/interfaces/content';

type MainTab = 'overview' | 'search' | 'shopping';

interface OpenContentFileRef {
  section: ContentSection;
  filename: string;
}

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
  isSyncing = false;
  isForceIndexing = false;
  isAddingTelegramUser = false;
  telegramAddUserMessage = '';
  telegramAddUserError = false;
  activeMainTab: MainTab = 'overview';
  theme: 'light' | 'dark' = 'light';
  activeEditRequest: EditRequest | null = null;

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
    this.activeEditRequest = null;
    this.router.navigate(['/edit']);
  }

  goToBrowse(): void {
    this.router.navigate(['/']);
  }

  runSync(): void {
    if (this.isEditPage) return;
    this.contentBrowserInstance?.runSync();
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
