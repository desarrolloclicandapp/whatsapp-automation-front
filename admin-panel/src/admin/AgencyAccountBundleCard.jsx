import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API_URL = (import.meta.env.VITE_API_URL || 'https://wa.waflow.ai').replace(/\/$/, '');

export default function AgencyAccountBundleCard({ token, onBuy, disabled = false, refreshKey = 0 }) {
    const { t } = useLanguage();
    const [offer, setOffer] = useState(null);

    useEffect(() => {
        if (!token) return undefined;
        const controller = new AbortController();
        fetch(`${API_URL}/payments/account-bundle-offer`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
        })
            .then((response) => response.ok ? response.json() : null)
            .then((result) => { if (!controller.signal.aborted) setOffer(result); })
            .catch(() => { if (!controller.signal.aborted) setOffer(null); });
        return () => controller.abort();
    }, [token, refreshKey]);

    if (!offer?.available || !offer.priceId) return null;

    const amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: offer.currency || 'USD',
        maximumFractionDigits: 0
    }).format((offer.amount || 0) / 100);

    return (
        <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800 p-6 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl"><Building2 size={24} /></div>
                <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">{t('sub.bundle.title')}</h4>
                    <p className="text-xs text-gray-500">{t('sub.bundle.description')}</p>
                </div>
            </div>
            <div className="text-right shrink-0">
                <p className="text-xl font-bold text-gray-900 dark:text-white">{amount}<span className="text-xs font-normal">{t('sub.bundle.per_month')}</span></p>
                <button disabled={disabled} onClick={() => onBuy(offer.priceId, t('sub.bundle.title'), amount)} className="text-sm font-bold text-indigo-600 hover:underline disabled:opacity-50">{t('sub.bundle.buy')}</button>
            </div>
        </div>
    );
}
