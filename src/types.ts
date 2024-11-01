// Represents the analysis result from the LLM
export interface ImageAnalysis {
  description: string;
  extractedText: string;
  confidence: number;
}

// Represents a processed image entry in our database
export interface ImageEntry {
  id: string;
  filename: string;
  path: string;
  hash: string;
  analysis: ImageAnalysis;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

// Configuration for our services
export interface Config {
  anthropicApiKey: string;
  vectorDimensions: number;
  dbPath: string;
  supportedImageTypes: string[];
}

// Search result interface
export interface SearchResult {
  entry: ImageEntry;
  similarity: number;
}

// Vector store interface
export interface VectorStore {
  insert(entry: ImageEntry): Promise<void>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  getByHash(hash: string): Promise<ImageEntry | null>;
}