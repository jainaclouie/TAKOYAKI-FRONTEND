import type { PaymentMethod } from '../api/types';

const pesoFmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export const peso = (n: number): string => pesoFmt.format(n);

export const qty = (n: number, maxDecimals = 3): string =>
  new Intl.NumberFormat('en-PH', { maximumFractionDigits: maxDecimals }).format(n);

export const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export const shortDate = (isoDate: string): string =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** Local (not UTC) calendar date as YYYY-MM-DD. */
export const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const todayISO = (): string => toISODate(new Date());

export const monthStartISO = (): string => {
  const d = new Date();
  d.setDate(1);
  return toISODate(d);
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  other: 'Other',
};

export const MOVEMENT_LABEL: Record<string, string> = {
  purchase: 'Purchase',
  usage: 'Used in order',
  adjustment: 'Stock count',
  waste: 'Waste',
  void_return: 'Returned (voided order)',
  opening: 'Opening stock',
};

export const BUSINESS_NAME: string = import.meta.env.VITE_BUSINESS_NAME ?? 'Takoyaki Stall';
