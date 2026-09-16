# SwiftStream ISP — Data Integrity & Sync Direction Policy

## 1. Overview & Core Principle

In SwiftStream ISP billing and network operations, **MikroTik routers are execution engines, not commercial databases**. 

Commercial billing data (plan names, commercial speeds, rates, subscriber account statuses, and ledger balances) must originate and be governed exclusively in the **Billing System / Cloud Firestore**. 

```
                               ┌────────────────────────────────┐
                               │     Cloud Firestore Database   │
                               │  (Commercial Source of Truth)  │
                               └──────────────┬─────────────────┘
                                              │
                         PROVISIONING &       │
                         COMMERCIAL LIFECYCLE │ (One-Way Control)
                         PUSH                 │
                                              ▼
                               ┌────────────────────────────────┐
                               │   MikroTik RouterOS Hardware   │
                               │    (Network Traffic Shaper)    │
                               └──────────────┬─────────────────┘
                                              │
                         READ-ONLY DIAGNOSTICS│ (Isolated Telemetry)
                         & TELEMETRY ONLY     │
                                              ▼
                               ┌────────────────────────────────┐
                               │    Line Health / NOC Monitor   │
                               │  (Never Mutates Billing Fields)│
                               └────────────────────────────────┘
```

---

## 2. Entity Sync Direction Matrix

| Data Domain | Source of Truth | Permitted Sync Direction | Forbidden Actions |
| :--- | :--- | :--- | :--- |
| **Commercial Plans** (`Plan`) | Firestore `plans` & `initialPlans` | **Billing → Router** (One-way) | Router rate profiles (`Plan-70M`, `128k/128k`) must **NEVER** overwrite commercial plan names, commercial speeds (`speedMbps`), or pricing. |
| **Subscriber Accounts** (`Customer`) | Firestore `customers` | **Billing → Router** (One-way push) | Router secret comments or profile names must never alter `customer.planId`, `planSpeedMbps`, or `balance`. |
| **Account Lifecycle & Isolation** | Billing Ledger (`Invoice`, `Payment`) | **Billing → Router** (Event-driven) | Router connection status cannot mark an invoice as paid or change ledger balances. |
| **PPPoE Secrets** (`/ppp/secret`) | Firestore (commercial) + Router (hardware) | **Billing pushes to Router** | Reconciling secrets must not delete or corrupt Firestore customer records. |
| **Hardware Telemetry** (`/ppp/active`, optical diagnostics) | MikroTik RouterOS | **Router → UI Monitor** (Read-Only) | Telemetry packets must never write to billing attributes (`balance`, `monthlyFee`, `planSpeedMbps`). |
| **Financial Ledger** (`Payment`, `Invoice`) | Cashier / Payment Gateways | **Gateways → Firestore** (Append-Only) | Payments are immutable; deletions are prohibited at both application and security rules layers. |

---

## 3. Policy Details by Domain

### Policy 3.1: Commercial Internet Plans (`Plan`)
1. Commercial plan attributes:
   - `name`: Clean commercial branding (e.g. `"Gamer Pro"`, `"SwiftStream Family Fiber"`). Never embed technical router profile names.
   - `speedMbps`: Commercial advertised speed (e.g. `250` Mbps). Stored directly on the Customer record at save time as `planSpeedMbps`.
   - `monthlyFee`: Authorized monthly recurring charge (e.g. `₱1,500.00`).
   - `mikrotikProfile`: Designated router rate-limit queue (e.g. `"Plan-70M"` or `"plan-250m"`).
2. **Decoupling Rule**:
   - The technical PPPoE rate-limit profile is an implementation detail on the router. It does not define the commercial plan speed.
   - Code methods that inspect or fetch router profiles (`fetchPppoeProfilesDetailed`) are strictly advisory for dropdown selectors. They must never trigger `addPlan` or update Firestore `plans`.

### Policy 3.2: Subscriber Account Provisioning & Secrets
1. **Creation / Provisioning**:
   - Admin creates a subscriber in the web console.
   - Customer document is written to Firestore with:
     - `planId`: Matched commercial plan ID.
     - `planName`: Clean commercial name.
     - `planSpeedMbps`: Exact commercial speed from the catalog.
     - `monthlyFee`: Commercial fee.
     - `network.pppoeUser` and `network.pppoeProfile`.
   - PPPoE secret is provisioned directly to the router hardware via the RouterOS API.
2. **Payment & Reconnection**:
   - When a subscriber pays an overdue balance, the payment processor writes the `Payment` document, settles the `Invoice`, and dispatches a reconnection command to MikroTik:
     - Sets `/ppp/secret` profile to `customer.network.pppoeProfile`.
     - Ensures `disabled: false`.
     - Drops any stale `/ppp/active` session to force re-authentication with new rate limits.
3. **Non-Payment Isolation (Walled Garden)**:
   - When overdue, the billing system sets `/ppp/secret` profile to `"isolated"` (`128k/128k`) with non-payment firewall address-list redirection.

### Policy 3.3: Router Telemetry & Health Monitoring
1. Data retrieved from `/ppp/active`, `/interface/monitor-traffic`, or optical SFP diagnostics:
   - Rx/Tx bandwidth, uptime, IP address, MAC address, optical signal (dBm).
2. **Isolation Guard**:
   - This data is strictly volatile telemetry held in ephemeral React state or written exclusively to `customer.network.telemetry` / `network_diagnostics`.
   - Telemetry ingestion code is structurally barred from mutating `balance`, `planId`, `planSpeedMbps`, or `status`.

---

## 4. Conflict Resolution & Precedence

1. **Firestore vs Local Storage**:
   - Firestore real-time listeners (`onSnapshot`) always take precedence over browser `localStorage` when connected.
   - LocalStorage acts solely as an offline cache and transient optimistic state.
2. **Catalog Matching Precedence**:
   - When resolving customer plan speed:
     1. `customer.planSpeedMbps` (authoritative value saved from commercial catalog).
     2. Matched plan `speedMbps` in `initialPlans` / Firestore `plans`.
     3. 0 (hidden).
     - Technical router profile rate limits (`Plan-70M`) are explicitly rejected as commercial speeds.

---

## 5. Audit & Compliance

Every hardware mutation, plan modification, or customer status override must record an entry in `audit_logs`:
- Action name (e.g. `PPPOE_SECRET_CREATED`, `PLAN_UPDATED`, `CUSTOMER_ISOLATED`)
- Performing user (`userName` & role)
- Timestamp
- Target router and customer ID
