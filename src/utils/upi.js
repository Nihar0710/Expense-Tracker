/**
 * A UPI QR code / payment link looks like:
 * upi://pay?pa=merchant@bank&pn=Merchant%20Name&am=250.00&cu=INR&tn=Coffee
 *
 * pa = payee address (UPI ID)
 * pn = payee name
 * am = amount (optional — may be blank so the payer can type their own)
 * cu = currency (always INR)
 * tn = transaction note
 */

export function parseUpiUri(rawData) {
  if (!rawData || !rawData.startsWith('upi://')) {
    return null;
  }

  try {
    // Replace the custom scheme so the built-in URL parser can handle it.
    const url = new URL(rawData.replace('upi://', 'https://'));
    const params = url.searchParams;

    return {
      payeeAddress: params.get('pa') || '',
      payeeName: params.get('pn') || '',
      amount: params.get('am') || '',
      note: params.get('tn') || '',
      currency: params.get('cu') || 'INR',
    };
  } catch (err) {
    return null;
  }
}

export function buildUpiUri({ payeeAddress, payeeName, amount, note, currency = 'INR' }) {
  const params = new URLSearchParams();
  params.set('pa', payeeAddress);
  if (payeeName) params.set('pn', payeeName);
  if (amount) params.set('am', amount);
  params.set('cu', currency);
  if (note) params.set('tn', note);

  return `upi://pay?${params.toString()}`;
}

// Basic sanity check for a UPI ID like "name@bank"
export function isValidUpiId(value) {
  return /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(value);
}
