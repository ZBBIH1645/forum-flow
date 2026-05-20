# New Member Intake Disclosures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace intake disclosure text boxes with default-No Yes/No controls and auto-complete relationship review when all answers are No.

**Architecture:** Keep the existing `IntakeDisclosures` string payload so admin profile views continue to work. Add local disclosure Yes/No state in `components/intake-form.tsx`, normalize disclosure values on submit, and infer relationship review completion in `components/live-data-provider.tsx`.

**Tech Stack:** Next.js App Router, React client components, TypeScript, localStorage-backed live data provider.

---

### Task 1: Intake Disclosure Form UI

**Files:**
- Modify: `components/intake-form.tsx`

- [ ] Add disclosure Yes/No state keyed by the existing `IntakeDisclosures` fields.
- [ ] Render each disclosure category as No/Yes radio buttons.
- [ ] Show an optional textarea only when Yes is selected.
- [ ] Normalize submit payload so No stores blank and Yes stores typed details or `Yes`.

### Task 2: Intake Save Behavior

**Files:**
- Modify: `components/live-data-provider.tsx`

- [ ] Detect whether any submitted disclosure has a non-blank value.
- [ ] Save `relationshipReviewCompleted: true` and `relationshipReviewedAt: submittedAt` when all disclosures are blank.
- [ ] Keep `relationshipReviewCompleted: false` when any disclosure is present.

### Task 3: Validation

**Files:**
- No committed test files.

- [ ] Run a temporary Playwright check before implementation and confirm it fails because the new Yes/No controls are missing.
- [ ] Run the same Playwright check after implementation and confirm all-No creates a relationship-reviewed member.
- [ ] Run a second Playwright check confirming a Yes answer keeps relationship review pending.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
