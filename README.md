<p align="center" style="margin-top: 12px">
  <a href="https://splitpro.app">
  <img width="100px"  style="border-radius: 50%;" src="https://splitpro.app/logo_circle.png" alt="SplitPro Logo">
  </a>

  <h1 align="center">SplitPro (Enhanced Fork)</h1>
  <h2 align="center">Open source expense splitting — with line items, tags, AI receipt scanning, and more</h2>

## What this fork adds

This is a maintained fork of [oss-apps/split-pro](https://github.com/oss-apps/split-pro) with the features below. If you just want the basics, use the original. If you want itemized receipts, tag-based filtering, inline search, and AI-powered receipt scanning, use this.

| Feature                           | Upstream    | This fork                                                                                                                      |
| --------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Expense line items                | —           | Add/remove/edit items per expense. Excluded items don't affect balance. Expense total auto-syncs from included items.          |
| Tags with colors                  | —           | Create tags, assign to expenses, filter by tag across stats, search, and expense lists.                                        |
| AI receipt scanning               | —           | Scan a receipt image → extract line items automatically. Works with any OpenAI-compatible API (GPT-4o, self-hosted Qwen, etc). |
| Search & filter                   | —           | Dedicated search page + inline search bar in group/friend expense views. Filter by keyword and tags.                           |
| Stats with filters                | Basic stats | Filter stats by date range, group, payer, and tags. Bar chart for monthly spending.                                            |
| Inline expense filtering          | —           | Search and tag filter chips directly in group and friend expense lists.                                                        |
| Scan receipt on existing expenses | —           | Re-scan a receipt on any existing expense to append new line items.                                                            |
| Expense items in detail view      | —           | See line items (with excluded indicator) on the expense detail page.                                                           |

**Everything from upstream is preserved.** Groups, balances, settlements, currency conversion, recurring expenses, bank integrations, PWA, and Splitwise import all work unchanged.

## Quick start

```bash
docker run -d \
  --name splitpro \
  -e DATABASE_URL="postgresql://user:pass@db:5432/splitpro" \
  -e NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e SKIP_ENV_VALIDATION=true \
  -p 3000:3000 \
  bpjobin/split-pro:latest
```

Or use Docker Compose from [docker/prod/compose.yml](docker/prod/compose.yml). Copy `.env.example` to `.env` and configure auth, database, and uploads. See [docker/README.md](docker/README.md) and [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for the full setup steps.

### Enabling AI receipt scanning

Add these to your `.env`:

```
AI_BASE_URL=https://your-api-provider.com
AI_API_KEY=your-key
AI_MODEL=gpt-4o
AI_ENABLED=true
```

Works with OpenAI, Ollama, vLLM, or any OpenAI-compatible endpoint.

## Core features

- Add expenses with a friend or a group.
- Split methods: equal, percentage, share, exact, adjustments, and settlements.
- Categories, currencies, dates, and receipt attachments (stored locally).
- Negative expenses for refunds and corrections.
- PWA with push notifications.
- Activity feed with edits and deletions.
- Detailed balances per person and per group.
- Multi-payer support with per-payer balance tracking.
- **Expense line items** for itemized receipts with automatic total sync.
- **Tags with colors** for organizing and filtering expenses.
- **Search** expenses by keyword and tag filters (dedicated page + inline in group/friend views).
- **AI receipt scanning** with OpenAI-compatible providers.
- CSV import with column mapping and downloadable templates.
- Bulk add expenses and save-and-add-another flow.
- Move expenses between groups.
- Mute group notifications.

## UI preview

![SplitPro banner](public/og_banner.png)

![Desktop balances view](public/Desktop.webp)

![Mobile balances view](public/hero.webp)

## Usage overview

### Expenses, balances, and activity

Create expenses with categories, currencies, dates, and receipt attachments. SplitPro supports negative expenses for refunds and corrections, multi-payer tracking, and expense line items for itemized receipts. View per-person balances, detailed group balances, and an activity feed that includes edits and deletions.

### Tags, search, and AI receipt scanning

Tag expenses with custom colors for organization. The search page lets you filter by keyword and tags across all expenses. Group and friend views include an inline search bar with tag filter chips for quick filtering without leaving the page.

AI receipt scanning uses an OpenAI-compatible API to extract line items from receipt images. The scan button appears on the expense detail page for existing expenses and in the add expense flow for new ones.

### Groups

Groups are the primary way to use SplitPro. Invite friends by email or add them directly. Group debt simplification is optional. Move expenses between groups and mute group notifications.

### Statistics

The stats page shows total spent, average expense, breakdowns by category/person/tag with progress bars, and a bar chart for monthly spending. All sections support filtering by date range, group, payer, and tags.

### Data utilities

Splitwise import supports friends and groups (partial import). CSV import allows bulk adding expenses from a spreadsheet with column mapping and downloadable templates. Export data from the balances view and account settings.

### Translations

Translations are managed in Weblate. When a language reaches 100%, it is enabled in the next update.

### Authentication

SplitPro uses NextAuth. At least one provider must be configured.

- Email sign-in (magic link)
- OAuth (Google)
- OIDC (Authentik, Keycloak, or custom OIDC)

Username/password login is not supported. You can lock down an instance by disabling signups and invites. See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) and [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for details.

### Currency conversions

SplitPro can display balances in a single currency, convert expense amounts, and convert group balances. See [docs/CURRENCY_CONVERSIONS.md](docs/CURRENCY_CONVERSIONS.md).

### Recurring transactions

Recurring expenses require a PostgreSQL database with the `pg_cron` extension. We publish a prebuilt Postgres image with `pg_cron`; example usage is in [docker/prod/compose.yml](docker/prod/compose.yml). If you use another database, you must enable the extension and adjust configuration. A non-superuser database role is supported when `pg_cron` is preinstalled; see [docker/README.md](docker/README.md). See [docs/RECURRING_TRANSACTIONS.md](docs/RECURRING_TRANSACTIONS.md).

### Bank transaction integration

Load transactions from providers like Plaid and convert them into expenses. See [docs/BANK_TRANSACTIONS.md](docs/BANK_TRANSACTIONS.md).

## Limitations and notes

- Balances are computed on the fly from expenses using database views. Expenses are the source of truth.
- Recurring transactions require `pg_cron`, which does not support cron ranges or lists.
- Currency conversion accuracy depends on the selected provider.
- Receipts are stored on local disk; make sure your uploads volume is persistent.
- AI receipt scanning requires an external API. No data is sent anywhere except your configured endpoint.

## Docker images

| Image                      | Architecture |
| -------------------------- | ------------ |
| `bpjobin/split-pro:latest` | linux/amd64  |

Upstream images are also available:

- https://hub.docker.com/r/ossapps/splitpro
- https://ghcr.io/oss-apps/splitpro

## Getting started

### Deployment with Docker

See [docker/README.md](docker/README.md) for setup instructions and [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for environment variables.

### Deployment as Proxmox LXC

Thanks to @johanngrobe there is a Proxmox Community Script available [here](https://community-scripts.org/scripts/split-pro).

### Development and contributing

See the [CONTRIBUTING.md](CONTRIBUTING.md) document.

## Supporting docs

- [docs/CONFIGURATION.md](docs/CONFIGURATION.md)
- [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)
- [docs/CURRENCY_CONVERSIONS.md](docs/CURRENCY_CONVERSIONS.md)
- [docs/RECURRING_TRANSACTIONS.md](docs/RECURRING_TRANSACTIONS.md)
- [docs/BANK_TRANSACTIONS.md](docs/BANK_TRANSACTIONS.md)
- [docker/README.md](docker/README.md)

## FAQ

#### How numerically stable is the internal logic?

All numbers are stored in the DB as `BigInt`, with no floats, safeguarding your expenses from rounding errors. This holds for currencies with large nominal values.

#### How are leftover pennies handled?

Leftover amounts are distributed deterministically across participants, based on amount and date.

#### Does this fork stay in sync with upstream?

This fork is maintained independently. Upstream changes may be pulled in periodically, but the features listed above are specific to this fork.

## Why

Splitwise charges for adding expenses — a core feature. This fork (and the upstream it's based on) exists to provide a fully self-hosted, open source alternative. This enhanced version adds the workflow features (line items, tags, search, AI scanning) that make it a practical daily replacement.

## Translations

Translations are managed using [a Weblate project](https://hosted.weblate.org/projects/splitpro/).

<a href="https://hosted.weblate.org/engage/splitpro/">
<img src="https://hosted.weblate.org/widget/splitpro/multi-auto.svg" alt="Translation status" />
</a>

## Star History

[![Star History Chart](https://star-history.dera.page/svg?repos=oss-apps/split-pro&type=Date)](https://star-history.dera.page/#oss-apps/split-pro&Date)
