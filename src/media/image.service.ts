import fs from "fs/promises";
import path from "path";
import type { MessageContentPart } from "../types/model.js";

export interface ImageData {
  data: string;    // base64
  mimeType: string;
  url?: string;
}

/**
 * Supported image MIME types for vision models.
 */
const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export class ImageService {
  /**
   * Load an image from a local file path and return base64 data.
   */
  async loadFromFile(filePath: string): Promise<ImageData> {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = this.extToMimeType(ext);
    return {
      data: buffer.toString("base64"),
      mimeType,
      url: filePath,
    };
  }

  /**
   * Load an image from a URL and return base64 data.
   */
  async loadFromUrl(url: string, headers?: Record<string, string>): Promise<ImageData> {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch image from ${url}: ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      throw new Error(`Unsupported image type: ${mimeType}`);
    }
    const buffer = await res.arrayBuffer();
    return {
      data: Buffer.from(buffer).toString("base64"),
      mimeType,
      url,
    };
  }

  /**
   * Load an image from a Buffer (e.g., from a web upload).
   */
  async loadFromBuffer(buffer: Buffer, mimeType: string): Promise<ImageData> {
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      throw new Error(`Unsupported image type: ${mimeType}`);
    }
    return {
      data: buffer.toString("base64"),
      mimeType,
    };
  }

  /**
   * Convert ImageData to a MessageContentPart for use in ChatMessage.
   */
  toContentPart(image: ImageData): MessageContentPart {
    return {
      type: "image",
      image: {
        data: image.data,
        mimeType: image.mimeType,
        url: image.url,
      },
    };
  }

  private extToMimeType(ext: string): string {
    const map: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    return map[ext] ?? "image/jpeg";
  }
}

export const imageService = new ImageService();
