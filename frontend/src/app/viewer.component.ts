import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ContentService } from './content.service';
import { LoggerService } from './logger.service';

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html'
})
export class ViewerComponent implements OnInit {
  section: string | null = null;
  filename: string | null = null;
  selected: { filename: string; type: string; content: string } | null = null;
  renderedContent = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private content: ContentService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const sec = params.get('section');
      const fn = params.get('filename');
      this.section = sec;
      this.filename = fn ? decodeURIComponent(fn) : null;
      if (this.section && this.filename) {
        const mapped = this.mapApiSectionToName(this.section);
        if (mapped) this.loadFile(mapped, this.filename);
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
        out += '';
      } else {
        if (inList) { out += '</ul>'; inList = false; }
        out += `<p>${renderInline(line)}</p>`;
      }
    }
    if (inList) out += '</ul>';
    return out;
  }

  private loadFile(section: string, filename: string) {
    this.logger.info({ service: 'ViewerComponent', method: 'loadFile', data: { section, filename } }, 'loading file');
    this.content.getFile(section, filename).subscribe(data => {
      if (data) {
        this.selected = data;
        let html = '';
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const m: any = (window as any).marked;
          html = m ? m(data.content) : this.basicRender(data.content);
        } catch {
          html = this.basicRender(data.content);
        }
        this.renderedContent = html;
      }
    }, err => {
      this.logger.error({ service: 'ViewerComponent', method: 'loadFile', data: err.message }, 'failed to load file');
    });
  }

  close() {
    this.router.navigate(['/']);
  }

  onRenderedClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
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
        if (section) {
          // navigate to route so history/back works
          this.router.navigate(['/view', sectionKey, encodeURIComponent(filename)]);
        }
      }
    }
  }

  private mapApiSectionToName(key: string): string | null {
    switch (key.toLowerCase()) {
      case 'recipes': return 'Recipes';
      case 'ingredients': return 'Ingredients';
      case 'spices': return 'SpicesAndHerbs';
      default: return null;
    }
  }
}
