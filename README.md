# Retail CRM Hub

BSC Retail CRM — Complete Project Plan & Feature Inventory

Stack: React 18 + TypeScript (Vite) · Node.js + Express + TypeScript · MySQL · JWT Auth
Theme: Dark Navy #1a2744 sidebar · Warm Cream #f5f0e8 background · Inter / Outfit / JetBrains Mono fonts

1. Architecture Overview

retail-crm-main/

├── frontend/           React 18 + Vite + TypeScript

│   └── src/

│       ├── pages/      All UI pages (14 pages + 2 page-groups)

│       ├── layouts/    AppLayout (sidebar + topbar shell)

│       ├── context/    AuthContext (JWT session management)

│       ├── services/   api.ts (Axios instance)

│       └── index.css   Global design system

│

├── backend/            Node.js + Express + TypeScript

│   └── src/

│       ├── controllers/   Business logic (4 controllers)

│       ├── routes/        API router (4 route files)

│       ├── middleware/     JWT + role auth guards

│       ├── config/        DB connection pool

│       ├── initDb.ts      Schema creation + auto-migration

│       └── seed.ts        Default data seeding

│

└── database/           MySQL (hosted / local)

2. User Roles & Access Matrix

RoleAccesssuper_adminEverythingadminEverythingcrm_managerDashboard, Footfall, Feedback List, Diverts, Reports, Cash Settlement, VM Checklistcrm_staffDashboard, Footfall, Diverts, Cash SettlementtelecallerFeedback List (call queue)purchase_managerPM View (divert resolution)vmVM ChecklistgreeterFullscreen Greeter Tablet portal only(public)QR Feedback form (unauthenticated)

3. Complete Feature List

🖥️ Feature 1 — Dashboard (/app)

File: Dashboard.tsx

5 KPI Cards: Today Footfall · Total Bills · Open Diverts · NPS % · CSI %

Summary Ribbon (navy strip): Total Logged · Peak Hour · Peak Count · Conversion Rate

SVG Area Chart: Hourly footfall distribution with area fill, dotted grid, labels

Hourly Audit Table: 12 slots (10 AM–10 PM), live green dot for current hour, color-coded status badges (Submitted / Active / Missed / Pending)

Voice-of-Customer Ticker: Scrolling marquee of customer reviews from today's feedback

Auto-refreshes every 30 seconds

🚶 Feature 2 — Footfall Entry (/app/footfall)

File: Footfall.tsx

Hourly slot entry (10 AM–10 PM, 12 slots)

Slot locking: cannot submit a future slot; past slots editable within grace period

Per-slot visitor count + remarks field

Daily Bills count entry (separate field)

Submitted-by attribution per slot

Edit cutoff enforcement (configurable via Settings)

💬 Feature 3 — Customer Feedback (Staff Entry) (/app/feedback-qr)

File: FeedbackQR.tsx

Displays a QR code that links to the public feedback form

Staff can show QR on tablet / print for customer scanning

📋 Feature 4 — Public QR Feedback Form (/feedback-public)

File: Feedback.tsx

Unauthenticated — accessible by any customer via QR

Dynamic questions pulled from FeedbackQuestion table

Captures: Name · Mobile · DOB · Section/Area · Up to 8 Q&A · "Your Voice" free text

Automatically creates a CallQueue entry if feedback is negative (q1 = No/Maybe)

Source tagged as qr

📞 Feature 5 — Feedback List / Call Queue (/app/feedback-list)

File: FeedbackList.tsx

Telecaller / CRM Manager view of all negative-feedback call-backs

Filter by: Date · Status · Section · Call Type

Status lifecycle: new → called → resolved / escalated

Log call notes, attempt count, escalation flag, follow-up date

Color-coded status pills per row

📦 Feature 6 — Sourcing Diverts (/app/divert)

File: Divert.tsx

Create a divert: Section · Product Wanted · Qty · Price Range · Fabric/Occasion · Reason · Customer details · Expected delivery date

Status workflow: open → sourcing → available → closed / cancelled

PM Action column: Purchase Manager can update sourcing status + notes

Full activity log (DivertUpdate) per divert — timestamped, role-attributed

DER (Divert Exception Report) — sends email trigger to stakeholders

Badge counter in sidebar for open diverts

👔 Feature 7 — Purchase Manager View (/app/pm-view)

File: PMView.tsx

Dedicated read-only + action view for Purchase Managers

Shows all open/sourcing diverts assigned to PM resolution

Can update status and add sourcing notes inline

📊 Feature 8 — Reports & Analytics (/app/reports)

File: Reports.tsx

Date-range report generation

Footfall trends · Feedback summary · Divert resolution rates

(Extensible — currently shows summary KPIs)

💰 Feature 9 — Cash Settlement (/app/cash-settlement)

Files: CashLogin.tsx · CashForm.tsx

PIN-protected login (separate from main login)

Entry of: Sale Amount · Bills Count · Cash / Card / UPI totals per counter

Auto-calculates Average Bill Value (ABV) and payment-mode differences

Per-cashier counter breakdown with Staff Discount / Customer Discount

Stores CashSettlement + CashCounterReport records

🏢 Feature 10 — VM (Visual Merchandising) Checklist (/app/vm-checklist)

Files: VmLogin.tsx · VmForm.tsx · VmDashboard.tsx · VmAdmin.tsx

PIN-protected VM staff login

