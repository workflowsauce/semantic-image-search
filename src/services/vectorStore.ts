import Database from "better-sqlite3";
import { ImageEntry, SearchResult, VectorStore } from "../types";
import { createEmbedding } from "../utils/embedding";
import path from "path";
import fs from "fs";
import sqliteVec from "sqlite-vec";

export class SQLiteVectorStore implements VectorStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Create the directory if it doesn't exist
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    sqliteVec.load(this.db);

    this.initialize();
  }

  private initialize() {
    // Verify vector extension is loaded
    const vec_version = (
      this.db.prepare("select vec_version() as vec_version;").get() as any
    ).vec_version;

    console.log(`Initialized VectorDB with sqlite-vec version ${vec_version}`);

    // Create tables with vector support
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        hash TEXT NOT NULL,
        description TEXT NOT NULL,
        extracted_text TEXT NOT NULL,
        confidence REAL NOT NULL,
        embedding BLOB NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_hash ON images(hash);
    `);
  }

  async insert(entry: ImageEntry): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO images (
        id, filename, path, hash, description, extracted_text, 
        confidence, embedding, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, vec_f32(?), ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.filename,
      entry.path,
      entry.hash,
      entry.analysis.description,
      entry.analysis.extractedText,
      entry.analysis.confidence,
      JSON.stringify(entry.embedding),
      entry.createdAt.toISOString(),
      entry.updatedAt.toISOString()
    );
  }

  async getByFilename(filename: string): Promise<ImageEntry | null> {
    const result: any = this.db
      .prepare("SELECT * FROM images WHERE filename = ?")
      .get(filename);

    if (!result) return null;

    return result;
  }

  async getByHash(hash: string): Promise<ImageEntry | null> {
    const result: any = this.db
      .prepare(
        `
        SELECT *
        FROM images
        WHERE hash = ?
      `
      )
      .get(hash);

    if (!result) return null;

    const buffer = result.embedding as Buffer;
    const float32Array = new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.length / 4
    );

    console.log("getByHash", float32Array.length);

    return {
      id: result.id,
      filename: result.filename,
      path: result.path,
      hash: result.hash,
      analysis: {
        description: result.description,
        extractedText: result.extracted_text,
        confidence: result.confidence,
      },
      embedding: Array.from(float32Array),
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    };
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const searchEmbedding = await createEmbedding(query);

    console.log("searchEmbedding", searchEmbedding.length);

    const results = this.db
      .prepare(
        `
        SELECT 
          id, filename, path, hash, description, extracted_text, 
          confidence, embedding, created_at, updated_at,
          vec_distance_L2(embedding, ?) as similarity
        FROM images
        ORDER BY similarity ASC
        LIMIT ?
      `
      )
      .all(JSON.stringify(searchEmbedding), limit);

    return results.map((row: any) => ({
      entry: {
        id: row.id,
        filename: row.filename,
        path: row.path,
        hash: row.hash,
        analysis: {
          description: row.description,
          extractedText: row.extracted_text,
          confidence: row.confidence,
        },
        embedding: row.embedding,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      },
      similarity: row.similarity,
    }));
  }

  public async searchByVector(
    embedding: number[],
    limit: number = 10
  ): Promise<SearchResult[]> {
    const query = `
    SELECT 
      id, filename, path, hash, description, extracted_text, 
      confidence, embedding, created_at, updated_at,
      vec_distance_L2(embedding, ?) as similarity
    FROM images
    ORDER BY similarity ASC
    LIMIT ?
  `;

    try {
      const results = this.db
        .prepare(query)
        .all(JSON.stringify(embedding), limit);

      return results.map((row: any) => ({
        entry: {
          id: row.id,
          filename: row.filename,
          path: row.path,
          hash: row.hash,
          analysis: {
            description: row.description,
            extractedText: row.extracted_text,
            confidence: row.confidence,
          },
          embedding: row.embedding,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        },
        similarity: row.similarity,
      }));
    } catch (error) {
      console.error("Vector search error:", error);
      throw error;
    }
  }
  async deleteByFilename(filename: string): Promise<void> {
    await this.db.prepare('DELETE FROM images WHERE filename = ?').run(filename);
  }
}
