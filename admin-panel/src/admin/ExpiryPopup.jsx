import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Calendar, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function ExpiryPopup({ token }) {
    const [isOpen, setIsOpen] = useState(false);
    const [daysLeft, setDaysLeft] = useState(0);
    const [expiryDate, setExpiryDate] = useState(null);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                // 1. Check LocalStorage first (instant)
                const storedStatus = localStorage.getItem('subscriptionStatus');
                if (storedStatus) {
                    processStatus(JSON.parse(storedStatus));
                }

                // 2. Refresh from Server (background)
                if (token) {
                    const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");
                    const res = await fetch(`${API_URL}/payments/status`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.subscriptionStatus) {
                            localStorage.setItem('subscriptionStatus', JSON.stringify(data.subscriptionStatus));
                            localStorage.setItem('agencyFeatures', JSON.stringify(data.features));
                            processStatus(data.subscriptionStatus);
                        }
                    }
                }
            } catch (e) { console.error("Error checking expiry:", e); }
        };

        checkStatus();
    }, [token]);

    const processStatus = (status) => {
        if (!status?.cancelAtPeriodEnd || !status?.currentPeriodEnd) return;

        const end = new Date(status.currentPeriodEnd);
        const now = new Date();
        const diffTime = end - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        setExpiryDate(end);
        setDaysLeft(diffDays);

        // Show only if within 7 days of expiry
        if (diffDays <= 7 && diffDays >= 0) {
            // Check if user already dismissed it today
            const dismissed = localStorage.getItem('expiryPopupDismissed');
            const today = new Date().toDateString();
            
            if (dismissed !== today) {
                setIsOpen(true);
            }
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        // Remember dismissal for today
        localStorage.setItem('expiryPopupDismissed', new Date().toDateString());
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl border border-amber-200 dark:border-amber-900 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-300">
                <div className="bg-amber-50 dark:bg-amber-900/20 p-6 flex flex-col items-center text-center relative">
                    <button 
                        onClick={handleClose} 
                        className="absolute right-4 top-4 p-2 bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 rounded-full transition-colors text-gray-500"
                    >
                        <X size={16} />
                    </button>

                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center mb-4 text-amber-600 shadow-sm animate-pulse">
                        <AlertTriangle size={32} />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        Tu plan vence pronto
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 leading-relaxed">
                        Tienes programada la cancelación de tu suscripción. 
                        Tu acceso se perderá en <span className="font-bold text-amber-600 dark:text-amber-400">{daysLeft} días</span> ({expiryDate?.toLocaleDateString()}).
                    </p>

                    <div className="flex gap-3 w-full">
                         <button 
                            onClick={() => window.location.href = '?tab=billing'}
                            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            <Calendar size={18} /> Reactivar Plan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