Dynamic checklist points from VMChecklistPoint table (admin-editable)

Submission types: Opening / Mid-Day / Closing per floor

Each point scored: Pass / Fail / NA + remarks + photo link

Auto-calculated score percentage per submission

Admin view of past submissions + score history

Admin can add/edit/deactivate checklist points

⚙️ Feature 11 — Admin Settings (/app/admin)

File: Admin.tsx

Company Settings: Name · Logo URL · Operating hours · Footfall grace period · Edit cutoff time · DER email · DER WhatsApp note

User Management: Create users (all roles) · View all users · Reset passwords · Activate/deactivate

Section Management: Create/delete store sections (name, type, manager)

Feedback Question Management: Manage dynamic Q&A questions

📺 Feature 12 — Live TV Display (/app/tv)

File: TVDisplay.tsx

Fullscreen mode, designed for large mall/store display screens

Shows live metrics: Footfall · NPS · CSI · Diverts

Auto-refreshes, TV-auth token (separate from user JWT)

Customer review marquee ticker

Branded with company logo + name from Settings

🙋 Feature 13 — Greeter Portal (/app/greeter)

File: Greeter.tsx

Fullscreen tablet interface for store greeters at entry

PIN-based selection (greeter picks their name from list → enters PIN)

Logs customer entries in real-time

Simplified, touch-friendly UI (no sidebar)

🔐 Feature 14 — Authentication & Onboarding

Files: Login.tsx · Onboarding.tsx

First-Run Onboarding: Company name + admin account creation (only shown if setupComplete = false)

JWT Login: Email + password → token stored in localStorage

Role-based redirect (greeter → /app/greeter, others → /app)

Route guards: ProtectedRoute + SetupGate HOCs

Auto-logout on token expiry

4. Database Schema (13 Tables)

TablePurposeSettingsCompany config, operating hours, email settingsUserAll staff accounts with roles + PINSectionStore sections/departmentsFootfallEntryHourly visitor counts (1 row per date+slot)DailySummaryDaily bills countFeedbackQuestionDynamic feedback Q&A definitionsFeedbackCustomer feedback submissionsCallQueueNegative feedback follow-up call trackingDivertReasonLookup table for divert reason codesDivertSourcing divert requestsDivertUpdateActivity log per divert (full audit trail)CashSettlementDaily cash reconciliation headerCashCounterReportPer-cashier/counter breakdownVMUserVM staff PIN accountsVMChecklistPointDynamic checklist point definitionsVMSubmissionVM checklist submission headerVMSubmissionEntryPer-point scored entries with photo links

5. API Endpoints

Auth (/api/auth)

MethodEndpointDescriptionPOST/loginJWT loginPOST/onboardFirst-run setupGET/meCurrent user sessionPOST/logoutClear session

CRM (/api/crm)

MethodEndpointDescriptionGET/dashboardToday's KPIs + footfalls + reviewsGET/POST/footfallHourly slot read/writePOST/billsSave daily bills countGET/questionsFeedback questions listPOST/feedbackStaff feedback submissionPOST/feedback/publicQR public submission (no auth)GET/PUT/call-queueCall queue list + status updateGET/POST/PUT/divertDivert CRUDGET/divert/reasonsReason code lookupPOST/derSend DER emailGET/PUT/settingsCompany settingsGET/POST/DELETE/sectionsSection managementGET/POST/usersUser managementPUT/users/reset-passwordPassword resetGET/greetersPublic greeter list for PIN login

Cash (/api/cash)

MethodEndpointDescriptionPOST/GET/PUT—Cash settlement CRUD

VM (/api/vm)

MethodEndpointDescription——VM login, checklist points, submissions

6. What's Working vs. Potential Gaps

✅ Fully Implemented

Complete auth + role system

Dashboard with live metrics

Footfall entry with slot locking

Customer feedback (staff + public QR)

Call queue / follow-up workflow

Divert management with audit trail

Cash settlement with counter breakdown

VM checklist with scoring

TV Display + Greeter Portal

Admin panel (users, sections, settings)

🔧 Areas to Enhance / Add

FeatureStatusNotesReports pageBasicCould add date-range charts, export to CSV/PDFPush notificationsMissingReal-time alerts for new diverts or negative feedbackAnalytics chartsMinimalTrend charts over days/weeks in ReportsExport / PrintMissingPDF or Excel export for daily reportsSMS/WhatsApp integrationPartialDER email exists; WhatsApp note is manualDark mode toggleNot builtCSS vars are ready; needs a theme switchMobile responsivenessPartialSidebar collapses but some tables may overflow on small screensFeedback question editorAdmin onlyCould be more UI-friendlyGreeter footfall auto-linkManualGreeter counts not yet auto-synced to FootfallEntry

7. Tech Decisions & Notes

IST timezone: All dates stored as DD/MM/YYYY strings to avoid MySQL UTC conversion bugs; all computations use +5:30 offset

TV Auth: A separate X-TV-Token header authenticates the TV display, so it can auto-refresh without a user session

Public QR: /feedback/public is intentionally unauthenticated — throttling/captcha could be added

Auto-migration: initDb.ts uses ALTER TABLE ... ADD COLUMN inside try/catch so existing databases get new columns safely

Role seeding: Greeter accounts are auto-created with a default PIN 1234 on first run

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d72e8db9-d581-479c-ac9e-1962207635a0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
