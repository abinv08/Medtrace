const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  handler: (response: RazorpayPaymentResponse) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}

interface RazorpayCheckout {
  open: () => void;
}

interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayCheckout;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<void> | null = null;

const loadRazorpayScript = (): Promise<void> => {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => window.Razorpay ? resolve() : reject(new Error('Razorpay Checkout did not initialize.'));
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout. Check your internet connection.'));
    document.body.appendChild(script);
  });
  return scriptPromise;
};

export interface RazorpayPaymentResult {
  paymentId: string;
  status: 'paid_unverified';
}

export const collectRazorpayPayment = async ({
  amountInRupees,
  patientName,
  email,
  phone,
}: {
  amountInRupees: number;
  patientName: string;
  email: string;
  phone: string;
}): Promise<RazorpayPaymentResult> => {
  const key = import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (!key) {
    throw new Error('Razorpay is not configured. Add VITE_RAZORPAY_KEY_ID to web/.env.local and restart the web app.');
  }
  if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
    throw new Error('Enter a payment amount greater than zero.');
  }

  await loadRazorpayScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay Checkout is unavailable.');

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };

    const checkout = new Razorpay({
      key,
      amount: Math.round(amountInRupees * 100),
      currency: 'INR',
      name: 'MedTrace',
      description: 'Patient registration payment',
      prefill: { name: patientName, email, contact: phone },
      theme: { color: '#1565C0' },
      handler: (response) => finish(() => resolve({
        paymentId: response.razorpay_payment_id,
        status: 'paid_unverified',
      })),
      modal: { ondismiss: () => finish(() => reject(new Error('Razorpay payment was cancelled.'))) },
    });
    checkout.open();
  });
};
