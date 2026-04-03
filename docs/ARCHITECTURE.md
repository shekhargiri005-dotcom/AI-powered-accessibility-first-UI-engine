# System Architecture — AI-Powered Accessibility-First UI Engine

This document provides a comprehensive overview of the system architecture. By reading this, any engineer should be able to understand how the AI Agent pipeline works, how it is deployed, and what problems are currently being solved.

---

## 1. High-Level Overview
The project is a Next.js full-stack application designed to generate production-grade, highly accessible React/Tailwind UI components based on user prompts. 

Unlike basic AI wrappers, this engine uses a **multi-agent pipeline** (Generator → Reviewer → Repair Agent) backed by strict design system blueprints, automated accessibility validation, and a highly resilient adapter pattern that spans multiple AI providers (OpenAI, Anthropic, DeepSeek, Google, Ollama).

## 2. Core Infrastructure & Deployment
The system is built explicitly for serverless scalability.

| Layer | Technology | Role |
|---|---|---|
| **Frontend & API** | Next.js 14+ (App Router) | React UI pages and `/api/...` serverless routes. Deployed on **Vercel**. |
| **Database** | PostgreSQL (via Neon) | Serverless DB accessed via **Prisma ORM**. Stores encrypted API keys and telemetry. |
| **Caching** | Upstash Redis / Memory | HTTP-based serverless Redis to cache identical AI generations and reduce API costs. |

---

## 3. The AI Generation Pipeline (The "Brain")
When a user requests a component (e.g., "Build a pricing table"), the request flows through a multi-stage deterministic pipeline.

### Stage 1: Intelligence Engine
- **Intent Classifier (`intentClassifier.ts`)**: Determines if the user wants a single component, a full app layout, or a WebGL scene.
- **Design Rules & Blueprints (`blueprintEngine.ts`)**: Injects strict, hardcoded UX/UI rules into the prompt (e.g., "Pricing cards must have subtle shadows, and the primary plan must use a distinct accent color").

### Stage 2: Code Generation
- The augmented prompt is sent to the **Adapter Factory** (`getWorkspaceAdapter`).
- Code is generated using the chosen model, strictly asking for raw TSX.

### Stage 3: Critique & Repair
- **Validator (`a11yValidator.ts`)**: Scans code for ARIA tags, color contrast, and semantic HTML structure.
- **UI Expert Reviewer (`uiReviewer.ts`)**: A second AI agent critiques the generated code against the user's intent. If it finds severe flaws, it triggers the **Repair Agent** to rewrite the faulty sections before showing it to the user.

---

## 4. Universal Adapter & Resilience Layer
The system does not rely on a single AI provider.

- **Universal Interface (`AIAdapter`)**: OpenAI, Anthropic, DeepSeek, and Google all map to a single interface. 
- **Fallback & Retry (`FallbackAdapter`)**: If an API call fails (rate limit, 500 server error), the system automatically retries using **exponential backoff with jitter**. If all retries fail, it falls back to the next provider in the chain (defaulting to a local Ollama model if the cloud fails).
- **TTL Cache & Redis**: If a prompt/model/temperature combination has been run before, the exact response is served instantly from Upstash Redis, costing 0 tokens.

---

## 5. Security & Workspace Awareness
Security is a primary concern, as the system handles third-party API keys.

- **Per-Workspace Keys**: Users can supply their own OpenAI/Anthropic keys.
- **AES-256-GCM Encryption**: Keys are never stored in plaintext. They are encrypted before hitting the database (`encryption.ts`) and decrypted entirely in server memory.
- **Prompt Injection Defense**: All user inputs are sanitized and checked by a validation layer before hitting the AI to prevent system-prompt extraction.

---

## 6. Observability & Telemetry
Every generation is tracked without slowing down the user.

- **Asynchronous Metrics (`metrics.ts`)**: Token usage, latency, provider name, and a calculated USD cost estimate (`costEstimateUsd`) are bundled into a JSON object.
- **Fire-and-Forget**: It triggers a non-blocking background write to the `UsageLog` database table and outputs unified structured logs (Pino).

---

## 7. Known Problems & Roadmap (What we are fixing next)

While the core pipeline is incredibly robust, there are strict delivery requirements that are currently being actively addressed:

1. **Vercel AI SDK Migration**: 
   - *Problem*: Streaming uses a manual `ReadableStream` implementation.
   - *Fix*: Migrate to Vercel's official `ai` SDK (`streamText`) to ensure long-term stability and easier front-end consumption.
2. **Multi-Tenancy Auth**: 
   - *Problem*: The `workspaceId` is currently hardcoded as `'default'`, meaning all users share the same database profile.
   - *Fix*: Integrate `next-auth` or Clerk for real session-based multi-tenancy.
3. **Quality Gates & Testing**: 
   - *Problem*: The delivery contract requires SonarQube with 0 critical smells and >80% Jest test coverage, which do not currently exist.
   - *Fix*: Write unit tests for encryption, adapters, and pricing, and wire them up in CI.
4. **On-Prem/Docker Support**: 
   - *Problem*: Vercel/Neon/Upstash handles cloud deployment, but the contract demands commodity Linux VM compatibility.
   - *Fix*: Provide a `docker-compose.yml` to spin up Next.js + Postgres + local Redis for offline/enterprise deployments.
