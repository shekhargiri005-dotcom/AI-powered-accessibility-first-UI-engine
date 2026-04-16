# Data Access Patterns & Performance

<cite>
**Referenced Files in This Document**
- [prisma.ts](file://lib/prisma.ts)
- [schema.prisma](file://prisma/schema.prisma)
- [20260407120000_add_project_model/migration.sql](file://prisma/migrations/20260407120000_add_project_model/migration.sql)
- [20260409100000_add_vector_embeddings/migration.sql](file://prisma/migrations/20260409100000_add_vector_embeddings/migration.sql)
- [20260410113000_add_thinking_review_metadata_to_project_version/migration.sql](file://prisma/migrations/20260410113000_add_thinking_review_metadata_to_project_version/migration.sql)
- [projectStore.ts](file://lib/projects/projectStore.ts)
- [memory.ts](file://lib/ai/memory.ts)
- [feedbackStore.ts](file://lib/ai/feedbackStore.ts)
- [vectorStore.ts](file://lib/ai/vectorStore.ts)
- [route.ts (history)](file://app/api/history/route.ts)
- [route.ts (projects)](file://app/api/projects/route.ts)
- [route.ts (workspaces)](file://app/api/workspaces/route.ts)
- [route.ts (workspace/settings)](file://app/api/workspace/settings/route.ts)
- [route.ts (feedback)](file://app/api/feedback/route.ts)
- [workspaceKeyService.ts](file://lib/security/workspaceKeyService.ts)
- [RightPanel.tsx](file://components/ide/RightPanel.tsx)
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
This document explains the data access patterns, query optimization, and performance strategies across the database layer. It covers Prisma client initialization and connection pooling configuration, common query patterns (workspace-scoped queries, project versioning, feedback aggregation), caching strategies for workspace settings and user permissions, and techniques for query batching, lazy loading, and index utilization. It also documents the separation of business logic from database operations, provides examples of efficient query patterns for generation history, project management, and workspace analytics, and outlines connection management, transaction handling, error recovery, and monitoring approaches.

## Project Structure
The data access layer is organized around:
- A singleton Prisma client with automatic reconnection for serverless environments
- Strongly typed Prisma models for multi-tenant workspaces, projects, versions, usage logs, feedback, and embeddings
- API routes that enforce workspace scoping and return optimized payloads
- Domain stores that encapsulate business logic and translate between DB rows and domain types
- Caching for frequently accessed data (workspace settings, feedback stats)

```mermaid
graph TB
subgraph "API Routes"
H["/api/history"]
P["/api/projects"]
W["/api/workspaces"]
WS["/api/workspace/settings"]
F["/api/feedback"]
end
subgraph "Domain Stores"
PS["projectStore.ts"]
MEM["memory.ts"]
FS["feedbackStore.ts"]
end
subgraph "Prisma Layer"
PRISMA["lib/prisma.ts"]
SCHEMA["prisma/schema.prisma"]
end
subgraph "Caching"
WK["workspaceKeyService.ts"]
VS["vectorStore.ts"]
end
H --> MEM
P --> PS
W --> PRISMA
WS --> WK
F --> FS
PS --> PRISMA
MEM --> PRISMA
FS --> PRISMA
WK --> PRISMA
VS --> PRISMA
PRISMA --> SCHEMA
```

**Diagram sources**
- [prisma.ts:1-70](file://lib/prisma.ts#L1-L70)
- [schema.prisma:1-222](file://prisma/schema.prisma#L1-L222)
- [projectStore.ts:1-290](file://lib/projects/projectStore.ts#L1-L290)
- [memory.ts:1-211](file://lib/ai/memory.ts#L1-L211)
- [feedbackStore.ts:1-356](file://lib/ai/feedbackStore.ts#L1-L356)
- [vectorStore.ts:166-249](file://lib/ai/vectorStore.ts#L166-L249)
- [route.ts (history):1-60](file://app/api/history/route.ts#L1-L60)
- [route.ts (projects):1-92](file://app/api/projects/route.ts#L1-L92)
- [route.ts (workspaces):1-52](file://app/api/workspaces/route.ts#L1-L52)
- [route.ts (workspace/settings):1-147](file://app/api/workspace/settings/route.ts#L1-L147)
- [route.ts (feedback):1-85](file://app/api/feedback/route.ts#L1-L85)
- [workspaceKeyService.ts:47-137](file://lib/security/workspaceKeyService.ts#L47-L137)

**Section sources**
- [prisma.ts:1-70](file://lib/prisma.ts#L1-L70)
- [schema.prisma:1-222](file://prisma/schema.prisma#L1-L222)

## Core Components
- Prisma singleton and automatic reconnection for transient Neon errors
- Workspace-scoped queries via membership checks and workspaceId filters
- Project versioning with upsert and roll-forward semantics
- Feedback aggregation with dual-write (cache + DB) and quality gating
- Vector similarity search with IVFFlat indexes for pgvector
- Lightweight history API returning summaries without heavy payloads

**Section sources**
- [prisma.ts:20-70](file://lib/prisma.ts#L20-L70)
- [route.ts (workspaces):7-29](file://app/api/workspaces/route.ts#L7-L29)
- [projectStore.ts:162-208](file://lib/projects/projectStore.ts#L162-L208)
- [feedbackStore.ts:211-276](file://lib/ai/feedbackStore.ts#L211-L276)
- [vectorStore.ts:166-249](file://lib/ai/vectorStore.ts#L166-L249)
- [route.ts (history):20-54](file://app/api/history/route.ts#L20-L54)

## Architecture Overview
The data access layer separates concerns:
- API routes: enforce auth, scope by workspace, and return optimized shapes
- Domain stores: encapsulate business logic and transform DB rows to domain types
- Prisma: ORM client with singleton pattern and automatic reconnection
- Caching: in-memory fallback and Redis for feedback stats; TTL cache for workspace keys

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "API Route"
participant Store as "Domain Store"
participant DB as "Prisma Client"
participant Cache as "Caches"
Client->>API : "HTTP request"
API->>API : "Auth + workspace scoping"
API->>Store : "Call business function"
Store->>DB : "Execute query with includes/takes"
DB-->>Store : "Rows"
Store->>Store : "Transform to domain types"
alt "Read path"
Store->>Cache : "Read stats / settings"
Cache-->>Store : "Cached values"
else "Write path"
Store->>Cache : "Fire-and-forget updates"
end
Store-->>API : "Result"
API-->>Client : "JSON response"
```

**Diagram sources**
- [route.ts (history):5-59](file://app/api/history/route.ts#L5-L59)
- [route.ts (projects):8-91](file://app/api/projects/route.ts#L8-L91)
- [projectStore.ts:210-245](file://lib/projects/projectStore.ts#L210-L245)
- [feedbackStore.ts:286-339](file://lib/ai/feedbackStore.ts#L286-L339)
- [workspaceKeyService.ts:111-137](file://lib/security/workspaceKeyService.ts#L111-L137)

## Detailed Component Analysis

### Prisma Client Initialization and Connection Pooling
- Singleton client shared across the Node process to prevent connection exhaustion in serverless environments
- Automatic reconnection wrapper handles transient Neon errors with a brief backoff and retry
- Logging configured differently in development vs production

```mermaid
flowchart TD
Start(["Import prisma.ts"]) --> CheckGlobal["Check global singleton"]
CheckGlobal --> |Exists| UseExisting["Use existing PrismaClient"]
CheckGlobal --> |Not found| NewClient["Create PrismaClient with log level"]
NewClient --> SetGlobal["Set global singleton"]
SetGlobal --> Export["Export prisma"]
Export --> Wrap["withReconnect(fn)"]
Wrap --> TryOp["Try fn()"]
TryOp --> IsTransient{"Transient error?"}
IsTransient --> |No| ThrowErr["Rethrow error"]
IsTransient --> |Yes| Backoff["Sleep 250ms"]
Backoff --> Reconnect["prisma.$connect()"]
Reconnect --> Retry["Retry fn()"]
```

**Diagram sources**
- [prisma.ts:20-70](file://lib/prisma.ts#L20-L70)

**Section sources**
- [prisma.ts:20-70](file://lib/prisma.ts#L20-L70)

### Workspace-Scoped Queries and Permissions
- Workspaces are multi-tenant; membership determines access
- Workspace settings are scoped by workspaceId/provider
- Workspace list endpoint joins membership and counts settings

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "/api/workspaces"
participant DB as "Prisma"
Client->>API : "GET /api/workspaces"
API->>DB : "Find workspaceMember by userId<br/>include workspace + _count(settings)"
DB-->>API : "Memberships"
API->>API : "Map to {id,name,slug,role,settingsCount}"
API-->>Client : "{success : true, workspaces}"
```

**Diagram sources**
- [route.ts (workspaces):7-29](file://app/api/workspaces/route.ts#L7-L29)

**Section sources**
- [route.ts (workspaces):1-52](file://app/api/workspaces/route.ts#L1-L52)
- [schema.prisma:64-110](file://prisma/schema.prisma#L64-L110)
- [workspaceKeyService.ts:111-137](file://lib/security/workspaceKeyService.ts#L111-L137)

### Project Management and Versioning
- Projects are versioned with Project and ProjectVersion tables
- Efficient queries use includes with ordering and limits
- Rollback creates a new version from a target version
- History API returns lightweight summaries for large lists

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "/api/projects"
participant Store as "projectStore.ts"
participant DB as "Prisma"
Client->>API : "POST /api/projects"
API->>Store : "saveVersion(...) or createProject(...)"
Store->>DB : "Upsert Project + create ProjectVersion"
DB-->>Store : "Updated Project"
Store-->>API : "Project"
API-->>Client : "{success : true, project}"
Client->>API : "GET /api/history"
API->>DB : "findMany(Project)<br/>include latest Version<br/>orderBy updatedAt desc<br/>take 200"
DB-->>API : "Rows"
API->>API : "Map to summary"
API-->>Client : "{history : [...]}"
Client->>API : "GET /api/projects?workspaceId=..."
API->>Store : "listProjects(workspaceId?)"
Store->>DB : "findMany(Project)<br/>include latest Version + _count(versions)"
DB-->>Store : "Rows"
Store-->>API : "ProjectSummary[]"
API-->>Client : "{success : true, projects}"
```

**Diagram sources**
- [route.ts (projects):8-91](file://app/api/projects/route.ts#L8-L91)
- [projectStore.ts:162-208](file://lib/projects/projectStore.ts#L162-L208)
- [route.ts (history):20-54](file://app/api/history/route.ts#L20-L54)
- [20260407120000_add_project_model/migration.sql:1-36](file://prisma/migrations/20260407120000_add_project_model/migration.sql#L1-L36)

**Section sources**
- [projectStore.ts:162-208](file://lib/projects/projectStore.ts#L162-L208)
- [route.ts (history):5-59](file://app/api/history/route.ts#L5-L59)
- [route.ts (projects):8-91](file://app/api/projects/route.ts#L8-L91)
- [schema.prisma:158-187](file://prisma/schema.prisma#L158-L187)

### Feedback Aggregation and Analytics
- Dual-write strategy: cache (Redis/memory) for fast reads, DB for durable persistence
- Quality gating ensures only high-quality corrections are embedded
- Stats recomputation updates counters and averages incrementally
- Analytics UI consumes aggregated stats keyed by model and intent type

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "/api/feedback"
participant Store as "feedbackStore.ts"
participant Cache as "Redis/In-memory"
participant DB as "Prisma"
participant Vec as "vectorStore.ts"
Client->>API : "POST /api/feedback"
API->>Store : "recordFeedback(input)"
Store->>Cache : "recomputeAndWriteStats(entry) [fire-and-forget]"
Store->>DB : "create GenerationFeedback [fire-and-forget]"
alt "Corrected and meets quality gate"
Store->>Vec : "upsertFeedbackEmbedding(...) [fire-and-forget]"
else "Skipped"
Store->>Store : "log quality gate rejection"
end
API-->>Client : "{success : true}"
Client->>API : "GET /api/feedback?model=...&intentType=..."
API->>Store : "getFeedbackStats(model,intentType)"
Store->>Cache : "readStats(model,intentType)"
Cache-->>Store : "FeedbackStats or null"
Store-->>API : "stats"
API-->>Client : "{success : true, stats}"
```

**Diagram sources**
- [route.ts (feedback):28-84](file://app/api/feedback/route.ts#L28-L84)
- [feedbackStore.ts:211-276](file://lib/ai/feedbackStore.ts#L211-L276)
- [feedbackStore.ts:286-339](file://lib/ai/feedbackStore.ts#L286-L339)
- [vectorStore.ts:166-249](file://lib/ai/vectorStore.ts#L166-L249)
- [RightPanel.tsx:66-90](file://components/ide/RightPanel.tsx#L66-L90)

**Section sources**
- [feedbackStore.ts:1-356](file://lib/ai/feedbackStore.ts#L1-L356)
- [route.ts (feedback):1-85](file://app/api/feedback/route.ts#L1-L85)
- [RightPanel.tsx:66-90](file://components/ide/RightPanel.tsx#L66-L90)

### Vector Search and Index Utilization
- Semantic search uses pgvector with IVFFlat cosine index
- Queries compute cosine similarity and filter by minimum threshold
- Source-filtered search narrows results to specific knowledge domains

```mermaid
flowchart TD
Q["User query"] --> Embed["embedText(query)"]
Embed --> HasEmb{"Embedding OK?"}
HasEmb --> |No| ReturnEmpty["Return []"]
HasEmb --> |Yes| BuildSQL["Build SQL with vector literal"]
BuildSQL --> ExecCosine["SELECT ... 1-(embedding<=>vec) AS similarity<br/>WHERE embedding IS NOT NULL<br/>AND similarity >= threshold<br/>ORDER BY similarity DESC<br/>LIMIT k"]
ExecCosine --> Rows["Rows"]
Rows --> Map["Map to SimilarComponent[]"]
Map --> Out["Return results"]
```

**Diagram sources**
- [vectorStore.ts:166-249](file://lib/ai/vectorStore.ts#L166-L249)
- [20260409100000_add_vector_embeddings/migration.sql:34-42](file://prisma/migrations/20260409100000_add_vector_embeddings/migration.sql#L34-L42)

**Section sources**
- [vectorStore.ts:166-249](file://lib/ai/vectorStore.ts#L166-L249)
- [20260409100000_add_vector_embeddings/migration.sql:34-42](file://prisma/migrations/20260409100000_add_vector_embeddings/migration.sql#L34-L42)

### Workspace Settings and Permissions Caching
- Workspace keys are cached in-process with TTL; invalidated on change
- Model preferences are resolved with a membership check for non-default workspaces
- Settings endpoint returns provider map without exposing raw keys

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "/api/workspace/settings"
participant Cache as "workspaceKeyService.ts"
participant DB as "Prisma"
Client->>API : "GET /api/workspace/settings"
API->>DB : "findMany(workspaceSettings)"
DB-->>API : "Settings"
API-->>Client : "{settings : {provider : {model,hasApiKey,updatedAt}}}"
Client->>API : "POST /api/workspace/settings {apiKey}"
API->>API : "Validate key (skip for Ollama)"
API->>DB : "upsert workspaceSettings"
API->>Cache : "invalidateWorkspaceKey()"
API-->>Client : "{success : true}"
```

**Diagram sources**
- [route.ts (workspace/settings):34-55](file://app/api/workspace/settings/route.ts#L34-L55)
- [route.ts (workspace/settings):59-146](file://app/api/workspace/settings/route.ts#L59-L146)
- [workspaceKeyService.ts:47-137](file://lib/security/workspaceKeyService.ts#L47-L137)

**Section sources**
- [route.ts (workspace/settings):1-147](file://app/api/workspace/settings/route.ts#L1-L147)
- [workspaceKeyService.ts:47-137](file://lib/security/workspaceKeyService.ts#L47-L137)

## Dependency Analysis
- API routes depend on domain stores and Prisma
- Domain stores depend on Prisma and optional caches
- Vector search depends on pgvector indexes and embedding services
- Feedback analytics depends on Redis/memory cache and DB

```mermaid
graph LR
API_H["/api/history"] --> MEM["memory.ts"]
API_P["/api/projects"] --> PS["projectStore.ts"]
API_W["/api/workspaces"] --> PRISMA["lib/prisma.ts"]
API_WS["/api/workspace/settings"] --> WK["workspaceKeyService.ts"]
API_F["/api/feedback"] --> FS["feedbackStore.ts"]
PS --> PRISMA
MEM --> PRISMA
FS --> PRISMA
WK --> PRISMA
FS --> VS["vectorStore.ts"]
VS --> PRISMA
```

**Diagram sources**
- [route.ts (history):1-60](file://app/api/history/route.ts#L1-L60)
- [route.ts (projects):1-92](file://app/api/projects/route.ts#L1-L92)
- [route.ts (workspaces):1-52](file://app/api/workspaces/route.ts#L1-L52)
- [route.ts (workspace/settings):1-147](file://app/api/workspace/settings/route.ts#L1-L147)
- [route.ts (feedback):1-85](file://app/api/feedback/route.ts#L1-L85)
- [projectStore.ts:1-290](file://lib/projects/projectStore.ts#L1-L290)
- [memory.ts:1-211](file://lib/ai/memory.ts#L1-L211)
- [feedbackStore.ts:1-356](file://lib/ai/feedbackStore.ts#L1-L356)
- [workspaceKeyService.ts:47-137](file://lib/security/workspaceKeyService.ts#L47-L137)
- [vectorStore.ts:166-249](file://lib/ai/vectorStore.ts#L166-L249)
- [prisma.ts:1-70](file://lib/prisma.ts#L1-L70)

**Section sources**
- [prisma.ts:1-70](file://lib/prisma.ts#L1-L70)
- [schema.prisma:1-222](file://prisma/schema.prisma#L1-L222)

## Performance Considerations
- Query batching and lazy loading
  - Use includes selectively with take and orderBy to limit payload sizes
  - Return lightweight summaries for list endpoints (e.g., history)
  - Defer heavy payloads (e.g., code blobs) to detail endpoints
- Index utilization
  - Leverage unique composite indexes for membership and settings lookups
  - Use IVFFlat indexes for vector similarity searches
  - Keep queries selective with workspaceId filters
- Connection management and retries
  - Singleton Prisma client prevents pool exhaustion
  - Automatic reconnection for transient Neon errors
- Caching
  - In-memory TTL cache for workspace keys
  - Redis-backed feedback stats with in-memory fallback
  - Quality gating reduces unnecessary writes to vector store
- Transaction handling
  - Use atomic upserts and cascading deletes where appropriate
  - Batch related writes when safe (e.g., create ProjectVersion within a single transactional update)
- Monitoring and observability
  - Enable Prisma query logging in development
  - Track slow queries and error rates at the API boundary
  - Monitor cache hit rates and Redis availability

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Neon transient connection errors
  - Use the automatic reconnection wrapper for any DB call that might encounter transient failures
- Migration-related table missing errors
  - Handle known request errors gracefully and treat as non-fatal during early startup
- Slow vector similarity queries
  - Ensure IVFFlat indexes are present and lists parameter is tuned for dataset size
- Cache misses and stale data
  - Invalidate caches on settings changes and rely on TTL-based refresh
- Unauthorized access attempts
  - Membership checks should be enforced before executing workspace-scoped queries

**Section sources**
- [prisma.ts:36-70](file://lib/prisma.ts#L36-L70)
- [projectStore.ts:5-8](file://lib/projects/projectStore.ts#L5-L8)
- [route.ts (workspaces):7-29](file://app/api/workspaces/route.ts#L7-L29)
- [20260409100000_add_vector_embeddings/migration.sql:34-42](file://prisma/migrations/20260409100000_add_vector_embeddings/migration.sql#L34-L42)

## Conclusion
The data access layer employs a clean separation between API routes, domain stores, and Prisma, with careful attention to performance and reliability. Workspace scoping is enforced at the query boundary, versioning is handled efficiently, and feedback analytics leverage dual-write caching for speed. Vector search is optimized with proper indexes, and connection resilience is built-in. Following the recommended patterns and monitoring practices will help maintain performance and scalability.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Efficient Query Patterns by Feature
- Generation history
  - List summaries with include latest version and take limits
  - Detail lookups by ID with include latest version
- Project management
  - Workspace-scoped list with include latest version and count
  - Upsert version with minimal selects and ordered includes
  - Rollback by creating a new version from a target version
- Workspace analytics
  - Feedback stats reads from cache; DB fallback for top-rated generations
  - Workspace settings reads with selective projections and cache invalidation

**Section sources**
- [route.ts (history):20-54](file://app/api/history/route.ts#L20-L54)
- [memory.ts:126-152](file://lib/ai/memory.ts#L126-L152)
- [projectStore.ts:222-245](file://lib/projects/projectStore.ts#L222-L245)
- [projectStore.ts:162-208](file://lib/projects/projectStore.ts#L162-L208)
- [feedbackStore.ts:286-339](file://lib/ai/feedbackStore.ts#L286-L339)
- [route.ts (workspace/settings):34-55](file://app/api/workspace/settings/route.ts#L34-L55)