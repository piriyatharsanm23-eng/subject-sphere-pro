## Goal

Semester admins should be able to **edit** and **delete** any content, but nothing changes for students until the **super admin approves**. Applies to: materials (lecture slides, notes, past papers, tutorials, assignments), kuppi sessions, and deadlines.

Also: after a successful upload, the create form must reset to empty.

---

## 1. Data model — one shared approval queue

Add a single table `pending_changes` instead of tracking per content type:

```
pending_changes
  id              uuid pk
  entity_type     text   -- 'material' | 'deadline' | 'kuppi'
  entity_id       uuid   -- id of the live row being changed
  action          text   -- 'update' | 'delete'
  proposed_data   jsonb  -- for updates: the new values. for deletes: null
  snapshot        jsonb  -- copy of the live row at time of request (rollback safety)
  requested_by    uuid   -- admin who made the change
  semester_id     uuid   -- for scope + notifications
  status          text   -- 'pending' | 'approved' | 'rejected'
  reviewed_by     uuid
  reviewed_at     timestamptz
  created_at      timestamptz
```

Add to each affected table (`materials`, `deadlines`, `kuppi_sessions`) a small hide flag so students never see a pending-deletion row:

```
alter table X add column pending_delete boolean default false;
```

RLS + GRANTs follow the existing pattern (super_admin full, admin insert/select own semester, anon/public reads filter `pending_delete = false`).

---

## 2. Behaviour by action

### Admin **edits** a material / deadline / kuppi
1. Instead of `UPDATE` on the live row, write a `pending_changes` row with `action='update'`, `proposed_data=<new values>`, `snapshot=<current row>`.
2. Live row is **unchanged** — students keep seeing the old version.
3. Super admin dashboard shows the diff.
4. On **approve** → apply `proposed_data` to live row, mark pending row `approved`.
5. On **reject** → do nothing to live row, mark `rejected`. (Your ask: "if not accepted, the new material is deleted and older one is kept" — matches this.)

### Admin **deletes** a material / deadline / kuppi
1. Set `pending_delete = true` on the live row. Insert `pending_changes` with `action='delete'`.
2. Public/student queries and the Telegram bot filter out `pending_delete = true` → students immediately stop seeing it.
3. Super admin sees it in "Pending removals".
4. On **approve** → hard-delete the row (and storage file for materials).
5. On **reject** → set `pending_delete = false` (restore). Mark `rejected`.

Super admin's own edits/deletes bypass the queue (immediate).

---

## 3. Super admin review UI

New route `src/routes/super.pending.tsx`:
- Tabs: **Updates** / **Deletions**
- Each row: entity type, subject, requested by, timestamp, "View diff" (updates) or "View item" (deletions), **Approve** / **Reject** buttons.
- Sidebar link "Pending changes" with unread badge (in `SuperShell.tsx`).

New route `src/routes/admin.pending.tsx` (read-only) so semester admins can see the status of their own requests.

---

## 4. Server functions

`src/lib/pending-changes.functions.ts` — all auth-gated (`requireSupabaseAuth`):
- `requestUpdate({ entityType, entityId, proposedData })`
- `requestDelete({ entityType, entityId })`
- `approveChange({ pendingId })` — super_admin only
- `rejectChange({ pendingId })` — super_admin only
- `listPending({ scope: 'super' | 'mine' })`

Existing admin edit/delete handlers in `admin.materials.tsx`, `admin.deadlines.tsx`, `admin.kuppi.tsx` are rewired to call these functions instead of writing directly. Super admin routes keep direct writes.

---

## 5. Public/student read paths to update

Filter `pending_delete = false` in:
- `src/lib/materials.ts` (all material fetchers)
- `src/routes/dashboard.tsx`, `subject.$id.tsx`, `semester.$id.tsx`, `material.$id.tsx`
- `src/routes/api/public/telegram/webhook.ts` (materials + deadlines queries)
- `src/lib/notify-deadline.functions.ts` (don't notify if pending delete)
- Kuppi routes

---

## 6. Form reset after upload

In every "create" form (materials, deadlines, kuppi, subjects, modules, semesters) — after the mutation resolves successfully:
- Call `form.reset()` (react-hook-form) **or** reset all `useState` fields to their initial empty values.
- Currently many forms keep the last-typed values on screen; we fix them in the same pass.

Files: `admin.materials.tsx`, `admin.deadlines.tsx`, `admin.kuppi.tsx`, `super.subjects.tsx`, `super.modules.tsx`, `super.semesters.tsx`.

---

## 7. Notifications (optional but consistent with existing pattern)

- When admin requests change → notify super admin in-app (badge count).
- When super approves/rejects → notify requesting admin in-app.
- No Telegram noise for approval flow (only student-facing content notifies students, and only after approval).

---

## Scope check

This is a large change (1 migration, ~5 new files, edits to ~12 existing routes). Confirm before I start:

1. **OK to add `pending_delete` hide-flag** to `materials`, `deadlines`, `kuppi_sessions`? (Alternative: soft-delete via `deleted_at` timestamp — same effect, more common pattern. I'll use `deleted_at` if you prefer.)
2. **Super admin's own edits/deletes bypass approval** — correct?
3. **Kuppi sessions**: include in the workflow? (You listed it, confirming.)
4. **New material uploads** (create) — do those also need super-admin approval, or only edits/deletes? Your message only mentions delete + update, so I'll leave **creates** as immediate.

Reply "go" plus any answers and I'll implement.
