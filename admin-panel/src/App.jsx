import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import AdminDashboard from './admin/Dashboard';
import AgencyDashboard from './admin/AgencyDashboard';
import WelcomeAuth from './admin/WelcomeAuth';
import './index.css';

function App() {
    const [token, setToken] = useState(localStorage.getItem("authToken"));
    const [role, setRole] = useState(localStorage.getItem("userRole"));
    const [restoreToken, setRestoreToken] = useState(localStorage.getItem("admin_restore_token"));

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const locId = params.get("location_id");
        if (locId) {
            sessionStorage.setItem("ghl_location_id", locId);
        }

        // 🔥 FIX: Ensure admins don't have sticky branding
        if (role === 'admin' && localStorage.getItem("agencyBranding")) {
             console.log("🧹 [App] Cleaning sticky branding for Admin...");
             localStorage.removeItem("agencyBranding");
             window.location.reload();
        }
    }, [role]);

    const handleLoginSuccess = (data) => {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("userRole");
        localStorage.removeItem("agencyId");
        localStorage.removeItem("subscriptionStatus");
        localStorage.removeItem("agencyFeatures");
        localStorage.removeItem("admin_restore_token");
        localStorage.removeItem("admin_restore_role");
        localStorage.removeItem("admin_restore_agencyId");

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
        localStorage.removeItem("admin_restore_token");
        localStorage.removeItem("admin_restore_role");
        localStorage.removeItem("admin_restore_agencyId");
        // 🔥 FIX: Limpiar branding pegajoso
        localStorage.removeItem("agencyBranding");
        
        setToken(null);
        setRole(null);
        setRestoreToken(null);
        window.history.pushState({}, document.title, "/");
        window.location.reload(); // Force reload to reset favicon/title state
    };

    const restoreAdminSession = () => {
        const adminToken = localStorage.getItem("admin_restore_token");
        const adminRole = localStorage.getItem("admin_restore_role") || "admin";
        const adminAgencyId = localStorage.getItem("admin_restore_agencyId");

        if (!adminToken) return;

        localStorage.setItem("authToken", adminToken);
        localStorage.setItem("userRole", adminRole);
        if (adminAgencyId) localStorage.setItem("agencyId", adminAgencyId);
        else localStorage.removeItem("agencyId");

        localStorage.removeItem("admin_restore_token");
        localStorage.removeItem("admin_restore_role");
        localStorage.removeItem("admin_restore_agencyId");
        // 🔥 FIX: Limpiar branding del cliente impersonado
        localStorage.removeItem("agencyBranding");

        setToken(adminToken);
        setRole(adminRole);
        setRestoreToken(null);
        window.history.pushState({}, document.title, "/");
        window.location.reload(); // Force reload to reset favicon/title state
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

            {restoreToken && (
                <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 text-amber-900">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
                        <div className="text-sm font-semibold">👻 Estás navegando como Admin (impersonación activa).</div>
                        <button
                            onClick={restoreAdminSession}
                            className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
                        >
                            Volver a Admin
                        </button>
                    </div>
                </div>
            )}

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
