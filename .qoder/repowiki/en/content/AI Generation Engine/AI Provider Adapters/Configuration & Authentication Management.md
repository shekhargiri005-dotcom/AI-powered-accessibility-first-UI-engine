# Configuration & Authentication Management

<cite>
**Referenced Files in This Document**
- [workspaceKeyService.ts](file://lib/security/workspaceKeyService.ts)
- [encryption.ts](file://lib/security/encryption.ts)
- [engine-config route.ts](file://app/api/engine-config/route.ts)
- [ModelSelectionGate.tsx](file://components/ModelSelectionGate.tsx)
- [adapters index.ts](file://lib/ai/adapters/index.ts)
- [providers status route.ts](file://app/api/providers/status/route.ts)
- [auth.ts](file://lib/auth.ts)
- [workspaceKeyService.test.ts](file://__tests__/workspaceKeyService.test.ts)
- [adaptersIndex.test.ts](file://__tests__/adaptersIndex.test.ts)
- [encryption.test.ts](file://__tests__/encryption.test.ts)
</cite>

## Update Summary
**Changes Made**
- Updated to reflect the new universal LLM_KEY as the fourth credential resolution fallback
- Enhanced credential resolution hierarchy documentation to include the universal fallback
- Updated troubleshooting guidance to include LLM_KEY configuration
- Added documentation for universal key support in provider status detection
- Maintained backward compatibility with existing workspace-specific and provider-specific keys

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

## Introduction
This document explains how the AI provider configuration and authentication management system is designed and operated. It covers the credential resolution hierarchy (workspace-specific keys, environment variables, provider-specific fallbacks, and the new universal LLM_KEY), the secure storage and retrieval of encrypted credentials, the configuration error handling mechanism, and the streamlined ModelSelectionGate component that handles configuration during startup. It also details the security measures that prevent client-side credential injection, including server-only execution and validation processes, and provides practical guidance for setting up configurations, troubleshooting common issues, and managing multiple provider keys across workspaces.

**Updated** The system now includes a universal LLM_KEY fallback that works across all providers, providing a streamlined configuration option while maintaining backward compatibility with workspace-specific and provider-specific keys.

## Project Structure
The configuration and authentication system spans several layers:
- Web UI: The ModelSelectionGate component provides a guided configuration experience during startup.
- API Layer: The engine-config route persists encrypted keys to the database and serves non-sensitive configuration.
- Security Services: Encryption and workspace key services manage secure storage and retrieval.
- Adapter Layer: Adapters resolve credentials server-side via workspaceKeyService, environment variables, provider-specific fallbacks, and the universal LLM_KEY.

```mermaid
graph TB
UI["ModelSelectionGate.tsx<br/>Startup Configuration"] --> API["engine-config route.ts<br/>Next.js Route"]
API --> DB["Prisma DB<br/>workspaceSettings"]
API --> ENC["encryption.ts<br/>AES-256-GCM"]
API --> WKS["workspaceKeyService.ts<br/>DB lookup + cache"]
WKS --> ENC
WKS --> DB
ADP["adapters index.ts<br/>Adapter Factory"] --> WKS
ADP --> ENV["Environment Variables"]
ADP --> LLM["LLM_KEY Universal<br/>Fallback"]
AUTH["auth.ts<br/>NextAuth"] --> API
```

**Diagram sources**
- [ModelSelectionGate.tsx:57-154](file://components/ModelSelectionGate.tsx#L57-L154)
- [engine-config route.ts:36-153](file://app/api/engine-config/route.ts#L36-L153)
- [workspaceKeyService.ts:32-95](file://lib/security/workspaceKeyService.ts#L32-L95)
- [encryption.ts:27-68](file://lib/security/encryption.ts#L27-L68)
- [adapters index.ts:236-286](file://lib/ai/adapters/index.ts#L236-L286)
- [providers status route.ts:128-205](file://app/api/providers/status/route.ts#L128-L205)
- [auth.ts:11-86](file://lib/auth.ts#L11-L86)

**Section sources**
- [ModelSelectionGate.tsx:57-154](file://components/ModelSelectionGate.tsx#L57-L154)
- [engine-config route.ts:36-153](file://app/api/engine-config/route.ts#L36-L153)
- [workspaceKeyService.ts:32-95](file://lib/security/workspaceKeyService.ts#L32-L95)
- [encryption.ts:27-68](file://lib/security/encryption.ts#L27-L68)
- [adapters index.ts:236-286](file://lib/ai/adapters/index.ts#L236-L286)
- [providers status route.ts:128-205](file://app/api/providers/status/route.ts#L128-L205)
- [auth.ts:11-86](file://lib/auth.ts#L11-L86)

## Core Components
- Workspace Key Service: Retrieves and caches decrypted API keys per workspace/provider, with a global fallback for default workspace contexts.
- Encryption Service: Provides AES-256-GCM encryption/decryption for API keys at rest, with robust startup validation and fallback behavior.
- Engine Config API: Persists encrypted keys to the database, returns non-sensitive configuration to the UI, and invalidates caches upon changes.
- Model Selection Gate: A guided startup component that allows users to configure provider credentials through a streamlined interface during initialization.
- Adapter Factory: Resolves credentials server-side via workspaceKeyService, environment variables, provider-specific fallbacks, and the universal LLM_KEY fallback, throwing ConfigurationError on missing keys, and returning UnconfiguredAdapter for graceful degradation.
- Provider Status Detection: Checks for universal LLM_KEY availability across all providers for UI configuration guidance.

**Updated** Enhanced adapter factory to include universal LLM_KEY as the fourth credential resolution fallback, providing a unified configuration option.

**Section sources**
- [workspaceKeyService.ts:32-137](file://lib/security/workspaceKeyService.ts#L32-L137)
- [encryption.ts:27-68](file://lib/security/encryption.ts#L27-L68)
- [engine-config route.ts:36-153](file://app/api/engine-config/route.ts#L36-L153)
- [ModelSelectionGate.tsx:57-154](file://components/ModelSelectionGate.tsx#L57-L154)
- [adapters index.ts:28-286](file://lib/ai/adapters/index.ts#L28-L286)
- [providers status route.ts:128-205](file://app/api/providers/status/route.ts#L128-L205)

## Architecture Overview
The system enforces a strict server-only credential resolution policy. The UI never receives or stores real API keys; all sensitive data is encrypted at rest and handled server-side. Configuration now occurs only during startup through the ModelSelectionGate component, with the new universal LLM_KEY providing a streamlined fallback option.

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "ModelSelectionGate.tsx"
participant API as "engine-config route.ts"
participant DB as "Prisma DB"
participant ENC as "encryption.ts"
participant WKS as "workspaceKeyService.ts"
User->>UI : "Select provider, enter key, choose model"
UI->>API : "POST /api/engine-config {provider, model, apiKey}"
API->>ENC : "encrypt(apiKey)"
ENC-->>API : "encryptedApiKey"
API->>DB : "upsert workspaceSettings"
API-->>UI : "{success}"
Note over API,WKS : "Later, when generating content"
API->>WKS : "getWorkspaceApiKey(provider, workspaceId, userId)"
WKS->>DB : "find encrypted key"
WKS->>ENC : "decrypt(encryptedApiKey)"
ENC-->>WKS : "apiKey"
WKS-->>API : "apiKey or null"
API-->>User : "Generation result"
```

**Diagram sources**
- [ModelSelectionGate.tsx:110-146](file://components/ModelSelectionGate.tsx#L110-L146)
- [engine-config route.ts:69-127](file://app/api/engine-config/route.ts#L69-L127)
- [workspaceKeyService.ts:32-95](file://lib/security/workspaceKeyService.ts#L32-L95)
- [encryption.ts:27-68](file://lib/security/encryption.ts#L27-L68)

## Detailed Component Analysis

### Enhanced Credential Resolution Hierarchy
The adapter factory implements a strict, layered resolution order with the new universal LLM_KEY fallback:
1. Workspace-specific key lookup via workspaceKeyService.
2. Environment variable fallback for the specific provider.
3. Provider-specific environment variable fallbacks.
4. **NEW** Universal LLM_KEY fallback that works for all providers.
5. Graceful degradation via UnconfiguredAdapter if no credentials are found.

```mermaid
flowchart TD
Start(["Resolve Credentials"]) --> WS["workspaceKeyService.getWorkspaceApiKey()"]
WS --> FoundWS{"Key found?"}
FoundWS --> |Yes| UseWS["Use workspace key"]
FoundWS --> |No| Env["Check process.env[PROVIDER_API_KEY]"]
Env --> FoundEnv{"Key found?"}
FoundEnv --> |Yes| UseEnv["Use environment key"]
FoundEnv --> |No| Fallbacks["Check provider-specific env vars"]
Fallbacks --> FoundFB{"Key found?"}
FoundFB --> |Yes| UseFB["Use provider-specific env key"]
FoundFB --> |No| Universal["Check process.env.LLM_KEY"]
Universal --> FoundUni{"Universal key found?"}
FoundUni --> |Yes| UseUni["Use universal LLM_KEY"]
FoundUni --> |No| Unconfigured["Return UnconfiguredAdapter"]
UseWS --> End(["Adapter Ready"])
UseEnv --> End
UseFB --> End
UseUni --> End
Unconfigured --> End
```

**Diagram sources**
- [adapters index.ts:236-286](file://lib/ai/adapters/index.ts#L236-L286)
- [workspaceKeyService.ts:32-95](file://lib/security/workspaceKeyService.ts#L32-L95)

**Section sources**
- [adapters index.ts:224-286](file://lib/ai/adapters/index.ts#L224-L286)

### Provider Status Detection with Universal LLM_KEY
The provider status endpoint now checks for universal LLM_KEY availability across all providers to determine configuration state.

```mermaid
flowchart TD
A["GET /api/providers/status"] --> B["Check process.env.LLM_KEY"]
B --> C{"Universal key exists?"}
C --> |Yes| D["Set configured=true for all providers"]
C --> |No| E["Check provider-specific env vars"]
E --> F{"Provider has key?"}
F --> |Yes| G["Set configured=true"]
F --> |No| H["Set configured=false"]
D --> I["Return provider status"]
G --> I
H --> I
```

**Diagram sources**
- [providers status route.ts:128-205](file://app/api/providers/status/route.ts#L128-L205)

**Section sources**
- [providers status route.ts:128-205](file://app/api/providers/status/route.ts#L128-L205)

### WorkspaceKeyService Integration
- Authorization: Validates user membership for non-default workspaces before retrieving keys.
- Caching: Uses an in-memory TTL map keyed by "workspaceId:provider" to avoid repeated DB lookups.
- Global Fallback: For default workspace context, scans all workspaces to find the first real key for a provider.
- Cache Invalidation: Immediately invalidates cache entries on save/delete to ensure fresh credentials on next request.

```mermaid
flowchart TD
A["getWorkspaceApiKey(provider, workspaceId, userId?)"] --> Auth{"userId provided<br/>and workspace != default?"}
Auth --> |Yes| CheckMem["Check workspaceMember"]
CheckMem --> |Not member| ReturnNull["Return null"]
CheckMem --> |Member| Next
Auth --> |No| Next["Proceed"]
Next --> Cache["Lookup cache by 'workspaceId:provider'"]
Cache --> Hit{"Cache hit and not expired?"}
Hit --> |Yes| ReturnCached["Return cached value"]
Hit --> |No| DB["Find workspaceSettings by workspaceId+provider"]
DB --> Decrypt["Decrypt encryptedApiKey"]
Decrypt --> EnvFallback{"Decrypted == 'ENV_FALLBACK'?"}
EnvFallback --> |Yes| TreatNull["Treat as null (env fallback)"]
EnvFallback --> |No| StoreCache["Store in cache and return"]
StoreCache --> ReturnVal["Return decrypted key"]
TreatNull --> GlobalFB{"workspaceId == 'default'?"}
GlobalFB --> |Yes| Scan["Scan any workspace for first matching key"]
Scan --> ReturnScan["Return scanned key or null"]
GlobalFB --> |No| ReturnNull2["Return null"]
```

**Diagram sources**
- [workspaceKeyService.ts:32-95](file://lib/security/workspaceKeyService.ts#L32-L95)

**Section sources**
- [workspaceKeyService.ts:32-137](file://lib/security/workspaceKeyService.ts#L32-L137)

### Encryption Service and Secure Storage
- AES-256-GCM encryption with random IV and authentication tag.
- Supports base64-encoded or raw 32-byte ENCRYPTION_SECRET; falls back to a deterministic hash derived from environment variables at startup.
- Startup validation warns if the secret is missing but does not crash builds; runtime encryption/decryption will safely fail with a 500 error.
- Keys are stored in the database as encryptedApiKey and never exposed to the client.

```mermaid
classDiagram
class EncryptionService {
+encrypt(text) string
+decrypt(encryptedText) string
}
class EngineConfigAPI {
+POST /api/engine-config
+GET /api/engine-config
+DELETE /api/engine-config
}
class PrismaDB {
+workspaceSettings
}
EncryptionService <.. EngineConfigAPI : "encrypts/decrypts"
EngineConfigAPI --> PrismaDB : "persists encryptedApiKey"
```

**Diagram sources**
- [encryption.ts:27-68](file://lib/security/encryption.ts#L27-L68)
- [engine-config route.ts:69-127](file://app/api/engine-config/route.ts#L69-L127)

**Section sources**
- [encryption.ts:27-95](file://lib/security/encryption.ts#L27-L95)
- [engine-config route.ts:69-127](file://app/api/engine-config/route.ts#L69-L127)

### Model Selection Gate Functionality
- Provider Selection: Guides users through a streamlined two-step process (Provider → Confirm) during startup.
- Key Handling: Never stores real keys client-side; sends keys securely to the server for encryption and persistence.
- Provider Discovery: Automatically discovers configured providers from environment variables, including those using the universal LLM_KEY.
- Model Selection: Allows users to select from available models for the chosen provider.
- Persistence: Saves encrypted keys to the database and marks the session as active.

**Updated** Enhanced provider discovery to include universal LLM_KEY configuration across all providers.

```mermaid
sequenceDiagram
participant UI as "ModelSelectionGate.tsx"
participant API as "engine-config route.ts"
participant ENC as "encryption.ts"
participant DB as "Prisma DB"
UI->>API : "GET /api/providers/status"
API-->>UI : "{providers with configured=true/false}"
UI->>API : "POST /api/engine-config {provider, model, apiKey}"
API->>ENC : "encrypt(apiKey)"
ENC-->>API : "encryptedApiKey"
API->>DB : "upsert workspaceSettings"
API-->>UI : "{success}"
UI->>API : "GET /api/engine-config"
API-->>UI : "{provider, model, hasKey}"
```

**Diagram sources**
- [ModelSelectionGate.tsx:70-102](file://components/ModelSelectionGate.tsx#L70-L102)
- [ModelSelectionGate.tsx:110-146](file://components/ModelSelectionGate.tsx#L110-L146)
- [engine-config route.ts:36-153](file://app/api/engine-config/route.ts#L36-L153)

**Section sources**
- [ModelSelectionGate.tsx:57-154](file://components/ModelSelectionGate.tsx#L57-L154)
- [engine-config route.ts:36-153](file://app/api/engine-config/route.ts#L36-L153)

### Configuration Error Handling and User Surfacing
- ConfigurationError is thrown when no credentials are available for a named provider, ensuring clear user-facing guidance.
- The adapter factory returns UnconfiguredAdapter when no credentials are found, enabling graceful degradation with helpful UI messaging.
- The API layer surfaces errors as JSON responses with appropriate HTTP status codes.

```mermaid
flowchart TD
A["Adapter Creation"] --> CheckKey{"apiKey available?"}
CheckKey --> |Yes| Build["Build adapter with apiKey"]
CheckKey --> |No| ThrowErr["Throw ConfigurationError"]
ThrowErr --> Fallback["Return UnconfiguredAdapter"]
Build --> Done(["Ready"])
Fallback --> Done
```

**Diagram sources**
- [adapters index.ts:28-40](file://lib/ai/adapters/index.ts#L28-L40)
- [adapters index.ts:146-215](file://lib/ai/adapters/index.ts#L146-L215)

**Section sources**
- [adapters index.ts:28-40](file://lib/ai/adapters/index.ts#L28-L40)
- [adapters index.ts:146-215](file://lib/ai/adapters/index.ts#L146-L215)

### Security Measures Against Client-Side Credential Injection
- Server-only execution: The adapters and credential resolution run server-side; the UI never receives or logs real keys.
- Strict input validation: The UI masks keys, disables autocomplete, and avoids storing real keys in localStorage.
- Encrypted at rest: Keys are encrypted before being persisted to the database.
- Minimal exposure: The UI only stores non-sensitive display metadata locally.

**Section sources**
- [ModelSelectionGate.tsx:110-146](file://components/ModelSelectionGate.tsx#L110-L146)
- [engine-config route.ts:89-93](file://app/api/engine-config/route.ts#L89-L93)
- [encryption.ts:27-68](file://lib/security/encryption.ts#L27-L68)

## Dependency Analysis
The following diagram highlights the key dependencies among components involved in configuration and authentication.

```mermaid
graph TB
ADP["adapters/index.ts"] --> WKS["workspaceKeyService.ts"]
ADP --> ENV["Environment Variables"]
ADP --> LLM["LLM_KEY Universal<br/>Fallback"]
API["engine-config route.ts"] --> WKS
API --> ENC["encryption.ts"]
API --> PRISMA["Prisma DB"]
UI["ModelSelectionGate.tsx"] --> API
AUTH["auth.ts"] --> API
PS["providers/status route.ts"] --> ENV
PS --> LLM
```

**Diagram sources**
- [adapters index.ts:236-286](file://lib/ai/adapters/index.ts#L236-L286)
- [workspaceKeyService.ts:32-95](file://lib/security/workspaceKeyService.ts#L32-L95)
- [engine-config route.ts:69-127](file://app/api/engine-config/route.ts#L69-L127)
- [ModelSelectionGate.tsx:110-146](file://components/ModelSelectionGate.tsx#L110-L146)
- [auth.ts:11-86](file://lib/auth.ts#L11-L86)
- [providers status route.ts:128-205](file://app/api/providers/status/route.ts#L128-L205)

**Section sources**
- [adapters index.ts:236-286](file://lib/ai/adapters/index.ts#L236-L286)
- [workspaceKeyService.ts:32-95](file://lib/security/workspaceKeyService.ts#L32-L95)
- [engine-config route.ts:69-127](file://app/api/engine-config/route.ts#L69-L127)
- [ModelSelectionGate.tsx:110-146](file://components/ModelSelectionGate.tsx#L110-L146)
- [auth.ts:11-86](file://lib/auth.ts#L11-L86)
- [providers status route.ts:128-205](file://app/api/providers/status/route.ts#L128-L205)

## Performance Considerations
- Caching: workspaceKeyService caches decrypted keys with a 5-minute TTL to reduce database and decryption overhead.
- Batch invalidation: Deleting engine configuration invalidates cache entries for all providers in a workspace to ensure immediate freshness.
- Request timeout: The engine-config route sets a maximum execution duration to bound request latency.
- Model discovery: The UI fetches model lists on demand and supports search to minimize unnecessary network traffic.
- Universal key optimization: The universal LLM_KEY fallback adds minimal overhead as it's checked only after provider-specific keys are exhausted.

**Section sources**
- [workspaceKeyService.ts:11-24](file://lib/security/workspaceKeyService.ts#L11-L24)
- [workspaceKeyService.ts:100-106](file://lib/security/workspaceKeyService.ts#L100-L106)
- [engine-config route.ts:18-32](file://app/api/engine-config/route.ts#L18-L32)
- [ModelSelectionGate.tsx:70-102](file://components/ModelSelectionGate.tsx#L70-L102)

## Troubleshooting Guide
Common issues and resolutions:
- Missing provider key
  - Symptom: ConfigurationError thrown or UnconfiguredAdapter returned.
  - Action: Use the ModelSelectionGate component to add a key during startup, or set the appropriate environment variable. Try the universal LLM_KEY as a fallback option.
  - Reference: [adapters index.ts:159-200](file://lib/ai/adapters/index.ts#L159-L200)
- Key not persisting
  - Symptom: Key disappears after reload.
  - Action: Verify encryption secret is configured; confirm POST to /api/engine-config succeeds; check cache invalidation on save.
  - References: [engine-config route.ts:111-120](file://app/api/engine-config/route.ts#L111-L120), [encryption.ts:81-94](file://lib/security/encryption.ts#L81-L94)
- Incorrect provider detected
  - Symptom: Key appears to belong to another provider.
  - Action: Manually select the correct provider in the ModelSelectionGate; the UI auto-detects from key prefixes.
  - Reference: [ModelSelectionGate.tsx:104-108](file://components/ModelSelectionGate.tsx#L104-L108)
- Connectivity test fails
  - Symptom: Connection status shows failure.
  - Action: Confirm key validity and network access; test against the provider's documented base URL.
  - Reference: [ModelSelectionGate.tsx:110-146](file://components/ModelSelectionGate.tsx#L110-L146)
- Environment variable fallback not applied
  - Symptom: Keys not used despite being set in environment.
  - Action: Ensure the environment variable name matches the provider (e.g., OPENAI_API_KEY); verify workspace-specific keys take precedence over universal LLM_KEY.
  - Reference: [adapters index.ts:255-286](file://lib/ai/adapters/index.ts#L255-L286)
- Universal LLM_KEY not working
  - Symptom: Universal key not being used despite being set.
  - Action: Verify LLM_KEY is set in environment variables; check that provider-specific keys are not interfering; confirm the universal key has sufficient permissions.
  - Reference: [adapters index.ts:275-280](file://lib/ai/adapters/index.ts#L275-L280)
- Managing multiple provider keys across workspaces
  - Best practice: Configure workspace-specific keys for isolation; rely on environment variables for shared defaults; use the universal LLM_KEY as a final fallback for quick testing; leverage provider status detection to see which providers are configured.
  - Reference: [workspaceKeyService.ts:74-87](file://lib/security/workspaceKeyService.ts#L74-L87)
  - Reference: [providers status route.ts:156-157](file://app/api/providers/status/route.ts#L156-L157)

**Updated** Added troubleshooting guidance for the new universal LLM_KEY fallback and enhanced existing troubleshooting steps to reflect the expanded credential resolution hierarchy.

**Section sources**
- [adapters index.ts:159-200](file://lib/ai/adapters/index.ts#L159-L200)
- [engine-config route.ts:111-120](file://app/api/engine-config/route.ts#L111-L120)
- [encryption.ts:81-94](file://lib/security/encryption.ts#L81-L94)
- [ModelSelectionGate.tsx:104-108](file://components/ModelSelectionGate.tsx#L104-L108)
- [ModelSelectionGate.tsx:110-146](file://components/ModelSelectionGate.tsx#L110-L146)
- [adapters index.ts:255-286](file://lib/ai/adapters/index.ts#L255-L286)
- [workspaceKeyService.ts:74-87](file://lib/security/workspaceKeyService.ts#L74-L87)
- [providers status route.ts:156-157](file://app/api/providers/status/route.ts#L156-L157)

## Conclusion
The system enforces a secure, streamlined approach to AI provider configuration and authentication. By resolving credentials server-side, encrypting keys at rest, and surfacing clear configuration errors, it ensures safety and usability. The ModelSelectionGate component provides a guided, user-friendly interface for managing provider credentials during startup, while the adapter factory and workspace key service maintain strict separation of concerns and robust fallback behavior. The new universal LLM_KEY fallback enhances flexibility by providing a single configuration option that works across all providers, while maintaining backward compatibility with existing workspace-specific and provider-specific keys. This enhanced approach reduces complexity while maintaining security and reliability.

**Updated** The system now includes a universal LLM_KEY fallback that provides a streamlined configuration option across all providers, complementing the existing workspace-specific and provider-specific key management while maintaining the same security guarantees and user experience.