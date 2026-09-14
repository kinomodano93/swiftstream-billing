import { BusinessProfile, Customer, Plan } from '../types';

/**
 * Generates RouterOS script for bulk PPPoE Secrets & Bandwidth Simple Queues
 */
export const generatePppoeBatchScript = (
  customers: Customer[],
  plans: Plan[],
  profile: BusinessProfile
): string => {
  let script = `# =========================================================
# SwiftStream Telecommunication - PPPoE Secrets & Queues
# Total Subscribers: ${customers.length}
# Generated: ${new Date().toLocaleString()}
# =========================================================

/ppp secret
`;

  customers.forEach((cust) => {
    const plan = plans.find((p) => p.id === cust.planId);
    const speed = plan ? `${plan.speedMbps}M` : '25M';
    const profileName = `Plan-${speed}`;
    const pppUser = cust.network.pppoeUsername || cust.accountNo.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const pppPass = cust.network.pppoePassword || 'swift1234';
    const isDisabled = cust.status === 'suspended' || cust.status === 'disconnected' ? 'yes' : 'no';

    script += `add name="${pppUser}" password="${pppPass}" service=pppoe profile="${profileName}" remote-address=${cust.network.ipAddress} disabled=${isDisabled} comment="${cust.fullName} - ${cust.accountNo}"\n`;
  });

  script += `\n# --- Bandwidth Simple Queues ---\n/queue simple\n`;

  customers.forEach((cust) => {
    const plan = plans.find((p) => p.id === cust.planId);
    const speed = plan ? `${plan.speedMbps}M` : '25M';
    const queueName = `Q-${cust.accountNo}`;
    const isDisabled = cust.status === 'suspended' || cust.status === 'disconnected' ? 'yes' : 'no';

    script += `add name="${queueName}" target=${cust.network.ipAddress}/32 max-limit=${speed}/${speed} disabled=${isDisabled} comment="${cust.fullName} (${cust.planName})"\n`;
  });

  return script;
};

/**
 * Generates RouterOS Option A Walled Garden & Overdue Non-Payment Isolation Script
 * (Strict Redirection, Captive Portal Trigger via HTTPS reset, and Payment Gateway Whitelist)
 */
