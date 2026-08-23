# Plan

## 1. Merge "Bulk add expenses" and "Import from CSV" into one panel

- Replace the two separate drawers with a single "Bulk add" panel with tabs:
  "Manual rows" | "Import CSV".
- Collapse the two icon buttons in the add-expense bottom bar into one trigger.
- Files:
  - `src/components/AddExpense/BulkAddExpense.tsx`
  - `src/components/AddExpense/CsvImport.tsx`
  - `src/components/AddExpense/AddExpensePage.tsx` (bottom action bar, lines ~569-599)

## 2. Tag support when importing from CSV template

- Add a `tags` column to the CSV template (`generateCsvTemplate` in `src/utils/csv.ts`;
  headers are currently `description,date,amount`).
- Parse tags from the mapped column (comma-separated inside a quoted cell).
- Add an optional tags column to the mapping UI in `CsvImport.tsx`
  (`CsvColumnMapping` in `src/utils/csv.ts` currently has only date/description/amount).
- Match tags against the user's existing tags by name; auto-create new tags
  (or skip with a warning — decide during implementation).
- Apply tags after expense creation via `api.tag.addTagToExpense`
  (same pattern as `syncTags` in `AddExpensePage.tsx`), or extend
  `createExpenseSchema` in `src/types/expense.types.ts` with `tagIds`.

## 3. Tag support in bulk add expenses

- Add a tag picker to bulk rows (per-row tags and/or a shared "default tags"
  applied to all rows) in `src/components/AddExpense/BulkAddExpense.tsx`
  (`BulkRow` currently has only description/amount/date/note).
- Reuse `src/components/AddExpense/AddExpenseTagPicker.tsx` /
  `src/components/TagPicker.tsx`.
- Persist tags the same way as in task 2.

## 4. More advanced charts on the stats page

- Add a chart library (e.g. recharts — no chart lib is installed today;
  current charts are hand-rolled CSS bars in `src/pages/stats.tsx`).
- Charts to add: pie/donut for categories, line/area for monthly trend,
  stacked bars by category per month, per-person breakdown.
- May need richer data from `api.expense.getStats`
  (`src/server/api/routers/expense.ts` line ~697), e.g. a month × category matrix.
- Keep the existing filters (date range, group, paid by, tags).

## 5. Merge activity and stats pages

- Single page with tabs: Activity (expense list) | Stats (charts).
- Remove one nav item from the desktop sidebar and mobile bottom bar
  (`src/components/Layout/MainLayout.tsx` — 7 nav slots today).
- Redirect `/stats` to the merged page (keep the URL working).
- Files: `src/pages/activity.tsx`, `src/pages/stats.tsx`,
  `src/components/Layout/MainLayout.tsx`.

## 6. Search within a group

- Add a search input to the group page filtering by description/note
  (case-insensitive `contains`).
- Extend `getGroupExpenses` (`src/server/api/routers/expense.ts` line ~333)
  with an optional `query` input; optionally also filter by tag/category.
- Files: `src/pages/groups/[groupId].tsx`,
  `src/server/api/routers/expense.ts`.

## 7. Settle up a single expense

- Allow selecting a specific expense and settling only that one, instead of the
  whole cumulative balance between two users.
- Must work even when the current user is the creditor (owed money in the group) —
  i.e. register the settlement as the other party paying the current user, not only
  the debtor paying back.
- Register a settle up activity: create a `SplitType.SETTLEMENT` expense so it shows
  in the activity feed (`src/server/api/services/notificationService.ts` already
  handles `SETTLEMENT` with a "settled up" message).
- UI entry points:
  - Expense details page (`src/components/Expense/ExpenseDetails.tsx`) — add a
    "Settle up" action for non-settlement expenses (mirrors the existing
    `EditSettlement` used for settlements).
  - Optionally a selection mode on the activity page (`src/pages/activity.tsx`) to
    settle several selected expenses at once.
- Server: add a mutation in `src/server/api/routers/expense.ts` that creates a
  `SETTLEMENT` expense offsetting the selected expense (payer ↔ receiver, amount =
  the expense amount in the expense currency). For multi-participant expenses decide
  whether to settle the whole expense or only the current user's share.
- Track settled state: the `Expense` model has no settled flag — consider adding
  `settledAt DateTime?` / `settledBy Int?` (or a link to the settling expense) plus a
  Prisma migration so the UI can badge the original expense as "settled".
- Files: `prisma/schema.prisma`, `src/server/api/routers/expense.ts`,
  `src/components/Expense/ExpenseDetails.tsx`, `src/pages/activity.tsx`.

