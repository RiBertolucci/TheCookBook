# GitHub Copilot Chat Prompt Guidelines

## Purpose

Use this file as context when generating or refining prompts for GitHub Copilot Chat.

Goal of this file:
- improve prompt quality for GitHub Copilot Chat
- provide a compact and agent-readable ruleset
- cover all major techniques summarized in `prompt_optimization.md`
- optimize prompts for real coding tasks on existing repositories

This is a single shared guidelines file for Claude Sonnet 4, GPT 5.4, Claude Haiku 4.5, and Gemini 2.5 Pro.
Separate per-model files are not required because the core techniques are shared. Model differences mainly affect prompt emphasis, structure, and scope, not the fundamental technique set.

## Copilot-Specific Operating Assumptions

- GitHub Copilot Chat uses the current prompt, selected/open code, and chat history as context.
- Standard Copilot Chat does not reliably expose direct low-level sampling controls such as `temperature`, `top_p`, or `top_k`.
- In Copilot Chat, behavior is tuned mainly through prompt structure, scope control, examples, constraints, thread management, and model choice.
- Prefer the smallest relevant context that still preserves correctness.
- Prefer one thread per task. Start a fresh thread when the task changes materially.

## Primary Objective When Writing a Prompt

Every prompt should be:
- specific
- grounded in explicit repository context
- minimal in irrelevant tokens
- structured with clear boundaries
- validation-oriented
- easy to continue across multiple turns

## Mandatory Prompt Construction Order

Build prompts in this order. When a meaningful role is available, put it first. If no concrete role improves control, start with Goal.

1. Role
2. Goal
3. Relevant scope
4. Context or evidence
5. Constraints
6. Required output
7. Validation request

If the task is large, place the long context before the final question.

## Canonical Prompt Skeleton

```text
Role:
[clear role that changes expertise, audience, tone, or evaluation lens]

Goal:
[one sentence describing the task]

Relevant files / symbols:
- [file, function, class, test, config, doc]

Context:
[short repository or task context]

Evidence:
[error, failing behavior, code snippet, test, log, example]

Constraints:
- [preserve API]
- [no new dependencies]
- [version or framework limit]
- [scope limit]

Output:
[minimal patch / explanation / review findings / refactor options / tests]

Validation:
[tests to add or run, assumptions, risks, regression checks]
```

## Core Rules

1. Start with the goal, then add specific requirements.
2. Make the role explicit when the task implies a meaningful expertise, audience, tone, or review lens.
3. Name the exact files, symbols, errors, tests, or documents involved.
4. Include only the context that changes the answer.
5. Separate instructions, context, evidence, and output expectations.
6. Ask for the smallest useful result first.
7. Ask for validation, tests, edge cases, or regression checks.
8. Iterate based on failure mode instead of repeating the same prompt.
9. Reset or summarize when thread history starts to drift.

## Technique Guidelines

### 1. Specificity and Task Framing

Use this technique to reduce ambiguity and improve control.

Rules:
- state exactly what must be done
- define what success looks like
- name the owning file, method, class, test, route, or config
- specify if the output should be a patch, explanation, checklist, review, or options

Good pattern:

```text
Goal:
Fix the null-handling bug in UserMapper.

Constraints:
- keep the DTO contract unchanged
- modify only the mapping layer
- add one regression test
```

Avoid:
- "fix this"
- "improve this"
- "optimize this" without measurable criteria

### 2. Token Optimization

Token optimization in Copilot Chat means maximizing relevant information density.

Rules:
- include the deciding artifact first: failing test, error, method, interface, or config
- include one adjacent dependency only if behavior crosses that boundary
- replace large unchanged files with a short repository map
- add more context only when the first answer is clearly under-informed
- remove logs, files, and history that do not affect the requested decision

Prefer:

```text
Bug: auth redirect loop after login.

Relevant files:
- AuthMiddleware.ts
- auth.spec.ts

Observed failure:
- /login redirects back to /login indefinitely
```

Avoid:
- dumping multiple full files when only one method matters
- sending long logs without marking the decisive lines
- mixing unrelated tasks in one prompt

### 3. Context Window Management

Context window management is mainly a conversation-management problem.

Rules:
- use one thread per bug, feature, review, or refactor
- when the task is large, place long context before the final request
- use summary checkpoints after several turns
- start a fresh thread when the subsystem, task type, or objective changes
- carry forward only accepted findings, not the entire previous discussion

Useful checkpoint:

```text
Current state:
- goal: fix null handling in UserMapper
- files in scope: UserMapper.ts, UserMapper.test.ts
- accepted finding: profile is optional from the API
- remaining task: implement fix and add regression test
```

### 4. Delimiter Optimization

Use delimiters to separate instructions from evidence and prevent boundary confusion.

Rules:
- use headings or labeled sections
- use fenced code blocks for code, logs, tests, and configs
- keep section names stable across prompts
- separate background context from binding constraints

Recommended sections:

