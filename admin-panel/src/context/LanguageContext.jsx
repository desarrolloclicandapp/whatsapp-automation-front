import React, { createContext, useContext, useState, useEffect } from 'react';
import { es } from '../locales/es';
import { en } from '../locales/en';

// Dictionary Map
const translations = { es, en };

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    // 1. Initialize from localStorage or browser default
    const [language, setLanguage] = useState(() => {
        const saved = localStorage.getItem('appLanguage');
        if (saved && translations[saved]) return saved;

        // Auto-detect
        const browserLang = navigator.language.split('-')[0];
        return translations[browserLang] ? browserLang : 'es'; // Default to Spanish
    });

    // 2. Persist change
    useEffect(() => {
        localStorage.setItem('appLanguage', language);
    }, [language]);

    // 3. Translation Function
    const t = (key) => {
        const dict = translations[language] || translations['es'];
        return dict[key] || key; // Return key if translation missing
    };

    // 4. Switcher
    const changeLanguage = (lang) => {
        if (translations[lang]) setLanguage(lang);
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

// Hook for easy usage
export const useLanguage = () => useContext(LanguageContext);
