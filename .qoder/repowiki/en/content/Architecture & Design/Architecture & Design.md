# Architecture & Design

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [package.json](file://package.json)
- [next.config.ts](file://next.config.ts)
- [app/layout.tsx](file://app/layout.tsx)
- [lib/prisma.ts](file://lib/prisma.ts)
- [app/api/generate/route.ts](file://app/api/generate/route.ts)
- [app/api/parse/route.ts](file://app/api/parse/route.ts)
- [app/api/think/route.ts](file://app/api/think/route.ts)
- [lib/ai/componentGenerator.ts](file://lib/ai/componentGenerator.ts)
- [lib/validation/a11yValidator.ts](file://lib/validation/a11yValidator.ts)
- [lib/testGenerator.ts](file://lib/testGenerator.ts)
- [lib/ai/memory.ts](file://lib/ai/memory.ts)
</cite>

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
This document describes the architecture and design of an AI-powered, accessibility-first UI engine. The system converts natural language intents into accessible, production-ready React components with live preview, automated accessibility validation (WCAG 2.1 AA), and automated test generation. It emphasizes a layered architecture with clear separation of concerns: presentation, API, business logic, data access, and integration with AI providers. Architectural patterns include Adapter Pattern for AI providers, Pipeline Pattern for multi-stage generation, Factory Pattern for dynamic adapter instantiation, and Observer Pattern for real-time feedback.

## Project Structure
The project is a Next.js application organized by layers and features:
- Presentation Layer: Next.js app directory with pages, components, and providers.
- API Layer: Next.js App Router API handlers under app/api/.
- Business Logic Layer: Orchestrators and validators in lib/ai, lib/validation, and lib/intelligence.
- Data Access Layer: Prisma ORM client and persistence utilities.
- Integration Layer: AI adapters and provider integrations.

```mermaid
graph TB
subgraph "Presentation Layer"
UI["Next.js App Shell<br/>app/layout.tsx"]
Pages["Pages & UI Components<br/>app/*.tsx, components/*.tsx"]
end
subgraph "API Layer"
API_Gen["/api/generate<br/>app/api/generate/route.ts"]
API_Parse["/api/parse<br/>app/api/parse/route.ts"]
API_Think["/api/think<br/>app/api/think/route.ts"]
end
subgraph "Business Logic Layer"
Gen["Component Generator<br/>lib/ai/componentGenerator.ts"]
A11y["Accessibility Validator<br/>lib/validation/a11yValidator.ts"]
Tests["Test Generator<br/>lib/testGenerator.ts"]
Memory["Memory Store<br/>lib/ai/memory.ts"]
end
subgraph "Data Access Layer"
Prisma["Prisma Client<br/>lib/prisma.ts"]
end
subgraph "Integration Layer"
Adapters["AI Adapters<br/>lib/ai/adapters/*"]
end
UI --> Pages
Pages --> API_Gen
Pages --> API_Parse
Pages --> API_Think
API_Gen --> Gen
API_Parse --> Gen
API_Think --> Gen
Gen --> Adapters
Gen --> Memory
API_Gen --> A11y
API_Gen --> Tests
Memory --> Prisma
```

**Diagram sources**
- [app/layout.tsx:1-57](file://app/layout.tsx#L1-L57)
- [app/api/generate/route.ts:1-451](file://app/api/generate/route.ts#L1-L451)
- [app/api/parse/route.ts:1-124](file://app/api/parse/route.ts#L1-L124)
- [app/api/think/route.ts:1-59](file://app/api/think/route.ts#L1-L59)
- [lib/ai/componentGenerator.ts:1-408](file://lib/ai/componentGenerator.ts#L1-L408)
- [lib/validation/a11yValidator.ts:1-376](file://lib/validation/a11yValidator.ts#L1-L376)
- [lib/testGenerator.ts:1-265](file://lib/testGenerator.ts#L1-L265)
- [lib/ai/memory.ts:1-211](file://lib/ai/memory.ts#L1-L211)
- [lib/prisma.ts:1-70](file://lib/prisma.ts#L1-L70)

**Section sources**
- [README.md:1-37](file://README.md#L1-L37)
- [next.config.ts:1-38](file://next.config.ts#L1-L38)
- [app/layout.tsx:1-57](file://app/layout.tsx#L1-L57)

## Core Components
- Presentation Layer
  - Root layout initializes theme, fonts, and providers for sessions and workspaces.
  - UI components render the IDE workspace, panels, and preview.
- API Layer
  - Generation endpoint orchestrates the full pipeline: intent parsing, generation, review, validation, and test generation.
  - Parse endpoint extracts structured intent from natural language.
  - Think endpoint builds reasoning plans aligned with generation.
- Business Logic Layer
  - Component generator encapsulates model-agnostic generation with pipeline stages, tool loops, and extraction.
  - Accessibility validator enforces WCAG 2.1 AA rules and auto-repairs common issues.
  - Test generator produces RTL and Playwright tests based on intent.
  - Memory store persists generation history to the database.
- Data Access Layer
  - Prisma client with singleton and transient error handling for serverless environments.
- Integration Layer
  - AI adapters abstract provider differences and enable dynamic selection.

**Section sources**
- [app/layout.tsx:1-57](file://app/layout.tsx#L1-L57)
- [app/api/generate/route.ts:1-451](file://app/api/generate/route.ts#L1-L451)
- [app/api/parse/route.ts:1-124](file://app/api/parse/route.ts#L1-L124)
- [app/api/think/route.ts:1-59](file://app/api/think/route.ts#L1-L59)
- [lib/ai/componentGenerator.ts:1-408](file://lib/ai/componentGenerator.ts#L1-L408)
- [lib/validation/a11yValidator.ts:1-376](file://lib/validation/a11yValidator.ts#L1-L376)
- [lib/testGenerator.ts:1-265](file://lib/testGenerator.ts#L1-L265)
- [lib/ai/memory.ts:1-211](file://lib/ai/memory.ts#L1-L211)
- [lib/prisma.ts:1-70](file://lib/prisma.ts#L1-L70)

## Architecture Overview
The system follows a layered architecture with explicit boundaries:
- Presentation Layer: Next.js pages and components.
- API Layer: Request handlers implementing REST-like endpoints.
- Business Logic Layer: Orchestration, validation, and generation.
- Data Access Layer: Prisma for persistence.
- Integration Layer: AI adapters abstract provider APIs.

```mermaid
graph TB
Client["Client App<br/>React Components"] --> API["API Handlers<br/>Next.js App Router"]
API --> Orchestrator["Orchestrator<br/>/api/generate/route.ts"]
Orchestrator --> Gen["Component Generator<br/>lib/ai/componentGenerator.ts"]
Orchestrator --> A11y["A11y Validator<br/>lib/validation/a11yValidator.ts"]
Orchestrator --> Tests["Test Generator<br/>lib/testGenerator.ts"]
Orchestrator --> Memory["Memory Store<br/>lib/ai/memory.ts"]
Memory --> Prisma["Prisma Client<br/>lib/prisma.ts"]
Gen --> Adapters["AI Adapters<br/>Provider Abstractions"]
API --> Parse["Intent Parser<br/>/api/parse/route.ts"]
API --> Think["Thinking Plan<br/>/api/think/route.ts"]
```

**Diagram sources**
- [app/api/generate/route.ts:1-451](file://app/api/generate/route.ts#L1-L451)
- [lib/ai/componentGenerator.ts:1-408](file://lib/ai/componentGenerator.ts#L1-L408)
- [lib/validation/a11yValidator.ts:1-376](file://lib/validation/a11yValidator.ts#L1-L376)
- [lib/testGenerator.ts:1-265](file://lib/testGenerator.ts#L1-L265)
- [lib/ai/memory.ts:1-211](file://lib/ai/memory.ts#L1-L211)
- [lib/prisma.ts:1-70](file://lib/prisma.ts#L1-L70)
- [app/api/parse/route.ts:1-124](file://app/api/parse/route.ts#L1-L124)
- [app/api/think/route.ts:1-59](file://app/api/think/route.ts#L1-L59)

## Detailed Component Analysis

### API Layer: Generation Pipeline
The generation endpoint coordinates a multi-stage pipeline:
- Input validation and authentication
- Intent parsing and thinking plan alignment
- Provider-agnostic generation with tool loops
- Review and repair (optional for local models)
- Accessibility validation and auto-repair
- Test generation
- Persistence and dependency resolution

```mermaid
sequenceDiagram
participant C as "Client"
participant G as "Generate Route<br/>/api/generate/route.ts"
participant CG as "Component Generator<br/>lib/ai/componentGenerator.ts"
participant AD as "AI Adapter"
participant RV as "Reviewer<br/>lib/ai/uiReviewer"
participant AV as "A11y Validator<br/>lib/validation/a11yValidator.ts"
participant TG as "Test Generator<br/>lib/testGenerator.ts"
participant MS as "Memory Store<br/>lib/ai/memory.ts"
participant PR as "Prisma<br/>lib/prisma.ts"
C->>G : POST /api/generate
G->>CG : generateComponent(intent, mode, ...)
CG->>AD : adapter.generate(messages, tools?)
AD-->>CG : content + toolCalls (if any)
CG-->>G : raw code + metadata
G->>RV : reviewGeneratedCode(code, context)
RV-->>G : critique + repair instructions
G->>RV : repairGeneratedCode(code, instructions)
RV-->>G : repaired code
G->>AV : validateAccessibility(code)
AV-->>G : report + suggestions
G->>TG : generateTests(intent, code)
TG-->>G : RTL + Playwright tests
G->>MS : saveGeneration(...)
MS->>PR : upsert project/version
G-->>C : {code, a11yReport, tests, ...}
```

**Diagram sources**
- [app/api/generate/route.ts:1-451](file://app/api/generate/route.ts#L1-L451)
- [lib/ai/componentGenerator.ts:1-408](file://lib/ai/componentGenerator.ts#L1-L408)
- [lib/validation/a11yValidator.ts:1-376](file://lib/validation/a11yValidator.ts#L1-L376)
- [lib/testGenerator.ts:1-265](file://lib/testGenerator.ts#L1-L265)
- [lib/ai/memory.ts:1-211](file://lib/ai/memory.ts#L1-L211)
- [lib/prisma.ts:1-70](file://lib/prisma.ts#L1-L70)

**Section sources**
- [app/api/generate/route.ts:1-451](file://app/api/generate/route.ts#L1-L451)

### API Layer: Intent Parsing and Thinking Plans
Intent parsing transforms natural language into structured intent with validation and optional depth UI mode. Thinking plan endpoint aligns generation with a curated plan.

```mermaid
sequenceDiagram
participant C as "Client"
participant P as "Parse Route<br/>/api/parse/route.ts"
participant CG as "Component Generator"
participant T as "Think Route<br/>/api/think/route.ts"
C->>T : POST /api/think {prompt, intentType}
T-->>C : {plan}
C->>P : POST /api/parse {prompt, mode, depthUi?}
P->>CG : parseIntent(prompt, mode, contextId?, modelConfig?)
CG-->>P : {intent}
P-->>C : {intent}
```

**Diagram sources**
- [app/api/parse/route.ts:1-124](file://app/api/parse/route.ts#L1-L124)
- [app/api/think/route.ts:1-59](file://app/api/think/route.ts#L1-L59)
- [lib/ai/componentGenerator.ts:1-408](file://lib/ai/componentGenerator.ts#L1-L408)

**Section sources**
- [app/api/parse/route.ts:1-124](file://app/api/parse/route.ts#L1-L124)
- [app/api/think/route.ts:1-59](file://app/api/think/route.ts#L1-L59)

### Business Logic Layer: Component Generation
The generator is model-agnostic and pipeline-driven:
- Blueprint and design rules selection
- Semantic and memory context injection
- Prompt building and token budget enforcement
- Tool loop orchestration for advanced models
- Code extraction and beautification
- Deterministic validation and repair pipeline

```mermaid
flowchart TD
Start(["Start Generation"]) --> Blueprint["Select Blueprint + Design Rules"]
Blueprint --> Context["Build Semantic + Memory Context"]
Context --> Prompt["Build Model-Aware Prompt"]
Prompt --> Budget["Fit to Token Budget"]
Budget --> Adapter["Resolve Adapter (Provider, Model, Keys)"]
Adapter --> ToolLoop{"Tools Enabled?"}
ToolLoop --> |Yes| Tools["Execute Tool Calls"]
ToolLoop --> |No| Generate["Generate Content"]
Tools --> Generate
Generate --> Extract["Extract Code"]
Extract --> Beautify["Beautify Output"]
Beautify --> Validate{"Valid?"}
Validate --> |No| Repair["Run Repair Pipeline"]
Validate --> |Yes| Done(["Return Code"])
Repair --> Done
```

**Diagram sources**
- [lib/ai/componentGenerator.ts:1-408](file://lib/ai/componentGenerator.ts#L1-L408)

**Section sources**
- [lib/ai/componentGenerator.ts:1-408](file://lib/ai/componentGenerator.ts#L1-L408)

### Business Logic Layer: Accessibility Validation and Auto-Repair
The validator statically analyzes generated code against WCAG 2.1 AA criteria and auto-applies safe fixes.

```mermaid
flowchart TD
A11yStart(["Validate Accessibility"]) --> Rules["Apply WCAG Rules"]
Rules --> Violations{"Violations Found?"}
Violations --> |No| Score["Compute Score + Suggestions"]
Violations --> |Yes| AutoRepair["Auto-Repair Common Issues"]
AutoRepair --> Revalidate["Re-validate Repaired Code"]
Revalidate --> Score
Score --> A11yEnd(["Return Report"])
```

**Diagram sources**
- [lib/validation/a11yValidator.ts:1-376](file://lib/validation/a11yValidator.ts#L1-L376)

**Section sources**
- [lib/validation/a11yValidator.ts:1-376](file://lib/validation/a11yValidator.ts#L1-L376)

### Business Logic Layer: Test Generation
Automatically generates unit/integration tests using React Testing Library and Playwright based on intent fields and interactions.

```mermaid
flowchart TD
TestsStart(["Generate Tests"]) --> RTL["Generate RTL Tests"]
TestsStart --> PW["Generate Playwright Tests"]
RTL --> TestsEnd(["Return Test Suites"])
PW --> TestsEnd
```

**Diagram sources**
- [lib/testGenerator.ts:1-265](file://lib/testGenerator.ts#L1-L265)

**Section sources**
- [lib/testGenerator.ts:1-265](file://lib/testGenerator.ts#L1-L265)

### Data Access Layer: Prisma ORM and Memory Store
Prisma client is configured as a singleton with transient error handling for serverless environments. The memory store persists generation history to the database.

```mermaid
classDiagram
class PrismaClient {
+log
+$connect()
+$disconnect()
}
class MemoryStore {
+saveGeneration(intent, code, a11yScore, manifest?, parentId?, id?, metadata?)
+getProjectByIdAsync(id)
+getRelevantExamples(intent)
}
class Project {
+id
+name
+componentType
+currentVersion
}
class ProjectVersion {
+version
+code
+intent
+a11yReport
+thinkingPlan
+reviewData
}
MemoryStore --> PrismaClient : "uses"
MemoryStore --> Project : "manages"
Project --> ProjectVersion : "has many"
```

**Diagram sources**
- [lib/prisma.ts:1-70](file://lib/prisma.ts#L1-L70)
- [lib/ai/memory.ts:1-211](file://lib/ai/memory.ts#L1-L211)

**Section sources**
- [lib/prisma.ts:1-70](file://lib/prisma.ts#L1-L70)
- [lib/ai/memory.ts:1-211](file://lib/ai/memory.ts#L1-L211)

### Integration Layer: AI Providers and Adapters
The system employs an Adapter Pattern to abstract provider differences and a Factory Pattern to dynamically instantiate adapters based on workspace and user preferences. The generation orchestrator selects the appropriate adapter and executes generation with optional tool calls.

```mermaid
classDiagram
class Adapter {
<<interface>>
+generate(params) Promise
+stream(params) AsyncIterable
}
class OpenAIAdapter
class AnthropicAdapter
class OllamaAdapter
class GroqAdapter
Adapter <|.. OpenAIAdapter
Adapter <|.. AnthropicAdapter
Adapter <|.. OllamaAdapter
Adapter <|.. GroqAdapter
```

**Diagram sources**
- [lib/ai/componentGenerator.ts:16-20](file://lib/ai/componentGenerator.ts#L16-L20)

**Section sources**
- [lib/ai/componentGenerator.ts:16-20](file://lib/ai/componentGenerator.ts#L16-L20)

## Dependency Analysis
The system exhibits layered cohesion and controlled coupling:
- Presentation depends on API handlers.
- API handlers depend on business logic.
- Business logic depends on adapters and persistence.
- Persistence depends on Prisma client.
- Adapters depend on external provider SDKs.

```mermaid
graph LR
UI["Presentation"] --> API["API Layer"]
API --> BL["Business Logic"]
BL --> INT["Adapters"]
BL --> DB["Data Access"]
DB --> PRISMA["Prisma Client"]
```

**Diagram sources**
- [app/layout.tsx:1-57](file://app/layout.tsx#L1-L57)
- [app/api/generate/route.ts:1-451](file://app/api/generate/route.ts#L1-L451)
- [lib/ai/componentGenerator.ts:1-408](file://lib/ai/componentGenerator.ts#L1-L408)
- [lib/prisma.ts:1-70](file://lib/prisma.ts#L1-L70)

**Section sources**
- [package.json:13-44](file://package.json#L13-L44)

## Performance Considerations
- Streaming generation reduces latency for long-form outputs.
- Parallel execution of accessibility validation and test generation improves throughput.
- Token budget enforcement prevents prompt overflow and reduces cost.
- Singleton Prisma client minimizes connection churn in serverless environments.
- Transient error handling retries on connection drops for resilient DB access.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and mitigations:
- Database connection drops: Automatic reconnect with transient error detection.
- Provider timeouts: Local model detection avoids expensive review calls; timeouts are handled gracefully.
- Invalid JSON or missing fields: Early validation returns structured errors.
- Browser safety violations: Strict validation blocks unsafe code patterns.
- Memory writes: Fire-and-forget persistence continues even if DB writes fail.

**Section sources**
- [lib/prisma.ts:36-70](file://lib/prisma.ts#L36-L70)
- [app/api/generate/route.ts:24-451](file://app/api/generate/route.ts#L24-L451)
- [lib/validation/a11yValidator.ts:1-376](file://lib/validation/a11yValidator.ts#L1-L376)
- [lib/ai/memory.ts:68-124](file://lib/ai/memory.ts#L68-L124)

## Conclusion
The system’s layered architecture, combined with well-defined patterns (Adapter, Pipeline, Factory, Observer), enables a scalable, maintainable, and accessibility-first UI generation pipeline. Clear boundaries and robust error handling support reliable operation in serverless environments, while Prisma and provider abstraction facilitate extensibility and multi-tenancy.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Technology Stack and Third-Party Dependencies
- Frontend: Next.js, React, Tailwind CSS, Radix UI, CodeMirror
- Backend: Next.js App Router API handlers
- AI/LLM: openai, @huggingface/inference, ai library
- Database: @neondatabase/serverless, @prisma/client
- Caching: @upstash/redis
- Authentication: next-auth with @auth/prisma-adapter
- Testing: @testing-library/react, jest, playwright
- Utilities: zod, lucide-react, lru-cache

**Section sources**
- [package.json:13-44](file://package.json#L13-L44)

### Infrastructure Requirements and Deployment Topology
- Runtime: Next.js on Vercel with standalone output for faster cold starts.
- Security: Strict security headers configured globally.
- Database: Neon serverless with Prisma; singleton client and transient error handling.
- Scalability: Serverless functions with process reuse; connection limits tuned for Neon.

**Section sources**
- [next.config.ts:1-38](file://next.config.ts#L1-L38)
- [lib/prisma.ts:1-70](file://lib/prisma.ts#L1-L70)

### Cross-Cutting Concerns
- Security: Input validation, browser safety checks, strict CSP headers, authentication middleware.
- Monitoring: Structured request logs with correlation IDs and error telemetry.
- Multi-tenancy: Workspace-scoped adapter resolution and memory persistence keyed by workspace.

**Section sources**
- [app/api/generate/route.ts:56-100](file://app/api/generate/route.ts#L56-L100)
- [lib/ai/memory.ts:55-124](file://lib/ai/memory.ts#L55-L124)
- [next.config.ts:20-34](file://next.config.ts#L20-L34)