```text
# Goal
# Relevant files / symbols
# Context
# Evidence
# Constraints
# Output
# Validation
```

Use delimiters especially when:
- you include both prose and code
- you include logs or test failures
- you require a specific output format
- the task spans multiple files or documents

### 5. Examples and Tests as Examples

Examples are one of the highest-value steering tools.

Rules:
- provide examples when output shape or implementation pattern matters
- use 1-3 representative examples rather than many repetitive ones
- use unit tests as executable examples when possible
- prefer examples that reflect the real repository conventions

Good pattern:

```text
Follow the same repository pattern as these examples.

Example 1:
- Input: UserRepository.findById(id)
- Behavior: returns null if not found

Example 2:
- Input: OrderRepository.findById(id)
- Behavior: returns null if not found

Now implement ProductRepository.findById(id) using the same conventions.
```

### 6. Chain-of-Thought Implementation

In Copilot Chat, do not ask for long raw reasoning dumps by default.
Prefer visible task decomposition.

Rules:
- request a short step plan for complex tasks
- break complex work into diagnosis, fix, validation, and follow-up
- use decomposition for debugging, refactors, and multi-file reasoning
- do not force long reasoning traces for simple tasks

Preferred pattern:

```text
Step 1: identify the likely root cause.
Step 2: propose the smallest safe fix.
Step 3: implement the fix.
Step 4: add or update tests.
```

Use when:
- the failure mode is unclear
- the task spans multiple modules
- trade-offs matter

Avoid when:
- generating simple boilerplate
- explaining a small function
- the extra reasoning structure is longer than the task itself

### 7. Role-Based Prompting

Prefer role prompting when it sharpens expertise, target audience, tone, evaluation lens, or output artifact.
For prompt-generation tasks, default to including a concrete `Role:` section unless no role would materially improve the instruction.

Good roles:
- security reviewer
- performance engineer
- senior maintainer
- migration lead
- test engineer
- technical documentation specialist writing for a named audience

Good pattern:

```text
Act as a security reviewer for this Node.js route.

Review for:
- input validation gaps
- auth bypass risk
- sensitive data exposure

Return:
1. findings
2. minimal fixes
3. tests to add
```

Avoid:
- vanity roles with no operational meaning
- vague roles that add status words but no expertise, audience, or output constraints

### 8. Dynamic Prompt Adaptation

Iteration should respond to failure mode, not repeat the same request.

If the answer is too generic:
- add exact file names
- add the observed error or failing behavior
- add the expected behavior

If the answer is too broad:
- restrict the task to one function or file
- ask for the smallest safe patch first

If the answer ignores constraints:
- isolate non-negotiables in a separate section
- remove contradictory instructions

If the answer over-explores:
- cut context down to the owning code path
- request the next concrete step only

If the answer under-explores:
- add one adjacent dependency
- ask for options with trade-offs

### 9. Error Prevention

Prevent failure by constraining the solution space before generation.

High-value constraints:
- preserve public API
- keep framework or language version fixed
- do not add dependencies
- maintain backward compatibility
- handle null, empty, and error paths
- keep changes scoped to a specific layer
- include tests or validation steps

Good pattern:

```text
Non-negotiable constraints:
- preserve the REST contract
- do not change the database schema
- support Spring Boot 3.2
- validate null and empty inputs
- include one regression test
```

Also ask for:
- explicit assumptions
- uncovered edge cases
- regression risks

### 10. Quality Assurance

Every strong Copilot prompt should ask for validation artifacts, not just code.

Ask for:
- tests to add or update
- assumptions that need external verification
- edge cases still uncovered
- regression checklist
- risks or trade-offs

Useful QA addition:

```text
After proposing the fix, also provide:
- tests to add or update
- edge cases not covered yet
- assumptions that require external verification
- a short regression checklist
```

### 11. Memory and Multi-Turn Management

Use these rules for longer Copilot Chat sessions.

Rules:
- summarize accepted state after several turns
- restate goal and constraints before requesting the next step
- drop stale history when it no longer helps
- start a fresh thread for a new task instead of carrying over irrelevant discussion
- preserve only durable context: goal, files, findings, remaining work

## Parameter Tuning Guidelines for GitHub Copilot Chat

### Core Rule

Do not assume direct access to raw sampling controls such as `temperature`, `top_p`, `top_k`, or low-level reasoning budgets inside standard GitHub Copilot Chat.

In Copilot Chat, parameter tuning is done indirectly through:
- prompt specificity
- scope size
- structure and delimiters
- examples
- model selection
- output constraints
- thread reset or continuation strategy
- request for options versus one answer

### Practical Tuning Modes

| Mode | When to use | How to tune the prompt |
| --- | --- | --- |
| Precision mode | bug fixes, exact patches, focused explanations, test updates | narrow scope, explicit constraints, one output, minimal patch, validation required |
| Balanced mode | normal implementation, refactor, documentation, structured analysis | clear sections, moderate context, explicit output format, risks and tests requested |
| Exploration mode | design options, alternative implementations, architecture choices | ask for 2-3 options, trade-offs, migration cost, regression risk |
| Review mode | code review, security review, performance review | define review lens, define severity bar, request findings only, ask for confidence or impact |

