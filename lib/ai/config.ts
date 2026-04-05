/**
 * @file config.ts
 * Central AI configuration — backward-compat shim.
 *
 * All new code should use `getAdapter(AdapterConfig)` from adapters/index.ts directly.
 */

export { getAdapter, getWorkspaceAdapter, resolveModelName, detectProvider } from './adapters/index';
export type { AdapterConfig } from './adapters/index';
