# MindMatesPlus Advisor Portal — Codebase Documentation

> **Branch:** `AI_Analytics` · **Stack:** React 19 · TypeScript · Firebase (Auth / Firestore / Storage) · Tailwind CSS · Vite

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Directory Structure](#2-directory-structure)
3. [Entry Points](#3-entry-points)
4. [Routing & Layout (`App.tsx`)](#4-routing--layout-apptsx)
5. [Authentication Layer](#5-authentication-layer)
   - [Firebase Config (`lib/firebase.ts`)](#51-firebase-config-libfirebasets)
   - [Auth Context (`context/AuthContext.tsx`)](#52-auth-context-contextauthcontexttsx)
6. [Global Types](#6-global-types)
   - [`types.ts`](#61-typests)
   - [`types/userDiagnostic.ts`](#62-typesuserdiagnosticts)
7. [Constants & Dummy Data (`constants.ts`)](#7-constants--dummy-data-constantsts)
8. [Utility Modules](#8-utility-modules)
   - [`lib/utils.ts`](#81-libutilsts)
   - [`lib/advisorConnections.ts`](#82-libadvisorconnectionsts)
   - [`services/imageUploadService.ts`](#83-servicesimageuploadservicets)
9. [Custom Hooks](#9-custom-hooks)
   - [`hooks/useUserDiagnosticData.ts`](#91-hooksuserdiagnosticdatats)
10. [Shell Components](#10-shell-components)
    - [`Sidebar.tsx`](#101-sidebartsx)
    - [`Navbar.tsx`](#102-navbartsx)
    - [`FlaggedMessageAlert.tsx`](#103-flaggedmessagealerttsx)
11. [Pages](#11-pages)
    - [Login / SignUp / ResetPassword](#111-login--signup--resetpassword)
    - [Dashboard](#112-dashboard)
    - [Critical Cases](#113-critical-cases)
    - [User Monitoring](#114-user-monitoring)
    - [Chat Review](#115-chat-review)
    - [Journal Review](#116-journal-review)
    - [AI Insights](#117-ai-insights)
    - [Reports](#118-reports)
    - [Advisor Chat](#119-advisor-chat)
    - [Settings](#1110-settings)
    - [Advisor Profile](#1111-advisor-profile)
    - [Resources](#1112-resources)
12. [Shared UI Components](#12-shared-ui-components)
    - [DashboardCard](#121-dashboardcard)
    - [RiskBadge](#122-riskbadge)
    - [AlertPanel](#123-alertpanel)
    - [UserTable](#124-usertable)
    - [ChatViewer](#125-chatviewer)
    - [CaseCard](#126-casecard)
    - [ConnectionCard](#127-connectioncard)
    - [CaseDetailsModal](#128-casedetailsmodal)
    - [UserDetailsModal](#129-userdetailsmodal)
    - [UserDetailPanel](#1210-userdetailpanel)
    - [DirectChatModal](#1211-directchatmodal)
    - [NotesModal](#1212-notesmodal)
13. [Firestore Data Model](#13-firestore-data-model)
14. [Risk Classification System](#14-risk-classification-system)
15. [ML Pipeline & Recommendation System](#15-ml-pipeline--recommendation-system)
16. [Key Design Patterns](#16-key-design-patterns)

---

## 1. Project Overview

The **MindMatesPlus Advisor Portal** is a React web application used by mental health advisors and system administrators to monitor, review, and intervene for users of the **MindMates+** peer-support platform. Core capabilities include:

- **Real-time user risk monitoring** — reads user mental-health profiles and DASS-21 scores from Firestore.
- **Critical case management** — advisors accept, review, and approve connection requests from high-risk users.
- **Peer-group chat moderation** — advisors can view live group chats, flag/approve/reject messages, delete content, and send private replies to flagged-message senders.
- **Journal sentiment review** — reads journal entries with pre-computed sentiment scores.
- **AI Insights & Reports** — visualizes emotional trends, DASS-21 averages, and predictive risk indicators.
- **Resource management** — advisors publish text articles or image posts categorised by wellness level.
- **Admin-to-advisor private chat** — secure 1-on-1 messaging between advisors and system admins.
- **ML diagnostic panel** — real-time BERT prediction history, KNN recommendation pipeline waterfall, and stability counter for each user.

---

## 2. Directory Structure

```
src/
├── assets/                  Static images (logo, group thumbnails)
├── components/              Reusable UI building blocks
│   ├── UserDetailPanel/     ← NEW: full-screen slide-in diagnostic modal
│   │   ├── index.tsx            Main panel shell (modal, backdrop, ESC key)
│   │   ├── PanelHeader.tsx      Dark-navy header (name, risk chip, status, UID)
│   │   ├── TabBar.tsx           4-tab navigation bar
│   │   ├── AdvisorActionBar.tsx Fixed bottom bar (Add Note, Connect, Flag Critical, Chat)
│   │   ├── LiveDiagnosticsPanel.tsx  Real-time ML dashboard (dark navy)
│   │   ├── ConfidenceSparkline.tsx   Pure-SVG BERT confidence trend line
│   │   └── tabs/
│   │       ├── OverviewTab.tsx   Wellness ring, DASS cards, recommendations, LiveDiagnostics
│   │       ├── DassScoresTab.tsx DASS-21 detailed breakdown
│   │       ├── MLPipelineTab.tsx KNN pipeline details
│   │       ├── BertHistoryTab.tsx BERT prediction timeline
│   │       ├── JournalsTab.tsx   User journal entries
│   │       ├── FeedbackTab.tsx   Star ratings & comments
│   │       └── AboutTab.tsx      Demographics & profile
│   ├── AlertPanel.tsx
│   ├── CaseCard.tsx
│   ├── CaseDetailsModal.tsx
│   ├── ChatViewer.tsx
│   ├── ConnectionCard.tsx
│   ├── DashboardCard.tsx
│   ├── DirectChatModal.tsx
│   ├── FlaggedMessageAlert.tsx  ← global toast system
│   ├── Navbar.tsx
│   ├── NotesModal.tsx
│   ├── RiskBadge.tsx
│   ├── Sidebar.tsx
│   ├── UserDetailsModal.tsx
│   └── UserTable.tsx
├── context/
│   └── AuthContext.tsx       React context + Firebase Auth integration
├── hooks/                   ← NEW: custom React hooks
│   └── useUserDiagnosticData.ts  7 parallel Firestore onSnapshot listeners
├── lib/
│   ├── advisorConnections.ts  Firestore helpers for case workflows
│   ├── firebase.ts            Firebase app initialisation & exports
│   └── utils.ts               Tailwind class-merge helper
├── pages/
│   ├── AdvisorChat.tsx        Admin–advisor private chat
│   ├── AdvisorProfile.tsx     ← NEW: Advisor profile management (split from Settings)
│   ├── AIInsights.tsx         Charts & predictive analytics
│   ├── ChatReview.tsx         Live group-chat moderation
│   ├── CriticalCases.tsx      High-risk user & connection request management
│   ├── Dashboard.tsx          Overview stats, charts, top-risk table
│   ├── JournalReview.tsx      User journal entry viewer
│   ├── Login.tsx              Email/password login form
│   ├── Reports.tsx            Downloadable report list
│   ├── ResetPassword.tsx      Password-reset flow
│   ├── Resources.tsx          Resource library (CRUD)
│   ├── Settings.tsx           Notification preferences & security settings
│   ├── SignUp.tsx             Advisor account creation
│   └── UserMonitoring.tsx     Paginated user risk table + UserDetailPanel
├── services/
│   └── imageUploadService.ts  ImageKit image upload via FastAPI backend
├── types/                   ← NEW: typed module directory
│   └── userDiagnostic.ts      ML pipeline types, DASS helpers, display utils
├── App.tsx                    Root router + protected layout wrapper
├── constants.ts               Static dummy data for development
├── index.css                  Global Tailwind styles
├── main.tsx                   ReactDOM entry point
├── types.ts                   Core shared TypeScript interfaces
└── vite-env.d.ts              Vite environment type declarations
```

---

## 3. Entry Points

### `src/main.tsx`

The application bootstrap. Mounts the React tree inside `<StrictMode>` on the `#root` DOM node, and imports the global CSS.

```ts
createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
```

---

## 4. Routing & Layout (`App.tsx`)

**Purpose:** Defines the top-level React Router tree and enforces authentication.

### Public Routes
| Path | Component | Notes |
|------|-----------|-------|
| `/login` | `<Login />` | Email/password sign-in form |
| `/signup` | `<SignUp />` | Advisor account creation |
| `/reset-password` | `<ResetPassword />` | Firebase password reset email |

### `ProtectedLayout` Component

- Reads `currentUser` and `loading` from `useAuth()`.
- While loading, renders `null` (prevents flash).
- If no authenticated user, redirects to `/login` via `<Navigate>`.
- When authenticated, renders the full shell:
  - `<Sidebar />` — fixed left navigation
  - `<Navbar />` — sticky top header with search and bell
  - `<main>` — contains nested `<Routes>` for all protected pages
  - `<FlaggedMessageAlert />` — global toast overlay, always mounted

### Protected Page Routes

| Path | Component |
|------|-----------|
| `/` | `<Dashboard />` |
| `/critical-cases` | `<CriticalCases />` |
| `/monitoring` | `<UserMonitoring />` |
| `/chat-review` | `<ChatReview />` |
| `/journal-review` | `<JournalReview />` |
| `/resources` | `<Resources />` |
| `/insights` | `<AIInsights />` |
| `/reports` | `<Reports />` |
| `/chat` | `<AdvisorChat />` |
| `/settings` | `<Settings />` |
| `/profile` | `<AdvisorProfile />` |

---

## 5. Authentication Layer

### 5.1 Firebase Config (`lib/firebase.ts`)

Initialises the Firebase application using environment variables (prefixed `VITE_FIREBASE_*`). Exports three service handles:

| Export | Type | Use |
|--------|------|-----|
| `app` | `FirebaseApp` | Root Firebase app instance |
| `auth` | `Auth` | Firebase Authentication, with **session-only persistence** (clears on tab close) |
| `db` | `Firestore` | Firestore database handle |
| `storage` | `Storage` | Firebase Cloud Storage handle |

> **Session persistence** means advisors must re-authenticate every new browser session — intentional security behaviour for sensitive mental-health data.

---

### 5.2 Auth Context (`context/AuthContext.tsx`)

A React context that wraps the entire app (via `<AuthProvider>`) and provides authentication state and actions to all components.

#### `AdvisorProfile` interface
```ts
{
  name: string;
  role: string;
  email: string;
  profileImageUrl?: string;
  yearsOfExperience?: number;
  qualifications?: string;
  about?: string;
  isModerator?: boolean;
}
```

#### Context Value (`AuthContextType`)
| Property/Method | Type | Description |
|-----------------|------|-------------|
| `currentUser` | `User \| null` | Firebase Auth user object |
| `advisorProfile` | `AdvisorProfile \| null` | Advisor's Firestore profile record |
| `loading` | `boolean` | True while the auth state is resolving on first load |
| `signup(email, password, name, role)` | `Promise<void>` | Creates Firebase Auth account + Firestore `advisors/{uid}` document |
| `login(email, password)` | `Promise<void>` | Signs in with Firebase email/password |
| `logout()` | `Promise<void>` | Clears profile state and signs out |
| `resetPassword(email)` | `Promise<void>` | Sends Firebase password-reset email |
| `updateAdvisorProfile(updates)` | `void` | Optimistically updates the in-memory profile (used after photo upload or profile save) |

#### `onAuthStateChanged` Effect
On app load, subscribes to Firebase auth state changes. When a user is detected, fetches their advisor profile from `advisors/{uid}` in Firestore and populates `advisorProfile`. Cleans up the subscription on unmount.

---

## 6. Global Types

### 6.1 `types.ts`

All core shared TypeScript interfaces used across the application.

| Interface | Purpose |
|-----------|---------|
| `RiskLevel` | Union type: `'Low' \| 'Medium' \| 'High' \| 'Critical'` |
| `User` | Basic user record for monitoring tables (id, name, riskLevel, status, lastActivity) |
| `Alert` | A system alert derived from a high-risk user event |
| `Case` | An AI-flagged critical case record |
| `ChatMessage` | A message in a (dummy/legacy) chat with sentiment annotation |
| `JournalEntry` | A user's journal entry with sentiment score (-1 to 1) and tags |
| `AdvisorNote` | A note written by an advisor on a user case |
| `MentalHealthProfile` | Full mental health data including DASS-21 scores, mood, medications, triggers |
| `QuestionnaireResponse` | A single onboarding questionnaire answer |
| `UserDetails` | Full user profile object combining demographic and health data |
| `AdvisorConnection` | A connection request from a user to an advisor (status workflow: `pending → accepted → reviewed → approved`) |
| `PeerGroup` | A peer support group record |
| `CaseMessage` | A message sent within an `advisorConnection/messages` subcollection |
| `LiveChatMessage` | A live group chat message with moderation fields (`isFlagged`, `reviewStatus`, `deletedByAdvisor`, etc.) |
| `AdvisorPrivateMessage` | A private thread message between advisor and flagged-message sender |
| `Resource` | A text or image resource published by an advisor |

---

### 6.2 `types/userDiagnostic.ts`

A dedicated module for the User Detail Panel and ML pipeline system. Exports both TypeScript interfaces and a rich set of pure utility functions consumed across all panel sub-components.

#### Interfaces

| Interface | Purpose |
|-----------|---------|
| `UserDiagnosticData` | Aggregated output of `useUserDiagnosticData` — all 7 listener results + loading/error state |
| `UserDiagnosticProfile` | Fields from the `users/{uid}` Firestore document |
| `MentalHealthProfileData` | Fields from `users/{uid}/mentalHealthProfile/currentProfile` — DASS-21, KNN, stability counter, recommendation categories |
| `MLHistoryEntry` | A single BERT prediction event from `mlAnalysisHistory` |
| `JournalMetaEntry` | A journal entry with ML analysis from `journal_entries` |
| `FeedbackEntry` | A feedback record (star_rating, peer_comment, app_comment) |
| `AdvisorConnectionData` | Advisor connection metadata from `advisorConnections` |
| `WellnessHistoryEntry` | A wellness score change record (newScore, previousScore, source) |
| `DASS21Scores` | Depression, anxiety, stress numeric scores |
| `InitialQuestionnaireScore` | Nested DASS-21 scores inside `currentProfile` |
| `MLStabilityCounter` | repeatedCount, lastPrediction, maxCount — tracks BERT stability for category promotion |
| `KNNResult` | Legacy nested KNN result (kept for backward compat) |
| `MLAnalysis` | BERT result embedded in journal entries (prediction, confidence, probabilities) |
| `MlMentalHealthProfileMap` | Nested ML summary on the users doc (anxietyCount, depressionCount, dominantCategory) |

#### Utility Functions

| Function | Description |
|----------|-------------|
| `normalizeRiskLevel(value)` | Converts any raw risk string to `RiskLevel` |
| `tsToDate(value)` | Converts Firestore Timestamp, ISO string, or Date to `Date \| null` |
| `tsToRelative(value)` | Human-relative time string ("Just now", "5m ago", "2d ago") |
| `tsToFull(value)` | "May 24, 2026" formatted date |
| `tsToShort(value)` | "May 24" formatted date |
| `getDASSSeverity(type, score)` | Returns "Normal" / "Mild" / "Moderate" / "Severe" / "Extremely Severe" per DASS-21 clinical thresholds |
| `getSeverityColorClass(severity)` | Tailwind badge class for a severity string |
| `getSeverityBarColor(severity)` | Hex colour for progress bar fill |
| `getDassScores(mhp)` | Extracts depression/anxiety/stress from `initialQuestionnaireScore` (primary) or `dass21Scores` (legacy fallback) |
| `getJournalTimestamp(entry)` | Returns `entry.date ?? entry.createdAt` |
| `getMlTimestamp(entry)` | Returns `entry.createdAt ?? entry.timestamp` |
| `resolveActiveRecommendation(profile, mhp)` | Runs the 4-level priority chain and returns `{ category, source }` |
| `getUserDisplayName(profile)` | Picks first non-null from nickname / nickName / displayName / name |
| `normalizeUserStatus(profile, mhp)` | Maps raw status values to "Active" / "Monitoring" / "Restricted" / "Under Review" / "Inactive" |
| `getLabelColor(label)` | Hex colour by BERT label (red=depression, amber=anxiety, green=normal) |
| `getLabelChipClass(label)` | Tailwind chip classes by BERT label |
| `getSourceIcon(source)` | Emoji icon by event source (📓 journal, 💬 chat, 🤖 AI) |
| `getCategoryColor(category)` | Hex accent colour by wellness category name |

#### Constants

`CATEGORY_DESCRIPTIONS` — record of all 6 wellness categories mapped to their advisor-facing description strings.

---

## 7. Constants & Dummy Data (`constants.ts`)

Provides static fallback/demonstration data used during development or when Firestore returns no data. Exports arrays of typed objects:

- `DUMMY_USERS` — 5 sample users with varied risk levels
- `DUMMY_ALERTS` — 3 sample system alerts
- `DUMMY_CASES` — 3 sample critical cases
- `DUMMY_MESSAGES` — 3 sample flagged chat messages
- `DUMMY_JOURNALS` — 2 sample journal entries with negative sentiment
- `DUMMY_NOTES` — 2 sample advisor intervention notes

> These are **not connected to Firestore** — all live pages fetch real data independently.

---

## 8. Utility Modules

### 8.1 `lib/utils.ts`

Exports a single helper:

```ts
cn(...inputs: ClassValue[]): string
```

Combines **clsx** (conditional classes) and **tailwind-merge** (deduplicates conflicting Tailwind utilities). Used throughout all components for dynamic className construction.

---

### 8.2 `lib/advisorConnections.ts`

All Firestore read/write logic related to the **advisor–user connection workflow**.

#### Constants
- `APPROVED_CATEGORIES` — the 6 wellness categories an advisor can assign on approval:
  - `'Wellness - Thriving'`, `'Wellness - Stress Aware'`, `'Wellness - Emotionally Aware'`
  - `'Recovery & Improvement'`, `'Mild Support'`, `'Moderate Support'`

#### Functions

| Function | Description |
|----------|-------------|
| `updateUserMentalHealthAfterApproval(userId, advisorId, category)` | Updates `users/{userId}/mentalHealthProfile/currentProfile` to `userStatus: 'normal'`, sets all recommendation/dashboard category fields to the approved value, and ensures `wellnessScore ≥ 20`. |
| `updateUserWellnessScoreByAdvisor(userId, advisorId, newScore, prevScore, note?)` | Writes a new `wellnessScore` to the user's profile. If score < 10, sets `userStatus: 'restricted'`. Appends a history entry to `users/{userId}/wellnessScoreHistory`. |
| `approveUserForNormalAccess(connectionId, userId, advisorId, category, note?)` | Sets `advisorConnections/{id}` status to `'approved'`, then calls `updateUserMentalHealthAfterApproval`. |
| `listenToCriticalCases(advisorId, onUpdate, onError?)` | Real-time `onSnapshot` listener for `advisorConnections` where `advisorId` matches and `caseType === 'critical_case'`. Filters to `pending`/`accepted` statuses, deduplicates by `userId` (keeps latest), and enriches each record with the user's nickname. Returns an unsubscribe function. |
| `acceptAdvisorConnection(connectionId, userId, advisorId)` | Sets connection status to `'accepted'`; sets user profile `advisorConnectionStatus: 'accepted'` and `userStatus: 'under_review'`. |
| `markCaseReviewed(connectionId, userId)` | Sets connection status to `'reviewed'`; sets user profile `userStatus: 'normal'`. |
| `fetchUserMentalHealthProfile(userId)` | One-time `getDoc` of the user's current mental health profile. |
| `fetchCaseUserProfile(userId)` | Parallel `getDoc` of both the user document and the mental health profile subcollection. |
| `approveUserCase(connectionId, userId, advisorId)` | Alias for accepting a case — sets status to `'accepted'` and user profile to `under_review`. |
| `listenToCaseMessages(connectionId, onUpdate)` | Real-time listener on `advisorConnections/{id}/messages` ordered by `createdAt asc`. |
| `sendAdvisorCaseMessage(connectionId, advisorId, userId, text)` | Adds a message document to the messages subcollection and updates the parent connection's `lastMessage` fields. |
| `markUserMessagesAsRead(connectionId)` | Batch-updates all unread user messages in the connection's messages subcollection to `isRead: true`. |

---

### 8.3 `services/imageUploadService.ts`

Handles secure image uploads to **ImageKit** CDN.

**Flow:**
1. Fetches a signed token (token, expire, signature) from the FastAPI backend at `VITE_API_BASE_URL/imagekit-auth` — the private key never touches the browser.
2. Builds a `FormData` payload with the file, timestamp-prefixed filename, folder path, public key, and auth credentials.
3. POSTs to `https://upload.imagekit.io/api/v1/files/upload`.
4. Returns the public CDN URL from the response.

Used for: advisor profile photos (`AdvisorProfile`) and resource images (`Resources`).

---

## 9. Custom Hooks

### 9.1 `hooks/useUserDiagnosticData.ts`

**Purpose:** Establishes all 7 Firestore `onSnapshot` listeners for a single user's mental health detail panel. All listeners are set up once when `uid` is provided and torn down cleanly when `uid` changes or the consuming component unmounts. Missing subcollections return empty arrays, never throw.

**Signature:**
```ts
function useUserDiagnosticData(uid: string | null): UserDiagnosticData
```

**Listeners (in order):**

| # | Firestore Path | Limit | Order | Output Field |
|---|----------------|-------|-------|--------------|
| 1 | `users/{uid}` | — | — | `profile` |
| 2 | `users/{uid}/mentalHealthProfile/currentProfile` | — | — | `mentalHealthProfile` |
| 3 | `users/{uid}/journal_entries` | 15 | `date desc` | `journalEntries` |
| 4 | `users/{uid}/mlAnalysisHistory` | 30 | `createdAt desc` | `mlHistory` |
| 5 | `users/{uid}/wellnessScoreHistory` | 30 | `createdAt desc` | `wellnessHistory` |
| 6 | `users/{uid}/feedback` | 5 | `createdAt desc` | `feedback` |
| 7 | `advisorConnections` where `userId == uid` | 1 | — | `advisorConnection` |

**Field normalisation:** `mlHistory` entries normalise `label → prediction` and `score → confidence` so all consumers work uniformly regardless of the Firestore schema version.

---

## 10. Shell Components

### 10.1 `Sidebar.tsx`

The fixed left navigation panel, always visible when authenticated.

**What it renders:**
- MindMates logo at the top
- Navigation list — 11 `<NavLink>` items including **Advisor Profile** (links to `/profile`). Active link gets `bg-brand-50 text-brand-600` highlighting via the `isActive` callback prop
- Bottom user section — shows the advisor's profile photo (or initials fallback), name, and role. Clicking the section opens a popup with a **Sign Out** button

**Behaviour:**
- `menuOpen` state toggles the sign-out popup
- `useEffect` with `mousedown` event listener closes the popup when clicking outside (`menuRef`)
- `handleSignOut` calls `logout()` from auth context then navigates to `/login`
- `getInitials(name)` extracts up to 2 uppercase initial letters from the full name

**Navigation items defined:**
Dashboard, Critical Cases, User Monitoring, Chat Monitoring, Journal Review, Resources, AI Insights, Reports, Admin Chats, Settings, Advisor Profile

---

### 10.2 `Navbar.tsx`

The sticky top header bar.

**What it renders:**
- Search input (UI only — no active search implementation yet)
- Notification bell icon with a live **alert count badge** — shows number if > 0, otherwise a static red dot
- "Advisor Portal" label with a **sign-out dropdown** — clicking opens a menu with a "Sign out" button that calls `logout()` and navigates to `/login`

**How the alert count works:**
- Imports `subscribeAlertCount` from `FlaggedMessageAlert.tsx` (a publish-subscribe pattern using a `Set<AlertCountListener>`)
- `useEffect` subscribes on mount and cleans up on unmount
- Badge shows up to "9+" to prevent overflow

**Sign-out dropdown:**
- `dropdownOpen` state toggled by clicking the Advisor Portal user button
- `mousedown` listener on `dropdownRef` closes it when clicking outside
- Rendered as an absolute-positioned white card below the header

---

### 10.3 `FlaggedMessageAlert.tsx`

A **global, always-mounted** toast notification system that monitors Firestore in real-time for newly flagged content.

**Architecture:**

**External badge subscription (exported):**
```ts
export function subscribeAlertCount(fn: AlertCountListener): () => void
```
`Navbar` calls this to stay in sync with the current alert count without prop drilling.

**`isFlaggedDoc(data)`** — helper that determines if a Firestore document is a flagged alert by checking:
- `isFlagged`, `flagged`, or `is_flagged` boolean fields
- `riskLevel` containing "high", "critical", or "severe"
- `sentiment === 'risky'`

**`getSenderName(data)`** — extracts the sender/user display name from multiple possible field names.

**`getSnippet(data)`** — extracts the message text (checking `text`, `message`, `content`, `body`, `entry`) and truncates to 120 characters.

**`useCollectionGroupListener(collectionName, source, navPath)`** — internal hook factory. Creates a `collectionGroup` query listener:
1. On the **first snapshot**, seeds `seenIds` with all existing document IDs (to suppress alerts for pre-existing flagged messages)
2. On subsequent `'added'` changes, checks if the document is flagged, generates an alert object, and calls `pushAlert`

**Collections monitored:**
| Firestore Collection | Source Label | Navigation Target |
|---------------------|-------------|-------------------|
| `chatMessages` | Group Chat | `/chat-review` |
| `ai_messages` | AI Chat | `/monitoring` |
| `messages` | AI Chat | `/monitoring` |
| `journal_entries` | Journal | `/journal-review` |
| `journalEntries` | Journal | `/journal-review` |
| `journals` | Journal | `/journal-review` |

**Toast rendering:**
- Up to 6 simultaneous toasts in a fixed bottom-right stack
- Each auto-dismisses after 12 seconds (via `setTimeout`)
- Animated with `motion/react` — slides in from the right with spring physics
- "Review" button dismisses the toast and navigates to the relevant page
- Source-specific colour coding: blue (group chat), purple (AI chat), amber (journal)

---

## 11. Pages

### 11.1 Login / SignUp / ResetPassword

Standard Firebase Authentication forms. Not detailed further — they call `login()`, `signup()`, and `resetPassword()` from the auth context respectively.

---

### 11.2 Dashboard

**File:** `src/pages/Dashboard.tsx`

The main overview page, showing system-wide mental health metrics.

#### `useDashboardData()` hook

- Subscribes to the entire `users` collection with `onSnapshot`
- For each user, concurrently fetches `users/{id}/mentalHealthProfile/currentProfile`
- Normalises and maps data into `RichUser` objects (extends `User` with DASS-21 scores and a raw timestamp for sorting)
- **Risk level resolution priority:** `classificationLevel` → `activeRecommendationCategory` → `initialQuestionnaireScore.category` → `riskLevel` → fallback to `'Low'`

#### Derived statistics (`useMemo`)
| Stat | Calculation |
|------|-------------|
| `highRisk` | Users with `Critical` or `High` risk |
| `critical` | Users with `Critical` risk specifically |
| `activeAlerts` | Same as `highRisk` count |
| `totalUsers` | All users |
| `activeUsers` | Users with `status === 'Active'` |
| `monitoringUsers` | Users with `status === 'Monitoring'` |
| `activeToday` | Users with `lastActivity` timestamp after midnight today |

#### Charts rendered:
1. **Emotional Trends** — `AreaChart` (Recharts) with static week data for distress vs. wellness
2. **AI Distress Analysis** — horizontal `BarChart` showing average DASS-21 scores for Depression, Anxiety, Stress with real data from Firestore (falls back to illustrative data if none)
3. **Risk Distribution** — progress bar rows showing percentage of users per risk level
4. **Secondary stats row** — 4 mini-cards for Critical / Monitoring / Active / All Users

#### Table: Top 5 risk users
Sorted first by `RISK_ORDER` (`Critical=0, High=1, Medium=2, Low=3`), then by most recent activity.

#### Alert panel
`derivedAlerts` is built from the top 6 high-risk users, each mapped to an `Alert` type (`Self-Harm` for Critical, `Distress` for High).

---

### 11.3 Critical Cases

**File:** `src/pages/CriticalCases.tsx`

Manages two distinct datasets:

#### Section 1: Connection Requests (Advisor Connection Workflow)
- Uses `listenToCriticalCases` real-time listener scoped to the current advisor's UID
- Displays connections in a filterable, searchable grid of `<ConnectionCard>` components
- Filter options: status (`All / pending / accepted`), search by name or email
- Cards are sorted newest-first by `createdAt` timestamp

**Actions per connection card:**
- **Accept** → calls `acceptAdvisorConnection()` (status: `pending → accepted`)
- **Mark Reviewed** → calls `markCaseReviewed()` (status: `accepted → reviewed`)
- **Open Details** → opens `<CaseDetailsModal>` with full case view + intervention chat

#### Section 2: AI-Flagged Cases (Legacy/Parallel system)
- Dual `onSnapshot` listeners: one on `users` collection, one on `cases` collection
- Users listener: merges user doc + mental health profile, filters to `Critical/High` risk users
- Cases listener: reads dedicated `cases` collection, filters to `Critical/High` or non-resolved
- `casesHasData.current` ref prevents the users fallback from overwriting if the `cases` collection has data
- Displayed as `<CaseCard>` grid with risk/status filters

**Modals launched from AI-Flagged section:**
- `<UserDetailsModal>` — full mental health profile viewer
- `<NotesModal>` — add advisor notes
- `<DirectChatModal>` — open a direct messaging thread

**Protocol reminder** banner at the bottom with 15-minute contact requirement for critical cases.

---

### 11.4 User Monitoring

**File:** `src/pages/UserMonitoring.tsx`

A paginated, sortable, searchable table of all platform users. Row clicks now open the **`UserDetailPanel`** (the new real-time diagnostic slide-in) instead of the legacy `UserDetailsModal`.

**Data loading:**
- `onSnapshot` on the `users` collection
- Parallel `getDoc` for each user's mental health profile
- `parseUser()` applies the same risk/status normalisation as Dashboard

**Summary cards:** Low Risk, Medium Risk, High/Critical — each shows count and percentage of total.

**Table controls:**
- Search input filters by `name` or `id`
- Sort dropdown: Risk Level (default) / Last Activity / Name
- Pagination: 10 users per page (`PAGE_SIZE = 10`)

**Row click** → sets `selectedUserId` state → renders `<UserDetailPanel userId={selectedUserId} onClose={...} />` as a centred modal overlay.

---

### 11.5 Chat Review

**File:** `src/pages/ChatReview.tsx`

The most complex page — a live, three-panel chat moderation interface.

#### Panel 1: Group List (left, fixed width 288px)
- Subscribes to the `peer_groups` collection
- Auto-selects the first group on load
- Shows a red badge per group with the count of pending-review flagged messages
- The badge count is maintained by a per-group `onSnapshot` listener on each group's `chatMessages` subcollection

#### Panel 2: Chat Conversation (centre, flex-grow)
- Real-time `onSnapshot` on `peer_groups/{groupId}/chatMessages` ordered by `timestamp asc`
- **Review filter** buttons: `pending / approved / rejected / all`
  - Deleted messages always show regardless of filter
- `<ChatViewer>` renders individual messages
- Clicking a flagged message opens Panel 3
- **Public message input** — advisors can post directly to the group chat

#### Panel 3: Flagged Message Action Panel (right, animated slide-in)
Visible only when a flagged message is selected. Has two tabs:

**Actions tab:**
- Shows current review status (pending / approved / rejected)
- **Approve** — writes `reviewStatus: 'approved'` to Firestore
- **Reject** — writes `reviewStatus: 'rejected'` with optional reason text
- **Private Note** — saves an `advisorNote` on the message document (invisible to group members)

**Private Chat tab:**
- Real-time listener on `peer_groups/{groupId}/chatMessages/{msgId}/privateThread`
- Advisors type a message and send; it is written to the `privateThread` subcollection with `visibleTo: [advisorId, senderId]`
- The flagged message sender sees this private reply in the MindMates+ app
- Message thread scrolls to bottom on each new message
- Context reference shows the original flagged message at the top of the private chat

**Delete message action** — marks message with `deletedByAdvisor: true` (the MindMates+ user app replaces the message text with a deletion notice).

**Connectivity indicator** — shows Live (green) or Disconnected (red) based on Firestore snapshot status.

---

### 11.6 Journal Review

**File:** `src/pages/JournalReview.tsx`

Reads and displays user journal entries with sentiment data.

#### Data loading strategy (resilient multi-source approach)
1. First builds a `userId → nickname` map from the `users` collection
2. Tries `collectionGroup('journal_entries')` (with `orderBy createdAt desc`)
3. Falls back to `collectionGroup('journals')`
4. Falls back to `collectionGroup('journalEntries')`
5. If all collectionGroup queries fail, tries the top-level `journals` collection

The `resolveUserId()` helper extracts the user ID from either a `userId` field in the document or the Firestore path segments (`users/ABC123/journalEntries/docId`).

**Real-time freshness:** A `users` collection `onSnapshot` triggers a full journal reload whenever user data changes.

#### Filtering
- Text search across `userName`, `content`, and `tags`
- Sentiment filter: `All / Positive (≥0) / Neutral (≥-0.3) / Negative (<-0.3)`

#### Entry card layout
- Left panel: user avatar, name, date, AI sentiment icon + progress bar, emotional tags
- Right panel: journal text content in italic quote style
- Actions: "Flag for Follow-up" (local state toggle) and "Add Note" (opens `<NotesModal>`)

---

### 11.7 AI Insights

**File:** `src/pages/AIInsights.tsx`

A **static** (no live Firestore data) analytics visualisation page showing:

1. **Emotional Profile Radar Chart** — compares current week vs. previous week across Anxiety, Depression, Stress, Loneliness, Anger, Hope using Recharts `RadarChart`
2. **Sentiment Distribution Donut Chart** — shows proportions of Positive / Neutral / Negative / Risky interactions (1,100 total events) using Recharts `PieChart` with `innerRadius`
3. **3 Insight Cards:**
   - Predictive Alert — AI-predicted 22% increase in depression indicators (static)
   - Wellness Growth — peer support engagement +15% (static)
   - Model Accuracy — 94.2% sentiment detection accuracy (static)

> **Note:** This page uses hardcoded illustrative data. Integration with real AI/ML backend is a future enhancement.

---

### 11.8 Reports

**File:** `src/pages/Reports.tsx`

A **static** report library UI with no actual file download implementation.

- Displays 5 hardcoded report entries with name, date, type (PDF/Excel/JSON), and file size
- Left sidebar: filter controls for Category, Timeframe, and Format (all UI-only)
- Auto-Reporting panel with "Configure Schedule" button (UI placeholder)
- "Generate New Report" and "Download" buttons are present but non-functional

---

### 11.9 Advisor Chat

**File:** `src/pages/AdvisorChat.tsx`

A private **advisor ↔ admin** messaging feature. Advisors can securely message system administrators.

#### Data model
- Admin users are stored in a top-level `admins` Firestore collection
- Chats are stored in `privateChats` collection with `chatType: 'admin_advisor'`
- Chat ID format: `{adminId}_{advisorId}`
- Messages are in `privateChats/{chatId}/messages` subcollection

#### Left panel: Admin list
- Listens to `admins` collection ordered by name
- Filters out the current user (advisors should not see themselves)
- Sorted by most-recent chat activity (admins with existing chats come first)
- Clicking an admin checks for an existing chat or creates one

#### Right panel: Chat interface
- `onSnapshot` on `privateChats/{chatId}/messages` ordered by `createdAt asc`
- Auto-marks incoming admin messages as `isRead: true` using a Firestore **batch write**
- Auto-scrolls to the latest message (`messagesEndRef`)
- Messages rendered with a dot-grid background for visual differentiation
- Outgoing messages: brand-blue right-aligned; incoming: white left-aligned

#### Sending
- `handleSendMessage` writes to `messages` subcollection and updates `lastMessage` / `updatedAt` on the parent chat document

---

### 11.10 Settings

**File:** `src/pages/Settings.tsx`

Advisor notification preferences and account settings. The profile photo and personal details section has been **extracted to `AdvisorProfile.tsx`**.

**Notification preferences** — 4 toggle switches (UI only — no backend persistence implemented):
- Critical Risk Alerts (default: on)
- Daily Summary (default: on)
- Chat Review Reminders (default: off)
- Advisor Mentions (default: on)

**Settings navigation** — left nav links for Profile, Notifications, Security, Language, Appearance. The Profile nav link navigates to `/profile`.

---

### 11.11 Advisor Profile

**File:** `src/pages/AdvisorProfile.tsx`

Advisor profile management. Separated from the main Settings page to give it dedicated space.

#### Profile Photo Upload
1. Hidden `<input type="file">` triggered by a button click via `ref`
2. On file selection: creates a local object URL for instant preview (`URL.createObjectURL`)
3. On Save: uploads to ImageKit via `uploadImageToImageKit(file, 'advisors')`, then writes the returned CDN URL to `advisors/{uid}.profileImageUrl` in Firestore, and calls `updateAdvisorProfile` to update the in-memory context
4. On Discard: revokes the object URL and clears local state
5. Memory leak prevention: revokes old object URL before creating a new one

#### Extended Profile Fields
These fields are stored in `advisors/{uid}` in Firestore and loaded from `advisorProfile`:

| Field | Type | Description |
|-------|------|-------------|
| `yearsOfExperience` | `number` | Advisor's years in practice |
| `qualifications` | `string` | Degrees, certifications |
| `about` | `string` | Bio / professional summary |
| `isModerator` | `boolean` | Whether the advisor has chat moderation privileges |

**Toast notifications:** Success (green) and Discard (slate) toasts auto-dismiss after 3 seconds.

---

### 11.12 Resources

**File:** `src/pages/Resources.tsx`

Full CRUD resource library for advisors to publish mental wellness content.

#### Resource types
| Type | Storage | Fields |
|------|---------|--------|
| `text` | Firestore only | `title`, `category`, `resource` (text content), `author`, `authorId` |
| `image` | ImageKit CDN + Firestore | Above + `image_url` |

#### Categories (6)
Wellness - Thriving / Wellness - Stress Aware / Wellness - Emotionally Aware / Mild Support / Recovery & Improvement / Moderate Support

#### Fetch on mount
`fetchResources()` — one-time `getDocs` on the `resources` collection ordered by `createdAt desc`.

#### Filtering
- Text search on `title` and `category`
- Type filter tabs: `all / text / image` (default: `image`)

#### Create/Edit modal
- Type selector (text article vs. image post)
- Title input (required)
- Category dropdown (required)
- Image upload area (conditional — only for image type): drag-and-drop-styled label with local preview
- Content textarea (required — article text or image description)
- On submit: uploads image to ImageKit if provided, then `addDoc` (create) or `updateDoc` (edit) in Firestore

#### Delete
- Confirms with `window.confirm`
- Deletes from Firestore with `deleteDoc`
- Attempts to delete the image from Firebase Storage (failure is silently ignored to not block the operation)

---

## 12. Shared UI Components

### 12.1 DashboardCard

A stat card displaying a title, numeric value, Lucide icon, and colour theme.

**Props:** `title`, `value` (number), `icon` (Lucide component), `color` (`'red' | 'amber' | 'brand' | 'emerald'`)

---

### 12.2 RiskBadge

A small coloured pill/badge showing a risk level.

**Props:** `level` (RiskLevel)

**Colour mapping:**
- Critical → red
- High → orange
- Medium → amber
- Low → emerald

---

### 12.3 AlertPanel

Displays a list of `Alert` objects in a scrollable panel.

**Props:** `alerts: Alert[]`

Each entry shows severity badge, alert type, user name, timestamp, and message snippet.

---

### 12.4 UserTable

A responsive table displaying a list of `User` objects.

**Props:** `users: User[]`, `onViewDetails?: (user: User) => void`

Each row shows: risk badge, user name, status chip, last activity, and optional "View" button. In `UserMonitoring`, the `onViewDetails` callback sets `selectedUserId` to trigger `UserDetailPanel`.

---

### 12.5 ChatViewer

Renders a scrollable list of `LiveChatMessage` objects within the Chat Review panel.

**Props:**
- `messages: LiveChatMessage[]`
- `currentUserId?: string` — used to distinguish advisor-sent messages
- `selectedFlaggedMsgId?: string` — highlights the currently-selected flagged message
- `onFlaggedMessageClick: (msg) => void`
- `onDeleteMessage: (msg) => void`

Renders each message with sender name, timestamp, flag indicators, review status badges, and delete affordance.

---

### 12.6 CaseCard

A card for an AI-flagged critical case.

**Props:** `caseData: Case`, `onViewDetails`, `onAddNote`, `onOpenChat`

Shows risk badge, user name, last activity, reason, status, and three action buttons.

---

### 12.7 ConnectionCard

A card for an advisor connection request.

**Props:** `connection: AdvisorConnection`, `onAccept`, `onMarkReviewed`, `onClick`

Shows the user's nickname, email, category, reason, request date, and status-based action buttons.

---

### 12.8 CaseDetailsModal

**File:** `src/components/CaseDetailsModal.tsx`

The most feature-rich modal — a full-screen overlay with two panels.

**Left panel (Case Details, 288px):**
- User avatar (initial letter), nickname, case status badge
- Category, reason, and connection date tiles
- **Profile Summary** — shows `classificationLevel`, `baselineCategory`, wellness score, user status, DASS-21 scores (if loaded)
- **Wellness Score Updater** — number input (0–100) + optional note → calls `updateUserWellnessScoreByAdvisor()`. Score < 10 triggers `userStatus: 'restricted'`
- **Approval section** — dropdown for approved category + optional note → calls `approveUserForNormalAccess()`. Disabled once approved
- **"View Full Profile"** button → opens `<UserDetailsModal>` as a nested overlay

**Right panel (Intervention Chat):**
- Real-time message list from `advisorConnections/{id}/messages`
- Marks all unread user messages as read on open
- Message input form with send button
- **"Mark Conversation as Reviewed"** button → calls `markCaseReviewed()`

---

### 12.9 UserDetailsModal

**File:** `src/components/UserDetailsModal.tsx`

A full-width modal showing a user's complete mental health profile fetched from Firestore. Used as a legacy deep-dive view from Critical Cases and as a nested modal inside `CaseDetailsModal`.

**Data fetch:** On open, parallel `getDoc` for `users/{id}` and `users/{id}/mentalHealthProfile/currentProfile`.

**Sections rendered:**
1. Basic info grid (email, age, gender, join date)
2. DASS-21 Assessment panel with score tiles
3. Current Mental State (mood score progress bar)
4. Diagnosis, Conditions, Risk Factors, Medications, Triggers tag sections
5. Clinical Notes
6. Empty state if no profile data exists

**Footer:** Optional "Open Chat" button (when `onOpenChat` prop is provided).

---

### 12.10 UserDetailPanel

**File:** `src/components/UserDetailPanel/index.tsx`

A **new** full-screen centred modal (780px × 88vh, mobile: full-screen) that replaces `UserDetailsModal` as the primary user drill-down from **User Monitoring**. It uses `useUserDiagnosticData` for all real-time data and renders a tabbed interface with a dark-navy header, ML diagnostics, and inline advisor actions.

#### Panel anatomy

| Layer | Component | Description |
|-------|-----------|-------------|
| Backdrop | `index.tsx` | Full-viewport semi-transparent overlay; clicking closes the panel |
| Panel container | `index.tsx` | Centered 780px card, scale + fade CSS animation |
| Header | `PanelHeader.tsx` | Dark navy (#0f1535); user name, risk chip (pulses if Critical), status chip, truncated UID, ExternalLink to journal review |
| Tab bar | `TabBar.tsx` | 4 visible tabs: Overview, Journals, Feedback, About |
| Tab content | `tabs/*.tsx` | Scrollable area |
| Action bar | `AdvisorActionBar.tsx` | Fixed bottom bar |

#### Tab bar — visible tabs

`TABS` array in `TabBar.tsx` contains 4 entries: **Overview**, **Journals**, **Feedback**, **About**. The `TabName` type also defines `'DASS & Scores'`, `'ML Pipeline'`, and `'BERT History'` (accessible via code but not shown in the current bar).

#### Tabs

| Tab | Content |
|-----|---------|
| **Overview** | Wellness ring (SVG), DASS-21 score cards with severity badges, active recommendation chip, recent BERT events list, wellness trend `LineChart` (Recharts), embedded `LiveDiagnosticsPanel` |
| **Journals** | User's latest 15 journal entries with `date`, `content`, `mood_tag`, ML analysis label + confidence |
| **Feedback** | Latest 5 feedback entries with star rating, peer comment, app comment |
| **About** | User demographics: age, gender, email, join date, advisor connection status |
| **DASS & Scores** | *(defined, not in bar)* Detailed DASS-21 breakdown with severity thresholds |
| **ML Pipeline** | *(defined, not in bar)* KNN pipeline details, group probabilities |
| **BERT History** | *(defined, not in bar)* Full BERT prediction timeline |

#### `LiveDiagnosticsPanel` (embedded in Overview tab)

A dark-navy (#0d1929) real-time ML dashboard. Sections:
- **Live Scores** — DASS-21 bars with severity badges, user status chip
- **Recommendation Pipeline** — 4-step waterfall (P1–P4) with active step highlighted and overridden steps struck through; stability counter dot-progress display
- **BERT Prediction History** — scrollable list of last 20 events, each with source icon, `PredChip`, confidence %, text preview; includes `ConfidenceSparkline`
- **KNN Result** — KNN group, mapped category, safety flag, fallback reason, last-run time, per-group probability bars
- **Event Log** — session-level log of Firestore changes (category moves, score changes, BERT events); clearable

**Re-run KNN:** Writes `knnRerunRequestedAt` + `knnRerunRequestedBy` to `currentProfile` to signal the backend to re-run KNN for this user.

#### `ConfidenceSparkline`

Pure SVG (no Recharts). Plots BERT confidence values oldest-to-newest, with line segments coloured by label (red=depression, amber=anxiety, green=normal) and a dashed 0.80 threshold reference line.

#### `AdvisorActionBar`

Fixed bottom strip with four actions:

| Action | Firestore Write | Notes |
|--------|-----------------|-------|
| **Add Note** | Appends timestamped note to `advisorConnections/{id}.notes` | Creates connection doc if none exists via `ensureConnectionDoc()` |
| **Connect** | Creates/updates `advisorConnections` doc + sets `advisorConnectionStatus: 'accepted'` and `userStatus: 'under_review'` on `currentProfile` | Disabled if already connected |
| **Flag Critical** | Sets `users/{uid}.userStatus: 'under_review'`, `currentProfile.userStatus: 'under_review'`, writes `advisorConnections/{id}/auditLog` doc | Shows inline confirmation dialog |
| **Open Chat** | `navigate('/chat')` | No Firestore write |

**ESC key** closes the panel. **Backdrop click** closes the panel. On each new `userId`, `activeTab` resets to `'Overview'`.

---

### 12.11 DirectChatModal

Provides a direct messaging interface between the advisor and a user, linked to an AI-flagged case.

**Props:** `isOpen`, `onClose`, `caseData: Case`, `onViewProfile`

Uses the `advisorConnections` sub-collection messaging system. Mirrors the chat UI from `CaseDetailsModal` but is opened from the `CriticalCases` page for AI-flagged cases.

---

### 12.12 NotesModal

A simple modal for adding advisor notes about a user.

**Props:** `isOpen`, `onClose`, `userName: string`

Contains a textarea and submit button. Note persistence may connect to the `advisorNotes` Firestore collection.

---

## 13. Firestore Data Model

```
advisors/{uid}
  ├── name, role, email, profileImageUrl
  └── yearsOfExperience, qualifications, about, isModerator   ← extended profile fields

users/{uid}
  ├── nickname / nickName / displayName, email, age, gender, status, riskLevel
  ├── wellnessScore, userStatus, advisorConnectionStatus
  ├── knnMappedCategory, knnSafetyFlag                        ← may also live here
  ├── peerGroupRecommendationCategory, weeklyTrendCategory
  ├── activeRecommendationCategory, baselineRecommendationCategory
  ├── mlMentalHealthProfile { anxietyCount, depressionCount, dominantCategory, lastUpdated }
  └── mentalHealthProfile/
      └── currentProfile                                      ← primary ML/DASS document
          ├── initialQuestionnaireScore { depressionScore, anxietyScore, stressScore }
          ├── dass21Scores { depression, anxiety, stress }    ← legacy fallback
          ├── classificationLevel, activeRecommendationCategory
          ├── baselineRecommendationCategory
          ├── peerGroupRecommendationCategory, weeklyTrendCategory
          ├── knnRecommendedGroup, knnMappedCategory
          ├── knnProbabilities { [group]: number }
          ├── knnSafetyFlag, knnFallbackReason, knnLastUpdatedAt
          ├── knnRerunRequestedAt, knnRerunRequestedBy        ← advisor triggers backend re-run
          ├── mlStabilityCounter { repeatedCount, lastPrediction, maxCount }
          ├── wellnessScore, userStatus, advisorConnectionStatus
          ├── connectedAdvisorId, advisorConnectionId, approvedByAdvisorId
          └── lastUpdated, advisorApprovedAt

  └── journal_entries/{id}
      ├── date (primary timestamp), content, mood_tag
      └── ml_analysis { prediction, confidence, probabilities }

  └── mlAnalysisHistory/{id}                                  ← NEW: BERT prediction events
      ├── prediction / label, confidence / score
      ├── probabilities { depression, anxiety, normal }
      ├── source ("journal" | "group_chat" | "ai_chat")
      ├── textPreview, wellnessScore, triggeredCategoryMove
      └── createdAt / timestamp

  └── wellnessScoreHistory/{id}
      ├── newScore, previousScore, source
      └── createdAt

  └── feedback/{id}                                           ← NEW: user feedback entries
      ├── star_rating, peer_comment, app_comment
      └── createdAt

advisorConnections/{id}
  ├── userId, advisorId, status, caseType, reason
  ├── userName, userEmail, userMentalHealthCategory
  ├── notes (appended timestamped advisor notes)
  ├── lastMessage, updatedAt, createdAt
  ├── messages/{msgId}                                        ← case intervention chat
  └── auditLog/{id}                                          ← NEW: advisor action audit log
      ├── action ("flagged_critical" | ...)
      ├── advisorId
      └── timestamp

peer_groups/{id}
  ├── group_name, group_category, memberCount, groupImageUrl
  └── chatMessages/{msgId}
      ├── isFlagged, reviewStatus, deletedByAdvisor, advisorNote
      ├── senderId, senderName, text, timestamp
      └── privateThread/{msgId}                              ← private advisor reply thread

privateChats/{chatId}                                        ← Admin ↔ advisor private chats
  ├── chatType: 'admin_advisor', participants[]
  ├── lastMessage, updatedAt
  └── messages/{msgId}

resources/{id}
  ├── title, category, resource (text), author, authorId
  ├── type ("text" | "image"), image_url
  └── createdAt

cases/{id}                                                   ← Legacy AI-flagged case records
admins/{uid}                                                 ← System administrator accounts
journals/{id}  OR users/{uid}/journalEntries/{id}           ← Alternative journal schemas
```

---

## 14. Risk Classification System

Risk levels are normalised from a wide variety of source field names using this shared logic (defined centrally in `types/userDiagnostic.ts` and duplicated in page-level files for isolation):

```ts
function normalizeRiskLevel(value: unknown): RiskLevel {
  const v = String(value ?? '').toLowerCase().trim();
  if (v.includes('extremely') || v.includes('severe') || v === 'critical') return 'Critical';
  if (v.includes('high') || v.includes('moderate') || v === 'moderate') return 'High';
  if (v === 'medium' || v === 'mild') return 'Medium';
  return 'Low';
}
```

**Source fields checked (in priority order):**
1. `mentalHealthProfile.classificationLevel`
2. `mentalHealthProfile.activeRecommendationCategory`
3. `mentalHealthProfile.initialQuestionnaireScore.category`
4. `user.classificationLevel`
5. `user.riskLevel` / `user.risk_level`
6. `user.severity` / `user.alertLevel`

**Risk ordering constant** (used for sorting):
```ts
{ Critical: 0, High: 1, Medium: 2, Low: 3 }
```

---

## 15. ML Pipeline & Recommendation System

The portal surfaces a multi-stage ML pipeline that runs in the MindMates+ backend and writes results to Firestore. Advisors can observe and intervene via the `UserDetailPanel`.

### BERT Sentiment Analysis

BERT runs on user-generated text (journal entries, group chat messages, AI chat messages) and writes to `users/{uid}/mlAnalysisHistory`. Each event records:
- `prediction` — `"depression"` | `"anxiety"` | `"normal"`
- `confidence` — 0–1 float
- `probabilities` — raw softmax scores for all labels
- `source` — `"journal"` | `"group_chat"` | `"ai_chat"`
- `textPreview` — first 80 chars of analysed text

### ML Stability Counter

`mentalHealthProfile.currentProfile.mlStabilityCounter` tracks how many consecutive BERT events share the same prediction. When `repeatedCount` reaches `maxCount` (default 5), the backend promotes the user's `activeRecommendationCategory` to reflect the dominant label.

```ts
{ repeatedCount: 3, lastPrediction: "depression", maxCount: 5 }
```

### KNN Recommendation

KNN groups users into peer support cohorts. Results written to `currentProfile`:
- `knnRecommendedGroup` — raw group ID (e.g. `"G4_Anxiety_Management"`)
- `knnMappedCategory` — human-readable wellness category
- `knnProbabilities` — per-group probability map
- `knnSafetyFlag: true` — set when user is in G1 (crisis tier); blocks auto-assignment of the KNN category

Advisors can request a KNN re-run by writing `knnRerunRequestedAt` to `currentProfile` via the **Re-run KNN** button in `LiveDiagnosticsPanel`.

### 4-Level Recommendation Priority Chain

`resolveActiveRecommendation()` in `types/userDiagnostic.ts` determines which category is currently active for a user:

| Priority | Source | Field | Notes |
|----------|--------|-------|-------|
| **P1** | Weekly Trend | `peerGroupRecommendationCategory` / `weeklyTrendCategory` | Drives the HomeScreen in MindMates+ app |
| **P2** | KNN | `knnMappedCategory` | Blocked if `knnSafetyFlag === true` |
| **P3** | Baseline | `baselineRecommendationCategory` | Frozen DASS-21 baseline; stable long-term anchor |
| **P4** | Active ML | `activeRecommendationCategory` | Stability-counter-based; fallback |

The `LiveDiagnosticsPanel` displays this as a waterfall: the active level is highlighted in green, overridden levels are struck through and dimmed.

### DASS-21 Clinical Thresholds (`getDASSSeverity`)

| Scale | Normal | Mild | Moderate | Severe | Extremely Severe |
|-------|--------|------|----------|--------|-----------------|
| Depression | < 10 | 10–13 | 14–20 | 21–27 | ≥ 28 |
| Anxiety | < 8 | 8–9 | 10–14 | 15–19 | ≥ 20 |
| Stress | < 15 | 15–18 | 19–25 | 26–33 | ≥ 34 |

---

## 16. Key Design Patterns

### Real-time Subscriptions
All live data pages use `onSnapshot` from Firestore for real-time updates. Each page's `useEffect` subscribes on mount and returns the unsubscribe function for cleanup:
```ts
useEffect(() => {
  const unsub = onSnapshot(query, handler, errorHandler);
  return unsub;
}, [deps]);
```

### Centralised Diagnostic Hook
`useUserDiagnosticData` batches all 7 listeners for a user into one hook with a single `UserDiagnosticData` state object. This avoids prop drilling and guarantees all panel sub-components always see a consistent snapshot.

### Resilient Data Parsing
All Firestore-to-TypeScript conversions check multiple possible field names (`nickname ?? nickName ?? displayName ?? name`) and handle both Firestore `Timestamp` objects and ISO string timestamps. Unknown/null values degrade gracefully to `'—'` or `undefined`.

### Firestore Timestamp Conversion
Two patterns used:
```ts
// Check for Firestore Timestamp-like objects
if (typeof v === 'object' && 'seconds' in v) {
  return new Date(v.seconds * 1000);
}
// Or instanceof check
if (v instanceof Timestamp) return v.toDate();
```
The canonical helper is `tsToDate()` in `types/userDiagnostic.ts`.

### Animations
All page-level components use `motion.div` with:
```ts
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
```
Modals use `AnimatePresence` + `scale: 0.95 → 1` entrance animations. Toast alerts use spring physics. `UserDetailPanel` uses pure CSS `transition` (scale + opacity) instead of `motion` for performance.

### Class Name Merging
The `cn()` utility from `lib/utils.ts` is used everywhere for conditional Tailwind classes:
```ts
className={cn(
  "base-classes",
  condition && "conditional-class",
  variant === 'red' ? "text-red-600" : "text-emerald-600"
)}
```

### Skeleton Loading States
Dashboard and other pages render animated `bg-slate-200 animate-pulse` placeholder divs while Firestore data loads, providing smooth perceived performance.

### Environment Variables
All secrets and configuration use `VITE_` prefixed env vars (read via `import.meta.env`):
- `VITE_FIREBASE_*` — Firebase project credentials
- `VITE_API_BASE_URL` — FastAPI backend URL (for ImageKit auth and KNN re-run)
- `VITE_IMAGEKIT_PUBLIC_KEY` — ImageKit public key (safe to expose)

---

*Generated: 2026-05-24 · MindMatesPlus Advisor Portal — branch `AI_Analytics`*
