# GitHub Copilot Chat Runtime Context

Use this file as direct context for an agent that must generate or refine prompts for GitHub Copilot Chat.

## Objective

Generate prompts that are:
- specific
- minimal in irrelevant context
- easy for Copilot Chat to follow
- structured for coding tasks on existing repositories
- validation-oriented

## Copilot Operating Assumptions

- Copilot Chat uses the current prompt, selected or open code, and chat history as context.
- Standard Copilot Chat is tuned mainly through prompt structure, scope, examples, constraints, thread hygiene, and model choice.
- Do not assume direct access to raw controls such as `temperature`, `top_p`, `top_k`, or hidden reasoning budgets.
- Use one thread per task. Start a new thread when the task changes materially.

## Required Prompt Order

Structure prompts in this order. When a meaningful role is available, put it first. If no concrete role improves control, start with Goal.

1. Role
2. Goal
3. Relevant files or symbols
4. Context or evidence
5. Constraints
6. Required output
7. Validation

If the prompt is large, put long context before the final request.

## Hard Rules

1. State the goal explicitly.
2. When the task implies a meaningful expertise, audience, tone, or review lens, state the role explicitly.
3. Name the exact files, symbols, tests, errors, or configs involved.
4. Include only context that changes the answer.
5. Separate context, evidence, constraints, and output expectations.
6. Ask for the smallest useful result first.
7. Ask for tests, assumptions, edge cases, or regression checks.
8. If the answer is weak, iterate by changing the prompt structure, not by repeating the same request.
9. Reset or summarize when thread history starts to drift.

## Essential Techniques

### Token Optimization

- include the deciding artifact first: failing test, error, method, interface, or config
- add one adjacent dependency only if behavior crosses that boundary
- replace large unchanged files with a short repository map
- avoid long context dumps with no prioritization

### Context Window Management

- use one thread per bug, feature, refactor, or review
- place long context before the final question
- summarize accepted findings after several turns
- carry forward only durable context: goal, files, findings, remaining work

### Delimiter Optimization

- use stable labeled sections
- use fenced code blocks for code, logs, tests, and configs
- keep constraints separate from evidence

Preferred section labels:

```text
Role:
Goal:
Relevant files / symbols:
Context:
Evidence:
Constraints:
Output:
Validation:
```

### Chain-of-Thought Implementation

Do not ask for long raw reasoning by default.
Prefer visible task decomposition.

Use:

```text
Step 1: identify the likely root cause.
Step 2: propose the smallest safe fix.
Step 3: implement the fix.
Step 4: add or update tests.
```

Use this for debugging, refactors, and multi-file tasks.
Avoid it for simple boilerplate or one-function explanations.

### Role-Based Prompting

Prefer a role when it sharpens the operating lens, target audience, tone, or output style in a way that changes the result.
For prompt-generation tasks, default to including a concrete `Role:` section unless no role materially improves the instruction.

Good roles:
- security reviewer
- performance engineer
- senior maintainer
- migration lead
- test engineer
- technical documentation specialist writing for a named audience

Avoid decorative roles that add status words but no expertise, audience, or output constraints.

### Parameter Tuning for Copilot Chat

Treat parameter tuning as prompt tuning.

For more deterministic output:
- narrow the scope
- ask for one solution
- specify exact output format
- isolate non-negotiable constraints
- request the smallest safe patch

For broader exploration:
- ask for 2-3 options
- ask for trade-offs and risks
- allow wider context only when architecture matters

For shorter output:
- require concise output explicitly
- ask for minimal patch, checklist, or findings only

For more exhaustive output:
- ask for assumptions, edge cases, tests, and regression risks explicitly

## Model Adjustment Layer

Use the same core techniques for all supported models. Apply only the needed adjustment.

### Claude Sonnet 4

- prefer explicit structure
- separate context, constraints, and output
- put large context before the final question

### GPT 5.4

- define the exact deliverable
- keep instructions contradiction-free
- list non-negotiable constraints separately

### Claude Haiku 4.5

- keep prompts short and single-purpose
- minimize context to the smallest sufficient slice
- ask for one outcome at a time

### Gemini 2.5 Pro

- use clearly labeled sections
- provide broad context only when the task truly spans many files or documents
- place the final request after the supporting context on large prompts

## Runtime Prompt Templates

### Generic Task

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
[error, code, failing behavior, test, or doc]

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

### Refactor With Options

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

## Quick Failure-Mode Fixups

If output is too generic:
- add exact file names
- add the observed error or failing behavior
- add the expected behavior

If output is too broad:
- restrict scope to one file or one function
- ask for the smallest safe patch first

If constraints are ignored:
- isolate non-negotiables in a separate section
- remove contradictory instructions

If output over-explores:
- cut context to the owning code path
- request the next concrete step only

If output under-explores:
- add one adjacent dependency
- ask for options with trade-offs

## Final Checklist

Before using a prompt, verify:

- goal is explicit
- owning files or symbols are named
- irrelevant context is removed
- constraints are separated from evidence
- output format is explicit
- validation is requested
- thread history is still relevant