## Splitwise-inspired feature ideas

- **Expense comments** — `ExpenseNote` model already exists in the schema
  (no UI yet); add view/add comments on the expense detail page
  (`src/components/Expense/ExpenseDetails.tsx`).
- **Debt reminders** — nudge friends to settle what they owe
  (notification infra exists: `src/components/NotificationModal.tsx`,
  `src/components/Account/SubscribeNotification.tsx`).
- **Budgets** — monthly budgets per group or category with progress tracking,
  surfaced on the stats page.
- **Multiple payers per expense** — `ExpensePayment` model already exists
  (UI currently supports a single payer only).
- **Per-group stats** — reuse the new charts from task 4 in the group stats
  drawer (`src/pages/groups/[groupId].tsx`).
- **Dark mode** — theme toggle in the account page
  (`src/pages/account.tsx`).

---

## Detailed Plan — Feature 1: Merge "Bulk add" and "Import CSV" into one panel

### Goal (from the feature list above)

- Replace the two separate drawers with a single "Bulk add" panel with tabs:
  "Manual rows" | "Import CSV".
- Collapse the two icon buttons in the add-expense bottom bar into one trigger.

### Current state

- `AddExpensePage.tsx` bottom bar (lines ~553-609): `RecurrenceInput`, `SponsorUs`,
  then a `div.flex.gap-2` containing:
  - `<BulkAddExpense>` (ListPlus icon, only when `!expenseId`)
  - `<AddBankTransactions>` (Landmark icon)
  - `<CsvImport>` (FileSpreadsheet icon)
  - clear-transaction `X` button
- `BulkAddExpense.tsx`: `AppDrawer` wrapper (trigger = children) + local `rows` state
  (`BulkRow[]`) + `submitAll` (maps rows → `CreateExpense[]` via
  `calculateParticipantSplit`, calls `api.expense.addOrEditExpense`, toasts,
  invalidates, closes). Footer: `bulk_add.submit_all`, non-closing button,
  disabled while mutation pending.
- `CsvImport.tsx`: `AppDrawer` wrapper (trigger = children, `h-[80vh]`) + local state
  (`fileName`, `rows`, `hasHeader`, `mapping`, `showMultipleTransactionModal`) +
  `useAddMultipleTransactions()` + renders `MultipleTransactionModal` inside.
  Footer: `submit_all` only when `multipleTransactions.length > 0`.
  Resets CSV state + clears `multipleTransactions` on close.

Key facts:

- Both components are only used in `AddExpensePage.tsx`.
- `AppDrawer` renders a Dialog on desktop / vaul drawer on mobile; content is
  unmounted when closed (both Radix Dialog and vaul unmount by default).
  `shouldCloseOnAction={false}` and `undefined` render the same non-closing button.
- `useAddMultipleTransactions()` state (`multipleTransactions`,
  `isTransactionLoading`) lives in the global Zustand store → survives unmount,
  so it must be cleared explicitly on close.
- `radix-ui@1.4.2` Tabs supports `forceMount` + `hidden` on `TabsContent`
  (needed so both tabs keep local state while switching).
- Jest + jsdom + next/jest; `~/*` → `src/*`. No @testing-library in the repo →
  tests are pure unit tests of extracted logic only.

### Design

#### 1. NEW `src/components/AddExpense/bulkRow.ts` — pure logic, no React

Exact contract (tests are written against this):

```ts
import { type Group, SplitType, type User } from '@prisma/client';
import { type CurrencyCode } from '~/lib/currency';
import { type Participant, type SplitShares, calculateParticipantSplit } from '~/store/addStore';
import { type CreateExpense } from '~/types/expense.types';

export interface BulkRow {
  id: string;
  description: string;
  amountStr: string;
  amount: bigint;
  date: Date;
  note: string;
}

export const createRow = (): BulkRow => ({
  id: Math.random().toString(36).slice(2),
  description: '',
  amountStr: '',
  amount: 0n,
  date: new Date(),
  note: '',
});

export const patchBulkRow = (rows: BulkRow[], id: string, patch: Partial<BulkRow>): BulkRow[] =>
  rows.map((row) => (row.id === id ? { ...row, ...patch } : row));

export const removeBulkRow = (rows: BulkRow[], id: string): BulkRow[] =>
  rows.filter((row) => row.id !== id);

export const isValidBulkRow = (row: BulkRow): boolean =>
  0n !== row.amount && '' !== row.description;

export interface BuildBulkExpensesParams {
  rows: BulkRow[];
  currency: CurrencyCode;
  category: string;
  group?: Group;
  splitType: SplitType;
  splitShares: SplitShares;
  participants: Participant[];
  paidBy: User;
}

export const buildBulkExpenses = (params: BuildBulkExpensesParams): CreateExpense[] =>
  params.rows.filter(isValidBulkRow).map((row) => {
    const { participants: splitParticipants } = calculateParticipantSplit({
      amount: row.amount,
      expenseDate: row.date,
      participants: params.participants,
      splitType: params.splitType,
      splitShares: params.splitShares,
      paidBy: params.paidBy,
      isNegative: false,
    });
    return {
      name: row.description,
      currency: params.currency,
      amount: row.amount,
      groupId: params.group?.id ?? null,
      splitType: params.splitType,
      participants: splitParticipants.map((p) => ({
        userId: p.id,
        amount: p.amount ?? 0n,
      })),
      paidBy: params.paidBy.id,
      category: params.category,
      expenseDate: row.date,
      note: row.note,
    };
  });
```

