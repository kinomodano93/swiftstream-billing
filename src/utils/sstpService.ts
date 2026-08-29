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
 * Generates RouterOS Walled Garden & Overdue Non-Payment Isolation Script
 */
export const generateIsolationScript = (customers: Customer[]): string => {
  const overdueCustomers = customers.filter(
    (c) => c.status === 'overdue' || c.status === 'suspended' || c.status === 'disconnected'
  );

  let script = `# =========================================================
# SwiftStream Non-Payment Firewall Isolation & Walled Garden
# Overdue / Suspended Subscribers: ${overdueCustomers.length}
# =========================================================

# Step 1: Ensure Isolation Address List exists
/ip firewall address-list remove [find list="NON_PAYMENT_ISOLATION"]

`;

  if (overdueCustomers.length === 0) {
    script += `# No subscribers currently overdue or suspended. All lines active.\n`;
  } else {
    overdueCustomers.forEach((cust) => {
      script += `/ip firewall address-list add list="NON_PAYMENT_ISOLATION" address=${cust.network.ipAddress} comment="${cust.fullName} - Bal: P${cust.balance} (${cust.status.toUpperCase()})"\n`;
    });
  }

  script += `
# Step 2: Firewall NAT Rule to Redirect HTTP Web Traffic to SwiftStream Portal
/ip firewall nat
add chain=dstnat src-address-list="NON_PAYMENT_ISOLATION" protocol=tcp dst-port=80 action=redirect to-ports=8080 comment="SwiftStream Non-Payment Captive Portal Redirect"
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
