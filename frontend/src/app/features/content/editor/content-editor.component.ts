import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { ContentService, FolderNode } from '../../../core/services/content.service';
import { EditRequest } from '../models/content-shell.models';

type ContentKind = 'ingredient' | 'spice' | 'mix' | 'recipe';

@Component({
  selector: 'app-content-editor',
  templateUrl: './content-editor.component.html'
})
export class ContentEditorComponent implements OnInit, OnChanges {
  @Input() editRequest: EditRequest | null = null;
  @Output() savedExisting = new EventEmitter<void>();

  hierarchy: { [key: string]: FolderNode } = {};

  isSaving = false;
  saveMessage = '';
  saveError = '';

  isEditingExistingFile = false;
  editingTargetSection: 'Recipes' | 'Ingredients' | 'SpicesAndHerbs' | null = null;
  editingTargetFilename = '';

  selectedKind: ContentKind | '' = '';
  formPath = '';
  formTitle = '';
  formDescription = '';

  ingredientProperties: string[] = [''];
  ingredientSubstitutes: string[] = [''];
  ingredientGoesWithIngredients: string[] = [''];
  ingredientGoesWithSpicesAndHerbs: string[] = [''];

  spiceMixesWellWith: string[] = [''];
  spiceGoodWithIngredients: string[] = [''];

  mixComposedOf: string[] = [''];
  mixMixesWellWith: string[] = [''];
  mixGoodWithIngredients: string[] = [''];

  recipeIngredientNames: string[] = [''];
  recipeIngredientQuantities: string[] = [''];
  recipeProcedure: string[] = [''];

  constructor(private content: ContentService) {}

  ngOnInit(): void {
    this.loadHierarchy();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['editRequest']) return;

    const request = changes['editRequest'].currentValue as EditRequest | null;
    if (!request) {
      this.resetEditForm();
      return;
    }