#### 2. REFACTOR `src/components/AddExpense/BulkAddExpense.tsx`

- Remove: `AppDrawer` wrapper, `children`/trigger, `open` state, `handleOpenChange`,
  `submitAll`, `addExpenseMutation`, local `rows` state.
- Export named `BulkAddExpenseContent` (presentational):
  - Props: `rows: BulkRow[]`, `onPatchRow(id, patch)`, `onRemoveRow(id)`, `onAddRow()`.
  - Reads `currency` from store + `getCurrencyHelpersCached` for the amount cache.
  - Renders the existing row UI (description input + trash, CurrencyInput +
    DateSelector, note input, "Add row" button). Trash disabled when 1 row.

#### 3. REFACTOR `src/components/AddExpense/CsvImport.tsx`

- Remove: `AppDrawer` wrapper, `children`/trigger, `open` state, `setOpenClose`
  (reset-on-close no longer needed — content unmounts on close),
  `MultipleTransactionModal` (lifted to panel), `addAllMultipleExpenses` /
  `isTransactionLoading` / footer-related bits.
- Export named `CsvImportContent`:
  - Keeps local state: `fileName`, `rows`, `hasHeader`, `mapping`.
  - New prop: `onClose: () => void` (replaces `setOpen(false)` in
    `onTransactionRowClick` single mode).
  - Still uses `useAddMultipleTransactions()` for `clearFields`,
    `multipleTransactions`, `setMultipleTransactions`, `setSingleTransaction`.

#### 4. NEW `src/components/AddExpense/BulkAddPanel.tsx`

- `AppDrawer` (single `trigger={children}`, `title=bulk_add.title`,
  `className="h-[80vh]"`, `shouldCloseOnAction={false}`, controlled `open`).
- Panel state:
  - `activeTab: 'manual' | 'csv'` (default `'manual'`)
  - `rows: BulkRow[]` (lifted from BulkAddExpense; init `[createRow()]`)
  - `showMultipleTransactionModal: boolean` (lifted from CsvImport)
- `Tabs` from `~/components/ui/tabs`:
  - `TabsList` full-width 2-col grid; triggers: `bulk_add.tab_manual_rows`,
    `bulk_add.tab_import_csv`.
  - Both `TabsContent` with `forceMount` + `hidden={activeTab !== value}` so
    local state survives tab switches.
- `submitAll` moved here (uses `buildBulkExpenses` + `addExpenseMutation` +
  toast + `utils.expense.invalidate()` + `utils.group.invalidate()` + close).
- Contextual footer (computed from `activeTab`):
  - manual: `actionTitle=bulk_add.submit_all`, `actionOnClick=submitAll`,
    `actionDisabled=addExpenseMutation.isPending`
  - csv: `actionTitle = multipleTransactions.length > 0 ? submit_all : undefined`,
    `actionOnClick=open modal`,
    `actionDisabled = multipleTransactions.length === 0 || isTransactionLoading`
- `onOpenChange(false)`: `setMultipleTransactions([])`, close modal,
  `setActiveTab('manual')`, `setRows([createRow()])`.
- `MultipleTransactionModal` rendered at panel level:
  `onAddAll=addAllMultipleExpenses`,
  `onAddOneByOne=() => { setOpen(false); addOneByOneMultipleExpenses(); }`.

#### 5. `src/components/AddExpense/AddExpensePage.tsx`

