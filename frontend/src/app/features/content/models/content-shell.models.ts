export interface EditRequest {
  section: 'Recipes' | 'Ingredients' | 'SpicesAndHerbs';
  filename: string;
  rawContent: string;
}
