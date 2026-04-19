# AI Provider Adapters

<cite>
**Referenced Files in This Document**
- [index.ts](file://lib/ai/adapters/index.ts)
- [base.ts](file://lib/ai/adapters/base.ts)
- [openai.ts](file://lib/ai/adapters/openai.ts)
- [anthropic.ts](file://lib/ai/adapters/anthropic.ts)
- [google.ts](file://lib/ai/adapters/google.ts)
- [ollama.ts](file://lib/ai/adapters/ollama.ts)
- [unconfigured.ts](file://lib/ai/adapters/unconfigured.ts)
- [types.ts](file://lib/ai/types.ts)
- [tools.ts](file://lib/ai/tools.ts)
- [cache.ts](file://lib/ai/cache.ts)
- [metrics.ts](file://lib/ai/metrics.ts)
- [resolveDefaultAdapter.ts](file://lib/ai/resolveDefaultAdapter.ts)
- [adapters.test.ts](file://__tests__/adapters.test.ts)
- [adapterIndex.test.ts](file://__tests__/adapterIndex.test.ts)
- [status.route.ts](file://app/api/providers/status/route.ts)
</cite>

## Update Summary
**Changes Made**
- Updated supported providers list from 5 to 4 providers (OpenAI, Anthropic, Google, Groq)
- Removed Ollama adapter from factory pattern implementation and dynamic instantiation
- Updated provider detection logic to exclude Ollama from model-based detection
- Removed Ollama-specific configuration examples and troubleshooting guides
- Updated architecture diagrams and dependency analysis to reflect Ollama removal
- Removed universal LLM_KEY system and provider configuration now requires explicit provider-specific keys only

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the AI provider adapter system that powers provider-agnostic AI integration in the engine. It covers the universal AIAdapter interface, the adapter factory pattern, dynamic adapter instantiation, and provider-specific implementations for OpenAI, Anthropic, Google, and Groq. The system features explicit provider configuration with dedicated API keys for each provider, enhanced provider status reporting, and refined API key management interface that requires explicit provider-specific key configuration.

**Updated** Removed Ollama adapter support, reducing supported providers from 5 to 4. The system now focuses on cloud-based providers with explicit key management requirements.

## Project Structure
The adapter system lives under lib/ai/adapters and is complemented by shared types, tool definitions, caching, metrics, and explicit provider configuration management. Note: Ollama adapter has been removed from the current implementation.

```mermaid
graph TB
subgraph "Adapters"
IDX["index.ts<br/>Factory & Registry"]
BASE["base.ts<br/>AIAdapter interface"]
OA["openai.ts<br/>OpenAIAdapter"]
AA["anthropic.ts<br/>AnthropicAdapter"]
GA["google.ts<br/>GoogleAdapter"]
UC["unconfigured.ts<br/>UnconfiguredAdapter"]
end
subgraph "Shared"
TYPES["types.ts<br/>Client-safe types"]
TOOLS["tools.ts<br/>Tool schema & helpers"]
CACHE["cache.ts<br/>Caching layer"]
METRICS["metrics.ts<br/>Metrics dispatcher"]
end
subgraph "Explicit Provider Configuration"
RDA["resolveDefaultAdapter.ts<br/>Provider-specific key resolution"]
end
subgraph "API Layer"
STATUS["status/route.ts<br/>Provider Status API"]
end
IDX --> OA
IDX --> AA
IDX --> GA
IDX --> UC
OA --- TOOLS
GA --- TOOLS
OA --- TYPES
AA --- TYPES
GA --- TYPES
OA --- CACHE
AA --- CACHE
GA --- CACHE
STATUS --> IDX
UA["UnconfiguredAdapter"] --- TYPES
RDA --> IDX
```

**Diagram sources**
- [index.ts:10-12](file://lib/ai/adapters/index.ts#L10-L12)
- [index.ts:18-21](file://lib/ai/adapters/index.ts#L18-L21)
- [index.ts:145-194](file://lib/ai/adapters/index.ts#L145-L194)
- [index.ts:297-301](file://lib/ai/adapters/index.ts#L297-L301)

**Section sources**
- [index.ts:10-12](file://lib/ai/adapters/index.ts#L10-L12)
- [index.ts:18-21](file://lib/ai/adapters/index.ts#L18-L21)
- [index.ts:145-194](file://lib/ai/adapters/index.ts#L145-L194)

## Core Components
- Universal AIAdapter interface: Defines provider-agnostic generate() and stream() methods, plus a provider identifier. See [AIAdapter:50-72](file://lib/ai/adapters/base.ts#L50-L72).
- Enhanced adapter factory and registry: Resolves credentials securely with explicit provider-specific key requirements, detects provider automatically from model names, and instantiates the appropriate adapter. See [getWorkspaceAdapter:223-297](file://lib/ai/adapters/index.ts#L223-L297) and [createAdapter:147-202](file://lib/ai/adapters/index.ts#L147-L202).
- Explicit provider configuration: Requires dedicated API keys for each provider (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY) with no universal fallback support. See [getWorkspaceAdapter:235-257](file://lib/ai/adapters/index.ts#L235-L257) and [resolveApiKeyForProvider:136-149](file://lib/ai/resolveDefaultAdapter.ts#L136-L149).
- Caching wrapper: Adds deterministic caching for generate() and stream() with cache key generation. See [CachedAdapter:83-139](file://lib/ai/adapters/index.ts#L83-L139) and [generateCacheKey:128-140](file://lib/ai/cache.ts#L128-L140).
- Metrics dispatcher: Centralized logging and persistence of usage and latency. See [dispatchMetrics:36-88](file://lib/ai/metrics.ts#L36-L88).
- Shared types and tools: Client-safe types and unified tool schema for cross-provider compatibility. See [types.ts:1-130](file://lib/ai/types.ts#L1-L130) and [tools.ts:1-175](file://lib/ai/tools.ts#L1-L175).
- Enhanced provider Status API: Comprehensive debugging capabilities with explicit provider configuration awareness and runtime environment variable checking. See [GET:138-233](file://app/api/providers/status/route.ts#L138-L233).

**Section sources**
- [base.ts:48-72](file://lib/ai/adapters/base.ts#L48-L72)
- [index.ts:147-202](file://lib/ai/adapters/index.ts#L147-L202)
- [index.ts:83-139](file://lib/ai/adapters/index.ts#L83-L139)
- [cache.ts:128-140](file://lib/ai/cache.ts#L128-L140)
- [metrics.ts:36-88](file://lib/ai/metrics.ts#L36-L88)
- [types.ts:19-55](file://lib/ai/types.ts#L19-L55)
- [tools.ts:47-79](file://lib/ai/tools.ts#L47-L79)
- [status.route.ts:138-233](file://app/api/providers/status/route.ts#L138-L233)

## Architecture Overview
The system enforces strict server-only credential resolution with explicit provider configuration requirements. The factory resolves keys from workspace storage or environment variables using dedicated provider-specific keys, selects a provider adapter, wraps it in a cache-aware adapter, and returns it to callers.

```mermaid
sequenceDiagram
participant Caller as "Caller"
participant Factory as "getWorkspaceAdapter"
participant WSKey as "workspaceKeyService"
participant Env as "Environment"
participant Creator as "createAdapter"
participant Adapter as "AIAdapter (CachedAdapter)"
participant Metrics as "dispatchMetrics"
Caller->>Factory : "getWorkspaceAdapter(providerId, modelId, workspaceId, userId)"
Factory->>WSKey : "getWorkspaceApiKey(providerId, workspaceId, userId)"
alt "Key found"
WSKey-->>Factory : "workspace key"
Factory->>Creator : "createAdapter({provider, model, apiKey})"
else "No key"
Factory->>Env : "process.env[PROVIDER_API_KEY]"
alt "Env key found"
Env-->>Factory : "env key"
Factory->>Creator : "createAdapter({provider, model, apiKey})"
else "No env key"
Factory->>Creator : "createAdapter({provider : 'unconfigured'})"
end
end
Creator-->>Factory : "AIAdapter (CachedAdapter)"
Factory-->>Caller : "AIAdapter"
Caller->>Adapter : "generate()/stream()"
Adapter->>Adapter : "cache hit?"
Adapter-->>Caller : "GenerateResult/AsyncGenerator"
Adapter->>Metrics : "dispatchMetrics(...)"
```

**Diagram sources**
- [index.ts:223-297](file://lib/ai/adapters/index.ts#L223-L297)
- [index.ts:147-202](file://lib/ai/adapters/index.ts#L147-L202)

**Section sources**
- [index.ts:223-297](file://lib/ai/adapters/index.ts#L223-L297)
- [index.ts:147-202](file://lib/ai/adapters/index.ts#L147-L202)

## Detailed Component Analysis

### Universal AIAdapter Interface
- Purpose: Provide a single contract for all providers to ensure the rest of the application remains provider-agnostic.
- Methods:
  - generate(options): Non-streaming generation returning a complete result.
  - stream(options): Streaming generation via AsyncGenerator yielding StreamChunk objects.
- Properties:
  - provider: Canonical provider name string.

```mermaid
classDiagram
class AIAdapter {
+string provider
+generate(options) GenerateResult
+stream(options) AsyncGenerator~StreamChunk~
}
```

**Diagram sources**
- [base.ts:50-72](file://lib/ai/adapters/base.ts#L50-L72)

**Section sources**
- [base.ts:50-72](file://lib/ai/adapters/base.ts#L50-L72)

### Enhanced Adapter Factory Pattern and Dynamic Instantiation
- Enhanced credential resolution hierarchy:
  1) Workspace key service lookup (encrypted keys per workspace).
  2) **Updated**: Environment variables fallback using dedicated provider-specific keys only.
  3) **Updated**: No universal fallback mechanism - each provider requires its own specific key.
  4) Unconfigured fallback for graceful degradation.
- **Updated**: Explicit provider configuration requirements:
  - Each provider requires its own dedicated environment variable: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY.
  - No automatic provider detection from key formats - keys must match the provider they represent.
  - Provider-specific key resolution: resolveApiKeyForProvider() checks only the specific provider's environment variable.
- Provider detection:
  - Explicit provider overrides model-based detection.
  - Model-based detection supports OpenAI, Anthropic, Google, and Groq-hosted models.
  - **Updated**: Removed Ollama and DeepSeek detection from model-based detection logic.
- OpenAI-compatible providers:
  - Groq is routed through an OpenAI-compatible adapter using base URLs.
- Named adapters:
  - OpenAI, Anthropic, and Google are instantiated directly.

```mermaid
flowchart TD
Start(["getWorkspaceAdapter"]) --> WS["Lookup workspace key"]
WS --> FoundWS{"Key found?"}
FoundWS -- Yes --> Create["createAdapter with workspace key"]
FoundWS -- No --> Env["Check env var"]
Env --> FoundEnv{"Key found?"}
FoundEnv -- Yes --> Create
FoundEnv -- No --> Unconfigured["createAdapter({provider : 'unconfigured'})"]
Create --> Detect["detectProvider(model) if needed"]
Detect --> Compat{"OpenAI-compatible?"}
Compat -- Yes --> OA["OpenAIAdapter(baseUrl)"]
Compat -- No --> Named{"Named provider?"}
Named -- Yes --> OA2["OpenAIAdapter"] --> Wrap["Wrap in CachedAdapter"]
Named -- Yes --> AN["AnthropicAdapter"] --> Wrap
Named -- Yes --> GOO["GoogleAdapter"] --> Wrap
Named -- No --> OL["Fallback Ollama"] --> Wrap
Unconfigured --> UC["UnconfiguredAdapter"] --> End(["Return"])
Wrap --> End
```

**Diagram sources**
- [index.ts:223-297](file://lib/ai/adapters/index.ts#L223-L297)
- [index.ts:147-202](file://lib/ai/adapters/index.ts#L147-L202)

**Section sources**
- [index.ts:223-297](file://lib/ai/adapters/index.ts#L223-L297)
- [index.ts:147-202](file://lib/ai/adapters/index.ts#L147-L202)

### Explicit Provider Configuration System
- **Updated**: No universal LLM_KEY system - each provider requires its own specific key.
- Dedicated provider-specific keys:
  - OpenAI: OPENAI_API_KEY
  - Anthropic: ANTHROPIC_API_KEY
  - Google: GOOGLE_API_KEY or GEMINI_API_KEY
  - Groq: GROQ_API_KEY
- Provider-specific key resolution:
  - resolveApiKeyForProvider() checks only the specific provider's environment variable.
  - No automatic key format detection or universal fallback mechanisms.
- Environment variable fallback hierarchy:
  - Workspace key service lookup (encrypted keys per workspace).
  - Provider-specific environment variables: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY.
  - Google supports both GOOGLE_API_KEY and GEMINI_API_KEY as alternatives.

```mermaid
flowchart TD
ProviderKey["Provider-specific Key"] --> Check{"Key present?"}
Check -- Yes --> Use["Use provider-specific key"]
Check -- No --> Unconfigured["Return UnconfiguredAdapter"]
Use --> Return["Return adapter"]
Unconfigured --> Return
```

**Diagram sources**
- [index.ts:235-257](file://lib/ai/adapters/index.ts#L235-L257)
- [resolveDefaultAdapter.ts:136-149](file://lib/ai/resolveDefaultAdapter.ts#L136-L149)

**Section sources**
- [index.ts:235-257](file://lib/ai/adapters/index.ts#L235-L257)
- [resolveDefaultAdapter.ts:136-149](file://lib/ai/resolveDefaultAdapter.ts#L136-L149)

### OpenAI Adapter
- Supports OpenAI models including reasoning models (o1/o3 series).
- Special handling:
  - Reasoning models: omit temperature, use max_completion_tokens, restrict response_format and tools.
  - HuggingFace router: cap max tokens and avoid certain parameters.
  - System role merging for specific reasoning models.
- Streaming: includes usage in the final chunk when supported.
- Tool support: converts unified tools to OpenAI format and back.

```mermaid
classDiagram
class OpenAIAdapter {
+string provider
-client OpenAI
-effectiveBaseURL string
-isAggregator boolean
-isHuggingFace boolean
+constructor(apiKey?, baseURL?)
+generate(options) GenerateResult
+stream(options) AsyncGenerator~StreamChunk~
}
AIAdapter <|.. OpenAIAdapter
```

**Diagram sources**
- [openai.ts:36-223](file://lib/ai/adapters/openai.ts#L36-L223)
- [base.ts:50-72](file://lib/ai/adapters/base.ts#L50-L72)

**Section sources**
- [openai.ts:30-32](file://lib/ai/adapters/openai.ts#L30-L32)
- [openai.ts:64-157](file://lib/ai/adapters/openai.ts#L64-L157)
- [openai.ts:159-221](file://lib/ai/adapters/openai.ts#L159-L221)

### Anthropic Adapter
- Uses the native Anthropic /v1/messages endpoint via fetch.
- Constraints:
  - No response_format support; JSON mode is emulated by appending instructions to the system prompt.
  - Per-model output caps enforced to prevent 400 errors.
- Streaming: parses SSE-like events and yields deltas until message_stop.

```mermaid
classDiagram
class AnthropicAdapter {
+string provider
-apiKey string
+constructor(apiKey?)
+generate(options) GenerateResult
+stream(options) AsyncGenerator~StreamChunk~
}
AIAdapter <|.. AnthropicAdapter
```

**Diagram sources**
- [anthropic.ts:71-210](file://lib/ai/adapters/anthropic.ts#L71-L210)
- [base.ts:50-72](file://lib/ai/adapters/base.ts#L50-L72)

**Section sources**
- [anthropic.ts:89-145](file://lib/ai/adapters/anthropic.ts#L89-L145)
- [anthropic.ts:147-207](file://lib/ai/adapters/anthropic.ts#L147-L207)

### Google Adapter
- Uses Google AI Studio's OpenAI-compatible endpoint.
- Constraints:
  - response_format is rejected by the proxy; it is omitted.
  - Tool calling is supported via OpenAI-compat format.
- Streaming: straightforward passthrough of streamed chunks.

```mermaid
classDiagram
class GoogleAdapter {
+string provider
-client OpenAI
+constructor(apiKey?)
+generate(options) GenerateResult
+stream(options) AsyncGenerator~StreamChunk~
}
AIAdapter <|.. GoogleAdapter
```

**Diagram sources**
- [google.ts:24-90](file://lib/ai/adapters/google.ts#L24-L90)
- [base.ts:50-72](file://lib/ai/adapters/base.ts#L50-L72)

**Section sources**
- [google.ts:35-69](file://lib/ai/adapters/google.ts#L35-L69)
- [google.ts:71-88](file://lib/ai/adapters/google.ts#L71-L88)

### Unconfigured Adapter
- Graceful fallback when no credentials are available.
- Returns helpful UI code or structured JSON depending on responseFormat.
- Streaming yields React component code line-by-line.

```mermaid
classDiagram
class UnconfiguredAdapter {
+ProviderName provider
+generate(options) GenerateResult
+stream(options) AsyncGenerator~StreamChunk~
}
AIAdapter <|.. UnconfiguredAdapter
```

**Diagram sources**
- [unconfigured.ts:13-99](file://lib/ai/adapters/unconfigured.ts#L13-L99)
- [base.ts:50-72](file://lib/ai/adapters/base.ts#L50-L72)

**Section sources**
- [unconfigured.ts:16-74](file://lib/ai/adapters/unconfigured.ts#L16-L74)
- [unconfigured.ts:76-97](file://lib/ai/adapters/unconfigured.ts#L76-L97)

### Tool Support and Execution
- Unified tool schema: name, description, parameters (JSON Schema subset), and execute function.
- Conversion helpers:
  - OpenAI tool definitions and tool_choice conversion.
  - OpenAI raw tool_call normalization to unified ToolCall.
- Execution helper runs requested tool calls in parallel and returns results formatted for continuation messages.

```mermaid
flowchart TD
TStart(["Model requests tool calls"]) --> Parse["Parse tool calls (Unified)"]
Parse --> Exec["executeToolCalls(calls, tools)"]
Exec --> Results["[{ tool_call_id, name, content }]"]
Results --> Append["Append as role='tool' messages"]
Append --> Next["Resume generation()"]
```

**Diagram sources**
- [tools.ts:47-79](file://lib/ai/tools.ts#L47-L79)
- [tools.ts:144-174](file://lib/ai/tools.ts#L144-L174)
- [openai.ts:103-111](file://lib/ai/adapters/openai.ts#L103-L111)

**Section sources**
- [tools.ts:47-79](file://lib/ai/tools.ts#L47-L79)
- [tools.ts:144-174](file://lib/ai/tools.ts#L144-L174)
- [openai.ts:103-111](file://lib/ai/adapters/openai.ts#L103-L111)

### Streaming Capabilities and Response Formatting
- All adapters implement stream() using AsyncGenerator<StreamChunk>.
- StreamChunk includes delta text and done flag; some providers also supply usage on the final chunk.
- Response format hints are honored when supported by the provider (e.g., OpenAI JSON mode, Anthropic JSON via system prompt).

**Section sources**
- [base.ts:70-72](file://lib/ai/adapters/base.ts#L70-L72)
- [types.ts:48-55](file://lib/ai/types.ts#L48-L55)
- [openai.ts:98-101](file://lib/ai/adapters/openai.ts#L98-L101)
- [anthropic.ts:95-98](file://lib/ai/adapters/anthropic.ts#L95-L98)

### Fallback Mechanisms and Error Handling
- ConfigurationError is thrown when a cloud provider lacks credentials; surfaced to the UI for configuration.
- **Updated**: Ollama support has been completely removed from the factory pattern.
- UnconfiguredAdapter is returned when no credentials are available (including Vercel environments where local daemons are unreachable).
- **Updated**: Enhanced error logging with explicit provider configuration context for debugging.
- Upstash Redis initialization failure falls back to in-memory cache; cache write errors are swallowed to avoid blocking requests.

**Section sources**
- [index.ts:28-40](file://lib/ai/adapters/index.ts#L28-L40)
- [index.ts:194-207](file://lib/ai/adapters/index.ts#L194-L207)
- [index.ts:288-296](file://lib/ai/adapters/index.ts#L288-L296)
- [cache.ts:59-102](file://lib/ai/cache.ts#L59-L102)

### Provider-Specific Optimizations
- OpenAI:
  - Automatic HuggingFace endpoint migration and router detection.
  - Token caps and parameter adjustments for reasoning models and HuggingFace.
- Anthropic:
  - System role merging for specific models and per-model output caps.
- Google:
  - Response format exclusion due to proxy limitations.
- **Updated**: Ollama support has been completely removed from provider-specific optimizations.
- **Updated**: Explicit provider configuration optimization:
  - Dedicated environment variables eliminate universal key detection overhead.
  - Direct provider-specific key access reduces configuration complexity.

**Section sources**
- [openai.ts:46-62](file://lib/ai/adapters/openai.ts#L46-L62)
- [openai.ts:119-126](file://lib/ai/adapters/openai.ts#L119-L126)
- [anthropic.ts:105-108](file://lib/ai/adapters/anthropic.ts#L105-L108)
- [google.ts:46-49](file://lib/ai/adapters/google.ts#L46-L49)

### Enhanced Provider Status API
- **Updated**: Comprehensive debugging capabilities for provider configuration verification with explicit provider configuration awareness.
- **Updated**: Runtime environment variable checking with detailed logging including provider-specific key status.
- **Updated**: No universal key detection - only provider-specific keys are checked for status reporting.
- Debug information includes available environment variables, configuration status, provider detection results, and Node.js environment details.
- Prevents caching to ensure real-time status checks.

```mermaid
flowchart TD
Start(["GET /api/providers/status"]) --> NoStore["unstable_noStore()"]
NoStore --> CheckProviders["Check provider-specific env vars"]
CheckProviders --> StatusLoop["Check each provider"]
StatusLoop --> Primary["Check primary env var"]
Primary --> Alt["Check alternate env var (Google)"]
Alt --> Configured{"Key found?"}
Configured -- Yes --> Mark["Mark as configured"]
Configured -- No --> Skip["Mark as unconfigured"]
Mark --> Next["Next provider"]
Skip --> Next
Next --> Done["Build response"]
Done --> DebugInfo{"Development mode?"}
DebugInfo -- Yes --> AddDebug["Add debug info"]
DebugInfo -- No --> Return["Return providers"]
AddDebug --> Return
```

**Diagram sources**
- [status.route.ts:138-233](file://app/api/providers/status/route.ts#L138-L233)

**Section sources**
- [status.route.ts:138-233](file://app/api/providers/status/route.ts#L138-L233)

### Practical Usage Examples and Configuration Patterns
- Enhanced secure credential resolution:
  - Use getWorkspaceAdapter(providerId, modelId, workspaceId, userId) to resolve keys from workspace storage or provider-specific environment variables.
  - **Updated**: No universal LLM_KEY fallback - each provider requires its own specific key.
  - Example invocation pattern is demonstrated in tests for all adapters.
- Provider selection:
  - Explicit provider via getWorkspaceAdapter or model-based detection via detectProvider.
  - **Updated**: Model-based detection no longer includes Ollama or DeepSeek models.
- **Updated**: Explicit provider configuration:
  - Each provider requires its own dedicated environment variable: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY.
  - No automatic key format detection or universal fallback mechanisms.
  - Key format patterns: standard API key formats for each provider.
- Streaming:
  - Iterate over adapter.stream(options) to render deltas progressively.
- Tool calling:
  - Provide tools in GenerateOptions; handle ToolCall results and append role='tool' messages before continuing generation.
- **Updated**: Enhanced provider status checking:
  - Use GET /api/providers/status to verify configuration and debug environment variables including provider-specific key status.
  - Check console logs for debug information including available env vars, provider detection results, and configuration status.

**Section sources**
- [index.ts:223-297](file://lib/ai/adapters/index.ts#L223-L297)
- [index.ts:55-65](file://lib/ai/adapters/index.ts#L55-L65)
- [adapters.test.ts:57-108](file://__tests__/adapters.test.ts#L57-L108)
- [adapterIndex.test.ts:48-70](file://__tests__/adapterIndex.test.ts#L48-L70)
- [status.route.ts:138-233](file://app/api/providers/status/route.ts#L138-L233)

## Dependency Analysis
The adapter system exhibits low coupling and high cohesion with explicit provider configuration:
- AIAdapter is the central contract; all providers implement it.
- Factory encapsulates provider selection and credential resolution with explicit key requirements.
- **Updated**: resolveDefaultAdapter provides centralized provider-specific key management without universal fallback.
- Caching and metrics are orthogonal concerns wrapped around the adapter.
- Tools and types are shared utilities consumed by adapters.
- **Updated**: Removed dependencies on Ollama, DeepSeek, Mistral, OpenRouter, Together, Meta, Qwen, and Gemma providers.

```mermaid
graph LR
IDX["index.ts"] --> OA["openai.ts"]
IDX --> AA["anthropic.ts"]
IDX --> GA["google.ts"]
IDX --> UC["unconfigured.ts"]
RDA["resolveDefaultAdapter.ts"] --> IDX
OA --> TOOLS["tools.ts"]
GA --> TOOLS
OA --> TYPES["types.ts"]
AA --> TYPES
GA --> TYPES
OA --> CACHE["cache.ts"]
AA --> CACHE
GA --> CACHE
OA --> METRICS["metrics.ts"]
STATUS["status/route.ts"] --> IDX
STATUS --> RDA
```

**Diagram sources**
- [index.ts:18-21](file://lib/ai/adapters/index.ts#L18-L21)
- [index.ts:297-301](file://lib/ai/adapters/index.ts#L297-L301)
- [index.ts:145-194](file://lib/ai/adapters/index.ts#L145-L194)

**Section sources**
- [index.ts:18-21](file://lib/ai/adapters/index.ts#L18-L21)
- [index.ts:297-301](file://lib/ai/adapters/index.ts#L297-L301)
- [index.ts:145-194](file://lib/ai/adapters/index.ts#L145-L194)

## Performance Considerations
- Caching:
  - Deterministic cache keys derived from model, temperature, messages, and tool names.
  - Separate caches for generate vs stream to avoid mixing partial streams.
  - Upstash Redis in production; in-memory fallback in development.
- Metrics:
  - Fire-and-forget dispatch to avoid blocking response paths.
- Provider-specific caps:
  - Prevents upstream 400 errors and wasted compute.
- **Updated**: Provider status API uses unstable_noStore() to prevent caching and ensure real-time configuration verification.
- **Updated**: Explicit provider configuration eliminates universal key detection overhead and reduces memory usage.

## Troubleshooting Guide
- Missing API key:
  - Symptom: ConfigurationError thrown during adapter creation.
  - Action: Configure provider key in workspace settings or environment variables.
  - **Updated**: Ollama support has been completely removed; no longer available as a fallback option.
- **Updated**: Provider-specific key issues:
  - Symptom: Provider not working despite key being set.
  - Action: Verify the key matches the correct provider-specific environment variable (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY).
  - Action: Ensure the key format matches the provider's expected format.
- Local daemon unreachable (Vercel):
  - Behavior: UnconfiguredAdapter returned to show helpful UI.
  - Action: Use cloud providers or run locally with reachable daemons.
- Provider-specific errors:
  - OpenAI: Review reasoning model constraints and HuggingFace router behavior.
  - Anthropic: Respect system role merging and output caps.
  - Google: Do not send response_format; ensure correct endpoint.
  - **Updated**: Ollama is no longer supported; remove any Ollama configuration attempts.
- Streaming issues:
  - Verify provider supports streaming and that usage is only available on the final chunk when supported.
- **Updated**: Enhanced provider status debugging:
  - Use GET /api/providers/status to verify configuration and check environment variables including provider-specific key status.
  - Check console logs for debug information including available env vars, provider detection results, and configuration status.
  - Look for "[providers/status]" logs showing provider-specific key configuration status.

**Section sources**
- [index.ts:28-40](file://lib/ai/adapters/index.ts#L28-L40)
- [index.ts:204-207](file://lib/ai/adapters/index.ts#L204-L207)
- [openai.ts:98-111](file://lib/ai/adapters/openai.ts#L98-L111)
- [anthropic.ts:105-108](file://lib/ai/adapters/anthropic.ts#L105-L108)
- [google.ts:46-49](file://lib/ai/adapters/google.ts#L46-L49)
- [status.route.ts:138-233](file://app/api/providers/status/route.ts#L138-L233)

## Conclusion
The adapter system provides a robust, provider-agnostic foundation for AI integration with explicit provider configuration requirements. By enforcing secure credential resolution with dedicated provider-specific keys, offering a unified interface, and encapsulating provider-specific quirks, it simplifies multi-provider orchestration while maintaining performance and reliability through caching and metrics. The recent updates streamline supported providers from 5 to 4 (OpenAI, Anthropic, Google, Groq), enhance Ollama integration removal, provide comprehensive debugging capabilities for configuration management, and introduce explicit provider configuration requirements that eliminate universal key management complexity.

## Appendices

### Supported Providers and Authentication
- **Updated**: Currently supported providers: OpenAI, Anthropic, Google, and Groq.
- **Removed**: Ollama, DeepSeek, Mistral, OpenRouter, Together, Meta, Qwen, and Gemma providers.
- **Updated**: Explicit provider configuration requirements with dedicated API keys for each provider.
- Authentication requirements:
  - OpenAI: OPENAI_API_KEY
  - Anthropic: ANTHROPIC_API_KEY
  - Google: GOOGLE_API_KEY or GEMINI_API_KEY
  - Groq: GROQ_API_KEY

**Section sources**
- [index.ts:10-12](file://lib/ai/adapters/index.ts#L10-L12)
- [index.ts:167-191](file://lib/ai/adapters/index.ts#L167-L191)
- [openai.ts:53-61](file://lib/ai/adapters/openai.ts#L53-L61)
- [status.route.ts:146-157](file://app/api/providers/status/route.ts#L146-L157)

### Provider Capability Matrix
- Tool calling: OpenAI, Google (provider-dependent).
- Streaming: All adapters.
- Response format: OpenAI JSON mode (with restrictions), Anthropic via system prompt, Google excludes response_format.

**Section sources**
- [openai.ts:98-111](file://lib/ai/adapters/openai.ts#L98-L111)
- [anthropic.ts:95-98](file://lib/ai/adapters/anthropic.ts#L95-L98)
- [google.ts:46-49](file://lib/ai/adapters/google.ts#L46-L49)

### Provider Detection Logic
- **Updated**: Model-based detection no longer includes Ollama or DeepSeek models.
- **Updated**: No universal key detection - relies solely on explicit provider configuration.
- Detection rules:
  - gpt-*, o1 series → OpenAI
  - claude series → Anthropic
  - gemini series → Google
  - llama, mixtral, gemma2 → Groq
  - Default → OpenAI

**Section sources**
- [index.ts:55-65](file://lib/ai/adapters/index.ts#L55-L65)