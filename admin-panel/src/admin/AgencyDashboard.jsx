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
const SUPPORT_PHONE = import.meta.env.SUPPORT_PHONE || "595984756159";

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
        const toastId = toast.loading('Finalizando instalación...');

        try {
            let data;
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
                try {
                    await new Promise(r => setTimeout(r, 2000));
                    const res = await authFetch(`/agency/sync-ghl`, {
                        method: "POST",
                        body: JSON.stringify({ locationIdToVerify: locationId, code: code })
                    });

                    if (res.ok) {
                        data = await res.json();
                        break;
                    }
                    if (res.status === 404) attempts++;
                    else throw new Error("Error de servidor");
                } catch (e) { attempts++; }
            }

            if (!data || !data.success) throw new Error("Tiempo de espera agotado.");

            localStorage.setItem("agencyId", data.newAgencyId);
            setStoredAgencyId(data.newAgencyId);

            refreshData();
            toast.success('¡Instalación completada!', { id: toastId });
            window.history.replaceState({}, document.title, window.location.pathname);

        } catch (error) {
            toast.error(error.message, { id: toastId });
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
        <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#0B0D11] font-sans overflow-hidden text-gray-900 dark:text-gray-100">
            {isAccountSuspended && <SubscriptionBlocker token={token} onLogout={onLogout} />}
            {showUpgradeModal && <SubscriptionModal token={token} accountInfo={accountInfo} onClose={() => setShowUpgradeModal(false)} onDataChange={refreshData} />}

            <aside className={`${sidebarOpen ? 'w-72' : 'w-20'} bg-white dark:bg-[#11131A] border-r border-gray-100 dark:border-gray-800 transition-all duration-300 flex flex-col z-30 shadow-sm`}>
                <div className="h-18 flex items-center px-6 py-5 border-b border-gray-50 dark:border-gray-800/50">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shrink-0 overflow-hidden shadow-sm" style={{ backgroundColor: branding.primaryColor }}>
                        <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                    {sidebarOpen && <span className="ml-3 font-bold text-gray-900 dark:text-white tracking-tight truncate text-lg">{branding.name}</span>}
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-1">
                    <div className={`px-2 mb-2 ${!sidebarOpen && 'hidden'}`}>
                         <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{t('dash.nav.management')}</p>
                    </div>
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="overview" icon={LayoutGrid} label={t('dash.nav.overview')} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="billing" icon={CreditCard} label={t('dash.nav.billing')} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="settings" icon={Settings} label={t('dash.nav.settings')} branding={branding} sidebarOpen={sidebarOpen} />

                    <div className="my-4 border-t border-dashed border-gray-200 dark:border-gray-800 mx-2"></div>

                    <a href={`https://wa.me/${SUPPORT_PHONE}`} target="_blank" rel="noreferrer" className={`group w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400`}>
                        <LifeBuoy size={20} className="group-hover:scale-110 transition-transform" />
                        {sidebarOpen && <span>{t('dash.nav.support')}</span>}
                    </a>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={onLogout} className="group w-full flex items-center gap-3 px-3.5 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all font-medium text-sm">
                        <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                        {sidebarOpen && <span>{t('dash.nav.logout')}</span>}
                    </button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
                <header className="h-18 bg-white/70 dark:bg-[#11131A]/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800 flex items-center justify-between px-6 py-4 z-20 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors">
                            <Menu size={20} />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white capitalize tracking-tight">
                                {activeTab === 'overview' ? t('dash.header.overview') : activeTab === 'billing' ? t('dash.header.billing') : t('dash.header.settings')}
                            </h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <LanguageSelector />
                        <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1"></div>
                        <ThemeToggle />
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 border-white dark:border-gray-700 shadow-sm ring-2 ring-gray-100 dark:ring-gray-800" style={{ backgroundColor: branding.primaryColor }}>
                            AG
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6 md:p-8">
                    {activeTab === 'overview' && (
                        !accountInfo ? (<div className="flex justify-center items-center h-full text-gray-400"><RefreshCw className="animate-spin mr-2" /> Cargando panel...</div>) : (
                            <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <StatCard title={t('dash.stats.subaccounts')} value={`${accountInfo.limits?.used_subagencies || 0} / ${accountInfo.limits?.max_subagencies || 0}`} icon={Building2} color="indigo" />
                                    <StatCard title={t('dash.stats.connections')} value={`${accountInfo.limits?.used_slots || 0} / ${accountInfo.limits?.max_slots || 0}`} icon={Smartphone} color="emerald" />
                                    <StatCard title={t('dash.stats.plan')} value={accountInfo.plan === 'active' ? t('dash.stats.active') : t('dash.stats.trial')} subtext={accountInfo.trial_ends ? `Fin: ${new Date(accountInfo.trial_ends).toLocaleDateString()}` : null} icon={ShieldCheck} color={accountInfo.plan === 'active' ? "blue" : "amber"} />

                                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 rounded-2xl text-white shadow-xl shadow-indigo-200 dark:shadow-none flex flex-col justify-between cursor-pointer group hover:scale-[1.02] transition-all duration-300 relative overflow-hidden ring-1 ring-white/10" onClick={() => setActiveTab('billing')}>
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl -ml-6 -mb-6"></div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/10">Premium</span>
                                            </div>
                                            <h3 className="text-xl font-bold leading-tight">{t('dash.upgrade.title')}</h3>
                                            <p className="text-indigo-100 text-xs mt-2 opacity-90 line-clamp-2">{t('dash.upgrade.prompt')}</p>
                                        </div>
                                        <div className="self-end bg-white/20 p-2 rounded-xl mt-4 backdrop-blur-sm group-hover:bg-white group-hover:text-indigo-600 transition-colors shadow-inner">
                                            <TrendingUp size={20} />
                                        </div>
                                    </div>
                                </div>

                                {accountInfo.plan === 'trial' && (
                                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-1 rounded-3xl animate-in fade-in zoom-in-95 duration-500">
                                        <div className="bg-white/50 dark:bg-transparent p-6 rounded-[20px] flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-sm">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200 dark:shadow-none">
                                                    <Zap size={28} fill="currentColor" />
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">Periodo de Prueba Activo (Trial)</h4>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
                                                        Tu acceso gratuito vence el <span className="font-bold text-amber-600 dark:text-amber-400">{new Date(accountInfo.trial_ends).toLocaleDateString()}</span>. Contrata un plan para evitar interrupciones.
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={() => setActiveTab('billing')} className="w-full md:w-auto px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:scale-95">
                                                Elegir un Plan <ArrowRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Users size={24} className="text-gray-400" /> {t('dash.subs.title')}
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">Gestiona tus subcuentas conectadas.</p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
                                            <div className="relative flex-1 sm:w-64">
                                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                <input
                                                    type="text"
                                                    autoComplete="off"
                                                    placeholder={t('dash.subs.search')}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 outline-none text-sm dark:text-white transition-all shadow-sm"
                                                    style={{ '--tw-ring-color': branding.primaryColor }}
                                                    value={searchTerm}
                                                    onChange={e => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={refreshData} className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 transition shadow-sm">
                                                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                                                </button>
                                                <button onClick={handleInstallApp} className="px-5 py-2.5 text-white rounded-xl font-bold transition flex items-center gap-2 text-sm shadow-lg hover:opacity-90 hover:-translate-y-0.5" style={{ backgroundColor: branding.primaryColor }}>
                                                    <Plus size={18} /> {t('dash.subs.new')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {loading && locations.length === 0 ? <div className="py-20 text-center text-gray-400">Cargando datos...</div> : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {filteredLocations.map(loc => (
                                                <div key={loc.location_id} onClick={() => setSelectedLocation(loc)} className="group bg-white dark:bg-[#11131A] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col h-full">
                                                    <div className="p-6 flex-1">
                                                        <div className="flex justify-between items-start mb-5">
                                                            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-indigo-600 group-hover:bg-white group-hover:border-indigo-100 transition-all shadow-sm">
                                                                <Building2 size={22} strokeWidth={1.5} />
                                                            </div>
                                                            <button
                                                                onClick={(e) => handleDeleteTenant(e, loc.location_id, loc.name)}
                                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:text-gray-600 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1 truncate group-hover:text-indigo-600 transition-colors">{loc.name || "Sin Nombre"}</h4>
                                                        <div className="flex items-center gap-2 mb-2">
                                                             <p className="text-xs font-mono text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-100 dark:border-gray-700 truncate max-w-full">{loc.location_id}</p>
                                                        </div>
                                                    </div>
                                                    <div className="px-6 py-4 bg-gray-50/80 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between mt-auto">
                                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${loc.total_slots > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
                                                            {loc.total_slots || 0} conexiones
                                                        </p>
                                                        <div className="w-6 h-6 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shadow-sm">
                                                            <ChevronRight size={14} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {!searchTerm && accountInfo && Array.from({ length: Math.max(0, (accountInfo.limits?.max_subagencies || 0) - locations.length) }).map((_, idx) => (
                                                <div key={`empty-${idx}`} onClick={handleInstallApp} className="group relative bg-gray-50/30 dark:bg-gray-900/10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all duration-300 min-h-[240px]">
                                                    <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all">
                                                        <Plus size={24} className="text-gray-400 group-hover:text-indigo-600" />
                                                    </div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white mb-1 text-sm">Disponible</h4>
                                                    <p className="text-xs text-gray-500 px-4 leading-relaxed">Conectar nueva subagencia</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 pb-10">
                            {/* Account Info Card */}
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <User size={20} className="text-gray-400" /> Información de la Cuenta
                                    </h3>
                                </div>
                                <div className="p-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">ID de Agencia</label>
                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 font-mono font-medium dark:text-gray-200">
                                                <Key size={16} className="text-gray-400" />
                                                <span className="flex-1 truncate">{AGENCY_ID}</span>
                                                <button onClick={() => {navigator.clipboard.writeText(AGENCY_ID); toast.success("ID copiado")}} className="text-gray-400 hover:text-indigo-600 transition"><Copy size={16} /></button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Email Registrado</label>
                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 font-medium dark:text-gray-200">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                {userEmail || 'Cargando...'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CRM Domain Config */}
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between md:items-center gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <Globe size={20} className="text-blue-500" /> Configuración de Dominio CRM
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                                            Define el dominio donde instalarás las subcuentas (ej: <b>app.gohighlevel.com</b> o tu marca blanca).
                                        </p>
                                    </div>
                                    <button 
                                        onClick={handleSaveCrmDomain}
                                        className="bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-gray-900 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-transform active:scale-95 flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <Save size={16} /> Guardar Dominio
                                    </button>
                                </div>
                                <div className="p-8">
                                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                        <label className="block text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Dominio de Instalación</label>
                                        <div className="flex shadow-sm rounded-xl overflow-hidden transition-shadow focus-within:shadow-md ring-1 ring-gray-200 dark:ring-gray-700 focus-within:ring-2 focus-within:ring-blue-500">
                                            <div className="px-4 py-3.5 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 text-gray-500 font-medium select-none flex items-center">https://</div>
                                            <input
                                                type="text"
                                                className="flex-1 p-3.5 bg-white dark:bg-gray-900 dark:text-white outline-none font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600"
                                                value={crmDomain}
                                                onChange={(e) => setCrmDomain(e.target.value)}
                                                placeholder="app.gohighlevel.com"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 mt-3 text-xs text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/20 px-3 py-2 rounded-lg w-fit">
                                            <Link size={12} />
                                            <span>Link de instalación actual:</span>
                                            <span className="font-mono font-bold">https://{crmDomain}/integration/{APP_ID}</span>
                                        </div>
                                    </div>
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

const SidebarItem = ({ id, icon: Icon, label, activeTab, setActiveTab, branding, sidebarOpen }) => {
    const isActive = activeTab === id;
    const activeColor = branding?.primaryColor || '#4F46E5';

    return (
        <button
            onClick={() => setActiveTab(id)}
            className={`
                group w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 ease-in-out font-medium text-sm mb-1.5
                ${isActive ? 'shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'}
            `}
            style={isActive ? {
                color: activeColor,
                backgroundColor: `${activeColor}15`, // 15% opacity
                boxShadow: `inset 3px 0 0 0 ${activeColor}` // Left border indicator effect
            } : {}}
        >
            <Icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
            {sidebarOpen && <span className="truncate">{label}</span>}
        </button>
    );
};

const StatCard = ({ title, value, subtext, icon: Icon, color }) => {
    // Mapping for new clean style based on the passed color class
    const getColorStyles = (colorClass) => {
        if (colorClass.includes('indigo')) return { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400' };
        if (colorClass.includes('emerald')) return { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' };
        if (colorClass.includes('blue')) return { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' };
        if (colorClass.includes('amber')) return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' };
        return { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' };
    };

    const styles = getColorStyles(color || '');

    return (
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300 flex items-start justify-between group">
            <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
                <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{value}</h3>
                {subtext && <p className="text-xs font-medium text-gray-500 flex items-center gap-1">{subtext}</p>}
            </div>
            <div className={`p-3 rounded-xl ${styles.bg} ${styles.text} shadow-sm group-hover:scale-105 transition-transform duration-300`}>
                <Icon size={24} strokeWidth={2} />
            </div>
        </div>
    );
};

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