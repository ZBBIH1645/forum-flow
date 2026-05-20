# ForumFlow Real Data Readiness

## Data Source Boundary

ForumFlow currently runs as a browser-local MVP:

- `demoDataAdapter` loads the polished demo seed data from `lib/mock-data.ts`.
- `localStorageAdapter` describes browser-local persistence for edits, imports, duplicate cases, activity, and local placement decisions.
- `importDataAdapter` describes the CSV preview, mapping, validation, and local commit path.
- `futureBackendAdapter` is a placeholder boundary for a later Supabase/backend implementation.

UI components should keep reading from `useLiveData()`. Future backend work should replace the provider/adapter layer, not each page.

## Core Entities

- `members`: member profile, business details, status, current Forum, active assignment, rejected Forums, relationship review, notes.
- `forums`: Forum group name, capacity, confirmed member IDs, location/style metadata.
- `forum_members`: represented today by `member.currentForumId`; confirmed membership only.
- `relationships/conflicts`: member-to-member relationships and severity.
- `assignments`: represented by `assignedForumId`, assignment start date, and 90-day expiration.
- `shortlists`: local placement decisions with `Shortlisted` status.
- `placement decisions/activity`: local decisions plus activity events.
- `duplicate cases`: possible duplicate pairs or import drafts needing review.
- `intake/imports`: public intake records and CSV import summaries.

## Business Rules

- Assigned is not In Forum.
- Assigned members do not count as official Forum members.
- Only Confirm / Mark In Forum updates the official Forum roster.
- Rejected members return to Free Agent and the rejected Forum pairing is remembered.
- Assignment window is 90 days.
- Ready To Assign requires required fields and relationship review.
- Duplicate merges must preserve history, notes, relationships, rejected Forum IDs, assignment fields, and intake disclosures.

## Minimum Recommended Real-Data Columns

- Name
- Company
- Industry
- Home Location
- Business Location
- Date Of Birth
- Gender
- Revenue Range
- Employee Count
- Years In Business
- Status
- Current Forum
- Relationship Review Completed
- Notes

Common aliases such as `Member Name`, `Full Name`, `Company Name`, `Business`, `Home City`, `Business City`, `Revenue`, `Annual Revenue`, `Employees`, `Years`, `DOB`, `Forum`, and `Current Forum` are mapped during import preview.

## Import Process

1. Export current JSON backup from Admin Tools.
2. Paste or upload CSV in Import Data.
3. Review parsed rows.
4. Confirm field mapping.
5. Review pre-flight impact summary.
6. Resolve or skip duplicate/ambiguous rows.
7. Commit import.
8. Review Duplicate Review.
9. Check Data Quality.
10. Check Placement Queue.
11. Check Reports.

## Normalization

CSV imports normalize common real-world values before member records are built:

- Names and locations are cleaned for whitespace and casing.
- Known location aliases such as `Boca` and `FT Lauderdale` are normalized.
- Known status aliases such as `Forum member` and `In forum` normalize to `In Forum`.
- Ambiguous status values such as `pending` are flagged for review.
- Unknown Forum names are flagged and do not auto-assign.
- Invalid DOB/date values are flagged.
- Invalid employee count or years-in-business values are flagged.
- Empty strings are treated as missing values.

Do not over-normalize uncertain values. Flag them and review in the import pre-flight step.
