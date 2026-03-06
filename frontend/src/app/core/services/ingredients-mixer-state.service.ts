import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class IngredientsMixerStateService {
  private readonly storageKey = 'cookbook-ingredients-mixer-items';
  private readonly itemsSubject = new BehaviorSubject<string[]>(this.loadItemsFromStorage());

  readonly items$: Observable<string[]> = this.itemsSubject.asObservable();

  getItems(): string[] {
    return [...this.itemsSubject.value];
  }

  addItem(item: string): boolean {
    const normalized = this.normalizeKey(item);
    if (!normalized) return false;

    const exists = this.itemsSubject.value.some((existingItem) => this.normalizeKey(existingItem) === normalized);
    if (exists) return false;

    const next = [...this.itemsSubject.value, item];
    this.itemsSubject.next(next);
    this.saveItemsToStorage(next);
    return true;
  }

  removeItemAt(index: number): void {
    if (index < 0 || index >= this.itemsSubject.value.length) return;

    const next = this.itemsSubject.value.filter((_value, itemIndex) => itemIndex !== index);
    this.itemsSubject.next(next);
    this.saveItemsToStorage(next);
  }

  clearItems(): void {
    this.itemsSubject.next([]);
    this.saveItemsToStorage([]);
  }

  replaceItems(items: string[]): void {
    const normalizedKeys = new Set<string>();
    const next = (Array.isArray(items) ? items : [])
      .map((value) => String(value || '').trim().replace(/\s+/g, ' '))
      .filter((value) => value.length > 0)
      .filter((value) => {
        const key = this.normalizeKey(value);
        if (!key || normalizedKeys.has(key)) return false;
        normalizedKeys.add(key);
        return true;
      });

    this.itemsSubject.next(next);
    this.saveItemsToStorage(next);
  }

  normalizeKey(value: string): string {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private loadItemsFromStorage(): string[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((value) => String(value || '').trim())
        .filter((value) => value.length > 0);
    } catch {
      return [];
    }
  }

  private saveItemsToStorage(items: string[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch {
      // Ignore persistence errors and keep in-memory state.
    }
  }
}
