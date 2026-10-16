# 01 — Application Inventory (Wolvo, Base44 app)

_Generated 2026-10-17. Read-only assessment; no source files were modified._

## 0. Scope and location note

The app source currently lives under **`frontend/`** (untracked in git). The committed copy at the repo root (`base44/`, `src/`, …) shows as deleted in the working tree, and `backend/` is empty. All paths below are relative to `frontend/`.

| Area | Path | Count |
|---|---|---|
| Entities | `base44/entities/*.jsonc` | 34 |
| Backend functions | `base44/functions/*/entry.ts` | 62 |
| Shared backend modules | `base44/shared/*.ts` | 8 (`access`, `auctionBidding`, `eventBookings`, `payments`, `settleAuction`, `totp`, `twoFactor`, `verificationScoring`) |
| Realtime actors | `base44/actors/LiveRoom/entry.ts` | 1 |
| Workflows (scheduled) | `base44/workflows/*.jsonc` | 1 |
| Email templates | `base44/emails/*.html` | 6 (`AccessApproved`, `EmailVerification`, `ManualReviewRequested`, `PasswordReset`, `UserInvite`, `VerificationDecision`) |
| Page components | `src/pages/**/*.jsx` | 36 (35 routed + 1 unrouted) |

### Roles

`User.role` enum: **`admin` | `auctioneer` | `moderator` | `user`**. "Seller", "buyer", "organiser" are not roles; they're relationships to a record (`seller_id`, `buyer_id`, `created_by_id`, etc.).

- `shared/access.ts`: `isStaff` = admin or auctioneer. `canOperateAuction` = admin, or an auctioneer whose id equals `auction.auctioneer_id`. An unassigned auction is admin-only.
- `moderator` only appears in `Dispute` update RLS and `resolveDispute`. No UI or route targets it.

**Legend for access columns:** `Public` = anyone, including anonymous · `Owner` = record's `created_by_id` is the caller · `Self` = the named `data.*_id` field equals the caller · `Admin` = `role: admin` · `Signed-in` = any authenticated user.

---

## 1. Entities (34)

