import { config } from "dotenv";
import path from "path";
import fs from "fs/promises";
import { ImageProcessor } from "./services/imageProcessor";
import { SQLiteVectorStore } from "./services/vectorStore";

config(); // Load environment variables

async function processDirectory(dirPath: string) {
  const vectorStore = new SQLiteVectorStore("./data/images.db");
  const imageProcessor = new ImageProcessor(vectorStore);

  console.log(`Processing directory: ${dirPath}`);

  try {
    // Get all files in directory
    const files = await fs.readdir(dirPath);
    const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    const imageFiles = files.filter((file) =>
      supportedExtensions.some((ext) => file.toLowerCase().endsWith(ext))
    );

    console.log(`Found ${imageFiles.length} images to process`);

    let processed = 0;
    let failed = 0;

    for (const file of imageFiles) {
      const fullPath = path.join(dirPath, file);
      try {
        console.log(`Processing ${file}...`);
        const result = await imageProcessor.processImage(fullPath);

        if (result) {
          processed++;
          console.log(`✓ Processed ${file}`);
        } else {
          failed++;
          console.log(`✗ Failed to process ${file}`);
        }
      } catch (error) {
        failed++;
        console.error(`✗ Error processing ${file}:`, error);
      }
    }

    console.log("\nProcessing complete!");
    console.log(`Successfully processed: ${processed}`);
    console.log(`Failed: ${failed}`);
  } catch (error) {
    console.error("Error reading directory:", error);
    process.exit(1);
  }
}

// Get directory path from command line argument
const dirPath = process.argv[2];

if (!dirPath) {
  console.error("Please provide a directory path");
  console.error("Usage: npm run process-images <directory-path>");
  process.exit(1);
}

// Resolve relative paths
const absolutePath = path.resolve(dirPath);

// Check if directory exists
fs.access(absolutePath)
  .then(() => processDirectory(absolutePath))
  .catch((error) => {
    console.error("Directory not accessible:", error);
    process.exit(1);
  });
