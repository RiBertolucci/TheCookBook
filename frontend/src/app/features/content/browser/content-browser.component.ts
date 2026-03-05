import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { ContentService, FolderNode } from '../../../core/services/content.service';
import { LoggerService } from '../../../core/services/logger.service';
import { EditRequest } from '../models/content-shell.models';
import { ShoppingListStateService } from '../../../core/services/shopping-list-state.service';

interface OpenTab {
  id: number;
  title: string;
  section: string;
  filename: string;
  renderedContent: string;
  rawContent: string;
}

@Component({
  selector: 'app-content-browser',
  templateUrl: './content-browser.component.html'
})
export class ContentBrowserComponent implements OnInit, OnDestroy {
  @Output() editRequested = new EventEmitter<EditRequest>();
  @Output() syncStateChange = new EventEmitter<boolean>();

  hierarchy: { [key: string]: FolderNode } = {};
  tabs: OpenTab[] = [];
  activeTabId: number | null = null;
  expanded: { [path: string]: boolean } = {};

  isSyncing = false;
  isDeleting = false;
  showFolderDeleteBins = false;
  deleteError = '';
  private shoppingItemKeys = new Set<string>();
  private shoppingItemsSubscription?: Subscription;

  private nextTabId = 1;

  constructor(
    private content: ContentService,
    private logger: LoggerService,
    private shoppingListState: ShoppingListStateService
  ) {}

  ngOnInit(): void {
    this.shoppingItemKeys = new Set(this.shoppingListState.getItems().map((item) => this.shoppingListState.normalizeKey(item)));
    this.shoppingItemsSubscription = this.shoppingListState.items$.subscribe((items) => {
      this.shoppingItemKeys = new Set(items.map((item) => this.shoppingListState.normalizeKey(item)));
      this.refreshRenderedTabsFromRaw();
    });
    this.loadHierarchy();
  }

  ngOnDestroy(): void {
    this.shoppingItemsSubscription?.unsubscribe();
  }

  runSync(): void {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.syncStateChange.emit(true);
    this.logger.info({ service: 'ContentBrowserComponent', method: 'runSync' }, 'sync requested from UI');
    this.content.sync().subscribe(() => {
      this.loadHierarchy();
      this.refreshOpenTabs();
      this.isSyncing = false;
      this.syncStateChange.emit(false);
      this.logger.info({ service: 'ContentBrowserComponent', method: 'runSync' }, 'sync completed');
    }, err => {
      this.isSyncing = false;
      this.syncStateChange.emit(false);
      this.logger.error({ service: 'ContentBrowserComponent', method: 'runSync', data: err.message }, 'sync failed');
    });
  }

  loadHierarchy(): void {
    this.content.getHierarchy().subscribe(data => {
      this.hierarchy = data;
      this.logger.debug({ service: 'ContentBrowserComponent', method: 'loadHierarchy', data }, 'hierarchy received');
    }, err => {
      this.logger.error({ service: 'ContentBrowserComponent', method: 'loadHierarchy', data: err.message }, 'failed to load hierarchy');
    });
  }

  keys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  openTab(section: string, filename: string): void {
    this.logger.info({ service: 'ContentBrowserComponent', method: 'openTab', data: { section, filename } }, 'opening tab');
    const existing = this.tabs.find(t => t.section === section && t.filename === filename);
    if (existing) {
      this.activeTabId = existing.id;
      return;
    }

    this.content.getFile(section, filename).subscribe(data => {
      if (!data) return;
      const html = this.renderMarkdownForTab(section, data.content);
      const id = this.nextTabId++;
      const tab = { id, title: data.filename, section, filename, renderedContent: html, rawContent: data.content };
      this.tabs.push(tab);
      this.activeTabId = id;
      this.logger.debug({ service: 'ContentBrowserComponent', method: 'openTab', data: { id, filename } }, 'tab opened');
    }, err => {
      this.logger.error({ service: 'ContentBrowserComponent', method: 'openTab', data: err.message }, 'failed to open tab');
    });
  }

  closeTab(id: number): void {
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    this.tabs.splice(idx, 1);
    if (this.activeTabId === id) {
      if (this.tabs.length === 0) {
        this.activeTabId = null;
      } else if (idx - 1 >= 0) {
        this.activeTabId = this.tabs[idx - 1].id;
      } else {
        this.activeTabId = this.tabs[0].id;
      }
    }
  }

  getActiveTabTitle(): string {
    const activeTab = this.getActiveTab();
    return activeTab ? activeTab.title : '';
  }

  editActiveFile(): void {
    const activeTab = this.getActiveTab();
    if (!activeTab) return;

    if (activeTab.section !== 'Recipes' && activeTab.section !== 'Ingredients' && activeTab.section !== 'SpicesAndHerbs') {
      return;
    }

    this.editRequested.emit({
      section: activeTab.section,
      filename: activeTab.filename,
      rawContent: activeTab.rawContent
    });
  }