| Entity | Purpose | Key fields | Read | Create | Update | Delete |
|---|---|---|---|---|---|---|
| AccountRestriction | Bans/restrictions on a user (also the deleteAccount tombstone) | user_id, reason, restricted_by, starts_at, ends_at, active | Self (user_id) or Admin | Admin | Admin | Admin |
| AttendanceRegistration | RSVP to attend a physical/hybrid **auction** | auction_id, user_id, party_size, booking_code, status (registered/confirmed/declined/cancelled), check_in_status | Owner or Admin | Owner | Admin | Admin |
| AttendanceSlot | Time windows with capacity for a **garage-sale event** | event_id, scheduled_at, duration_minutes, capacity, location, status | Public | Admin | Admin | Admin |
| Auction | Core listing/lot: bidding, physical-event state machine, live-stream state | title, category, condition, suburb/state, starting_bid, current_highest_bid, min_bid_increment, reserve_price, status (upcoming/open/closed), bidding_type (online/physical/hybrid), closing_time, attendance_status (8 states), auctioneer_id, seller_id, garage_sale_event_id, paused, winning_bid_id, live_now/live_source/live_stream_url | Public | Admin | Admin | Admin |
| AuctionImage | Extra images per auction | auction_id, image_url, sort_order, is_primary | Public | Admin | Admin | Admin |
| AuctionParticipant | Bidder registration/number per auction | auction_id, user_id, bidder_number, status | Owner or Admin | Owner | Admin | Admin |
| AuditLog | Security/ops audit trail | actor_id, actor_email, action, entity_type, entity_id, details, severity | Admin | Admin | Admin | Admin |
| Bid | Individual bids (online and physical) | auction_id, bidder_id, bidder_name, amount, status (placed/winning/outbid/won/lost), bid_source, auctioneer_id | **Public** (bidder_id/bidder_name readable) | Admin | Admin | Admin |
| Category | Listing categories | name, slug, description, icon | Public | Admin | Admin | Admin |
| CollectionAppointment | Winner's pickup booking | auction_id, transaction_id, slot_id, user_id, scheduled_at, collection_code, status, collected_at/by | Owner or Admin | Owner | Admin | Admin |
| CollectionSlot | Seller-defined pickup windows | auction_id, scheduled_at, capacity, location, deadline, status | Admin | Admin | Admin | Admin |
| CompletedTransaction | The order created when an auction settles | auction_id, buyer_id, seller_id, final_price, fees, commission, total, payment_deadline, payment_method, payment_reference, status (pending_payment/paid/ready_for_collection/completed/cancelled), non_payment_status | Self (buyer_id or seller_id) or Admin | Admin | Admin | Admin |
| ContactMessage | Contact-form submissions | name, email, phone, subject, message, status | Admin | **Public** (no condition) | Admin | Admin |
| Dispute | Buyer/seller disputes, incl. non-payment | transaction_id, filed_by, buyer_id, seller_id, dispute_type, evidence[], status, resolution, resolved_by | Self (filed_by/buyer_id/seller_id) or Admin | Owner | Admin or **Moderator** | Admin |
| EventAttendance | RSVP to a garage-sale event slot | event_id, slot_id, user_id, party_size, booking_code, status, check_in_status | Owner or Admin | Owner | Admin | Admin |
| GarageSaleEvent | Parent container for garage-sale / house-clearance items | title, participation (online/physical/hybrid), venue/address/suburb/state, event_start/end, status (draft/open/closed/cancelled), organizer_id, live_* fields | Public | Owner (any signed-in) | Owner or Admin | Owner or Admin |
| InspectionSlot | Viewing windows; holds the private full address | auction_id, scheduled_at, capacity, location_hint, full_address, status | Admin | Admin | Admin | Admin |
| ItemComment | Public Q&A/comments on items | auction_id, event_id, user_id, author_name, body, parent_comment_id, status (visible/hidden), reported | status=visible, or Owner, or Admin | Owner | Owner or Admin | Admin |
| Notification | In-app notification feed | user_id, type, title, body, read, link | Self (user_id) or Admin | Admin | Self | Self |
| Payment | Payment record per order (manual + Stripe) | transaction_id, user_id, amount, currency, payment_method, status (9 states), provider_reference, payment_reference, client_secret, confirmed_by, refund_status, refunded_amount | Self (user_id) or Admin | Admin | Admin | Admin |
| PaymentMethodConfig | Enabled payment methods + PayID/bank details | stripe_enabled/mode, paypal_enabled/mode, payid_*, bank_* (BSB, account no.), default_payment_deadline_days, live_payments_enabled | Admin | Admin | Admin | Admin |
| PermissionGrant | Seller/auctioneer permission grants | user_id, permission (seller/auctioneer), status, granted_by | Self (user_id) or Admin | Admin | Admin | Admin |
| PricingConfig | Platform fee switches/amounts (all default off/$0) | *_fee_enabled / *_fee_amount for registration, listing, bidding, viewing, attendance, verification, notifications, featured; commission_percent; subscription amounts | Public | Admin | Admin | Admin |
| Review | Post-transaction ratings | transaction_id, reviewer_id, reviewee_id, rating, comment, status, flagged, flag_status | Public | Admin | Owner or Admin | Admin |
| TwoFactorStatus | TOTP secret, recovery codes, lockout, MFA session window | user_id, totp_secret, enabled, confirmed, recovery_codes[], last_used_step, failed_attempts, locked_until, mfa_verified_until | Admin | Admin | Admin | Admin |
| User | Built-in platform user (extended with role) | role (admin/auctioneer/moderator/user) | _No RLS block; platform-managed_ | — | — | — |
| UserProfile | User's own profile details | preferred_name, phone, suburb, state, bio, avatar_url, preferred_contact | Owner or Admin | Owner | Owner | Admin |
| VerificationCase | 100-point ID verification case per user | user_id, legal_name, date_of_birth, residential_address, verification_status (UNVERIFIED/PENDING/VERIFIED/REJECTED/RESTRICTED), total_points, combination_met, review_type, external_verification_status, decided_by | Self (user_id) or Admin | Admin | Admin | Admin |
| VerificationEvidence | Uploaded ID/address documents | case_id, user_id, file_uri, document_type (14 types), category_group, points_awarded, extracted_name/dob/address, expiry_date, is_duplicate, status | Owner or Admin | Owner | Admin | Admin |
| VerificationFlag | Fraud/mismatch flags on a case | case_id, evidence_id, flag_type (8 types), severity, resolved | Admin | Admin | Admin | Admin |
| VerificationReviewNote | Internal admin review notes | case_id, admin_id, note, review_type | Admin | Admin | Admin | Admin |
| VerificationScoringPolicy | Points policy for verification | target_points, require_primary_identity, require_address_evidence, max_supporting_points, police_clearance rules, provider_enabled, retention_days, categories[] | Public | Admin | Admin | Admin |
| ViewingAppointment | Request to inspect an item in a slot | auction_id, slot_id, user_id, requested_slot, party_size, booking_code, status, address_released | Owner or Admin | Owner | Admin | Admin |
| Watchlist | User's saved auctions | auction_id | Owner | Owner | Owner | Owner |

