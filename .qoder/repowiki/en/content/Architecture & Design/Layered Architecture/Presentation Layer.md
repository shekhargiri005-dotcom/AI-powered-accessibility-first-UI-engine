# Presentation Layer

<cite>
**Referenced Files in This Document**
- [app/layout.tsx](file://app/layout.tsx)
- [app/page.tsx](file://app/page.tsx)
- [components/ide/Sidebar.tsx](file://components/ide/Sidebar.tsx)
- [components/ide/CenterWorkspace.tsx](file://components/ide/CenterWorkspace.tsx)
- [components/ide/RightPanel.tsx](file://components/ide/RightPanel.tsx)
- [components/PromptInput.tsx](file://components/PromptInput.tsx)
- [components/ThinkingPanel.tsx](file://components/ThinkingPanel.tsx)
- [components/PipelineStatus.tsx](file://components/PipelineStatus.tsx)
- [components/SandpackPreview.tsx](file://components/SandpackPreview.tsx)
- [components/GeneratedCode.tsx](file://components/GeneratedCode.tsx)
- [components/A11yReport.tsx](file://components/A11yReport.tsx)
- [components/FeedbackBar.tsx](file://components/FeedbackBar.tsx)
- [components/auth/SessionProvider.tsx](file://components/auth/SessionProvider.tsx)
- [components/workspace/WorkspaceProvider.tsx](file://components/workspace/WorkspaceProvider.tsx)
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

## Introduction
This document explains the presentation layer architecture of the AI-powered accessibility-first UI engine. It focuses on the Next.js App Router implementation, React component hierarchy, and user interface design patterns. It also documents how frontend components interact with backend API routes, the role of the IDE workspace interface, and the live preview system. The document covers component composition, state management, and user interaction patterns, and ties together pages, components, and the overall user experience flow.

## Project Structure
The presentation layer is organized around:
- Root layout and global styles
- A single-page application shell with a three-pane IDE-like interface
- Provider-based context for session and workspace
- Specialized panels for prompting, thinking, pipeline status, preview, code, metrics, and feedback

```mermaid
graph TB
subgraph "Root"
L["app/layout.tsx"]
P["app/page.tsx"]
end
subgraph "Providers"
SP["components/auth/SessionProvider.tsx"]
WP["components/workspace/WorkspaceProvider.tsx"]
end
subgraph "Left Sidebar"
SB["components/ide/Sidebar.tsx"]
end
subgraph "Center"
CW["components/ide/CenterWorkspace.tsx"]
PI["components/PromptInput.tsx"]
TP["components/ThinkingPanel.tsx"]
PS["components/PipelineStatus.tsx"]
end
subgraph "Right"
RP["components/ide/RightPanel.tsx"]
SPV["components/SandpackPreview.tsx"]
GC["components/GeneratedCode.tsx"]
AR["components/A11yReport.tsx"]
FB["components/FeedbackBar.tsx"]
end
L --> SP --> WP --> P
P --> SB
P --> CW
P --> RP
CW --> PI
CW --> TP
CW --> PS
RP --> SPV
RP --> GC
RP --> AR
RP --> FB
```

**Diagram sources**
- [app/layout.tsx:34-56](file://app/layout.tsx#L34-L56)
- [app/page.tsx:48-521](file://app/page.tsx#L48-L521)
- [components/ide/Sidebar.tsx:31-215](file://components/ide/Sidebar.tsx#L31-L215)
- [components/ide/CenterWorkspace.tsx:34-245](file://components/ide/CenterWorkspace.tsx#L34-L245)
- [components/ide/RightPanel.tsx:175-830](file://components/ide/RightPanel.tsx#L175-L830)
- [components/PromptInput.tsx:42-563](file://components/PromptInput.tsx#L42-L563)
- [components/ThinkingPanel.tsx:139-358](file://components/ThinkingPanel.tsx#L139-L358)
- [components/PipelineStatus.tsx:77-219](file://components/PipelineStatus.tsx#L77-L219)
- [components/SandpackPreview.tsx:144-287](file://components/SandpackPreview.tsx#L144-L287)
- [components/GeneratedCode.tsx:14-149](file://components/GeneratedCode.tsx#L14-L149)
- [components/A11yReport.tsx:97-193](file://components/A11yReport.tsx#L97-L193)
- [components/FeedbackBar.tsx:36-227](file://components/FeedbackBar.tsx#L36-L227)
- [components/auth/SessionProvider.tsx:3-7](file://components/auth/SessionProvider.tsx#L3-L7)
- [components/workspace/WorkspaceProvider.tsx:27-155](file://components/workspace/WorkspaceProvider.tsx#L27-L155)

**Section sources**
- [app/layout.tsx:1-57](file://app/layout.tsx#L1-L57)
- [app/page.tsx:1-522](file://app/page.tsx#L1-L522)

## Core Components
- Root layout establishes fonts, metadata, and providers for session and workspace.
- Home page orchestrates the entire UX: prompts, AI pipeline, preview, and feedback.
- Sidebar manages projects, workspace switching, and user settings.
- Center workspace hosts the prompt input, thinking panel, and pipeline status.
- Right panel renders live preview, code, version history, metrics, and feedback bar.
- Providers manage session and workspace state across the app.

**Section sources**
- [app/layout.tsx:19-56](file://app/layout.tsx#L19-L56)
- [app/page.tsx:48-521](file://app/page.tsx#L48-L521)
- [components/ide/Sidebar.tsx:31-215](file://components/ide/Sidebar.tsx#L31-L215)
- [components/ide/CenterWorkspace.tsx:34-245](file://components/ide/CenterWorkspace.tsx#L34-L245)
- [components/ide/RightPanel.tsx:175-830](file://components/ide/RightPanel.tsx#L175-L830)
- [components/auth/SessionProvider.tsx:3-7](file://components/auth/SessionProvider.tsx#L3-L7)
- [components/workspace/WorkspaceProvider.tsx:27-155](file://components/workspace/WorkspaceProvider.tsx#L27-L155)

## Architecture Overview
The presentation layer follows a client-driven flow:
- The root layout initializes providers and global styles.
- The home page composes the three-pane UI and coordinates state across components.
- Components communicate with backend APIs via fetch calls to Next.js API routes.
- The IDE workspace interface (sidebar, center, right) provides a cohesive authoring experience.
- The live preview system integrates with a sandboxed React renderer and captures screenshots for AI-driven quality checks.

```mermaid
sequenceDiagram
participant U as "User"
participant HP as "HomePage"
participant CW as "CenterWorkspace"
participant PI as "PromptInput"
participant TP as "ThinkingPanel"
participant RP as "RightPanel"
participant SPV as "SandpackPreview"
participant API as "Next.js API Routes"
U->>PI : "Enter prompt and choose mode"
PI-->>CW : "onSubmit(prompt, mode)"
CW->>HP : "handlePromptSubmit()"
HP->>API : "POST /api/classify"
API-->>HP : "IntentClassification"
HP->>API : "POST /api/think"
API-->>HP : "ThinkingPlan"
HP->>TP : "Render ThinkingPanel"
U->>TP : "Proceed / Refine / Change Intent"
TP-->>HP : "onProceed()"
HP->>API : "POST /api/parse"
API-->>HP : "Intent"
HP->>API : "POST /api/generate"
API-->>HP : "Generated code + a11y report + tests"
HP->>RP : "Set output and versions"
RP->>SPV : "Render live preview"
SPV-->>RP : "onReadyForScreenshot(iframeSrc)"
RP->>API : "POST /api/final-round (optional)"
API-->>RP : "Final round result"
RP-->>U : "Show metrics, history, feedback"
```

**Diagram sources**
- [app/page.tsx:313-397](file://app/page.tsx#L313-L397)
- [components/ide/CenterWorkspace.tsx:67-83](file://components/ide/CenterWorkspace.tsx#L67-L83)
- [components/PromptInput.tsx:190-230](file://components/PromptInput.tsx#L190-L230)
- [components/ThinkingPanel.tsx:139-358](file://components/ThinkingPanel.tsx#L139-L358)
- [components/ide/RightPanel.tsx:366-476](file://components/ide/RightPanel.tsx#L366-L476)
- [components/SandpackPreview.tsx:65-103](file://components/SandpackPreview.tsx#L65-L103)

## Detailed Component Analysis

### Root Layout and Providers
- Root layout defines metadata, fonts, and wraps children in SessionProvider and WorkspaceProvider.
- Providers supply session and workspace context to the entire app.

```mermaid
graph TB
L["app/layout.tsx"] --> SP["SessionProvider"]
SP --> WP["WorkspaceProvider"]
WP --> P["app/page.tsx"]
```

**Diagram sources**
- [app/layout.tsx:34-56](file://app/layout.tsx#L34-L56)
- [components/auth/SessionProvider.tsx:3-7](file://components/auth/SessionProvider.tsx#L3-L7)
- [components/workspace/WorkspaceProvider.tsx:27-155](file://components/workspace/WorkspaceProvider.tsx#L27-L155)

**Section sources**
- [app/layout.tsx:19-56](file://app/layout.tsx#L19-L56)
- [components/auth/SessionProvider.tsx:3-7](file://components/auth/SessionProvider.tsx#L3-L7)
- [components/workspace/WorkspaceProvider.tsx:27-155](file://components/workspace/WorkspaceProvider.tsx#L27-L155)

### Home Page Composition and State Management
- Orchestrates the entire UI: mobile sidebar, center workspace, and right panel.
- Manages stages, pipeline steps, and errors.
- Coordinates AI engine configuration, project persistence, and refinement.
- Handles classification, thinking, and generation pipeline calls to API routes.

```mermaid
flowchart TD
Start(["User enters prompt"]) --> Classify["POST /api/classify"]
Classify --> Think["POST /api/think"]
Think --> Parse["POST /api/parse"]
Parse --> Generate["POST /api/generate"]
Generate --> Validate["Validation"]
Validate --> Test["Test Generation"]
Test --> Preview["Render in RightPanel"]
Preview --> Feedback["FeedbackBar"]
Feedback --> Persist["POST /api/projects"]
Persist --> End(["Project saved"])
```

**Diagram sources**
- [app/page.tsx:166-310](file://app/page.tsx#L166-L310)
- [app/page.tsx:312-397](file://app/page.tsx#L312-L397)

**Section sources**
- [app/page.tsx:48-521](file://app/page.tsx#L48-L521)

### Sidebar: Project Management and Workspace Switching
- Lists projects, supports search, and triggers project selection.
- Integrates workspace switching and user navigation.
- Loads projects via API route and reflects active workspace.

```mermaid
sequenceDiagram
participant SB as "Sidebar"
participant API as "Next.js API Routes"
SB->>API : "GET /api/projects?workspaceId=..."
API-->>SB : "Projects list"
SB->>SB : "Filter by search"
SB-->>HP : "onSelectProject(id)"
```

**Diagram sources**
- [components/ide/Sidebar.tsx:50-59](file://components/ide/Sidebar.tsx#L50-L59)
- [components/ide/Sidebar.tsx:164-197](file://components/ide/Sidebar.tsx#L164-L197)

**Section sources**
- [components/ide/Sidebar.tsx:31-215](file://components/ide/Sidebar.tsx#L31-L215)

### Center Workspace: Prompt, Thinking, and Pipeline
- Hosts PromptInput, ThinkingPanel, and PipelineStatus.
- Manages visibility and scroll behavior based on stage and thinking plan.
- Provides actions to refine understanding, change intent, and ask clarifications.

```mermaid
classDiagram
class CenterWorkspace {
+props : onPromptSubmit, isLoading, hasActiveProject, aiPayload
+props : onIntentDetected, stage, pipelineStep, pipelineError
+props : thinkingPlan, isThinkingLoading, onProceed, onRefineUnderstanding
+props : onChangeIntent, onDismissThinking, onAskClarification, originalPrompt
}
class PromptInput {
+onSubmit(prompt, mode, options)
+validatePrompt(text)
+scheduleClassify(text)
}
class ThinkingPanel {
+plan : ThinkingPlan
+onProceed()
+onRefineUnderstanding()
+onChangeIntent(type)
+onDismiss()
+onAskClarification(q)
}
class PipelineStatus {
+currentStep : PipelineStep
+errorMessage? : string
}
CenterWorkspace --> PromptInput : "renders"
CenterWorkspace --> ThinkingPanel : "renders"
CenterWorkspace --> PipelineStatus : "renders"
```

**Diagram sources**
- [components/ide/CenterWorkspace.tsx:14-52](file://components/ide/CenterWorkspace.tsx#L14-L52)
- [components/PromptInput.tsx:34-40](file://components/PromptInput.tsx#L34-L40)
- [components/ThinkingPanel.tsx:128-137](file://components/ThinkingPanel.tsx#L128-L137)
- [components/PipelineStatus.tsx:29-32](file://components/PipelineStatus.tsx#L29-L32)

**Section sources**
- [components/ide/CenterWorkspace.tsx:34-245](file://components/ide/CenterWorkspace.tsx#L34-L245)
- [components/PromptInput.tsx:42-563](file://components/PromptInput.tsx#L42-L563)
- [components/ThinkingPanel.tsx:139-358](file://components/ThinkingPanel.tsx#L139-L358)
- [components/PipelineStatus.tsx:77-219](file://components/PipelineStatus.tsx#L77-L219)

### Right Panel: Preview, Code, Versions, Metrics, Feedback
- Renders live preview via SandpackPreview, code viewer, version timeline, and metrics.
- Implements confidence scoring combining intent, accessibility, critique, and feedback signals.
- Supports Final Round AI review and screenshot capture.
- Integrates FeedbackBar for user signals.

```mermaid
classDiagram
class RightPanel {
+initialProject
+onRefine(prompt)
+isRefining
+projectId
+feedbackMeta
+intentConfidence
+aiConfig
+versions
+currentVersion
}
class SandpackPreview {
+code
+componentName
+onCodeChange(newCode)
+onReadyForScreenshot(src)
}
class GeneratedCode {
+code
+componentName
}
class A11yReportComponent {
+report
}
class FeedbackBar {
+generationId
+model
+provider
+intentType
+promptHash
+a11yScore
+critiqueScore
+latencyMs
+autoDetectedEdit
}
RightPanel --> SandpackPreview : "renders"
RightPanel --> GeneratedCode : "renders"
RightPanel --> A11yReportComponent : "renders"
RightPanel --> FeedbackBar : "renders"
```

**Diagram sources**
- [components/ide/RightPanel.tsx:36-60](file://components/ide/RightPanel.tsx#L36-L60)
- [components/SandpackPreview.tsx:14-26](file://components/SandpackPreview.tsx#L14-L26)
- [components/GeneratedCode.tsx:9-12](file://components/GeneratedCode.tsx#L9-L12)
- [components/A11yReport.tsx:7-9](file://components/A11yReport.tsx#L7-L9)
- [components/FeedbackBar.tsx:11-21](file://components/FeedbackBar.tsx#L11-L21)

**Section sources**
- [components/ide/RightPanel.tsx:175-830](file://components/ide/RightPanel.tsx#L175-L830)
- [components/SandpackPreview.tsx:144-287](file://components/SandpackPreview.tsx#L144-L287)
- [components/GeneratedCode.tsx:14-149](file://components/GeneratedCode.tsx#L14-L149)
- [components/A11yReport.tsx:97-193](file://components/A11yReport.tsx#L97-L193)
- [components/FeedbackBar.tsx:36-227](file://components/FeedbackBar.tsx#L36-L227)

### Live Preview System and Final Round
- SandpackPreview embeds a Vite + React sandbox with error boundary and change observer.
- Captures iframe URL after preview settles and posts it to the backend for screenshot capture.
- RightPanel orchestrates Final Round AI review using the captured screenshot and current code.

```mermaid
sequenceDiagram
participant RP as "RightPanel"
participant SPV as "SandpackPreview"
participant OBS as "ScreenshotObserver"
participant API as "Next.js API Routes"
SPV->>OBS : "Preview running"
OBS-->>RP : "onReadyForScreenshot(iframeSrc)"
RP->>API : "POST /api/screenshot (external) or use local sentinel"
API-->>RP : "dataUrl"
RP->>API : "POST /api/final-round"
API-->>RP : "status/result"
RP-->>SPV : "Optionally replace code with suggestedCode"
```

**Diagram sources**
- [components/SandpackPreview.tsx:65-103](file://components/SandpackPreview.tsx#L65-L103)
- [components/ide/RightPanel.tsx:366-476](file://components/ide/RightPanel.tsx#L366-L476)

**Section sources**
- [components/SandpackPreview.tsx:144-287](file://components/SandpackPreview.tsx#L144-L287)
- [components/ide/RightPanel.tsx:366-476](file://components/ide/RightPanel.tsx#L366-L476)

### Backend API Route Integration
- Frontend components call Next.js API routes for classification, thinking, parsing, generation, validation, testing, feedback, final round, and project persistence.
- The home page coordinates these calls and updates state accordingly.

```mermaid
graph TB
HP["HomePage"] --> API1["/api/classify"]
HP --> API2["/api/think"]
HP --> API3["/api/parse"]
HP --> API4["/api/generate"]
HP --> API5["/api/projects"]
RP["RightPanel"] --> API6["/api/final-round"]
RP --> API7["/api/screenshot"]
SB["Sidebar"] --> API8["/api/projects"]
CW["CenterWorkspace"] --> API9["/api/feedback"]
```

**Diagram sources**
- [app/page.tsx:326-375](file://app/page.tsx#L326-L375)
- [app/page.tsx:180-310](file://app/page.tsx#L180-L310)
- [components/ide/RightPanel.tsx:421-432](file://components/ide/RightPanel.tsx#L421-L432)
- [components/ide/RightPanel.tsx:403-415](file://components/ide/RightPanel.tsx#L403-L415)
- [components/ide/Sidebar.tsx:50-59](file://components/ide/Sidebar.tsx#L50-L59)
- [components/FeedbackBar.tsx:53-83](file://components/FeedbackBar.tsx#L53-L83)

**Section sources**
- [app/page.tsx:122-310](file://app/page.tsx#L122-L310)
- [components/ide/RightPanel.tsx:287-311](file://components/ide/RightPanel.tsx#L287-L311)
- [components/ide/Sidebar.tsx:50-59](file://components/ide/Sidebar.tsx#L50-L59)
- [components/FeedbackBar.tsx:53-83](file://components/FeedbackBar.tsx#L53-L83)

## Dependency Analysis
- Provider coupling: Root layout depends on SessionProvider and WorkspaceProvider to enable authentication and workspace-aware UI.
- Component coupling: HomePage composes Sidebar, CenterWorkspace, and RightPanel; CenterWorkspace composes PromptInput, ThinkingPanel, and PipelineStatus; RightPanel composes SandpackPreview, GeneratedCode, A11yReport, and FeedbackBar.
- External dependencies: SandpackPreview relies on @codesandbox/sandpack-react; CodeMirror is used for code rendering.

```mermaid
graph LR
L["layout.tsx"] --> SP["SessionProvider.tsx"]
L --> WP["WorkspaceProvider.tsx"]
P["page.tsx"] --> SB["Sidebar.tsx"]
P --> CW["CenterWorkspace.tsx"]
P --> RP["RightPanel.tsx"]
CW --> PI["PromptInput.tsx"]
CW --> TP["ThinkingPanel.tsx"]
CW --> PS["PipelineStatus.tsx"]
RP --> SPV["SandpackPreview.tsx"]
RP --> GC["GeneratedCode.tsx"]
RP --> AR["A11yReport.tsx"]
RP --> FB["FeedbackBar.tsx"]
```

**Diagram sources**
- [app/layout.tsx:34-56](file://app/layout.tsx#L34-L56)
- [app/page.tsx:48-521](file://app/page.tsx#L48-L521)
- [components/ide/Sidebar.tsx:31-215](file://components/ide/Sidebar.tsx#L31-L215)
- [components/ide/CenterWorkspace.tsx:34-245](file://components/ide/CenterWorkspace.tsx#L34-L245)
- [components/ide/RightPanel.tsx:175-830](file://components/ide/RightPanel.tsx#L175-L830)
- [components/PromptInput.tsx:42-563](file://components/PromptInput.tsx#L42-L563)
- [components/ThinkingPanel.tsx:139-358](file://components/ThinkingPanel.tsx#L139-L358)
- [components/PipelineStatus.tsx:77-219](file://components/PipelineStatus.tsx#L77-L219)
- [components/SandpackPreview.tsx:144-287](file://components/SandpackPreview.tsx#L144-L287)
- [components/GeneratedCode.tsx:14-149](file://components/GeneratedCode.tsx#L14-L149)
- [components/A11yReport.tsx:97-193](file://components/A11yReport.tsx#L97-L193)
- [components/FeedbackBar.tsx:36-227](file://components/FeedbackBar.tsx#L36-L227)

**Section sources**
- [app/layout.tsx:34-56](file://app/layout.tsx#L34-L56)
- [app/page.tsx:48-521](file://app/page.tsx#L48-L521)

## Performance Considerations
- Debounced intent classification reduces API calls during typing.
- Conditional rendering avoids unnecessary re-renders (e.g., suppressing center workspace during direct refinement).
- Sandpack preview refresh and error boundaries prevent crashes and reduce reload overhead.
- Confidence gauges and suggestion chips are lazy-loaded to minimize initial payload.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Authentication errors: PipelineStatus displays an “Unauthorized” message and offers a sign-in action.
- Preview crashes: SandpackPreview’s error boundary shows a retry option.
- Network errors: HomePage sets pipeline errors and stages to error; users can retry from the prompt input.
- Feedback submission failures: FeedbackBar surfaces error messages with a retry option.

**Section sources**
- [components/PipelineStatus.tsx:166-215](file://components/PipelineStatus.tsx#L166-L215)
- [components/SandpackPreview.tsx:109-140](file://components/SandpackPreview.tsx#L109-L140)
- [app/page.tsx:344-347](file://app/page.tsx#L344-L347)
- [components/FeedbackBar.tsx:212-224](file://components/FeedbackBar.tsx#L212-L224)

## Conclusion
The presentation layer combines a robust provider model, a three-pane IDE-style interface, and a tightly integrated live preview system. Components coordinate through a clear pipeline that spans classification, thinking, parsing, generation, validation, and testing. The right panel elevates the developer experience with metrics, version history, and AI-driven feedback and final review. Together, these patterns deliver a responsive, accessible, and highly interactive authoring environment.