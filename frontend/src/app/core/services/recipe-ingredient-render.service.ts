import { Injectable } from '@angular/core';
import { ContentSection, IngredientFamily } from '../interfaces/content';

export type RecipeRenderedAction =
  | { type: 'add-to-shopping'; item: string }
  | { type: 'open-file'; section: ContentSection; filename: string }
  | { type: 'toggle-family' };

@Injectable({
  providedIn: 'root'
})
export class RecipeIngredientRenderService {
  decorateRecipeIngredients(
    renderedHtml: string,
    shoppingItemKeys: Set<string>,
    ingredientFamiliesByKey: { [key: string]: IngredientFamily }
  ): string {
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
        this.decorateIngredientList(current as HTMLElement, shoppingItemKeys, ingredientFamiliesByKey);
      }

      current = current.nextElementSibling;
    }

    return template.innerHTML;
  }

  resolveRenderedAction(event: MouseEvent, fallbackSection?: ContentSection): RecipeRenderedAction | null {
    const rawTarget = event.target;
    if (!rawTarget) return null;

    // Clicks on button/anchor text can surface a Text node target in some browsers.
    const target = rawTarget instanceof Element
      ? rawTarget
      : (rawTarget instanceof Node ? rawTarget.parentElement : null);
    if (!target) return null;

    const familyToggle = target.closest('.recipe-ingredient-family-toggle') as HTMLElement | null;
    if (familyToggle) {
      event.preventDefault();
      event.stopPropagation();
      this.toggleFamilyVariants(familyToggle);
      return { type: 'toggle-family' };
    }

    const addButton = target.closest('.recipe-ingredient-add-btn') as HTMLElement | null;
    if (addButton) {
      event.preventDefault();
      event.stopPropagation();

      const ingredientItem = addButton.closest('li') as HTMLLIElement | null;
      if (!ingredientItem) return null;

      const itemFromDataset = String(ingredientItem.dataset['shoppingItemLabel'] || '').trim();
      const item = itemFromDataset || this.normalizeShoppingItemLabel(this.extractShoppingItemLabel(ingredientItem));
      if (!item) return null;

      return { type: 'add-to-shopping', item };
    }

    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (!anchor) return null;

    const href = String(anchor.getAttribute('href') || '').trim();
    const apiFile = this.parseApiFileTarget(href);
    if (apiFile) {
      event.preventDefault();
      return { type: 'open-file', section: apiFile.section, filename: apiFile.filename };
    }

    const relativeMdTarget = this.extractRelativeMarkdownTarget(href);
    if (relativeMdTarget && fallbackSection) {
      event.preventDefault();
      return { type: 'open-file', section: fallbackSection, filename: relativeMdTarget };
    }

    return null;
  }

  normalizeShoppingItemLabel(value: string): string {
    const compact = String(value || '').trim().replace(/\s+/g, ' ');
    if (!compact) return '';
    return compact.charAt(0).toUpperCase() + compact.slice(1);
  }

  private decorateIngredientList(
    listElement: HTMLElement,
    shoppingItemKeys: Set<string>,
    ingredientFamiliesByKey: { [key: string]: IngredientFamily }
  ): void {
    const listItems = Array.from(listElement.children)
      .filter((child) => child.tagName.toUpperCase() === 'LI') as HTMLLIElement[];

    listItems.forEach((item) => {
      const shoppingItemLabel = this.normalizeShoppingItemLabel(this.extractShoppingItemLabel(item));
      if (!shoppingItemLabel) return;

      const ingredientMain = document.createElement('span');
      ingredientMain.className = 'recipe-ingredient-main';
      while (item.firstChild) {
        ingredientMain.appendChild(item.firstChild);
      }
      item.appendChild(ingredientMain);

      const ingredientLookupLabel = this.extractFamilyLookupLabel(item);
      const ingredientLookupKey = this.normalizeIngredientKey(ingredientLookupLabel);
      const family = ingredientLookupKey ? ingredientFamiliesByKey[ingredientLookupKey] : undefined;
      const showFamilyToggle = !!family && family.isFamily && !family.hasExactFile && family.variants.length > 0;

      const ingredientKey = this.normalizeIngredientKey(shoppingItemLabel);
      const isAlreadyInShoppingList = shoppingItemKeys.has(ingredientKey);

      item.classList.add('recipe-ingredient-item');
      item.dataset['shoppingItemLabel'] = shoppingItemLabel;

      const controls = document.createElement('span');
      controls.className = 'recipe-ingredient-controls';

      if (showFamilyToggle && family) {
        const familyDropdown = document.createElement('span');
        familyDropdown.className = 'recipe-ingredient-family-dropdown';

        const familyToggle = document.createElement('a');
        familyToggle.href = '#';
        familyToggle.setAttribute('role', 'button');
        familyToggle.className = 'recipe-ingredient-family-toggle';
        familyToggle.setAttribute('aria-expanded', 'false');
        familyToggle.setAttribute('title', `Show ${family.label} variants`);
        familyToggle.setAttribute('aria-label', `Show ${family.label} variants`);
        familyToggle.textContent = '▸';
        familyDropdown.appendChild(familyToggle);

        const familyVariantsList = document.createElement('ul');
        familyVariantsList.className = 'recipe-ingredient-family-variants';
        familyVariantsList.hidden = true;

        family.variants.forEach((variant) => {
          const variantItem = document.createElement('li');
          const variantLink = document.createElement('a');
          const encodedPath = String(variant.path || '')
            .split('/')
            .filter(Boolean)
            .map((segment) => encodeURIComponent(segment))
            .join('/');

          variantLink.href = `/api/ingredients/${encodedPath}`;
          variantLink.textContent = variant.label;
          variantItem.appendChild(variantLink);
          familyVariantsList.appendChild(variantItem);
        });

        familyDropdown.appendChild(familyVariantsList);
        ingredientMain.appendChild(familyDropdown);
        item.classList.add('recipe-ingredient-has-family');
      }

      if (!isAlreadyInShoppingList) {
        const addButton = document.createElement('a');
        addButton.href = '#';
        addButton.setAttribute('role', 'button');
        addButton.className = 'recipe-ingredient-add-btn';
        addButton.setAttribute('title', 'Add to shopping list');
        addButton.setAttribute('aria-label', `Add ${shoppingItemLabel} to shopping list`);
        addButton.textContent = '+';
        controls.appendChild(addButton);
      }

      if (controls.children.length > 0) {
        item.classList.add('recipe-ingredient-has-controls');
        item.appendChild(controls);
      } else {
        item.classList.add('recipe-ingredient-in-cart');
      }
    });
  }

  private toggleFamilyVariants(toggleButton: HTMLElement): void {
    const familyDropdown = toggleButton.closest('.recipe-ingredient-family-dropdown') as HTMLElement | null;
    if (!familyDropdown) return;

    const variants = familyDropdown.querySelector('.recipe-ingredient-family-variants') as HTMLElement | null;
    if (!variants) return;

    const nextExpanded = variants.hidden;
    variants.hidden = !nextExpanded;
    toggleButton.textContent = nextExpanded ? '▾' : '▸';
    toggleButton.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
    toggleButton.classList.toggle('active', nextExpanded);
  }

  private extractShoppingItemLabel(item: HTMLLIElement): string {
    const clone = item.cloneNode(true) as HTMLElement;
    Array.from(clone.querySelectorAll('.recipe-ingredient-controls, .recipe-ingredient-family-dropdown, .recipe-ingredient-family-variants, .recipe-ingredient-family-toggle, ul, ol')).forEach((el) => el.remove());
    return String(clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  private extractFamilyLookupLabel(item: HTMLLIElement): string {
    const clone = item.cloneNode(true) as HTMLElement;
    Array.from(clone.querySelectorAll('.recipe-ingredient-controls, .recipe-ingredient-family-dropdown, .recipe-ingredient-family-variants, .recipe-ingredient-family-toggle, ul, ol')).forEach((el) => el.remove());

    const linked = clone.querySelector('a');
    if (linked && String(linked.textContent || '').trim()) {
      return String(linked.textContent || '').trim();
    }

    const plainTextLabel = String(clone.textContent || '').replace(/\s+/g, ' ').trim();
    return this.stripQuantityPrefix(plainTextLabel);
  }

  private stripQuantityPrefix(value: string): string {
    const text = String(value || '').trim();
    if (!text) return '';

    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) return text;

    let splitIndex = 0;
    if (this.isQuantityToken(tokens[0])) {
      splitIndex = 1;
      while (splitIndex < tokens.length && (this.isQuantityToken(tokens[splitIndex]) || this.isUnitToken(tokens[splitIndex])) && splitIndex < 4) {
        splitIndex += 1;
      }
    }

    if (splitIndex === 0 || splitIndex >= tokens.length) {
      return text;
    }

    return tokens.slice(splitIndex).join(' ').trim();
  }

  private isQuantityToken(value: string): boolean {
    const normalized = String(value || '').toLowerCase().replace(/[.,]/g, '');
    return /\d/.test(value) || ['q.b', 'qb', 'circa', 'ca', 'about', 'x'].includes(normalized);
  }

  private isUnitToken(value: string): boolean {
    const normalized = String(value || '').toLowerCase().replace(/[.,]/g, '');
    const units = new Set(['g', 'kg', 'mg', 'ml', 'l', 'cl', 'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'pcs', 'pc']);
    return units.has(normalized);
  }

  private normalizeIngredientKey(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeHeading(value: string | null): string {
    return String(value || '').trim().toLowerCase();
  }

  private parseApiFileTarget(href: string): { section: ContentSection; filename: string } | null {
    if (!href || !href.startsWith('/api/')) return null;

    const parts = href.split('/').filter(Boolean);
    if (parts.length < 3) return null;

    const section = this.mapApiSectionToName(parts[1]);
    if (!section) return null;

    const filename = parts.slice(2).map((part) => decodeURIComponent(part)).join('/');
    if (!filename) return null;

    return { section, filename };
  }

  private mapApiSectionToName(key: string): ContentSection | null {
    switch (String(key || '').toLowerCase()) {
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

  private extractRelativeMarkdownTarget(href: string): string | null {
    const cleaned = String(href || '').trim();
    if (!cleaned || cleaned.startsWith('#')) return null;
    if (cleaned.startsWith('/')) return null;
    if (/^(https?:|mailto:|tel:)/i.test(cleaned)) return null;

    const noHash = cleaned.split('#')[0];
    const noQuery = noHash.split('?')[0];
    if (!noQuery.toLowerCase().endsWith('.md')) return null;

    const normalized = noQuery.replace(/^\.\//, '');
    return decodeURIComponent(normalized);
  }
}
