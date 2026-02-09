import React, { useEffect, useMemo, useState } from 'react';
import { Check, LogOut, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { PLANS_STANDARD, PLANS_FOUNDER, PLANS_VOLUME, PLAN_LIFETIME } from './constants/plans';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

export default function SubscriptionBlocker({ token, onLogout, accountInfo }) {
    const { t } = useLanguage();
    const [loadingPlan, setLoadingPlan] = useState(null);
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'
    const [hasLifetime, setHasLifetime] = useState(false);
    const [loadingCatalog, setLoadingCatalog] = useState(true);

    const tText = (key, fallback) => {
        const value = t(key);
        return value === key ? fallback : value;
    };

    useEffect(() => {
        let isMounted = true;

        const fetchSubscriptions = async () => {
            setLoadingCatalog(true);
            try {
                const res = await fetch(`${API_URL}/payments/my-subscriptions`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) {
                    if (isMounted) setHasLifetime(false);
                    return;
                }

                const data = await res.json();
                if (!isMounted || !Array.isArray(data)) return;

                const lifetime = data.some(sub => sub?.stripe_price_id === PLAN_LIFETIME.id);
                setHasLifetime(lifetime);
            } catch {
                // Keep safe fallback to standard catalog if fetch fails.
                if (isMounted) setHasLifetime(false);
            } finally {
                if (isMounted) setLoadingCatalog(false);
            }
        };

        fetchSubscriptions();
        return () => {
            isMounted = false;
        };
    }, [token]);

    const availablePlans = useMemo(() => {
        const totalSubs = accountInfo?.limits?.max_subagencies || 0;
        const isVolumeUser = totalSubs >= 10 && !hasLifetime;

        if (hasLifetime) return PLANS_FOUNDER;
        if (isVolumeUser) return PLANS_VOLUME;
        return PLANS_STANDARD;
    }, [accountInfo, hasLifetime]);

    const handlePurchase = async (priceId) => {
        setLoadingPlan(priceId);
        try {
            const res = await fetch(`${API_URL}/payments/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ priceId })
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else alert(`Error: ${data.error || tText('sub.toast.error_unknown', 'Unknown error')}`);
        } catch {
            alert(tText('sub.toast.error_connection', 'Connection error'));
        } finally {
            setLoadingPlan(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-gray-900 flex flex-col items-center justify-center p-4 overflow-y-auto">
            <div className="max-w-6xl w-full space-y-10 py-10">
                {/* HEADER */}
                <div className="text-center space-y-4">
                    <div className="mx-auto w-20 h-20 bg-amber-500/20 text-amber-500 rounded-3xl flex items-center justify-center animate-bounce">
                        <AlertTriangle size={40} />
                    </div>
                    <h2 className="text-4xl font-black text-white">
                        {tText('sub.blocker.title', 'Your access has expired')}
                    </h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        {tText('sub.blocker.desc', 'Select a plan to reactivate your account now. Your devices and settings will stay intact.')}
                    </p>
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 mx-auto px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10"
                    >
                        <LogOut size={18} /> {tText('dash.nav.logout', 'Logout')}
                    </button>
                </div>

                {/* BILLING TOGGLE */}
                <div className="flex justify-center">
                    <div className="bg-gray-800 p-1 rounded-xl flex items-center relative border border-gray-700">
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all z-10 ${billingCycle === 'monthly' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            {tText('sub.billing.monthly', 'Monthly')}
                        </button>
                        <button
                            onClick={() => setBillingCycle('annual')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all z-10 flex items-center gap-2 ${billingCycle === 'annual' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            {tText('sub.billing.annual', 'Annual')}
                            <span className="bg-green-500/20 text-green-400 text-[10px] px-1.5 rounded-full border border-green-500/30">
                                {tText('sub.billing.savings', '-20%')}
                            </span>
                        </button>
                    </div>
                </div>

                {/* PLANS GRID */}
                {loadingCatalog ? (
                    <div className="flex items-center justify-center py-16 text-gray-400">
                        <Loader2 size={22} className="animate-spin mr-2" />
                        <span>{tText('common.loading', 'Loading...')}</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {availablePlans.map((plan) => {
                            const isAnnual = billingCycle === 'annual';
                            const effectivePrice = isAnnual ? (plan.annualPrice || plan.price) : plan.price;
                            const effectiveId = isAnnual ? (plan.annualId || plan.id) : plan.id;
                            const savings = isAnnual && plan.annualId ? tText('sub.billing.save_text', 'Save ~20%') : null;

                            return (
                                <div key={plan.id} className={`relative flex flex-col p-8 rounded-[2.5rem] border-2 transition-all ${plan.recommended ? 'border-indigo-500 bg-indigo-500/10 shadow-2xl shadow-indigo-500/20' : 'border-white/10 bg-white/5 text-white hover:border-white/20'}`}>
                                    {plan.recommended && (
                                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-lg">
                                            <Sparkles size={12} fill="currentColor" /> {tText('sub.badge.popular', 'Popular')}
                                        </span>
                                    )}
                                    <div className="mb-6">
                                        <h3 className="text-2xl font-bold text-white">{tText(plan.nameKey, 'Plan')}</h3>
                                        <p className="text-gray-400 mt-1 text-sm min-h-[40px]">
                                            {plan.limits?.subs} {tText('sub.services.agencies', 'Agencies')}
                                        </p>
                                    </div>
                                    <div className="mb-8">
                                        <span className="text-5xl font-black text-white">{effectivePrice}</span>
                                        <span className="text-gray-400 font-medium ml-2">{isAnnual ? tText('sub.plan.year', '/yr') : tText('sub.plan.month', '/mo')}</span>
                                        {savings && (
                                            <div className="text-green-400 text-xs font-bold mt-2 bg-green-900/30 inline-block px-2 py-1 rounded">
                                                {savings}
                                            </div>
                                        )}
                                    </div>
                                    <ul className="space-y-4 mb-10 flex-1">
                                        {plan.featureKeys.map((featKey, i) => (
                                            <li key={i} className="flex items-start gap-3 text-gray-300 text-sm">
                                                <Check size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                                                <span className="leading-snug">{tText(featKey, featKey)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        onClick={() => handlePurchase(effectiveId)}
                                        disabled={loadingPlan !== null}
                                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 transform active:scale-95
                                            ${plan.recommended
                                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50'
                                                : 'bg-white text-gray-900 hover:bg-gray-200'}
                                        `}
                                    >
                                        {loadingPlan === effectiveId ? <Loader2 className="animate-spin" /> : tText('common.reactivate', 'Reactivate')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
