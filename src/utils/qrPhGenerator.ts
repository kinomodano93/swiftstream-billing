/**
 * EMVCo / BSP QR Ph Compliant Dynamic QR Code Payload Generator
 * Conforms to Bangko Sentral ng Pilipinas (BSP) National QR Standard (QR Ph)
 * Interoperable across GCash, Maya, BDO, BPI, SeaBank, UnionBank, GoTyme, and ShopeePay.
 */

// Helper to format TLV (Tag-Length-Value)
const formatTLV = (tag: string, value: string): string => {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
};

// CRC16-CCITT (polynomial 0x1021, initial value 0xFFFF)
const calculateCRC16 = (payload: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

export interface QrPhPayloadOptions {
  merchantName: string;
  merchantCity: string;
  accountNumber: string;
  amount: number;
  invoiceNumber?: string;
  mobileNumber?: string;
  serviceProvider?: 'gcash' | 'maya' | 'qrph_national' | 'bdo';
}

export const generateDynamicQrPhPayload = (options: QrPhPayloadOptions): string => {
  const {
    merchantName = 'SWIFTSTREAM TELECOM',
    merchantCity = 'LAGONOY',
    accountNumber,
    amount,
    invoiceNumber = 'BILL-2026',
    mobileNumber = '09624171684',
    serviceProvider = 'qrph_national',
  } = options;

  const sanitizedMerchantName = merchantName.toUpperCase().slice(0, 25);
  const sanitizedCity = merchantCity.toUpperCase().slice(0, 15);
  const formattedAmount = amount > 0 ? amount.toFixed(2) : '';

  let payload = '';

  // 00: Payload Format Indicator
  payload += formatTLV('00', '01');

  // 01: Point of Initiation Method ('12' = Dynamic QR with amount, '11' = Static)
  payload += formatTLV('01', formattedAmount ? '12' : '11');

  // 26: Merchant Account Information - QR Ph National Switch / BancNet
  const subMerchantId = formatTLV('00', 'ph.gov.bsp.qrph');
  const subAccountId = formatTLV('01', accountNumber || 'ACC-26-0000');
  const subMobileId = formatTLV('02', mobileNumber.replace(/[^0-9]/g, ''));
  payload += formatTLV('26', `${subMerchantId}${subAccountId}${subMobileId}`);

  // 52: Merchant Category Code ('4814' = Telecommunications / ISPs)
  payload += formatTLV('52', '4814');

  // 53: Transaction Currency ('608' = Philippine Peso PHP)
  payload += formatTLV('53', '608');

  // 54: Transaction Amount
  if (formattedAmount) {
    payload += formatTLV('54', formattedAmount);
  }

  // 58: Country Code ('PH')
  payload += formatTLV('58', 'PH');

  // 59: Merchant Name
  payload += formatTLV('59', sanitizedMerchantName);

  // 60: Merchant City
  payload += formatTLV('60', sanitizedCity);

  // 62: Additional Data Field (Bill/Invoice Reference)
  const refSub = formatTLV('01', invoiceNumber.slice(0, 25));
  const custSub = formatTLV('07', accountNumber.slice(0, 25));
  payload += formatTLV('62', `${refSub}${custSub}`);

  // 63: CRC16 Placeholder
  const payloadWithChecksumTag = `${payload}6304`;
  const checksum = calculateCRC16(payloadWithChecksumTag);

  return `${payloadWithChecksumTag}${checksum}`;
};

