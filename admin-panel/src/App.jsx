import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import Login from './admin/Login';
import AgencyDashboard from './admin/AgencyDashboard';
import AdminDashboard from './admin/Dashboard';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { BrandingProvider } from './context/BrandingContext';

function App() {
    const [token, setToken] = useState(localStorage.getItem('authToken'));
    const [role, setRole] = useState(localStorage.getItem('userRole'));

    useEffect(() => {
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
        }
    }, [token]);

    const handleLoginSuccess = (newToken) => {
        setToken(newToken);
        // role is set in localStorage by Login component, update state
        setRole(localStorage.getItem('userRole'));
    };

    const handleLogout = () => {
        setToken(null);
        setRole(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
    };

    return (
        <ThemeProvider>
            <BrandingProvider>
                <LanguageProvider>
                    <Toaster position="top-center" richColors />
                    {!token ? (
                        <Login onLoginSuccess={handleLoginSuccess} />
                    ) : role === 'admin' ? (
                        <AdminDashboard token={token} onLogout={handleLogout} />
                    ) : (
                        <AgencyDashboard token={token} onLogout={handleLogout} />
                    )}
                </LanguageProvider>
            </BrandingProvider>
        </ThemeProvider>
    );
}

export default App;
