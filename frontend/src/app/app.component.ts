import { Component, OnInit } from '@angular/core';
import { ContentService, FolderNode } from './content.service';
import { LoggerService } from './logger.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'TheCookBook';
  hierarchy: { [key: string]: FolderNode } = {};

  // currently-selected document; null when nothing chosen
  selected: { filename: string; type: string; content: string } | null = null;

  // HTML produced from selected.content using marked
  renderedContent: string = '';
  // tabbed viewer state
  tabs: Array<{ id: number; title: string; section: string; filename: string; renderedContent: string }> = [];
  activeTabId: number | null = null;
  private nextTabId = 1;
  // track expanded folder paths (e.g. 'Recipes', 'Recipes/Italian')
  expanded: { [path: string]: boolean } = {}; 

  constructor(private content: ContentService, private logger: LoggerService) {}

  ngOnInit(): void {
    this.logger.info({ service: 'AppComponent', method: 'ngOnInit' }, 'initialising component');
    this.content.getHierarchy().subscribe(data => {
      this.hierarchy = data;
      this.logger.debug({ service: 'AppComponent', method: 'ngOnInit', data: data }, 'hierarchy received');
    });
  }

  // helper to iterate object keys in template
  keys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  /**
   * Request a particular file from the backend and store it in
   * `selected` so the template can display it.
   */
  /**
   * Transform a small subset of markdown to HTML. This is intentionally
   * tiny so it works regardless of external libraries or node versions.
   * Currently handles headings (#, ##, ###) and leaves other lines as
   * paragraphs. It conservatively escapes angle brackets.
   */
  private basicRender(md: string): string {
    const escape = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const renderInline = (text: string) => {
      const esc = escape(text);
      // convert markdown links [text](url) -> <a href="url">text</a>
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
        out += '';
      } else {
        if (inList) { out += '</ul>'; inList = false; }
        out += `<p>${renderInline(line)}</p>`;
      }
    }
    if (inList) out += '</ul>';
    return out;
  }

  showFile(section: string, file: string): void {
    // backward-compatible helper: open as a tab
    this.openTab(section, file);
  }

  openTab(section: string, filename: string): void {
    this.logger.info({ service: 'AppComponent', method: 'openTab', data: { section, filename } }, 'opening tab');
    // check if tab already open
    const existing = this.tabs.find(t => t.section === section && t.filename === filename);
    if (existing) {
      this.activeTabId = existing.id;
      return;
    }

    this.content.getFile(section, filename).subscribe(data => {
      if (!data) return;
      // render markdown
      let html = '';
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m: any = (window as any).marked;
        html = m ? m(data.content) : this.basicRender(data.content);
      } catch {
        html = this.basicRender(data.content);
      }
      const id = this.nextTabId++;
      const tab = { id, title: data.filename, section, filename, renderedContent: html };
      this.tabs.push(tab);
      this.activeTabId = id;
      this.logger.debug({ service: 'AppComponent', method: 'openTab', data: { id, filename } }, 'tab opened');
    }, err => {
      this.logger.error({ service: 'AppComponent', method: 'openTab', data: err.message }, 'failed to open tab');
    });
  }

  closeTab(id: number): void {
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    this.tabs.splice(idx, 1);
    if (this.activeTabId === id) {
      // activate previous tab if exists, otherwise next, otherwise null
      if (this.tabs.length === 0) {
        this.activeTabId = null;
      } else if (idx - 1 >= 0) {
        this.activeTabId = this.tabs[idx - 1].id;
      } else {
        this.activeTabId = this.tabs[0].id;
      }
    }
  }

  toggleExpand(path: string): void {
    this.logger.debug({ service: 'AppComponent', method: 'toggleExpand', data: path }, 'toggling folder expansion');
    // also log the node we're about to show (if available)
    const section = this.getSectionFromPath(path);
    const node = this.hierarchy ? this.hierarchy[section] : undefined;
    this.logger.debug({ service: 'AppComponent', method: 'toggleExpand', data: node }, 'current node data');
    this.expanded[path] = !this.expanded[path];
  }

  isExpanded(path: string): boolean {
    return !!this.expanded[path];
  }

  getSectionFromPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts.length > 0 ? parts[0] : path;
  }

  /**
   * Click handler attached to the rendered HTML block. Intercepts clicks on
   * anchors that point to `/api/...` endpoints and loads the target into the popup.
   */
  onRenderedClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    // find ancestor anchor
    let el: HTMLElement | null = target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    const href = (el as HTMLAnchorElement).getAttribute('href') || '';
    if (href.startsWith('/api/')) {
      ev.preventDefault();
      // parse e.g. /api/ingredients/garlic.md
      const parts = href.split('/').filter(Boolean);
      // parts -> ['api','ingredients','garlic.md']
      if (parts.length >= 3) {
        const sectionKey = parts[1];
        const filename = parts.slice(2).join('/');
        const section = this.mapApiSectionToName(sectionKey);
        if (section) this.openTab(section, filename);
      }
    }
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

  private mapNameToApiSection(name: string): string | null {
    switch (name) {
      case 'Recipes': return 'recipes';
      case 'Ingredients': return 'ingredients';
      case 'SpicesAndHerbs': return 'spices';
      default: return null;
    }
  }
}
