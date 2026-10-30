# Vendor Invoice Approvals — spec

**Request:** req-6e3ff49c · **Requested by:** Erin Patel (Finance Lead) · **Team:** Finance / Accounts payable · **Urgency:** this month
**Slug:** `vendor-invoices` · **Category:** finance · **Owners:** `finance-lead`

Replaces the email → spreadsheet → Slack process: AP clerks enter vendor invoices and decide each one (approve for payment / reject with a reason / hold → release). Invoices over $25,000 need a Finance Lead's sign-off in Approvals. Every decision is in the hash-chained audit log, so anyone with access can see who approved what.

## Assumptions (please review — the requester was not asked)
1. **Threshold:** "over $25,000" means strictly greater. Exactly **$25,000.00 needs no Finance Lead approval; $25,000.01 does.** Amounts are USD only (no multi-currency, no FX).
2. **Who approves big invoices:** any user with the `finance-lead` role, never the clerk who requested the approval (platform maker-checker). Finance leads approve **only through Approvals**; they cannot enter, approve, reject, hold or release invoices themselves (segregation of duties, stricter option).
3. **Segregation of duties for small invoices (stricter):** the clerk who **entered** an invoice cannot approve it for payment — another clerk must. Above $25,000 the entering clerk may send it for approval, because a Finance Lead is then the second person.
4. **New role `ap-clerk`** (none of the existing roles fit) with two synthetic users: **Maya Johnson** (`maya`) and **Leo Martins** (`leo`), both "AP Clerk". All clerks can both enter and review invoices.
5. **"Approve for payment" does not pay anything.** It sets status `approved` and records `approved_by` (the clerk, or the Finance Lead for > $25,000). Paying happens outside this app (existing payment run). No bank/payment connector is called.
6. **Hold → release** sends the invoice **back to Pending review**, not straight to approved, so it is reviewed again (and a > $25,000 invoice still needs a Finance Lead). Rejected and approved are final; there is no "reopen" or edit.
7. **Reasons:** reject and hold need a reason code **and** a free-text note (stricter). Approve and release need a reason code (no note). Reason code lists are below; Finance can rename them.
8. **Invoices cannot be edited after entry.** A wrong invoice is rejected (`data_entry_error`) and re-entered.
9. **Sensitive data:** the form ticked "Customer PII" and "Payment / card data", but the listed data has no customer data or card numbers. The only sensitive field is the **vendor bank account**, tagged PII: masked everywhere (shows last 2 characters), never written to the audit log, revealed only by **Finance Leads** (each reveal audited). **AP clerks cannot reveal it** (stricter) — they type it on entry but can't read it back. Vendor name and invoice number are treated as business data, not PII.
10. **Export** (CSV) is limited to Finance Leads and stays masked.
11. **Due date** is shown and the queue is sorted by it with an "due soon" warning (72h before); approving after the due date is **allowed** (a late invoice still has to be paid). Due date is entered as `YYYY-MM-DD` text (the `form` block has no date picker).
12. **Not in v1:** duplicate-invoice detection (same vendor + invoice number), server-side amount > 0 check, vendor master / bank-account-change verification, email ingestion, attachments (PDF of the invoice). Logged in GAPS.md as open; the bank-account fraud risk is called out below.
13. **Access:** only `ap-clerk` and `finance-lead` can open the app. Everyone else (support, ops, compliance, engineering) cannot.

## Users & roles → `permissions`
| Permission | Roles | Notes |
|---|---|---|
| `view` | `ap-clerk`, `finance-lead` | |
| `enter` | `ap-clerk` | New invoice form |
| `review` | `ap-clerk` | approve / reject / hold / release |
| `pii.reveal` | `finance-lead` | bank account only; audited |
| `comment` | `ap-clerk`, `finance-lead` | |
| `export` | `finance-lead` | masked CSV |
| Approval checker | `finance-lead` | invoices > $25,000 |

## Data — new source `vendor_invoices` (`src/connectors/index.ts`)
| Field | Type | Notes |
|---|---|---|
| `id` | text | pk (`ven_…`) |
| `vendor_name` | text | searchable |
| `invoice_number` | text | searchable |
| `amount` | currency | USD |
| `currency` | text | default `USD` |
| `due_date` | date | sort ascending |
| `bank_account` | text | **PII** (`piiFields`) |
| `status` | status | tones: `pending_review` info, `on_hold` warn, `approved` good, `rejected` bad |
| `entered_by` | text | `$user` on entry |
| `approved_by` | text | who approved for payment (clerk or Finance Lead) |
| `created_at` / `updated_at` | date | |

Synthetic seed rows in `scripts/seed.ts` (fake vendors, fake bank numbers), covering every status and amounts on both sides of $25,000.

