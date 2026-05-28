# SplitFree — Trip Expense Tracker

SplitFree is a real-time, single-file web app for splitting trip expenses fairly within a group. No app download, no sign-up friction — just share a link and go.

**Live:** https://code-manigopal.github.io/splitfree

---

## Features

| Feature | Description |
| :--- | :--- |
| **Google Sign-In** | One-click login via Firebase Auth. Works on all browsers. |
| **Multi-Trip Dashboard** | Create and manage multiple trips from a single home screen. |
| **Shareable Invite Links** | Each trip gets a unique URL. Share it — anyone who opens it can request to join. |
| **Role-Based Access** | Three roles: **Admin** (full control), **Member** (add/edit own expenses), **Spectator** (read-only). |
| **Smart Settlements** | Greedy algorithm that minimizes total number of transfers needed to settle everyone. |
| **Granular Expenses** | Tag activities, assign specific participants, track who paid, and add notes. |
| **Settle Up Tab** | Your transfers shown separately from others. Mark done, undo, and track completion. |
| **Real-Time Sync** | Firestore listeners update all connected devices instantly. |
| **30 Currencies** | Set a currency per trip — symbol and code shown throughout. |
| **Visual Analytics** | Doughnut and bar charts via Chart.js. Per-activity and per-member spending breakdowns. |
| **Export** | One-click PDF report (expenses, settlements, balances) or CSV spreadsheet. |
| **Archive Trips** | Keep past trips accessible but out of the way. |

---

## Roles Simplified Explanation

| Role | Can Add Expenses | Can Mark Settlements | Can Edit Trip | Can Approve Members |
| :--- | :---: | :---: | :---: | :---: |
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Member** | ✅ | ✅ (own transfers) | ❌ | ❌ |
| **Spectator** | ❌ | ❌ | ❌ | ❌ |

Spectators can view everything — dashboard, expenses, settlements, members — but cannot take any action.

---

## How to Use

1. Open the app and sign in with Google.
2. Click **+ Create Trip** — enter name, dates, currency, and optional description.
3. Click **🔗 Share Link** inside the trip and send the URL to your group.
4. Go to **👥 Members** tab to approve pending users as **Member** or **👁 Spectator**.
5. Click **+ Add Expense** whenever someone makes a purchase — assign who paid and who's splitting it.
6. Watch the **📊 Dashboard** update live — balances, activity breakdown, recent expenses.
7. At the end of the trip, open **🔄 Settle Up** — your transfers are at the top with a **✓ Mark Done** button.
8. Open **📈 Finalytics** for charts and to export a PDF report or CSV spreadsheet.
9. Archive the trip from the home screen once everything is settled.

---

## Settle Up Logic

SplitFree uses a **minimum transactions greedy algorithm**:
1. Calculate each person's net balance (paid minus fair share).
2. Split into creditors (positive) and debtors (negative).
3. Repeatedly match the largest debtor to the largest creditor.
4. Result: the fewest possible transfers to settle everyone completely.

The Settle Up tab splits transfers into:
- **Your Transfers** — only transfers you're involved in, with Mark Done / Undo buttons.
- **Other Transfers** — all other settlements, visible for transparency but no actions.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | HTML5, CSS3 (custom properties), Vanilla JS (ES Modules) |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Cloud Firestore (real-time sub-collections) |
| Charts | Chart.js 4.4.1 |
| PDF Export | jsPDF 2.5.1 |
| Hosting | GitHub Pages |

---

## Firestore Structure

```
trips/{tripId}
  ├── members/{id}       — name, email, photo, status (pending/approved/spectator)
  ├── expenses/{id}      — description, amount, date, paidBy, activity, participants[]
  ├── activities/{id}    — name, icon (emoji)
  └── settlements/{id}  — from, to, amount, done, markedBy, doneAt
```

---

## Local Development