- Remove `CsvImport` import + `FileSpreadsheet` icon.
- Replace the two components with one `<BulkAddPanel>` (only when `!expenseId`),
  trigger = ghost Button with `ListPlus` icon, `title={t('actions.bulk_add')}`.

#### 6. Translations (EN only, per AGENTS.md)

`public/locales/en/common.json`:

- Add under `expense_details.bulk_add`:
  `"tab_manual_rows": "Manual rows"`, `"tab_import_csv": "Import CSV"`.
- Remove now-unused `actions.import_csv` (only used by the removed trigger).

### Behavior preserved

- Bulk: fresh single empty row each open (was: reset on open; now: unmount + init).
- CSV: `multipleTransactions` cleared on close (global store — done in panel).
- CSV single-row click: `setSingleTransaction` + close + scroll-to-top (via `onClose`).
- Desktop dialog / mobile drawer behavior unchanged (AppDrawer handles both).

### Test contract (for @tester)

New file `src/tests/bulkRow.test.ts` importing from
`~/components/AddExpense/bulkRow` (contract above). Cover:

1. `createRow` — defaults (`amount 0n`, empty strings, `date` is a Date),
   non-empty unique `id` across calls.
2. `patchBulkRow` — patches matching row only; immutability (new array, original
   untouched); unknown id → unchanged.
3. `removeBulkRow` — removes matching id, preserves order; unknown id → unchanged;
   empty input → empty.
4. `isValidBulkRow` — false for `0n` amount; false for `''` description;
   true when both set (incl. negative amount).
5. `buildBulkExpenses` — filters invalid rows; `[]` in → `[]` out; field mapping
   (name/currency/amount/groupId/category/expenseDate/note/paidBy/splitType);
   `groupId` = `group.id` when group given, `null` otherwise; participants via
   real `calculateParticipantSplit` (mock `~/utils/array` `shuffleArray` as
   `addStore.test.ts` does; use `initSplitShares()` per user id; EQUAL split of
   100n between 2 users with user A paying → A 50n, B -50n).
   Mock `User` objects like `addStore.test.ts` (`createMockUser`).

No component tests (no testing-library in repo). CSV parsing is already covered
by `src/tests/csv.test.ts` — no new CSV tests required.

### Review notes (self-review — @tester/@reviewer subagents returned empty in this env)

- FIXED state leak: `submitAll` closes the drawer via `setOpen(false)` (prop change),
  which does not fire Radix/vaul `onOpenChange` — so the close-time cleanup would be
  skipped and a stale CSV selection could linger in the global store (duplicate-add
  risk). Extracted `resetPanelState` and call it from `submitAll` too.
  `handleAddOneByOne` intentionally does NOT reset (keeps remaining transactions,
  same as original).
- Removed redundant default exports from the two content components (named-only).
- Accepted minor behavior delta: after a CSV single-row click, the parsed file state
  is lost on reopen (original kept it because state lived in the always-mounted
  wrapper); close = fresh start is the new consistent semantic.
- All CI gates green: prettier, lint (0 errors), tsgo, jest (686 passed; the only
  failing suite is the pre-existing `.worktrees/feat-stats-charts` one), build.
- Manual browser smoke test PASSED (2026-08-22, dev server :3007 + seeded DB,
  signed in via logged magic link):
  - Bottom bar shows a single "Bulk add" trigger (CSV button gone); panel opens
    with "Manual rows" | "Import CSV" tabs (desktop dialog + mobile drawer).
  - Manual: filled 2 rows, "Add all expenses" → both created in DB with correct
    amounts (1250/700), panel closed.
  - CSV: uploaded template-shaped file → header auto-detected, columns
    auto-mapped, 2 rows parsed, "Check all" → "Submit all" → modal → "Add all"
    → both created (2575/420, correct dates + transactionIds).
  - Tab switch preserves state both ways (forceMount); reopen resets to fresh
    state; "Add one by one" closes panel and loads the transaction into the
    main form; X clear button behaves as before (pre-existing resetState).
  - 0 console errors. Test expenses deleted afterwards (BalanceView is derived,
    child rows cascaded — DB left clean).

### Verification

1. `pnpm tsgo --noEmit`
2. `pnpm lint`
3. `pnpm prettier --check .`
4. `pnpm test`
5. `pnpm build --no-lint`
6. Manual (dev server): single trigger in bottom bar; panel opens with tabs;
   manual rows flow (add/remove/patch rows, submit all); CSV flow (choose file,
   mapping, select rows, submit all → modal, add all / one by one); tab switch
   keeps state; close resets; desktop dialog + mobile drawer.
