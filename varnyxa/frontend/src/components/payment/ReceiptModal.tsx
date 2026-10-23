import React from 'react';
import { X, Printer, Download, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import { formatPrice, formatDate } from '../../utils/formatters';

export interface ReceiptData {
  isDemo: boolean;
  orderNumber: string;
  orderId?: string;
  paymentReference: string;
  paymentMethod: string;
  paymentGateway: string;
  transactionId?: string | null;
  bankRrn?: string | null;
  paidAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: {
    full_name?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    phone?: string | null;
    [key: string]: any;
  } | null;
  items: Array<{
    product_title: string;
    size?: string;
    color_name?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  subtotal: number;
  discountAmount?: number;
  couponCode?: string | null;
  shippingFee: number;
  taxAmount: number;
  taxRate?: number;
  totalAmount: number;
  currency?: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptData;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, receipt }) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTextReceipt = () => {
    const lines = [
      '================================================================',
      '                 VARNYXA HAUTE COUTURE ATELIER',
      '             ' + (receipt.isDemo ? 'DEMONSTRATION PAYMENT RECEIPT' : 'OFFICIAL TAX INVOICE'),
      '================================================================',
      `Order Number:       ${receipt.orderNumber}`,
      `Date & Time:        ${new Date(receipt.paidAt).toLocaleString('en-IN')}`,
      `Reference ID:       ${receipt.paymentReference}`,
      `Payment Rails:      ${receipt.paymentGateway} (${receipt.paymentMethod})`,
      `Status:             ${receipt.isDemo ? 'DEMO COMPLETED' : 'CAPTURED / CONFIRMED'}`,
      '----------------------------------------------------------------',
      `Customer:           ${receipt.customerName}`,
      `Email:              ${receipt.customerEmail}`,
      `Phone:              ${receipt.customerPhone || 'N/A'}`,
      '----------------------------------------------------------------',
      'ITEMS IN THIS EDITION:',
      ...receipt.items.map((it) => 
        `- ${it.product_title} (${it.size || 'Std'}/${it.color_name || 'Std'}) x${it.quantity} @ Rs.${it.unit_price} = Rs.${it.total_price}`
      ),
      '----------------------------------------------------------------',
      `Subtotal:           Rs.${receipt.subtotal}`,
      receipt.discountAmount ? `Coupon Discount:   -Rs.${receipt.discountAmount}` : '',
      `Shipping Fee:       Rs.${receipt.shippingFee}`,
      `GST (${receipt.taxRate ?? 18}%):         Rs.${receipt.taxAmount}`,
      '================================================================',
      `TOTAL PAYABLE:      Rs.${receipt.totalAmount}`,
      '================================================================',
      receipt.isDemo ? 'Note: Demo transaction for UI evaluation. No actual charge.' : 'Note: Official computer generated tax invoice. GSTIN: 29AABCU9603R1ZM',
    ].filter(Boolean).join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VARNYXA-Receipt-${receipt.orderNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isDemo = receipt.isDemo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      {/* Container */}
      <div className="relative w-full max-w-2xl bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] rounded-3xl shadow-2xl overflow-hidden my-auto print:border-none print:shadow-none print:max-w-none print:rounded-none">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--theme-border)] bg-[var(--theme-surface-alt)] print:hidden">
          <div className="flex items-center gap-2">
            {isDemo ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Demo Receipt Verified</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Official Tax Invoice</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTextReceipt}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--theme-border)] hover:bg-[var(--theme-surface)] transition cursor-pointer"
              title="Download Text Receipt"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .txt</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] hover:opacity-90 transition cursor-pointer shadow-sm"
              title="Print or Save PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface)] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div id="varnyxa-receipt-print" className="p-6 sm:p-10 space-y-6 text-xs bg-[var(--theme-surface)] text-[var(--theme-text)]">
          
          {/* Demo Subheading Banner (clean and non-distracting) */}
          {isDemo && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-center space-y-0.5">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-800 dark:text-slate-200 block">
                Seamless UPI Demo Receipt • Ref: {receipt.paymentReference}
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Scannable Payload: VARNYXA-DEMO-TRANSACTION-12345 • Mode: Instant UPI Simulation
              </p>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[var(--theme-border)]">
            <div className="space-y-1">
              <h1 className="font-serif text-2xl sm:text-3xl font-extrabold tracking-wider text-[var(--theme-text)]">
                VARNYXA
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-[var(--theme-text-muted)] font-bold">
                Inclusive Haute Couture Atelier
              </p>
              <p className="text-[10px] text-[var(--theme-text-muted)] pt-1">
                VARNYXA Couture Pvt. Ltd. • GSTIN: 29AABCU9603R1ZM
              </p>
              <p className="text-[10px] text-[var(--theme-text-muted)]">
                Concierge: concierge@varnyxa.com • www.varnyxa.com
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="inline-block px-3 py-1 bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] rounded-lg font-mono text-[11px] font-bold text-[var(--theme-text)]">
                {isDemo ? 'DEMO-RECEIPT' : 'TAX INVOICE'}
              </div>
              <p className="font-mono text-xs font-bold text-[var(--theme-primary)] pt-1">
                Order #{receipt.orderNumber}
              </p>
              <p className="text-[11px] text-[var(--theme-text-muted)]">
                Date: {formatDate(receipt.paidAt)}
              </p>
              <p className="text-[10px] font-mono text-[var(--theme-text-muted)]">
                Ref: {receipt.paymentReference}
              </p>
            </div>
          </div>

          {/* Customer & Gateway Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-[var(--theme-border)]">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)] block">
                Billed & Shipped To:
              </span>
              <p className="font-bold text-[var(--theme-text)]">{receipt.customerName}</p>
              {receipt.shippingAddress && (
                <div className="text-[var(--theme-text-muted)] text-[11px] space-y-0.5 leading-relaxed">
                  <p>{receipt.shippingAddress.address_line1}</p>
                  {receipt.shippingAddress.address_line2 && <p>{receipt.shippingAddress.address_line2}</p>}
                  <p>{receipt.shippingAddress.city}, {receipt.shippingAddress.state} - {receipt.shippingAddress.postal_code}</p>
                </div>
              )}
              <p className="text-[11px] text-[var(--theme-text-muted)] font-mono pt-0.5">
                {receipt.customerEmail} {receipt.customerPhone ? `• ${receipt.customerPhone}` : ''}
              </p>
            </div>

            <div className="space-y-1 sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)] block">
                Payment Verification:
              </span>
              <p className="font-bold text-[var(--theme-text)]">
                {receipt.paymentGateway} • {receipt.paymentMethod}
              </p>
              {receipt.transactionId && (
                <p className="font-mono text-[11px] text-[var(--theme-text-muted)]">
                  Gateway Txn ID: {receipt.transactionId}
                </p>
              )}
              {receipt.bankRrn && (
                <p className="font-mono text-[11px] text-[var(--theme-text-muted)]">
                  Bank RRN: {receipt.bankRrn}
                </p>
              )}
              <div className="pt-1">
                <span className="inline-block px-2.5 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Status: {isDemo ? 'DEMO COMPLETED' : 'CAPTURED / CONFIRMED'}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)] block">
              Garments & Editions Summary:
            </span>
            <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[var(--theme-surface-alt)] border-b border-[var(--theme-border)] text-[10px] font-bold uppercase text-[var(--theme-text-muted)]">
                  <tr>
                    <th className="py-2.5 px-3">Garment Description</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--theme-border)]/60 text-xs">
                  {receipt.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[var(--theme-surface-alt)]/30">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-[var(--theme-text)]">{item.product_title}</span>
                        {(item.size || item.color_name) && (
                          <span className="text-[10px] text-[var(--theme-text-muted)] block">
                            Size: {item.size} • Color: {item.color_name}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatPrice(item.unit_price)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[var(--theme-text)] font-mono">
                        {formatPrice(item.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 border-t border-[var(--theme-border)]">
            <div className="text-[10px] text-[var(--theme-text-muted)] space-y-1 max-w-xs">
              <p className="font-semibold text-[var(--theme-text)]">Tax Notes & Delivery:</p>
              <p>Prices are inclusive of Indian Goods & Services Tax (GST) as per applicable council brackets.</p>
              <div className="flex items-center gap-1.5 pt-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>VARNYXA Quality & Authenticity Guarantee</span>
              </div>
            </div>

            <div className="w-full sm:w-64 space-y-1.5 text-xs text-[var(--theme-text)]">
              <div className="flex justify-between">
                <span className="text-[var(--theme-text-muted)]">Subtotal</span>
                <span className="font-mono">{formatPrice(receipt.subtotal)}</span>
              </div>
              {Boolean(receipt.discountAmount && receipt.discountAmount > 0) && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Coupon {receipt.couponCode ? `(${receipt.couponCode})` : ''}</span>
                  <span className="font-mono">-{formatPrice(receipt.discountAmount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--theme-text-muted)]">
                <span>Shipping Charges</span>
                <span className="font-mono">
                  {receipt.shippingFee === 0 ? 'FREE' : formatPrice(receipt.shippingFee)}
                </span>
              </div>
              <div className="flex justify-between text-[var(--theme-text-muted)]">
                <span>GST ({receipt.taxRate ?? 18}%)</span>
                <span className="font-mono">{formatPrice(receipt.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-[var(--theme-text)] pt-2 border-t border-[var(--theme-border)]">
                <span>Total {isDemo ? 'Simulated' : 'Paid'}</span>
                <span className="text-[var(--theme-primary)] font-mono">
                  {formatPrice(receipt.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="pt-6 border-t border-[var(--theme-border)] text-center text-[10px] text-[var(--theme-text-muted)] space-y-1">
            <p className="font-semibold">
              Thank you for choosing VARNYXA Haute Couture.
            </p>
            <p>
              For alteration requests, bespoke concierge services, or inquiries, present this invoice number to concierge@varnyxa.com.
            </p>
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden when printing) */}
        <div className="px-6 py-4 border-t border-[var(--theme-border)] bg-[var(--theme-surface-alt)] flex items-center justify-between print:hidden">
          <p className="text-[11px] text-[var(--theme-text-muted)]">
            {isDemo ? 'Demonstration view only' : 'Official VAT/GST tax invoice'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download / Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[var(--theme-border)] rounded-xl text-xs font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-surface)] transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