1. Clone the repo.
2. Open `index.html` directly — the entire app is a single file.
3. Replace the `FB` config object in the `<script>` tag with your own Firebase project credentials.
4. Enable **Google Sign-In** in Firebase Console → Authentication.
5. Enable **Cloud Firestore** and set security rules to allow authenticated reads/writes.
6. Serve via a local web server (e.g. VS Code Live Server) — required for ES module imports.

---

## Firestore Security Rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Scope & Limitations

### What SplitFree is designed for
- **Group trips** where everyone splits costs equally among selected participants
- **One currency per trip** — set at creation, applies to all expenses
- **Trust-based groups** — everyone in the trip can see all expenses and balances
- **Post-trip settlement** — designed to settle up at the end, not track real-time payments

### What SplitFree does NOT do
- ❌ **No unequal splits** — every expense divides equally among selected participants. No percentages, no custom amounts per person.
- ❌ **No multi-currency conversion** — all amounts assumed to be in the trip currency. No live exchange rates.
- ❌ **No real money transfers** — SplitFree only tracks who owes whom. Actual payments happen outside the app (e-transfer, cash, UPI, etc.).
- ❌ **No receipt scanning** — expenses are entered manually. No photo upload.
- ❌ **No push notifications** — no alerts when someone adds an expense or marks a settlement.
- ❌ **No offline mode** — requires internet connection for all reads and writes.
- ❌ **No in-app messaging** — no chat or comments on expenses.
- ❌ **No friends list** — trips are independent. No cross-trip history between members.

---

## Role Permissions — Full Breakdown

### 👑 Admin
The person who creates the trip is automatically the Admin. There is only one admin per trip.

| Action | Allowed |
| :--- | :---: |
| Create trip | ✅ |
| Edit trip name, dates, currency, description | ✅ |
| Delete trip (with confirmation) | ✅ |
| Archive / unarchive trip | ✅ |
| Add custom activity categories | ✅ |
| Add any expense | ✅ |
| Edit any expense | ✅ |
| Delete any expense | ✅ |
| Approve pending members as Member or Spectator | ✅ |
| Reject pending members | ✅ |
| Remove any member or spectator | ✅ |
| Mark any settlement as done | ✅ |
| Undo any settlement | ✅ |
| View all tabs (Dashboard, Expenses, Settle Up, Members, Finalytics) | ✅ |
| Export PDF / CSV | ✅ |

---

### 👤 Member
A member joins via the invite link and is approved by the admin.

| Action | Allowed |
| :--- | :---: |
| Add expenses | ✅ |
| Edit own expenses | ✅ |
| Delete own expenses | ✅ |
| Edit or delete others' expenses | ❌ |
| Mark own settlement transfers as done | ✅ |
| Undo own settlement (if they marked it) | ✅ |
| Undo others' settlements | ❌ |
| Approve or reject other members | ❌ |
| Edit trip details | ❌ |
| Delete trip | ❌ |
| Add activity categories | ❌ |
| View all tabs | ✅ |
| Export PDF / CSV | ✅ |

---

### 👁 Spectator
A spectator joins via the same invite link but is approved by the admin with the Spectator role. Spectators are not included in any expense splits or balance calculations.

| Action | Allowed |
| :--- | :---: |
| View Dashboard | ✅ |
| View Expenses | ✅ |
| View Settle Up | ✅ |
| View Members | ✅ |
| View Finalytics | ✅ |
| Export PDF / CSV | ✅ |
| Add expenses | ❌ |
| Edit or delete expenses | ❌ |
| Mark settlements as done | ❌ |
| Undo settlements | ❌ |
| Any admin or member actions | ❌ |

> Spectators appear in the Members tab and Dashboard under a separate **👁 Spectators** section. They are shown as "watching" and do not affect any balances or settlement calculations.

---

## Pending Members
When someone opens the invite link for the first time, they are automatically added as **Pending**. They will see a waiting screen until the admin approves them. The admin can approve them as:
- **✓ Member** — full participant, included in expense splits
- **👁 Spectator** — view-only, not included in any splits
- **✕ Reject** — removed from the trip entirely

---

*Built by Kanaga Manikandan Gopal · Vibe coded with Claude · 2026*

---
