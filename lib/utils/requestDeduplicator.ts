/**
 * @file lib/utils/requestDeduplicator.ts
 * Deduplicates concurrent requests with the same key to reduce API calls.
 * Useful for preventing duplicate LLM calls when the same component is requested multiple times.
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

export class RequestDeduplicator<T> {
  private pending = new Map<string, PendingRequest<T>>();
  private maxAgeMs: number;

  constructor(maxAgeMs: number = 30000) {
    this.maxAgeMs = maxAgeMs;
  }

  async dedupe(key: string, factory: () => Promise<T>): Promise<T> {
    // Clean up old pending requests
    this.cleanup();

    // Check if there's already a pending request for this key
    const existing = this.pending.get(key);
    if (existing) {
      // Return the existing promise (deduplication)
      return existing.promise;
    }

    // Create new request
    const promise = factory().finally(() => {
      // Remove from pending when complete
      this.pending.delete(key);
    });

    this.pending.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.pending.entries()) {
      if (now - entry.timestamp > this.maxAgeMs) {
        this.pending.delete(key);
      }
    }
  }

  clear(): void {
    this.pending.clear();
  }

  size(): number {
    return this.pending.size;
  }
}

// Global deduplicator for component generation
export const generationDeduplicator = new RequestDeduplicator<{
  success: boolean;
  code?: string;
  error?: string;
}>(30000); // 30 second dedup window
