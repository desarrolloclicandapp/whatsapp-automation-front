
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-all duration-200
            bg-gray-100 hover:bg-gray-200 text-gray-600
            dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-yellow-400"
            title={theme === 'light' ? "Activar Modo Oscuro" : "Activar Modo Claro"}
        >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
    );
}