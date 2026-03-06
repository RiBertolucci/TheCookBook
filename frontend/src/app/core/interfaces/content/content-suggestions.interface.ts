export interface IngredientSuggestionsResponse {
  indexName: string;
  updatedAt?: string | null;
  suggestions: string[];
  error?: string;
}
