import { ContentSection } from './content-common.interface';

export interface IndexInfo {
  name: string;
  version: number;
  strategy: string;
}

export interface IndexSnapshot {
  name: string;
  version: number;
  strategy: string;
  updatedAt?: string;
  entries: { [key: string]: string[] };
}

export interface IndexSearchFile {
  path: string;
  section: ContentSection;
  filename: string;
  matchedTerms?: number;
  totalSelectedTerms?: number;
}

export interface IndexSearchGroup {
  matchedTerms: number;
  totalSelectedTerms: number;
  files: IndexSearchFile[];
}

export interface IndexSearchResponse {
  indexName: string;
  terms: string[];
  files: IndexSearchFile[];
  groupedByMatchedTerms?: IndexSearchGroup[];
}
