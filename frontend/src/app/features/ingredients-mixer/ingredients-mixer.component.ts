import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { TelegramTarget } from '../../core/interfaces/content';
import { ContentService } from '../../core/services/content.service';
import { IngredientsMixerStateService } from '../../core/services/ingredients-mixer-state.service';
import { LoggerService } from '../../core/services/logger.service';

@Component({
  selector: 'app-ingredients-mixer',
  templateUrl: './ingredients-mixer.component.html',
  styleUrls: ['./ingredients-mixer.component.css']
})
export class IngredientsMixerComponent implements OnInit, OnDestroy {
  inputValue = '';
  items: string[] = [];

  showSuggestions = false;
  filteredSuggestions: string[] = [];
  allCompatibleSuggestions: string[] = [];
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
  private suggestionsRequestId = 0;
  private readonly onTelegramTargetsUpdated = () => {
    this.loadTelegramTargets();
  };

  constructor(
    private content: ContentService,
    private logger: LoggerService,
    private mixerState: IngredientsMixerStateService
  ) {}

  ngOnInit(): void {
    this.items = this.mixerState.getItems();
    this.itemsSubscription = this.mixerState.items$.subscribe((items) => {
      this.items = items;
      this.refreshCompatibleSuggestions(true);
    });
    this.loadTelegramTargets();
    window.addEventListener('telegram-targets-updated', this.onTelegramTargetsUpdated);
  }

  ngOnDestroy(): void {
    this.itemsSubscription?.unsubscribe();
    window.removeEventListener('telegram-targets-updated', this.onTelegramTargetsUpdated);
  }

  onInputChanged(value: string | Event): void {
    this.inputValue = this.coerceInputValue(value);
    this.updateSuggestions();
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.filteredSuggestions.length > 0) {
        this.addItemFromSuggestion(this.filteredSuggestions[0]);
      }
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
    this.addItemFromSuggestion(value);
  }

  removeItem(index: number): void {
    this.mixerState.removeItemAt(index);
  }

  clearItems(): void {
    this.mixerState.clearItems();
  }

  exportList(): void {
    if (this.items.length === 0) return;

    const now = new Date();
    const dateTag = now.toISOString().slice(0, 10);
    const lines = [
      'Ingredients Mixer',
      `Created: ${now.toLocaleString()}`,
      '',
      ...this.items.map((item, index) => `${index + 1}. ${item}`)
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `ingredients-mixer-${dateTag}.txt`;
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
        this.telegramError = err?.error?.error || err?.message || 'Failed to send mixer list to Telegram.';
        this.logger.error(
          { service: 'IngredientsMixerComponent', method: 'sendToTelegram', data: this.telegramError },
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
        this.mixerState.replaceItems(items);
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
          { service: 'IngredientsMixerComponent', method: 'loadLastFromTelegram', data: this.telegramError },
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
          { service: 'IngredientsMixerComponent', method: 'loadTelegramTargets', data: this.telegramError },
          'telegram targets load failed'
        );
      }
    });
  }

  private getTargetNameById(targetId: string): string {
    const target = this.telegramTargets.find((item) => item.id === targetId);
    return target ? target.name : '';
  }

  private addItemFromSuggestion(rawValue: string): void {
    const normalized = this.normalizeItem(rawValue);
    if (!normalized) return;

    const suggestionExists = this.allCompatibleSuggestions.some((value) => this.toItemKey(value) === this.toItemKey(normalized));
    if (!suggestionExists) {
      this.telegramSuccess = '';
      this.telegramError = 'Select an ingredient from suggestions.';
      return;
    }

    const wasAdded = this.mixerState.addItem(normalized);
    if (!wasAdded) {
      this.showSuggestions = false;
      this.updateSuggestions(true);
      return;
    }

    this.telegramError = '';
    this.inputValue = '';
    this.showSuggestions = false;
    this.filteredSuggestions = [];
  }

  private refreshCompatibleSuggestions(preserveVisibility = false): void {
    const requestId = ++this.suggestionsRequestId;
    this.isLoadingSuggestions = true;

    this.content.getCompatibleIngredientSuggestions(this.items).subscribe({
      next: (response) => {
        if (requestId !== this.suggestionsRequestId) return;

        this.isLoadingSuggestions = false;
        this.allCompatibleSuggestions = Array.isArray(response?.suggestions) ? response.suggestions : [];
        this.updateSuggestions(preserveVisibility);
      },
      error: (err) => {
        if (requestId !== this.suggestionsRequestId) return;

        this.isLoadingSuggestions = false;
        this.allCompatibleSuggestions = [];
        this.updateSuggestions(preserveVisibility);
        this.logger.error(
          { service: 'IngredientsMixerComponent', method: 'refreshCompatibleSuggestions', data: err?.message || err?.error?.message || 'unknown error' },
          'failed to load compatible ingredient suggestions'
        );
      }
    });
  }

  private updateSuggestions(preserveVisibility = false): void {
    const typed = this.inputValue.trim().toLowerCase();
    const selectedKeys = new Set(this.items.map((item) => this.toItemKey(item)));
    const source = this.allCompatibleSuggestions.filter((value) => !selectedKeys.has(this.toItemKey(value)));
    const shouldShowSuggestions = (suggestions: string[]): boolean => {
      if (preserveVisibility) {
        return this.showSuggestions && suggestions.length > 0;
      }
      return suggestions.length > 0;
    };

    if (!typed) {
      this.filteredSuggestions = source;
      this.showSuggestions = shouldShowSuggestions(this.filteredSuggestions);
      return;
    }

    this.filteredSuggestions = source
      .filter((value) => value.toLowerCase().includes(typed));

    this.showSuggestions = shouldShowSuggestions(this.filteredSuggestions);
  }

  private normalizeItem(value: string): string {
    const compact = String(value || '').trim().replace(/\s+/g, ' ');
    if (!compact) return '';

    return compact.charAt(0).toUpperCase() + compact.slice(1);
  }

  private coerceInputValue(value: string | Event): string {
    if (typeof value === 'string') return value;

    const target = (value?.target || null) as { value?: unknown } | null;
    return String(target?.value || '');
  }

  private toItemKey(value: string): string {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }
}
