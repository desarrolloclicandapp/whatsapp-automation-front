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
    assert(source.includes("import AgencyAccountBundleCard from './AgencyAccountBundleCard'"), name);
    assert(source.includes('<AgencyAccountBundleCard token={token} onBuy={handlePurchase}'), name);
}

for (const locale of ['es.js', 'en.js']) {
    const source = fs.readFileSync(path.join(src, 'locales', locale), 'utf8');
    for (const key of ['sub.bundle.title', 'sub.bundle.description', 'sub.bundle.per_month']) {
        assert(source.includes(`"${key}"`), `${locale}: ${key}`);
    }
}

console.log('AGENCY_ACCOUNT_BUNDLE_PANEL=PASS');
