# AI Provider Adapters

<cite>
**Referenced Files in This Document**
- [base.ts](file://lib/ai/adapters/base.ts)
- [openai.ts](file://lib/ai/adapters/openai.ts)
- [anthropic.ts](file://lib/ai/adapters/anthropic.ts)
- [google.ts](file://lib/ai/adapters/google.ts)
- [ollama.ts](file://lib/ai/adapters/ollama.ts)
- [index.ts](file://lib/ai/adapters/index.ts)
- [types.ts](file://lib/ai/types.ts)
- [tools.ts](file://lib/ai/tools.ts)
- [unconfigured.ts](file://lib/ai/adapters/unconfigured.ts)
- [workspaceKeyService.ts](file://lib/security/workspaceKeyService.ts)
- [encryption.ts](file://lib/security/encryption.ts)
- [ModelSelectionGate.tsx](file://components/ModelSelectionGate.tsx)
- [ProviderSelector.tsx](file://components/ProviderSelector.tsx)
- [WorkspaceSettingsPanel.tsx](file://components/WorkspaceSettingsPanel.tsx)
- [AIEngineConfigPanel.tsx](file://components/AIEngineConfigPanel.tsx)
- [route.ts](file://app/api/engine-config/route.ts)
- [route.ts](file://app/api/providers/status/route.ts)
- [route.ts](file://app/api/models/route.ts)
- [route.ts](file://app/api/local-models/route.ts)
- [route.ts](file://app/api/ollama/models/route.ts)
- [modelRegistry.ts](file://lib/ai/modelRegistry.ts)
</cite>

## Update Summary
**Changes Made**
- Removed isLocal property from ProviderInfo and ProviderConfig interfaces
- Removed Ollama-specific local execution logic and runtime detection
- Unified treatment of all providers (OpenAI, Anthropic, Google, Groq, Ollama) without special handling
- Removed specialized local model support infrastructure
- Simplified adapter factory to treat all providers uniformly

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Enhanced Credential Management System](#enhanced-credential-management-system)
7. [Dependency Analysis](#dependency-analysis)
8. [Performance Considerations](#performance-considerations)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Conclusion](#conclusion)
11. [Appendices](#appendices)

## Introduction
This document explains the universal AI adapter system that provides model-agnostic access to multiple AI providers. It covers the adapter factory pattern, the base adapter interface, and provider-specific implementations for OpenAI, Anthropic, Google, Groq, and Ollama. The system now features a simplified architecture where all providers are treated uniformly without special handling for local providers, removing the previous distinction between cloud and local inference capabilities.

**Updated** The system has been streamlined to treat all providers equally, eliminating the previous isLocal property and Ollama-specific local execution logic. The adapter factory now provides uniform treatment of all five supported providers: OpenAI, Anthropic, Google, Groq, and Ollama, with simplified credential management and configuration workflows.

## Project Structure
The AI adapter system is organized under lib/ai/adapters with a central factory and per-provider adapters. The simplified architecture maintains the same core components but removes local model-specific infrastructure. Enhanced UI components provide guided configuration experiences with automatic provider detection and secure credential management.

```mermaid
graph TB
subgraph "Adapters"
BASE["base.ts<br/>AIAdapter interface"]
OA["openai.ts<br/>OpenAIAdapter"]
AA["anthropic.ts<br/>AnthropicAdapter"]
GA["google.ts<br/>GoogleAdapter"]
OLA["ollama.ts<br/>OllamaAdapter"]
IDX["index.ts<br/>Factory + Registry"]
UNC["unconfigured.ts<br/>UnconfiguredAdapter"]
END
subgraph "Enhanced UI Components"
MSG["ModelSelectionGate.tsx<br/>Provider configuration"]
PS["ProviderSelector.tsx<br/>Provider + model selection"]
WSP["WorkspaceSettingsPanel.tsx<br/>Provider configuration"]
AIE["AIEngineConfigPanel.tsx<br/>Advanced settings"]
END
subgraph "Security & Encryption"
WKS["workspaceKeyService.ts<br/>DB + Encryption + Caching + Global Fallback"]
ENC["encryption.ts<br/>AES-256-GCM encryption + Fallback"]
API["engine-config/route.ts<br/>Secure credential API"]
PSTATUS["providers/status/route.ts<br/>Provider status + automatic detection"]
END
subgraph "Shared"
TYPES["types.ts<br/>Message/Options/Results"]
TOOLS["tools.ts<br/>Tool/ToolCall/Exec"]
END
IDX --> OA
IDX --> AA
IDX --> GA
IDX --> OLA
IDX --> UNC
MSG --> PS
MSG --> WSP
PS --> WSP
AIE --> IDX
OA --> TYPES
AA --> TYPES
GA --> TYPES
OLA --> TYPES
OA --> TOOLS
GA --> TOOLS
OLA --> TOOLS
IDX --> WKS
WKS --> ENC
API --> ENC
PSTATUS --> ENC
```

**Diagram sources**
- [index.ts:1-301](file://lib/ai/adapters/index.ts#L1-L301)
- [base.ts:1-73](file://lib/ai/adapters/base.ts#L1-L73)
- [openai.ts:1-223](file://lib/ai/adapters/openai.ts#L1-L223)
- [anthropic.ts:1-210](file://lib/ai/adapters/anthropic.ts#L1-L210)
- [google.ts:1-90](file://lib/ai/adapters/google.ts#L1-L90)
- [ollama.ts:1-87](file://lib/ai/adapters/ollama.ts#L1-L87)
- [types.ts:1-130](file://lib/ai/types.ts#L1-L130)
- [tools.ts:1-175](file://lib/ai/tools.ts#L1-L175)
- [unconfigured.ts:1-99](file://lib/ai/adapters/unconfigured.ts#L1-L99)
- [workspaceKeyService.ts:1-138](file://lib/security/workspaceKeyService.ts#L1-L138)
- [encryption.ts:1-95](file://lib/security/encryption.ts#L1-L95)
- [ModelSelectionGate.tsx:1-414](file://components/ModelSelectionGate.tsx#L1-L414)
- [ProviderSelector.tsx:1-375](file://components/ProviderSelector.tsx#L1-L375)
- [WorkspaceSettingsPanel.tsx:1-436](file://components/WorkspaceSettingsPanel.tsx#L1-L436)
- [AIEngineConfigPanel.tsx:1-120](file://components/AIEngineConfigPanel.tsx#L1-L120)
- [route.ts:1-154](file://app/api/engine-config/route.ts#L1-L154)
- [route.ts:1-204](file://app/api/providers/status/route.ts#L1-L204)
- [route.ts:1-271](file://app/api/models/route.ts#L1-L271)

**Section sources**
- [index.ts:1-301](file://lib/ai/adapters/index.ts#L1-L301)
- [types.ts:1-130](file://lib/ai/types.ts#L1-L130)
- [tools.ts:1-175](file://lib/ai/tools.ts#L1-L175)
- [workspaceKeyService.ts:1-138](file://lib/security/workspaceKeyService.ts#L1-L138)
- [encryption.ts:1-95](file://lib/security/encryption.ts#L1-L95)
- [ModelSelectionGate.tsx:1-414](file://components/ModelSelectionGate.tsx#L1-L414)
- [ProviderSelector.tsx:1-375](file://components/ProviderSelector.tsx#L1-L375)
- [WorkspaceSettingsPanel.tsx:1-436](file://components/WorkspaceSettingsPanel.tsx#L1-L436)
- [AIEngineConfigPanel.tsx:1-120](file://components/AIEngineConfigPanel.tsx#L1-L120)
- [route.ts:1-154](file://app/api/engine-config/route.ts#L1-L154)
- [route.ts:1-204](file://app/api/providers/status/route.ts#L1-L204)

## Core Components
- AIAdapter interface: Defines the provider-agnostic contract with generate() and stream().
- Provider adapters: Implementations for OpenAI, Anthropic, Google, Groq (OpenAI-compatible), and Ollama (treated uniformly).
- Factory and registry: Centralized creation logic with workspace-aware resolution, fallbacks, and uniform provider treatment.
- Enhanced UI components: ModelSelectionGate provides comprehensive configuration flow with automatic provider detection; ProviderSelector offers intuitive provider and model selection with detailed provider definitions.
- Comprehensive security system: Server-side credential management with AES-256-GCM encryption, workspace-scoped keys, caching, and global fallback capabilities.
- Shared types: Client-safe message, generation options/results, streaming chunks, and pricing utilities.
- Tools: Canonical tool schema and conversion helpers for provider-specific tool-calling formats.
- Unconfigured adapter: Graceful fallback when no credentials are available.

**Section sources**
- [base.ts:48-72](file://lib/ai/adapters/base.ts#L48-L72)
- [types.ts:19-55](file://lib/ai/types.ts#L19-L55)
- [tools.ts:47-79](file://lib/ai/tools.ts#L47-L79)
- [index.ts:146-215](file://lib/ai/adapters/index.ts#L146-L215)
- [unconfigured.ts:13-99](file://lib/ai/adapters/unconfigured.ts#L13-L99)

## Architecture Overview
The system enforces strict server-only credential resolution with comprehensive security and automatic provider detection. The factory resolves credentials from workspace settings, environment variables, or returns an unconfigured adapter. Each adapter normalizes provider-specific differences into a unified interface. Enhanced UI components provide guided configuration with ModelSelectionGate and ProviderSelector, featuring automatic provider detection based on environment variables. All providers are now treated uniformly without special handling for local providers.

```mermaid
sequenceDiagram
participant UI as "UI Component"
participant MSG as "ModelSelectionGate"
participant PSTATUS as "providers/status API"
participant API as "engine-config API"
participant SEC as "workspaceKeyService.ts"
participant ENC as "encryption.ts"
participant ADP as "AIAdapter (factory-created)"
participant PRV as "Provider API"
UI->>MSG : "Open configuration flow"
MSG->>PSTATUS : "GET /api/providers/status"
PSTATUS->>PSTATUS : "Check env vars for configured providers"
PSTATUS-->>MSG : "Filtered provider list (all providers treated equally)"
MSG->>API : "POST /api/engine-config (encrypted key)"
API->>ENC : "encrypt(key)"
ENC-->>API : "AES-256-GCM encrypted"
API->>SEC : "store in DB + invalidate cache"
SEC-->>API : "cache updated"
API-->>MSG : "success response"
MSG->>API : "GET /api/engine-config"
API->>SEC : "getWorkspaceApiKey()"
SEC-->>API : "decrypted key or null"
API-->>MSG : "config with hasKey flag"
MSG->>ADP : "createAdapter with resolved credentials"
ADP->>PRV : "generate/stream (uniform treatment)"
PRV-->>ADP : "normalized result"
ADP-->>API : "GenerateResult/AsyncIterable"
API-->>UI : "Response"
```

**Diagram sources**
- [ModelSelectionGate.tsx:70-102](file://components/ModelSelectionGate.tsx#L70-L102)
- [route.ts:69-127](file://app/api/engine-config/route.ts#L69-L127)
- [route.ts:88-164](file://app/api/providers/status/route.ts#L88-L164)
- [workspaceKeyService.ts:32-95](file://lib/security/workspaceKeyService.ts#L32-L95)
- [encryption.ts:27-69](file://lib/security/encryption.ts#L27-L69)
- [index.ts:236-278](file://lib/ai/adapters/index.ts#L236-L278)
- [ollama.ts:21-30](file://lib/ai/adapters/ollama.ts#L21-L30)

## Detailed Component Analysis

### Base Adapter Interface
Defines the canonical contract that all adapters implement:
- provider: Canonical provider name.
- generate(options): Non-streaming generation returning content, optional toolCalls, and usage.
- stream(options): Async generator yielding StreamChunk with delta text and done flag; usage may be included on the final chunk.

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
- [base.ts:28-72](file://lib/ai/adapters/base.ts#L28-L72)

### OpenAI Adapter
Implements the OpenAI-compatible interface with special handling for reasoning models (o1/o3 series), tool-calling, response_format, and streaming. It auto-detects aggregator and Hugging Face routes and applies provider-specific constraints.

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
- [openai.ts:23-32](file://lib/ai/adapters/openai.ts#L23-L32)
- [openai.ts:64-157](file://lib/ai/adapters/openai.ts#L64-L157)
- [openai.ts:159-222](file://lib/ai/adapters/openai.ts#L159-L222)

### Anthropic Adapter
Uses the native Anthropic Messages API via fetch(), handling system prompts, JSON mode instructions, token caps, and streaming events.

```mermaid
classDiagram
class AnthropicAdapter {
+string provider
-apiKey string
+constructor(apiKey?)
-getKey() string
+generate(options) GenerateResult
+stream(options) AsyncGenerator~StreamChunk~
}
AIAdapter <|.. AnthropicAdapter
```

**Diagram sources**
- [anthropic.ts:71-210](file://lib/ai/adapters/anthropic.ts#L71-L210)
- [base.ts:50-72](file://lib/ai/adapters/base.ts#L50-L72)

**Section sources**
- [anthropic.ts:71-145](file://lib/ai/adapters/anthropic.ts#L71-L145)
- [anthropic.ts:147-207](file://lib/ai/adapters/anthropic.ts#L147-L207)

### Google Adapter
Wraps Google AI Studio's OpenAI-compatible endpoint, forwarding tools and streaming support.

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
- [google.ts:28-69](file://lib/ai/adapters/google.ts#L28-L69)
- [google.ts:71-88](file://lib/ai/adapters/google.ts#L71-L88)

### Ollama Adapter
Implements local inference support through Ollama's OpenAI-compatible API endpoint. Provides seamless integration with local models including tool-calling support for compatible models.

**Updated** The Ollama adapter now operates as a standard OpenAI-compatible adapter without special local execution logic or runtime detection. It treats Ollama uniformly with other providers.

```mermaid
classDiagram
class OllamaAdapter {
+string provider
-client OpenAI
-baseURL string
+constructor(baseURL?)
+generate(options) GenerateResult
+stream(options) AsyncGenerator~StreamChunk~
}
AIAdapter <|.. OllamaAdapter
```

**Diagram sources**
- [ollama.ts:21-87](file://lib/ai/adapters/ollama.ts#L21-L87)
- [base.ts:50-72](file://lib/ai/adapters/base.ts#L50-L72)

**Section sources**
- [ollama.ts:1-87](file://lib/ai/adapters/ollama.ts#L1-L87)

### Adapter Factory and Registry
Central factory with:
- detectProvider(model): Heuristic to infer provider from model name.
- createAdapter(cfg): Builds the appropriate adapter, validates credentials, and wraps with CachedAdapter for metrics and caching.
- getWorkspaceAdapter(providerId, modelId, workspaceId, userId?): Secure resolution via workspaceKeyService, env vars, or returns UnconfiguredAdapter.
- CachedAdapter: Adds caching and metrics for generate() and stream().

**Updated** The factory now treats all providers uniformly without special handling for local providers. The isLocal property has been removed from all provider configurations, and Ollama is treated like any other provider.

```mermaid
flowchart TD
A["getWorkspaceAdapter(providerId, modelId, workspaceId, userId?)"] --> B["workspaceKeyService.getWorkspaceApiKey(...)"]
B --> |found| C["createAdapter({provider, model, apiKey})"]
B --> |not found| D["process.env[PROVIDER_ID_API_KEY]"]
D --> |found| C
D --> |not found| E["process.env.LLM_KEY (universal fallback)"]
E --> |found| C
E --> |not | F["process.env.OLLAMA_API_KEY (fallback)"]
F --> |found| G["new OllamaAdapter(OLLAMA_BASE_URL)"]
F --> |not found| H["return UnconfiguredAdapter"]
C --> I{"provId in ['openai','anthropic','google','ollama']?"}
I --> |yes| J["new NamedAdapter(...)"]
I --> |no| K["OpenAIAdapter(key, compatUrl)"]
J --> L["CachedAdapter(...)"]
K --> L
G --> L
```

**Diagram sources**
- [index.ts:236-278](file://lib/ai/adapters/index.ts#L236-L278)
- [index.ts:146-215](file://lib/ai/adapters/index.ts#L146-L215)
- [index.ts:248-273](file://lib/ai/adapters/index.ts#L248-273)

**Section sources**
- [index.ts:50-64](file://lib/ai/adapters/index.ts#L50-L64)
- [index.ts:146-215](file://lib/ai/adapters/index.ts#L146-L215)
- [index.ts:236-278](file://lib/ai/adapters/index.ts#L236-L278)

### Unconfigured Adapter
Returns a friendly UI component or JSON payload when no credentials are available, preventing server errors and guiding users to configure settings.

**Section sources**
- [unconfigured.ts:13-99](file://lib/ai/adapters/unconfigured.ts#L13-L99)

### Tools and Tool Calls
A canonical schema for tools and conversions ensures consistent tool-calling across providers:
- Tool: name, description, parameters (JSON Schema subset), execute(args).
- ToolCall: id, name, parsed arguments.
- Conversion helpers: OpenAI tool definitions and choices, and OpenAI tool-call normalization.

```mermaid
classDiagram
class Tool {
+string name
+string description
+ToolParameterSchema parameters
+(args) Promise~unknown~
}
class ToolCall {
+string id
+string name
+Record~string,unknown~ arguments
}
class Tools {
+toOpenAIToolDefinition(tool)
+toOpenAIToolChoice(choice)
+fromOpenAIToolCall(raw)
+executeToolCalls(calls, tools) Promise~...~
}
Tool <.. Tools
ToolCall <.. Tools
```

**Diagram sources**
- [tools.ts:47-79](file://lib/ai/tools.ts#L47-L79)
- [tools.ts:108-133](file://lib/ai/tools.ts#L108-L133)
- [tools.ts:144-174](file://lib/ai/tools.ts#L144-L174)

**Section sources**
- [tools.ts:13-28](file://lib/ai/tools.ts#L13-L28)
- [tools.ts:47-79](file://lib/ai/tools.ts#L47-L79)
- [tools.ts:108-133](file://lib/ai/tools.ts#L108-L133)
- [tools.ts:144-174](file://lib/ai/tools.ts#L144-L174)

### Types and Pricing
Client-safe types define messages, generation options/results, and streaming chunks. Pricing utilities estimate costs per provider/model.

**Updated** Pricing information has been updated to reflect the simplified provider structure with uniform treatment of all providers including Ollama.

**Section sources**
- [types.ts:10-55](file://lib/ai/types.ts#L10-L55)
- [types.ts:71-130](file://lib/ai/types.ts#L71-L130)

## Enhanced Credential Management System

### ModelSelectionGate Component
The ModelSelectionGate provides a comprehensive configuration experience with automatic provider detection and server-side credential management:

**Enhanced Provider Selection Experience**
- Features a sophisticated multi-provider interface supporting all providers uniformly
- Enhanced visual design with gradient backgrounds and provider-specific theming
- Interactive provider cards with security badges and recommended provider highlighting
- **Updated** Now includes Ollama provider with standard configuration approach
- **Updated** Enhanced visual design featuring provider brand color integration

**Automatic Provider Detection**
- Fetches configured providers from `/api/providers/status` which checks environment variables
- Shows only providers with API keys configured in Vercel environment variables
- **Updated** All providers treated uniformly without special local handling
- Interactive provider cards with security badges and recommended provider highlighting

**Comprehensive Provider Options**
- **All Providers**: OpenAI, Anthropic, Google, Groq, Ollama with automatic key detection
- **Enhanced Visual Design**: Provider cards with brand-specific color schemes and visual indicators
- **Recommended provider highlighting**: Prominent badges for optimal provider selection
- **Model suggestions**: Provider-specific branding with context window information

**Streamlined Configuration Flow**
- Direct provider selection without intermediate steps
- One-click model confirmation with security review
- **Updated** Standard configuration for all providers including Ollama
- Start generating button with loading states and gradient styling

```mermaid
stateDiagram-v2
[*] --> ProviderDetection
ProviderDetection --> ProviderSelection : Load detected providers
ProviderSelection --> Confirm : Provider selected
Confirm --> [*] : Start generating
```

**Diagram sources**
- [ModelSelectionGate.tsx:69-102](file://components/ModelSelectionGate.tsx#L69-L102)
- [ModelSelectionGate.tsx:110-146](file://components/ModelSelectionGate.tsx#L110-L146)
- [ModelSelectionGate.tsx:300-405](file://components/ModelSelectionGate.tsx#L300-L405)

**Section sources**
- [ModelSelectionGate.tsx:1-414](file://components/ModelSelectionGate.tsx#L1-L414)

### ProviderSelector Component
The ProviderSelector offers intuitive provider and model selection with comprehensive provider definitions and automatic credential validation:

**Enhanced Provider Options with Uniform Treatment**
- **All Providers**: OpenAI, Anthropic, Google, Groq, Ollama with automatic key detection
- **Enhanced Visual Design**: Provider cards with brand-specific color schemes and visual indicators
- **Recommended provider highlighting**: Prominent badges for optimal provider selection
- **Feature lists**: Context window information and model suggestions for each provider

**Security and Validation Features**
- Security badges for each provider with credential status indicators
- **Updated** Standard configuration approach for all providers
- **Enhanced** Provider-specific configuration with environment variable fallbacks
- Workspace-scoped credential status with automatic validation

**Section sources**
- [ProviderSelector.tsx:1-375](file://components/ProviderSelector.tsx#L1-L375)

### Provider Status API
The `/api/providers/status` endpoint provides automatic provider detection based on environment variables:

**Universal LLM_KEY Support**
- **Updated** Added support for universal LLM_KEY that works for all providers
- Checks Vercel environment variables for configured providers
- Handles Google Gemini with dual environment variable support (GOOGLE_API_KEY and GEMINI_API_KEY)
- **Updated** All providers treated uniformly without special local handling

**Enhanced Provider Configuration Schema**
- Provider definitions with colors, gradients, and model lists matching UI components
- Environment variable mapping for automatic credential detection
- **Updated** Standard provider configuration without isLocal property
- Recommended provider flags for UI prioritization

**Section sources**
- [route.ts:1-204](file://app/api/providers/status/route.ts#L1-L204)

### Server-Side Security Architecture
The system implements comprehensive server-side credential management with automatic provider detection:

**Encryption Service**
- AES-256-GCM encryption with random IV and authentication tags
- Support for both base64 and raw 32-byte secrets
- Fallback to SHA-256 derived keys for development environments
- Safe runtime validation with non-fatal warnings during build phase

**Workspace Key Service**
- Per-process in-memory caching with 5-minute TTL
- Workspace-scoped credential resolution with authorization verification
- Global fallback capability for pipeline routes accessing any workspace
- Cache invalidation on configuration changes for immediate effect

**API Endpoints**
- `/api/engine-config`: Secure credential storage and retrieval with automatic cache invalidation
- `/api/providers/status`: Provider availability checking with environment variable validation
- **Updated** All providers treated uniformly without special local endpoints
- Automatic cache invalidation on configuration changes
- Workspace-scoped encryption and decryption with fallback mechanisms

**Section sources**
- [encryption.ts:1-95](file://lib/security/encryption.ts#L1-L95)
- [workspaceKeyService.ts:1-138](file://lib/security/workspaceKeyService.ts#L1-L138)
- [route.ts:1-154](file://app/api/engine-config/route.ts#L1-L154)
- [route.ts:1-204](file://app/api/providers/status/route.ts#L1-L204)

## Dependency Analysis
- Adapters depend on shared types and tools for message and tool-calling normalization.
- The factory depends on workspaceKeyService for secure credential resolution and environment variables as fallbacks.
- CachedAdapter decorates any AIAdapter to add caching and metrics.
- UI components rely on the factory and types for configuration and rendering.
- ModelSelectionGate and ProviderSelector components depend on workspaceKeyService for credential validation.
- Provider status API depends on environment variables for automatic provider detection.
- **Updated** All providers are treated uniformly without special local model dependencies.
- Encryption service provides secure key storage for all credential management flows.

**Updated** Dependencies have been simplified with uniform treatment of all providers and removal of local model-specific infrastructure.

```mermaid
graph LR
TYPES["types.ts"] --> OA["openai.ts"]
TYPES --> AA["anthropic.ts"]
TYPES --> GA["google.ts"]
TYPES --> OLA["ollama.ts"]
TOOLS["tools.ts"] --> OA
TOOLS --> GA
TOOLS --> OLA
IDX["index.ts"] --> OA
IDX --> AA
IDX --> GA
IDX --> OLA
IDX --> UNC["unconfigured.ts"]
IDX --> WKS["workspaceKeyService.ts"]
WKS --> ENC["encryption.ts"]
API["engine-config/route.ts"] --> ENC
PSTATUS["providers/status/route.ts"] --> ENC
MSG["ModelSelectionGate.tsx"] --> WKS
PS["ProviderSelector.tsx"] --> WKS
WSP["WorkspaceSettingsPanel.tsx"] --> MR["modelRegistry.ts"]
CFG["AIEngineConfigPanel.tsx"] --> IDX
```

**Diagram sources**
- [index.ts:1-301](file://lib/ai/adapters/index.ts#L1-L301)
- [types.ts:1-130](file://lib/ai/types.ts#L1-L130)
- [tools.ts:1-175](file://lib/ai/tools.ts#L1-L175)
- [workspaceKeyService.ts:1-138](file://lib/security/workspaceKeyService.ts#L1-L138)
- [encryption.ts:1-95](file://lib/security/encryption.ts#L1-L95)
- [ModelSelectionGate.tsx:1-414](file://components/ModelSelectionGate.tsx#L1-L414)
- [ProviderSelector.tsx:1-375](file://components/ProviderSelector.tsx#L1-L375)
- [WorkspaceSettingsPanel.tsx:1-436](file://components/WorkspaceSettingsPanel.tsx#L1-L436)
- [AIEngineConfigPanel.tsx:1-120](file://components/AIEngineConfigPanel.tsx#L1-L120)
- [route.ts:1-154](file://app/api/engine-config/route.ts#L1-L154)
- [route.ts:1-204](file://app/api/providers/status/route.ts#L1-L204)

**Section sources**
- [index.ts:1-301](file://lib/ai/adapters/index.ts#L1-L301)
- [workspaceKeyService.ts:1-138](file://lib/security/workspaceKeyService.ts#L1-L138)
- [encryption.ts:1-95](file://lib/security/encryption.ts#L1-L95)
- [route.ts:1-154](file://app/api/engine-config/route.ts#L1-L154)
- [route.ts:1-204](file://app/api/providers/status/route.ts#L1-L204)

## Performance Considerations
- Caching: CachedAdapter caches both full results and streaming chunks keyed by normalized options, reducing provider calls and enabling latency metrics.
- Token caps: Provider-specific caps prevent oversized requests and reduce retries.
- Streaming: Providers that support usage in stream finalization enable accurate cost accounting.
- Environment checks: Early detection of aggregator/HF routes avoids unnecessary retries and misconfiguration.
- **Updated** Simplified architecture reduces adapter instantiation overhead with uniform provider treatment.
- **Updated** Eliminated local model detection overhead and runtime validation complexity.
- **Updated** Standardized configuration flow improves performance across all provider types.

## Troubleshooting Guide
Common issues and resolutions:
- Missing API key: The factory throws a ConfigurationError or returns UnconfiguredAdapter. Configure via ModelSelectionGate.
- Provider mismatch: Use explicit provider selection in configuration to avoid heuristic detection errors.
- Tool-calling not working: Some providers ignore tools; verify provider support and remove tools for incompatible providers.
- Streaming failures: Ensure provider supports streaming and that the adapter is using the correct endpoint/baseURL.
- **Updated** Provider configuration issues: All providers now use standard configuration approach without special local handling.
- **Updated** Ollama connectivity problems: Use standard provider configuration with OLLAMA_BASE_URL environment variable.
- **Updated** Local runtime detection removed: No longer applicable as all providers are treated uniformly.
- Encryption key issues: Check ENCRYPTION_SECRET environment variable format and length.
- Cache invalidation: WorkspaceKeyService automatically invalidates cache on configuration changes.
- Model selection problems: Use ProviderSelector component for guided model selection with credential validation.
- Security warnings: The system provides non-fatal warnings during build phase to prevent deployment failures.
- Provider detection failures: Check Vercel environment variables for proper provider configuration.
- Automatic provider detection not working: Verify environment variables match expected naming conventions.
- **Updated** Configuration problems: Use comprehensive ModelSelectionGate workflow with standard provider configuration.
- **Updated** Local model issues: No longer applicable as Ollama is treated like any other provider.

**Section sources**
- [index.ts:28-40](file://lib/ai/adapters/index.ts#L28-L40)
- [index.ts:159-162](file://lib/ai/adapters/index.ts#L159-L162)
- [index.ts:204-207](file://lib/ai/adapters/index.ts#L204-L207)
- [unconfigured.ts:13-99](file://lib/ai/adapters/unconfigured.ts#L13-L99)
- [encryption.ts:81-94](file://lib/security/encryption.ts#L81-L94)
- [workspaceKeyService.ts:97-106](file://lib/security/workspaceKeyService.ts#L97-L106)
- [ModelSelectionGate.tsx:70-102](file://components/ModelSelectionGate.tsx#L70-L102)
- [ProviderSelector.tsx:136-148](file://components/ProviderSelector.tsx#L136-L148)
- [route.ts:88-164](file://app/api/providers/status/route.ts#L88-L164)

## Conclusion
The AI adapter system provides a robust, provider-agnostic abstraction over multiple AI providers with comprehensive security enhancements and streamlined configuration workflows. The recent simplification removes the previous distinction between cloud and local providers, treating all five supported providers (OpenAI, Anthropic, Google, Groq, Ollama) uniformly. The system now features a streamlined architecture with centralized credential resolution, enhanced security using AES-256-GCM encryption, and automatic provider detection that eliminates manual API key entry. The removal of the isLocal property and Ollama-specific local execution logic has created a more maintainable and consistent system that provides flexible configuration options for different use cases and performance requirements. By centralizing credential resolution, enforcing server-only secrets, and normalizing provider differences through a unified interface, it enables seamless switching between models and providers with enterprise-grade security and user-friendly configuration.

**Updated** The system has been streamlined to provide a unified experience across all providers, significantly improving maintainability and consistency. The simplified architecture eliminates the previous complexity of distinguishing between cloud and local providers while maintaining all functionality through standard OpenAI-compatible interfaces.

## Appendices

### Implementing a New Adapter
Steps to add a new provider:
1. Define a new class implementing AIAdapter with generate() and stream().
2. Normalize provider-specific message/tool/response formats to the shared types.
3. Register the adapter in the factory's createAdapter() switch or treat it as OpenAI-compatible via baseUrl.
4. Add provider detection logic if supporting OpenAI-compatible mode.
5. **Updated** Integrate with the unified provider configuration system without special local handling.
6. Integrate with the UI configuration panel for hints and documentation.

References:
- [base.ts:50-72](file://lib/ai/adapters/base.ts#L50-L72)
- [index.ts:146-215](file://lib/ai/adapters/index.ts#L146-L215)
- [types.ts:19-55](file://lib/ai/types.ts#L19-L55)
- [tools.ts:108-133](file://lib/ai/tools.ts#L108-L133)
- [ollama.ts:21-30](file://lib/ai/adapters/ollama.ts#L21-L30)

### Configuring Provider Credentials
- **ModelSelectionGate**: Comprehensive configuration with automatic provider detection and server-side encryption
- **ProviderSelector**: Interactive provider and model selection with credential status and automatic validation
- **Updated** **Unified Provider Configuration**: All providers use standard configuration approach without special local handling
- **Automatic Provider Detection**: Environment variable-based provider availability checking with universal LLM_KEY support
- **Workspace-level**: Store encrypted keys in workspace settings; retrieved via workspaceKeyService with global fallback
- **Environment Variables**: Set provider-specific environment variables for automatic credential detection
- **Unconfigured fallback**: When no keys are found, UnconfiguredAdapter returns a helpful UI or JSON
- **Updated** **Standard Configuration**: All providers including Ollama use standard environment variable configuration

References:
- [ModelSelectionGate.tsx:1-414](file://components/ModelSelectionGate.tsx#L1-L414)
- [ProviderSelector.tsx:1-375](file://components/ProviderSelector.tsx#L1-L375)
- [route.ts:88-164](file://app/api/providers/status/route.ts#L88-L164)
- [index.ts:236-278](file://lib/ai/adapters/index.ts#L236-L278)
- [workspaceKeyService.ts:32-67](file://lib/security/workspaceKeyService.ts#L32-L67)
- [unconfigured.ts:13-99](file://lib/ai/adapters/unconfigured.ts#L13-L99)
- [ollama.ts:25-29](file://lib/ai/adapters/ollama.ts#L25-L29)

### Enhanced Security Features
- **AES-256-GCM Encryption**: Hardware-accelerated encryption with authentication and fallback mechanisms
- **Workspace Scoping**: Keys are tied to specific workspaces with authorization checks and global fallback
- **Cache Invalidation**: Automatic cache clearing on configuration changes with immediate effect
- **Non-Fatal Validation**: Build-time warnings instead of deployment failures with graceful fallback
- **Environment Variable Integration**: Seamless fallback to environment variables with automatic provider detection
- **Provider Status API**: Server-side provider availability checking with environment variable validation
- **Universal LLM_KEY Support**: Single key that works across all providers for simplified configuration
- **Updated** **Standard Security Model**: All providers use the same security and configuration approach

References:
- [encryption.ts:27-69](file://lib/security/encryption.ts#L27-L69)
- [workspaceKeyService.ts:32-95](file://lib/security/workspaceKeyService.ts#L32-L95)
- [route.ts:69-127](file://app/api/engine-config/route.ts#L69-L127)
- [route.ts:88-164](file://app/api/providers/status/route.ts#L88-L164)

### Handling Provider-Specific Features
- Tool calls: Use the canonical Tool/ToolCall schema; adapters convert to/from provider-specific formats.
- Streaming: Use AsyncGenerator to yield StreamChunk deltas; usage may be included on the final chunk.
- Model constraints: Adapters handle provider-specific limitations (e.g., reasoning models, response_format, token caps).
- Model selection: Use ProviderSelector for guided model selection with workspace validation and automatic provider detection.
- **Updated** **Uniform Provider Features**: All providers use standard OpenAI-compatible interfaces without special local handling.
- **Updated** **Standard Model Capability Profiles**: All providers including Ollama use the same capability profile system.

**Updated** Provider-specific features now use a unified approach with all providers treated equally through standard OpenAI-compatible interfaces.

References:
- [tools.ts:47-79](file://lib/ai/tools.ts#L47-L79)
- [openai.ts:64-157](file://lib/ai/adapters/openai.ts#L64-L157)
- [anthropic.ts:89-145](file://lib/ai/adapters/anthropic.ts#L89-L145)
- [google.ts:35-69](file://lib/ai/adapters/google.ts#L35-L69)
- [ollama.ts:32-87](file://lib/ai/adapters/ollama.ts#L32-L87)
- [ProviderSelector.tsx:259-282](file://components/ProviderSelector.tsx#L259-L282)

### Example Workflows and Tests
- Adapter usage and streaming are validated in tests for OpenAI, Anthropic, Google, and Ollama.
- **Updated** Tests validate unified provider configuration without special local handling.
- Tests demonstrate tool-calling and streaming behavior across all providers.
- Encryption service tests validate AES-256-GCM implementation with fallback mechanisms.
- Adapter index tests cover provider detection and configuration resolution.
- Provider status API tests validate environment variable-based provider detection.
- **Updated** All tests now reflect the simplified architecture with uniform provider treatment.

**Updated** Example workflows now reflect the streamlined adapter system with uniform treatment of all providers.

References:
- [adapters.test.ts:1-109](file://__tests__/adapters.test.ts#L1-L109)
- [adapterIndex.test.ts:1-72](file://__tests__/adapterIndex.test.ts#L1-L72)
- [encryption.test.ts:1-48](file://__tests__/encryption.test.ts#L1-L48)
- [route.ts:88-164](file://app/api/providers/status/route.ts#L88-L164)
- [ModelSelectionGate.tsx:1-414](file://components/ModelSelectionGate.tsx#L1-L414)