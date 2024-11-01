import express from "express";
import multer from "multer";
import path from "path";
import { ImageProcessor } from "../services/imageProcessor";
import { SQLiteVectorStore } from "../services/vectorStore";
import { Config } from "../types";
import fs from "fs/promises";

const DEFAULT_SERARCH_LIMIT = 30;

export function createServer(config: Config) {
  const app = express();
  const upload = multer({ dest: "uploads/" });
  const vectorStore = new SQLiteVectorStore(config.dbPath);
  const imageProcessor = new ImageProcessor(vectorStore);
  // Serve static files from public directory
  app.use(express.static("public"));

  app.post(
    "/api/upload",
    upload.array("images"),
    async (req: express.Request, res: express.Response): Promise<any> => {
      try {
        if (!req.files || !Array.isArray(req.files)) {
          return res.status(400).json({ error: "No files uploaded" });
        }

        const results = await Promise.all(
          req.files.map((file) => imageProcessor.processImage(file.path))
        );

        const successfulResults = results.filter(
          (r): r is NonNullable<typeof r> => r !== null
        );

        return res.json({
          processed: successfulResults.length,
          total: req.files.length,
          entries: successfulResults,
        });
      } catch (error) {
        console.error("Upload error:", error);
        return res.status(500).json({ error: "Upload processing failed" });
      }
    }
  );

  app.post(
    "/api/search/image",
    upload.single("image"),
    async (req: express.Request, res: express.Response): Promise<any> => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No image uploaded" });
        }

        // Rename the uploaded file to preserve original filename
        const originalPath = req.file.path;
        const newPath = path.join(
          path.dirname(originalPath),
          req.file.originalname
        );
        await fs.rename(originalPath, newPath);

        // Process the image to get its embedding
        const result = await imageProcessor.processImage(newPath);

        if (!result) {
          return res.status(400).json({ error: "Failed to process image" });
        }

        // If the result path is different from our uploaded path, it means
        // this is a duplicate image, so we should delete our uploaded copy
        if (result.path !== newPath) {
          await fs.unlink(newPath).catch(console.error);
        }

        // Use the embedding to search for similar images
        const results = await vectorStore.searchByVector(
          result.embedding,
          DEFAULT_SERARCH_LIMIT
        );

        // Clean up the uploaded file since we don't need to store it
        // await fs.unlink(req.file.path).catch(console.error);

        res.json(results);
      } catch (error) {
        console.error("Image search error:", error);
        res.status(500).json({ error: "Image search failed" });
      }
    }
  );

  app.get("/images/:filename", async (req, res): Promise<any> => {
    const filename = req.params.filename;
    // Assuming images are stored in an 'uploads' directory
    // First try uploads directory
    const uploadPath = path.join(process.cwd(), "uploads", filename);

    // Check if file exists in uploads
    try {
      await fs.access(uploadPath);
      return res.sendFile(uploadPath);
    } catch {
      // If not in uploads, try to find in DB
      const entry = await vectorStore.getByFilename(filename);
      if (entry) {
        try {
          await fs.access(entry.path);
          return res.sendFile(entry.path);
        } catch {
          return res.status(404).json({ error: "Image file not found" });
        }
      }
      return res.status(404).json({ error: "Image not found" });
    }
  });

  // Search endpoint
  app.get(
    "/api/search",
    async (req: express.Request, res: express.Response): Promise<any> => {
      try {
        const { query, limit } = req.query;
        if (!query || typeof query !== "string") {
          return res.status(400).json({ error: "Query parameter required" });
        }
        const results = await vectorStore.search(
          query,
          limit ? parseInt(limit as string) : DEFAULT_SERARCH_LIMIT
        );
        res.json(results.map(r => ({...r, entry: { ...r.entry, embedding: undefined }})));
      } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ error: "Search failed" });
      }
    }
  );
  // Process directory endpoint
  app.post(
    "/api/process-directory",
    async (req: express.Request, res: express.Response): Promise<any> => {
      try {
        const { directory } = req.body;
        if (!directory) {
          return res.status(400).json({ error: "Directory path required" });
        }
        // Process all images in directory
        const results: any = [];
        // ... implement directory processing ...
        res.json(results);
      } catch (error) {
        console.error("Processing error:", error);
        res.status(500).json({ error: "Processing failed" });
      }
    }
  );

  app.delete("/api/images/:filename", async (req, res): Promise<any> => {
    const filename = req.params.filename;
    
    try {
      // First try to get the image entry from the database
      const entry = await vectorStore.getByFilename(filename);
      
      if (!entry) {
        return res.status(404).json({ error: "Image not found" });
      }

      // Delete the actual file
      try {
        await fs.unlink(entry.path);
      } catch (error) {
        console.error("Error deleting file:", error);
        // Continue even if file deletion fails - the file might not exist
      }

      // Remove the entry from the vector store
      await vectorStore.deleteByFilename(filename);

      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });
  return app;
}
