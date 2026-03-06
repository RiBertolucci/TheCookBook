import { TestBed } from '@angular/core/testing';
import { IngredientFamily } from '../interfaces/content';
import { RecipeIngredientRenderService } from './recipe-ingredient-render.service';

describe('RecipeIngredientRenderService', () => {
  let service: RecipeIngredientRenderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RecipeIngredientRenderService);
  });

  it('shows family toggle only for exact family-name ingredients', () => {
    const familiesByKey: { [key: string]: IngredientFamily } = {
      patata: {
        key: 'patata',
        label: 'Patata',
        hasExactFile: false,
        isFamily: true,
        variants: [
          { path: 'verdure/patata/patata-gialla.md', label: 'Patata Gialla' },
          { path: 'verdure/patata/patata-novella.md', label: 'Patata Novella' }
        ]
      }
    };

    const html = [
      '<h2>Ingredients</h2>',
      '<ul>',
      '  <li>Patata</li>',
      '  <li><a href="/api/ingredients/verdure/patata/patata-novella.md">Patata Novella</a></li>',
      '</ul>'
    ].join('');

    const decorated = service.decorateRecipeIngredients(html, new Set<string>(), familiesByKey);
    const host = document.createElement('div');
    host.innerHTML = decorated;

    const toggles = host.querySelectorAll('.recipe-ingredient-family-toggle');
    expect(toggles.length).toBe(1);

    const firstItem = host.querySelector('li.recipe-ingredient-item');
    expect(firstItem?.querySelector('.recipe-ingredient-family-variants')).toBeTruthy();

    const secondItem = host.querySelectorAll('li.recipe-ingredient-item')[1];
    expect(secondItem?.querySelector('.recipe-ingredient-family-toggle')).toBeFalsy();
  });

  it('shows family toggle for family ingredients even with quantity prefixes', () => {
    const familiesByKey: { [key: string]: IngredientFamily } = {
      patata: {
        key: 'patata',
        label: 'Patata',
        hasExactFile: false,
        isFamily: true,
        variants: [
          { path: 'verdure/patata/patata-gialla.md', label: 'Patata Gialla' }
        ]
      }
    };

    const html = [
      '<h2>Ingredients</h2>',
      '<ul>',
      '  <li>200 g Patata</li>',
      '  <li>2 cucchiai Olio</li>',
      '</ul>'
    ].join('');

    const decorated = service.decorateRecipeIngredients(html, new Set<string>(), familiesByKey);
    const host = document.createElement('div');
    host.innerHTML = decorated;

    const firstItem = host.querySelectorAll('li.recipe-ingredient-item')[0];
    const secondItem = host.querySelectorAll('li.recipe-ingredient-item')[1];

    expect(firstItem?.querySelector('.recipe-ingredient-family-toggle')).toBeTruthy();
    expect(firstItem?.querySelector('.recipe-ingredient-main .recipe-ingredient-family-dropdown')).toBeTruthy();
    expect(firstItem?.querySelector('.recipe-ingredient-family-dropdown .recipe-ingredient-family-variants')).toBeTruthy();
    expect(secondItem?.querySelector('.recipe-ingredient-family-toggle')).toBeFalsy();
  });

  it('resolves add-to-shopping action from rendered ingredient controls', () => {
    const host = document.createElement('div');
    host.innerHTML = '<li class="recipe-ingredient-item" data-shopping-item-label="Patata"><button type="button" class="recipe-ingredient-add-btn">+</button></li>';

    const addButton = host.querySelector('.recipe-ingredient-add-btn') as HTMLButtonElement;
    let capturedAction: ReturnType<RecipeIngredientRenderService['resolveRenderedAction']> = null;

    addButton.addEventListener('click', (event) => {
      capturedAction = service.resolveRenderedAction(event as MouseEvent, 'Recipes');
    });

    addButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(capturedAction as any).toEqual({ type: 'add-to-shopping', item: 'Patata' });
  });

  it('resolves add-to-shopping action without relying on data attributes', () => {
    const host = document.createElement('div');
    host.innerHTML = [
      '<li class="recipe-ingredient-item">',
      '  <span class="recipe-ingredient-main">patata novella</span>',
      '  <span class="recipe-ingredient-controls"><a href="#" role="button" class="recipe-ingredient-add-btn">+</a></span>',
      '</li>'
    ].join('');

    const addButton = host.querySelector('.recipe-ingredient-add-btn') as HTMLAnchorElement;
    let capturedAction: ReturnType<RecipeIngredientRenderService['resolveRenderedAction']> = null;

    addButton.addEventListener('click', (event) => {
      capturedAction = service.resolveRenderedAction(event as MouseEvent, 'Recipes');
    });

    addButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(capturedAction as any).toEqual({ type: 'add-to-shopping', item: 'Patata novella' });
  });

  it('resolves open-file action for api ingredient links', () => {
    const host = document.createElement('div');
    host.innerHTML = '<a href="/api/ingredients/verdure/patata/patata-gialla.md">Patata Gialla</a>';

    const link = host.querySelector('a') as HTMLAnchorElement;
    let capturedAction: ReturnType<RecipeIngredientRenderService['resolveRenderedAction']> = null;

    link.addEventListener('click', (event) => {
      capturedAction = service.resolveRenderedAction(event as MouseEvent, 'Recipes');
    });

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(capturedAction as any).toEqual({
      type: 'open-file',
      section: 'Ingredients',
      filename: 'verdure/patata/patata-gialla.md'
    });
  });
});