## Status flow
```
(enterInvoice) → pending_review ──approve (≤ $25,000)──────────────→ approved
                     │         └─approve (> $25,000) → waits → Finance Lead approves → approved
                     │                                       └ Finance Lead rejects → stays pending_review
                     ├──reject──→ rejected
                     └──hold────→ on_hold ──release──→ pending_review
```
Final statuses: `approved`, `rejected`.

## Actions
| Action | Permission | Effect | Available when | Reason codes | Note | Approval |
|---|---|---|---|---|---|---|
| `enterInvoice` "Enter invoice" | `enter` | create, defaults `status=pending_review`, `currency=USD`, `entered_by=$user` | — | — | — | — |
| `approve` "Approve for payment" | `review` | update `status=approved`, `approved_by=$user`; `notBy: [entered_by]` (segregation of duties: refused if the executing user entered it) | `status = pending_review` | `matches_po`, `goods_received`, `contract_terms`, `recurring_service` | — | `amount > 25000` → `finance-lead` ("Invoices over $25,000 require Finance Lead approval") |
| `reject` "Reject" | `review` | update `status=rejected` | `status = pending_review` | `duplicate_invoice`, `amount_mismatch`, `no_matching_po`, `unknown_vendor`, `goods_not_received`, `data_entry_error` | required | — |
| `hold` "Put on hold" | `review` | update `status=on_hold` | `status = pending_review` | `awaiting_po`, `awaiting_vendor_info`, `bank_details_check`, `amount_disputed` | required | — |
| `release` "Release" | `review` | update `status=pending_review` | `status = on_hold` | `info_received`, `issue_resolved` | — | — |

