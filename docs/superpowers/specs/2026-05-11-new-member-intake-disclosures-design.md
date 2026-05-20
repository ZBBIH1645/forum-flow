# New Member Intake Disclosure Flow Design

## Goal

Reduce unnecessary manual relationship review for new member intake submissions by replacing always-visible disclosure text boxes with Yes/No questions. Members who answer No to every disclosure category can be treated as relationship-reviewed automatically.

## User Experience

The New Member Intake form keeps the current Relationship disclosures section and the current categories:

- Blood relatives in the chapter
- Spouse in the chapter
- Current business partners in the chapter
- Former business partners in the chapter
- Prior business relationships in the chapter
- Direct competitors in the chapter
- Very close friends or best friends in the chapter
- Other notes or special context

Each category becomes a No/Yes choice. No is selected by default. When the member selects Yes, an optional explanation field appears below that category. Explanations are helpful but not required for submission.

## Data Behavior

On submit, No answers are stored as blank disclosure values. Yes answers store the typed explanation if provided; if no explanation is provided, the app stores a short Yes marker so the disclosure is still recognized.

If every disclosure category is No, the created member is saved with `relationshipReviewCompleted: true` and `relationshipReviewedAt` set to the submission timestamp. If any category is Yes, the member is saved with `relationshipReviewCompleted: false` so the member remains in the relationship review workflow.

## Admin Impact

Members with all No answers no longer appear as needing relationship review only because they came from intake. Members with one or more Yes answers still require review, and their disclosure details remain visible on the member profile.

## Validation

Test the intake form in the browser:

- Default disclosure state is No for every category.
- Selecting Yes reveals an explanation field.
- Submitting all No creates a member marked relationship-reviewed.
- Submitting any Yes creates a member with relationship review pending.
- Lint and build still pass.
