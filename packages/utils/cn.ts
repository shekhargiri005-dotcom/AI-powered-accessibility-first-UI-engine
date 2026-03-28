import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges Tailwind classes intelligently, resolving conflicts (e.g., px-2 and p-4).
 * Uses clsx for conditional class merging.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