    this.applyEditRequest(request);
  }

  onKindChanged(): void {
    // keep existing subfolder value so changing type does not wipe user input
  }

  onPathInputChange(value: string): void {
    const currentValue = String(value || '').replace(/\\/g, '/');
    const allFolders = this.getAllFolderPathsForSelectedType();
    if (allFolders.includes(currentValue) && !currentValue.endsWith('/')) {
      this.formPath = `${currentValue}/`;
      return;
    }
    this.formPath = currentValue;
  }

  getSelectedSectionRoot(): string {
    if (!this.selectedKind) return '';
    return this.baseFolderForKind(this.selectedKind);
  }

  getPathSuggestions(): string[] {
    if (!this.selectedKind) return [];
    const rootNode = this.getRootNodeForKind(this.selectedKind);
    if (!rootNode) return [];

    const normalized = (this.formPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const hasTrailingSlash = normalized.endsWith('/');
    const segments = normalized.split('/').filter(Boolean);

    const parentSegments = hasTrailingSlash ? segments : segments.slice(0, -1);
    const currentPartial = hasTrailingSlash ? '' : (segments[segments.length - 1] || '');

    let node: FolderNode | null = rootNode;
    for (const segment of parentSegments) {
      if (!node?.subdirs?.[segment]) return [];
      node = node.subdirs[segment];
    }

    return Object.keys(node?.subdirs || {})
      .filter((name) => name.toLowerCase().startsWith(currentPartial.toLowerCase()))
      .map((name) => [...parentSegments, name].join('/'));
  }

  addItem(target: string): void {
    this.listForTarget(target).push('');
  }

  removeItem(target: string, index: number): void {
    const list = this.listForTarget(target);
    if (list.length <= 1) {
      list[0] = '';
      return;
    }
    list.splice(index, 1);
  }

  saveNewFile(): void {
    this.saveMessage = '';
    this.saveError = '';

    const pathValue = this.formPath.trim();
    const titleValue = this.formTitle.trim();
    const descriptionValue = this.formDescription.trim();

    if (!this.selectedKind) {
      this.saveError = 'Type is required.';
      return;
    }

    if (!titleValue) {
      this.saveError = 'Title is required.';
      return;
    }
    if (!descriptionValue) {
      this.saveError = 'Description is required.';
      return;
    }

    const markdown = this.buildMarkdown();
    this.isSaving = true;

    if (this.isEditingExistingFile && this.editingTargetSection && this.editingTargetFilename) {
      this.content.updateFile({
        section: this.editingTargetSection,
        filename: this.editingTargetFilename,
        markdown
      }).subscribe({
        next: (res) => {
          this.isSaving = false;
          this.saveMessage = `Updated: ${res.file || this.editingTargetFilename}`;
          this.savedExisting.emit();
        },
        error: (err) => {
          this.isSaving = false;
          this.saveError = err?.error?.error || err?.message || 'Failed to update file.';
        }
      });
      return;
    }

    const fullPath = this.composeStoragePath(pathValue);

    this.content.createContent({ path: fullPath, title: titleValue, markdown }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.saveMessage = `Saved: ${res.file || `${this.slugify(titleValue)}.md`}`;
        this.resetEditForm();
        this.loadHierarchy();
      },
      error: (err) => {
        this.isSaving = false;
        this.saveError = err?.error?.error || err?.message || 'Failed to save file.';
      }
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  private loadHierarchy(): void {
    this.content.getHierarchy().subscribe(data => {
      this.hierarchy = data;
    });
  }

  private applyEditRequest(request: EditRequest): void {
    const kind = this.kindFromSection(request.section, request.filename, request.rawContent);
    if (!kind) return;

    this.resetEditForm();
    this.selectedKind = kind;
    this.isEditingExistingFile = true;
    this.editingTargetSection = request.section;
    this.editingTargetFilename = request.filename;

    const pathParts = request.filename.split('/').filter(Boolean);
    if (kind === 'mix') {
      const withoutMixRoot = pathParts[0] === 'mixes' ? pathParts.slice(1) : pathParts;
      this.formPath = withoutMixRoot.length > 1 ? withoutMixRoot.slice(0, -1).join('/') : '';
    } else {
      this.formPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
    }

    this.prefillFormFromMarkdown(request.rawContent, kind, request.filename);
    this.saveMessage = '';
    this.saveError = '';
  }

  private buildMarkdown(): string {
    const lines: string[] = [];
    lines.push(`# ${this.formTitle.trim()}`);
    lines.push('');
    lines.push(this.formDescription.trim());
    lines.push('');

    if (this.selectedKind === 'ingredient') {
      lines.push('## Properties');
      lines.push('');
      this.pushBullets(lines, this.ingredientProperties);
      lines.push('');

      lines.push('## Substitutes');
      lines.push('');
      this.pushBullets(lines, this.ingredientSubstitutes);
      lines.push('');

      lines.push('## Goes with ingredients');
      this.pushLinkedIngredients(lines, this.ingredientGoesWithIngredients);
      lines.push('');

      lines.push('## Goes with spicesAndHerbs');
      this.pushLinkedSpices(lines, this.ingredientGoesWithSpicesAndHerbs);
      return lines.join('\n');
    }

    if (this.selectedKind === 'spice') {
      lines.push('## Mixes Well With');
      lines.push('');
      this.pushBullets(lines, this.spiceMixesWellWith);
      lines.push('');

      lines.push('## Good With Ingredients');
      lines.push('');
      this.pushBullets(lines, this.spiceGoodWithIngredients);
      return lines.join('\n');
    }

    if (this.selectedKind === 'mix') {
      lines.push('## Composed of');
      this.pushLinkedSpices(lines, this.mixComposedOf);
      lines.push('');

      lines.push('## Mixes Well With');
      lines.push('');
      this.pushBullets(lines, this.mixMixesWellWith);
      lines.push('');

      lines.push('## Good With Ingredients');
      lines.push('');
      this.pushBullets(lines, this.mixGoodWithIngredients);
      return lines.join('\n');
    }

    lines.push('## Ingredients');
    this.pushRecipeIngredients(lines);
    lines.push('');
    lines.push('## Procedure');
    lines.push('');

    const steps = this.recipeProcedure.map(v => v.trim()).filter(Boolean);
    if (steps.length === 0) {
      lines.push('1. ');
    } else {
      steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    }

    return lines.join('\n');
  }

  private pushBullets(lines: string[], values: string[]): void {
    const cleaned = values.map(v => v.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      lines.push('- ');
      return;
    }
    cleaned.forEach(value => lines.push(`- ${value}`));
  }

  private pushLinkedIngredients(lines: string[], values: string[]): void {
    const cleaned = values.map(v => v.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      lines.push('- ');
      return;
    }
    cleaned.forEach(value => lines.push(`- ${this.toIngredientReference(value)}`));
  }

  private pushLinkedSpices(lines: string[], values: string[]): void {
    const cleaned = values.map(v => v.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      lines.push('- ');
      return;
    }
    cleaned.forEach(value => lines.push(`- ${this.toSpiceReference(value)}`));
  }

  private pushRecipeIngredients(lines: string[]): void {
    const rowCount = Math.max(this.recipeIngredientNames.length, this.recipeIngredientQuantities.length);
    const output: string[] = [];

    for (let index = 0; index < rowCount; index += 1) {
      const name = (this.recipeIngredientNames[index] || '').trim();
      const quantity = (this.recipeIngredientQuantities[index] || '').trim();
      if (!name) continue;

      const ingredientRef = this.toIngredientReference(name);
      output.push(quantity ? `${quantity} ${ingredientRef}` : ingredientRef);
    }

    if (output.length === 0) {
      lines.push('- ');
      return;
    }

    output.forEach(item => lines.push(`- ${item}`));
  }

  private toIngredientReference(value: string): string {
    if (value.startsWith('[') && value.includes('](')) return value;
    const resolved = this.resolveSectionFile('Ingredients', value);
    if (!resolved) return value;
    const label = this.toTitleLabel(resolved.split('/').pop()?.replace(/\.md$/i, '') || value);
    return `[${label}](/api/ingredients/${resolved})`;
  }

  private toSpiceReference(value: string): string {
    if (value.startsWith('[') && value.includes('](')) return value;
    const resolved = this.resolveSectionFile('SpicesAndHerbs', value);
    if (!resolved) return value;
    const label = this.toTitleLabel(resolved.split('/').pop()?.replace(/\.md$/i, '') || value);
    return `[${label}](/api/spices/${resolved})`;
  }

  private resolveSectionFile(section: 'Ingredients' | 'SpicesAndHerbs', inputValue: string): string | null {
    const files = this.collectSectionFiles(section);
    if (files.length === 0) return null;

    const raw = (inputValue || '').trim();
    if (!raw) return null;

    const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.md$/i, '');
    const directCandidate = `${normalized}.md`.toLowerCase();
    const directMatch = files.find(file => file.toLowerCase() === directCandidate);
    if (directMatch) return directMatch;

    const slugCandidate = `${this.slugify(normalized)}.md`.toLowerCase();
    const slugDirectMatch = files.find(file => file.toLowerCase() === slugCandidate);
    if (slugDirectMatch) return slugDirectMatch;

    const baseMatch = files.filter(file => file.toLowerCase().endsWith(`/${slugCandidate}`) || file.toLowerCase() === slugCandidate);
    if (baseMatch.length === 1) return baseMatch[0];

    return null;
  }

  private collectSectionFiles(section: 'Ingredients' | 'SpicesAndHerbs'): string[] {
    const rootNode = this.hierarchy?.[section];
    if (!rootNode) return [];

    const output: string[] = [];
    const walk = (node: FolderNode, currentPath: string) => {
      for (const file of node.files || []) {
        output.push(currentPath ? `${currentPath}/${file}` : file);
      }
      for (const sub of Object.keys(node.subdirs || {})) {
        walk(node.subdirs[sub], currentPath ? `${currentPath}/${sub}` : sub);
      }
    };

    walk(rootNode, '');
    return output;
  }

  private baseFolderForKind(kind: ContentKind): string {
    switch (kind) {
      case 'ingredient':
        return 'Ingredients';
      case 'spice':
        return 'SpicesAndHerbs';
      case 'mix':
        return 'SpicesAndHerbs/mixes';
      case 'recipe':
        return 'Recipes';
      default:
        return 'Ingredients';
    }
  }

  private getRootNodeForKind(kind: ContentKind): FolderNode | null {
    if (kind === 'mix') {
      return this.hierarchy?.['SpicesAndHerbs']?.subdirs?.['mixes'] || null;
    }
    const root = this.baseFolderForKind(kind);
    return this.hierarchy?.[root] || null;
  }

  private getAllFolderPathsForSelectedType(): string[] {
    if (!this.selectedKind) return [];
    const rootNode = this.getRootNodeForKind(this.selectedKind);
    if (!rootNode) return [];

    const folders: string[] = [];
    const walk = (node: FolderNode, currentPath: string) => {
      for (const sub of Object.keys(node.subdirs || {})) {
        const nextPath = currentPath ? `${currentPath}/${sub}` : sub;
        folders.push(nextPath);
        walk(node.subdirs[sub], nextPath);
      }
    };

    walk(rootNode, '');
    return folders;
  }

  private composeStoragePath(userSubPath: string): string {
    const sectionRoot = this.baseFolderForKind(this.selectedKind as ContentKind);
    const normalizedSubPath = userSubPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return normalizedSubPath ? `${sectionRoot}/${normalizedSubPath}` : sectionRoot;
  }

  private resetEditForm(): void {
    this.selectedKind = '';
    this.formPath = '';
    this.formTitle = '';
    this.formDescription = '';
    this.ingredientProperties = [''];
    this.ingredientSubstitutes = [''];
    this.ingredientGoesWithIngredients = [''];
    this.ingredientGoesWithSpicesAndHerbs = [''];
    this.spiceMixesWellWith = [''];
    this.spiceGoodWithIngredients = [''];
    this.mixComposedOf = [''];
    this.mixMixesWellWith = [''];
    this.mixGoodWithIngredients = [''];
    this.recipeIngredientNames = [''];
    this.recipeIngredientQuantities = [''];
    this.recipeProcedure = [''];
    this.isEditingExistingFile = false;
    this.editingTargetSection = null;
    this.editingTargetFilename = '';
  }

  private listForTarget(target: string): string[] {
    switch (target) {
      case 'ingredientProperties':
        return this.ingredientProperties;
      case 'ingredientSubstitutes':
        return this.ingredientSubstitutes;
      case 'ingredientGoesWithIngredients':
        return this.ingredientGoesWithIngredients;
      case 'ingredientGoesWithSpicesAndHerbs':
        return this.ingredientGoesWithSpicesAndHerbs;
      case 'spiceMixesWellWith':
        return this.spiceMixesWellWith;
      case 'spiceGoodWithIngredients':
        return this.spiceGoodWithIngredients;
      case 'mixComposedOf':
        return this.mixComposedOf;
      case 'mixMixesWellWith':
        return this.mixMixesWellWith;
      case 'mixGoodWithIngredients':
        return this.mixGoodWithIngredients;
      case 'recipeProcedure':
        return this.recipeProcedure;
      default:
        return this.ingredientProperties;
    }
  }

  private kindFromSection(section: string, filename: string, content: string): ContentKind | null {
    switch (section) {
      case 'Ingredients':
        return 'ingredient';
      case 'SpicesAndHerbs':
        return this.isMixFile(filename, content) ? 'mix' : 'spice';
      case 'Recipes':
        return 'recipe';
      default:
        return null;
    }
  }

  private isMixFile(filename: string, content: string): boolean {
    const normalizedFilename = (filename || '').replace(/\\/g, '/').toLowerCase();
    if (normalizedFilename.startsWith('mixes/')) return true;
    return /(^|\n)##\s+Composed\s+of\s*($|\n)/i.test(content || '');
  }

  private prefillFormFromMarkdown(markdown: string, kind: ContentKind, fallbackFilename: string): void {
    const lines = (markdown || '').split(/\r?\n/);

    const titleLine = lines.find(line => line.trim().startsWith('# '));
    const fallbackTitle = fallbackFilename.replace(/\.md$/i, '').split('/').pop() || '';
    this.formTitle = titleLine ? titleLine.trim().slice(2).trim() : this.toTitleLabel(fallbackTitle);

    const headingIndices: Array<{ index: number; title: string }> = [];
    lines.forEach((line, index) => {
      const match = line.match(/^##\s+(.+)$/);
      if (match) headingIndices.push({ index, title: match[1].trim() });
    });

    const firstHeadingIndex = headingIndices.length ? headingIndices[0].index : lines.length;
    const descriptionStart = titleLine ? lines.findIndex(line => line === titleLine) + 1 : 0;
    this.formDescription = lines.slice(descriptionStart, firstHeadingIndex).join('\n').trim();

    const sectionBlocks: { [name: string]: string[] } = {};
    for (let i = 0; i < headingIndices.length; i += 1) {
      const current = headingIndices[i];
      const next = headingIndices[i + 1];
      const endIndex = next ? next.index : lines.length;
      sectionBlocks[current.title] = lines.slice(current.index + 1, endIndex);
    }

    const bullets = (name: string): string[] => {
      const block = sectionBlocks[name] || [];
      const values = block
        .map(line => line.trim())
        .filter(line => line.startsWith('- '))
        .map(line => line.slice(2).trim())
        .filter(Boolean);
      return values.length ? values : [''];
    };

    const numbered = (name: string): string[] => {
      const block = sectionBlocks[name] || [];
      const values = block
        .map(line => line.trim())
        .filter(line => /^\d+\.\s+/.test(line))
        .map(line => line.replace(/^\d+\.\s+/, '').trim())
        .filter(Boolean);
      return values.length ? values : [''];
    };

    if (kind === 'ingredient') {
      this.ingredientProperties = bullets('Properties');
      this.ingredientSubstitutes = bullets('Substitutes');
      this.ingredientGoesWithIngredients = bullets('Goes with ingredients');
      this.ingredientGoesWithSpicesAndHerbs = bullets('Goes with spicesAndHerbs');
      return;
    }

    if (kind === 'spice') {
      this.spiceMixesWellWith = bullets('Mixes Well With');
      this.spiceGoodWithIngredients = bullets('Good With Ingredients');
      return;
    }

    if (kind === 'mix') {
      this.mixComposedOf = bullets('Composed of');
      this.mixMixesWellWith = bullets('Mixes Well With');
      this.mixGoodWithIngredients = bullets('Good With Ingredients');
      return;
    }

    this.setRecipeIngredientsFromBullets(bullets('Ingredients'));
    this.recipeProcedure = numbered('Procedure');
  }

  addRecipeIngredient(): void {
    this.recipeIngredientNames.push('');
    this.recipeIngredientQuantities.push('');
  }

  removeRecipeIngredient(index: number): void {
    if (this.recipeIngredientNames.length <= 1) {
      this.recipeIngredientNames[0] = '';
      this.recipeIngredientQuantities[0] = '';
      return;
    }
    this.recipeIngredientNames.splice(index, 1);
    this.recipeIngredientQuantities.splice(index, 1);
  }

  private setRecipeIngredientsFromBullets(items: string[]): void {
    const source = items.length ? items : [''];
    const parsed = source.map((item) => this.parseRecipeIngredientItem(item));
    this.recipeIngredientNames = parsed.map((entry) => entry.name || '');
    this.recipeIngredientQuantities = parsed.map((entry) => entry.quantity || '');
  }

  private parseRecipeIngredientItem(item: string): { quantity: string; name: string } {
    const text = String(item || '').trim();
    if (!text) return { quantity: '', name: '' };

    const fullLinkMatch = text.match(/^\s*\[(.+?)\]\(.+?\)\s*$/);
    if (fullLinkMatch) {
      return { quantity: '', name: fullLinkMatch[1].trim() };
    }

    const qtyPlusLinkMatch = text.match(/^(.*?)(\[(.+?)\]\(.+?\))(.*)$/);
    if (qtyPlusLinkMatch) {
      const quantity = `${qtyPlusLinkMatch[1] || ''} ${qtyPlusLinkMatch[4] || ''}`.trim();
      const name = (qtyPlusLinkMatch[3] || '').trim();
      return { quantity, name };
    }

    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) {
      return { quantity: '', name: text };
    }

    const normalizedToken = (value: string) => value.toLowerCase().replace(/[.,]/g, '');
    const units = new Set(['g', 'kg', 'mg', 'ml', 'l', 'cl', 'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'pcs', 'pc']);
    const isQuantityToken = (value: string) => /\d/.test(value) || ['q.b.', 'qb', 'circa', 'ca', 'ca.', 'about', 'x'].includes(normalizedToken(value));
    const isUnitToken = (value: string) => units.has(normalizedToken(value));

    let splitIndex = 0;
    if (isQuantityToken(tokens[0])) {
      splitIndex = 1;
      while (splitIndex < tokens.length && (isQuantityToken(tokens[splitIndex]) || isUnitToken(tokens[splitIndex])) && splitIndex < 3) {
        splitIndex += 1;
      }
    }

    if (splitIndex === 0 || splitIndex >= tokens.length) {
      return { quantity: '', name: text };
    }

    return {
      quantity: tokens.slice(0, splitIndex).join(' ').trim(),
      name: tokens.slice(splitIndex).join(' ').trim(),
    };
  }

  private toTitleLabel(value: string): string {
    return value
      .replace(/[-_]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled';
  }
}
