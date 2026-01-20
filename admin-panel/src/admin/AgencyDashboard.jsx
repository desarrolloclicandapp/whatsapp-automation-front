import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import LocationDetailsModal from './LocationDetailsModal';
import SubscriptionManager from './SubscriptionManager';
import SupportManager from './SupportManager';
import SubscriptionModal from './SubscriptionModal'; 
import SubscriptionBlocker from './SubscriptionBlocker';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSelector from '../components/LanguageSelector'; 
import { useLanguage } from '../context/LanguageContext'; 
import { useTheme } from '../context/ThemeContext';
import { useBranding } from '../context/BrandingContext';

import {
    LayoutGrid, CreditCard, LifeBuoy, LogOut,
    Plus, Search, Building2, Smartphone, RefreshCw,
    ExternalLink, Menu, CheckCircle2, ChevronRight, ArrowRight, Zap,
    TrendingUp, ShieldCheck, Settings, Trash2,
    Lock, User, Users, Moon, Sun, Link, MousePointer2,
    Key, Copy, Terminal, Globe, Save, Palette, RotateCcw // ✅ Iconos
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");
const SUPPORT_PHONE = import.meta.env.SUPPORT_PHONE || "34611770270";

// 🔥 LÓGICA DE EXTRACCIÓN DE APP ID (Compatible con tu .env actual)
// Toma la URL completa y se queda solo con el ID final (ej: 691623d58a49cdcb2c56ce9c)
const RAW_INSTALL_URL = import.meta.env.VITE_INSTALL_APP_URL || "https://gestion.clicandapp.com/integration/691623d58a49cdcb2c56ce9c";
const APP_ID = RAW_INSTALL_URL.includes('/integration/') 
    ? RAW_INSTALL_URL.split('/integration/')[1] 
    : "691623d58a49cdcb2c56ce9c"; // Fallback por seguridad

export default function AgencyDashboard({ token, onLogout }) {
    const { t } = useLanguage();
    // ✅ Agregamos loadAgencyBranding para cargar desde server
    const { branding, updateBranding, resetBranding, DEFAULT_BRANDING, systemBranding, loadAgencyBranding } = useBranding();

    const [storedAgencyId, setStoredAgencyId] = useState(localStorage.getItem("agencyId"));
    const queryParams = new URLSearchParams(window.location.search);
    const AGENCY_ID = storedAgencyId || queryParams.get("agencyId");
    const { theme, toggleTheme } = useTheme();

    const [activeTab, setActiveTab] = useState('overview');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAutoSyncing, setIsAutoSyncing] = useState(false);

    const [accountInfo, setAccountInfo] = useState(null);
    const isRestricted = accountInfo?.plan === 'starter'; 
    const [searchTerm, setSearchTerm] = useState("");
    const [userEmail, setUserEmail] = useState("");

    const [isAccountSuspended, setIsAccountSuspended] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // ✅ NUEVO: Estado para Dominio CRM (Persistente en LocalStorage)
    const [crmDomain, setCrmDomain] = useState(localStorage.getItem("crmDomain") || "app.gohighlevel.com");

    // Estados API Keys & Webhooks
    const [apiKeys, setApiKeys] = useState([]);
    const [loadingKeys, setLoadingKeys] = useState(false);
    const [showNewKeyModal, setShowNewKeyModal] = useState(false);
    const [generatedKey, setGeneratedKey] = useState(null);
    const [webhooks, setWebhooks] = useState([]);
    const [showNewWebhookModal, setShowNewWebhookModal] = useState(false);

    const authFetch = async (endpoint, options = {}) => {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.status === 401 || res.status === 403) {
            onLogout();
            throw new Error("Sesión expirada");
        }
        return res;
    };

    const refreshData = async () => {
        try {
            const accRes = await authFetch('/agency/info');

            if (accRes && accRes.ok) {
                const data = await accRes.json();
                setAccountInfo(data);

                let effectiveAgencyId = AGENCY_ID;
                if (!effectiveAgencyId && data.agencyId) {
                    effectiveAgencyId = data.agencyId;
                    setStoredAgencyId(data.agencyId);
                    localStorage.setItem("agencyId", data.agencyId);
                }

                if (effectiveAgencyId) {
                    const locRes = await authFetch(`/agency/locations?agencyId=${effectiveAgencyId}`);
                    if (locRes && locRes.ok) {
                        const locData = await locRes.json();
                        if (Array.isArray(locData)) setLocations(locData);
                    }
                }

                const planStatus = (data.plan || '').toLowerCase();
                const now = new Date();
                const trialEnd = data.trial_ends ? new Date(data.trial_ends) : null;

                if (planStatus === 'suspended' || planStatus === 'cancelled' || planStatus === 'past_due') {
                    setIsAccountSuspended(true);
                } else if (planStatus === 'trial' && trialEnd && trialEnd < now) {
                    setIsAccountSuspended(true);
                } else {
                    setIsAccountSuspended(false);
                }
            } else if (!AGENCY_ID) {
                setLoading(false);
                return;
            }
        } catch (error) {
            console.error("Error refrescando datos", error);
        } finally {
            setLoading(false);
        }
    };

    const autoSyncAgency = async (locationId, code) => {
        setIsAutoSyncing(true);
        const toastId = toast.loading('Esperando instalación de GHL...');

        try {
            // 🔥 STEP 1: Wait for GHL webhook to complete installation
            let installed = false;
            let attempts = 0;
            const maxWaitAttempts = 30; // 60 seconds max wait (30 * 2s)

            while (!installed && attempts < maxWaitAttempts) {
                try {
                    const checkRes = await authFetch(`/agency/check-install/${locationId}`);
                    if (checkRes.ok) {
                        const checkData = await checkRes.json();
                        if (checkData.installed) {
                            installed = true;
                            toast.loading('Instalación detectada, sincronizando...', { id: toastId });
                            break;
                        }
                    }
                } catch (e) {
                    console.log("Waiting for install...", e.message);
                }
                
                attempts++;
                if (attempts % 5 === 0) {
                    toast.loading(`Esperando webhook de GHL... (${attempts * 2}s)`, { id: toastId });
                }
                await new Promise(r => setTimeout(r, 2000));
            }

            // 🔥 STEP 2: Now call sync-ghl to link the user
            let data;
            let syncAttempts = 0;
            const maxSyncAttempts = 5;

            while (syncAttempts < maxSyncAttempts) {
                try {
                    const res = await authFetch(`/agency/sync-ghl`, {
                        method: "POST",
                        body: JSON.stringify({ locationIdToVerify: locationId, code: code })
                    });

                    if (res.ok) {
                        data = await res.json();
                        break;
                    }
                    if (res.status === 404 && !installed) {
                        // Still not installed, wait more
                        syncAttempts++;
                        await new Promise(r => setTimeout(r, 2000));
                    } else {
                        throw new Error("Error de servidor");
                    }
                } catch (e) { 
                    syncAttempts++; 
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            if (!data || !data.success) throw new Error("No se pudo completar la sincronización.");

            localStorage.setItem("agencyId", data.newAgencyId);
            setStoredAgencyId(data.newAgencyId);

            refreshData();
            toast.success('¡Instalación completada!', { id: toastId });
            window.history.replaceState({}, document.title, window.location.pathname);

        } catch (error) {
            toast.error(error.message || "Error en instalación", { id: toastId });
        } finally {
            setIsAutoSyncing(false);
        }
    };


    useEffect(() => {
        console.log("📍 URL Search Params:", window.location.search);
        const targetLocationId = queryParams.get("location_id") || queryParams.get("new_install");
        const oauthCode = queryParams.get("code");
        console.log(`🔎 Parsed Params -> Location: ${targetLocationId}, Code: ${oauthCode ? 'PRESENT' : 'MISSING'}`);
        
        if (targetLocationId && !isAutoSyncing) autoSyncAgency(targetLocationId, oauthCode);
        try { const payload = JSON.parse(atob(token.split('.')[1])); setUserEmail(payload.email); } catch (e) { }

        // ✅ Cargar Branding del Servidor al montar
        if(token && loadAgencyBranding) {
            loadAgencyBranding(token);
        }
    }, []);

    useEffect(() => {
        if (AGENCY_ID) {
            refreshData();
            fetchApiKeys(); 
            fetchWebhooks(); 
            const interval = setInterval(refreshData, 30000);
            return () => clearInterval(interval);
        }
    }, [AGENCY_ID]);

    const fetchWebhooks = async () => {
        try {
            const res = await authFetch('/agency/webhooks');
            if (res.ok) {
                const data = await res.json();
                setWebhooks(data.hooks);
            }
        } catch (e) { console.error("Error webhooks:", e); }
    };

    const handleCreateWebhook = async (e) => {
        e.preventDefault();
        const name = e.target.hookName.value;
        const url = e.target.hookUrl.value;
        const events = Array.from(e.target.elements)
            .filter(el => el.name === "events" && el.checked)
            .map(el => el.value);

        if (!name || !url) return toast.error("Nombre y URL requeridos");

        const tId = toast.loading("Creando...");
        try {
            const res = await authFetch('/agency/webhooks', {
                method: 'POST',
                body: JSON.stringify({ name, targetUrl: url, events })
            });
            if (res.ok) {
                toast.success("Webhook creado", { id: tId });
                fetchWebhooks();
                setShowNewWebhookModal(false);
                e.target.reset();
            } else {
                toast.error("Error al crear", { id: tId });
            }
        } catch (err) { toast.error("Error conexión", { id: tId }); }
    };

    const handleDeleteWebhook = async (id) => {
        if (!confirm("¿Eliminar Webhook?")) return;
        const tId = toast.loading("Eliminando...");
        try {
            const res = await authFetch(`/agency/webhooks/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success("Eliminado", { id: tId });
                fetchWebhooks();
            } else {
                toast.error("Error al eliminar", { id: tId });
            }
        } catch (err) { toast.error("Error conexión", { id: tId }); }
    };

    const fetchApiKeys = async () => {
        setLoadingKeys(true);
        try {
            const res = await authFetch('/agency/api-keys');
            if (res.ok) {
                const data = await res.json();
                setApiKeys(data.keys);
            }
        } catch (e) { console.error("Error keys:", e); } finally { setLoadingKeys(false); }
    };

    const handleGenerateKey = async (e) => {
        e.preventDefault();
        const name = e.target.keyName.value;
        if (!name) return toast.error("Nombre requerido");

        const tId = toast.loading("Generando...");
        try {
            const res = await authFetch('/agency/api-keys', {
                method: 'POST',
                body: JSON.stringify({ keyName: name })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Clave generada", { id: tId });
                setGeneratedKey(data.apiKey);
                setShowNewKeyModal(true);
                fetchApiKeys();
                e.target.reset();
            } else {
                toast.error(data.error || "Error", { id: tId });
            }
        } catch (err) { toast.error("Error conexión", { id: tId }); }
    };

    const handleRevokeKey = async (id) => {
        if (!confirm("¿Eliminar clave API?")) return;
        const tId = toast.loading("Eliminando...");
        try {
            const res = await authFetch(`/agency/api-keys/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success("Clave eliminada", { id: tId });
                fetchApiKeys();
            } else {
                toast.error("Error", { id: tId });
            }
        } catch (err) { toast.error("Error conexión", { id: tId }); }
    };

    const handleDeleteTenant = async (e, locationId, name) => {
        e.stopPropagation();
        if (!confirm(`⚠️ ¿Eliminar subcuenta "${name || locationId}"?`)) return;
        const tId = toast.loading("Eliminando...");
        try {
            const res = await authFetch(`/agency/tenants/${locationId}`, { method: 'DELETE' });
            if (res.ok) { toast.success("Eliminado", { id: tId }); refreshData(); }
            else throw new Error("Error");
        } catch (err) { toast.error("Error", { id: tId }); }
    };

    // ✅ LÓGICA DE INSTALACIÓN DINÁMICA
    const handleInstallApp = async () => {
        const tId = toast.loading("Verificando plan...");
        try {
            const res = await authFetch('/agency/validate-limits?type=tenant');
            const data = await res.json();

            toast.dismiss(tId);

            if (data.allowed) {
                // 🔥 URL Dinámica usando el dominio preferido del usuario
                // Si el usuario no configuró nada, usa app.gohighlevel.com por defecto
                const installUrl = `https://${crmDomain}/integration/${APP_ID}`;
                
                console.log("Redirigiendo a:", installUrl);
                window.location.href = installUrl;
            } else {
                toast.error("Límite alcanzado", { description: data.reason });
                setShowUpgradeModal(true);
            }
        } catch (e) {
            toast.dismiss(tId);
            toast.error("Error verificando límites");
        }
    };

    // ✅ GUARDAR DOMINIO CRM
    const handleSaveCrmDomain = () => {
        // Limpieza básica de la URL (quitar https://, barras finales, etc)
        let cleaned = crmDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
        if (!cleaned) cleaned = "app.gohighlevel.com";
        
        setCrmDomain(cleaned);
        localStorage.setItem("crmDomain", cleaned);
        toast.success("Dominio CRM guardado", { description: `Instalaciones usarán: ${cleaned}` });
    };

    const filteredLocations = locations.filter(loc =>
        loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.location_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ✅ Componente de Bloqueo Profesional
    const LockedFeature = ({ title, description }) => (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 mb-2">
                <Lock size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title || t('dash.locked.title') || "Función Premium Bloqueada"}</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
                {description || t('dash.locked.desc') || "Esta característica está disponible exclusivamente para planes Growth y superiores."}
            </p>
            <button onClick={() => setActiveTab('billing')} className="mt-4 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-lg shadow-amber-600/20 transition-transform active:scale-95 flex items-center gap-2">
                <Zap size={18} fill="currentColor" /> {t('dash.upgrade.cta') || "Desbloquear Ahora"}
            </button>
        </div>
    );

    const WhiteLabelSettings = () => {
        const [form, setForm] = useState(branding || DEFAULT_BRANDING);

        useEffect(() => { if (branding) setForm(branding); }, [branding]);

        const handleSave = (e) => {
            e.preventDefault();
            if (updateBranding) {
                // ✅ Pasamos token para persistencia en servidor
                updateBranding(form, token); 
                toast.success("Marca actualizada 🎨");
            }
        };

        const handleReset = () => {
            if (confirm("¿Restaurar valores por defecto?")) {
                if (resetBranding) {
                    resetBranding(token);
                    setForm(DEFAULT_BRANDING);
                    toast.success("Marca restaurada");
                }
            }
        };

        if (isRestricted) {
            return (
                <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-right-4">
                     <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Palette size={24} className="text-gray-400" /> Marca Blanca
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Personaliza el panel con tu identidad.</p>
                        </div>
                        <span className="px-3 py-1 text-xs font-bold uppercase rounded-full border bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:border-amber-800 flex items-center gap-1"><Lock size={12} /> Bloqueado</span>
                    </div>
                    <LockedFeature />
                </div>
            );
        }

        return (
            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-right-4">
                <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Palette size={24} className="text-indigo-500" /> Marca Blanca
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Personaliza el panel con tu identidad.</p>
                    </div>
                    <div className="flex gap-2">
                        <span className="px-3 py-1 text-xs font-bold uppercase rounded-full border bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800">Pro Feature</span>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-8">
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">Identidad</h4>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nombre de Agencia</label>
                            <input type="text" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">Gráficos</h4>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Logo URL (Cuadrado)</label>
                            <div className="flex gap-4 items-center">
                                <div className="w-16 h-16 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-800 overflow-hidden shrink-0 shadow-sm"><img src={form.logoUrl} alt="Preview" className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} /></div>
                                <div className="flex-1 relative"><Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="url" value={form.logoUrl === systemBranding?.logoUrl ? '' : (form.logoUrl || '')} onChange={e => setForm({ ...form, logoUrl: e.target.value || systemBranding.logoUrl })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 transition-all text-sm" placeholder="URL Logo" /></div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Favicon URL</label>
                            <div className="flex gap-4 items-center">
                                <div className="w-16 h-16 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-800 overflow-hidden shrink-0 shadow-sm"><img src={form.faviconUrl} alt="Preview" className="w-8 h-8 object-contain" onError={(e) => e.target.style.display = 'none'} /></div>
                                <div className="flex-1 relative"><MousePointer2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="url" value={form.faviconUrl === systemBranding?.faviconUrl ? '' : (form.faviconUrl || '')} onChange={e => setForm({ ...form, faviconUrl: e.target.value || systemBranding.faviconUrl })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 transition-all text-sm" placeholder="URL Favicon" /></div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex flex-col md:flex-row items-center gap-4 border-t border-gray-100 dark:border-gray-800">
                        <button type="submit" className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg flex items-center gap-2"><CheckCircle2 size={18} /> Guardar Cambios</button>
                        <button type="button" onClick={handleReset} className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-medium text-sm transition flex items-center gap-2 px-4"><RotateCcw size={16} /> Restaurar</button>
                    </div>
                </form>
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#0f1117] font-sans overflow-hidden">
            {isAccountSuspended && <SubscriptionBlocker token={token} onLogout={onLogout} />}
            {showUpgradeModal && <SubscriptionModal token={token} accountInfo={accountInfo} onClose={() => setShowUpgradeModal(false)} onDataChange={refreshData} />}

            {/* 🔥 OVERLAY DE BLOQUEO DURANTE INSTALACIÓN */}
            {isAutoSyncing && (
                <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 shadow-2xl border border-gray-200 dark:border-gray-800 max-w-md w-full mx-4 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 relative">
                            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900/50"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin"></div>
                            <div className="absolute inset-3 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                <RefreshCw size={28} className="text-indigo-600 animate-pulse" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Instalando Subcuenta...
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Por favor, no cierres esta ventana ni navegues a otra página.
                        </p>
                        <div className="mt-6 flex justify-center gap-1">
                            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                    </div>
                </div>
            )}

            <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col z-30`}>
                <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shrink-0 overflow-hidden" style={{ backgroundColor: branding.primaryColor }}><img src={branding.logoUrl} alt="Logo" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} /></div>
                    {sidebarOpen && <span className="ml-3 font-bold text-gray-900 dark:text-white tracking-tight truncate">{branding.name}</span>}
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                    <p className={`text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2 ${!sidebarOpen && 'hidden'}`}>{t('dash.nav.management')}</p>
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="overview" icon={LayoutGrid} label={t('dash.nav.overview')} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="billing" icon={CreditCard} label={t('dash.nav.billing')} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="settings" icon={Settings} label={t('dash.nav.settings')} branding={branding} sidebarOpen={sidebarOpen} />
                    <div className="my-6 border-t border-gray-100 dark:border-gray-800"></div>
                    <a href={`https://wa.me/${SUPPORT_PHONE}`} target="_blank" rel="noreferrer" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-indigo-900/10`}><LifeBuoy size={20} />{sidebarOpen && <span>{t('dash.nav.support')}</span>}</a>
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                    <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all font-medium text-sm"><LogOut size={20} />{sidebarOpen && <span>{t('dash.nav.logout')}</span>}</button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[#F8FAFC] dark:bg-[#0f1117]">
                <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800 flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500"><Menu size={20} /></button><h2 className="text-lg font-bold text-gray-900 dark:text-white capitalize">{activeTab === 'overview' ? t('dash.header.overview') : activeTab === 'billing' ? t('dash.header.billing') : t('dash.header.settings')}</h2></div>
                    <div className="flex items-center gap-4"><LanguageSelector /><ThemeToggle /><div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs border border-white/20 shadow-sm" style={{ backgroundColor: branding.primaryColor }}>AG</div></div>
                </header>

                <main className="flex-1 overflow-y-auto p-6 md:p-8">
                    {activeTab === 'overview' && (
                        !accountInfo ? (<div className="flex justify-center items-center h-full text-gray-400"><RefreshCw className="animate-spin mr-2" /> Cargando panel...</div>) : (
                            <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                    <StatCard title={t('dash.stats.subaccounts')} value={`${accountInfo.limits?.used_subagencies || 0} / ${accountInfo.limits?.max_subagencies || 0}`} icon={Building2} color="bg-indigo-500" />
                                    <StatCard title={t('dash.stats.connections')} value={`${accountInfo.limits?.used_slots || 0} / ${accountInfo.limits?.max_slots || 0}`} icon={Smartphone} color="bg-emerald-500" />
                                    <StatCard title={t('dash.stats.plan')} value={accountInfo.plan === 'active' ? t('dash.stats.active') : t('dash.stats.trial')} subtext={accountInfo.trial_ends ? `Fin: ${new Date(accountInfo.trial_ends).toLocaleDateString()}` : null} icon={ShieldCheck} color={accountInfo.plan === 'active' ? "bg-blue-500" : "bg-amber-500"} />
                                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-5 rounded-2xl text-white shadow-lg flex flex-col justify-between cursor-pointer hover:shadow-indigo-500/25 transition-shadow" onClick={() => setActiveTab('billing')}><div><p className="text-indigo-200 text-xs font-bold uppercase tracking-wide mb-1">{t('dash.upgrade.prompt')}</p><h3 className="text-xl font-bold">{t('dash.upgrade.title')}</h3></div><div className="self-end bg-white/20 p-2 rounded-lg mt-1"><TrendingUp size={20} /></div></div>
                                </div>
                                <div className="border-t border-gray-200 dark:border-gray-800"></div>
                                {accountInfo.plan === 'trial' && (<div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in zoom-in-95 duration-500"><div className="flex items-center gap-5"><div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/40 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner"><Zap size={28} fill="currentColor" /></div><div><h4 className="text-lg font-bold text-gray-900 dark:text-white">Periodo de Prueba Activo (Trial) ⚡</h4><p className="text-sm text-amber-800 dark:text-amber-400 mt-1 max-w-2xl">Tu acceso gratuito vence el <span className="font-bold underlineDecoration decoration-amber-500/30">{new Date(accountInfo.trial_ends).toLocaleDateString()}</span>. Contrata un plan ahora.</p></div></div><button onClick={() => setActiveTab('billing')} className="w-full md:w-auto px-8 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-extrabold text-sm shadow-xl shadow-amber-600/20 transition-all flex items-center justify-center gap-3 hover:-translate-y-0.5 active:scale-95">Elegir un Plan <ArrowRight size={18} /></button></div>)}
                                <div className="space-y-6">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Users className="text-gray-400" /> {t('dash.subs.title')}</h3>
                                        <div className="flex w-full md:w-auto gap-3">
                                            <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" autoComplete="off" placeholder={t('dash.subs.search')} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 outline-none text-sm dark:text-white transition-all" style={{ '--tw-ring-color': branding.primaryColor }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                                            <button onClick={refreshData} disabled={isAutoSyncing} className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition disabled:opacity-50 disabled:cursor-not-allowed"><RefreshCw size={18} className={loading || isAutoSyncing ? "animate-spin" : ""} /></button>
                                            <button onClick={() => setActiveTab('billing')} className="px-5 py-2.5 text-white rounded-xl font-bold transition flex items-center gap-2 text-sm shadow-lg hover:opacity-90" style={{ backgroundColor: branding.primaryColor }}><Plus size={18} /> {t('dash.subs.new')}</button>
                                        </div>
                                    </div>
                                    {loading && locations.length === 0 ? <div className="py-20 text-center text-gray-400">Cargando datos...</div> : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {filteredLocations.map(loc => (
                                                <div key={loc.location_id} onClick={() => setSelectedLocation(loc)} className="group bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer relative overflow-hidden hover:border-indigo-500">
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                                    <div className="relative z-10"><div className="flex justify-between items-start mb-4"><div className="w-12 h-12 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-indigo-600 transition-colors shadow-sm"><Building2 size={24} /></div><button onClick={(e) => handleDeleteTenant(e, loc.location_id, loc.name)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button></div><h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1 truncate pr-2">{loc.name || "Sin Nombre"}</h4><p className="text-xs font-mono text-gray-400 mb-6 bg-gray-50 dark:bg-gray-800/50 inline-block px-1.5 py-0.5 rounded">{loc.location_id}</p><div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800"><p className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2"><Smartphone size={16} className="text-indigo-500" /> {loc.total_slots || 0} <span className="text-gray-400 font-normal text-xs">Conexiones</span></p><div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 group-hover:bg-indigo-600 group-hover:text-white transition-all"><ChevronRight size={16} /></div></div></div>
                                                </div>
                                            ))}
                                            {!searchTerm && accountInfo && Array.from({ length: Math.max(0, (accountInfo.limits?.max_subagencies || 0) - locations.length) }).map((_, idx) => (
                                                <div key={`empty-${idx}`} onClick={handleInstallApp} className="group relative bg-gray-50/50 dark:bg-gray-900/20 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500 transition-all duration-300 min-h-[220px]">
                                                    <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-all"><Plus size={32} className="text-gray-300 group-hover:text-indigo-600" /></div><h4 className="font-bold text-gray-900 dark:text-white mb-1">Espacio Disponible</h4><p className="text-xs text-gray-500 px-6">Tienes licencia para conectar una nueva subagencia.</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><User size={20} /> Información de la Cuenta</h3>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label className="block text-sm font-medium text-gray-500 mb-1.5">ID de Agencia</label><div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 font-mono font-medium dark:text-gray-200">{AGENCY_ID}</div></div>
                                        <div><label className="block text-sm font-medium text-gray-500 mb-1.5">Email Registrado</label><div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 font-medium dark:text-gray-200">{userEmail || 'Cargando...'}</div></div>
                                    </div>
                                </div>
                            </div>

                            {/* ✅ NUEVO: CONFIGURACIÓN DE DOMINIO CRM */}
                            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                                <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <Globe size={20} className="text-blue-500" /> Configuración de Dominio CRM
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Define el dominio donde instalarás las subcuentas (ej: <b>app.gohighlevel.com</b> o tu marca blanca).
                                        </p>
                                    </div>
                                    <button 
                                        onClick={handleSaveCrmDomain}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2"
                                    >
                                        <Save size={16} /> Guardar Dominio
                                    </button>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Dominio de Instalación</label>
                                    <div className="flex gap-2">
                                        <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-l-xl text-gray-500 select-none">https://</div>
                                        <input 
                                            type="text" 
                                            className="flex-1 p-3 border-y border-r border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-r-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                                            value={crmDomain}
                                            onChange={(e) => setCrmDomain(e.target.value)}
                                            placeholder="app.gohighlevel.com"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        Link de instalación actual: <span className="font-mono text-indigo-500">https://{crmDomain}/integration/{APP_ID}</span>
                                    </p>
                                </div>
                            </div>

                            {/* ✅ NUEVO: AGENCIA SOPORTE */}
                            {!isRestricted && (
                                <SupportManager 
                                    token={token} 
                                    apiPrefix="/agency/support" 
                                    socketRoom={`__AGENCY_SUPPORT_${AGENCY_ID}__`}
                                    title="Tu Número de Soporte (Marca Blanca)"
                                    showDisconnectWarning={false}
                                />
                            )}



                            <WhiteLabelSettings />
                            {/* <SecurityCard token={token} /> */}

                            {isRestricted ? (
                                <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-right-4">
                                     <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Terminal size={24} className="text-gray-400" /> {t('dash.settings.dev_title') || "Desarrolladores"}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('dash.settings.dev_desc') || "Gestiona claves API y Webhooks para integraciones."}</p>
                                        </div>
                                        <span className="px-3 py-1 text-xs font-bold uppercase rounded-full border bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:border-amber-800 flex items-center gap-1"><Lock size={12} /> Bloqueado</span>
                                    </div>
                                    <LockedFeature />
                                </div>
                            ) : (
                                <div className={`bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-right-4`}>
                                    <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Terminal size={24} className="text-pink-500" /> {t('dash.settings.dev_title') || "Desarrolladores"}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('dash.settings.dev_desc') || "Gestiona claves API y Webhooks para integraciones."}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="px-3 py-1 text-xs font-bold uppercase rounded-full border bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/30 dark:border-pink-800">Pro Feature</span>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        {/* API KEYS SECTION */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('dash.settings.api_keys') || "Claves API"}</h4>
                                                <form onSubmit={handleGenerateKey} className="flex gap-2">
                                                    <input name="keyName" placeholder={t('dash.settings.key_name_placeholder') || "Nombre..."} required className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none text-sm" />
                                                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl font-bold text-sm shadow flex items-center gap-2">
                                                        <Plus size={16} /> {t('common.create') || "Crear"}
                                                    </button>
                                                </form>
                                            </div>
                                            <div className={`overflow-x-auto`}>
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-xs font-bold text-gray-400 uppercase border-b dark:border-gray-700">
                                                            <th className="pb-3">{t('common.name') || "Nombre"}</th>
                                                            <th className="pb-3">{t('common.prefix') || "Prefijo"}</th>
                                                            <th className="pb-3 text-right">{t('common.action') || "Acción"}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y dark:divide-gray-800">
                                                        {apiKeys.map(k => (
                                                            <tr key={k.id}>
                                                                <td className="py-3 font-bold text-sm dark:text-white">{k.key_name}</td>
                                                                <td className="py-3 font-mono text-xs text-gray-500">{k.key_prefix}...</td>
                                                                <td className="py-3 text-right">
                                                                    <button onClick={() => handleRevokeKey(k.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={16} /></button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {apiKeys.length === 0 && <p className="text-center py-6 text-sm text-gray-400">{t('dash.settings.no_keys') || "Sin claves activas."}</p>}
                                            </div>
                                        </div>

                                        {/* WEBHOOKS SECTION */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('dash.settings.webhooks') || "Webhooks"}</h4>
                                                <button onClick={() => setShowNewWebhookModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow flex items-center gap-2">
                                                    <Plus size={16} /> {t('common.create') || "Crear"}
                                                </button>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-xs font-bold text-gray-400 uppercase border-b dark:border-gray-700">
                                                            <th className="pb-3">{t('common.name') || "Nombre"}</th>
                                                            <th className="pb-3">URL</th>
                                                            <th className="pb-3 text-right">{t('common.action') || "Acción"}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y dark:divide-gray-800">
                                                        {webhooks.map(h => (
                                                            <tr key={h.id}>
                                                                <td className="py-3 font-bold text-sm dark:text-white">{h.name}</td>
                                                                <td className="py-3 text-xs text-gray-500 truncate max-w-[200px]">{h.target_url}</td>
                                                                <td className="py-3 text-right">
                                                                    <button onClick={() => handleDeleteWebhook(h.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={16} /></button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {webhooks.length === 0 && <p className="text-center py-6 text-sm text-gray-400">{t('dash.settings.no_webhooks') || "Sin webhooks configurados."}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* MODAL API KEY */}
                            {showNewKeyModal && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200"><div className="mb-6 text-center"><div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600"><ShieldCheck size={32} /></div><h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('dash.settings.key_generated') || "Clave Generada"}</h3><p className="text-sm text-gray-500 mt-2">{t('dash.settings.key_copy_warning') || "Cópiala ahora, no podrás verla después."}</p></div><div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 mb-6 relative group"><div className="font-mono text-sm break-all pr-10 text-indigo-600 dark:text-indigo-400 font-bold">{generatedKey}</div><button onClick={() => { navigator.clipboard.writeText(generatedKey); toast.success(t('common.copied') || "Copiado"); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-indigo-600 transition"><Copy size={18} /></button></div><button onClick={() => { setShowNewKeyModal(false); setGeneratedKey(null); }} className="w-full py-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl font-bold hover:opacity-90 transition">{t('common.understood') || "Entendido"}</button></div></div>)}

                            {/* MODAL WEBHOOK */}
                            {showNewWebhookModal && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('dash.settings.new_webhook') || "Nuevo Webhook"}</h3><button onClick={() => setShowNewWebhookModal(false)} className="text-gray-400 hover:text-gray-600"><Settings size={20} className="rotate-45" /></button></div><form onSubmit={handleCreateWebhook} className="space-y-6"><div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('common.name') || "Nombre"}</label><input name="hookName" placeholder="Ej: n8n Producción" required className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div><div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">URL</label><input name="hookUrl" type="url" placeholder="https://..." required className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div><div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">{t('common.events') || "Eventos"}</label><div className="grid grid-cols-1 gap-3"><label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer"><input type="checkbox" name="events" value="whatsapp inbound message" defaultChecked className="w-5 h-5 rounded text-blue-600" /><div className="flex-1"><div className="text-sm font-bold dark:text-white">Inbound Message</div></div></label><label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer"><input type="checkbox" name="events" value="whatsapp outbound message" defaultChecked className="w-5 h-5 rounded text-blue-600" /><div className="flex-1"><div className="text-sm font-bold dark:text-white">Outbound Message</div></div></label></div></div><div className="flex gap-3"><button type="button" onClick={() => setShowNewWebhookModal(false)} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl font-bold">{t('common.cancel') || "Cancelar"}</button><button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">{t('common.create') || "Crear"}</button></div></form></div></div>)}

                            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
                                <div><h4 className="text-sm font-bold text-gray-900 dark:text-white">Modo Oscuro</h4><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Alternar tema.</p></div>
                                <button onClick={toggleTheme} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-600 dark:text-yellow-400">{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && <SubscriptionManager token={token} accountInfo={accountInfo} onDataChange={refreshData} />}
                </main>
            </div>

            {selectedLocation && (
                <LocationDetailsModal
                    location={selectedLocation}
                    token={token}
                    onLogout={onLogout}
                    onClose={() => setSelectedLocation(null)}
                    onUpgrade={() => setShowUpgradeModal(true)}
                    onDataChange={refreshData}
                />
            )}
        </div>
    );
}

const SidebarItem = ({ id, icon: Icon, label, activeTab, setActiveTab, branding, sidebarOpen }) => (
    <button
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm mb-1
            ${activeTab === id ? 'font-bold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}
        `}
        style={activeTab === id ? { color: branding?.primaryColor || '#4F46E5', backgroundColor: (branding?.primaryColor || '#4F46E5') + '15' } : {}}
    >
        <Icon size={20} />
        {sidebarOpen && <span>{label}</span>}
    </button>
);

const StatCard = ({ title, value, subtext, icon: Icon, color }) => (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start justify-between">
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{title}</p>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</h3>
            {subtext && <p className="text-[10px] text-gray-400 mt-1">{subtext}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${color}`}><Icon size={22} className="text-white" /></div>
    </div>
);

//const SecurityCard = ({ token }) => {
//    const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
//    const [loading, setLoading] = useState(false);

//    const handleChangePassword = async (e) => {
//        e.preventDefault();
//        if (passData.new !== passData.confirm) return toast.error("Las contraseñas no coinciden");
//        if (passData.new.length < 6) return toast.error("Mínimo 6 caracteres");

//        setLoading(true);
//        try {
//            const res = await fetch(`${API_URL}/auth/change-password`, {
//                method: 'POST',
//                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
//                body: JSON.stringify({ currentPassword: passData.current, newPassword: passData.new })
//            });
//            const data = await res.json();
//            if (res.ok) { toast.success("Contraseña actualizada"); setPassData({ current: '', new: '', confirm: '' }); }
//            else toast.error(data.error);
//        } catch (err) { toast.error("Error de conexión"); } finally { setLoading(false); }
//    };

//    return (
//        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
//            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><ShieldCheck size={20} /> Seguridad</h3>
//            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
//                <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Actual</label><input type="password" required className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={passData.current} onChange={e => setPassData({ ...passData, current: e.target.value })} /></div>
//                <div className="grid grid-cols-2 gap-4">
//                    <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nueva</label><input type="password" required className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={passData.new} onChange={e => setPassData({ ...passData, new: e.target.value })} /></div>
//                    <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Confirmar</label><input type="password" required className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={passData.confirm} onChange={e => setPassData({ ...passData, confirm: e.target.value })} /></div>
//                </div>
//                <button type="submit" disabled={loading} className="mt-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-700 transition">{loading ? "..." : "Actualizar"}</button>
//            </form>
//        </div>
//    );
//};