export interface IngredientFamilyVariant {
  path: string;
  label: string;
}

export interface IngredientFamily {
  key: string;
  label: string;
  hasExactFile: boolean;
  isFamily: boolean;
  variants: IngredientFamilyVariant[];
}

export interface IngredientFamiliesResponse {
  indexName: string;
  updatedAt?: string | null;
  families: IngredientFamily[];
  error?: string;
}

export interface IngredientFamilyByNameResponse {
  indexName: string;
  updatedAt?: string | null;
  family?: IngredientFamily;
  error?: string;
}
