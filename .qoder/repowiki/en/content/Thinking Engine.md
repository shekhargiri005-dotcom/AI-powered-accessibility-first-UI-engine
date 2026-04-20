# Thinking Engine

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [package.json](file://package.json)
- [app/api/think/route.ts](file://app/api/think/route.ts)
- [components/ThinkingPanel.tsx](file://components/ThinkingPanel.tsx)
- [lib/validation/schemas.ts](file://lib/validation/schemas.ts)
- [lib/ai/types.ts](file://lib/ai/types.ts)
- [lib/auth.ts](file://lib/auth.ts)
- [lib/logger.ts](file://lib/logger.ts)
- [lib/ai/adapters/openai.ts](file://lib/ai/adapters/openai.ts)
- [lib/ai/adapters/index.ts](file://lib/ai/adapters/index.ts)
- [lib/ai/adapters/base.ts](file://lib/ai/adapters/base.ts)
- [lib/ai/cache.ts](file://lib/ai/cache.ts)
- [lib/ai/metrics.ts](file://lib/ai/metrics.ts)
- [lib/ai/thinkingEngine.ts](file://lib/ai/thinkingEngine.ts)
- [lib/ai/intentClassifier.ts](file://lib/ai/intentClassifier.ts)
- [lib/ai/prompts.ts](file://lib/ai/prompts.ts)
- [components/prompt-input/ModeToggle.tsx](file://components/prompt-input/ModeToggle.tsx)
- [components/prompt-input/types.ts](file://components/prompt-input/types.ts)
</cite>

## Update Summary
**Changes Made**
- Enhanced JSON extraction algorithm with balanced brace matching and new Stage 5 preamble stripping functionality
- Increased maximum token limit from 800 to 1200 for improved expert-level reasoning capabilities
- Enhanced depth_ui mode detection with sophisticated keyword matching for immersive UI requests
- Improved execution mode suggestion logic incorporating depth_ui detection alongside existing component and app modes
- Added comprehensive depth_ui schema validation and type definitions
- Integrated depth_ui mode into the planning engine with intelligent keyword-based detection
- Updated UI components to support depth_ui mode selection and visualization
- Enhanced fallback plan generation with depth_ui awareness

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
This document describes the Thinking Engine, the AI-powered planning and decision-making layer of an AI-powered accessibility-first UI generation platform. The Thinking Engine transforms user intent into a structured, executable plan that guides subsequent generation and refinement workflows. It integrates with multiple AI providers, enforces strict security boundaries around API keys, and exposes a resilient HTTP API that gracefully handles failures by returning deterministic fallback plans.

The Thinking Engine consists of:
- An HTTP endpoint that validates requests, authenticates sessions, and orchestrates planning
- A planning schema that captures intent, scope, approach, and clarifications
- A UI panel that renders the plan and enables iterative refinement
- AI adapters for secure provider communication with caching and metrics
- Robust logging and error handling with streamlined retry logic
- Deterministic fallback mechanisms for resilience with enhanced performance
- **Enhanced** Sophisticated depth_ui mode detection with keyword matching for immersive UI requests
- **Enhanced** Advanced JSON extraction algorithm with balanced brace matching and stage-based parsing

**Updated** The Thinking Engine now features enhanced depth_ui mode detection with intelligent keyword matching for immersive UI requests, improved execution mode suggestion logic, comprehensive depth_ui schema validation for visually rich interfaces, and an advanced JSON extraction algorithm with five-stage parsing including balanced brace matching and preamble stripping functionality.

## Project Structure
The Thinking Engine spans frontend UI components, backend API routes, validation schemas, AI adapters, and infrastructure utilities. The following diagram shows the high-level structure and key interactions.

```mermaid
graph TB
subgraph "Frontend"
TP["ThinkingPanel.tsx"]
MT["ModeToggle.tsx"]
TYPES["types.ts"]
end
subgraph "Backend API"
API["app/api/think/route.ts"]
AUTH["lib/auth.ts"]
LOG["lib/logger.ts"]
end
subgraph "Validation"
SCHEMAS["lib/validation/schemas.ts"]
end
subgraph "AI Layer"
ADAPTERS["lib/ai/adapters/index.ts"]
OPENAI["lib/ai/adapters/openai.ts"]
BASE["lib/ai/adapters/base.ts"]
CACHE["lib/ai/cache.ts"]
METRICS["lib/ai/metrics.ts"]
END
subgraph "Intelligence Layer"
THINK["lib/ai/thinkingEngine.ts"]
CLASSIFY["lib/ai/intentClassifier.ts"]
PROMPTS["lib/ai/prompts.ts"]
end
TP --> API
MT --> API
TYPES --> MT
API --> AUTH
API --> LOG
API --> SCHEMAS
API --> THINK
THINK --> ADAPTERS
CLASSIFY --> PROMPTS
ADAPTERS --> OPENAI
ADAPTERS --> BASE
ADAPTERS --> CACHE
ADAPTERS --> METRICS
```

**Diagram sources**
- [app/api/think/route.ts:1-86](file://app/api/think/route.ts#L1-L86)
- [components/ThinkingPanel.tsx:1-358](file://components/ThinkingPanel.tsx#L1-L358)
- [components/prompt-input/ModeToggle.tsx:1-120](file://components/prompt-input/ModeToggle.tsx#L1-L120)
- [components/prompt-input/types.ts:1-53](file://components/prompt-input/types.ts#L1-L53)
- [lib/validation/schemas.ts:65-97](file://lib/validation/schemas.ts#L65-L97)
- [lib/ai/adapters/index.ts:1-282](file://lib/ai/adapters/index.ts#L1-L282)
- [lib/ai/adapters/openai.ts:1-218](file://lib/ai/adapters/openai.ts#L1-L218)
- [lib/ai/adapters/base.ts:1-73](file://lib/ai/adapters/base.ts#L1-L73)
- [lib/ai/cache.ts:1-141](file://lib/ai/cache.ts#L1-L141)
- [lib/ai/metrics.ts:1-89](file://lib/ai/metrics.ts#L1-L89)
- [lib/ai/thinkingEngine.ts:1-509](file://lib/ai/thinkingEngine.ts#L1-L509)
- [lib/ai/intentClassifier.ts:1-255](file://lib/ai/intentClassifier.ts#L1-L255)
- [lib/ai/prompts.ts:347-450](file://lib/ai/prompts.ts#L347-L450)
- [lib/auth.ts:1-87](file://lib/auth.ts#L1-L87)
- [lib/logger.ts:1-89](file://lib/logger.ts#L1-L89)

**Section sources**
- [README.md:1-37](file://README.md#L1-L37)
- [package.json:1-68](file://package.json#L1-L68)

## Core Components
- HTTP Endpoint: Validates request JSON, extracts intent and optional project context, enforces security boundaries, authenticates the session, and invokes the planning function. It returns either a successful plan or a deterministic fallback plan to keep the UI responsive.
- Planning Schema: Defines the ThinkingPlan structure, including detected intent, summary, planned approach steps, affected scope, clarification opportunities, execution mode, and optional expert reasoning.
- UI Panel: Renders the plan with collapsible sections, intent badges, requirement breakdown, and actionable controls (Proceed, Refine, Regenerate, Skip).
- AI Adapters: Provider-specific integrations for OpenAI and Anthropic, handling model constraints, streaming, and usage accounting with caching and metrics.
- Authentication and Logging: JWT-based session retrieval and structured request-scoped logging for observability.
- Planning Engine: Core logic that generates structured thinking plans with expert reasoning, streamlined retry mechanisms, and enhanced fallback capabilities.
- **Enhanced** Depth UI Detection: Sophisticated keyword matching system that intelligently detects immersive UI requests and suggests depth_ui mode alongside component and app modes.
- **Enhanced** Advanced JSON Extraction: Five-stage parsing algorithm with balanced brace matching, truncated JSON repair, and preamble stripping for robust parsing of AI responses.

**Updated** The Thinking Engine now features enhanced depth_ui mode detection with intelligent keyword matching for immersive UI requests, improved execution mode suggestion logic, comprehensive depth_ui schema validation for visually rich interfaces, and an advanced JSON extraction algorithm with five-stage parsing including balanced brace matching and preamble stripping functionality.

**Section sources**
- [app/api/think/route.ts:8-86](file://app/api/think/route.ts#L8-L86)
- [lib/validation/schemas.ts:65-97](file://lib/validation/schemas.ts#L65-L97)
- [components/ThinkingPanel.tsx:128-358](file://components/ThinkingPanel.tsx#L128-L358)
- [lib/ai/adapters/openai.ts:36-218](file://lib/ai/adapters/openai.ts#L36-L218)
- [lib/ai/adapters/index.ts:135-256](file://lib/ai/adapters/index.ts#L135-L256)
- [lib/auth.ts:11-87](file://lib/auth.ts#L11-L87)
- [lib/logger.ts:66-85](file://lib/logger.ts#L66-L85)
- [lib/ai/thinkingEngine.ts:281-287](file://lib/ai/thinkingEngine.ts#L281-L287)
- [lib/ai/intentClassifier.ts:87-90](file://lib/ai/intentClassifier.ts#L87-L90)

## Architecture Overview
The Thinking Engine follows a layered architecture:
- Presentation Layer: The ThinkingPanel renders the plan and collects user actions.
- API Layer: The /api/think endpoint validates inputs, enforces security, and orchestrates planning.
- Validation Layer: Zod schemas define the contract for intent classification and thinking plans.
- AI Layer: Provider adapters encapsulate differences in API constraints and streaming behavior with caching and metrics.
- Intelligence Layer: Enhanced intent classification with depth_ui detection and sophisticated keyword matching.
- Infrastructure Layer: Authentication and logging provide session context and observability.
- Planning Engine: Core logic that generates structured thinking plans with expert reasoning and streamlined retry mechanisms.

```mermaid
sequenceDiagram
participant UI as "ThinkingPanel.tsx"
participant API as "/api/think/route.ts"
participant AUTH as "lib/auth.ts"
participant LOG as "lib/logger.ts"
participant ADAPT as "AI Adapters"
participant PLAN as "Thinking Engine"
participant CLASS as "Intent Classifier"
UI->>API : "POST /api/think {prompt, intentType, projectContext}"
API->>AUTH : "auth()"
AUTH-->>API : "session {user.id}"
API->>LOG : "createRequestLogger('/api/think')"
API->>PLAN : "generateThinkingPlan(...)"
PLAN->>CLASS : "classifyIntent() for depth_ui detection"
CLASS-->>PLAN : "IntentClassification with suggestedMode"
PLAN->>ADAPT : "generate({messages, responseFormat})"
ADAPT-->>PLAN : "ThinkingPlan or error"
PLAN-->>API : "ThinkingPlan or fallback"
alt "Success"
API-->>UI : "{success : true, plan}"
else "Network/Rate Limit Error"
PLAN->>PLAN : "Exponential backoff retry (up to 3 attempts)<br/>30 second timeout"
PLAN-->>API : "Retry or fallback"
API-->>UI : "{success : true, plan, _fallback : true}"
end
```

**Updated** The Thinking Engine now implements enhanced depth_ui mode detection with sophisticated keyword matching and streamlined retry logic with exponential backoff for better reliability and performance.

**Diagram sources**
- [app/api/think/route.ts:8-86](file://app/api/think/route.ts#L8-L86)
- [lib/auth.ts:11-87](file://lib/auth.ts#L11-L87)
- [lib/logger.ts:66-85](file://lib/logger.ts#L66-L85)
- [lib/ai/adapters/openai.ts:59-152](file://lib/ai/adapters/openai.ts#L59-L152)
- [lib/ai/thinkingEngine.ts:389-437](file://lib/ai/thinkingEngine.ts#L389-L437)
- [lib/ai/intentClassifier.ts:87-90](file://lib/ai/intentClassifier.ts#L87-L90)

## Detailed Component Analysis

### HTTP Endpoint: /api/think
Responsibilities:
- Validate JSON payload and required fields
- Enforce security by accepting only provider and model identifiers (never API keys or base URLs)
- Extract workspace and user context from session and headers
- Invoke the planning function and return either the plan or a deterministic fallback
- Log request lifecycle and errors

Key behaviors:
- Input validation ensures prompt exists and is non-empty
- Session-based user ID and workspace ID are captured for downstream use
- On planning failure, a fallback plan is returned with a flag indicating fallback usage
- Never returns HTTP 400 for planning failures - always provides a usable fallback plan

```mermaid
flowchart TD
Start(["POST /api/think"]) --> Parse["Parse JSON body"]
Parse --> Valid{"Body valid?"}
Valid --> |No| BadReq["Return 400: Invalid JSON"]
Valid --> |Yes| Fields{"Has prompt + intentType?"}
Fields --> |No| FieldsErr["Return 400: Missing fields"]
Fields --> |Yes| Security["Accept only provider/model<br/>Never apiKey/baseUrl"]
Security --> Auth["auth(): get session + user.id"]
Auth --> Plan["generateThinkingPlan(...)"]
Plan --> Success{"Plan success?"}
Success --> |Yes| Ok["Return {success: true, plan}"]
Success --> |No| Fallback["buildFallbackPlan(...)"]
Fallback --> OkFallback["Return {success: true, plan, _fallback: true}"]
```

**Diagram sources**
- [app/api/think/route.ts:8-86](file://app/api/think/route.ts#L8-L86)

**Section sources**
- [app/api/think/route.ts:8-86](file://app/api/think/route.ts#L8-L86)

### Planning Schema: ThinkingPlan
Defines the structure of the AI-generated plan:
- detectedIntent: One of predefined intent types
- summary: Human-readable summary of understood intent
- plannedApproach: Ordered steps to achieve the goal
- affectedScope: Files impacted by the plan
- clarificationOpportunities: Questions to improve understanding
- executionMode: How the system should proceed (e.g., Generate New UI, Edit Existing UI)
- expertReasoning: Optional expert context fields
- requirementBreakdown: Optional structured breakdown for product ideation
- suggestedMode: Component/app/depth_ui mode
- shouldGenerateCode: Whether code generation should proceed immediately

**Enhanced** The suggestedMode field now includes depth_ui as a third option, enabling intelligent detection of immersive UI requests through keyword matching.

```mermaid
classDiagram
class ThinkingPlan {
+IntentType detectedIntent
+string summary
+string[] plannedApproach
+string[] affectedScope
+string[] clarificationOpportunities
+string executionMode
+ExpertReasoning expertReasoning
+RequirementBreakdown requirementBreakdown
+GenerationMode suggestedMode
+boolean shouldGenerateCode
}
class ExpertReasoning {
+string purpose
+string userType
+string informationDensity
+string interactionModel
+string visualTone
+string motionStrategy
+string renderingStrategy
+string componentArchitecture
+string usabilityCheck
}
class RequirementBreakdown {
+string productSummary
+string[] coreFeatures
+string[] userFlow
+string[] uiSections
+string designStyle
+string targetAudience
+string[] uxPriorities
+string[] componentSuggestions
}
ThinkingPlan --> ExpertReasoning : "optional"
ThinkingPlan --> RequirementBreakdown : "optional"
```

**Diagram sources**
- [lib/validation/schemas.ts:65-97](file://lib/validation/schemas.ts#L65-L97)
- [lib/validation/schemas.ts:48-61](file://lib/validation/schemas.ts#L48-L61)
- [lib/validation/schemas.ts:81-91](file://lib/validation/schemas.ts#L81-L91)

**Section sources**
- [lib/validation/schemas.ts:65-97](file://lib/validation/schemas.ts#L65-L97)

### UI Panel: ThinkingPanel
Renders the plan with:
- Intent badge and header
- What I Understood summary
- Execution mode indicator
- Collapsible Planned Approach
- Collapsible Affected Scope
- Requirement Breakdown (when present)
- Clarification opportunities with inline answer input
- Action buttons: Proceed, Refine, Regenerate Plan, Skip Plan

Accessibility and UX:
- Uses semantic roles and labels for screen readers
- Provides expand/collapse controls for sections
- Supports keyboard navigation and inline clarifications

```mermaid
flowchart TD
Load["Loading State"] --> |isLoading=true| Skeleton["Render skeleton"]
Plan["Plan Available"] --> |isLoading=false| Sections["Render sections:<br/>- Summary<br/>- Execution Mode<br/>- Planned Approach<br/>- Affected Scope<br/>- Requirement Breakdown<br/>- Clarifications"]
Sections --> Actions["Render Actions:<br/>- Proceed<br/>- Refine<br/>- Regenerate<br/>- Skip"]
```

**Diagram sources**
- [components/ThinkingPanel.tsx:15-358](file://components/ThinkingPanel.tsx#L15-L358)

**Section sources**
- [components/ThinkingPanel.tsx:128-358](file://components/ThinkingPanel.tsx#L128-L358)

### AI Adapters: OpenAI and Provider Registry
Provider-specific integrations handle:
- Parameter normalization for reasoning models (e.g., o1/o3 series)
- Streaming and non-streaming generation
- Usage accounting and error handling
- Constraints for response_format, tools, and max tokens
- Caching and metrics collection for performance optimization

OpenAI adapter specifics:
- Detects reasoning models and adapts parameters accordingly
- Merges system messages into the first user message for models that disallow system role
- Applies provider-specific caps for max tokens and response_format

Provider registry and caching:
- Centralized adapter factory with credential resolution
- Caching layer for improved performance and reduced latency
- Metrics collection for usage tracking and cost estimation
- Support for multiple providers (OpenAI, Google, Groq)

```mermaid
classDiagram
class OpenAIAdapter {
+generate(options) GenerateResult
+stream(options) AsyncGenerator
-isReasoningModel(model) boolean
-effectiveBaseURL string
-isAggregator boolean
-isHuggingFace boolean
}
class AdapterFactory {
+getWorkspaceAdapter(provider, model, workspace, user) AIAdapter
+detectProvider(model) ProviderName
+resolveModelName(model) string
}
class CachedAdapter {
+generate(options) GenerateResult
+stream(options) AsyncGenerator
-provider ProviderName
}
class CacheProvider {
+get(key) string
+set(key, value, ttl) void
}
AdapterFactory --> OpenAIAdapter : "creates"
AdapterFactory --> CachedAdapter : "wraps"
CachedAdapter --> CacheProvider : "uses"
```

**Diagram sources**
- [lib/ai/adapters/openai.ts:36-218](file://lib/ai/adapters/openai.ts#L36-L218)
- [lib/ai/adapters/index.ts:135-256](file://lib/ai/adapters/index.ts#L135-L256)
- [lib/ai/cache.ts:18-141](file://lib/ai/cache.ts#L18-L141)

**Section sources**
- [lib/ai/adapters/openai.ts:36-218](file://lib/ai/adapters/openai.ts#L36-L218)
- [lib/ai/adapters/index.ts:135-256](file://lib/ai/adapters/index.ts#L135-L256)
- [lib/ai/cache.ts:18-141](file://lib/ai/cache.ts#L18-L141)
- [lib/ai/metrics.ts:17-89](file://lib/ai/metrics.ts#L17-L89)

### Planning Engine: Thinking Engine Core
The core planning logic that generates structured thinking plans:
- System prompt defines expert UI thinking framework with enhanced reasoning capabilities
- JSON repair utility handles truncated responses from local models
- Fallback plan builder creates deterministic plans when AI fails
- Blueprint integration for UI structure enrichment
- Streamlined retry logic for network and rate limit errors with exponential backoff
- Model capability detection for JSON mode support
- 30-second timeout for request processing to prevent resource exhaustion
- **Enhanced** Intelligent depth_ui mode detection using sophisticated keyword matching
- **Enhanced** Advanced JSON extraction algorithm with five-stage parsing including balanced brace matching and preamble stripping

Key features:
- Expert reasoning framework with 8 contextual dimensions
- Prompt understanding enrichment with likely sections
- Deterministic fallback generation for reliability
- **Enhanced** Multi-stage JSON extraction with five stages for robust parsing:
  - Stage 1: Direct JSON parsing for cloud models
  - Stage 2: Markdown fence extraction for deepseek-coder
  - Stage 3: First {...} block extraction with balanced brace matching
  - Stage 4: Truncated JSON repair with delimiter counting
  - **Enhanced** Stage 5: Common LLM preamble stripping with balanced brace matching
- Provider fallback mechanisms when user-selected provider fails
- Exponential backoff retry mechanism (up to 3 attempts) for transient network errors and rate limits
- Comprehensive error categorization and logging
- **Enhanced** Keyword-based depth_ui detection with patterns like parallax, depth, cinematic, floating, layered, immersive, 3d, landing page, hero section
- **Enhanced** Increased maxTokens from 800 to 1200 for expert-level reasoning capabilities

**Updated** The Thinking Engine now features enhanced depth_ui mode detection with sophisticated keyword matching for immersive UI requests, improved execution mode suggestion logic, comprehensive depth_ui schema validation, and an advanced JSON extraction algorithm with five-stage parsing including balanced brace matching and preamble stripping functionality. The maximum token limit has been increased from 800 to 1200 to support expert-level reasoning capabilities.

**Section sources**
- [lib/ai/thinkingEngine.ts:11-64](file://lib/ai/thinkingEngine.ts#L11-L64)
- [lib/ai/thinkingEngine.ts:66-114](file://lib/ai/thinkingEngine.ts#L66-L114)
- [lib/ai/thinkingEngine.ts:117-157](file://lib/ai/thinkingEngine.ts#L117-L157)
- [lib/ai/thinkingEngine.ts:281-287](file://lib/ai/thinkingEngine.ts#L281-L287)
- [lib/ai/thinkingEngine.ts:325-509](file://lib/ai/thinkingEngine.ts#L325-L509)

### Intent Classifier: Enhanced Mode Detection
The intent classification system now includes sophisticated depth_ui detection:
- Classifies user intent with enhanced keyword matching for immersive UI requests
- Detects multi-component prompts for app mode suggestions
- **Enhanced** Detects depth/parallax/immersive prompts for depth_ui mode suggestions
- Provides intelligent fallback mechanisms when LLM classification fails

Detection Logic:
- Component indicators: Keywords like build, create, design, make (2+ suggests app mode)
- **Enhanced** Depth indicators: Keywords like parallax, depth, cinematic, floating, layered, immersive, 3d, landing page, hero section (2+ suggests depth_ui mode)
- Default to component mode when neither condition is met

```mermaid
flowchart TD
Input["User Input"] --> Keywords["Extract Keywords"]
Keywords --> ComponentCheck{"Component Indicators ≥ 2?"}
ComponentCheck --> |Yes| AppMode["Suggest App Mode"]
ComponentCheck --> |No| DepthCheck{"Depth Indicators ≥ 2?"}
DepthCheck --> |Yes| DepthMode["Suggest Depth UI Mode"]
DepthCheck --> |No| ComponentMode["Suggest Component Mode"]
```

**Diagram sources**
- [lib/ai/intentClassifier.ts:87-90](file://lib/ai/intentClassifier.ts#L87-L90)

**Section sources**
- [lib/ai/intentClassifier.ts:87-90](file://lib/ai/intentClassifier.ts#L87-L90)

### Depth UI Schema Validation
Comprehensive schema validation for depth_ui mode:
- Motion design specifications with premium, immersive, and minimal motion styles
- Parallax coefficient definitions with deterministic layer speed factors
- Depth UI preset configurations for consistent generation
- Color scheme definitions optimized for immersive experiences

**Enhanced** The depth_ui schema now includes comprehensive validation for immersive UI generation with deterministic parallax coefficients and motion specifications.

**Section sources**
- [lib/validation/schemas.ts:192-258](file://lib/validation/schemas.ts#L192-L258)

### UI Components: Depth UI Mode Support
Frontend components supporting depth_ui mode:
- ModeToggle component with visual indicators for depth_ui mode
- GenerationMode type definition supporting component, app, and depth_ui modes
- Enhanced UI hints for depth_ui mode users
- Visual feedback for immersive UI generation

**Enhanced** The UI components now include depth_ui mode support with visual indicators and specialized hints for immersive UI generation.

**Section sources**
- [components/prompt-input/ModeToggle.tsx:100-109](file://components/prompt-input/ModeToggle.tsx#L100-L109)
- [components/prompt-input/types.ts:8](file://components/prompt-input/types.ts#L8)

### Authentication and Authorization
- Uses NextAuth with a credentials provider and bcrypt-based password verification
- Stores a hashed access password in environment variables
- Exposes auth(), handlers, signIn, and signOut for session management
- The /api/think endpoint retrieves user ID from the session for request attribution

Security highlights:
- Enforces that clients send only provider and model identifiers
- Never accepts apiKey or baseUrl from the client
- Uses JWT-based session strategy with a configurable max age

**Section sources**
- [lib/auth.ts:11-87](file://lib/auth.ts#L11-L87)
- [app/api/think/route.ts:36-44](file://app/api/think/route.ts#L36-L44)

### Logging and Observability
- Structured logging with request-scoped logger creation
- Tracks endpoint, request ID, duration, and optional metadata
- Supports info, warn, error, and debug levels
- Logs request lifecycle events and errors for diagnostics

**Section sources**
- [lib/logger.ts:23-85](file://lib/logger.ts#L23-L85)
- [app/api/think/route.ts:8-86](file://app/api/think/route.ts#L8-L86)

## Dependency Analysis
The Thinking Engine exhibits strong separation of concerns:
- The API route depends on authentication, logging, and validation schemas
- The planning orchestration depends on AI adapters and provider configurations
- The UI panel depends on the ThinkingPlan schema and intent configuration
- Adapters depend on provider-specific constraints and SDKs
- The planning engine depends on validation schemas and intelligence modules
- **Enhanced** The intent classifier depends on keyword matching algorithms and depth_ui detection logic

```mermaid
graph LR
API["app/api/think/route.ts"] --> AUTH["lib/auth.ts"]
API --> LOG["lib/logger.ts"]
API --> SCHEMAS["lib/validation/schemas.ts"]
API --> THINK["lib/ai/thinkingEngine.ts"]
THINK --> ADAPTERS["lib/ai/adapters/index.ts"]
ADAPTERS --> OPENAI["lib/ai/adapters/openai.ts"]
ADAPTERS --> BASE["lib/ai/adapters/base.ts"]
ADAPTERS --> CACHE["lib/ai/cache.ts"]
ADAPTERS --> METRICS["lib/ai/metrics.ts"]
TP["components/ThinkingPanel.tsx"] --> SCHEMAS
MT["ModeToggle.tsx"] --> TYPES["types.ts"]
CLASS["lib/ai/intentClassifier.ts"] --> PROMPTS["lib/ai/prompts.ts"]
```

**Updated** The Thinking Engine now features enhanced dependency management with sophisticated depth_ui detection and comprehensive schema validation for immersive UI generation.

**Diagram sources**
- [app/api/think/route.ts:1-86](file://app/api/think/route.ts#L1-L86)
- [lib/auth.ts:1-87](file://lib/auth.ts#L1-L87)
- [lib/logger.ts:1-89](file://lib/logger.ts#L1-L89)
- [lib/validation/schemas.ts:1-340](file://lib/validation/schemas.ts#L1-L340)
- [lib/ai/adapters/index.ts:1-282](file://lib/ai/adapters/index.ts#L1-L282)
- [lib/ai/adapters/openai.ts:1-218](file://lib/ai/adapters/openai.ts#L1-L218)
- [lib/ai/cache.ts:1-141](file://lib/ai/cache.ts#L1-L141)
- [lib/ai/metrics.ts:1-89](file://lib/ai/metrics.ts#L1-L89)
- [components/ThinkingPanel.tsx:1-358](file://components/ThinkingPanel.tsx#L1-L358)
- [components/prompt-input/ModeToggle.tsx:1-120](file://components/prompt-input/ModeToggle.tsx#L1-L120)
- [components/prompt-input/types.ts:1-53](file://components/prompt-input/types.ts#L1-L53)
- [lib/ai/thinkingEngine.ts:1-509](file://lib/ai/thinkingEngine.ts#L1-L509)
- [lib/ai/intentClassifier.ts:1-255](file://lib/ai/intentClassifier.ts#L1-L255)
- [lib/ai/prompts.ts:347-450](file://lib/ai/prompts.ts#L347-L450)

**Section sources**
- [package.json:13-44](file://package.json#L13-L44)

## Performance Considerations
- Token limits: Adapters apply provider-specific caps to prevent API errors and reduce latency spikes
- Streaming vs non-streaming: Choose streaming for long-form generation to improve perceived responsiveness
- Cost estimation: Use the pricing utilities to estimate costs based on prompt and completion tokens
- Caching: Intelligent caching layer reduces latency and improves response times for repeated requests
- Concurrency: Ensure adapters are instantiated once per provider to reuse connections and minimize overhead
- Retry logic: Streamlined exponential backoff for network errors and rate limits (up to 3 attempts with 1s, 2s, and 4s delays)
- Timeout handling: 30-second timeout for thinking requests prevents resource exhaustion
- **Enhanced** JSON parsing: Five-stage extraction with balanced brace matching reduces parsing failures and improves reliability
- Error handling: Enhanced patterns for graceful degradation and fallback mechanisms
- Metrics collection: Centralized metrics tracking for performance monitoring and optimization
- **Enhanced** Keyword matching optimization: Efficient regex-based depth_ui detection reduces computational overhead
- **Enhanced** Schema validation caching: Reused depth_ui schema validation reduces parsing overhead for immersive UI requests
- **Enhanced** Token budget optimization: Increased maxTokens from 800 to 1200 supports expert-level reasoning while maintaining performance

**Updated** Enhanced performance considerations now include depth_ui keyword matching optimization, schema validation caching, comprehensive metrics collection for immersive UI generation, and five-stage JSON extraction with balanced brace matching for improved reliability.

## Troubleshooting Guide
Common issues and resolutions:
- Invalid JSON or missing fields: Verify the request body includes prompt and intentType as strings
- Authentication failures: Confirm the session is established and user ID is present
- Provider configuration errors: Ensure the selected provider and model are supported and properly configured
- API key or base URL exposure attempts: The endpoint rejects apiKey and baseUrl from the client; use server-side configuration
- Adapter-specific errors: Check provider-specific constraints (e.g., reasoning models, response_format) and adjust parameters accordingly
- Planning failures: The system automatically falls back to deterministic plans when AI generation fails
- Network connectivity: Streamlined retry logic handles transient network errors and rate limits with exponential backoff (up to 3 attempts)
- Rate limiting: Automatic retry mechanism with exponential backoff reduces impact of provider rate limits
- Timeout issues: 30-second timeout for thinking requests prevents resource exhaustion
- Caching issues: Verify cache configuration and check for cache hit/miss ratios
- Metrics collection: Monitor usage logs and cost estimates for optimization opportunities
- **Enhanced** Depth UI detection failures: Verify keyword matching patterns and ensure depth_ui mode is properly configured
- **Enhanced** Schema validation errors: Check depth_ui schema compliance and validate parallax coefficient ranges
- **Enhanced** JSON extraction failures: Review the five-stage parsing algorithm and verify balanced brace matching is working correctly
- **Enhanced** Token limit issues: Verify maxTokens setting is appropriate for the model and consider increasing beyond 1200 for complex reasoning tasks

Operational checks:
- Review structured logs for request IDs and durations
- Monitor fallback plan usage to identify planning failures
- Validate schema compliance for ThinkingPlan and intent classifications
- Check provider quotas and rate limits for API failures
- Observe retry patterns in logs for transient error handling effectiveness
- Analyze cache performance and hit rates for optimization
- **Enhanced** Monitor depth_ui keyword detection accuracy and mode suggestion effectiveness
- **Enhanced** Validate depth_ui schema parsing and parallax coefficient validation
- **Enhanced** Verify five-stage JSON extraction algorithm is functioning correctly with balanced brace matching

**Updated** Enhanced troubleshooting guidance now includes depth_ui detection monitoring, schema validation troubleshooting, comprehensive metrics analysis for immersive UI generation, and five-stage JSON extraction algorithm validation with balanced brace matching.

**Section sources**
- [app/api/think/route.ts:19-21](file://app/api/think/route.ts#L19-L21)
- [lib/logger.ts:66-85](file://lib/logger.ts#L66-L85)
- [lib/ai/adapters/openai.ts:98-126](file://lib/ai/adapters/openai.ts#L98-L126)
- [lib/ai/thinkingEngine.ts:389-437](file://lib/ai/thinkingEngine.ts#L389-L437)
- [lib/ai/cache.ts:108-141](file://lib/ai/cache.ts#L108-L141)
- [lib/ai/metrics.ts:36-89](file://lib/ai/metrics.ts#L36-L89)
- [lib/ai/intentClassifier.ts:87-90](file://lib/ai/intentClassifier.ts#L87-L90)

## Conclusion
The Thinking Engine provides a robust, secure, and user-friendly planning layer for AI-driven UI generation. By enforcing strict security boundaries, offering deterministic fallbacks with streamlined retry logic, and presenting a clear, iteratively refineable plan, it enables reliable workflows from initial intent to executable code. Its modular architecture with provider adapters and structured validation supports extensibility and maintainability across diverse AI backends. The enhanced retry mechanisms with exponential backoff and improved error handling patterns ensure resilience against network failures and rate limits, while caching optimizations and comprehensive metrics collection enhance performance and reduce cold-start latency. The streamlined architecture with over 150 lines of code removed demonstrates significant improvements in decision-making process efficiency and overall system reliability.

**Updated** The Thinking Engine now features enhanced depth_ui mode detection with sophisticated keyword matching for immersive UI requests, improved execution mode suggestion logic, comprehensive schema validation, integrated depth_ui support throughout the architecture, and an advanced JSON extraction algorithm with five-stage parsing including balanced brace matching and preamble stripping functionality. These enhancements make it more reliable, efficient, and capable of handling visually rich interfaces with intelligent detection and generation capabilities. The increased maximum token limit from 800 to 1200 supports expert-level reasoning capabilities while maintaining the system's robustness and performance.