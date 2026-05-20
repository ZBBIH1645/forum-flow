# Living Member Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make ForumFlow a living local member database and placement workbench while preserving the existing MVP routes and visual system.

**Architecture:** Add a backend-ready client data adapter that seeds from `lib/mock-data.ts`, persists local changes in localStorage, and exposes members, forums, relationships, placement decisions, and activity. Update existing pages to read from that live data through focused client components while keeping the existing mock data and compatibility conventions as defaults.

**Tech Stack:** Next.js app router, React client components, TypeScript, localStorage adapter, existing Tailwind design system.

---

### Task 1: Extend Core Types and Matching

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/mock-data.ts`
- Modify: `lib/matching.ts`

- [x] Add richer member statuses, relationship types, data quality labels, and activity events.
- [x] Keep legacy relationship arrays for compatibility, but add normalized `MemberRelationship`.
- [x] Add matching helpers that accept live members/forums/relationships instead of relying only on static imports.

### Task 2: Add Live Data Adapter

**Files:**
- Create: `components/live-data-provider.tsx`

- [x] Seed local state from mock data.
- [x] Persist member overrides, custom members, relationships, placement decisions, and activity to localStorage.
- [x] Recompute forum membership from live member assignments.
- [x] Expose add/edit/member movement/relationship/placement operations through one hook.

### Task 3: Build Members Workflows

**Files:**
- Create: `components/member-directory.tsx`
- Create: `components/member-form.tsx`
- Create: `app/(admin)/members/page.tsx`
- Create: `app/(admin)/members/new/page.tsx`
- Create: `app/(admin)/members/import/page.tsx`
- Modify: `components/app-shell.tsx`

- [x] Add master Members list with search and filters.
- [x] Add new member form with duplicate warnings.
- [x] Add CSV import placeholder.
- [x] Link new routes from navigation.

### Task 4: Update Existing Placement Screens

**Files:**
- Modify: `app/(admin)/free-agents/page.tsx`
- Modify: `app/(admin)/members/[memberId]/page.tsx`
- Modify: `components/match-decision-buttons.tsx`
- Modify: `components/placement-actions.tsx`

- [x] Use live data on free-agent and member detail workflows.
- [x] Add member edit and relationship editor on profile.
- [x] Make shortlist/review/reject/approve decisions update member status and forum assignment.

### Task 5: Update Forum and Dashboard Screens

**Files:**
- Modify: `app/(admin)/dashboard/page.tsx`
- Modify: `app/(admin)/forums/page.tsx`
- Modify: `app/(admin)/forums/[forumId]/page.tsx`
- Create: `components/activity-list.tsx`

- [x] Recompute dashboard stats, forum counts, compositions, and best matches from live data.
- [x] Add lightweight activity history.
- [x] Preserve privacy note.

### Task 6: Verification

**Files:**
- No committed test artifacts required.

- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Browser smoke test members list, add/edit form, CSV placeholder, free-agent filter, profile approve/reject, and forum count rendering.
