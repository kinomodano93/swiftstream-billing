import {
  BusinessProfile,
  CoverageArea,
  Customer,
  Expense,
  Invoice,
  MikrotikDevice,
  NapBox,
  OperationalBill,
  Plan,
  RepairOrder,
} from '../types';
import { formatCurrency, formatPhoneNumber, formatDate } from './formatters';

export interface GeminiAiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AskGeminiAction {
  label: string;
  action: 'apply' | 'scroll' | 'tab' | 'query';
  payload?: any;
}

export interface AskGeminiResult {
  content: string;
  suggestedActions?: AskGeminiAction[];
}

export interface AskGeminiParams {
  prompt: string;
  history: GeminiAiMessage[];
  mode: 'homepage' | 'client' | 'admin';
  customer?: Customer | null;
  ispContext: {
    businessProfile: BusinessProfile;
    plans: Plan[];
    customers: Customer[];
    invoices: Invoice[];
    repairOrders: RepairOrder[];
    mikrotikDevices: MikrotikDevice[];
    napBoxes: NapBox[];
    expenses?: Expense[];
    operationalBills?: OperationalBill[];
    coverageAreas?: CoverageArea[];
  };
  apiKey?: string;
  model?: string;
}

export interface SubscriberBillingLookupResult {
  found: boolean;
  customer?: Customer;
  latestInvoice?: Invoice;
  unpaidInvoices?: Invoice[];
  totalUnpaidAmount?: number;
  hasOverdue?: boolean;
  searchedAccountNo?: string;
  isGenericInquiry?: boolean;
}

export const normalizeAccountStr = (str: string): string => {
  return str.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

/**
 * Searches for a subscriber and their live invoices based on query tokens (Account Number, Full Name, Mobile)
 */
export const lookupSubscriberBilling = (
  query: string,
  customers: Customer[],
  invoices: Invoice[],
  currentCustomer?: Customer
): SubscriberBillingLookupResult => {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  // Pattern matching for standard ISP account number tokens like ACC-26-1001, ACC-1001, ACC-SR
  const explicitAccountRegex = /\b(acc[-_ ]?\d{1,4}[-_ ]?\d{1,6}|acc[-_ ][a-z0-9-]+)\b/i;
  const accountMatch = trimmed.match(explicitAccountRegex);

  let targetCustomer: Customer | undefined = undefined;
  let searchedAccountNo: string | undefined = undefined;

  if (accountMatch) {
    searchedAccountNo = accountMatch[0].trim();
    const cleanSearched = normalizeAccountStr(searchedAccountNo);

    targetCustomer = customers.find((c) => {
      const cleanCustAcc = normalizeAccountStr(c.accountNo);
      return (
        cleanCustAcc === cleanSearched ||
        cleanCustAcc.endsWith(cleanSearched) ||
        cleanSearched.endsWith(cleanCustAcc)
      );
    });
  }

  // If no regex match, check each word for potential account number format or numeric ID
  if (!targetCustomer && !searchedAccountNo) {
    const words = trimmed.split(/[\s,;:!?]+/);
    for (const word of words) {
      if (word.length >= 4) {
        const cleanWord = normalizeAccountStr(word);
        const match = customers.find((c) => {
          const cleanCust = normalizeAccountStr(c.accountNo);
          return (
            cleanCust === cleanWord ||
            (cleanWord.startsWith('ACC') && cleanCust.endsWith(cleanWord.replace('ACC', ''))) ||
            (cleanWord.length >= 4 && cleanCust.endsWith(cleanWord))
          );
        });
        if (match) {
          targetCustomer = match;
          searchedAccountNo = word;
          break;
        }
      }
    }
  }

  // If still not matched, check if query contains customer's registered phone number or full name
  if (!targetCustomer && !searchedAccountNo) {
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length >= 7) {
      targetCustomer = customers.find((c) => {
        const custMobile = c.mobile.replace(/\D/g, '');
        return custMobile.endsWith(digitsOnly) || digitsOnly.endsWith(custMobile);
      });
      if (targetCustomer) {
        searchedAccountNo = targetCustomer.accountNo;
      }
    }

    if (!targetCustomer) {
      targetCustomer = customers.find((c) => {
        const custName = c.fullName.toLowerCase().trim();
        return custName.length > 3 && lower.includes(custName);
      });
      if (targetCustomer) {
        searchedAccountNo = targetCustomer.accountNo;
      }
    }
  }

  // Fallback to active logged-in customer in Client Portal if no other account queried
  if (!targetCustomer && !searchedAccountNo && currentCustomer) {
    targetCustomer = currentCustomer;
    searchedAccountNo = currentCustomer.accountNo;
  }

  if (targetCustomer) {
    const custInvoices = invoices
      .filter(
        (i) =>
          i.customerId === targetCustomer!.id ||
          (targetCustomer!.accountNo && i.accountNo === targetCustomer!.accountNo)
      )
      .sort(
        (a, b) =>
          new Date(b.issueDate || b.createdAt).getTime() - new Date(a.issueDate || a.createdAt).getTime()
      );

    const latestInvoice = custInvoices[0];
    const unpaidInvoices = custInvoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue');
    const totalUnpaidAmount = unpaidInvoices.reduce(
      (sum, i) => sum + (i.balanceDue !== undefined ? i.balanceDue : i.totalAmount),
      0
    );
    const hasOverdue = targetCustomer.status === 'overdue' || custInvoices.some((i) => i.status === 'overdue');

    return {
      found: true,
      customer: targetCustomer,
      latestInvoice,
      unpaidInvoices,
      totalUnpaidAmount: totalUnpaidAmount > 0 ? totalUnpaidAmount : targetCustomer.balance,
      hasOverdue,
      searchedAccountNo: targetCustomer.accountNo,
    };
  }

  if (searchedAccountNo) {
    return {
      found: false,
      searchedAccountNo,
    };
  }

  const isBillingQuery =
    lower.includes('bill') ||
    lower.includes('balance') ||
    lower.includes('statement') ||
    lower.includes('invoice') ||
    lower.includes('magkano') ||
    lower.includes('bayad') ||
    lower.includes('bayaran') ||
    lower.includes('utang') ||
    lower.includes('how much do i owe') ||
    lower.includes('due date');

  return {
    found: false,
    isGenericInquiry: isBillingQuery,
  };
};

