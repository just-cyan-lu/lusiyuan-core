import fs from "fs/promises";
import path from "path";
import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from "undici";
import type { MessageContentPart } from "../types/model.js";

export interface ImageData {
  data: string;    // base64
  mimeType: string;
  url?: string;
}

export interface LoadImageFromUrlOptions {
  headers?: Record<string, string>;
  proxyUrl?: string;
  timeoutMs?: number;
  retries?: number;
  fallbackMimeType?: string;
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

const proxyDispatchers = new Map<string, Dispatcher>();

function getProxyDispatcher(proxyUrl: string): Dispatcher {
  let dispatcher = proxyDispatchers.get(proxyUrl);
  if (!dispatcher) {
    dispatcher = new ProxyAgent(proxyUrl);
    proxyDispatchers.set(proxyUrl, dispatcher);
  }
  return dispatcher;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeMimeType(mimeType?: string): string | undefined {
  const normalized = mimeType?.split(";")[0].trim().toLowerCase();
  return normalized && SUPPORTED_MIME_TYPES.has(normalized) ? normalized : undefined;
}

export class ImageService {
  /**
   * Load an image from a local file path and return base64 data.
   */
  async loadFromFile(filePath: string): Promise<ImageData> {
    const buffer = await fs.readFile(filePath);
    const mimeType = this.inferMimeTypeFromPath(filePath) ?? "image/jpeg";
    return {
      data: buffer.toString("base64"),
      mimeType,
      url: filePath,
    };
  }

  /**
   * Load an image from a URL and return base64 data.
   */
  async loadFromUrl(url: string, options: LoadImageFromUrlOptions = {}): Promise<ImageData> {
    const timeoutMs = options.timeoutMs ?? 30000;
    const retries = options.retries ?? 0;
    const dispatcher = options.proxyUrl ? getProxyDispatcher(options.proxyUrl) : undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await undiciFetch(url, {
          headers: options.headers,
          dispatcher,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          if (res.status >= 500 && attempt < retries) {
            lastError = new Error(`HTTP ${res.status}`);
            await sleep(250 * (attempt + 1));
            continue;
          }
          throw new Error(`Failed to fetch image: HTTP ${res.status}`);
        }

        const contentType = res.headers.get("content-type") ?? "";
        const mimeType =
          normalizeMimeType(contentType) ??
          normalizeMimeType(options.fallbackMimeType) ??
          this.inferMimeTypeFromPath(url) ??
          "image/jpeg";
        if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
          throw new Error(`Unsupported image type: ${mimeType}`);
        }
        const buffer = await res.arrayBuffer();
        return {
          data: Buffer.from(buffer).toString("base64"),
          mimeType,
          url,
        };
      } catch (err) {
        lastError = err;
        if (attempt >= retries) break;
        await sleep(250 * (attempt + 1));
      }
    }

    throw new Error(`Failed to fetch image after ${retries + 1} attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`);
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

  inferMimeTypeFromPath(filePathOrUrl: string): string | undefined {
    let pathname = filePathOrUrl;
    try {
      pathname = new URL(filePathOrUrl).pathname;
    } catch {
      // Local paths are fine; path.extname can handle them directly.
    }

    const ext = path.extname(pathname).toLowerCase();
    const map: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    return map[ext];
  }
}

export const imageService = new ImageService();
