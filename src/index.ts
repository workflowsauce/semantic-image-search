import { config } from "dotenv";
import { createServer } from "./api/server";
config(); // Load environment variables

const appConfig = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  vectorDimensions: 1536, // Claude's embedding dimension
  dbPath: "./data/images.db",
  supportedImageTypes: ["jpg", "jpeg", "png", "webp"],
};
const app = createServer(appConfig);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
