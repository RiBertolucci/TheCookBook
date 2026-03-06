import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { TelegramTarget } from '../../core/interfaces/content';
import { ContentService } from '../../core/services/content.service';
import { LoggerService } from '../../core/services/logger.service';
import { ShoppingListStateService } from '../../core/services/shopping-list-state.service';

@Component({
  selector: 'app-shopping-list',
  templateUrl: './shopping-list.component.html',
  styleUrls: ['./shopping-list.component.css']
})
export class ShoppingListComponent implements OnInit, OnDestroy {
  inputValue = '';
  items: string[] = [];

  showSuggestions = false;
  filteredSuggestions: string[] = [];
  allIngredientSuggestions: string[] = [];
  isLoadingSuggestions = false;
  isLoadingTelegramTargets = false;
  isSendingToTelegram = false;
  isLoadingFromTelegram = false;
  showSendTargetMenu = false;
  showLoadTargetMenu = false;
  selectedLoadTargetId = '';
  selectedTelegramTargetId = '';
  telegramTargets: TelegramTarget[] = [];
  telegramError = '';
  telegramSuccess = '';
  private itemsSubscription?: Subscription;
  private readonly onTelegramTargetsUpdated = () => {
    this.loadTelegramTargets();
  };

  constructor(
    private content: ContentService,
    private logger: LoggerService,
    private shoppingListState: ShoppingListStateService
  ) {}

  ngOnInit(): void {
    this.items = this.shoppingListState.getItems();
    this.itemsSubscription = this.shoppingListState.items$.subscribe((items) => {
      this.items = items;
      this.updateSuggestions(true);
    });
    this.loadTelegramTargets();
    this.loadIngredientSuggestions();
    window.addEventListener('telegram-targets-updated', this.onTelegramTargetsUpdated);
  }

  ngOnDestroy(): void {
    this.itemsSubscription?.unsubscribe();
    window.removeEventListener('telegram-targets-updated', this.onTelegramTargetsUpdated);
  }

  onInputChanged(value: string): void {
    this.inputValue = String(value || '');
    this.updateSuggestions();
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addCurrentInput();
      return;
    }

