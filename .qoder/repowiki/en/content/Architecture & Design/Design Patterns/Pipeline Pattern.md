# Pipeline Pattern

<cite>
**Referenced Files in This Document**
- [app/page.tsx](file://app/page.tsx)
- [app/api/generate/route.ts](file://app/api/generate/route.ts)
- [lib/ai/tieredPipeline.ts](file://lib/ai/tieredPipeline.ts)
- [lib/ai/componentGenerator.ts](file://lib/ai/componentGenerator.ts)
- [lib/ai/modelRegistry.ts](file://lib/ai/modelRegistry.ts)
- [lib/ai/prompts.ts](file://lib/ai/prompts.ts)
- [lib/ai/cache.ts](file://lib/ai/cache.ts)
- [lib/ai/adapters/index.ts](file://lib/ai/adapters/index.ts)
- [app/api/chunk/route.ts](file://app/api/chunk/route.ts)
- [app/api/parse/route.ts](file://app/api/parse/route.ts)
- [components/PipelineStatus.tsx](file://components/PipelineStatus.tsx)
- [lib/ai/vectorStore.ts](file://lib/ai/vectorStore.ts)
- [lib/ai/uiReviewer.ts](file://lib/ai/uiReviewer.ts)
</cite>

## Update Summary
**Changes Made**
- Updated Expert Review and AI Repair section to remove references to 60-second aggregate timeout and vision review workflows
- Revised Performance Considerations to reflect new conditional execution logic and simplified review system
- Updated architecture diagrams to remove vision review components
- Clarified that the review system now uses simpler conditional execution without browserless rendering

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
This document explains the Pipeline Pattern implementation that orchestrates the multi-stage generation workflow. The system converts natural language intents into production-ready, accessible React components through a tiered pipeline architecture. It covers sequential stages (intent classification, component generation, expert review, and AI repair), flow control, stage validation, error propagation, streaming architecture for real-time feedback, configuration and customization of pipeline tiers, consistency across generation tiers, and performance optimizations via parallelization and caching.

## Project Structure
The generation pipeline spans both client and server layers:
- Client orchestrator triggers the pipeline and renders progress.
- Server routes implement the stages and orchestrate model adapters and validators.
- Shared libraries define pipeline tiers, model capabilities, prompts, and caching.

```mermaid
graph TB
subgraph "Client"
UI["React UI<br/>app/page.tsx"]
Status["PipelineStatus.tsx"]
end
subgraph "Server Routes"
Parse["/api/parse<br/>app/api/parse/route.ts"]
Gen["/api/generate<br/>app/api/generate/route.ts"]
Chunk["/api/chunk<br/>app/api/chunk/route.ts"]
end
subgraph "Shared Libraries"
Tier["tieredPipeline.ts"]
CG["componentGenerator.ts"]
MR["modelRegistry.ts"]
PR["prompts.ts"]
Cache["cache.ts"]
Adapter["adapters/index.ts"]
Vec["vectorStore.ts"]
Review["uiReviewer.ts"]
end
UI --> Parse
Parse --> Gen
UI --> Chunk
Gen --> CG
CG --> Tier
CG --> MR
CG --> PR
CG --> Adapter
CG --> Cache
CG --> Vec
CG --> Review
UI --> Status
```

**Diagram sources**
- [app/page.tsx:166-310](file://app/page.tsx#L166-L310)
- [app/api/parse/route.ts:11-129](file://app/api/parse/route.ts#L11-L129)
- [app/api/generate/route.ts:25-440](file://app/api/generate/route.ts#L25-L440)
- [app/api/chunk/route.ts:8-81](file://app/api/chunk/route.ts#L8-L81)
- [lib/ai/tieredPipeline.ts:32-235](file://lib/ai/tieredPipeline.ts#L32-L235)
- [lib/ai/componentGenerator.ts:60-200](file://lib/ai/componentGenerator.ts#L60-L200)
- [lib/ai/modelRegistry.ts:132-200](file://lib/ai/modelRegistry.ts#L132-L200)
- [lib/ai/prompts.ts:1-200](file://lib/ai/prompts.ts#L1-L200)
- [lib/ai/cache.ts:108-113](file://lib/ai/cache.ts#L108-L113)
- [lib/ai/adapters/index.ts:78-125](file://lib/ai/adapters/index.ts#L78-L125)
- [lib/ai/vectorStore.ts:124-155](file://lib/ai/vectorStore.ts#L124-L155)
- [lib/ai/uiReviewer.ts:1-199](file://lib/ai/uiReviewer.ts#L1-L199)

**Section sources**
- [app/page.tsx:166-310](file://app/page.tsx#L166-L310)
- [app/api/parse/route.ts:11-129](file://app/api/parse/route.ts#L11-L129)
- [app/api/generate/route.ts:25-440](file://app/api/generate/route.ts#L25-L440)
- [app/api/chunk/route.ts:8-81](file://app/api/chunk/route.ts#L8-L81)
- [lib/ai/tieredPipeline.ts:32-235](file://lib/ai/tieredPipeline.ts#L32-L235)
- [lib/ai/componentGenerator.ts:60-200](file://lib/ai/componentGenerator.ts#L60-L200)
- [lib/ai/modelRegistry.ts:132-200](file://lib/ai/modelRegistry.ts#L132-L200)
- [lib/ai/prompts.ts:1-200](file://lib/ai/prompts.ts#L1-L200)
- [lib/ai/cache.ts:108-113](file://lib/ai/cache.ts#L108-L113)
- [lib/ai/adapters/index.ts:78-125](file://lib/ai/adapters/index.ts#L78-L125)
- [lib/ai/vectorStore.ts:124-155](file://lib/ai/vectorStore.ts#L124-L155)
- [lib/ai/uiReviewer.ts:1-199](file://lib/ai/uiReviewer.ts#L1-L199)

## Core Components
- Pipeline orchestration and UI:
  - Client orchestrator coordinates intent parsing, generation, validation, testing, and preview.
  - PipelineStatus displays the current stage and error handling.
- Server-side pipeline stages:
  - Intent parsing, component generation, expert review, accessibility validation, test generation, and persistence.
- Tiered pipeline configuration:
  - Model capability profiles drive prompt style, token budgets, tool rounds, streaming, timeouts, and repair strategies.
- Caching and streaming:
  - Adapter caching and SSE streaming enable performance and real-time feedback.

**Section sources**
- [app/page.tsx:166-310](file://app/page.tsx#L166-L310)
- [components/PipelineStatus.tsx:10-75](file://components/PipelineStatus.tsx#L10-L75)
- [app/api/generate/route.ts:25-440](file://app/api/generate/route.ts#L25-L440)
- [lib/ai/tieredPipeline.ts:32-235](file://lib/ai/tieredPipeline.ts#L32-L235)

## Architecture Overview
The pipeline follows a staged, model-agnostic flow:
- Intent classification and parsing produce a structured UI intent.
- Component generation uses a model-aware pipeline with configurable tiers.
- Expert review and AI repair improve quality and stability.
- Accessibility validation and test generation ensure correctness and testability.
- Parallel processing accelerates independent tasks.
- Streaming enables real-time feedback for long-running generations.

```mermaid
sequenceDiagram
participant Client as "Client UI"
participant Parse as "Parse Route"
participant Gen as "Generate Route"
participant CG as "ComponentGenerator"
participant Tier as "TieredPipeline"
participant MR as "ModelRegistry"
participant Prompt as "Prompts"
participant Adapter as "Adapter"
participant Cache as "Cache"
participant Vec as "VectorStore"
participant Review as "UIReviewer"
Client->>Parse : POST /api/parse
Parse-->>Client : { success, intent }
Client->>Gen : POST /api/generate { intent, mode, ... }
Gen->>CG : generateComponent(intent, mode, ...)
CG->>MR : getModelProfile()/getCloudFallbackProfile()
CG->>Tier : getPipelineConfig(profile)
CG->>Prompt : buildModelAwarePrompt(...)
CG->>Adapter : generate()/stream()
Adapter->>Cache : get()/set() for caching
CG->>Vec : upsertComponentEmbedding(...) (repair patterns)
Gen->>Review : reviewGeneratedCode()/repairGeneratedCode()
Gen-->>Client : { code, a11yReport, tests, generationId }
```

**Diagram sources**
- [app/page.tsx:166-310](file://app/page.tsx#L166-L310)
- [app/api/parse/route.ts:11-129](file://app/api/parse/route.ts#L11-L129)
- [app/api/generate/route.ts:25-440](file://app/api/generate/route.ts#L25-L440)
- [lib/ai/componentGenerator.ts:60-200](file://lib/ai/componentGenerator.ts#L60-L200)
- [lib/ai/tieredPipeline.ts:191-235](file://lib/ai/tieredPipeline.ts#L191-L235)
- [lib/ai/modelRegistry.ts:132-200](file://lib/ai/modelRegistry.ts#L132-L200)
- [lib/ai/prompts.ts:141-170](file://lib/ai/prompts.ts#L141-L170)
- [lib/ai/adapters/index.ts:78-125](file://lib/ai/adapters/index.ts#L78-L125)
- [lib/ai/cache.ts:108-113](file://lib/ai/cache.ts#L108-L113)
- [lib/ai/vectorStore.ts:124-155](file://lib/ai/vectorStore.ts#L124-L155)
- [lib/ai/uiReviewer.ts:58-126](file://lib/ai/uiReviewer.ts#L58-L126)

## Detailed Component Analysis

### Client Orchestration and Stage Flow
- The client orchestrator:
  - Sets stage and pipeline step markers.
  - Calls /api/parse to convert natural language to a structured intent.
  - Executes /api/generate for component generation or /api/chunk for app-mode file chunks.
  - Updates stages for validating, testing, and completion.
  - Persists project and records generation metadata.

```mermaid
flowchart TD
Start(["User submits prompt"]) --> Classify["Intent Classification"]
Classify --> Think["Thinking Phase"]
Think --> Parse["Parse Intent (/api/parse)"]
Parse --> Mode{"Is app mode?"}
Mode --> |Yes| Manifest["Build manifest (/api/manifest)"]
Manifest --> Chunks["Generate files via /api/chunk"]
Chunks --> Validate["Validation Stage"]
Validate --> Test["Test Generation Stage"]
Test --> Complete["Complete"]
Mode --> |No| Generate["Generate Component (/api/generate)"]
Generate --> Validate
Validate --> Test
Test --> Complete
```

**Diagram sources**
- [app/page.tsx:166-310](file://app/page.tsx#L166-L310)
- [app/api/parse/route.ts:11-129](file://app/api/parse/route.ts#L11-L129)
- [app/api/chunk/route.ts:8-81](file://app/api/chunk/route.ts#L8-L81)
- [app/api/generate/route.ts:25-440](file://app/api/generate/route.ts#L25-L440)

**Section sources**
- [app/page.tsx:166-310](file://app/page.tsx#L166-L310)

### Tiered Pipeline Configuration and Stage Customization
- PipelineConfig defines:
  - Prompt style, blueprint token budget, locked imports, output wrapper, and system prompt merging.
  - Generation parameters: temperature, max output tokens, tool rounds, JSON mode, streaming, timeout.
  - Post-processing: extraction strategy, repair strategy, repair model id, and system prompt token limits.
- getPipelineConfig derives a full configuration from a model capability profile, overriding tier defaults with profile-specific values.
- Tiers:
  - tiny: fill-in-blank, temp 0.0, no tools, aggressive extraction, ai-cheap repair.
  - small: structured template, temp 0.15, no tools, rules-only repair.
  - medium: guided freeform, temp 0.25, no tools, rules-only repair.
  - large: light guidance, temp 0.4, no tools, rules-only repair.
  - cloud: full freeform, temp 0.55+, no tools, rules-only repair.

```mermaid
classDiagram
class PipelineConfig {
+tier
+promptStyle
+blueprintTokenBudget
+injectLockedImports
+injectOutputWrapper
+mergeSystemIntoUser
+temperature
+maxOutputTokens
+maxToolRounds
+useJsonMode
+useStreaming
+timeoutMs
+extractionStrategy
+repairStrategy
+repairModelId
+maxSystemPromptTokens
}
class ModelCapabilityProfile {
+id
+displayName
+provider
+tier
+contextWindow
+maxOutputTokens
+idealTemperature
+supportsSystemPrompt
+supportsToolCalls
+supportsJsonMode
+streamingReliable
+strengths[]
+weaknesses[]
+promptStrategy
+maxBlueprintTokens
+needsExplicitImports
+needsOutputWrapper
+extractionStrategy
+repairPriority
+timeoutMs
}
PipelineConfig <.. ModelCapabilityProfile : "derived from"
```

**Diagram sources**
- [lib/ai/tieredPipeline.ts:32-84](file://lib/ai/tieredPipeline.ts#L32-L84)
- [lib/ai/tieredPipeline.ts:191-235](file://lib/ai/tieredPipeline.ts#L191-L235)
- [lib/ai/modelRegistry.ts:69-128](file://lib/ai/modelRegistry.ts#L69-L128)

**Section sources**
- [lib/ai/tieredPipeline.ts:32-235](file://lib/ai/tieredPipeline.ts#L32-L235)
- [lib/ai/modelRegistry.ts:132-200](file://lib/ai/modelRegistry.ts#L132-L200)

### Expert Review and AI Repair
- The expert review and repair phase:
  - Uses conditional execution logic to determine when to run review/repair.
  - Skips for free-tier providers (Google without paid key) to conserve API quota.
  - Runs review for paid providers or when a dedicated REVIEW_MODEL is configured.
  - Performs text-based review and repair instructions when critiques fail.
  - Logs review data and persists repair patterns as embeddings for reuse.

**Updated** Removed references to 60-second aggregate timeout mechanism and vision review workflows. The system now uses simpler conditional execution logic without complex timeout management.

```mermaid
flowchart TD
Start(["After generation"]) --> FreeTier{"Free-tier provider?"}
FreeTier --> |Yes| Skip["Skip review/repair"]
FreeTier --> |No| Review["Run UI Review"]
Review --> Passed{"Review passed?"}
Passed --> |Yes| Done["Proceed"]
Passed --> |No| Repair["Repair with instructions"]
Repair --> Done
Skip --> Done
```

**Diagram sources**
- [app/api/generate/route.ts:209-260](file://app/api/generate/route.ts#L209-L260)
- [lib/ai/uiReviewer.ts:58-126](file://lib/ai/uiReviewer.ts#L58-L126)

**Section sources**
- [app/api/generate/route.ts:209-260](file://app/api/generate/route.ts#L209-L260)
- [lib/ai/uiReviewer.ts:58-126](file://lib/ai/uiReviewer.ts#L58-L126)

### Accessibility Validation and Test Generation
- Parallel execution:
  - Accessibility validation and test generation run concurrently after generation.
  - A11y validation applies auto-repairs when violations are found and re-validates.
  - Test generation uses the final code for speed, as repairs are typically minor.
- Dependency resolution:
  - For multi-file outputs, merges A11y-repaired code back into the file map before applying patches.

```mermaid
flowchart TD
Gen["Final code"] --> A11y["Validate Accessibility"]
Gen --> Tests["Generate Tests"]
A11y --> A11yOK{"Passed?"}
A11yOK --> |No| AutoRepair["Auto-repair A11y"]
AutoRepair --> Reval["Re-validate"]
A11yOK --> |Yes| Merge["Merge into file map (app mode)"]
Tests --> Merge
Merge --> Patch["Resolve and Patch Dependencies"]
Patch --> Done["Return results"]
```

**Diagram sources**
- [app/api/generate/route.ts:275-300](file://app/api/generate/route.ts#L275-L300)

**Section sources**
- [app/api/generate/route.ts:275-300](file://app/api/generate/route.ts#L275-L300)

### Streaming Architecture and Real-Time Feedback
- Streaming:
  - The generate route supports SSE streaming for long-running model calls.
  - The adapter wrapper caches and streams responses, yielding chunks with usage metrics.
- Client-side progress:
  - PipelineStatus displays active, pending, and completed stages.
  - The orchestrator advances stages with deliberate delays to reflect validation/testing.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Gen as "Generate Route"
participant Adapter as "Adapter"
participant Cache as "Cache"
Client->>Gen : POST with stream=true
Gen->>Adapter : stream(messages, maxTokens)
Adapter->>Cache : get(stream : <key>)
alt Cache hit
Cache-->>Adapter : chunks[]
Adapter-->>Gen : yield cached chunks
else Cache miss
Adapter-->>Gen : yield live chunks
Adapter->>Cache : set(stream : <key>, chunks)
end
Gen-->>Client : SSE stream
```

**Diagram sources**
- [app/api/generate/route.ts:55-96](file://app/api/generate/route.ts#L55-L96)
- [lib/ai/adapters/index.ts:108-137](file://lib/ai/adapters/index.ts#L108-L137)
- [lib/ai/cache.ts:108-113](file://lib/ai/cache.ts#L108-L113)

**Section sources**
- [app/api/generate/route.ts:55-96](file://app/api/generate/route.ts#L55-L96)
- [lib/ai/adapters/index.ts:108-137](file://lib/ai/adapters/index.ts#L108-L137)
- [lib/ai/cache.ts:108-113](file://lib/ai/cache.ts#L108-L113)
- [components/PipelineStatus.tsx:77-162](file://components/PipelineStatus.tsx#L77-L162)

### Consistency Across Generation Tiers
- ModelRegistry centralizes capability metadata to ensure consistent behavior across tiers.
- getPipelineConfig enforces profile-specific overrides for prompt style, token budgets, streaming reliability, and repair strategies.
- ComponentGenerator composes prompts and applies deterministic beautification and validation regardless of tier.

**Section sources**
- [lib/ai/modelRegistry.ts:132-200](file://lib/ai/modelRegistry.ts#L132-L200)
- [lib/ai/tieredPipeline.ts:191-235](file://lib/ai/tieredPipeline.ts#L191-L235)
- [lib/ai/componentGenerator.ts:60-200](file://lib/ai/componentGenerator.ts#L60-L200)

## Dependency Analysis
- Client depends on server routes for parsing and generation.
- Generate route depends on component generator, validators, reviewers, and persistence.
- Component generator depends on tiered pipeline, model registry, prompts, adapters, cache, and vector store.
- UI reviewer provides expert critique and repair services.

```mermaid
graph LR
Client["app/page.tsx"] --> Parse["app/api/parse/route.ts"]
Client --> Gen["app/api/generate/route.ts"]
Gen --> CG["lib/ai/componentGenerator.ts"]
CG --> Tier["lib/ai/tieredPipeline.ts"]
CG --> MR["lib/ai/modelRegistry.ts"]
CG --> PR["lib/ai/prompts.ts"]
CG --> Adapter["lib/ai/adapters/index.ts"]
CG --> Cache["lib/ai/cache.ts"]
CG --> Vec["lib/ai/vectorStore.ts"]
CG --> Review["lib/ai/uiReviewer.ts"]
```

**Diagram sources**
- [app/page.tsx:166-310](file://app/page.tsx#L166-L310)
- [app/api/parse/route.ts:11-129](file://app/api/parse/route.ts#L11-L129)
- [app/api/generate/route.ts:25-440](file://app/api/generate/route.ts#L25-L440)
- [lib/ai/componentGenerator.ts:60-200](file://lib/ai/componentGenerator.ts#L60-L200)
- [lib/ai/tieredPipeline.ts:32-235](file://lib/ai/tieredPipeline.ts#L32-L235)
- [lib/ai/modelRegistry.ts:132-200](file://lib/ai/modelRegistry.ts#L132-L200)
- [lib/ai/prompts.ts:1-200](file://lib/ai/prompts.ts#L1-L200)
- [lib/ai/adapters/index.ts:78-125](file://lib/ai/adapters/index.ts#L78-L125)
- [lib/ai/cache.ts:108-113](file://lib/ai/cache.ts#L108-L113)
- [lib/ai/vectorStore.ts:124-155](file://lib/ai/vectorStore.ts#L124-L155)
- [lib/ai/uiReviewer.ts:1-199](file://lib/ai/uiReviewer.ts#L1-L199)

**Section sources**
- [app/page.tsx:166-310](file://app/page.tsx#L166-L310)
- [app/api/generate/route.ts:25-440](file://app/api/generate/route.ts#L25-L440)
- [lib/ai/componentGenerator.ts:60-200](file://lib/ai/componentGenerator.ts#L60-L200)

## Performance Considerations
- Parallelization:
  - Accessibility validation and test generation run concurrently to reduce total latency.
- Streaming:
  - SSE streaming provides immediate feedback for long generations; adapter caching reduces repeated computation.
- Caching:
  - Adapter wraps generate/stream calls with pluggable cache (memory or Upstash Redis) to avoid recomputation.
- Tiered optimization:
  - Small/medium/large tiers cap blueprint sizes and disable tool calls to prevent silent 400s and reduce overhead.
- Conditional execution:
  - Review phase is conditionally executed based on provider tier and configuration to conserve API quotas.
  - Free-tier providers (Google without paid key) skip review entirely to avoid quota exhaustion.

**Updated** Removed references to 60-second aggregate timeout mechanism. The system now uses simpler conditional execution logic that skips review for free-tier providers rather than implementing complex timeout management.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Intent parsing failures:
  - The parse route validates input and returns structured errors; client displays them and continues with defaults when classification is unavailable.
- Generation errors:
  - The generate route logs model/provider context and returns 422/500 with error details; client sets error stage and displays messages.
- Session and authorization:
  - PipelineStatus detects unauthorized conditions and offers a sign-in action.
- Streaming issues:
  - Adapter caching and fallbacks ensure resilience; errors are propagated as stream deltas.
- Review system issues:
  - Review engine gracefully falls back to pass when quota is exceeded or provider errors occur.
  - Review is automatically skipped for free-tier providers to prevent quota exhaustion.

**Section sources**
- [app/api/parse/route.ts:11-129](file://app/api/parse/route.ts#L11-L129)
- [app/api/generate/route.ts:25-440](file://app/api/generate/route.ts#L25-L440)
- [components/PipelineStatus.tsx:165-215](file://components/PipelineStatus.tsx#L165-L215)
- [lib/ai/adapters/index.ts:108-137](file://lib/ai/adapters/index.ts#L108-L137)
- [lib/ai/uiReviewer.ts:115-126](file://lib/ai/uiReviewer.ts#L115-L126)

## Conclusion
The Pipeline Pattern implementation delivers a robust, model-agnostic, and performance-conscious generation workflow. By structuring stages, enforcing tiered configurations, leveraging parallelism and streaming, implementing resilient caching and error handling, and using conditional execution logic for review systems, the system consistently produces accessible, validated, and testable UI components across diverse model capabilities and deployment environments. The simplified review system without complex timeout management provides better performance and reliability while maintaining quality standards.