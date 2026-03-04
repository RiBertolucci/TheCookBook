import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class IndexNameTranslatorService {
  toResearchType(indexName: string): string {
    const normalized = String(indexName || '').trim();
    if (!normalized) return '';

    return normalized
      .split('-')
      .map((word) => this.capitalize(word))
      .join(' ');
  }

  private capitalize(value: string): string {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
