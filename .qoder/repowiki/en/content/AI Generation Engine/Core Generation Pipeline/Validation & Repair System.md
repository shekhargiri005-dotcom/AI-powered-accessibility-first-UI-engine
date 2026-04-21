# Validation & Repair System

<cite>
**Referenced Files in This Document**
- [route.ts](file://app/api/generate/route.ts)
- [codeAutoRepair.ts](file://lib/intelligence/codeAutoRepair.ts)
- [codeValidator.ts](file://lib/intelligence/codeValidator.ts)
- [repairPipeline.ts](file://lib/intelligence/repairPipeline.ts)
- [a11yValidator.ts](file://lib/validation/a11yValidator.ts)
- [schemas.ts](file://lib/validation/schemas.ts)
- [security.ts](file://lib/validation/security.ts)
- [inputValidator.ts](file://lib/intelligence/inputValidator.ts)
- [componentGenerator.ts](file://lib/ai/componentGenerator.ts)
- [uiReviewer.ts](file://lib/ai/uiReviewer.ts)
- [A11yReport.tsx](file://components/A11yReport.tsx)
- [codeAutoRepair.test.ts](file://__tests__/codeAutoRepair.test.ts)
- [a11yValidator.test.ts](file://__tests__/a11yValidator.test.ts)
- [security.test.ts](file://__tests__/security.test.ts)
</cite>

## Update Summary
**Changes Made**
- Added comprehensive code auto-repair system that operates as a pre-validation step
- Enhanced syntax validation and repair for style properties, token paths, and export statements
- Integrated deterministic auto-repair capabilities that complement existing accessibility auto-repair
- Updated architecture to include pre-validation auto-repair phase before browser safety checks
- Added new codeAutoRepair module with regex-based fixes for common AI-generated code mistakes
- Enhanced repair pipeline with additional rule-based repairs and AI-assisted fallback

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
This document describes the validation and auto-repair system embedded in the generation pipeline. It covers:
- Comprehensive code validation for syntax errors, semantic correctness, and React component compliance
- Enhanced auto-repair capabilities that operate as a pre-validation step, fixing common AI-generated code mistakes
- An adaptive repair pipeline that applies rule-based fixes first, optionally followed by AI-assisted repairs
- WCAG 2.1 AA–aligned accessibility validation and automated repair
- Strategy selection based on model tier and resource availability
- Quality assessment criteria and scoring
- Examples of successful validation and repair outcomes, plus troubleshooting guidance

## Project Structure
The validation and repair system spans several modules:
- Route orchestration: [route.ts](file://app/api/generate/route.ts)
- Pre-validation auto-repair: [codeAutoRepair.ts](file://lib/intelligence/codeAutoRepair.ts)
- Validation utilities: [codeValidator.ts](file://lib/intelligence/codeValidator.ts), [repairPipeline.ts](file://lib/intelligence/repairPipeline.ts), [security.ts](file://lib/validation/security.ts), [inputValidator.ts](file://lib/intelligence/inputValidator.ts)
- Repair orchestration: [uiReviewer.ts](file://lib/ai/uiReviewer.ts), [componentGenerator.ts](file://lib/ai/componentGenerator.ts)
- Accessibility validation: [a11yValidator.ts](file://lib/validation/a11yValidator.ts)
- UI reporting: [A11yReport.tsx](file://components/A11yReport.tsx)
- Tests: [codeAutoRepair.test.ts](file://__tests__/codeAutoRepair.test.ts), [a11yValidator.test.ts](file://__tests__/a11yValidator.test.ts), [security.test.ts](file://__tests__/security.test.ts)

```mermaid
graph TB
subgraph "API Layer"
R["app/api/generate/route.ts"]
end
subgraph "Pre-Validation Auto-Repair"
CAR["lib/intelligence/codeAutoRepair.ts"]
end
subgraph "Validation"
CV["lib/intelligence/codeValidator.ts"]
RP["lib/intelligence/repairPipeline.ts"]
SEC["lib/validation/security.ts"]
IV["lib/intelligence/inputValidator.ts"]
end
subgraph "Repair"
UR["lib/ai/uiReviewer.ts"]
CG["lib/ai/componentGenerator.ts"]
end
subgraph "Accessibility"
AV["lib/validation/a11yValidator.ts"]
end
subgraph "UI"
AR["components/A11yReport.tsx"]
end
R --> CAR
R --> IV
R --> CV
R --> RP
R --> SEC
R --> AV
R --> UR
R --> CG
AV --> AR
```

**Diagram sources**
- [route.ts:25-401](file://app/api/generate/route.ts#L25-L401)
- [codeAutoRepair.ts:1-107](file://lib/intelligence/codeAutoRepair.ts#L1-L107)
- [codeValidator.ts:1-386](file://lib/intelligence/codeValidator.ts#L1-L386)
- [repairPipeline.ts:1-287](file://lib/intelligence/repairPipeline.ts#L1-L287)
- [security.ts:1-129](file://lib/validation/security.ts#L1-L129)
- [inputValidator.ts:1-137](file://lib/intelligence/inputValidator.ts#L1-L137)
- [uiReviewer.ts:1-199](file://lib/ai/uiReviewer.ts#L1-L199)
- [componentGenerator.ts:1-436](file://lib/ai/componentGenerator.ts#L1-L436)
- [a11yValidator.ts:1-376](file://lib/validation/a11yValidator.ts#L1-L376)
- [A11yReport.tsx:1-193](file://components/A11yReport.tsx#L1-L193)

**Section sources**
- [route.ts:25-401](file://app/api/generate/route.ts#L25-L401)

## Core Components
- Input validation: [validatePromptInput:53-117](file://lib/intelligence/inputValidator.ts#L53-L117), [validateGenerationMode:119-125](file://lib/intelligence/inputValidator.ts#L119-L125)
- Pre-validation auto-repair: [autoRepairCode:25-93](file://lib/intelligence/codeAutoRepair.ts#L25-L93), [needsRepair:98-107](file://lib/intelligence/codeAutoRepair.ts#L98-L107)
- Deterministic syntax and structural validation: [validateGeneratedCode:262-362](file://lib/intelligence/codeValidator.ts#L262-L362)
- Browser safety validation: [validateBrowserSafeCode:6-34](file://lib/validation/security.ts#L6-L34), [sanitizeGeneratedCode:44-128](file://lib/validation/security.ts#L44-L128)
- Accessibility validation and auto-repair: [validateAccessibility:264-297](file://lib/validation/a11yValidator.ts#L264-L297), [autoRepairA11y:303-375](file://lib/validation/a11yValidator.ts#L303-L375)
- Rule-based repair pipeline: [applyRuleBasedRepairs:210-229](file://lib/intelligence/repairPipeline.ts#L210-L229), [runRepairPipeline:238-286](file://lib/intelligence/repairPipeline.ts#L238-L286)
- UI expert review and repair: [reviewGeneratedCode:58-126](file://lib/ai/uiReviewer.ts#L58-L126), [repairGeneratedCode:137-199](file://lib/ai/uiReviewer.ts#L137-L199)
- Generation-time repair integration: [generateComponent:63-435](file://lib/ai/componentGenerator.ts#L63-L435)

**Section sources**
- [inputValidator.ts:53-125](file://lib/intelligence/inputValidator.ts#L53-L125)
- [codeAutoRepair.ts:25-107](file://lib/intelligence/codeAutoRepair.ts#L25-L107)
- [codeValidator.ts:262-362](file://lib/intelligence/codeValidator.ts#L262-L362)
- [security.ts:6-128](file://lib/validation/security.ts#L6-L128)
- [a11yValidator.ts:264-375](file://lib/validation/a11yValidator.ts#L264-L375)
- [repairPipeline.ts:210-286](file://lib/intelligence/repairPipeline.ts#L210-L286)
- [uiReviewer.ts:58-199](file://lib/ai/uiReviewer.ts#L58-L199)
- [componentGenerator.ts:63-435](file://lib/ai/componentGenerator.ts#L63-L435)

## Architecture Overview
The generation pipeline performs validation and repair in stages with enhanced pre-validation auto-repair capabilities:
1. Input sanitization and intent parsing
2. Pre-validation auto-repair for common AI syntax errors (style props, token paths, exports)
3. Deterministic syntax and structural validation
4. Optional UI expert review and repair (conditional based on provider tier)
5. Browser safety validation and sanitization
6. Parallel accessibility validation and test generation
7. Dependency resolution and persistence

**Updated** The system now includes a comprehensive pre-validation auto-repair phase that catches and fixes common AI-generated code mistakes before they reach the deterministic validation stage, significantly improving the success rate of code generation.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Route as "Generate Route"
participant CAR as "autoRepairCode"
participant Gen as "generateComponent"
participant CV as "validateGeneratedCode"
participant RP as "runRepairPipeline"
participant UR as "reviewGeneratedCode"
participant RR as "repairGeneratedCode"
participant AV as "validateAccessibility/autoRepairA11y"
participant SEC as "validateBrowserSafeCode/sanitize"
Client->>Route : POST /api/generate
Route->>CAR : needsRepair(code)
alt Code needs repair
Route->>CAR : autoRepairCode(code)
CAR-->>Route : {code, fixes, hadErrors}
end
Route->>Gen : generateComponent(intent, mode, ...)
Gen-->>Route : {code, blueprint, validationWarnings, repairsApplied}
Route->>CV : validateGeneratedCode(code)
alt Deterministic fails
Route->>RP : runRepairPipeline(code)
RP-->>Route : {code, repairsApplied}
end
opt Cloud reviewer available (non-free tier)
Route->>UR : reviewGeneratedCode(code, intent)
alt Needs repair
Route->>RR : repairGeneratedCode(code, critiques)
RR-->>Route : repairedCode
end
end
Route->>SEC : validateBrowserSafeCode(code)
SEC-->>Route : {isValid, issues}
par Parallel A11y + Tests
Route->>AV : validateAccessibility(code)
AV-->>Route : {passed, score, violations, suggestions}
and
Route->>Route : generateTests(intent, code)
end
Route-->>Client : {code, a11yReport, tests, autoRepairs, ...}
```

**Diagram sources**
- [route.ts:25-401](file://app/api/generate/route.ts#L25-L401)
- [codeAutoRepair.ts:25-107](file://lib/intelligence/codeAutoRepair.ts#L25-L107)
- [componentGenerator.ts:63-435](file://lib/ai/componentGenerator.ts#L63-L435)
- [codeValidator.ts:262-362](file://lib/intelligence/codeValidator.ts#L262-L362)
- [repairPipeline.ts:238-286](file://lib/intelligence/repairPipeline.ts#L238-L286)
- [uiReviewer.ts:58-199](file://lib/ai/uiReviewer.ts#L58-L199)
- [a11yValidator.ts:264-375](file://lib/validation/a11yValidator.ts#L264-L375)
- [security.ts:6-128](file://lib/validation/security.ts#L6-L128)

## Detailed Component Analysis

### Pre-Validation Auto-Repair System
Purpose:
- Catch and fix common AI-generated code syntax errors before deterministic validation
- Operates as a deterministic, regex-based fixer that runs immediately after code extraction
- Prevents common mistakes like invalid style prop syntax, wrong token paths, and missing exports

Key behaviors:
- Fixes invalid style prop syntax (style= ... → style={{...}})
- Corrects wrong token paths (colors.text.primary.fg → colors.text.primary)
- Adds missing export default statements
- Fixes incomplete/spread syntax in JSX
- Detects and fixes unclosed JSX expressions

Scoring and thresholds:
- Returns fixes array with specific repair descriptions
- hadErrors flag indicates whether any repairs were applied
- Works independently of validation results to maximize success rate

```mermaid
flowchart TD
Start(["autoRepairCode"]) --> CheckStyle["Check for invalid style prop syntax"]
CheckStyle --> FixSpread["Fix spread syntax without braces"]
FixSpread --> FixObject["Fix object property assignment without braces"]
FixObject --> CheckTokens["Check for wrong token paths"]
CheckTokens --> FixTokens["Fix colors.text.*.fg/bg to colors.text.*"]
FixTokens --> CheckExport["Check for missing export default"]
CheckExport --> AddExport["Add export default if missing"]
AddExport --> CheckExpressions["Check for unclosed JSX expressions"]
CheckExpressions --> FixExpressions["Fix unclosed style={{...}} expressions"]
FixExpressions --> Return(["Return {code, fixes, hadErrors}"])
```

**Diagram sources**
- [codeAutoRepair.ts:25-107](file://lib/intelligence/codeAutoRepair.ts#L25-L107)

**Section sources**
- [codeAutoRepair.ts:25-107](file://lib/intelligence/codeAutoRepair.ts#L25-L107)
- [codeAutoRepair.test.ts:1-108](file://__tests__/codeAutoRepair.test.ts#L1-L108)

### Deterministic Syntax and Structural Validation
Purpose:
- Catch truncation, missing exports, JSX imbalance, and unsafe patterns before preview.
- Provide warnings for accessibility-first guidance.

Key behaviors:
- Unbalanced brackets/braces detection for truncation hints
- Structural heuristics for exports, JSX presence, and excessive dynamic imports
- Accessibility warnings for common issues (e.g., missing alt, icon-only buttons)

Scoring and thresholds:
- Errors block preview; warnings inform improvements.

```mermaid
flowchart TD
Start(["validateGeneratedCode"]) --> CheckEmpty["Check non-empty string"]
CheckEmpty --> BrowserUnsafe["Scan for browser-unsafe imports/usage"]
BrowserUnsafe --> RegistryHalluc["Detect hallucinated external libs"]
RegistryHalluc --> Structural["Run structural heuristics"]
Structural --> BracesCheck["Balance braces/paren/brackets"]
BracesCheck --> A11yWarns["Run accessibility warnings"]
A11yWarns --> Aggregate["Aggregate errors/warnings"]
Aggregate --> End(["Return {valid, errors, warnings, summary}"])
```

**Diagram sources**
- [codeValidator.ts:262-362](file://lib/intelligence/codeValidator.ts#L262-L362)

**Section sources**
- [codeValidator.ts:262-362](file://lib/intelligence/codeValidator.ts#L262-L362)

### Rule-Based Repair Pipeline
Purpose:
- Apply systematic fixes for common generation failures before preview.
- Provides deterministic repairs that don't require AI reasoning.

Key behaviors:
- Removes browser-unsafe imports and TTY API calls
- Replaces hallucinated library imports with available alternatives
- Adds missing export default statements
- Fixes CSS @import ordering and multi-line template literals
- Removes duplicate export statements

```mermaid
flowchart TD
Start(["runRepairPipeline"]) --> RuleRepairs["Apply rule-based repairs"]
RuleRepairs --> Validate["Re-validate repaired code"]
Validate --> Valid{"Valid?"}
Valid --> |Yes| Success["Return repaired code"]
Valid --> |No| AIRepair["AI repair fallback"]
AIRepair --> Revalidate["Re-validate AI-repaired code"]
Revalidate --> Finalize["Return final result"]
```

**Diagram sources**
- [repairPipeline.ts:238-286](file://lib/intelligence/repairPipeline.ts#L238-L286)

**Section sources**
- [repairPipeline.ts:210-286](file://lib/intelligence/repairPipeline.ts#L210-L286)

### Browser Safety and Sanitization
Purpose:
- Ensure generated code is safe for the browser sandbox (no Node/tty APIs).
- Fix common AI artifacts that break the parser.

Key behaviors:
- Detect Node/tty imports and disallowed methods
- Validate default export presence
- Sanitize multi-line template literals and comment artifacts

```mermaid
flowchart TD
S(["validateBrowserSafeCode"]) --> UnsafeImports["Detect unsafe imports/TTY APIs"]
UnsafeImports --> ExportCheck["Check for export default/function"]
ExportCheck --> Result["{isValid, issues}"]
SanStart(["sanitizeGeneratedCode"]) --> FlattenTpl["Flatten multi-line template literals"]
FlattenTpl --> StripCR["Remove carriage returns"]
StripCR --> CleanComments["Replace comment-only JSX attrs/functions"]
CleanComments --> FixStray["Collapse stray semicolons and braces"]
FixStray --> SanEnd(["Sanitized code"])
```

**Diagram sources**
- [security.ts:6-128](file://lib/validation/security.ts#L6-L128)

**Section sources**
- [security.ts:6-128](file://lib/validation/security.ts#L6-L128)

### Accessibility Validation and Auto-Repair (WCAG 2.1 AA)
Purpose:
- Static analysis against WCAG 2.1 AA rules with scoring and suggestions.
- Automated repair for common issues.

Rule coverage:
- Form inputs require labels
- Buttons require accessible names
- Images require alt text
- Forms should have labels or legends
- Headings must follow logical hierarchy
- Interactive elements must be keyboard accessible
- Error messages should be announced to assistive tech
- Color contrast expectations for light/dark contexts
- Focus visibility for keyboard navigation

Scoring:
- Starts at 100; subtracts 10 per hard error, 3 per warning
- Passed when no hard errors

Auto-repair strategies:
- Adds focus ring replacements for outline-none without focus ring
- Adds role="alert" and aria-live="polite" to error containers
- Adds aria-label to unlabeled inputs derived from placeholder/name/id
- Adds aria-label to icon-only buttons

```mermaid
flowchart TD
VA(["validateAccessibility"]) --> Iterate["Iterate A11y rules"]
Iterate --> Check["Run rule.check(code)"]
Check --> Violations{"Any violations?"}
Violations --> |Yes| Collect["Collect {ruleId, severity, element, suggestion}"]
Violations --> |No| Score["Compute score (100 - 10*err - 3*warn)"]
Collect --> Score
Score --> Report["Return {passed, score, violations, suggestions}"]
AR(["autoRepairA11y"]) --> FixFocus["Replace outline-none with focus:ring-*"]
FixFocus --> FixErrors["Add role='alert' aria-live='polite' to error text"]
FixErrors --> FixInputs["Add aria-label to unlabeled inputs"]
FixInputs --> FixButtons["Add aria-label to icon-only buttons"]
FixButtons --> AROut["Return {code, appliedFixes}"]
```

**Diagram sources**
- [a11yValidator.ts:264-375](file://lib/validation/a11yValidator.ts#L264-L375)

**Section sources**
- [a11yValidator.ts:264-375](file://lib/validation/a11yValidator.ts#L264-L375)
- [A11yReport.tsx:97-193](file://components/A11yReport.tsx#L97-L193)
- [a11yValidator.test.ts:1-110](file://__tests__/a11yValidator.test.ts#L1-L110)

### UI Expert Review and Repair
Purpose:
- Second-pass review for visual quality, layout, and production-readiness.
- Optional AI-assisted repair when reviewer detects issues.

**Updated** The system now uses conditional logic to skip review/repair phases for free-tier providers to conserve API quotas and avoid rate limiting.

Workflow:
- Reviewer evaluates code against a strict schema and returns a pass/fail score with critiques and optional repair instructions.
- If failing, repair agent applies exact repair instructions to produce a fixed component.
- Free-tier providers (Google without paid key) skip review entirely unless a dedicated REVIEW_MODEL is configured.

```mermaid
sequenceDiagram
participant Route as "Generate Route"
participant UR as "reviewGeneratedCode"
participant RR as "repairGeneratedCode"
Route->>Route : Check provider tier (isFreeTierProvider)
alt Not free tier
Route->>UR : reviewGeneratedCode(code, intent)
UR-->>Route : {passed, score, critiques, repairInstructions?}
alt needs repair
Route->>RR : repairGeneratedCode(code, repairInstructions)
RR-->>Route : repairedCode
else pass
Route-->>Route : continue with current code
end
else free tier
Route->>Route : Skip review/repair (conserving API quota)
end
```

**Diagram sources**
- [route.ts:229-271](file://app/api/generate/route.ts#L229-L271)
- [uiReviewer.ts:58-199](file://lib/ai/uiReviewer.ts#L58-L199)

**Section sources**
- [uiReviewer.ts:58-199](file://lib/ai/uiReviewer.ts#L58-L199)
- [route.ts:229-271](file://app/api/generate/route.ts#L229-L271)

### Generation-Time Repair Integration
Purpose:
- Apply deterministic repairs during generation when model tier permits.
- Fall back to rule-based repair when AI repair is not available.

Key logic:
- Determines whether AI repair is allowed based on model tier and pipeline config
- Invokes repair pipeline and aggregates applied repairs

```mermaid
flowchart TD
CGStart(["generateComponent"]) --> Validate["validateGeneratedCode(beautified.code)"]
Validate --> Valid{"valid?"}
Valid --> |Yes| Continue["Proceed to beautification and export"]
Valid --> |No| CanAI{"canUseAiRepair?"}
CanAI --> |Yes| RunRP["runRepairPipeline(code, repairGeneratedCode)"]
CanAI --> |No| RunRPOnly["runRepairPipeline(code)"]
RunRP --> Final["finalCode, repairsApplied"]
RunRPOnly --> Final
```

**Diagram sources**
- [componentGenerator.ts:394-409](file://lib/ai/componentGenerator.ts#L394-L409)

**Section sources**
- [componentGenerator.ts:394-409](file://lib/ai/componentGenerator.ts#L394-L409)

## Dependency Analysis
- The generation route orchestrates all validations and repairs, with the new pre-validation auto-repair phase catching common syntax errors before expensive reviewer calls.
- Pre-validation auto-repair operates independently of deterministic validation to maximize success rates.
- Deterministic validation is performed after auto-repair to catch any remaining issues.
- Accessibility validation runs in parallel with test generation to optimize throughput.
- Security sanitization occurs after reviewer repairs to preserve fixes while ensuring browser compatibility.

**Updated** The simplified architecture removes the visionReviewer dependency and adds the new pre-validation auto-repair phase, making the system more efficient and provider-tier aware.

```mermaid
graph LR
Route["route.ts"] --> CAR["codeAutoRepair.ts"]
Route --> CV["codeValidator.ts"]
Route --> RP["repairPipeline.ts"]
Route --> SEC["security.ts"]
Route --> AV["a11yValidator.ts"]
Route --> UR["uiReviewer.ts"]
Route --> CG["componentGenerator.ts"]
CG --> CV
CG --> RP
CG --> UR
CG --> AV
CG --> SEC
```

**Diagram sources**
- [route.ts:25-401](file://app/api/generate/route.ts#L25-L401)
- [codeAutoRepair.ts:25-107](file://lib/intelligence/codeAutoRepair.ts#L25-L107)
- [codeValidator.ts:262-362](file://lib/intelligence/codeValidator.ts#L262-L362)
- [repairPipeline.ts:210-286](file://lib/intelligence/repairPipeline.ts#L210-L286)
- [security.ts:6-128](file://lib/validation/security.ts#L6-L128)
- [a11yValidator.ts:264-375](file://lib/validation/a11yValidator.ts#L264-L375)
- [uiReviewer.ts:58-199](file://lib/ai/uiReviewer.ts#L58-L199)
- [componentGenerator.ts:63-435](file://lib/ai/componentGenerator.ts#L63-L435)

**Section sources**
- [route.ts:25-401](file://app/api/generate/route.ts#L25-L401)

## Performance Considerations
- Pre-validation auto-repair reduces unnecessary reviewer calls and speeds up the pipeline by catching common syntax errors early.
- Early deterministic validation reduces unnecessary reviewer calls and speeds up the pipeline.
- Parallel execution of accessibility validation and test generation minimizes total latency.
- **Updated** Provider tier awareness skips expensive review/repair phases for free-tier providers, significantly reducing API costs and avoiding rate limiting.
- Security sanitization avoids costly retries by fixing parser-breaking artifacts upfront.
- Model tier awareness selects appropriate repair strategies to balance quality and cost.
- **Updated** The new pre-validation auto-repair system provides deterministic fixes that are much faster than AI-based repairs, improving overall pipeline performance.

**Updated** The new pre-validation auto-repair system conserves API quotas by fixing common syntax errors deterministically, making the system more cost-effective while maintaining high-quality, accessible, and production-ready React components.

## Troubleshooting Guide
Common validation failures and resolutions:
- Pre-validation auto-repair failures
  - Cause: Common AI-generated syntax errors like invalid style props, wrong token paths, or missing exports
  - Resolution: The auto-repair system automatically fixes these issues before validation. Check the autoRepairs array in the response for specific fixes applied.
  - Reference: [route.ts:194-203](file://app/api/generate/route.ts#L194-L203), [codeAutoRepair.ts:25-107](file://lib/intelligence/codeAutoRepair.ts#L25-L107)

- Deterministic validation errors
  - Cause: Truncated or malformed code (unbalanced braces/brackets), missing export, or insufficient JSX.
  - Resolution: The pipeline attempts AI repair with specific reasons. If not available, ensure the model tier supports AI repair or rely on deterministic fixes.
  - Reference: [route.ts:208-219](file://app/api/generate/route.ts#L208-L219), [codeValidator.ts:262-362](file://lib/intelligence/codeValidator.ts#L262-L362)

- Browser safety violations
  - Cause: Node/tty imports, process.exit, or missing export.
  - Resolution: Remove unsafe imports and ensure a default export; the sanitizer also cleans common artifacts.
  - Reference: [security.ts:6-34](file://lib/validation/security.ts#L6-L34), [security.ts:44-128](file://lib/validation/security.ts#L44-L128)

- Accessibility violations
  - Cause: Missing alt attributes, unlabeled inputs/buttons, heading hierarchy issues, low contrast, or missing focus indicators.
  - Resolution: Auto-repair applies targeted fixes; review suggestions in the accessibility report.
  - Reference: [a11yValidator.ts:264-375](file://lib/validation/a11yValidator.ts#L264-L375), [A11yReport.tsx:97-193](file://components/A11yReport.tsx#L97-L193)

- Reviewer/repair unavailability
  - Cause: Provider quota limits or missing API keys.
  - Resolution: The system defaults to pass and continues with original code; add keys or switch providers.
  - **Updated** Free-tier providers automatically skip review/repair to conserve API quotas.
  - Reference: [uiReviewer.ts:115-125](file://lib/ai/uiReviewer.ts#L115-L125), [route.ts:229-271](file://app/api/generate/route.ts#L229-L271)

- Provider tier detection issues
  - Cause: Incorrect provider configuration or missing REVIEW_MODEL environment variable.
  - Resolution: Configure appropriate provider settings or set REVIEW_MODEL for dedicated review capabilities.
  - Reference: [route.ts:229-234](file://app/api/generate/route.ts#L229-L234)

## Conclusion
The validation and auto-repair system integrates comprehensive pre-validation auto-repair capabilities, deterministic checks, accessibility scanning, browser safety sanitization, and optional expert review. **Updated** The enhanced system now includes a pre-validation auto-repair phase that catches and fixes common AI-generated code mistakes before they reach the deterministic validation stage, significantly improving the success rate of code generation. The system adapts repair strategies to model capabilities and environment constraints, ensuring efficient delivery of quality UI components while conserving API quotas and improving overall performance.