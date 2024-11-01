import { ImageAnalysis } from "../types";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

export async function analyzeImage(
  imageBuffer: Buffer
): Promise<ImageAnalysis> {
  try {
    // First try with Haiku
    return await attemptAnalysis(imageBuffer, "claude-3-haiku-20240307");
  } catch (error: any) {
    console.log(error);
    // If it's a JSON parsing error, retry with Haiku
    if (error instanceof SyntaxError && !error.message.includes("I apologize")) {
      console.log("JSON parsing error with Haiku, retrying...");
      return await attemptAnalysis(imageBuffer, "claude-3-haiku-20240307");
    }

    // If it's a content filtering error, retry with Sonnet
    if (
      error?.error?.error?.type === "invalid_request_error" &&
      error?.error?.error?.message ===
        "Output blocked by content filtering policy"
    ) {
      console.log(
        "Content filtering triggered with Haiku, retrying with Sonnet..."
      );
      return await attemptAnalysis(imageBuffer, "claude-3-sonnet-20240229");
    }

    // If it's any other error, rethrow it
    throw error;
  }
}

async function attemptAnalysis(imageBuffer: Buffer, model: string) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  const base64Image = imageBuffer.toString("base64");

  // Detect image format
  const metadata = await sharp(imageBuffer).metadata();
  const mediaType = `image/${metadata.format}`;

  const message = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
              Please analyze this image and provide:
              1) A detailed description of what you see
              2) Any text that appears in the image.
              
              Format your response as JSON with "description" and "extractedText" fields.
            `,
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as any,
              data: base64Image,
            },
          },
        ],
      },
    ],
  });

  if ("text" in message.content[0]) {
    console.log(message.content[0].text);
    const response = JSON.parse(message.content[0].text);
    return {
      description: response.description,
      extractedText: response.extractedText,
      confidence: 1.0,
    };
  }
  throw new Error("Unexpected response format from Claude");
}