export const generateIsolationScript = (
  customers: Customer[],
  portalUrl?: string,
  portalIp?: string
): string => {
  const overdueCustomers = customers.filter(
    (c) => c.status === 'overdue' || c.status === 'suspended' || c.status === 'disconnected'
  );

  let cleanPortalHost = '';
  if (portalUrl) {
    try {
      cleanPortalHost = portalUrl.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
    } catch {
      cleanPortalHost = portalUrl;
    }
  }

  let script = `# ====================================================================
# SwiftStream Telecommunications - Option A Walled Garden Isolation
# Target: MikroTik Core Router (RouterOS v6.43+ / v7.x)
# Overdue / Suspended Subscribers: ${overdueCustomers.length}
# Features:
#   1. Captive Portal Trigger (HTTPS TCP-Reset to trigger OS popup)
#   2. HTTP Port 80 Redirection to SwiftStream Billing Portal
#   3. Whitelist for GCash, Maya, Xendit & Captive Detection Probes
#   4. Throttled PPPoE Isolated Profile (128k/128k)
# Generated: ${new Date().toLocaleString()}
# ====================================================================

# Step 1: Ensure Isolated PPPoE Profile Exists (Throttled for Delinquent Accounts)
/ppp profile
add name="isolated" rate-limit="128k/128k" local-address=192.168.10.1 dns-server=1.1.1.1,8.8.8.8 comment="SwiftStream Overdue Walled Garden Isolation Profile"

# Step 2: Create Walled Garden Whitelist (Allowed Domains While Suspended)
/ip firewall address-list
remove [find list="WALLED_GARDEN_WHITELIST"]

# A. SwiftStream Client Portal & Infrastructure
add list="WALLED_GARDEN_WHITELIST" address="swiftstream.ph" comment="SwiftStream Main Portal"
add list="WALLED_GARDEN_WHITELIST" address="swiftstream-billing.web.app" comment="SwiftStream Firebase App"
add list="WALLED_GARDEN_WHITELIST" address="swiftstream-billing.firebaseapp.com" comment="SwiftStream Firebase Auth"
add list="WALLED_GARDEN_WHITELIST" address="firestore.googleapis.com" comment="Firebase Cloud Firestore API"
${cleanPortalHost && !['swiftstream.ph', 'swiftstream-billing.web.app'].includes(cleanPortalHost) ? `add list="WALLED_GARDEN_WHITELIST" address="${cleanPortalHost}" comment="SwiftStream Configured Portal Host"\n` : ''}${portalIp ? `add list="WALLED_GARDEN_WHITELIST" address="${portalIp}" comment="SwiftStream Portal Local/Public IP"\n` : ''}
# B. Mobile & Desktop Captive Portal Probes (Triggers "Sign in to network")
add list="WALLED_GARDEN_WHITELIST" address="connectivitycheck.gstatic.com" comment="Android Captive Check"
add list="WALLED_GARDEN_WHITELIST" address="clients3.google.com" comment="Google Captive Check"
add list="WALLED_GARDEN_WHITELIST" address="captive.apple.com" comment="Apple iOS Captive Check"
add list="WALLED_GARDEN_WHITELIST" address="www.apple.com" comment="Apple Network Probe"
add list="WALLED_GARDEN_WHITELIST" address="www.msftconnecttest.com" comment="Windows Captive Check"
add list="WALLED_GARDEN_WHITELIST" address="ipv4.connman.net" comment="Linux/ConnMan Network Probe"

# C. Philippine Payment Gateways & APIs (Allowing Online Bill Settlement)
add list="WALLED_GARDEN_WHITELIST" address="gcash.com" comment="GCash Web Portal"
add list="WALLED_GARDEN_WHITELIST" address="m.gcash.com" comment="GCash Mobile Portal"
add list="WALLED_GARDEN_WHITELIST" address="api.gcash.com" comment="GCash API"
add list="WALLED_GARDEN_WHITELIST" address="maya.ph" comment="Maya Digital Bank"
add list="WALLED_GARDEN_WHITELIST" address="paymaya.com" comment="PayMaya Portal"
add list="WALLED_GARDEN_WHITELIST" address="pg.maya.ph" comment="Maya Payment Gateway"
add list="WALLED_GARDEN_WHITELIST" address="xendit.co" comment="Xendit Core"
add list="WALLED_GARDEN_WHITELIST" address="checkout.xendit.co" comment="Xendit Checkout"
add list="WALLED_GARDEN_WHITELIST" address="api.xendit.co" comment="Xendit API"

# Step 3: Populate Overdue Subscriber IP Address List
/ip firewall address-list
remove [find list="NON_PAYMENT_ISOLATION"]
`;

  if (overdueCustomers.length === 0) {
    script += `# No subscribers currently overdue or suspended. All lines active.\n`;
  } else {
    overdueCustomers.forEach((cust) => {
      const ip = cust.network?.ipAddress || '192.168.10.100';
      const bal = cust.balance !== undefined ? cust.balance : 0;
      script += `add list="NON_PAYMENT_ISOLATION" address=${ip} comment="${cust.fullName} - Bal: P${bal} (${cust.status.toUpperCase()})"\n`;
    });
  }

  script += `
# Step 4: Firewall NAT Rules (Redirect HTTP Port 80 to Portal)
/ip firewall nat
# 1. Accept/Bypass traffic to whitelisted payment destinations without redirection
add chain=dstnat src-address-list="NON_PAYMENT_ISOLATION" dst-address-list="WALLED_GARDEN_WHITELIST" action=accept comment="SwiftStream WG: Permit Whitelist HTTP"
# 2. Redirect all other HTTP (Port 80) traffic to Portal
${portalIp ? `add chain=dstnat src-address-list="NON_PAYMENT_ISOLATION" protocol=tcp dst-port=80 action=dst-nat to-addresses=${portalIp} to-ports=80 comment="SwiftStream WG: HTTP Captive Portal Redirect"` : `add chain=dstnat src-address-list="NON_PAYMENT_ISOLATION" protocol=tcp dst-port=80 action=redirect to-ports=8080 comment="SwiftStream WG: HTTP Captive Portal Redirect"`}

# Step 5: Firewall Filter Rules (Allow Whitelist, Reset HTTPS, Drop Other Forwarding)
/ip firewall filter
# 1. Allow DNS queries (UDP & TCP 53) so whitelisted payment domains resolve
add chain=forward src-address-list="NON_PAYMENT_ISOLATION" protocol=udp dst-port=53 action=accept comment="SwiftStream WG: Allow DNS UDP"
add chain=forward src-address-list="NON_PAYMENT_ISOLATION" protocol=tcp dst-port=53 action=accept comment="SwiftStream WG: Allow DNS TCP"

# 2. Allow bidirectional forward traffic to Whitelist (Portal & Payment Gateways)
add chain=forward src-address-list="NON_PAYMENT_ISOLATION" dst-address-list="WALLED_GARDEN_WHITELIST" action=accept comment="SwiftStream WG: Allow Whitelist Traffic"
add chain=forward dst-address-list="NON_PAYMENT_ISOLATION" src-address-list="WALLED_GARDEN_WHITELIST" action=accept comment="SwiftStream WG: Allow Return Whitelist Traffic"

# 3. Reject non-whitelisted HTTPS (Port 443) with TCP Reset (Avoids SSL Warning & Triggers Captive Popup)
add chain=forward src-address-list="NON_PAYMENT_ISOLATION" protocol=tcp dst-port=443 action=reject reject-with=tcp-reset comment="SwiftStream WG: Reset HTTPS to Trigger Captive Portal"

# 4. Drop all other traffic for isolated accounts
add chain=forward src-address-list="NON_PAYMENT_ISOLATION" action=drop comment="SwiftStream WG: Drop Non-Payment Internet Traffic"
`;

  return script;
};

/**
 * Generates Complete Bootstrap .rsc script for MikroTik Core Router
 */
export const generateFullRouterConfigScript = (profile: BusinessProfile, plans: Plan[]): string => {
  let planProfiles = '';
  plans.forEach((p) => {
    planProfiles += `/ppp profile add name="Plan-${p.speedMbps}M" rate-limit="${p.speedMbps}M/${p.speedMbps}M" local-address=192.168.10.1 dns-server=1.1.1.1,8.8.8.8 comment="SwiftStream Fiber ${p.speedMbps} Mbps"\n`;
  });

  return `# ====================================================================
# SwiftStream Telecommunication - Full MikroTik RouterOS Initial Setup
# Node: Lagonoy Camarines Sur Core Node
# ====================================================================

# 1. IP Pools & PPPoE Profiles
/ip pool add name="pppoe-pool-lagonoy" ranges=192.168.10.10-192.168.10.250

${planProfiles}
# 2. PPPoE Server Setup on Bridge / LAN Interface
/interface pppoe-server server
add service-name="SwiftStream-Fiber-Lagonoy" interface=ether2 max-mtu=1480 max-mru=1480 default-profile=default authentication=pap,chap,mschap2 disabled=no

# 3. NAT Masquerade for Internet Access
/ip firewall nat
add chain=srcnat out-interface=ether1 action=masquerade comment="SwiftStream WAN Internet NAT"

# 4. Enable WebFig Management Service (Port 80)
/ip service set www port=80 disabled=no
`;
};
