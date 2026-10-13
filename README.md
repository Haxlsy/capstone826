# 826 Auto Care: Vehicle Service Management System with Messenger-Integrated Chatbot (Beta)

A web system for 826 Auto Aesthetic & Protection that tracks every vehicle from booking to
release. Sales handles customer inquiries, Operations creates and inspects job orders, Head
Technicians record their work from a phone, Admins manage accounts and services, and
customers get answers and status updates through a Facebook Messenger chatbot.

This repository is the **beta testing release**. Things may change or break. If something
looks wrong, please [report it](#reporting-a-bug).

## Contents

- [Beta access](#beta-access)
- [Logging in](#logging-in)
- [What each role can do](#what-each-role-can-do)
- [What to test](#what-to-test)
- [Known limits](#known-limits)
- [Reporting a bug](#reporting-a-bug)
- [For developers](#for-developers)

## Beta access

- **App link:** `826auto-care.vercel.app`
- **Accounts:** you do not sign up. An Admin creates your account and your login details are
  sent to your email. Ask `<CONTACT>` if you have not received them.
- **Devices:**
  - Admin, Operations and Sales: a laptop or desktop with a current version of Chrome or
    Edge.
  - Head Detailer and Head Installer: a phone. The screens are built for mobile.
  - Customers: Facebook Messenger, by messaging the shop's page.

## Logging in

1. Enter your **username** and **password**.
2. Enter the **6-digit code**. It is sent to your email and expires after 10 minutes. If you
   have set up an authenticator app, use the code from the app instead.
3. On your first login you are asked to set a new password (at least 8 characters, different
   from the current one).

Good to know:

- After **3 failed attempts** the login is locked for **1 minute**, then asks for a
  captcha check.
- You are logged out after **20 minutes** without activity. A warning appears 1 minute
  before.
- An account can be logged in on **one device at a time**.
- Forgot your password? Use **Forgot password?** on the login page.

## What each role can do

### Admin and Super Admin

- **Dashboard:** shop-wide numbers and service breakdown.
- **Account Management:** add, edit, archive and restore user accounts, and reset
  passwords. Only a Super Admin can manage Admin accounts.
- **Service Management:** services, service types, workflow stages and category presets.
- **Security & Audit Center:** the audit trail and security events.
- **AI Configurations:** chatbot settings, operating hours, knowledge base, message
  templates and a chatbot preview.

### Operations

- **Dashboard:** today's jobs and their status.
- **Job Order:** create job orders, assign Head Technicians and crew, edit the schedule,
  add a substitute technician, flag a stage for rework, set a job **For Release**, mark it
  **Completed**, cancel it, and export it.
- **Job Records:** past job orders.
- **Technician Availability:** add and edit technicians and mark them available or not.
- **Concerns:** review and resolve concerns raised by Head Technicians.
- **Offline mode:** create job orders and resolve concerns without a connection. They are
  saved on the device and sent when the connection returns.

### Sales

- **Inquiry Management:** review inquiries handed over by the chatbot (Booking, Human
  Response, Report), record customer details, and mark them resolved.
- **Customer Records:** find, edit and export customers and vehicles, and link a Messenger
  account.
- **View Job Orders** and **View Concerns:** read-only.

### Head Detailer and Head Installer

- **Jobs:** see assigned jobs, start a job, and complete each stage with at least one
  photo, one video and notes.
- **Handoff:** approve your category, hand the job to the other team, and pass the finished
  job to Operations for inspection.
- **Rework:** flag a stage for rework, and redo stages sent back to you.
- **Concerns:** submit a concern about a job, with photos or video.
- **Phone alerts:** turn on notifications for assignments, handoffs, rework and resolved
  concerns.

### Customer (Messenger chatbot)

- Ask about **services and prices**.
- Start a **booking** or ask for a person to reply.
- **Report a concern**.
- Check **vehicle status**, and receive updates as stages are completed.

### How a job moves

`Pending` → `Ongoing` → `For Inspection` → `For Release` → `Released`

A job can go to `For Rework` when Operations or a Head Technician sends a stage back. A job
can only be cancelled, or have its schedule edited, while it is `Pending`.

## What to test

Tick these off as you go. Use test customers and vehicles, not real ones.

**Everyone**

- [ ] Log in with the email code, then set up an authenticator app in Settings and log in
      with that.
- [ ] Change your password. Try the forgot-password flow.
- [ ] Enter a wrong password 3 times and confirm the lockout and captcha.
- [ ] Leave the app idle for 20 minutes and confirm the warning and logout.

**Admin / Super Admin**

- [ ] Create an account for each role and confirm the login email arrives.
- [ ] Add a service with stages, then archive and restore it.
- [ ] Edit operating hours, a knowledge base entry and a message template, then check the
      chatbot preview.
- [ ] Confirm your actions appear in the audit trail.

**Operations**

- [ ] Create a job order for a saved customer, and one using manual entry.
- [ ] Follow a job from Pending to Released.
- [ ] Flag a stage for rework and confirm the Head Technician is notified.
- [ ] Add a substitute technician.
- [ ] Resolve a concern.
- [ ] Offline: log in, wait a few seconds on the Dashboard, turn off the connection, create
      a job order, reconnect, and confirm it syncs.
- [ ] Offline: try to create a second job order for the same vehicle and confirm it is
      blocked.

**Sales**

- [ ] Receive a Booking, a Human Response and a Report inquiry from the chatbot, and confirm
      a notification for each.
- [ ] Record customer details from a Booking inquiry.
- [ ] Edit a customer record and link a Messenger account.
- [ ] Export customer records.

**Head Detailer / Head Installer** (on a phone)

- [ ] Turn on phone notifications.
- [ ] Start a job and complete a stage with a photo, a video and notes.
- [ ] Approve your category and hand off to the other team.
- [ ] Pass the job to Operations.
- [ ] Complete a rework sent back to you.
- [ ] Submit a concern.

**Customer** (Messenger)

- [ ] Ask about a service and its price.
- [ ] Make a booking request.
- [ ] Ask for vehicle status with a plate number that has a job order.
- [ ] Message outside operating hours.

## Known limits

- **Offline mode is for Operations only**, and only for creating job orders and resolving
  concerns. Other actions are disabled until the connection returns.
- **Go online once after each login.** Offline data is cleared on logout and login, so the
  device needs a few seconds online on the Dashboard before it can work offline.
- **Offline lists are a snapshot.** Customers or services added by someone else while you
  are offline do not appear until you reconnect.
- **Queued job orders are checked when they sync.** If the server rejects one, it shows as
  **Sync failed** in the Job Order list with the reason.
- **Admins have no notification bell.**
- **Phone alerts are for Head Technicians only.**
- **Media limits per stage:** up to 5 photos (5 MB each) and 1 video (20 MB, 60 seconds).

## Reporting a bug

Open an issue in this repository's **Issues** tab, or message `<CONTACT>`. Please include:

1. Your **role** and the **page** you were on.
2. Your **device and browser** (for example: Android phone, Chrome).
3. The **steps** you took, one per line.
4. What you **expected** and what **happened** instead.
5. A **screenshot** or screen recording, and the **time** it happened.

Do not include passwords or login codes in a report.

## For developers

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Supabase (auth,
database, realtime), Google Gemini for the chatbot, Facebook Messenger webhook, Web Push,
Dexie (offline queue) and a service worker for offline caching.

**Run locally**

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

**Other commands**

```bash
npm test         # unit tests (Vitest)
npm run lint     # ESLint
npm run build    # production build
npm start        # run the production build
```

**Environment variables** (names only; see `.env.example`)

| Service | Variables |
| --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Gemini | `GEMINI_API_KEY`, `GEMINI_API_KEY_CHATBOT`, `GEMINI_API_KEY_TEST` |
| Messenger | `META_PAGE_ACCESS_TOKEN`, `META_VERIFY_TOKEN`, `API_BASE_URL` |
| Web Push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Cloudflare Turnstile | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |
| Gmail SMTP | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM` (optional) |

Never commit `.env` files. They are git-ignored.

**Database:** SQL migrations are in `supabase/migrations`. Apply them to your Supabase
project in filename order.

**Offline mode:** test it with a production build (`npm run build && npm start`), not
`npm run dev`.
