export interface IngredientSuggestionsResponse {
  indexName: string;
  updatedAt?: string | null;
  selected?: string[];
  suggestions: string[];
  error?: string;
}
