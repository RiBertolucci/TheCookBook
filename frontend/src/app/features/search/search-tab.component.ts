import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ContentSection, IndexInfo, IndexSearchFile, IndexSearchGroup, IngredientFamily } from '../../core/interfaces/content';
import { ContentService } from '../../core/services/content.service';
import { IndexNameTranslatorService } from '../../core/services/index-name-translator.service';
import { LoggerService } from '../../core/services/logger.service';
import { RecipeIngredientRenderService } from '../../core/services/recipe-ingredient-render.service';
import { ShoppingListStateService } from '../../core/services/shopping-list-state.service';

interface OpenedSearchFile {
  title: string;
  section: 'Recipes' | 'Ingredients' | 'SpicesAndHerbs';
  filename: string;
  renderedContent: string;
  rawContent: string;
}

@Component({
  selector: 'app-search-tab',
  templateUrl: './search-tab.component.html',
  styleUrls: ['./search-tab.component.css']
})
export class SearchTabComponent implements OnInit, OnDestroy {
  searchInput = '';
  searchSelectedItems: string[] = [];
  searchSuggestions: string[] = [];
  showSearchSuggestions = false;
  allIndexValues: string[] = [];

  selectedIndexName = '';
  availableIndexes: IndexInfo[] = [];
  isLoadingIndexes = false;
  isLoadingIndexValues = false;
  isSearching = false;
  hasSearched = false;
  searchError = '';
  searchResults: IndexSearchFile[] = [];
  groupedSearchResults: IndexSearchGroup[] = [];
  openedResult: OpenedSearchFile | null = null;
  private shoppingItemKeys = new Set<string>();
  private ingredientFamiliesByKey: { [key: string]: IngredientFamily } = {};
  private shoppingItemsSubscription?: Subscription;

  constructor(
    private content: ContentService,
    private indexNameTranslator: IndexNameTranslatorService,
    private logger: LoggerService,
    private recipeIngredientRender: RecipeIngredientRenderService,
    private shoppingListState: ShoppingListStateService
  ) {}

  ngOnInit(): void {
    this.shoppingItemKeys = new Set(this.shoppingListState.getItems().map((item) => this.shoppingListState.normalizeKey(item)));
    this.shoppingItemsSubscription = this.shoppingListState.items$.subscribe((items) => {
      this.shoppingItemKeys = new Set(items.map((item) => this.shoppingListState.normalizeKey(item)));
      if (this.openedResult) {
        this.openedResult = {
          ...this.openedResult,
          renderedContent: this.renderMarkdownForSection(this.openedResult.section, this.openedResult.rawContent)
        };
      }
    });
    this.loadIngredientFamilies();
    this.loadIndexes();
  }

  ngOnDestroy(): void {
    this.shoppingItemsSubscription?.unsubscribe();
  }

  onSearchIndexChanged(): void {
    this.searchInput = '';
    this.searchSuggestions = [];
    this.showSearchSuggestions = false;
    this.searchSelectedItems = [];
    this.hasSearched = false;
    this.searchError = '';
    this.searchResults = [];
    this.groupedSearchResults = [];
    this.openedResult = null;
    this.loadValuesForSelectedIndex();
  }

  onSearchInputChanged(value: string): void {
    this.searchInput = String(value || '');
    this.updateSearchSuggestions();
  }

  onSearchInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.addSearchItem(this.searchInput);
  }

  toggleSearchSuggestions(): void {
    if (this.showSearchSuggestions) {
      this.showSearchSuggestions = false;
      return;
    }

    if (!this.searchInput.trim()) {
      const selected = new Set(this.searchSelectedItems.map((item) => item.toLowerCase()));
      this.searchSuggestions = this.allIndexValues
        .filter((value) => !selected.has(value.toLowerCase()))
        .slice(0, 12);
      this.showSearchSuggestions = this.searchSuggestions.length > 0;
      return;
    }

    if (this.searchSuggestions.length === 0) {
      this.updateSearchSuggestions();
    }

    if (this.searchSuggestions.length > 0) {
      this.showSearchSuggestions = !this.showSearchSuggestions;
    }
  }

  selectSearchSuggestion(value: string): void {
    this.addSearchItem(value);
  }

  removeSearchItem(value: string): void {
    this.searchSelectedItems = this.searchSelectedItems.filter((item) => item !== value);
    this.updateSearchSuggestions();
  }

  runSearch(): void {
    if (!this.selectedIndexName || this.isSearching) return;

    this.hasSearched = true;

    const typed = this.searchInput.trim();
    if (typed) {
      this.addSearchItem(typed);
    }

    const terms = Array.from(new Set(this.searchSelectedItems
      .map((item) => String(item || '').trim())
      .filter(Boolean)));

    this.searchError = '';
    this.searchResults = [];
    this.groupedSearchResults = [];
    this.openedResult = null;

    this.isSearching = true;
    this.content.searchIndexFiles(this.selectedIndexName, terms).subscribe({
      next: (response) => {
        this.searchResults = response?.files || [];
        this.groupedSearchResults = response?.groupedByMatchedTerms || [];
        this.isSearching = false;
      },
      error: (err) => {
        this.searchResults = [];
        this.groupedSearchResults = [];
        this.isSearching = false;
        this.searchError = err?.error?.error || err?.message || 'Search failed.';
        this.logger.error(
          { service: 'SearchTabComponent', method: 'runSearch', data: err?.message || err?.error?.message || 'unknown error' },
          'search failed'
        );
      }
    });
  }

  openSearchResult(file: IndexSearchFile): void {
    if (!file) return;
    this.openPreviewFile(file.section, file.filename);
  }

  onPreviewClick(event: MouseEvent): void {
    const fallbackSection = this.openedResult ? this.openedResult.section : undefined;
    const action = this.recipeIngredientRender.resolveRenderedAction(event, fallbackSection);
    if (!action) return;

    if (action.type === 'toggle-family') {
      return;
    }

    if (action.type === 'add-to-shopping') {
      const wasAdded = this.shoppingListState.addItem(action.item);
      if (wasAdded && this.openedResult) {
        this.openedResult = {
          ...this.openedResult,
          renderedContent: this.renderMarkdownForSection(this.openedResult.section, this.openedResult.rawContent)
        };
      }
      return;
    }

    this.openPreviewFile(action.section, action.filename);
  }

  closeOpenedResult(): void {
    this.openedResult = null;
  }

  getGroupTitle(group: IndexSearchGroup): string {
    const matched = group?.matchedTerms || 0;
    const total = group?.totalSelectedTerms || 0;
    const label = matched === 1 ? 'ingredient' : 'ingredients';
    if (total > 0) {
      return `${matched}/${total} selected ${label} shared`;
    }
    return `${matched} shared ${label}`;
  }

  getResearchTypeLabel(indexName: string): string {
    return this.indexNameTranslator.toResearchType(indexName);
  }

  private loadIndexes(): void {
    if (this.isLoadingIndexes) return;

    this.isLoadingIndexes = true;
    this.content.getIndexes().subscribe({
      next: (response) => {
        this.availableIndexes = response?.indexes || [];
        if (!this.selectedIndexName && this.availableIndexes.length > 0) {
          this.selectedIndexName = this.availableIndexes[0].name;
          this.loadValuesForSelectedIndex();
        }
        this.isLoadingIndexes = false;
      },
      error: (err) => {
        this.isLoadingIndexes = false;
        this.logger.error(
          { service: 'SearchTabComponent', method: 'loadIndexes', data: err?.message || err?.error?.message || 'unknown error' },
          'failed to load indexes'
        );
      }
    });
  }

  private loadValuesForSelectedIndex(): void {
    if (!this.selectedIndexName || this.isLoadingIndexValues) {
      return;
    }

    this.isLoadingIndexValues = true;
    this.content.getIndexSnapshot(this.selectedIndexName).subscribe({
      next: (snapshot) => {
        const uniqueValues = new Set<string>();
        Object.values(snapshot?.entries || {}).forEach((values) => {
          (values || []).forEach((value) => {
            const normalized = String(value || '').trim();
            if (normalized) uniqueValues.add(normalized);
          });
        });

        this.allIndexValues = Array.from(uniqueValues).sort((left, right) => left.localeCompare(right));
        this.isLoadingIndexValues = false;
        this.updateSearchSuggestions();
      },
      error: (err) => {
        this.isLoadingIndexValues = false;
        this.allIndexValues = [];
        this.searchSuggestions = [];
        this.showSearchSuggestions = false;
        this.logger.error(
          { service: 'SearchTabComponent', method: 'loadValuesForSelectedIndex', data: err?.message || err?.error?.message || 'unknown error' },
          'failed to load index values'
        );
      }
    });
  }

  private addSearchItem(rawValue: string): void {
    const value = String(rawValue || '').trim();
    if (!value) return;

    const exists = this.searchSelectedItems.some((item) => item.toLowerCase() === value.toLowerCase());
    if (exists) {
      this.searchInput = '';
      this.showSearchSuggestions = false;
      this.updateSearchSuggestions();
      return;
    }

    this.searchSelectedItems = [...this.searchSelectedItems, value];
    this.searchInput = '';
    this.showSearchSuggestions = false;
    this.updateSearchSuggestions();
  }

  private updateSearchSuggestions(): void {
    const typed = this.searchInput.trim().toLowerCase();
    if (!typed) {
      this.searchSuggestions = [];
      this.showSearchSuggestions = false;
      return;
    }

    const selected = new Set(this.searchSelectedItems.map((item) => item.toLowerCase()));

    const filtered = this.allIndexValues.filter((value) => {
      if (selected.has(value.toLowerCase())) return false;
      return value.toLowerCase().includes(typed);
    });

    this.searchSuggestions = filtered.slice(0, 12);
    this.showSearchSuggestions = this.searchSuggestions.length > 0;
  }

  private renderMarkdownForSection(section: 'Recipes' | 'Ingredients' | 'SpicesAndHerbs', markdown: string): string {
    let html = '';
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m: any = (window as any).marked;
      html = m ? m(markdown) : this.basicRender(markdown);
    } catch {
      html = this.basicRender(markdown);
    }

    if (section === 'Recipes') {
      return this.recipeIngredientRender.decorateRecipeIngredients(html, this.shoppingItemKeys, this.ingredientFamiliesByKey);
    }

    return html;
  }

  private loadIngredientFamilies(): void {
    this.content.getIngredientFamilies().subscribe({
      next: (response) => {
        const nextFamiliesByKey: { [key: string]: IngredientFamily } = {};
        (response?.families || []).forEach((family) => {
          if (!family || !family.key) return;
          nextFamiliesByKey[family.key] = family;
        });
        this.ingredientFamiliesByKey = nextFamiliesByKey;

        if (this.openedResult) {
          this.openedResult = {
            ...this.openedResult,
            renderedContent: this.renderMarkdownForSection(this.openedResult.section, this.openedResult.rawContent)
          };
        }
      },
      error: (err) => {
        this.ingredientFamiliesByKey = {};
        this.logger.error(
          { service: 'SearchTabComponent', method: 'loadIngredientFamilies', data: err?.message || err?.error?.message || 'unknown error' },
          'failed to load ingredient families'
        );
      }
    });
  }

  private openPreviewFile(section: ContentSection, filename: string): void {
    this.content.getFile(section, filename).subscribe({
      next: (data) => {
        if (!data) return;

        const html = this.renderMarkdownForSection(section, data.content);

        this.openedResult = {
          title: data.filename,
          section,
          filename,
          renderedContent: html,
          rawContent: data.content
        };
      },
      error: (err) => {
        this.logger.error(
          { service: 'SearchTabComponent', method: 'openPreviewFile', data: err?.message || err?.error?.message || 'unknown error' },
          'failed to open searched file'
        );
      }
    });
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
