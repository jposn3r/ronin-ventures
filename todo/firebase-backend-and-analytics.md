# Firebase backend and analytics

Priority: Low  
Status: Proposed; expand before implementation.

## Goal

Sync TaskForge data across devices and understand how visitors use Ronin Ventures. Reuse the backend for other site tools later.

## Proposed implementation

- [ ] Create a shared Ronin Ventures Firebase project with environment configuration.
- [ ] Add Firebase Authentication with Google sign-in.
- [ ] Replace TaskForge's Firebase stubs with Firestore persistence for projects, tasks, and comments, scoped to the signed-in user.
- [ ] Add security rules that restrict access to each user's data.
- [ ] Migrate existing localStorage data with duplicate protection; retain a local fallback and show save/sync failures.
- [ ] Implement live updates and handle concurrent edits without overwriting unrelated changes; store individual records rather than the entire app state in one document.
- [ ] Add site-wide GA4 tracking for page views, project launches, meaningful feature actions, and outbound/contact clicks. Include `project_id` on custom events.
- [ ] Keep personal content out of analytics; define consent behavior and exclude local development traffic.
- [ ] Verify sign-in, migration, cross-device sync, access isolation, and analytics events.

## Scope and cost

- Start with TaskForge and basic analytics. Consider meal plans, saved calculator scenarios, and preferences later.
- Use Firestore for app data and GA4 for usage events.
- Target free allowances; review current quotas before setup. File uploads are deferred: Cloud Storage requires the Blaze billing plan.
- Decide conflict handling and shared-project permissions before expanding beyond personal use.
