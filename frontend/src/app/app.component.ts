import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ContentBrowserComponent } from './features/content/browser/content-browser.component';
import { EditRequest } from './features/content/models/content-shell.models';
import { LoggerService } from './core/services/logger.service';
import { ContentService } from './core/services/content.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit {
  @ViewChild(ContentBrowserComponent) contentBrowser?: ContentBrowserComponent;

  title = 'TheCookBook';
  isEditPage = false;
  isSettingsOpen = false;
  isSyncing = false;
  isForceIndexing = false;
  activeMainTab: 'overview' | 'search' | 'shopping' = 'overview';
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
    this.activeEditRequest = null;
    this.router.navigate(['/edit']);
  }

  goToBrowse(): void {
    this.router.navigate(['/']);
  }

  runSync(): void {
    if (this.isEditPage) return;
    this.contentBrowser?.runSync();
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

  setMainTab(tab: 'overview' | 'search' | 'shopping'): void {
    this.activeMainTab = tab;
  }

  onEditRequested(request: EditRequest): void {
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
}
