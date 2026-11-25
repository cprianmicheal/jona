import type { Order, StoreSettings } from '../types';

export const formatNaira = (amount: number, symbol = '₦'): string => {
  const formatted = Number(amount || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
};

const pdfEscape = (text: string): string =>
  text
    .replace(/₦/g, 'NGN ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const pdfCurrency = (amount: number): string =>
  `NGN ${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const downloadOrderInvoicePdf = (order: Order, settings: StoreSettings): void => {
  const lines: { text: string; size: number; bold?: boolean; gap?: number }[] = [
    { text: settings.storeName.toUpperCase(), size: 15, bold: true, gap: 18 },
    { text: `${settings.address}`, size: 9, gap: 13 },
    { text: `Phone / WhatsApp: ${settings.whatsappNumber}  |  Email: ${settings.supportEmail}`, size: 9, gap: 20 },
    { text: 'OFFICIAL INVOICE & PAYMENT RECEIPT', size: 13, bold: true, gap: 20 },
    { text: `Tracking Number: ${order.trackingNumber || order.orderNumber}`, size: 11, bold: true, gap: 15 },
    { text: `Order Reference: ${order.orderNumber}   |   Transaction Ref: ${order.transactionId}`, size: 9, gap: 14 },
    { text: `Date: ${new Date(order.createdAt).toLocaleString('en-NG')}   |   Status: ${order.paymentStatus} (${order.trackingStage})`, size: 9, gap: 20 },
    { text: 'CUSTOMER & DELIVERY DESTINATION', size: 10, bold: true, gap: 14 },
    { text: `Customer: ${order.customer.fullName}`, size: 9, gap: 13 },
    { text: `WhatsApp / Phone: ${order.customer.phone}   |   Email: ${order.customer.email}`, size: 9, gap: 13 },
    {
      text: `Location: ${order.customer.state || ''} State, ${order.customer.lga || ''} LGA`,
      size: 9,
      gap: 13,
    },
    { text: `Park / Delivery Point: ${order.customer.park || order.customer.city}`, size: 9, gap: 13 },
    { text: `Address / Landmark: ${order.customer.address}`, size: 9, gap: 20 },
    { text: 'ITEMIZED ORDER DETAILS', size: 10, bold: true, gap: 15 },
  ];

  for (const item of order.items) {
    lines.push({
      text: `- ${item.name} (${item.sku})  x${item.quantity}  @ ${pdfCurrency(item.unitPrice)}  =  ${pdfCurrency(item.lineTotal)}`,
      size: 9,
      gap: 13,
    });
  }

  lines.push({ text: '--------------------------------------------------------------------------', size: 9, gap: 14 });
  lines.push({ text: `Subtotal: ${pdfCurrency(order.subtotal)}`, size: 9, gap: 13 });
  if (order.discountAmount > 0) {
    lines.push({
      text: `Discount (${order.couponCode || 'Promo'}): -${pdfCurrency(order.discountAmount)}`,
      size: 9,
      gap: 13,
    });
  }
  lines.push({ text: `Delivery Fee: ${pdfCurrency(order.shippingFee)}`, size: 9, gap: 13 });
  if (order.taxAmount > 0) {
    lines.push({ text: `Tax: ${pdfCurrency(order.taxAmount)}`, size: 9, gap: 13 });
  }
  lines.push({ text: `TOTAL AMOUNT: ${pdfCurrency(order.totalAmount)}`, size: 12, bold: true, gap: 20 });

  lines.push({ text: 'BANK SETTLEMENT DETAILS', size: 10, bold: true, gap: 14 });
  lines.push({
    text: `Account 1: ${settings.bankDetails.bankName}  |  ${settings.bankDetails.accountName}  |  Acct #: ${settings.bankDetails.accountNumber}`,
    size: 9,
    gap: 13,
  });
  if (
    settings.secondaryBankDetails?.enabled !== false &&
    settings.secondaryBankDetails?.accountNumber?.trim()
  ) {
    lines.push({
      text: `Account 2: ${settings.secondaryBankDetails.bankName}  |  ${settings.secondaryBankDetails.accountName}  |  Acct #: ${settings.secondaryBankDetails.accountNumber}`,
      size: 9,
      gap: 13,
    });
  }
  lines.push({
    text: `Payment Method: ${order.paymentMethodName}   |   Receipt Uploaded: ${order.receiptUrl ? 'Yes' : 'Pending'}`,
    size: 9,
    gap: 18,
  });
  lines.push({
    text: `Track your order anytime using Tracking Code: ${order.trackingNumber || order.orderNumber}`,
    size: 9,
    bold: true,
    gap: 14,
  });

  let y = 785;
  const streamOps: string[] = ['BT'];
  for (const line of lines) {
    if (y < 50) break;
    const fontKey = line.bold ? '/F2' : '/F1';
    streamOps.push(`${fontKey} ${line.size} Tf`);
    streamOps.push(`1 0 0 1 48 ${y} Tm`);
    streamOps.push(`(${pdfEscape(line.text)}) Tj`);
    y -= line.gap || 14;
  }
  streamOps.push('ET');
  const streamContent = streamOps.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `6 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Emmystylez-Invoice-${order.trackingNumber || order.orderNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
