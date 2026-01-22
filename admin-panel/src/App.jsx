import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import AdminDashboard from './admin/Dashboard';
import AgencyDashboard from './admin/AgencyDashboard';
import WelcomeAuth from './admin/WelcomeAuth';
import './index.css';

function App() {
    const [token, setToken] = useState(localStorage.getItem("authToken"));
    const [role, setRole] = useState(localStorage.getItem("userRole"));

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const locId = params.get("location_id");
        if (locId) {
            sessionStorage.setItem("ghl_location_id", locId);
        }
    }, []);

    const handleLoginSuccess = (data) => {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userRole", data.role);
        if (data.agencyId) localStorage.setItem("agencyId", data.agencyId);
        else localStorage.removeItem("agencyId");

        // ✅ Persistir nuevos datos de suscripción y features
        if (data.subscriptionStatus) localStorage.setItem("subscriptionStatus", JSON.stringify(data.subscriptionStatus));
        if (data.features) localStorage.setItem("agencyFeatures", JSON.stringify(data.features));
        
        setToken(data.token);
        setRole(data.role);
    };

    const logout = () => {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userRole");
        localStorage.removeItem("agencyId");
        localStorage.removeItem("subscriptionStatus");
        localStorage.removeItem("agencyFeatures");
        setToken(null);
        setRole(null);
        window.history.pushState({}, document.title, "/");
    };

    return (
        <>
            <Toaster
                position="top-center"
                richColors
                closeButton
                theme="system"
                toastOptions={{
                    unstyled: false,
                    classNames: {
                        toast: 'group toast group-[.toaster]:bg-white group-[.toaster]:dark:bg-[#1A1D24] group-[.toaster]:border-gray-200 group-[.toaster]:dark:border-gray-800 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl group-[.toaster]:p-4 group-[.toaster]:font-sans',
                        title: 'group-[.toaster]:font-bold group-[.toaster]:text-base',
                        description: 'group-[.toaster]:text-gray-500 group-[.toaster]:dark:text-gray-400 group-[.toaster]:text-sm',
                        actionButton: 'group-[.toaster]:bg-indigo-600 group-[.toaster]:text-white',
                        cancelButton: 'group-[.toaster]:bg-gray-100 group-[.toaster]:text-gray-500',
                        error: 'group-[.toaster]:!bg-red-50 group-[.toaster]:!text-red-800 group-[.toaster]:!border-red-100 group-[.toaster]:dark:!bg-red-900/20 group-[.toaster]:dark:!text-red-200 group-[.toaster]:dark:!border-red-900/30',
                        success: 'group-[.toaster]:!bg-emerald-50 group-[.toaster]:!text-emerald-800 group-[.toaster]:!border-emerald-100 group-[.toaster]:dark:!bg-emerald-900/20 group-[.toaster]:dark:!text-emerald-200 group-[.toaster]:dark:!border-emerald-900/30',
                        warning: 'group-[.toaster]:!bg-amber-50 group-[.toaster]:!text-amber-800 group-[.toaster]:!border-amber-100 group-[.toaster]:dark:!bg-amber-900/20 group-[.toaster]:dark:!text-amber-200 group-[.toaster]:dark:!border-amber-900/30',
                        info: 'group-[.toaster]:!bg-blue-50 group-[.toaster]:!text-blue-800 group-[.toaster]:!border-blue-100 group-[.toaster]:dark:!bg-blue-900/20 group-[.toaster]:dark:!text-blue-200 group-[.toaster]:dark:!border-blue-900/30',
                    }
                }}
            />

            {!token ? (
                <WelcomeAuth onLoginSuccess={handleLoginSuccess} />
            ) : role === 'admin' ? (
                <AdminDashboard token={token} onLogout={logout} />
            ) : role === 'agency' ? (
                <AgencyDashboard token={token} onLogout={logout} />
            ) : (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                    <button onClick={logout} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Salir</button>
                </div>
            )}
        </>
    );
}

export default App;