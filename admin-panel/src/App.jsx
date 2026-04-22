import React, { useEffect, useMemo, useState } from 'react';
import { Toaster } from 'sonner';
import ReactGA from 'react-ga4';
import AdminDashboard from './admin/Dashboard';
import AgencyDashboard from './admin/AgencyDashboard';
import WelcomeAuth from './admin/WelcomeAuth';
import StandaloneLogin from './standalone-app/StandaloneLogin';
import StandaloneLayout from './standalone-app/StandaloneLayout';
import './index.css';

const STANDALONE_HOME = '/crm';
const AGENCY_HOME = '/agency';

const safeJsonParse = (value, fallback = null) => {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const getModeFromPath = (pathname = '/') => {
    const normalized = String(pathname || '/').toLowerCase();

    if (
        normalized === '/crm' ||
        normalized.startsWith('/crm/') ||
        normalized === '/standalone' ||
        normalized.startsWith('/standalone/')
    ) {
        return 'standalone';
    }

    return 'agency';
};

const normalizeInterface = (value, fallback = 'agency') => {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'standalone' || normalized === 'standalone_crm' || normalized === 'crm') {
        return 'standalone';
    }

    if (normalized === 'agency') {
        return 'agency';
    }

    return fallback;
};

const buildAccountInfoFromStorage = () => {
    const subscriptionStatus = safeJsonParse(localStorage.getItem('subscriptionStatus'), null);
    const features = safeJsonParse(localStorage.getItem('agencyFeatures'), null);
    const maxSlots = Number(localStorage.getItem('accountMaxSlots') || 3);
    const usedSlots = Number(localStorage.getItem('accountUsedSlots') || 0);
    const maxSubagencies = Number(localStorage.getItem('accountMaxSubagencies') || 0);

    return {
        name: localStorage.getItem('userName') || '',
        email: localStorage.getItem('userEmail') || '',
        crm_type: localStorage.getItem('accountCrmType') || 'chatwoot',
        plan: localStorage.getItem('accountPlan') || (subscriptionStatus?.currentPeriodEnd ? 'active' : 'trial'),
        trial_ends: localStorage.getItem('accountTrialEnds') || null,
        features,
        subscriptionStatus,
        limits: {
            used_slots: usedSlots,
            max_slots: maxSlots,
            max_subagencies: maxSubagencies,
        },
    };
};

