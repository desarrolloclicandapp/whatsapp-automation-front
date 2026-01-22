import React from 'react';
import { Lock, CreditCard } from 'lucide-react';
import SubscriptionModal from './SubscriptionModal';
import { useLanguage } from '../context/LanguageContext';

const InactiveUserModal = ({ show, onLogout }) => {
    const { t } = useLanguage();
    const [showPay, setShowPay] = React.useState(false);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
            {showPay ? (
                <SubscriptionModal 
                    isOpen={true} 
                    onClose={() => setShowPay(false)} // Permite cerrar para volver al bloqueo
                    isUpgrade={true} // Forzamos modo upgrade
                />
            ) : (
                <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                    
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 dark:text-red-500">
                        <Lock size={40} />
                    </div>

                    <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
                        {t('modal.inactive.title')}
                    </h2>
                    
                    <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg leading-relaxed">
                        {t('modal.inactive.desc')}
                    </p>

                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => setShowPay(true)}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-indigo-500/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
                        >
                            <CreditCard size={24} />
                            {t('modal.inactive.cta_reactivate')}
                        </button>
                        
                        <button 
                            onClick={onLogout}
                            className="w-full py-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-bold transition"
                        >
                            {t('modal.inactive.cta_logout')}
                        </button>
                    </div>

                    <p className="mt-6 text-xs text-gray-400">
                        {t('modal.inactive.support')}
                    </p>
                </div>
            )}
        </div>
    );
};

export default InactiveUserModal;
