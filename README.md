# Mynages B2C Family App — Interactive Prototype (Phase 3)

**Live demo:** https://darshan-gtt.github.io/mynages-b2c/ (deployed automatically by GitHub Actions on every push to `main`)

A demo-ready prototype of the family (consumer) mobile app, based on PRD v2.1 sections 4–10 and Appendix A.1/A.2.

- **Sample family:** the Kulkarni Family, Pune. Owner Nitin, spouse Sneha (adult member), mother Sunanda (view-only).
  - Father, son and daughter are profiles without sign-in.
  - Brother Rohan has a pending invite.
  - 3 properties, 27 assets, about 10 policies.
- **No backend:** all data is stored in the browser (localStorage). It survives refresh, sign-out and switching users.

## Run locally

```bash
cd prototypes/b2c
npm install
npm run dev                         # http://localhost:5103
# or
npm run build && npm run preview    # http://localhost:5103
```

On a laptop the app shows inside a phone frame, with **Demo controls** beside it. "Full width" mode removes the frame. In a phone browser the demo controls are below the app. **In the installed APK there are no demo controls** — it looks like the real app.

## Demo cheat-sheet

**OTP for every sign-in: `123456`.**

| Account | Mobile |
|---|---|
| Nitin (Owner) | 98765 43210 |
| Sneha (adult member) | 98765 00011 |
| Rohan (invited) | 98500 98500 — sees Accept / Decline |
| New user | Welcome → **Create new account** → any new number (pick the country code first) → onboarding |
| Google | Welcome → Continue with Google → pick a family account, or **Use another account** to sign up |

| Show this | How |
|---|---|
| Asset 360° | Assets → Toyota Innova Crysta (`/assets/a_innova`) |
| What Asset 360° has | Hero card; 6 key facts; alerts strip; 11 quick actions; section chips; collapsible sections (details, coverage + history, due & reminders, tasks, documents, service, contacts, cost & value chart, related, sharing, timeline); QR; one-page PDF |
| Add asset → 360° | **+** → Asset → pick a tile → type → fill the form → its 360° page opens. Adding a family asset with the same name or serial triggers the duplicate warning |
| Renew / mark paid | On the 360° page: Coverage ⋮ → Renew; Due ⋮ → Mark paid. The next due date and the expense are created automatically |
| Assign a task | 360° → Task → assign to Sneha. Switch to **Sneha** in Demo controls to see her notification and the task |
| Private space | Sneha → space chip → My private space → her FD and gold bangles. Nitin can't see them anywhere (lists, search, reports, totals) |
| View-only member | Switch to **Sunanda**: she can view everything and gets reminders, but has no edit buttons on family items |
| Invites | More → Family → add member → invite (WhatsApp preview). Demo controls → "Simulate Rohan accepting" |
| Plan limits | Demo controls → Individual → More → Family → invite, or open Savings → upgrade screen |
| Billing states | Demo controls → Payment fails (warning banner) / Expire (whole app read-only) → Settings → Plan & billing → Retry / Resubscribe |
| Premium calendar | More → Insurance → Premium calendar |
| Snap a document | **+** → Snap a document → simulated AI reading → review → saves the policy and the document |
| Reminders | Demo controls → Run reminders now → bell icon. Reminders are deduplicated per item and preset, and stop when the item is paid or cancelled |
| Onboarding | Demo controls → Start as a new user. 6 steps, each with Back: about you (address, country, currency), family name, plan (full plan cards) + UPI ID, set-up, members, first asset (opens the asset form or Snap, then the new asset's 360° page) |

## Modules

| Area | What works |
|---|---|
| Sign-in | Separate **Create new account** / **Sign in** paths; country-code dropdown (20 countries, per-country number length); mobile OTP (validation, wrong-OTP error, resend); "no account for this number" screen; Google account picker with sign-up; invite accept / decline |
| Onboarding | 6 steps with progress bar and Back on every step; address saved as Home; currency (20) defaults from the country; plan cards with every inclusion; trial start; members list under the form |
| Home | Space switch, search, notifications badge, 5 tiles (assets, value, due in 7 days, overdue, open tasks), upcoming list, recent activity |
| Assets | Category chips, sort, filter sheet (owner / property / status / coverage), list or grid view, archived list |
| Asset 360° | Everything listed in the cheat-sheet above; every action opens a bottom sheet and returns to the same page |
| Tasks & reminders | Today / Upcoming / Overdue / Completed / Subscriptions; Mine / Assigned by me / All family; list or calendar view; start, done, reopen, snooze, cancel, edit, delete |
| Search & notifications | Search across assets, documents, policies, tasks and contacts; mark read / all read |
| Family | Members, invitations (expiry, resend, cancel), roles, private space, nominees (CRUD), member profile with documents, policies, health, owned assets and tasks |
| Documents | Group by person / asset / category, search, "expiring in 60 days" filter, preview, download, share link, edit, delete |
| Insurance | Policies for assets and people, filters, renew / edit / delete, total cover and annual premium, premium calendar with Mark paid |
| Warranties & AMC | Filters by state; renew, edit, call |
| Maintenance | Schedules (log service), service log, manuals and job cards |
| Contacts | Search, type chips, call / WhatsApp, linked assets, import from phone (simulated address book) |
| Savings & investments | Invested vs current value, chart by instrument, upcoming maturities, value history and updates (Family Plus) |
| Health records | Per-person filter, records CRUD, vaccinations and check-ups with Mark done |
| Reports | 9 reports with charts and tables, CSV export, filtered by the active space |
| QR labels | Select assets, preview the sheet, print (simulated), CSV export. The QR codes are real and open the asset |
| Settings | Profile & workspaces; preferences (language, light/dark/auto theme, date format); security & devices; notification channels + quiet hours + custom reminder presets; categories & fields (add type / field); document categories; modules; plan & billing (upgrade now, downgrade at period end, cancel, resume, retry, payment method, invoices); import (CSV with row validation) & export (CSV / JSON); privacy (consent, activity log, delete account with 30-day grace); help & feedback |

## Simulated (no real service behind it)

- OTP, Google sign-in, WhatsApp/SMS invites and reminders, push notifications
- UPI AutoPay / card mandate, payments, invoices
- AI document reading ("Snap"), camera, file storage (only file name and size are kept)
- Phone address book import, printing, share links, sync to other devices
- Reminder engine: runs at sign-in and from Demo controls

## Assumptions & items to confirm (PRD gaps)

1. **Family report names:** the PRD lists report IDs RPT-33…46 but does not name them. The 9 reports in this prototype are our interpretation of the PRD text.
2. **View-only assignees:** a view-only member can tick a task done if it is assigned to them. The PRD does not say either way.
3. **Savings & Health** are P1 in the PRD. They are built here because the brief asked for them. They are gated by plan: Health needs Family or above; Savings needs Family Plus.
4. **Prices** are the indicative ones in PRD §10.2. GST is shown at 18%.
5. **Not built (P1 / later):**
   - Advisor access with expiry
   - External share links that work outside the family
   - Net-worth dashboard
   - Lost & found QR page
   - Google Calendar sync
   - Translated UI (the language picker exists; the text stays English)
6. This prototype keeps one family per browser. "Start as a new user" replaces the sample family; "Reset Kulkarni family" brings it back.

## Tech

Vite 5 + React 18 + TypeScript, react-router 6, lucide-react, qrcode-generator.

- Business rules live in `src/lib/actions.ts`; permissions and plan limits in `src/lib/access.ts`.
- The editors (`src/components/editors`) are shared by module pages and Asset 360°.