  deleteActiveFile(): void {
    this.deleteError = '';
    if (this.activeTabId === null) return;
    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    if (!activeTab) return;

    if (activeTab.section !== 'Recipes' && activeTab.section !== 'Ingredients' && activeTab.section !== 'SpicesAndHerbs') {
      return;
    }

    const confirmed = window.confirm(`Delete file "${activeTab.title}"?`);
    if (!confirmed) return;

    this.isDeleting = true;
    this.content.deleteFile({
      section: activeTab.section,
      filename: activeTab.filename
    }).subscribe({
      next: () => {
        this.isDeleting = false;
        this.closeTab(activeTab.id);
        this.loadHierarchy();
      },
      error: (err) => {
        this.isDeleting = false;
        this.deleteError = err?.error?.error || err?.message || 'Failed to delete file.';
      }
    });
  }

  deleteFolder(path: string): void {
    this.deleteError = '';
    const normalizedPath = String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!normalizedPath) return;

    const confirmed = window.confirm(`Delete folder "${normalizedPath}" and all its content?`);
    if (!confirmed) return;

    this.isDeleting = true;
    this.content.deleteFolder({ path: normalizedPath }).subscribe({
      next: () => {
        this.isDeleting = false;
        this.closeTabsForDeletedFolder(normalizedPath);
        this.loadHierarchy();
      },
      error: (err) => {
        this.isDeleting = false;
        this.deleteError = err?.error?.error || err?.message || 'Failed to delete folder.';
      }
    });
  }

  toggleExpand(path: string): void {
    this.expanded[path] = !this.expanded[path];
  }

  isExpanded(path: string): boolean {
    return !!this.expanded[path];
  }

  getSectionFromPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts.length > 0 ? parts[0] : path;
  }

  getFilenameForPath(path: string, file: string): string {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 1) return file;
    const nestedPath = parts.slice(1).join('/');
    return `${nestedPath}/${file}`;
  }

  onRenderedClick(ev: MouseEvent): void {
    const target = ev.target as HTMLElement | null;
    if (!target) return;

    const addButton = target.closest('.recipe-ingredient-add-btn') as HTMLElement | null;
    if (addButton) {
      ev.preventDefault();
      ev.stopPropagation();

      const ingredientItem = addButton.closest('li') as HTMLLIElement | null;
      const ingredient = ingredientItem
        ? this.normalizeShoppingItemLabel(this.extractIngredientLabel(ingredientItem))
        : '';
      if (!ingredient) return;

      const wasAdded = this.shoppingListState.addItem(ingredient);
      if (wasAdded) {
        this.refreshRenderedTabsFromRaw();
      }
      return;
    }

    let el: HTMLElement | null = target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    const href = (el as HTMLAnchorElement).getAttribute('href') || '';
    if (href.startsWith('/api/')) {
      ev.preventDefault();
      const parts = href.split('/').filter(Boolean);
      if (parts.length >= 3) {
        const sectionKey = parts[1];
        const filename = parts.slice(2).join('/');
        const section = this.mapApiSectionToName(sectionKey);
        if (section) this.openTab(section, filename);
      }
      return;
    }

    const relativeMdTarget = this.extractRelativeMarkdownTarget(href);
    if (relativeMdTarget) {
      ev.preventDefault();
      const activeTab = this.tabs.find(t => t.id === this.activeTabId);
      if (!activeTab) return;
      this.openTab(activeTab.section, relativeMdTarget);
    }
  }

  private getActiveTab(): OpenTab | null {
    if (this.activeTabId === null) return null;
    return this.tabs.find(t => t.id === this.activeTabId) || null;
  }

  private refreshOpenTabs(): void {
    for (const tab of this.tabs) {
      this.content.getFile(tab.section, tab.filename).subscribe(data => {
        if (!data) return;
        tab.renderedContent = this.renderMarkdownForTab(tab.section, data.content);
        tab.rawContent = data.content;
        tab.title = data.filename;
      });
    }
  }

  private refreshRenderedTabsFromRaw(): void {
    this.tabs.forEach((tab) => {
      tab.renderedContent = this.renderMarkdownForTab(tab.section, tab.rawContent);
    });
  }

  private closeTabsForDeletedFolder(folderPath: string): void {
    const parts = folderPath.split('/').filter(Boolean);
    if (parts.length < 2) return;

    const section = parts[0];
    const prefix = `${parts.slice(1).join('/')}/`;

    this.tabs = this.tabs.filter(tab => !(tab.section === section && tab.filename.startsWith(prefix)));

    if (this.tabs.length === 0) {
      this.activeTabId = null;
      return;
    }

    if (!this.tabs.some(tab => tab.id === this.activeTabId)) {
      this.activeTabId = this.tabs[0].id;
    }
  }

  private extractRelativeMarkdownTarget(href: string): string | null {
    const cleaned = (href || '').trim();
    if (!cleaned || cleaned.startsWith('#')) return null;
    if (cleaned.startsWith('/')) return null;
    if (/^(https?:|mailto:|tel:)/i.test(cleaned)) return null;

    const noHash = cleaned.split('#')[0];
    const noQuery = noHash.split('?')[0];
    if (!noQuery.toLowerCase().endsWith('.md')) return null;

    const normalized = noQuery.replace(/^\.\//, '');
    return decodeURIComponent(normalized);
  }

  private mapApiSectionToName(key: string): string | null {
    switch (key.toLowerCase()) {
      case 'recipes':
        return 'Recipes';
      case 'ingredients':
        return 'Ingredients';
      case 'spices':
        return 'SpicesAndHerbs';
      default:
        return null;
    }
  }

  private renderMarkdownForTab(section: string, markdown: string): string {
    let html = '';
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m: any = (window as any).marked;
      html = m ? m(markdown) : this.basicRender(markdown);
    } catch {
      html = this.basicRender(markdown);
    }

    if (section === 'Recipes') {
      return this.decorateRecipeIngredients(html);
    }

    return html;
  }

  private decorateRecipeIngredients(renderedHtml: string): string {
    const template = document.createElement('template');
    template.innerHTML = renderedHtml;

    const headings = Array.from(template.content.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const ingredientsHeading = headings.find((heading) => this.normalizeHeading(heading.textContent) === 'ingredients');
    if (!ingredientsHeading) return renderedHtml;

    const sectionLevel = Number(ingredientsHeading.tagName.slice(1)) || 2;
    let current: Element | null = ingredientsHeading.nextElementSibling;

    while (current) {
      const tag = current.tagName.toUpperCase();
      if (/^H[1-6]$/.test(tag)) {
        const level = Number(tag.slice(1)) || 6;
        if (level <= sectionLevel) break;
      }

      if (tag === 'UL' || tag === 'OL') {
        this.decorateIngredientList(current as HTMLElement);
      }

      current = current.nextElementSibling;
    }

    return template.innerHTML;
  }

  private decorateIngredientList(listElement: HTMLElement): void {
    const listItems = Array.from(listElement.children)
      .filter((child) => child.tagName.toUpperCase() === 'LI') as HTMLLIElement[];

    listItems.forEach((item) => {
      const ingredient = this.normalizeShoppingItemLabel(this.extractIngredientLabel(item));
      if (!ingredient) return;

      const ingredientKey = this.shoppingListState.normalizeKey(ingredient);
      item.classList.add('recipe-ingredient-item');

      if (this.shoppingItemKeys.has(ingredientKey)) {
        item.classList.add('recipe-ingredient-in-cart');
        return;
      }

      const addButton = document.createElement('a');
      addButton.href = '#';
      addButton.className = 'recipe-ingredient-add-btn';
      addButton.setAttribute('role', 'button');
      addButton.setAttribute('title', 'Add to shopping list');
      addButton.setAttribute('aria-label', `Add ${ingredient} to shopping list`);
      addButton.textContent = '+';
      item.appendChild(addButton);
    });
  }

  private extractIngredientLabel(item: HTMLLIElement): string {
    const clone = item.cloneNode(true) as HTMLElement;
    Array.from(clone.querySelectorAll('.recipe-ingredient-add-btn, ul, ol')).forEach((el) => el.remove());
    return String(clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  private normalizeHeading(value: string | null): string {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeShoppingItemLabel(value: string): string {
    const compact = String(value || '').trim().replace(/\s+/g, ' ');
    if (!compact) return '';
    return compact.charAt(0).toUpperCase() + compact.slice(1);
  }

  private basicRender(md: string): string {
    const escape = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const renderInline = (text: string) => {
      const esc = escape(text);
      return esc.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => {
        const label = escape(t);
        const href = escape(u);
        return `<a href="${href}">${label}</a>`;
      });
    };

    const lines = md.split('\n');
    let out = '';
    let inList = false;
    for (const raw of lines) {
      const line = raw;
      if (line.startsWith('# ')) {
        if (inList) { out += '</ul>'; inList = false; }
        out += `<h1>${escape(line.slice(2))}</h1>`;
      } else if (line.startsWith('## ')) {
        if (inList) { out += '</ul>'; inList = false; }
        out += `<h2>${escape(line.slice(3))}</h2>`;
      } else if (line.startsWith('### ')) {
        if (inList) { out += '</ul>'; inList = false; }
        out += `<h3>${escape(line.slice(4))}</h3>`;
      } else if (line.trim().startsWith('- ')) {
        if (!inList) { out += '<ul>'; inList = true; }
        out += `<li>${renderInline(line.trim().slice(2))}</li>`;
      } else if (line.trim() === '') {
        if (inList) { out += '</ul>'; inList = false; }
      } else {
        if (inList) { out += '</ul>'; inList = false; }
        out += `<p>${renderInline(line)}</p>`;
      }
    }
    if (inList) out += '</ul>';
    return out;
  }
}