### Copilot-Safe Equivalents to API Parameter Tuning

If you want more deterministic output in Copilot Chat:
- reduce scope
- ask for one solution, not several
- specify exact output format
- isolate non-negotiable constraints
- ask for the smallest safe patch

If you want broader exploration in Copilot Chat:
- ask for 2-3 options
- ask for trade-offs and risks
- allow wider context when architecture matters
- request comparison before implementation

If you want shorter output:
- require concise output in the `Output` section
- ask for bullets, checklist, or minimal patch only

If you want more exhaustive output:
- ask for assumptions, edge cases, test plan, and regression risks explicitly

### External-API Note

If the workflow is outside standard Copilot Chat and exposes raw model parameters, use the external platform documentation for those controls. Do not import generic `temperature` or `top_p` defaults into a Copilot-only prompting workflow unless the actual interface exposes them.

## Model-Specific Adjustments

Use the shared techniques above for every supported model, then apply the smallest relevant adjustment below.

### Claude Sonnet 4

- prefer explicit structure
- keep context, constraints, and output separate
- put large context before the final question
- use examples when output pattern matters

Best for:
- multi-file reasoning
- structured review
- long-context explanation

### GPT 5.4

- define the exact deliverable
- keep instructions contradiction-free
- list non-negotiable constraints separately
- use short corrective follow-ups when refining answers

Best for:
- balanced implementation work
- editing existing code
- explanations with precise output control

### Claude Haiku 4.5

- keep prompts short and single-purpose
- minimize context to the smallest sufficient slice
- ask for one outcome at a time
- avoid large multi-objective prompts

Best for:
- quick code explanation
- one focused patch
- one review pass on a small code slice

### Gemini 2.5 Pro

- use clearly labeled sections
- supply broad context only when the task truly spans many files or documents
- place the final request after the supporting context on large prompts
- use examples when output format matters

Best for:
- large-context tasks
- multi-file analysis
- code plus documentation reasoning

## Reusable Prompt Templates

### Generic Engineering Task

```text
Role:
[clear role that sharpens expertise, audience, or evaluation lens]

Goal:
[describe the task]

Relevant files / symbols:
- [file or symbol]

Context:
[short task context]

Evidence:
[error, code, failing behavior, test, doc]

Constraints:
- [constraint]

Output:
[patch / explanation / options / review]

Validation:
- tests to add or update
- assumptions
- risks
```

### Targeted Bug Fix

```text
Goal:
Fix the null-handling bug in UserMapper.

Relevant files:
- UserMapper.ts
- UserMapper.test.ts

Observed failure:
- TypeError: Cannot read properties of undefined (reading 'name')

Constraints:
- keep the current API contract
- do not add dependencies
- add one regression test

Output:
- minimal patch
- short explanation

Validation:
- tests to add or update
- remaining edge cases
```

### Focused Code Review

```text
Role:
Act as a code reviewer.

Review for:
- correctness bugs
- security issues
- regression risk

Scope:
- report only findings that could cause incorrect behavior, a test failure, or a misleading result

Files:
- [file 1]
- [file 2]

Output:
- findings only
- include impact and minimal fix direction
```

### Refactor with Options

```text
Goal:
Refactor [file or class].

Return:
1. one minimal refactor option
2. one structural cleanup option

For each option include:
- trade-offs
- migration cost
- regression risk

Constraint:
- preserve public behavior
```

### Large-Context Multi-File Task

```text
Context:
- repository: [service or app name]
- files in scope: [file list]
- current issue: [problem statement]

Question:
Based on the context above, identify the likely root cause, propose the smallest safe fix, and list the tests that should be updated.
```

## Anti-Patterns

Avoid these patterns when generating prompts for Copilot Chat:

- vague requests with no success criteria
- large context dumps with no prioritization
- contradictory instructions
- mixing multiple unrelated tasks in one prompt
- asking for final implementation before clarifying ambiguous failure modes
- omitting a useful role when audience, tone, or evaluation lens is a material part of the task
- relying on stale thread history when a new thread would be cleaner
- asking for generic "optimization" with no metric, constraint, or scope boundary

## Final Prompt Checklist

Before finalizing a prompt, verify all of the following:

- the goal is explicit
- the owning files or symbols are named
- only relevant context is included
- constraints are separated from evidence
- output format is explicit
- validation is requested
- the prompt is sized for the current task
- the thread is still relevant
- the selected model, if specified, matches the task shape

## File Use Recommendation

When this file is used as context for a GitHub Copilot Chat agent, prefer the following workflow:

1. classify the task type
2. select the smallest valid context slice
3. choose the right prompt template
4. apply the relevant technique adjustments
5. add validation requirements
6. add model-specific adjustments only when needed

This file is designed to be operational, compact, and directly consumable as context for prompt generation.