export const DEFAULT_BRAND_LOGO_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none'%3E%3Cdefs%3E%3ClinearGradient id='swiftBrandGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2306b6d4'/%3E%3Cstop offset='50%25' stop-color='%230ea5e9'/%3E%3Cstop offset='100%25' stop-color='%232563eb'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='16' fill='url(%23swiftBrandGrad)'/%3E%3Crect x='1.5' y='1.5' width='61' height='61' rx='14.5' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'/%3E%3Cg stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round' transform='translate(8, 8)'%3E%3Ccircle cx='24' cy='24' r='4.5' fill='%23ffffff' stroke='none'/%3E%3Cpath d='M15.6 15.6a12 12 0 0 0 0 16.8'/%3E%3Cpath d='M32.4 15.6a12 12 0 0 1 0 16.8'/%3E%3Cpath d='M9.8 9.8a20 20 0 0 0 0 28.4'/%3E%3Cpath d='M38.2 9.8a20 20 0 0 1 0 28.4'/%3E%3C/g%3E%3C/svg%3E`;

/**
 * Dynamically updates the browser favicon and document title
 * to match the Company Brand Logo and Business Name.
 */
export const updateBrowserBrandIdentity = (
  logoUrl?: string,
  tradeName?: string,
  companyName?: string
) => {
  const activeLogo = logoUrl && logoUrl.trim().length > 0 ? logoUrl : '/favicon.svg';

  // Update or create primary favicon link
  let iconLink = document.getElementById('dynamic-favicon') as HTMLLinkElement | null;
  if (!iconLink) {
    iconLink = document.querySelector("link[rel~='icon']");
  }
  if (!iconLink) {
    iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    iconLink.id = 'dynamic-favicon';
    document.head.appendChild(iconLink);
  }

  iconLink.href = activeLogo;
  if (activeLogo.startsWith('data:image/svg') || activeLogo.endsWith('.svg')) {
    iconLink.type = 'image/svg+xml';
  } else if (activeLogo.startsWith('data:image/png') || activeLogo.endsWith('.png')) {
    iconLink.type = 'image/png';
  } else if (
    activeLogo.startsWith('data:image/jpeg') ||
    activeLogo.startsWith('data:image/jpg') ||
    activeLogo.endsWith('.jpg') ||
    activeLogo.endsWith('.jpeg')
  ) {
    iconLink.type = 'image/jpeg';
  } else if (activeLogo.startsWith('data:image/webp') || activeLogo.endsWith('.webp')) {
    iconLink.type = 'image/webp';
  }

  // Update or create apple-touch-icon
  let appleLink = document.getElementById('dynamic-apple-icon') as HTMLLinkElement | null;
  if (!appleLink) {
    appleLink = document.querySelector("link[rel='apple-touch-icon']");
  }
  if (!appleLink) {
    appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    appleLink.id = 'dynamic-apple-icon';
    document.head.appendChild(appleLink);
  }
  appleLink.href = activeLogo;

  // Keep document title synchronized with trade name / brand identity
  const brandName = tradeName || companyName || 'SwiftStream Telecommunications';
  document.title = `${brandName} | Fiber Internet & Billing`;
};

