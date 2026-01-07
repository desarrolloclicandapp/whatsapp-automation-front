import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageSelector() {
    const { language, changeLanguage } = useLanguage();

    return (
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <Globe size={16} className="text-gray-500 ml-2" />
            <button
                onClick={() => changeLanguage('es')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${language === 'es'
                        ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
            >
                ES
            </button>
            <button
                onClick={() => changeLanguage('en')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${language === 'en'
                        ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
            >
                EN
            </button>
        </div>
    );
}