    if (event.key === 'Escape') {
      this.showSuggestions = false;
    }
  }

  onInputFocus(): void {
    this.updateSuggestions();
  }

  toggleSuggestions(): void {
    if (this.showSuggestions) {
      this.showSuggestions = false;
      return;
    }

    this.updateSuggestions();
  }

  selectSuggestion(value: string): void {
    this.addItem(value);
  }

  addCurrentInput(): void {
    this.addItem(this.inputValue);
  }

  removeItem(index: number): void {
    this.shoppingListState.removeItemAt(index);
  }

  clearItems(): void {
    this.shoppingListState.clearItems();
  }

  exportList(): void {
    if (this.items.length === 0) return;

    const now = new Date();
    const dateTag = now.toISOString().slice(0, 10);
    const lines = [
      'Shopping List',
      `Created: ${now.toLocaleString()}`,
      '',
      ...this.items.map((item, index) => `${index + 1}. ${item}`)
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `shopping-list-${dateTag}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    window.URL.revokeObjectURL(url);
  }

  sendToTelegram(): void {
    if (this.items.length === 0 || this.isSendingToTelegram || !this.selectedTelegramTargetId) return;

    this.showSendTargetMenu = false;
    this.isSendingToTelegram = true;
    this.telegramError = '';
    this.telegramSuccess = '';

    this.content.sendShoppingListToTelegram(this.items, this.selectedTelegramTargetId).subscribe({
      next: (response) => {
        this.isSendingToTelegram = false;
        const label = response?.targetName || this.getTargetNameById(this.selectedTelegramTargetId) || 'selected chat';
        this.telegramSuccess = `Sent to ${label}.`;
      },
      error: (err) => {
        this.isSendingToTelegram = false;
        this.telegramSuccess = '';
        this.telegramError = err?.error?.error || err?.message || 'Failed to send shopping list to Telegram.';
        this.logger.error(
          { service: 'ShoppingListComponent', method: 'sendToTelegram', data: this.telegramError },
          'telegram send failed'
        );
      }
    });
  }

  loadLastFromTelegram(): void {
    if (this.isLoadingFromTelegram || !this.selectedLoadTargetId) return;
    this.showSendTargetMenu = false;
    this.showLoadTargetMenu = false;
    this.telegramError = '';
    this.telegramSuccess = '';

    const target = this.telegramTargets.find((item) => item.id === this.selectedLoadTargetId);
    if (!target) {
      this.telegramError = 'Select a valid Telegram chat.';
      return;
    }

    this.isLoadingFromTelegram = true;

    this.content.getLastShoppingListFromTelegram(target.id).subscribe({
      next: (response) => {
        const items = Array.isArray(response?.items) ? response.items : [];
        this.shoppingListState.replaceItems(items);
        this.isLoadingFromTelegram = false;
        this.telegramSuccess = items.length > 0
          ? `Loaded last list from ${target.name}.`
          : `No items found in last list for ${target.name}.`;
      },
      error: (err) => {
        this.isLoadingFromTelegram = false;
        this.telegramSuccess = '';
        this.telegramError = err?.error?.error || err?.message || 'Failed to load list from Telegram.';
        this.logger.error(
          { service: 'ShoppingListComponent', method: 'loadLastFromTelegram', data: this.telegramError },
          'telegram list load failed'
        );
      }
    });
  }

  toggleSendTargetMenu(): void {
    if (this.isLoadingTelegramTargets || this.telegramTargets.length === 0) return;
    this.showLoadTargetMenu = false;
    this.showSendTargetMenu = !this.showSendTargetMenu;
  }

  closeSendTargetMenu(): void {
    this.showSendTargetMenu = false;
  }

  selectTelegramTarget(targetId: string): void {
    this.selectedTelegramTargetId = String(targetId || '').trim();
    this.showSendTargetMenu = false;
  }

  toggleLoadTargetMenu(): void {
    if (this.isLoadingTelegramTargets || this.telegramTargets.length === 0) return;
    this.showSendTargetMenu = false;
    this.showLoadTargetMenu = !this.showLoadTargetMenu;
  }

  closeLoadTargetMenu(): void {
    this.showLoadTargetMenu = false;
  }

  selectLoadTarget(targetId: string): void {
    this.selectedLoadTargetId = String(targetId || '').trim();
    this.showLoadTargetMenu = false;
  }

  getSelectedTargetName(): string {
    return this.getTargetNameById(this.selectedTelegramTargetId);
  }

  getSelectedLoadTargetName(): string {
    return this.getTargetNameById(this.selectedLoadTargetId);
  }

  private loadTelegramTargets(): void {
    if (this.isLoadingTelegramTargets) return;

    this.isLoadingTelegramTargets = true;
    const previousSendTargetId = this.selectedTelegramTargetId;
    const previousLoadTargetId = this.selectedLoadTargetId;
    this.content.getTelegramTargets().subscribe({
      next: (response) => {
        this.telegramTargets = Array.isArray(response?.targets) ? response.targets : [];

        const hasSendTarget = this.telegramTargets.some((target) => target.id === previousSendTargetId);
        const hasLoadTarget = this.telegramTargets.some((target) => target.id === previousLoadTargetId);

        this.selectedTelegramTargetId = hasSendTarget
          ? previousSendTargetId
          : (this.telegramTargets.length > 0 ? this.telegramTargets[0].id : '');
        this.selectedLoadTargetId = hasLoadTarget
          ? previousLoadTargetId
          : this.selectedTelegramTargetId;
        this.showSendTargetMenu = false;
        this.showLoadTargetMenu = false;
        this.isLoadingTelegramTargets = false;
      },
      error: (err) => {
        this.telegramTargets = [];
        this.selectedTelegramTargetId = '';
        this.selectedLoadTargetId = '';
        this.showSendTargetMenu = false;
        this.showLoadTargetMenu = false;
        this.isLoadingTelegramTargets = false;
        this.telegramError = err?.error?.error || err?.message || 'Failed to load Telegram targets.';
        this.logger.error(
          { service: 'ShoppingListComponent', method: 'loadTelegramTargets', data: this.telegramError },
          'telegram targets load failed'
        );
      }
    });
  }

  private getTargetNameById(targetId: string): string {
    const target = this.telegramTargets.find((item) => item.id === targetId);
    return target ? target.name : '';
  }

  private addItem(rawValue: string): void {
    const normalized = this.normalizeItem(rawValue);
    if (!normalized) return;

    const wasAdded = this.shoppingListState.addItem(normalized);
    if (!wasAdded) {
      this.showSuggestions = false;
      this.updateSuggestions(true);
      return;
    }

    this.inputValue = '';
    this.showSuggestions = false;
    this.filteredSuggestions = [];
  }

  private updateSuggestions(preserveVisibility = false): void {
    const typed = this.inputValue.trim().toLowerCase();
    const selectedKeys = new Set(this.items.map((item) => this.toItemKey(item)));
    const source = this.allIngredientSuggestions.filter((value) => !selectedKeys.has(this.toItemKey(value)));
    const shouldShowSuggestions = (suggestions: string[]): boolean => {
      if (preserveVisibility) {
        return this.showSuggestions && suggestions.length > 0;
      }
      return suggestions.length > 0;
    };

    if (!typed) {
      this.filteredSuggestions = source.slice(0, 12);
      this.showSuggestions = shouldShowSuggestions(this.filteredSuggestions);
      return;
    }

    this.filteredSuggestions = source
      .filter((value) => value.toLowerCase().includes(typed))
      .slice(0, 12);

    this.showSuggestions = shouldShowSuggestions(this.filteredSuggestions);
  }

  private loadIngredientSuggestions(): void {
    if (this.isLoadingSuggestions) return;

    this.isLoadingSuggestions = true;
    this.content.getIngredientSuggestions().subscribe({
      next: (response) => {
        this.isLoadingSuggestions = false;
        this.allIngredientSuggestions = Array.isArray(response?.suggestions) ? response.suggestions : [];
      },
      error: (err) => {
        this.isLoadingSuggestions = false;
        this.allIngredientSuggestions = [];
        this.logger.error(
          { service: 'ShoppingListComponent', method: 'loadIngredientSuggestions', data: err?.message || err?.error?.message || 'unknown error' },
          'failed to load ingredient suggestions'
        );
      }
    });
  }

  private normalizeItem(value: string): string {
    const compact = String(value || '').trim().replace(/\s+/g, ' ');
    if (!compact) return '';

    return compact.charAt(0).toUpperCase() + compact.slice(1);
  }

  private toItemKey(value: string): string {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }
}