function App() {
    const [currentPath, setCurrentPath] = useState(window.location.pathname);
    const [token, setToken] = useState(localStorage.getItem('authToken'));
    const [role, setRole] = useState(localStorage.getItem('userRole'));
    const [restoreToken, setRestoreToken] = useState(localStorage.getItem('admin_restore_token'));
    const [userInterface, setUserInterface] = useState(localStorage.getItem('userInterface'));
    const [accountRefreshKey, setAccountRefreshKey] = useState(0);

    const currentMode = getModeFromPath(currentPath);
    const isStandaloneMode = currentMode === 'standalone';
    const resolvedInterface = normalizeInterface(
        userInterface,
        role === 'admin' ? 'agency' : currentMode,
    );
    const expectedMode = role === 'admin' ? 'agency' : resolvedInterface;
    const needsRouteCorrection = Boolean(token) && expectedMode !== currentMode;
    const accountInfo = useMemo(
        () => buildAccountInfoFromStorage(),
        [token, role, userInterface, accountRefreshKey],
    );

    useEffect(() => {
        const handlePopState = () => setCurrentPath(window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        ReactGA.send({
            hitType: 'pageview',
            page: currentPath,
            title: `App Carga - Rol: ${role || 'Deslogueado'}`,
        });

        const params = new URLSearchParams(window.location.search);
        const locId = params.get('location_id');
        if (locId) {
            sessionStorage.setItem('crm_location_id', locId);
        }

        if (role === 'admin' && localStorage.getItem('agencyBranding')) {
            console.log('[App] Cleaning sticky branding for Admin...');
            localStorage.removeItem('agencyBranding');
            window.location.reload();
        }
    }, [role, currentPath]);

    useEffect(() => {
        if (!needsRouteCorrection) return;

        const targetPath = expectedMode === 'standalone' ? STANDALONE_HOME : AGENCY_HOME;
        window.history.replaceState({}, document.title, `${targetPath}${window.location.search}`);
        setCurrentPath(targetPath);
    }, [expectedMode, needsRouteCorrection]);

    const navigateTo = (nextPath, method = 'replace') => {
        if (!nextPath || nextPath === currentPath) return;

        const historyMethod = method === 'push' ? 'pushState' : 'replaceState';
        window.history[historyMethod]({}, document.title, `${nextPath}${window.location.search}`);
        setCurrentPath(nextPath);
    };

    const handleLoginSuccess = (data) => {
        const nextRole = data.role || data.user?.role || 'agency';
        const nextAgencyId = data.agencyId || data.user?.agencyId || null;
        const nextSubscriptionStatus = data.subscriptionStatus || data.user?.subscriptionStatus || null;
        const nextFeatures = data.features || data.user?.features || null;
        const nextEmail = data.email || data.user?.email || '';
        const nextName = data.name || data.user?.name || '';
        const nextInterface = normalizeInterface(
            data.interface || data.user?.interface,
            nextRole === 'admin' ? 'agency' : (isStandaloneMode ? 'standalone' : 'agency'),
        );

        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('agencyId');
        localStorage.removeItem('subscriptionStatus');
        localStorage.removeItem('agencyFeatures');
        localStorage.removeItem('admin_restore_token');
        localStorage.removeItem('admin_restore_role');
        localStorage.removeItem('admin_restore_agencyId');
        localStorage.removeItem('userInterface');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');

        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userRole', nextRole);
        localStorage.setItem('userInterface', nextInterface);

        if (nextAgencyId) localStorage.setItem('agencyId', nextAgencyId);
        else localStorage.removeItem('agencyId');

        if (nextEmail) localStorage.setItem('userEmail', nextEmail);
        if (nextName) localStorage.setItem('userName', nextName);

        if (nextSubscriptionStatus) {
            localStorage.setItem('subscriptionStatus', JSON.stringify(nextSubscriptionStatus));
        }
        if (nextFeatures) {
            localStorage.setItem('agencyFeatures', JSON.stringify(nextFeatures));
        }

        setToken(data.token);
        setRole(nextRole);
        setUserInterface(nextInterface);
        setAccountRefreshKey((value) => value + 1);

        if (nextRole === 'admin') {
            navigateTo(AGENCY_HOME);
        } else if (nextInterface === 'standalone') {
            navigateTo(STANDALONE_HOME);
        }

        ReactGA.event({
            category: 'Autenticacion',
            action: 'Login_Exitoso',
            label: nextRole,
        });
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('agencyId');
        localStorage.removeItem('subscriptionStatus');
        localStorage.removeItem('agencyFeatures');
        localStorage.removeItem('admin_restore_token');
        localStorage.removeItem('admin_restore_role');
        localStorage.removeItem('admin_restore_agencyId');
        localStorage.removeItem('userInterface');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('agencyBranding');

        setToken(null);
        setRole(null);
        setRestoreToken(null);
        setUserInterface(null);
        navigateTo(isStandaloneMode ? STANDALONE_HOME : '/');

        ReactGA.event({
            category: 'Autenticacion',
            action: 'Logout_Manual',
        });

        window.location.reload();
    };

    const restoreAdminSession = () => {
        const adminToken = localStorage.getItem('admin_restore_token');
        const adminRole = localStorage.getItem('admin_restore_role') || 'admin';
        const adminAgencyId = localStorage.getItem('admin_restore_agencyId');

        if (!adminToken) return;

        localStorage.setItem('authToken', adminToken);
        localStorage.setItem('userRole', adminRole);
        localStorage.setItem('userInterface', 'agency');

        if (adminAgencyId) localStorage.setItem('agencyId', adminAgencyId);
        else localStorage.removeItem('agencyId');

        localStorage.removeItem('admin_restore_token');
        localStorage.removeItem('admin_restore_role');
        localStorage.removeItem('admin_restore_agencyId');
        localStorage.removeItem('agencyBranding');

        setToken(adminToken);
        setRole(adminRole);
        setRestoreToken(null);
        setUserInterface('agency');
        navigateTo(AGENCY_HOME);

        ReactGA.event({
            category: 'Seguridad_Admin',
            action: 'Restaurar_Sesion_Admin',
        });

        window.location.reload();
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
                    },
                }}
            />

            {restoreToken && (
                <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 text-amber-900">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
                        <div className="text-sm font-semibold">Estas navegando como Admin (impersonacion activa).</div>
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
                isStandaloneMode ? (
                    <StandaloneLogin onLoginSuccess={handleLoginSuccess} />
                ) : (
                    <WelcomeAuth onLoginSuccess={handleLoginSuccess} />
                )
            ) : needsRouteCorrection ? (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400">
                    Redirigiendo...
                </div>
            ) : isStandaloneMode ? (
                <StandaloneLayout
                    token={token}
                    accountInfo={accountInfo}
                    onLogout={logout}
                    onUnauthorized={logout}
                    onDataChange={() => setAccountRefreshKey((value) => value + 1)}
                    initialPlanType={localStorage.getItem('accountPlanType') || (accountInfo?.plan === 'trial' ? 'trial' : 'starter')}
                    initialIsWhatsAppConnected={Boolean(accountInfo?.limits?.used_slots)}
                />
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
