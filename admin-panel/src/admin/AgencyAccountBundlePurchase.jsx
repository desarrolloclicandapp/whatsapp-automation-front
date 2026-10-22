import React, { useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';
import AgencyAccountBundleCard from './AgencyAccountBundleCard';

const API_URL = (import.meta.env.VITE_API_URL || 'https://wa.waflow.ai').replace(/\/$/, '');
const publicKey = String(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '').trim();
const stripePromise = publicKey ? loadStripe(publicKey) : null;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function AgencyAccountBundlePurchase({ token, onPaid, disabled = false }) {
    const { t } = useLanguage();
    const [offer, setOffer] = useState(null);
    const [card, setCard] = useState(null);
    const [busy, setBusy] = useState(false);
    const [fallbackUrl, setFallbackUrl] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const attempt = useRef(null);
    const inFlight = useRef(false);

    const request = async (path, options = {}) => {
        const response = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.body ? { 'Content-Type': 'application/json' } : {})
            }
        });
        const data = await response.json();
        if (!response.ok) throw Object.assign(new Error(data.error || t('sub.bundle.payment_error')), {
            code: data.errorCode
        });
        return data;
    };

    const open = async (priceId, name, price) => {
        if (disabled || inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        try {
            const methods = await request('/payments/payment-methods');
            setCard(Array.isArray(methods) ? methods[0] || null : null);
            setOffer({ priceId, name, price });
            setFallbackUrl(null);
            attempt.current = crypto.randomUUID();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBusy(false);
            inFlight.current = false;
        }
    };

    const waitForPaidInvoice = async (subscriptionId) => {
        for (let index = 0; index < 30; index += 1) {
            try {
                const subscriptions = await request('/payments/my-subscriptions');
                if (Array.isArray(subscriptions) && subscriptions.some((sub) =>
                    sub.stripe_subscription_id === subscriptionId &&
                    sub.status === 'active' && sub.suspension_status !== 'suspended')) {
                    setOffer(null);
                    setRefreshKey((value) => value + 1);
                    await onPaid?.();
                    toast.success(t('sub.bundle.paid'));
                    return;
                }
            } catch {
                // A transient API error must not be mistaken for a failed payment.
            }
            await pause(2000);
        }
        toast.info(t('sub.bundle.pending'));
    };

    const checkout = async () => {
        const data = await request('/payments/subscribe', {
            method: 'POST',
            body: JSON.stringify({ priceId: offer.priceId })
        });
        if (!data.url) throw new Error(data.error || t('sub.bundle.payment_error'));
        window.location.assign(data.url);
    };

    const confirm = async () => {
        if (!offer || inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        try {
            if (!card) {
                await checkout();
                return;
            }
            const data = await request('/payments/subscribe-direct', {
                method: 'POST',
                body: JSON.stringify({
                    priceId: offer.priceId,
                    paymentMethodId: card.id,
                    purchaseAttemptId: attempt.current
                })
            });
            if (data.error) {
                setFallbackUrl(data.url || null);
                throw new Error(`${data.errorCode ? `${data.errorCode}: ` : ''}${data.error}`);
            }
            if (data.url) {
                window.location.assign(data.url);
                return;
            }
            if (data.requiresAction) {
                const stripe = await stripePromise;
                if (!stripe || !data.clientSecret) throw new Error(t('sub.bundle.payment_error'));
                const result = await stripe.confirmCardPayment(data.clientSecret);
                if (result.error) throw new Error(result.error.message || t('sub.bundle.payment_error'));
                if (result.paymentIntent?.status !== 'succeeded') {
                    throw new Error(t('sub.bundle.pending'));
                }
            }
            if (!data.subscriptionId) throw new Error(t('sub.bundle.payment_error'));
            await waitForPaidInvoice(data.subscriptionId);
        } catch (error) {
            toast.error(error.message || t('sub.bundle.payment_error'));
        } finally {
            setBusy(false);
            inFlight.current = false;
        }
    };

    return <>
        <AgencyAccountBundleCard token={token} onBuy={open} disabled={disabled || busy} refreshKey={refreshKey} />
        {offer && <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4">
            <div role="dialog" aria-modal="true" aria-label={t('sub.bundle.confirm_title')} className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl text-gray-900 dark:text-white">
                <h3 className="text-xl font-bold mb-4">{t('sub.bundle.confirm_title')}</h3>
                <p className="mb-2">{offer.name}: <strong>{offer.price}{t('sub.bundle.per_month')}</strong></p>
                <p className="mb-2">{t('sub.bundle.renews')}</p>
                <p className="mb-2">{card ? `${card.brand?.toUpperCase() || 'Card'} •••• ${card.last4}` : t('sub.bundle.checkout_card')}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">{t('sub.bundle.cancel_anytime')}</p>
                <div className="flex gap-3">
                    <button type="button" disabled={busy} onClick={() => { setOffer(null); setFallbackUrl(null); }} className="flex-1 rounded-xl border px-4 py-3 disabled:opacity-50">{t('sub.confirm.cancel_btn')}</button>
                    <button type="button" disabled={busy} onClick={confirm} className="flex-1 rounded-xl bg-indigo-600 text-white px-4 py-3 disabled:opacity-50">{busy ? t('sub.confirm.processing') : card ? t('sub.bundle.confirm_pay') : t('sub.bundle.checkout')}</button>
                </div>
                {fallbackUrl && <a className="block mt-4 text-center text-indigo-600 underline" href={fallbackUrl}>{t('sub.bundle.pay_existing_invoice')}</a>}
            </div>
        </div>}
    </>;
}
