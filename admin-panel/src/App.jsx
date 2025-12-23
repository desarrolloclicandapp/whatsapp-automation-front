import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import AdminDashboard from './admin/Dashboard';
import AgencyDashboard from './admin/AgencyDashboard';
import WelcomeAuth from './admin/WelcomeAuth';
import './index.css';

function App() {
    const [token, setToken] = useState(localStorage.getItem("authToken"));
    const [role, setRole] = useState(localStorage.getItem("userRole"));

    // Manejar Login Exitoso
    const handleLoginSuccess = (data) => {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userRole", data.role);

        // Guardar Agency ID para el panel
        if (data.agencyId) {
            localStorage.setItem("agencyId", data.agencyId);
        } else {
            localStorage.removeItem("agencyId");
        }

        setToken(data.token);
        setRole(data.role);
    };

    const logout = () => {
        localStorage.clear();
        setToken(null);
        setRole(null);
        window.history.pushState({}, document.title, "/");
    };

    return (
        <>
            {/* ✅ TOASTER DE SONNER CONFIGURADO */}
            <Toaster
                position="top-center"
                richColors
                closeButton
                theme="system"
                // Personalización con Tailwind para que coincida con tu diseño
                toastOptions={{
                    className: 'dark:bg-gray-800 dark:border-gray-700 dark:text-white bg-white border-gray-200 text-gray-900 shadow-lg rounded-xl',
                    descriptionClassName: 'text-gray-500 dark:text-gray-400',
                    actionButtonStyle: {
                        background: '#4f46e5', // Color índigo de tu marca
                        color: 'white',
                        fontWeight: '600',
                    },
                    cancelButtonStyle: {
                        background: '#f3f4f6',
                        color: '#374151',
                    },
                    style: {
                        // Ajustes finos de espaciado
                        padding: '16px',
                    }
                }}
            />

            {/* Lógica de Router Manual */}
            {!token ? (
                <WelcomeAuth onLoginSuccess={handleLoginSuccess} />
            ) : role === 'admin' ? (
                <AdminDashboard token={token} onLogout={logout} />
            ) : role === 'agency' ? (
                <AgencyDashboard token={token} onLogout={logout} />
            ) : (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                    <div className="text-center">
                        <p className="mb-4 text-lg">Rol de usuario desconocido.</p>
                        <button
                            onClick={logout}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

export default App;