/**
 * Builds the customized system prompt based on whether the AI is answering from Homepage, Client Portal, or Admin
 */
export const buildSystemPrompt = (params: AskGeminiParams): string => {
  const { mode, customer, ispContext } = params;
  const {
    businessProfile,
    plans,
    customers,
    invoices,
    repairOrders,
    mikrotikDevices,
    napBoxes,
    expenses = [],
    operationalBills = [],
  } = ispContext;

  const activeCount = customers.filter((c) => c.status === 'active').length;
  const overdueCount = customers.filter((c) => c.status === 'overdue' || c.status === 'suspended').length;
  const totalUnpaidAmount = invoices
    .filter((i) => i.status === 'unpaid' || i.status === 'overdue')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  const mrr = customers.filter((c) => c.status === 'active').reduce((acc, c) => acc + c.monthlyFee, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  const planSummary = plans
    .map(
      (p) =>
        `- **${p.name}**: ${p.speedMbps} Mbps Unlimited Fiber @ ₱${p.monthlyFee.toLocaleString()}/mo (Installation: ₱${p.installationFee.toLocaleString()}) - ${p.description}`
    )
    .join('\n');

  if (mode === 'homepage') {
    return `You are "SwiftStream AI Fiber Consultant & Billing Assistant", a knowledgeable, friendly, and dedicated AI consultant for SwiftStream Telecommunications located in Lagonoy and Presentacion, Camarines Sur, Philippines. Our business is focused 100% on providing reliable, high-speed pure fiber internet connectivity and real-time subscriber billing services.

### Company Profile:
- **Provider**: ${businessProfile.name} (${businessProfile.tradeName})
- **Main Office**: ${businessProfile.address.street}, Brgy. ${businessProfile.address.barangay}, ${businessProfile.address.city}, ${businessProfile.address.province}
- **Contact Hotline**: ${formatPhoneNumber(businessProfile.representative.mobile)} | ${businessProfile.representative.email}
- **Official TIN**: ${businessProfile.tin} (BIR Registered Telecommunications & Internet Service Provider)

### Available Unlimited Fiber Internet Plans:
${planSummary}

### Full Coverage Areas in Camarines Sur:
1. **Municipality of Lagonoy** (38 Barangays):
   - Active Coverage: Binauahan (Main Hub & NOC), Poblacion / San Francisco, San Isidro Norte, San Isidro Sur, San Jose, Santa Maria, Dahican, Mapid, Loho, Agosais, Agugayan, Amoguis, Balaton, Bocogan, Burabod, Cabotonan, Dahat, Del Carmen, Gimagpang, Ginaburan, Gogon, Himagondong, Malidong, Manamoc, Mangogon, Olas, Omalo, Panicuan, Pinamihagan, San Rafael, San Ramon, San Roque, San Sebastian, San Vicente, Santa Cruz.
2. **Municipality of Presentacion** (18 Barangays - Expansion Zone):
   - Active & Fiber-Ready: Ayugao, Bagong Sirang, Baliguian, Bantugan, Bitaogan, Buenavista, Cagnipa, Lagha, Lidong, Liwas, Maangas, Pagsangaan, Patrocinio, Pili, Sta. Maria, Tan-Agan.
   - Fed by the high-capacity mountain relay repeater site at Mt. Isarog with backup solar battery banks.

### Application & Installation Process:
- Zero Document Requirements: NO government ID, proof of billing, or paperwork needed! Customers can simply sign up online in 1 minute and they are good to go.
- Standard Installation Fee: Always strictly ₱1,500 across all fiber plans.
- Deployment: Fast 24 to 48-hour on-site installation by certified linemen with high-grade dual-band WiFi 6 ONU router. No upfront payment required today — installation fee is payable only after the line is tested and active.

### Real-Time Customer Billing & Outstanding Balance Lookup:
- SwiftStream is 100% focused on pure high-speed fiber internet and subscriber billing services. We do NOT provide laptop or smartphone repair services.
- When a customer asks about their bill, balance, due date, or invoice status, instruct them to provide their **Account Number** (e.g. \`ACC-26-XXXX\` or \`ACC-XXXX\`).
- If dynamic subscriber billing data is provided in the context below, report:
  1. Full Name & Subscribed Plan
  2. Account Status
  3. Current Outstanding Balance
  4. Latest Invoice Number, Due Date, and Status
  5. Official Payment Channels (GCash QR, Maya, Bank Transfer, Online Portal)
- If an account number is searched but does NOT match any records, politely inform the customer to verify their account number on their monthly SMS notification or official receipt.
- If the customer asks generally about their bill without an account number, politely ask for their Account Number to look up their live records.

### Payment Methods Accepted:
- **GCash**: Scan official QR Ph code with instant verification.
- **Maya**: Send to registered number ${businessProfile.paymentGateways.mayaNumber}.
- **Bank Transfer**: ${businessProfile.paymentGateways.bankName} - Acct: ${businessProfile.paymentGateways.bankAccountNumber} (${businessProfile.paymentGateways.bankAccountName}).
- **Automated Xendit Multi-Channel Checkout**: Credit/Debit Cards, 7-Eleven CLiQQ, GrabPay, ShopeePay.

### Instructions:
- Greet visitors warmly. Use clear markdown formatting, bullet points, and bold text.
- Guide visitors to the best plan according to their family size or business needs.
- If they ask about coverage, confirm availability in both Lagonoy and Presentacion barangays.
- Speak in English or Tagalog/Bicolano if addressed in those languages.`;
  }

  if (mode === 'client') {
    let clientSnippet = 'No subscriber account currently selected. Ask user for their Account Number or Full Name.';
    if (customer) {
      const custInvoices = invoices.filter((i) => i.customerId === customer.id);
      const latestInvoice = custInvoices[0];
      clientSnippet = `
### Active Subscriber Profile:
- **Full Name**: ${customer.fullName}
- **Account Number**: ${customer.accountNo}
- **Current Plan**: ${customer.planName} (${formatCurrency(customer.monthlyFee)}/month)
- **Account Balance**: ${formatCurrency(customer.balance)} (${customer.status.toUpperCase()})
- **Billing Day**: Every ${customer.billingDay}th of the month
- **Installation Address**: ${customer.address.street}, Brgy. ${customer.address.barangay}, ${customer.address.city}
- **Contact Number**: ${formatPhoneNumber(customer.mobile)}
- **Network Credentials**: PPPoE User: \`${customer.network.pppoeUsername}\` | Assigned IP: \`${customer.network.ipAddress}\` | Optical Rx: \`${customer.network.opticalPowerDbm || -18.5} dBm\` (Optimal)
- **Latest Invoice**: ${
        latestInvoice
          ? `#${latestInvoice.invoiceNumber} (₱${latestInvoice.totalAmount.toLocaleString()} - Status: ${latestInvoice.status.toUpperCase()} - Due: ${latestInvoice.dueDate})`
          : 'No open invoices'
      }
`;
    }

    return `You are "SwiftStream Client Care AI", a 24/7 self-service billing, account lookup, and optical fiber technical support agent for SwiftStream subscribers in Lagonoy and Presentacion, Camarines Sur.

${clientSnippet}

### Payment Methods:
1. **GCash**: Scan official GCash QR Code on the Client Portal and upload screenshot/reference number.
2. **Maya**: Send to registered Maya number ${businessProfile.paymentGateways.mayaNumber} (${businessProfile.paymentGateways.mayaName}).
3. **Automated Xendit**: Click "Pay with Xendit" on invoice to settle via GCash, QR Ph, Credit Card, or 7-Eleven.
4. **Bank Transfer**: ${businessProfile.paymentGateways.bankName} - Acct: ${businessProfile.paymentGateways.bankAccountNumber}.

### Technical Troubleshooting Guide:
- **Red Optical LOS Light on ONU**: Indicates optical fiber break or loose SC/APC connector. Advise checking the green optical cable or requesting a lineman dispatch.
- **Slow Internet / High Ping**: Suggest power-cycling the ONU router (wait 30 seconds before reconnecting) or testing via direct LAN cable.
- **Account Suspended / Isolated**: Explain that settling the overdue balance immediately clears the MikroTik Walled Garden firewall isolation.`;
  }

  // Admin Mode
  const overduePayables = operationalBills.filter((b) => b.status === 'overdue' || (b.status !== 'paid' && b.dueDate < new Date().toISOString().slice(0, 10)));
  const totalOverduePayables = overduePayables.reduce((acc, b) => acc + b.amount, 0);

  const scheduledPayablesSummary = operationalBills
    .slice(0, 6)
    .map(
      (b) =>
        `- **${b.vendorName}**: "${b.title}" - ${formatCurrency(b.amount)} (Due: ${b.dueDate}, Status: ${b.status.toUpperCase()}, Recurrence: ${b.recurrence})`
    )
    .join('\n');

  return `You are "SwiftStream ISP Operations & Engineering Copilot", a specialized enterprise operations, network engineering, and billing analytics AI assistant for SwiftStream Telecommunication administrators.

### Live ISP Operational & Financial Snapshot:
- **Subscribers**: ${customers.length} total (${activeCount} Active Paying, ${overdueCount} Overdue / Suspended, ${customers.filter((c) => c.status === 'pending_install').length} Pending Install)
- **Monthly Recurring Revenue (MRR)**: ${formatCurrency(mrr)}
- **Uncollected Customer Receivables**: ${formatCurrency(totalUnpaidAmount)} across ${invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue').length} open invoices
- **Operating Expenses (OPEX)**: ${formatCurrency(totalExpenses)} recorded across ${expenses.length} expense vouchers
- **Estimated Net Margin**: ${formatCurrency(mrr - totalExpenses)} / month

### Scheduled Operational Payables (DIA, Electric, Pole & Tower Rent):
- **Overdue Operational Bills**: ${overduePayables.length} bills totaling ${formatCurrency(totalOverduePayables)}
${scheduledPayablesSummary || 'No operational bills scheduled.'}

### Outside Plant & Fiber Capacity:
- **NAP Distribution Boxes**: ${napBoxes.length} boxes deployed
- **Port Utilization**: ${napBoxes.reduce((acc, n) => acc + n.ports.filter((p) => p.status === 'occupied').length, 0)} occupied / ${napBoxes.reduce((acc, n) => acc + n.totalPorts, 0)} total fiber ports (${Math.round(
    (napBoxes.reduce((acc, n) => acc + n.ports.filter((p) => p.status === 'occupied').length, 0) /
      (napBoxes.reduce((acc, n) => acc + n.totalPorts, 0) || 1)) *
      100
  )}% capacity)

### MikroTik Fleet Telemetry:
${mikrotikDevices
  .map(
    (d) =>
      `  - **${d.name}** (${d.model}): IP ${d.ipAddress} | Status: ${d.status.toUpperCase()} | CPU: ${d.cpuLoad}% | Uptime: ${d.uptime} | Active PPPoE: ${d.activePppoeCount}`
  )
  .join('\n')}

### Invoices & Receivables Queue:
- **Unpaid / Overdue Invoices**: ${invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue').length} pending collection (${formatCurrency(totalUnpaidAmount)})

### Admin Assistance Capabilities:
1. **Financial & Cost Accounting**: Detail MRR, OPEX, Net Operating Income, collection efficiency, overdue client aging, and supplier payables schedules.
2. **Operational Payables Tracker**: Review DIA transit backhaul (PLDT), power (CASURECO II), pole attachments, and tower leases with due date countdowns.
3. **MikroTik RouterOS Commands**: Generate production scripts for PPPoE secrets, Simple Queues, PCQ bandwidth shaping, and Walled Garden firewall address-list quarantine.
4. **Outside Plant Engineering**: Calculate optical link budgets (OLT SFP+ Class C+ +7.5dBm, 1:8 / 1:16 PLC splitters, ONU target -15 to -22 dBm).
5. **Staff & Linemen Dispatch**: Optimize field installations, drop wire runs, and NOC network maintenance.

### Instructions:
- Answer as a senior ISP Chief Operating Officer and Lead Network Engineer.
- Provide crisp, structured markdown with clean tables and code blocks when providing commands or configurations.`;
};

/**
 * Intelligent domain-specific rule & knowledge engine fallback when Gemini API key is missing or offline
 */
export const runSmartLocalEngine = (params: AskGeminiParams): AskGeminiResult => {
  const { prompt, mode, customer, ispContext } = params;
  const q = prompt.toLowerCase();
  const {
    businessProfile,
    plans,
    customers,
    invoices,
    repairOrders,
    mikrotikDevices,
    napBoxes,
    expenses = [],
    operationalBills = [],
  } = ispContext;

  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Subscriber Billing & Outstanding Balance Lookup (Account Number query or billing inquiry)
  const billingLookup = lookupSubscriberBilling(prompt, customers, invoices, customer || undefined);

  if (billingLookup.found && billingLookup.customer) {
    const cust = billingLookup.customer;
    const latestInv = billingLookup.latestInvoice;
    const isSettled = cust.balance <= 0;
    const balanceDisplay = formatCurrency(Math.max(0, cust.balance));
    const isOverdue = billingLookup.hasOverdue || cust.status === 'overdue';

    const matchedPlan = plans.find((p) => p.id === cust.planId) ||
                        plans.find((p) => p.name?.trim().toLowerCase() === cust.planName?.trim().toLowerCase()) ||
                        plans[0];
    const planName = matchedPlan?.name || cust.planName;
    const planFee = matchedPlan?.monthlyFee || cust.monthlyFee;

    return {
      content: `### 💳 SwiftStream Official Subscriber Billing Statement

Here is the live account and billing information retrieved for **${cust.fullName}**:

| Account Detail | Information |
| :--- | :--- |
| **Subscriber Name** | **${cust.fullName}** |
| **Account Number** | \`${cust.accountNo}\` |
| **Subscribed Plan** | **${planName}** (${formatCurrency(planFee)}/month) |
| **Account Status** | \`${cust.status.toUpperCase()}\` |
| **Billing Cycle** | Every **${cust.billingDay}th** of the month |
| **Service Address** | Brgy. ${cust.address.barangay}, ${cust.address.city} |

---

### 💰 Outstanding Balance & Invoices:
* **Current Balance Due**: **${balanceDisplay}** ${
        isSettled
          ? '✅ **(Fully Settled / No Outstanding Balance)**'
          : isOverdue
          ? '⚠️ **(OVERDUE - Settlement Required to Prevent Walled Garden Disconnection)**'
          : '⏳ **(Pending Payment)**'
      }

${
  latestInv
    ? `* **Latest Invoice**: \`#${latestInv.invoiceNumber}\`
  - Total Amount: **${formatCurrency(latestInv.totalAmount)}**
  - Due Date: **${formatDate(latestInv.dueDate)}**
  - Invoice Status: \`${latestInv.status.toUpperCase()}\`
  - Billing Period: ${latestInv.billingPeriodStart} to ${latestInv.billingPeriodEnd}`
    : '* **Invoice Record**: No open invoices on file.'
}

---

### 📱 Fast Payment Channels:
1. **GCash**: Scan official SwiftStream QR Ph code or send with Account Ref: \`${cust.accountNo}\`.
2. **Maya Wallet**: Send to registered number **${businessProfile.paymentGateways.mayaNumber}** (${businessProfile.paymentGateways.mayaName}).
3. **Bank Transfer**: ${businessProfile.paymentGateways.bankName} - Acct: \`${businessProfile.paymentGateways.bankAccountNumber}\` (${businessProfile.paymentGateways.bankAccountName}).
4. **Client Self-Service Portal**: Log in at the subscriber portal to pay online via Xendit / Cards / 7-Eleven.`,
      suggestedActions: [
        { label: '📱 How to Pay via GCash / Maya', action: 'query', payload: { query: 'How to pay via GCash or Maya' } },
        { label: '⚡ View Fiber Plans', action: 'scroll', payload: { sectionId: 'plans' } },
        { label: '📞 Contact Billing Desk', action: 'scroll', payload: { sectionId: 'contact' } },
      ],
    };
  }

  // If user explicitly searched for an account number that was not found
  if (!billingLookup.found && billingLookup.searchedAccountNo) {
    return {
      content: `### ⚠️ Account Number Not Found

We could not locate any active subscriber record matching **\`${billingLookup.searchedAccountNo}\`**.

**Helpful Tips to Locate Your Account:**
* Standard SwiftStream account numbers follow the format \`ACC-26-XXXX\` or \`ACC-XXXX\` (e.g. \`ACC-26-1001\`).
* Please verify the account number printed on your monthly SMS billing notification, installation contract, or official receipt.
* You may also search by typing your **registered full name** or **registered mobile number**.

Need immediate assistance? Contact our billing hotline at **${formatPhoneNumber(businessProfile.representative.mobile)}**.`,
      suggestedActions: [
        { label: '📞 Contact Support Hotline', action: 'scroll', payload: { sectionId: 'contact' } },
        { label: '⚡ Browse Fiber Plans', action: 'scroll', payload: { sectionId: 'plans' } },
      ],
    };
  }

  // If user asked a generic billing question ("how much is my bill?", "check my balance") without an account number
  if (!billingLookup.found && billingLookup.isGenericInquiry && mode !== 'admin') {
    return {
      content: `### 💳 SwiftStream Real-Time Billing & Balance Inquiry

To check your live invoice statement, due date, and outstanding balance from our billing records, please provide your **Account Number**.

👉 **How to check:**
Simply reply with your account number, for example:
* \`ACC-26-1001\`
* *"Check bill for ACC-26-1001"*
* Or type your **registered mobile number**

*(Your Account Number can be found on your installation service form, monthly SMS reminder, or official receipt).*`,
      suggestedActions: [
        { label: '⚡ View Fiber Plans', action: 'scroll', payload: { sectionId: 'plans' } },
        { label: '📱 How to Pay via GCash / Maya', action: 'query', payload: { query: 'How to pay via GCash or Maya' } },
        { label: '📞 Call Billing Hotline', action: 'scroll', payload: { sectionId: 'contact' } },
      ],
    };
  }

  // 2. Inquiries about Operational Bills, Due Dates, DIA lines, Electricity, Tower Rent
  if (
    q.includes('dia') ||
    q.includes('casureco') ||
    q.includes('power') ||
    q.includes('electric') ||
    q.includes('pole') ||
    q.includes('tower') ||
    q.includes('vendor') ||
    (mode === 'admin' &&
      (q.includes('payable') ||
        q.includes('upcoming bill') ||
        q.includes('calendar') ||
        q.includes('due date')))
  ) {
    const overdueBills = operationalBills.filter((b) => b.status === 'overdue' || (b.status !== 'paid' && b.dueDate < todayStr));
    const pendingBills = operationalBills.filter((b) => b.status !== 'paid');

    const billsListText = pendingBills
      .slice(0, 5)
      .map((b) => {
        const isPast = b.dueDate < todayStr;
        return `* **${b.vendorName}** - ${b.title}
  - Amount: **${formatCurrency(b.amount)}**
  - Due Date: **${formatDate(b.dueDate)}** (${isPast ? '⚠️ OVERDUE' : 'Scheduled'})
  - Recurrence: \`${b.recurrence}\`${b.accountOrRefNumber ? ` • Ref: \`${b.accountOrRefNumber}\`` : ''}`;
      })
      .join('\n\n');

    return {
      content: `### 📅 SwiftStream Operational Payables & Due Date Tracker

Here is the operational billing schedule for our critical supplier lines, power, and leases:

${billsListText || 'All operational payables are currently marked paid!'}

${
  overdueBills.length > 0
    ? `⚠️ **Urgent Attention**: You have **${overdueBills.length} overdue payables** totaling **${formatCurrency(
        overdueBills.reduce((sum, b) => sum + b.amount, 0)
      )}**. Please settle immediately to prevent backhaul link cut or server room power shutoff.`
    : '✅ All supplier lines are currently up to date on payment.'
}

💡 **Tip**: Click the **Bill Due Calendar** to view the interactive monthly calendar, schedule new payables, or settle bills with automated OPEX expense voucher creation.`,
      suggestedActions: [
        { label: 'Open Bill Due Calendar', action: 'tab', payload: { tabId: 'bill_calendar' } },
        { label: 'View Financial Reports', action: 'tab', payload: { tabId: 'reports' } },
      ],
    };
  }

  // 2. Inquiries about Internet Plans & Speeds
  if (
    q.includes('plan') ||
    q.includes('speed') ||
    q.includes('package') ||
    q.includes('mbps') ||
    q.includes('price') ||
    q.includes('rates') ||
    q.includes('promo') ||
    q.includes('cheapest') ||
    q.includes('fastest')
  ) {
    const sortedPlans = [...plans].sort((a, b) => a.monthlyFee - b.monthlyFee);
    const plansText = sortedPlans
      .map(
        (p) => `* **${p.name}**
  - Speed: **${p.speedMbps} Mbps** Unlimited Fiber
  - Monthly Rate: **₱${p.monthlyFee.toLocaleString()}/month**
  - Installation: ₱${p.installationFee.toLocaleString()}
  - Description: ${p.description}`
      )
      .join('\n\n');

    const recommendedPlan = plans.find((p) => p.speedMbps === 50) || plans[0];

    return {
      content: `### ⚡ SwiftStream Pure Fiber Internet Plans

We offer symmetrical, uncapped fiber optic connections tailored for homes, remote workers, and businesses:

${plansText}

💡 **Recommendation**:
* **Home Turbo 50M (₱1,299/mo)**: Most popular for families, Netflix 4K, Zoom calls, and online gaming.
* **Pro Fiber 100M (₱1,699/mo)**: Ideal for content creators, heavy downloads, and multi-user households.
* **Starter 25M (₱799/mo)**: Best value entry-level fiber.
* **Flexibix 500M (₱6,000/mo)**: Enterprise symmetric link with 99.9% uptime SLA for computer shops and offices.`,
      suggestedActions: [
        { label: `Apply for ${recommendedPlan?.name || 'Home Turbo 50M'}`, action: 'apply', payload: { planId: recommendedPlan?.id } },
        { label: 'Open Speed Calculator', action: 'scroll', payload: { sectionId: 'calculator' } },
        { label: 'Check Barangay Coverage', action: 'scroll', payload: { sectionId: 'coverage' } },
      ],
    };
  }

  // 3. Inquiries about Coverage (Lagonoy & Presentacion)
  if (
    q.includes('coverage') ||
    q.includes('barangay') ||
    q.includes('location') ||
    q.includes('lagonoy') ||
    q.includes('presentacion') ||
    q.includes('where') ||
    q.includes('available') ||
    q.includes('covered') ||
    q.includes('area')
  ) {
    return {
      content: `### 🗺️ SwiftStream Fiber Coverage (Lagonoy & Presentacion)

SwiftStream operates high-capacity Outside Plant (OSP) fiber distribution across two municipalities in Camarines Sur:

#### 1. Municipality of Lagonoy:
* **Active Fiber Zones**: **Binauahan** (Core Operations Hub & Server Room), **Poblacion / San Francisco**, **San Isidro**, **San Jose**, **Santa Maria**, **Dahican**, **Mapid**, **Loho**, **San Roque**, **San Vicente**, **Santa Cruz**, and neighboring barangays.
* **Infrastructure**: Over 20+ fiber distribution NAP boxes connected by aerial 24-core backbone cables.

#### 2. Municipality of Presentacion (Expansion Network):
* **Active Coverage**: **Ayugao**, **Bagong Sirang**, **Baliguian**, **Bantugan**, **Bitaogan**, **Buenavista**, **Cagnipa**, **Lagha**, **Lidong**, **Liwas**, **Maangas**, **Pagsangaan**, **Patrocinio**, **Pili**, **Sta. Maria**, **Tan-Agan**.
* **Direct Backhaul**: Fed through our dedicated high-gain mountain relay repeater at Mt. Isarog ensuring ultra-low ping even during typhoons.

📍 **Main Office**: ${businessProfile.address.street}, Brgy. ${businessProfile.address.barangay}, ${businessProfile.address.city}
📞 **Hotline**: ${formatPhoneNumber(businessProfile.representative.mobile)}`,
      suggestedActions: [
        { label: 'Check Barangay Hookup', action: 'scroll', payload: { sectionId: 'coverage' } },
        { label: 'Apply for Installation', action: 'apply' },
      ],
    };
  }

  // 4. Inquiries about Application, Sign Up & Requirements
  if (
    q.includes('apply') ||
    q.includes('requirement') ||
    q.includes('sign up') ||
    q.includes('application') ||
    q.includes('install') ||
    q.includes('how to get')
  ) {
    return {
      content: `### 📝 How to Sign Up for SwiftStream Fiber Internet

Signing up is 100% simple and instant — **NO requirements or paperwork needed**!

1. **Zero Requirements**:
   - **No ID required**: You do not need to upload or present any government ID.
   - **No proof of billing / barangay clearance**: No paperwork needed.
   - Just simply sign up online with your name, contact number, and installation address, and you are **good to go**!

2. **Standard Installation Fee**:
   - **₱1,500** flat installation fee across all fiber plans.
   - Includes high-grade Dual-Band Gigabit WiFi 6 ONU modem, optical drop wire, fiber splicing, and signal testing.
   - No upfront payment required today — pay only after your fiber connection is tested and active.

3. **Fast 3-Step Process**:
   - **Step 1**: Choose your preferred fiber plan (25 Mbps to 500 Mbps).
   - **Step 2**: Fill out our 1-minute online sign-up form with your contact & address.
   - **Step 3**: Our local linemen dispatch within 24–48 hours to hook up your optical line and get you online!`,
      suggestedActions: [
        { label: 'Sign Up Online Now', action: 'apply' },
        { label: 'Explore Fiber Packages', action: 'scroll', payload: { sectionId: 'plans' } },
      ],
    };
  }

  // 5. Billing & Payment Queries
  if (
    q.includes('pay') ||
    q.includes('payment') ||
    q.includes('gcash') ||
    q.includes('maya') ||
    q.includes('bank') ||
    q.includes('xendit') ||
    q.includes('how to pay') ||
    q.includes('qr')
  ) {
    let specificBal = '';
    if (customer) {
      specificBal = `\n\n📌 **Your Current Balance**: **${formatCurrency(customer.balance)}** (Account #${customer.accountNo})`;
    }

    return {
      content: `### 💳 SwiftStream Official Payment Channels${specificBal}

You can pay your fiber subscription bill through any of our official channels:

1. **GCash QR (Recommended - 1-Click Verification)**:
   - Go to the **Subscriber Portal > Pay Bill > GCash QR**.
   - Scan our official GCash QR Code and enter the exact amount.
   - Upload your transaction reference number or receipt screenshot for instant verification.

2. **Automated Multi-Channel Checkout (Xendit)**:
   - Click **"Pay with Xendit"** on your unpaid invoice.
   - Supports **QR Ph**, **Credit/Debit Cards (Visa, Mastercard)**, **7-Eleven CLiQQ**, **BPI / UnionBank Online**, **GrabPay**, and **ShopeePay**.
   - Your account is automatically marked paid in real time with an official receipt.

3. **Maya Wallet**:
   - Send to: **${businessProfile.paymentGateways.mayaNumber}**
   - Account Name: **${businessProfile.paymentGateways.mayaName}**

4. **Direct Bank Deposit / Online Transfer**:
   - Bank: **${businessProfile.paymentGateways.bankName}**
   - Account Name: **${businessProfile.paymentGateways.bankAccountName}**
   - Account Number: **\`${businessProfile.paymentGateways.bankAccountNumber}\`**`,
      suggestedActions: [
        { label: 'Go to Subscriber Portal', action: 'scroll', payload: { sectionId: 'contact' } },
      ],
    };
  }

  // 6. Admin Mode Queries: Stats, KPIs, MikroTik, Overdue, Expenses, Profit
  if (
    mode === 'admin' &&
    (q.includes('kpi') ||
      q.includes('stats') ||
      q.includes('overdue') ||
      q.includes('revenue') ||
      q.includes('expense') ||
      q.includes('profit') ||
      q.includes('opex') ||
      q.includes('income') ||
      q.includes('mikrotik') ||
      q.includes('subscribers') ||
      q.includes('report') ||
      q.includes('nap'))
  ) {
    const activeSubscribers = customers.filter((c) => c.status === 'active').length;
    const overdueSubscribers = customers.filter((c) => c.status === 'overdue' || c.status === 'suspended').length;
    const totalUnpaid = invoices
      .filter((i) => i.status === 'unpaid' || i.status === 'overdue')
      .reduce((acc, curr) => acc + curr.totalAmount, 0);

    const totalOccupiedPorts = napBoxes.reduce((acc, n) => acc + n.ports.filter((p) => p.status === 'occupied').length, 0);
    const totalPorts = napBoxes.reduce((acc, n) => acc + n.totalPorts, 0);

    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const totalBilled = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
    const mrrTotal = customers.filter((c) => c.status === 'active').reduce((acc, c) => acc + c.monthlyFee, 0);

    return {
      content: `### 📊 SwiftStream Enterprise Financial & Network Health Snapshot

| Metric | Live Status | Operational Notes |
| :--- | :--- | :--- |
| **Total Subscribers** | **${customers.length}** | ${activeSubscribers} Active, ${overdueSubscribers} Overdue / Suspended |
| **Monthly Recurring (MRR)** | **${formatCurrency(mrrTotal)}** | Active subscription billings |
| **Total Operating Expenses (OPEX)** | **${formatCurrency(totalExpenses)}** | DIA Transit, CASURECO Power, Pole Rent, Payroll |
| **Est. Net Operating Margin** | **${formatCurrency(mrrTotal - totalExpenses)}** | MRR minus monthly operating expenses |
| **Uncollected Customer Balance** | **${formatCurrency(totalUnpaid)}** | Across ${invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue').length} unpaid invoices |
| **NAP Port Capacity** | **${totalOccupiedPorts} / ${totalPorts} Ports** | ${Math.round((totalOccupiedPorts / (totalPorts || 1)) * 100)}% utilization across ${napBoxes.length} NAP boxes |
| **MikroTik Router Fleet** | **${mikrotikDevices.length} Routers** | ${mikrotikDevices.length > 0 ? `${mikrotikDevices[0].name} (${mikrotikDevices[0].cpuLoad}% CPU)` : 'No routers'} |
| **Pending Invoices** | **${invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue').length} Invoices** | Uncollected subscriber billings (${formatCurrency(totalUnpaid)}) |

💡 **Recommended Operations Actions**:
- Use **Bill Due Calendar** to monitor upcoming PLDT DIA, CASURECO power, and pole lease deadlines.
- Review **Subscribers CRM** to send batch SMS reminder warnings to delinquent accounts.
- Inspect **MikroTik Routers** to sync PPPoE credentials and monitor core link latency.`,
      suggestedActions: [
        { label: 'Open Bill Due Calendar', action: 'tab', payload: { tabId: 'bill_calendar' } },
        { label: 'View Overdue Customers', action: 'tab', payload: { tabId: 'customers' } },
        { label: 'Open Financial Reports', action: 'tab', payload: { tabId: 'reports' } },
        { label: 'Inspect MikroTik Fleet', action: 'tab', payload: { tabId: 'mikrotik' } },
      ],
    };
  }

  // 7. Technical Troubleshooting (Optical LOS / Red Light / Slow)
  if (
    q.includes('los') ||
    q.includes('red light') ||
    q.includes('slow') ||
    q.includes('no internet') ||
    q.includes('wifi') ||
    q.includes('disconnect') ||
    q.includes('troubleshoot')
  ) {
    return {
      content: `### 🛠️ SwiftStream Optical Fiber & WiFi Diagnostic Guide

Follow these quick troubleshooting steps:

1. **Inspect ONU Router Indicator Lights**:
   - 🟢 **PON Solid Green**: Optical signal is healthy and authenticated with our OLT chassis.
   - 🔴 **LOS Blinking Red**: Optical Signal Loss. Please check if the green SC/APC fiber patch cable at the back is loose. If the cable was bent or outside drop wire was cut, contact our linemen hotline.
   - 🟡 **LAN / WLAN Blinking**: Normal WiFi and Ethernet data transmission.

2. **Power Cycle Procedure (30-Second Rule)**:
   - Turn OFF your ONU power switch.
   - Wait for **30 seconds** for IP session cache to clear.
   - Turn it back ON and allow 2 minutes for complete synchronization.

3. **Check Captive Portal / Account Status**:
   - If your account has an overdue balance past the grace period, our MikroTik Walled Garden firewall may temporarily isolate your connection until settled.

📞 **24/7 Technician Dispatch**: **${formatPhoneNumber(businessProfile.representative.mobile)}**`,
      suggestedActions: [
        { label: 'Contact Helpdesk Hotline', action: 'scroll', payload: { sectionId: 'contact' } },
      ],
    };
  }

  // 8. Service Clarification (Electronics / Laptop / Phone Repair)
  if (
    q.includes('repair') ||
    q.includes('laptop') ||
    q.includes('phone') ||
    q.includes('motherboard') ||
    q.includes('screen')
  ) {
    return {
      content: `### 🌐 SwiftStream Pure Fiber Internet Focus

SwiftStream Telecommunications is dedicated exclusively to providing **high-speed, unlimited fiber optic internet connectivity** and network infrastructure across **Lagonoy** and **Presentacion**, Camarines Sur.

We do **not** provide laptop or smartphone repair services. Our team is 100% focused on delivering stable fiber internet uptime, prompt field installations, and responsive subscriber billing support.

* ⚡ **Looking for high-speed fiber internet?** We offer unlimited plans from **25 Mbps (₱799/mo)** up to **500 Mbps (₱6,000/mo)**.
* 💳 **Want to check your fiber internet bill or balance?** Just reply with your **Account Number** (e.g., \`ACC-26-1001\`)!`,
      suggestedActions: [
        { label: '⚡ View Fiber Plans', action: 'scroll', payload: { sectionId: 'plans' } },
        { label: '💳 Check My Bill / Balance', action: 'query', payload: { query: 'Check my billing balance' } },
        { label: '📝 Apply for Fiber', action: 'apply' },
      ],
    };
  }

  // Default response
  return {
    content: `Hello! I am **SwiftStream AI Assistant** (${mode === 'admin' ? 'ISP Copilot' : 'Fiber Consultant'}).

I am equipped with live awareness of SwiftStream operations in Lagonoy and Presentacion, Camarines Sur:

* ⚡ **Unlimited Fiber Internet Plans** (25 Mbps to 500 Mbps)
* 🗺️ **Barangay Coverage in Lagonoy & Presentacion**
* 📝 **Application Process & Fast Installation**
* 💳 **Payment Channels** (GCash QR, Maya, Bank Transfer, Xendit)
* 💳 **Live Subscriber Billing & Outstanding Balance Lookup**
${
  mode === 'admin'
    ? '* 📊 **Live MRR, OPEX, Supplier Payables, and MikroTik Router Fleet Management**'
    : ''
}

How can I assist you today?`,
    suggestedActions:
      mode === 'homepage'
        ? [
            { label: '💳 Check My Bill / Balance', action: 'query', payload: { query: 'Check my billing balance' } },
            { label: '⚡ Browse Fiber Plans', action: 'scroll', payload: { sectionId: 'plans' } },
            { label: '🗺️ Check Barangay Coverage', action: 'scroll', payload: { sectionId: 'coverage' } },
            { label: '📝 Start Application', action: 'apply' },
          ]
        : [
            { label: '📅 Bill Due Calendar', action: 'tab', payload: { tabId: 'bill_calendar' } },
            { label: '📊 KPI Financial Summary', action: 'tab', payload: { tabId: 'reports' } },
            { label: '👥 Subscribers CRM', action: 'tab', payload: { tabId: 'customers' } },
          ],
  };
};

/**
 * Test a Google Gemini API Key by making a lightweight request
 */
export const testGeminiApiKey = async (
  apiKey: string,
  model = 'gemini-2.5-flash'
): Promise<{ success: boolean; message: string }> => {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'Please enter a valid Google Gemini API Key.' };
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Ping. Reply with "OK".' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errMsg = err?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      return { success: false, message: `Gemini API Error: ${errMsg}` };
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply) {
      return { success: true, message: `Successfully connected to Google Gemini Live API (${model})!` };
    }
    return { success: false, message: 'Received empty response from Gemini API.' };
  } catch (error: any) {
    return { success: false, message: `Connection error: ${error?.message || 'Network unreachable'}` };
  }
};

