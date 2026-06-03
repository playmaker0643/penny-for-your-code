# Smart Notification System — Extension Plan

Builds on top of the current notification stack (categories enum, `notifications`, `notification_preferences`, `notification_tokens`, `send-notification` edge function, FCM service worker, in-app `NotificationCenter`). No existing files are removed, redesigned, or refactored beyond targeted additions.

## 1. New notification categories

Add to the existing `notification_category` enum + `notification_preferences` columns + `CATEGORY_META`:

- `lesson_reminder`
- `course_reminder` (unfinished courses)
- `assignment_deadline`
- `quiz_reminder`
- `direct_message` (extends existing `chat_message`)
- `mentor_reply`
- `streak_reminder`
- `leaderboard_change`
- `ai_recommendation`

Existing categories kept: `new_lesson`, `challenge`, `security`, `announcement`, `achievement`, `live_class`, `chat_message`, `system`.

## 2. User activity tracking

New table `user_activity_signals (user_id, last_active_at, active_hour_histogram int[24], lessons_completed_24h, notifications_sent_24h, notifications_clicked_24h, notifications_ignored_24h, current_streak_days, last_streak_at, updated_at)`.

Lightweight client hook `useActivityTracker` pings an edge function `track-activity` on focus / route change (debounced, ≤ 1/min). Click & ignore counts are updated from SW message + bell open.

## 3. Quiet hours + smart delivery in `send-notification`

Extend `notification_preferences` with:
- `quiet_hours_start smallint` (0-23, nullable)
- `quiet_hours_end smallint`
- `timezone text default 'UTC'`
- `mute_until timestamptz`
- `high_priority_only boolean default false`

In edge function:
- Skip if `mute_until > now()`.
- Skip if inside quiet hours AND category priority < high.
- Skip if `high_priority_only` and category not in {security, assignment_deadline, mentor_reply, direct_message}.
- Dedup ring: hash of `(user_id, category, title, body)` stored in new `notification_dedup` table with 10-min TTL; skip duplicates.
- Group: if 3+ pending of same category within 5 min, collapse into one summary row ("3 new lessons available").
- Rate cap per user: max 8 non-high-priority pushes / hour.

## 4. Smart reminders (scheduled)

New edge function `smart-reminders` invoked by `pg_cron` every 15 min (`pg_net`):

- Unfinished lessons: progress > 0 and last_activity > 24h → `lesson_reminder`.
- Inactive courses: enrolled but no progress in 3 days → `course_reminder`.
- Assignment deadlines: due within 24h, not submitted → `assignment_deadline`.
- Missed quizzes/exams scheduled but not started → `quiz_reminder`.
- Inactive streak: streak ≥ 2 and no activity today after 18:00 user-tz → `streak_reminder`.
- Re-engagement: no login 5/10/20 days → throttled comeback ping with top recommended lesson (max 1 per 5 days).

All paths reuse `send-notification` so quiet hours / dedup / rate limit apply.

## 5. Engagement features

Triggers (DB triggers or in app code where data is written):
- Streak increment → `achievement` notification on 3, 7, 14, 30, 60, 100 day milestones.
- XP gained crosses 100/500/1k thresholds → `achievement`.
- Challenge match completed → `challenge` result.
- Leaderboard top-10 entry / rank-up ≥ 5 places → `leaderboard_change`.

## 6. Notification analytics

New table `notification_events (id, notification_id, user_id, event ('delivered'|'clicked'|'dismissed'|'failed'), meta jsonb, created_at)`.
- SW posts `clicked` + `dismissed` via the existing `NOTIFICATION_CLICK` channel + a new `NOTIFICATION_DISMISS` channel; client forwards to `track-notification-event` edge function.
- `send-notification` logs `delivered` / `failed` per token.

Admin-only read view `notification_analytics` aggregating CTR, fail rate, ignored count per category over 7/30 days. Surfaced as a small "Analytics" card appended to existing `AdminNotifications` page (no redesign).

## 7. Preferences UI

Extend the existing `StudentNotifications` settings card (no new page):
- Toggle list auto-renders from `CATEGORY_META` so new categories appear automatically.
- Quiet-hours start/end pickers.
- "Mute for 1h / 8h / 24h / Until I turn it back on" menu.
- High-priority-only switch.
- Existing sound / vibration toggles preserved.

## 8. Debug mode

In `StudentNotifications`, gate behind `localStorage.cb_notif_debug = "1"` (or admin role):
- "Send test notification" (already exists — keep).
- "Simulate background push" (posts to SW via `postMessage`).
- "Print diagnostics" (exists — keep).
- New "Open delivery log" — last 50 rows from `notification_events` for current user.

## 9. Security & performance

- All new edge functions: zod-validated, JWT-checked, rate-limited via existing `notification_send_log` pattern.
- New tables: RLS on, per-user policies; analytics view admin-only.
- Dedup table auto-pruned by cron (`delete where created_at < now() - interval '1 hour'`).
- Activity tracker batches signals client-side (≤1 req/min).
- Reuses existing FCM webpush priorities for low bandwidth.

## 10. Preservation guarantees

- No file removed.
- `NotificationCenter`, `AdminNotifications`, routing, auth, styling untouched except small additive sections.
- Existing notification flow, realtime channel, IDB cache, and SW behaviour unchanged.

## Technical breakdown

### Migrations
1. Extend `notification_category` enum (9 new values).
2. Add 9 boolean columns to `notification_preferences` + quiet hours + mute_until + high_priority_only + timezone.
3. Create `user_activity_signals`, `notification_dedup`, `notification_events` with RLS + GRANTs.
4. Create `notification_analytics` view (admin via `has_role`).
5. Enable `pg_cron`, `pg_net`; schedule `smart-reminders` every 15 min (via insert tool, not migration, since it embeds project URL + anon key).

### Edge functions (new)
- `track-activity` — upsert into `user_activity_signals`.
- `track-notification-event` — insert into `notification_events`.
- `smart-reminders` — scheduled scanner, fans out via internal call to `send-notification`.

### Edge function (modified)
- `send-notification` — add quiet-hours / mute / dedup / grouping / rate / priority logic; log `delivered`/`failed` events. Backward compatible: new fields optional.

### Client
- `src/lib/notifications/categories.ts` — add new entries.
- `src/lib/notifications/activity.ts` — `useActivityTracker` hook.
- `src/lib/notifications/api.ts` — add `trackEvent`, `updatePreferences`.
- `src/hooks/useNotifications.tsx` — forward click/dismiss to `track-notification-event`.
- `public/firebase-messaging-sw.js` — post `NOTIFICATION_DISMISS` messages; group tag handling already in place.
- `src/pages/student/StudentNotifications.tsx` — extend settings card (quiet hours, mute menu, high-priority toggle, auto-render category toggles, debug section).
- `src/pages/admin/AdminNotifications.tsx` — append analytics card.

### Out of scope
- No redesign of `NotificationCenter`, `AdminLayout`, dashboards.
- No native push beyond existing FCM web push.
- No new auth flows.

Approve to proceed, or tell me which sections to drop / trim.
