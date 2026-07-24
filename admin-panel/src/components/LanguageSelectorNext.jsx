import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageSelector() {
    const { language, changeLanguage } = useLanguage();

    return (
        <div className="flex h-7 items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
            <button
                type="button"
                aria-label="Español"
                aria-pressed={language === 'es'}
                onClick={() => changeLanguage('es')}
                className={`h-6 min-h-6 rounded-md px-2.5 py-0.5 text-[11px] font-bold leading-none transition-all ${language === 'es'
                        ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
            >
                ES
            </button>
            <button
                type="button"
                aria-label="English"
                aria-pressed={language === 'en'}
                onClick={() => changeLanguage('en')}
                className={`h-6 min-h-6 rounded-md px-2.5 py-0.5 text-[11px] font-bold leading-none transition-all ${language === 'en'
                        ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
            >
                EN
            </button>
        </div>
    );
}