---

## 2. Backend functions (62)

**Notation.** "Writes" lists entities the function writes directly or through a shared helper:
- `notifyUser` (eventBookings) → Notification
- `recomputeAttendanceStatus` (eventBookings) → Auction (+ Notification)
- `settleAuction` → Auction, Bid, CompletedTransaction, AuditLog, Notification
- `placeAuthoritativeBid` (auctionBidding) → Bid, Auction
- `markStripePaid` (payments) → Payment, CompletedTransaction, Notification
- `auditPayment` (payments) → AuditLog

Nearly every function performs its writes through `asServiceRole`, which bypasses entity RLS, so the function's own checks are the real access control. "UI caller" lists where `src/` invokes the function. Functions marked _none_ have no frontend caller.

### 2.1 Bidding and auction operation

| Function | What it does | Who can call | Writes | UI caller |
|---|---|---|---|---|
| placeBid | Places an online bid. Requires VERIFIED case, 2FA enabled, an active MFA window, and no restriction | Signed-in (with those gates) | Bid, Auction | AuctionDetails |
| auctioneerPlaceBid | Enters a physical bid for a registered bidder; same authoritative state as online bids | Admin, or assigned auctioneer (`canOperateAuction`) | Bid, Auction, AuditLog | AuctioneerDetail |
| pauseAuction | Pauses an open auction (blocks all bids) | Admin / assigned auctioneer | Auction, AuditLog | AuctioneerDetail |
| resumeAuction | Resumes, optionally extending the closing time | Admin / assigned auctioneer | Auction, AuditLog | AuctioneerDetail |
| closeAuction | Manually settles an open auction | Admin / assigned auctioneer | via settleAuction | AuctioneerDetail |
| autoCloseAuctions | Settles every open auction past closing_time (scheduled job, idempotent) | Scheduler (no user); a signed-in non-admin gets 403; an admin may run it manually | via settleAuction | _none_ (workflow) |
| goLive | Starts/stops an embed or camera broadcast on an auction or event | Admin, or an auctioneer who owns the record (created_by/seller/assigned auctioneer) | Auction or GarageSaleEvent (live_* fields) | GoLive |
| getLiveStream | Public read of live state + LiveRoom room id | Public | — | lib/liveQueries |

### 2.2 Garage-sale events

| Function | What it does | Who can call | Writes | UI caller |
|---|---|---|---|---|
| manageGarageSaleEvent | create_event / update_event / add_item / update_item. Items are normal Auctions with `seller_id` = organiser | Signed-in to create; organiser (created_by) or Admin to modify; item seller or Admin to edit an item | GarageSaleEvent, Auction | SellGarageSale, GarageSaleEvent |
| manageAttendanceSlot | Create/update/cancel event attendance slots; cancel cascades to RSVPs | Event organiser or Admin | AttendanceSlot, EventAttendance, Notification | EventAttendancePanel |
| registerEventAttendance | RSVP to an event slot (auto-confirmed, capacity enforced) | Signed-in | EventAttendance, Notification | EventAttendancePanel |
| cancelEventAttendance | Cancels own RSVP | RSVP owner or Admin | EventAttendance | EventAttendancePanel |
| getEventAttendance | Slots with remaining capacity + caller's own RSVP | Public (own RSVP only if signed-in) | — | lib/eventAttendanceQueries |

