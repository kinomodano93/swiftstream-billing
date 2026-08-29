import { BusinessProfile, Customer, Expense, Invoice, MikrotikDevice, NapBox, Plan, RepairOrder } from '../types';
import { formatCurrency, formatPhoneNumber } from './formatters';

export interface GeminiAiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
  };
  apiKey?: string;
  model?: string;
}

/**
 * Builds the customized system prompt based on whether the AI is answering from Homepage, Client Portal, or Admin
 */
export const buildSystemPrompt = (params: AskGeminiParams): string => {
  const { mode, customer, ispContext } = params;
  const { businessProfile, plans, customers, invoices, repairOrders, mikrotikDevices, napBoxes } = ispContext;

  const activeCount = customers.filter((c) => c.status === 'active').length;
  const overdueCount = customers.filter((c) => c.status === 'overdue' || c.status === 'suspended').length;
  const totalUnpaidAmount = invoices
    .filter((i) => i.status === 'unpaid' || i.status === 'overdue')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  const planSummary = plans
    .map((p) => `- **${p.name}**: ${p.speedMbps} Mbps Unlimited Fiber @ ₱${p.monthlyFee.toLocaleString()}/mo (Installation: ₱${p.installationFee.toLocaleString()}) - ${p.description}`)
    .join('\n');

  if (mode === 'homepage') {
    return `You are "SwiftStream AI Fiber Assistant", a helpful, friendly, and knowledgeable sales and support AI consultant for SwiftStream Telecommunication & Repair Shop located in Lagonoy, Camarines Sur, Philippines.

### Company Profile:
- **Provider**: ${businessProfile.name} (${businessProfile.tradeName})
- **Location**: ${businessProfile.address.street}, Brgy. ${businessProfile.address.barangay}, ${businessProfile.address.city}, ${businessProfile.address.province}
- **Contact Hotline**: ${formatPhoneNumber(businessProfile.representative.mobile)} | ${businessProfile.representative.email}
- **Official TIN**: ${businessProfile.tin} (BIR Registered ISP & Electronics Repair Center)

### Available Fiber Plans & Pricing:
${planSummary}

### Coverage Areas in Lagonoy:
Barangays: Binauahan, Poblacion, San Isidro, San Jose, Santa Maria, Dahican, Mapid, Loho, and neighboring districts.

### Repair Shop Services:
Laptop, smartphone, PC motherboard repair, fiber optical cable splicing, router reconfiguration, and power surge repairs with a 90-day parts & labor warranty.

### Payment Channels Accepted:
GCash (with 1-click QR Ph scanner), Maya, Bank Transfer (BDO, BPI, UnionBank), and automated multi-channel checkout via Xendit (Credit Cards, 7-Eleven CLiQQ, GrabPay, ShopeePay).

### Instructions:
- Answer customer inquiries concisely, enthusiastically, and professionally.
- Use clear bullet points and markdown formatting where appropriate.
- Help customers compare speeds (e.g. 25M for light browsing, 50M for families, 100M for 4K streaming and low-ping gaming, 500M dedicated for business).
- You can speak in English or Tagalog/Bicolano if the user addresses you in those languages.`;
  }

  if (mode === 'client') {
    let clientSnippet = 'No subscriber account currently selected. Ask user for their Account Number or Full Name.';
    if (customer) {
      const custInvoices = invoices.filter((i) => i.customerId === customer.id);
      const latestInvoice = custInvoices[0];
      const custRepairs = repairOrders.filter((r) => r.customerId === customer.id);

      clientSnippet = `
### Active Subscriber Profile:
- **Full Name**: ${customer.fullName}
- **Account Number**: ${customer.accountNo}
- **Current Plan**: ${customer.planName} (${formatCurrency(customer.monthlyFee)}/month)
- **Account Balance**: ${formatCurrency(customer.balance)} (${customer.status.toUpperCase()})
- **Installation Address**: ${customer.address.street}, Brgy. ${customer.address.barangay}, ${customer.address.city}
- **Contact Number**: ${formatPhoneNumber(customer.mobile)}
- **Network Credentials**: PPPoE User: \`${customer.network.pppoeUsername}\` | Assigned IP: \`${customer.network.ipAddress}\` | Optical Rx: \`${customer.network.opticalPowerDbm || -18.5} dBm\` (Optimal)
- **Latest Invoice**: ${latestInvoice ? `#${latestInvoice.invoiceNumber} (₱${latestInvoice.totalAmount.toLocaleString()} - Status: ${latestInvoice.status.toUpperCase()} - Due: ${latestInvoice.dueDate})` : 'No open invoices'}
- **Open Repair Orders**: ${custRepairs.length > 0 ? custRepairs.map((r) => `#${r.orderNumber} (${r.deviceType} - ${r.status})`).join(', ') : 'None'}
`;
    }

    return `You are "SwiftStream Client Care AI", a 24/7 self-service billing, account lookup, and optical fiber technical support agent for SwiftStream subscribers in Lagonoy, Camarines Sur.

${clientSnippet}

### Payment Methods:
1. **GCash**: Scan official GCash QR Code on the Client Portal and upload screenshot/reference number.
2. **Maya**: Send to registered Maya number ${businessProfile.paymentGateways.mayaNumber} (${businessProfile.paymentGateways.mayaName}).
3. **Automated Xendit**: Click "Pay with Xendit" to instantly settle via GCash, QR Ph, Credit Card, or 7-Eleven CLiQQ with real-time official receipt generation.
4. **Bank Transfer**: ${businessProfile.paymentGateways.bankName} - Acct: ${businessProfile.paymentGateways.bankAccountNumber} (${businessProfile.paymentGateways.bankAccountName}).

### Technical Troubleshooting Guide:
- **Red Optical LOS Light on ONU**: Indicates optical fiber cut or unplugged patch cord. Advise checking the green SC/APC optical cable or requesting an on-site technician.
- **Slow Internet / High Ping**: Suggest power-cycling the ONU router (wait 30 seconds before reconnecting) or testing via direct LAN cable.
- **Account Suspended / Isolated**: Explain that settling the overdue balance via GCash or Xendit immediately clears the MikroTik Walled Garden firewall isolation.

### Instructions:
- Greet the subscriber by name if provided.
- Provide clear, empathetic, and actionable billing and technical guidance.
- Format numerical amounts clearly with ₱ currency symbol.`;
  }

  // Admin Mode
  return `You are "SwiftStream ISP Copilot", an expert operations, network engineering, and billing analytics AI assistant for SwiftStream Telecommunication & Repair Shop administrators.

### Live ISP Network Operations Snapshot:
- **Total Subscribers**: ${customers.length} (${activeCount} Active, ${overdueCount} Overdue / Suspended)
- **Total Uncollected Overdue Balance**: ${formatCurrency(totalUnpaidAmount)} across ${invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue').length} open invoices
- **Total Fiber Distribution NAP Boxes**: ${napBoxes.length} (${napBoxes.reduce((acc, n) => acc + n.ports.filter((p) => p.status === 'occupied').length, 0)} ports occupied)
- **Active Repair Shop Queue**: ${repairOrders.filter((r) => r.status !== 'completed' && r.status !== 'cancelled').length} in-progress repair tickets
- **Operating Expenses (OPEX)**: ${ispContext.expenses ? `${formatCurrency(ispContext.expenses.reduce((acc, e) => acc + e.amount, 0))} logged across ${ispContext.expenses.length} expense vouchers` : 'N/A'}
- **MikroTik Router Fleet**:
${mikrotikDevices.map((d) => `  - **${d.name}** (${d.model}): IP ${d.ipAddress} | Status: ${d.status.toUpperCase()} | CPU: ${d.cpuLoad}% | Uptime: ${d.uptime} | Active PPPoE: ${d.activePppoeCount}`).join('\n')}

### Available ISP Plans:
${planSummary}

### Admin Capabilities:
- Summarize revenue KPIs, OPEX expenses, Net Operating Profit, collection efficiency, delinquent subscribers, and barangay distributions.
- Explain RouterOS scripts: PPPoE batch creation, Simple Queues rate-limiting, and Walled Garden firewall address-list isolation.
- Generate customer notification templates for SMS and Email payment reminders.
- Provide fiber optical budget calculations (OLT Class C+ +8dBm to ONU -18dBm through 1:16 PLC splitters).

### Instructions:
- Act as a senior ISP network administrator and financial controller.
- Provide crisp, technical, structured markdown answers with tables or code blocks where applicable.`;
};

/**
 * Intelligent domain-specific rule & knowledge fallback engine when API key is not present or offline
 */
export const runSmartLocalEngine = (params: AskGeminiParams): string => {
  const { prompt, mode, customer, ispContext } = params;
  const q = prompt.toLowerCase();
  const { businessProfile, plans, customers, invoices, repairOrders, mikrotikDevices, napBoxes } = ispContext;

  // 1. Inquiries about Internet Plans
  if (q.includes('plan') || q.includes('speed') || q.includes('package') || q.includes('mbps') || q.includes('price') || q.includes('rates') || q.includes('promo')) {
    return `### ⚡ SwiftStream Unlimited Fiber Plans

Here are our official high-speed fiber internet packages:

${plans
  .map(
    (p) => `* **${p.name}**
  - Speed: **${p.speedMbps} Mbps** Unlimited Fiber
  - Monthly Rate: **₱${p.monthlyFee.toLocaleString()}/month**
  - Installation Fee: ₱${p.installationFee.toLocaleString()}
  - Highlights: ${p.description}`
  )
  .join('\n\n')}

💡 **Recommendation**:
* **Pro Fiber 100M (₱1,699)**: Best for remote work, 4K streaming, and multi-device homes.
* **Home Turbo 50M (₱1,299)**: Most popular choice for families and online schooling.
* **Starter 25M (₱799)**: Budget-friendly entry package.
* **Flexibix Peak 6000 (₱6,000)**: 500 Mbps dedicated symmetric fiber with SLA for businesses and internet cafes.`;
  }

  // 2. Billing & Payment Queries
  if (q.includes('pay') || q.includes('payment') || q.includes('gcash') || q.includes('maya') || q.includes('bank') || q.includes('xendit') || q.includes('how to pay')) {
    let specificBal = '';
    if (customer) {
      specificBal = `\n\n📌 **Your Current Balance**: **${formatCurrency(customer.balance)}** (Account #${customer.accountNo})`;
    }

    return `### 💳 SwiftStream Payment Options${specificBal}

You can pay your SwiftStream fiber internet bill through the following official channels:

1. **GCash QR (Fastest)**:
   - Go to the **Client Portal > Pay Bill > GCash QR**.
   - Scan our official GCash QR Code and enter the exact amount.
   - Upload your payment reference number/receipt screenshot for instant verification.

2. **Automated Multi-Channel Checkout (Xendit)**:
   - Click **"Pay with Xendit"** on your unpaid invoice.
   - Choose from **QR Ph**, **Credit/Debit Card (Visa/Mastercard)**, **7-Eleven CLiQQ**, **BPI / UnionBank Online**, **GrabPay**, or **ShopeePay**.
   - Your account is automatically updated and marked paid upon completion!

3. **Maya Wallet**:
   - Send to: **${businessProfile.paymentGateways.mayaNumber}**
   - Account Name: **${businessProfile.paymentGateways.mayaName}**

4. **Direct Bank Deposit / Online Banking**:
   - Bank: **${businessProfile.paymentGateways.bankName}**
   - Account Name: **${businessProfile.paymentGateways.bankAccountName}**
   - Account Number: **\`${businessProfile.paymentGateways.bankAccountNumber}\`**`;
  }

  // 3. Client Mode Specific: Check Balance & Account Details
  if (mode === 'client' && (q.includes('balance') || q.includes('account') || q.includes('bill') || q.includes('due') || q.includes('soa') || q.includes('statement'))) {
    if (!customer) {
      return `Please select or log in with your **Account Number** in the Client Portal to look up your live statement and balance.`;
    }

    const custInvoices = invoices.filter((i) => i.customerId === customer.id);
    const unpaidInvoices = custInvoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue');

    return `### 👤 Account Statement for **${customer.fullName}**

* **Account Number**: \`${customer.accountNo}\`
* **Current Plan**: **${customer.planName}** (₱${customer.monthlyFee.toLocaleString()}/month)
* **Status**: **${customer.status.toUpperCase()}**
* **Outstanding Balance**: **${formatCurrency(customer.balance)}**

${
  unpaidInvoices.length > 0
    ? `⚠️ **Unpaid Invoices**:
${unpaidInvoices.map((inv) => `  - Invoice **#${inv.invoiceNumber}**: ₱${inv.totalAmount.toLocaleString()} (Due: **${inv.dueDate}**)`).join('\n')}`
    : `✅ **Great news!** Your account is fully paid with no outstanding dues.`
}

* **Assigned Static IP**: \`${customer.network.ipAddress}\`
* **Optical Rx Power**: \`${customer.network.opticalPowerDbm || -18.5} dBm\` (Optimal Optical Signal)`;
  }

  // 4. Technical Support / WiFi / Optical Issues
  if (q.includes('los') || q.includes('red light') || q.includes('slow') || q.includes('no internet') || q.includes('wifi') || q.includes('disconnect') || q.includes('troubleshoot')) {
    return `### 🛠️ SwiftStream Quick Network Troubleshooting

Here are the step-by-step diagnostic procedures for common fiber connection issues:

1. **Check ONU Optical Status Lights**:
   - 🟢 **PON Light Solid Green**: Optical signal from OLT is healthy and authenticated.
   - 🔴 **LOS Light Blinking Red**: Optical Signal Loss. Please check that the green fiber patch cable at the back of your ONU is firmly connected. If the fiber drop cable outside was snagged, contact our support hotline.

2. **Power Cycle Procedure**:
   - Turn OFF your ONU router switch.
   - Wait for **30 seconds** for residual power and IP session to clear.
   - Turn it back ON and allow 2 minutes for full synchronization.

3. **Check Account Payment Status**:
   - If an invoice is overdue past the grace period, the line may be temporarily routed through our captive portal until payment is settled.

📞 **Emergency Technician Hotline**: **${formatPhoneNumber(businessProfile.representative.mobile)}** | Available 24/7 in Lagonoy.`;
  }

  // 5. Admin Mode Queries: Stats, KPIs, MikroTik, Overdue, Expenses, Profit
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
      q.includes('report'))
  ) {
    const activeSubscribers = customers.filter((c) => c.status === 'active').length;
    const overdueSubscribers = customers.filter((c) => c.status === 'overdue' || c.status === 'suspended').length;
    const totalUnpaid = invoices
      .filter((i) => i.status === 'unpaid' || i.status === 'overdue')
      .reduce((acc, curr) => acc + curr.totalAmount, 0);

    const totalOccupiedPorts = napBoxes.reduce((acc, n) => acc + n.ports.filter((p) => p.status === 'occupied').length, 0);
    const totalPorts = napBoxes.reduce((acc, n) => acc + n.totalPorts, 0);

    const totalExpenses = (ispContext.expenses || []).reduce((acc, e) => acc + e.amount, 0);
    const totalBilled = invoices.reduce((acc, i) => acc + i.totalAmount, 0);

    return `### 📊 SwiftStream Financial, Operations & Network Snapshot

| Metric | Current Status | Details |
| :--- | :--- | :--- |
| **Total Subscribers** | **${customers.length}** | ${activeSubscribers} Active, ${overdueSubscribers} Overdue / Suspended |
| **Gross Billed Revenue** | **${formatCurrency(totalBilled)}** | Total subscription invoices + repair shop billing |
| **Operating Expenses (OPEX)** | **${formatCurrency(totalExpenses)}** | Upstream IP Transit, CASURECO Power, Fiber supplies, Salaries |
| **Est. Net Operating Income** | **${formatCurrency(totalBilled - totalExpenses)}** | Gross Billed minus Operating Expenses |
| **Uncollected Overdue** | **${formatCurrency(totalUnpaid)}** | Across ${invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue').length} unpaid invoices |
| **Optical NAP Capacity** | **${totalOccupiedPorts} / ${totalPorts} Ports** | ${Math.round((totalOccupiedPorts / (totalPorts || 1)) * 100)}% utilization across ${napBoxes.length} NAP boxes |
| **MikroTik Fleet** | **${mikrotikDevices.length > 0 ? mikrotikDevices[0].name : 'No Devices'}** | ${mikrotikDevices.length > 0 ? `${mikrotikDevices[0].model} • Status: ${mikrotikDevices[0].status.toUpperCase()}` : 'Add router in Fleet Manager'} |
| **Open Repair Tickets** | **${repairOrders.filter((r) => r.status !== 'completed' && r.status !== 'cancelled').length} Orders** | Diagnostics, motherboard, and optical repairs |

💡 **Quick Operations Tips**:
- Review itemized expense vouchers under **Financial Reports > Expense Ledger**.
- Use **MikroTik Routers > Sync All Subscribers** to push latest PPPoE secrets and Simple Queues to RouterOS.
- Use **Walled Garden Isolation** to temporarily isolate overdue subscribers without terminating physical links.`;
  }

  // 6. Coverage & Location Queries
  if (q.includes('coverage') || q.includes('barangay') || q.includes('location') || q.includes('lagonoy') || q.includes('where')) {
    return `### 🗺️ SwiftStream Fiber Coverage in Lagonoy, Camarines Sur

We provide fiber coverage across key barangays in Lagonoy:

* **Barangay Binauahan** (Main Operations Hub & NAP-01, NAP-02)
* **Barangay Poblacion** (Commercial Center & Plaza Distribution Nodes)
* **Barangay San Isidro**
* **Barangay San Jose**
* **Barangay Santa Maria**
* **Barangay Dahican**
* **Barangay Mapid**

📍 **Main Office**: ${businessProfile.address.street}, Brgy. ${businessProfile.address.barangay}, ${businessProfile.address.city}, ${businessProfile.address.province}
📞 **Sales Hotline**: ${formatPhoneNumber(businessProfile.representative.mobile)}`;
  }

  // 7. Repair Shop Queries
  if (q.includes('repair') || q.includes('laptop') || q.includes('phone') || q.includes('motherboard') || q.includes('fix') || q.includes('hardware')) {
    return `### 🔧 SwiftStream Electronics & Computer Repair Center

Aside from high-speed fiber internet, SwiftStream operates a professional repair center:

* **Laptop & Desktop PC Repairs**: Motherboard component-level repair, OS reinstallation, RAM/SSD upgrades, screen replacements.
* **Smartphone & Tablet Servicing**: LCD replacement, charging port fix, battery replacement, water damage revival.
* **Fiber & Networking Hardware**: Optical transceiver diagnosis, ONU router reprogramming, fiber patch cord replacement.
* **Warranty**: All repairs come with a **90-Day Parts & Labor Warranty** with official service diagnostic sheets.`;
  }

  // Default intelligent response
  return `Hello! I am **SwiftStream AI Assistant**. 

I can assist you with:
* 🚀 **Internet Plans & Pricing** (25 Mbps to 500 Mbps)
* 💳 **Billing & Payment Options** (GCash QR, Maya, Bank Transfer, Xendit Checkout)
* 👤 **Subscriber Balance & Account Statements**
* 🛠️ **Optical Fiber & WiFi Troubleshooting**
* 🗺️ **Coverage in Lagonoy Barangays**
* 🔧 **Computer & Electronics Repair Services**
${mode === 'admin' ? '* 🛡️ **MikroTik RouterOS CLI & ISP Operations Analytics**' : ''}

How can I help you today?`;
};

/**
 * Main AI Assistant Invocation Function
 * Calls Google Gemini API if configured; otherwise gracefully falls back to the smart local engine
 */
export const askGeminiAiAssistant = async (params: AskGeminiParams): Promise<string> => {
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

  const systemInstruction = buildSystemPrompt(params);

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
      return candidateText.trim();
    }

    return runSmartLocalEngine(params);
  } catch (error) {
    console.warn('Error connecting to Gemini API, falling back to smart local engine:', error);
    return runSmartLocalEngine(params);
  }
};