## Pages
| Page | Path | Blocks |
|---|---|---|
| Queue | `""` | `metric-cards` (Pending review count, Pending $ total, Over $25,000 pending, On hold); `review-queue` (`openWhere status=pending_review`, `decisionActions [approve, reject, hold]`, summary vendor / invoice # / amount / due date, `sla { field: due_date, hours: 72, mode: deadline }`, badge "Needs Finance Lead" when `amount > 25000`) |
| All invoices | `invoices` | `data-grid` (vendor, invoice #, amount, due date, status, entered by, approved by; filter by status; `rowActions [release]`; `rowLink invoices/:id`; `exportable`) |
| Invoice | `invoices/:id` (no nav) | `record-detail` (all fields, bank account masked, actions approve/reject/hold/release); `audit-timeline` (record history = who approved what); `comments` |
| New invoice | `new` | `form` → `enterInvoice` (vendor name, invoice number, amount, due date `YYYY-MM-DD`, bank account — all required) |
Finance Leads approve big invoices on the portal's existing **Approvals** page.

## Requirement coverage
| Requirement | Covered by | Class |
|---|---|---|
| Clerks enter vendor invoices (replaces email/spreadsheet) | `form` → `enterInvoice` create action | covered |
| Clerks review invoices one at a time | `review-queue` config | covered |
| Approve for payment / reject with reason / hold | actions + `reasonCodes` + `requireNote` + `availableWhen` | covered |
| Release held invoices | `release` action on `data-grid` row + `record-detail` | covered |
| > $25,000 needs Finance Lead | action `approval` rule (maker-checker) + Approvals page | covered |
| "Who approved what" visible | `approved_by` field, `audit-timeline`, Approvals history | covered |
| Bank account protected | `piiFields` + `pii.reveal` permission | covered |
| Due-date visibility | `review-queue.sla` deadline mode + sort | covered |
| Entering clerk can't approve own invoice (Assumption 3) | action `notBy: ["entered_by"]` (platform segregation-of-duties rule) | covered (shared; compliance-critical) |
| Due date picker | text field `YYYY-MM-DD` | gap (open) — candidate: optional `date` type on `form` |
| Duplicate invoice detection / amount > 0 on create | — | gap (open) — create actions have no validation hook |
| Clerk role | new `ap-clerk` role + users `maya`, `leo` in `src/platform/users.ts` | platform data (no code change to RBAC) |

Customization rungs: 1–2 (config/composition) for everything except the new `vendor_invoices` source (rung 4: new `SourceDef`, justified — no existing source holds invoices). No block changes, so no block version bumps. The segregation-of-duties rule is a new platform action option (`notBy`), shared because it is compliance-critical.

## Fintech checklist
- **Money movement:** approval for payment (no funds moved by the app). Reason code required; maker-checker above $25,000 with `finance-lead` checker; requester can never approve their own.
- **PII / payment data:** `bank_account` masked server-side, excluded from audit details (`[pii]`), reveal limited to `finance-lead` and audited; export masked and limited to `finance-lead`. No card data stored. Synthetic data only.
- **Prod config:** none.
- **Risk to flag:** bank account is typed per invoice with no vendor master, so a changed bank account (classic invoice-fraud vector) is not detected. Mitigation in v1: `bank_details_check` hold reason; recommend a vendor-master follow-up.

## Scenarios (`src/apps/vendor-invoices/scenarios.ts`, run by `npm test`)
Users: Maya Johnson & Leo Martins (AP Clerks, new), Erin Patel (Finance Lead), Sam Lee (Support Agent).
- [ ] AP clerks can open the invoice queue _(Maya)_
- [ ] Finance leads can open the invoice queue _(Erin)_
- [ ] Support agents cannot open the invoice queue _(Sam)_
- [ ] An AP clerk enters a vendor invoice; it starts as Pending review and records who entered it _(Maya)_
- [ ] Support agents cannot enter invoices _(Sam)_
- [ ] Finance leads cannot enter invoices (they only approve big ones) _(Erin)_
- [ ] A clerk approves an invoice of exactly $25,000.00 for payment without Finance Lead approval _(Leo)_
- [ ] An invoice of $25,000.01 waits for Finance Lead approval; Erin approves it and it is approved for payment _(Leo → Erin)_
- [ ] If a Finance Lead rejects the approval of a big invoice, it stays Pending review _(Leo → Erin)_
- [ ] A clerk cannot approve for payment an invoice they entered themselves _(Maya)_
- [ ] Finance leads cannot approve invoices for payment directly; they only sign off big ones in Approvals _(Erin)_
- [ ] Approving for payment needs a reason code _(Leo)_
- [ ] A held invoice cannot be approved for payment until it is released _(Leo)_
- [ ] A rejected invoice cannot be approved for payment _(Leo)_
- [ ] A clerk rejects an invoice with a reason; it becomes Rejected _(Leo)_
- [ ] Support agents cannot reject invoices _(Sam)_
- [ ] Rejecting needs a reason code _(Leo)_
- [ ] Rejecting needs a note explaining the reason _(Leo)_
- [ ] An invoice already approved for payment cannot be rejected _(Leo)_
- [ ] A clerk puts an invoice on hold; it becomes On hold _(Leo)_
- [ ] Finance leads cannot put invoices on hold _(Erin)_
- [ ] Putting an invoice on hold needs a note _(Leo)_
- [ ] An invoice already approved for payment cannot be put on hold _(Leo)_
- [ ] A clerk releases a held invoice; it goes back to Pending review _(Leo)_
- [ ] Support agents cannot release held invoices _(Sam)_
- [ ] Releasing needs a reason code _(Leo)_
- [ ] Only held invoices can be released _(Leo)_
- [ ] The vendor bank account is masked by default _(Maya)_
- [ ] AP clerks cannot reveal the vendor bank account _(Maya)_
- [ ] Finance leads can reveal the vendor bank account (logged) _(Erin)_

## Journeys
1. **A normal invoice is entered by one clerk and approved for payment by another** (ends `approved`)
   - [ ] Maya enters a $4,800 invoice from Northwind _(Maya)_
   - [ ] Leo reviews it and approves it for payment: matches the purchase order _(Leo)_
2. **A $40,000 invoice waits for a Finance Lead, and Erin approves it for payment** (approval approved)
   - [ ] Maya enters a $40,000 invoice _(Maya)_
   - [ ] Leo approves it for payment; it waits for a Finance Lead _(Leo)_
   - [ ] Erin approves in Approvals and the invoice is approved for payment _(Erin)_
3. **A Finance Lead turns down a $40,000 invoice, so the clerk rejects it with a reason** (approval rejected; ends `rejected`)
   - [ ] Maya enters a $40,000 invoice _(Maya)_
   - [ ] Leo approves it for payment; it waits for a Finance Lead _(Leo)_
   - [ ] Erin rejects the approval; the invoice stays Pending review _(Erin)_
   - [ ] Leo rejects the invoice: amount does not match the purchase order _(Leo)_
   - [ ] A rejected invoice can no longer be approved for payment _(Leo)_
4. **An invoice is put on hold while the vendor confirms details, then released and approved for payment** (hold → release)
   - [ ] Maya enters a $12,000 invoice _(Maya)_
   - [ ] Leo puts it on hold: waiting for the purchase order _(Leo)_
   - [ ] While it is on hold it cannot be approved for payment _(Leo)_
   - [ ] Leo releases it once the purchase order arrives; it is back to Pending review _(Leo)_
   - [ ] Leo approves it for payment _(Leo)_

## GAPS.md changes (Phase 2)
- New row: "Block an action when the actor is the record's creator (segregation of duties)" — vendor-invoices (1) — platform action option `notBy` — resolved (shared; compliance-critical).
- New row: "Date input on `form`" — vendor-invoices (1) — text `YYYY-MM-DD` — open.
- New row: "Validation on create (unique vendor + invoice number, amount > 0)" — vendor-invoices (1) — not built — open.