### 2.3 Inspections, physical-auction attendance, check-in

| Function | What it does | Who can call | Writes | UI caller |
|---|---|---|---|---|
| saveInspectionSlot | Create/update inspection slot (holds private address) | **Admin only** | InspectionSlot | ManageInspections |
| getInspectionInfo | Sanitised slots (no full_address) + counts | Public | — | lib/eventQueries |
| requestViewing | Books a viewing in a slot (capacity, no duplicates) | Signed-in | ViewingAppointment, Notification | InspectionPanel |
| decideViewing | Approve (releases address) / decline a viewing | **Admin only** | ViewingAppointment, Notification | ManageInspections |
| registerAttendance | Registers to attend a physical/hybrid auction (window and capacity enforced) | Signed-in | AttendanceRegistration, Auction, Notification | AttendancePanel |
| decideAttendance | Approve/decline attendance; issues booking code | **Admin only** | AttendanceRegistration, Auction, Notification | ManageAttendance |
| manageAuctionEvent | Seller-side event state machine: confirm/reschedule/cancel/complete | **Admin only** | Auction, AttendanceRegistration, Notification | ManageAttendance |
| getAttendanceInfo | Public attendance config + aggregate counts (also refreshes threshold status) | Public | Auction, Notification (via recompute) | lib/eventQueries |
| cancelBooking | Cancels a viewing or attendance booking | Booking owner or Admin | ViewingAppointment / AttendanceRegistration, Auction, Notification | AttendancePanel, InspectionPanel, ManageInspections |
| recordCheckIn | Records arrival / no-show by id or booking code | Admin / assigned auctioneer | ViewingAppointment / AttendanceRegistration | CheckInConsole |

### 2.4 Payments and transactions

| Function | What it does | Who can call | Writes | UI caller |
|---|---|---|---|---|
| getPaymentCheckout | Returns the order, available methods, and manual instructions. Creates one Payment per order. Can finalise a Stripe payment by polling | Buyer or Admin (full); Seller (read-only status) | Payment, CompletedTransaction (+ via markStripePaid) | lib/paymentQueries, StripeCardCheckout |
| selectPaymentMethod | Buyer picks a method; manual methods lock and return instructions + reference | Buyer or Admin | CompletedTransaction, Payment, AuditLog | CheckoutPanel |
| createStripePaymentIntent | Creates/reuses a Stripe PaymentIntent; amount always read from the DB | Buyer or Admin (`buyerOwnsOrder`) | Payment, CompletedTransaction, AuditLog (+ via markStripePaid) | StripeCardCheckout |
| stripeWebhook | Verifies `Stripe-Signature`, reconciles payment_intent.*, charge.refunded, charge.dispute.* | Stripe (no user auth; signature-verified) | Payment, CompletedTransaction, Notification, AuditLog | _none_ (external) |
| confirmManualPayment | Staff confirms PayID/bank funds arrived. This is the only path that marks a manual payment Paid | Admin / assigned auctioneer | Payment, CompletedTransaction, AuditLog, Notification | CheckoutPanel, AdminPayments |
| recordPayment | Manually records a manual-method payment against an order | Admin / assigned auctioneer | Payment, CompletedTransaction, AuditLog, Notification | _none_ |
| markPaymentFailed | Marks a payment failed/expired (not if paid/refunded) | Admin only | Payment, AuditLog | CheckoutPanel, AdminPayments |
| refundPayment | Records a full/partial refund for manual payments; rejects Stripe/PayPal | Admin only | Payment, AuditLog | CheckoutPanel, AdminPayments |
| savePaymentMethodConfig | Saves payment methods, bank/PayID details, live switch | Admin only | PaymentMethodConfig, AuditLog | PaymentMethodConfigPanel |
| savePricingConfig | Saves fee config | Admin only | PricingConfig, AuditLog | AdminSettings |
| testStripePaymentGate | Self-test suite for the Stripe gate and ownership checks; reads live config + secrets (returns only ok/mode, no key material) | **No role check** (anyone, incl. anonymous; real-invoke cases skipped without auth) | — | _none_ |
| getCollectionInfo | Sanitised collection slots + capacity for an order | Buyer, Seller or Admin | — | lib/transactionQueries |
| saveCollectionSlot | Create/update collection slot | Admin only | CollectionSlot | CollectionPanel |
| bookCollection | Winner books pickup (payment recorded, capacity, deadline, one active booking) | Buyer or Admin | CollectionAppointment, Notification | CollectionPanel |
| cancelCollection | Cancels own collection booking | Booking owner or Admin | CollectionAppointment | CollectionPanel |
| markCollected | Marks item collected; completes a paid transaction | Admin / assigned auctioneer | CollectionAppointment, CompletedTransaction, Notification | CollectionPanel |
| reportNonPayment | Seller reports non-payment after deadline; opens a dispute | Seller or Admin (admin may report before the deadline) | CompletedTransaction, Dispute, Notification | CheckoutPanel |
| resolveNonPayment | cancel / offer_next (re-award to next bidder) / relist / dismiss | Admin only | Auction, Bid, CompletedTransaction, Notification | _none_ |