/**
 * Main AI Assistant Invocation Function
 * Calls Google Gemini API if configured; otherwise gracefully falls back to the smart local engine
 */
export const askGeminiAiAssistant = async (params: AskGeminiParams): Promise<AskGeminiResult> => {
  const { prompt, history, mode, customer, ispContext } = params;
  const apiKey =
    params.apiKey ||
    ispContext.businessProfile.apiKeys.geminiApiKey ||
    ((typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_GEMINI_API_KEY) as string) ||
    '';
  const model = params.model || ispContext.businessProfile.apiKeys.geminiModel || 'gemini-2.5-flash';

  // If no API key is provided, use the smart local domain knowledge engine
  if (!apiKey || apiKey.trim() === '') {
    return runSmartLocalEngine(params);
  }

  // Check if subscriber billing inquiry applies and inject live context into Gemini
  const billingLookup = lookupSubscriberBilling(prompt, ispContext.customers, ispContext.invoices, customer || undefined);
  let extraContext = '';

  if (billingLookup.found && billingLookup.customer) {
    const cust = billingLookup.customer;
    const inv = billingLookup.latestInvoice;
    extraContext = `\n\n### REAL-TIME SUBSCRIBER BILLING RECORD FETCHED LIVE FROM DATABASE:
- Subscriber Name: ${cust.fullName}
- Account Number: ${cust.accountNo}
- Subscribed Plan: ${cust.planName} (${formatCurrency(cust.monthlyFee)}/month)
- Current Outstanding Balance: ${formatCurrency(Math.max(0, cust.balance))} (${cust.balance <= 0 ? 'FULLY PAID / ZERO BALANCE' : (billingLookup.hasOverdue ? 'OVERDUE' : 'UNPAID')})
- Account Status: ${cust.status.toUpperCase()}
- Billing Cycle: Every ${cust.billingDay}th of the month
- Latest Invoice: ${inv ? `#${inv.invoiceNumber} (${formatCurrency(inv.totalAmount)} - Status: ${inv.status.toUpperCase()} - Due: ${inv.dueDate})` : 'None'}
- Unpaid Invoices Count: ${billingLookup.unpaidInvoices?.length || 0}
CRITICAL INSTRUCTION: You MUST use these exact live figures to answer the user's billing/balance inquiry. Include their outstanding balance, latest invoice details, and official payment instructions (GCash, Maya, Bank Transfer).`;
  } else if (!billingLookup.found && billingLookup.searchedAccountNo) {
    extraContext = `\n\n### ACCOUNT SEARCH RESULT:
The user requested billing information for account number "${billingLookup.searchedAccountNo}", but NO matching subscriber was found in the database.
CRITICAL INSTRUCTION: Politely inform the user that account "${billingLookup.searchedAccountNo}" was not found. Advise them to verify their account number on their monthly SMS notification or official receipt, or provide their registered full name / mobile number.`;
  } else if (!billingLookup.found && billingLookup.isGenericInquiry && mode !== 'admin') {
    extraContext = `\n\n### BILLING INQUIRY NOTICE:
The user is asking about their billing statement or balance, but has not provided an Account Number yet.
CRITICAL INSTRUCTION: Politely ask them to provide their Account Number (e.g., ACC-26-XXXX) so you can fetch their live invoice and balance from the database.`;
  }

  const systemInstruction = buildSystemPrompt(params) + extraContext;

  try {
    // Format conversation history for Gemini REST API
    const formattedContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add recent conversation history (up to last 6 turns)
    const recentHistory = history.slice(-6);
    recentHistory.forEach((msg) => {
      formattedContents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    });

    // Add current user prompt
    formattedContents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const requestBody = {
      contents: formattedContents,
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('Gemini API returned error, falling back to smart local engine:', errorData);
      return runSmartLocalEngine(params);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (candidateText && candidateText.trim().length > 0) {
      // Inferred quick actions based on response content and mode
      const lower = (candidateText + ' ' + prompt).toLowerCase();
      const actions: AskGeminiAction[] = [];

      if (mode === 'homepage') {
        if (lower.includes('balance') || lower.includes('bill') || lower.includes('invoice') || lower.includes('statement')) {
          actions.push({ label: 'Check My Bill / Balance', action: 'query', payload: { query: 'Check my billing balance' } });
        }
        if (lower.includes('apply') || lower.includes('plan') || lower.includes('speed') || lower.includes('package')) {
          actions.push({ label: 'Apply Online', action: 'apply' });
          actions.push({ label: 'View All Plans', action: 'scroll', payload: { sectionId: 'plans' } });
        }
        if (lower.includes('coverage') || lower.includes('barangay') || lower.includes('lagonoy') || lower.includes('presentacion')) {
          actions.push({ label: 'Check Coverage', action: 'scroll', payload: { sectionId: 'coverage' } });
        }
        if (lower.includes('calculator') || lower.includes('matcher') || lower.includes('speed')) {
          actions.push({ label: 'Speed Matcher', action: 'scroll', payload: { sectionId: 'calculator' } });
        }
      } else if (mode === 'admin') {
        if (lower.includes('bill') || lower.includes('dia') || lower.includes('casureco') || lower.includes('rent') || lower.includes('due')) {
          actions.push({ label: 'Bill Due Calendar', action: 'tab', payload: { tabId: 'bill_calendar' } });
        }
        if (lower.includes('customer') || lower.includes('subscriber') || lower.includes('overdue')) {
          actions.push({ label: 'Subscribers CRM', action: 'tab', payload: { tabId: 'customers' } });
        }
        if (lower.includes('router') || lower.includes('mikrotik') || lower.includes('pppoe') || lower.includes('queue')) {
          actions.push({ label: 'MikroTik Router Fleet', action: 'tab', payload: { tabId: 'mikrotik' } });
        }
        if (lower.includes('revenue') || lower.includes('opex') || lower.includes('profit') || lower.includes('expense')) {
          actions.push({ label: 'Financial Reports', action: 'tab', payload: { tabId: 'reports' } });
        }
        if (lower.includes('invoice') || lower.includes('billing') || lower.includes('receivable')) {
          actions.push({ label: 'Billing & Invoices', action: 'tab', payload: { tabId: 'billing' } });
        }
      }

      return {
        content: candidateText.trim(),
        suggestedActions: actions.length > 0 ? actions : undefined,
      };
    }

    return runSmartLocalEngine(params);
  } catch (error) {
    console.warn('Error connecting to Gemini API, falling back to smart local engine:', error);
    return runSmartLocalEngine(params);
  }
};
