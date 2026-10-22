import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const card = fs.readFileSync(path.join(src, 'admin', 'AgencyAccountBundleCard.jsx'), 'utf8');
assert(card.includes('/payments/account-bundle-offer'));
assert(card.includes('offer?.available'));
assert(card.includes('onBuy(offer.priceId'));
assert(!card.includes('price_'), 'the panel must use the price selected by the API');

for (const name of ['SubscriptionManager.jsx', 'SubscriptionManagerNext.jsx', 'SubscriptionModal.jsx']) {
    const source = fs.readFileSync(path.join(src, 'admin', name), 'utf8');
    assert(source.includes("import AgencyAccountBundlePurchase from './AgencyAccountBundlePurchase'"), name);
    assert(source.includes('<AgencyAccountBundlePurchase token={token}'), name);
}

const purchase = fs.readFileSync(path.join(src, 'admin', 'AgencyAccountBundlePurchase.jsx'), 'utf8');
assert(purchase.includes('/payments/payment-methods'), 'saved card must be displayed before confirming');
assert(purchase.includes('onClick={confirm}'), 'payment starts only after confirmation');
assert(purchase.includes('purchaseAttemptId: attempt.current'), 'repeated clicks reuse one attempt');
assert(purchase.includes('stripe.confirmCardPayment(data.clientSecret)'), '3DS must be completed in Stripe.js');
assert(purchase.includes('waitForPaidInvoice(data.subscriptionId)'), 'do not grant capacity before the paid webhook');
assert(purchase.includes('/payments/subscribe'), 'Checkout remains available without a saved card');

for (const locale of ['es.js', 'en.js']) {
    const source = fs.readFileSync(path.join(src, 'locales', locale), 'utf8');
    for (const key of ['sub.bundle.title', 'sub.bundle.description', 'sub.bundle.per_month']) {
        assert(source.includes(`"${key}"`), `${locale}: ${key}`);
    }
}

console.log('AGENCY_ACCOUNT_BUNDLE_PANEL=PASS');
