import { createHash } from "crypto";
import sharp from "sharp";
import { ImageEntry, ImageAnalysis } from "../types";
import { analyzeImage } from "./imageAnalyzer";
import { createEmbedding } from "../utils/embedding";
import { VectorStore } from "../types";
import Buffer from "buffer";

export class ImageProcessor {
  constructor(
    private vectorStore: VectorStore,
    private readonly supportedFormats = ["jpg", "jpeg", "png", "webp"]
  ) {}

  async processImage(filePath: string): Promise<ImageEntry | null> {
    try {
      // Generate perceptual hash using Sharp
      const imageBuffer = await sharp(filePath).toBuffer();
      // Get image metadata to determine format
      const metadata = await sharp(imageBuffer).metadata();
      if (
        !metadata.format ||
        !this.supportedFormats.includes(metadata.format)
      ) {
        throw new Error(
          `Unsupported or invalid image format: ${metadata.format}`
        );
      }

      const hash = await this.generateImageHash(imageBuffer);

      // Check if image already exists in DB
      const existing = await this.vectorStore.getByHash(hash);
      if (existing) {
        return existing;
      }

      // Analyze image with Claude
      const analysis = await analyzeImage(imageBuffer);

      // Create embedding from analysis
      const embedding = await createEmbedding(
        `${analysis.description} ${analysis.extractedText}`
      );

      console.log("ImageProcessor.createEmbedding", embedding.length);

      const entry: ImageEntry = {
        id: crypto.randomUUID(),
        filename: filePath.split("/").pop() || "",
        path: filePath,
        hash,
        analysis,
        embedding,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in vector DB
      await this.vectorStore.insert(entry);

      return entry;
    } catch (error) {
      console.error(`Error processing image ${filePath}:`, error);
      return null;
    }
  }

  private async generateImageHash(buffer: Buffer): Promise<string> {
    // First, normalize the image
    const normalizedBuffer = await sharp(buffer)
      .resize(32, 32, { fit: "fill" })
      .grayscale()
      .toBuffer();

    // Create perceptual hash
    return createHash("sha256").update(normalizedBuffer).digest("hex");
  }
}