### 2.5 Disputes, reviews, comments

| Function | What it does | Who can call | Writes | UI caller |
|---|---|---|---|---|
| fileDispute | Files a dispute on a transaction | Buyer, Seller or Admin | Dispute, Notification | DisputePanel |
| resolveDispute | Resolves/dismisses a dispute | Admin or Moderator | Dispute, Notification | DisputePanel |
| submitReview | Reviews the other party after a completed transaction (one per reviewer per tx) | Buyer or Seller of that tx | Review | ReviewPanel |
| reportReview | Flags a review for moderation | Signed-in | Review | ReviewPanel |
| moderateReview | hide / publish / dismiss_report | Admin only | Review | ReviewPanel |
| postItemComment | Post / reply / report a comment (6/min spam guard) | Signed-in | ItemComment | CommentsSection |
| moderateComment | hide / show / delete comment | Admin only | ItemComment, AuditLog | _none_ |

### 2.6 Identity verification

| Function | What it does | Who can call | Writes | UI caller |
|---|---|---|---|---|
| submitVerification | Opens a PENDING case with declared identity (one active case per user; blocked if VERIFIED/RESTRICTED) | Signed-in | VerificationCase, AuditLog | DeclaredDetailsForm |
| addVerificationEvidence | Adds an evidence file, rescores, flags mismatches/duplicates/expiry | Signed-in (own active case) | VerificationEvidence, VerificationFlag, VerificationCase | EvidenceUpload |
| getVerificationStatus | Sanitised status for the owner | Signed-in (self) | — | BidReadiness, VerifyIdentity |
| requestManualReview | Requests alternative/exception review; emails admins | Signed-in (own case) | VerificationCase, AuditLog (+ Core.SendEmail) | VerifyIdentity |
| reviewVerification | Admin decision (won't VERIFY unless combination met / provider passed) | Admin only | VerificationCase, VerificationReviewNote, AuditLog (+ Core.SendEmail) | AdminVerifications |

### 2.7 Two-factor authentication and account

| Function | What it does | Who can call | Writes | UI caller |
|---|---|---|---|---|
| setupTwoFactor | Generates TOTP secret, returns otpauth URI + QR once | Signed-in | TwoFactorStatus, AuditLog | SecuritySettings |
| confirmTwoFactor | Confirms setup with code; returns recovery codes once | Signed-in | TwoFactorStatus, AuditLog, Notification | SecuritySettings |
| verifyTwoFactor | Validates TOTP/recovery code; opens MFA session window | Signed-in | TwoFactorStatus, AuditLog | VerifyTwoFactor |
| getTwoFactorStatus | Status without secrets | Signed-in (self) | — | BidReadiness, MfaGate, SecuritySettings |
| disableTwoFactor | Disables after re-auth with a code | Signed-in | TwoFactorStatus, AuditLog, Notification | SecuritySettings |
| regenerateRecoveryCodes | New recovery codes after re-auth | Signed-in | TwoFactorStatus, AuditLog, Notification | SecuritySettings |
| requestLostAuthenticator | Logs a lost-device request (does not reset) | Signed-in | AuditLog, Notification | SecuritySettings, VerifyTwoFactor |
| adminResetTwoFactor | Resets a user's 2FA after offline re-verification | Admin only | TwoFactorStatus, AuditLog, Notification | _none_ |
| deleteAccount | Soft-deletes: tombstone restriction, drops evidence + 2FA secret | Signed-in (self) | AccountRestriction, VerificationCase, VerificationEvidence (deleteMany), TwoFactorStatus, AuditLog | DeleteAccountSection |

### 2.8 Realtime actor (not a function, listed for completeness)

- **LiveRoom** (`base44/actors/LiveRoom/entry.ts`): WebRTC signalling relay, one room per `live_<auction|event>_<id>`. It stores seats in actor storage and does not check auth or role. Any connection that sends `broadcaster_join` becomes the broadcaster.

### 2.9 Functions with no frontend caller (7)

`autoCloseAuctions` (scheduler), `stripeWebhook` (Stripe), `testStripePaymentGate` (test harness), `recordPayment`, `resolveNonPayment`, `moderateComment`, `adminResetTwoFactor`. The last four are admin/staff actions that no UI exposes yet.

---

## 3. Pages and routes (`src/App.jsx`)

Guards:
- **ProtectedRoute**: any authenticated user, else redirect to `/login`.
- **AdminRoute**: `role === 'admin'`, else redirect to `/`.
- **AuctioneerRoute**: `role === 'auctioneer' || 'admin'`.
- **MfaGate**: mounted in `PublicLayout`. It redirects users who have 2FA enabled but no current MFA session to `/verify-2fa`.

### 3.1 Public (PublicLayout, no account needed)

| Route | Page | Purpose | Visible to |
|---|---|---|---|
| `/` | Home | Landing page, featured/active auction counts | Everyone |
| `/auctions` | BrowseAuctions | Search/browse listings | Everyone |
| `/auctions/:id` | AuctionDetails | Lot detail, bidding (bid requires verification + 2FA), inspection/attendance panels, comments, live stream; staff-only management links | Everyone (bid: signed-in; staff panel: admin/auctioneer) |
| `/upcoming` | UpcomingAuctions | Upcoming auctions | Everyone |
| `/completed` | CompletedAuctions | Closed auctions/results | Everyone |
| `/how-it-works` | HowItWorks | Static explainer | Everyone |
| `/buyer-safety` | BuyerSafety | Static safety info | Everyone |
| `/sellers` | SellerInformation | "Sell on Wolvo" info | Everyone |
| `/faq` | FAQ | FAQ | Everyone |
| `/contact` | Contact | Contact form (creates ContactMessage) | Everyone |
| `/privacy` | PrivacyPolicy | Legal | Everyone |
| `/terms` | Terms | Legal | Everyone |
| `/garage-sales` | GarageSales | Garage sale / house clearance event list | Everyone |
| `/garage-sales/:id` | GarageSaleEvent | Event detail + items, RSVP slots; owner controls (add/edit items) | Everyone (owner tools: organiser or admin) |

### 3.2 Signed-in (ProtectedRoute inside PublicLayout)

| Route | Page | Purpose | Visible to |
|---|---|---|---|
| `/watchlist` | Watchlist | Saved auctions | Signed-in |
| `/sell-garage-sale` | SellGarageSale | Create a garage sale event | Signed-in (any role) |
| `/my-bids` | MyBids | User's bids | Signed-in |
| `/my-transactions` | MyTransactions | Orders as buyer or seller | Signed-in |
| `/transactions/:id` | TransactionDetail | Checkout, collection, disputes, reviews for one order | Buyer, seller or admin (page refuses others); staff payment actions for admin/auctioneer |
| `/security` | SecuritySettings | 2FA setup/disable, recovery codes, lost authenticator, delete account | Signed-in |
| `/verify-2fa` | VerifyTwoFactor | 2FA challenge | Signed-in |
| `/verify` | VerifyIdentity | 100-point identity verification flow | Signed-in |

### 3.3 Authentication (no layout guard)

| Route | Page | Purpose |
|---|---|---|
| `/login` | Login | Sign in (supports same-origin `returnTo`) |
| `/register` | Register | Sign up + email verification |
| `/forgot-password` | ForgotPassword | Request reset link |
| `/reset-password` | ResetPassword | Set new password from link |

### 3.4 Admin console (AdminRoute + AdminLayout)

| Route | Page | Purpose | Visible to |
|---|---|---|---|
| `/admin` | AdminDashboard | Counts: auctions, bids, messages, users | Admin |
| `/admin/listings` | AdminListings | Create/edit/delete auctions (direct entity writes) | Admin |
| `/admin/accounts` | AdminAccounts | User list with roles (read-only) | Admin |
| `/admin/settings` | AdminSettings | Pricing/fees + payment-method config | Admin |
| `/admin/verifications` | AdminVerifications | Review verification cases, evidence, flags, notes | Admin |
| `/admin/payments` | AdminPayments | Confirm / fail / refund payments | Admin |

### 3.5 Auctioneer console (AuctioneerRoute)

| Route | Page | Purpose | Visible to |
|---|---|---|---|
| `/auctioneer` | AuctioneerDashboard | Assigned auctions (admin sees all); pause/resume/close, physical bids | Auctioneer, Admin |
| `/auctioneer/manage/:id` | ManageEvent | Tabs: Inspections, Attendance, Check-in | Auctioneer, Admin. The Inspections and Attendance actions call admin-only functions, so auctioneers get 403 there; only Check-in works for them |
| `/go-live` | GoLive | Start/stop embed or camera broadcast | Auctioneer, Admin |

### 3.6 Other

| Route | Component | Notes |
|---|---|---|
| `*` | `lib/PageNotFound.jsx` | 404 (not under `src/pages`) |
| _(none)_ | `pages/OAuthConsent.jsx` | MCP OAuth consent screen. **Not registered in `App.jsx`.** Login references it via `returnTo`, so it may be mounted by the Base44 platform |

---

## 4. Scheduled jobs

| Workflow | Schedule | Timezone | Action |
|---|---|---|---|
| Auto Close Auctions (`base44/workflows/Auto Close Auctions.jsonc`) | `*/5 * * * *`, every 5 minutes, recurring, never ends | Australia/Perth | Invokes `autoCloseAuctions`: settles every open auction past `closing_time` and creates the winner's CompletedTransaction |

No other schedules exist. Some time-based behaviour is lazy or manual instead:
- Attendance threshold/deadline transitions only run when `getAttendanceInfo` or a booking function is called.
- Payment-deadline expiry is manual (`markPaymentFailed`).
- No job enforces `VerificationScoringPolicy.retention_days`.

---

## 5. Environment variables and secrets (names only)

| Name | Kind | Read by |
|---|---|---|
| `STRIPE_SECRET_KEY` | Base44 secret (`secrets.get`, `base44:runtime`) | createStripePaymentIntent, getPaymentCheckout, testStripePaymentGate |
| `STRIPE_PUBLISHABLE_KEY` | Base44 secret | createStripePaymentIntent (returned to browser, publishable by design), testStripePaymentGate |
| `STRIPE_WEBHOOK_SECRET` | Base44 secret | stripeWebhook |
| `VITE_BASE44_APP_ID` | Frontend build env (`import.meta.env`) | src/lib/app-params.js |
| `VITE_BASE44_FUNCTIONS_VERSION` | Frontend build env | src/lib/app-params.js |
| `VITE_BASE44_APP_BASE_URL` | Frontend build env | src/lib/app-params.js |
| `BASE44_LEGACY_SDK_IMPORTS` | Build-time Node env (`process.env`) | vite.config.js |

Related, but not environment variables:
- `base44/.app.jsonc` is the gitignored app-id pointer written by `base44 link`.
- The browser `localStorage` keys `base44_access_token` and `token` hold the session token.
- The URL parameter `clear_access_token=true` clears those keys.
- `Core.SendEmail` (a Base44 integration) is used by requestManualReview and reviewVerification and needs no app secret.
- No PayPal credentials are read anywhere, although `PaymentMethodConfig` has PayPal flags.
- No `.env` file is present in the tree.

---

## 6. Totals

| Item | Count |
|---|---|
| **Entities** | **34** |
| **Backend functions** | **62** |
| **Pages** | **36** page components in `src/pages` (35 routed + 1 unrouted `OAuthConsent`); 35 routes plus a `*` 404 |
| Scheduled jobs | 1 |
| Secrets / env vars | 3 secrets + 4 env vars |
