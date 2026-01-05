import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import LocationDetailsModal from './LocationDetailsModal';
import SubscriptionManager from './SubscriptionManager';
import SubscriptionModal from './SubscriptionModal'; 
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { useBranding } from '../context/BrandingContext'; // ✅ Importamos el contexto de marca

import {
    LayoutGrid, CreditCard, LifeBuoy, LogOut,
    Plus, Search, Building2, Smartphone, RefreshCw,
    ExternalLink, Menu, ChevronRight, CheckCircle2,
    AlertTriangle, TrendingUp, ShieldCheck, Settings, Trash2,
    User, Users, Moon, Sun, Mail, Hash, Palette, Image as ImageIcon, RotateCcw
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");
const INSTALL_APP_URL = import.meta.env.INSTALL_APP_URL || "https://gestion.clicandapp.com/integration/691623d58a49cdcb2c56ce9c";
const SUPPORT_PHONE = import.meta.env.SUPPORT_PHONE || "595984756159";

export default function AgencyDashboard({ token, onLogout }) {
    // ✅ Hook de Branding para Marca Blanca
    const { branding, updateBranding, resetBranding, DEFAULT_BRANDING } = useBranding();

    const [storedAgencyId, setStoredAgencyId] = useState(localStorage.getItem("agencyId"));
    const queryParams = new URLSearchParams(window.location.search);
    const AGENCY_ID = storedAgencyId || queryParams.get("agencyId");
    const { theme, toggleTheme } = useTheme();

    // Estado de UI
    const [activeTab, setActiveTab] = useState('overview');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Datos
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAutoSyncing, setIsAutoSyncing] = useState(false);

    const [accountInfo, setAccountInfo] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [userEmail, setUserEmail] = useState("");

    // Bloqueo de cuenta
    const [isAccountSuspended, setIsAccountSuspended] = useState(false);

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

    // --- FUNCIONES DE CARGA ---
    const refreshData = async () => {
        if (!AGENCY_ID) { setLoading(false); return; }
        if (!accountInfo) setLoading(true); 

        try {
            const [locRes, accRes] = await Promise.all([
                authFetch(`/agency/locations?agencyId=${AGENCY_ID}`),
                authFetch('/agency/info')
            ]);

            if (locRes.ok) {
                const data = await locRes.json();
                if (Array.isArray(data)) setLocations(data);
            }
            
            if (accRes.ok) {
                const data = await accRes.json();
                setAccountInfo(data);

                // Lógica de Bloqueo
                const planStatus = (data.plan || '').toLowerCase();
                
                if (planStatus === 'suspended' || planStatus === 'cancelled' || planStatus === 'past_due') {
                    setIsAccountSuspended(true);
                } else if (planStatus === 'trial' && data.trial_ends) {
                    const now = new Date();
                    const end = new Date(data.trial_ends);
                    if (!isNaN(end.getTime()) && end < now) {
                        setIsAccountSuspended(true);
                    } else {
                        setIsAccountSuspended(false);
                    }
                } else {
                    setIsAccountSuspended(false);
                }
            }
        } catch (error) {
            console.error("Error refrescando datos", error);
        } finally {
            setLoading(false);
        }
    };

    const autoSyncAgency = async (locationId) => {
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
                        body: JSON.stringify({ locationIdToVerify: locationId })
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
            
            // Recargar para ver la nueva location
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
        const targetLocationId = queryParams.get("location_id") || queryParams.get("new_install");
        if (targetLocationId && !isAutoSyncing) autoSyncAgency(targetLocationId);
        try { const payload = JSON.parse(atob(token.split('.')[1])); setUserEmail(payload.email); } catch (e) { }
    }, []);

    useEffect(() => {
        if (AGENCY_ID) {
            refreshData();
            const interval = setInterval(refreshData, 30000); // Polling cada 30s
            return () => clearInterval(interval);
        }
    }, [AGENCY_ID]);

    const handleDeleteTenant = async (e, locationId, name) => {
        e.stopPropagation();
        if (!confirm(`⚠️ ¿Eliminar subcuenta "${name || locationId}"?`)) return;
        const tId = toast.loading("Eliminando...");
        try {
            const res = await authFetch(`/agency/tenants/${locationId}`, { method: 'DELETE' });
            if (res.ok) { toast.success("Eliminado", {id: tId}); refreshData(); }
            else throw new Error("Error");
        } catch (err) { toast.error("Error", {id: tId}); }
    };

    const handleInstallApp = () => { window.location.href = INSTALL_APP_URL; };

    const filteredLocations = locations.filter(loc =>
        loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.location_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- COMPONENTE DE CONFIGURACIÓN DE MARCA (WHITE LABEL) ---
    const WhiteLabelSettings = () => {
        const [form, setForm] = useState(branding);

        const handleSave = (e) => {
            e.preventDefault();
            updateBranding(form);
            toast.success("Marca actualizada correctamente 🎨");
        };

        const handleReset = () => {
            if(confirm("¿Restaurar la marca original de WaFloW.ai?")) {
                resetBranding();
                setForm(DEFAULT_BRANDING);
                toast.success("Marca restaurada");
            }
        };

        return (
            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-right-4">
                <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Palette size={24} style={{color: branding.primaryColor}} /> Marca Blanca
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Personaliza el panel con tu propia identidad visual.</p>
                    </div>
                    <div className="flex gap-2">
                        <span className="px-3 py-1 text-xs font-bold uppercase rounded-full border bg-indigo-50 text-indigo-600 border-indigo-100">
                            Pro Feature
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-8">
                    {/* Sección Identidad */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">Identidad</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nombre de Agencia</label>
                                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 transition-all" style={{'--tw-ring-color': branding.primaryColor}} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Slogan</label>
                                <input type="text" value={form.slogan} onChange={e => setForm({...form, slogan: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 transition-all" style={{'--tw-ring-color': branding.primaryColor}} />
                            </div>
                        </div>
                    </div>

                    {/* Sección Gráficos */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">Gráficos</h4>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Logo URL (Cuadrado/PNG)</label>
                            <div className="flex gap-4 items-center">
                                <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0 shadow-sm">
                                    <img src={form.logoUrl} alt="Preview" className="w-full h-full object-contain" onError={(e) => e.target.style.display='none'} />
                                </div>
                                <input type="url" value={form.logoUrl} onChange={e => setForm({...form, logoUrl: e.target.value})} className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 transition-all" style={{'--tw-ring-color': branding.primaryColor}} placeholder="https://..." />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Fondo Login URL</label>
                            <div className="flex gap-4 items-center">
                                <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0 shadow-sm">
                                    <img src={form.loginImage} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.target.style.display='none'} />
                                </div>
                                <input type="url" value={form.loginImage} onChange={e => setForm({...form, loginImage: e.target.value})} className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 transition-all" style={{'--tw-ring-color': branding.primaryColor}} placeholder="https://..." />
                            </div>
                        </div>
                    </div>

                    {/* Sección Colores */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">Colores</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Color Primario (Botones/Links)</label>
                                <div className="flex items-center gap-3">
                                    <input type="color" value={form.primaryColor} onChange={e => setForm({...form, primaryColor: e.target.value})} className="h-10 w-10 rounded-lg cursor-pointer border-0 shadow-sm" />
                                    <input type="text" value={form.primaryColor} readOnly className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 font-mono text-sm uppercase" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Color Acento (Detalles)</label>
                                <div className="flex items-center gap-3">
                                    <input type="color" value={form.accentColor} onChange={e => setForm({...form, accentColor: e.target.value})} className="h-10 w-10 rounded-lg cursor-pointer border-0 shadow-sm" />
                                    <input type="text" value={form.accentColor} readOnly className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 font-mono text-sm uppercase" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex items-center gap-4 border-t border-gray-100 dark:border-gray-800">
                        <button type="submit" className="text-white px-6 py-3 rounded-xl font-bold transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2" style={{backgroundColor: branding.primaryColor}}>
                            <CheckCircle2 size={18} /> Guardar Cambios
                        </button>
                        <button type="button" onClick={handleReset} className="text-gray-500 hover:text-red-500 font-medium text-sm transition flex items-center gap-2 px-4">
                            <RotateCcw size={16} /> Restaurar Defaults
                        </button>
                    </div>
                </form>
            </div>
        );
    };

    // --- VISTA DE BIENVENIDA (SIN AGENCIA) ---
    if (!AGENCY_ID && !isAutoSyncing) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
                <div className="text-center max-w-md w-full">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl" style={{backgroundColor: branding.primaryColor}}>
                        <Building2 className="text-white" size={40} />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">Bienvenido a {branding.name}</h2>
                    <p className="text-gray-500 mb-8">Conecta tu cuenta de GoHighLevel para comenzar.</p>
                    <button onClick={handleInstallApp} className="w-full text-white py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 hover:opacity-90 shadow-lg" style={{backgroundColor: branding.primaryColor}}>
                        Conectar Agencia <ExternalLink size={18} />
                    </button>
                    <button onClick={onLogout} className="mt-6 text-sm text-gray-400 hover:text-red-500">Cerrar Sesión</button>
                </div>
            </div>
        );
    }

    if (isAutoSyncing) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin w-12 h-12 border-4 border-t-transparent rounded-full" style={{borderColor: branding.primaryColor}}></div></div>;

    const SidebarItem = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm mb-1
                ${activeTab === id
                    ? 'font-bold'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
            style={activeTab === id ? { color: branding.primaryColor, backgroundColor: branding.primaryColor + '15' } : {}}
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
            <div className={`p-2.5 rounded-xl ${color}`}>
                <Icon size={22} className="text-white" />
            </div>
        </div>
    );

    // --- RENDER PRINCIPAL ---
    return (
        <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#0f1117] font-sans overflow-hidden">

            {/* 🔥 MODAL DE BLOQUEO (Plan Vencido) */}
            {isAccountSuspended && (
                <div style={{ position: 'fixed', zIndex: 9999, inset: 0, backgroundColor: 'rgba(0,0,0,0.8)' }} className="flex items-center justify-center backdrop-blur-sm">
                    <div className="w-full max-w-5xl h-[90vh]">
                        <SubscriptionModal token={token} accountInfo={accountInfo || { limits: { max_subagencies: 0 } }} onClose={() => {}} blocking={true} />
                    </div>
                </div>
            )}

            {/* 1. SIDEBAR */}
            <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col z-30`}>
                <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shrink-0 overflow-hidden" style={{backgroundColor: branding.primaryColor}}>
                        {/* Logo Dinámico */}
                        <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-cover" onError={(e) => e.target.style.display='none'} />
                        {/* Fallback si la imagen falla */}
                        <span className="absolute">{!branding.logoUrl && "W"}</span>
                    </div>
                    {/* Nombre Dinámico */}
                    {sidebarOpen && <span className="ml-3 font-bold text-gray-900 dark:text-white tracking-tight truncate">{branding.name}</span>}
                </div>

                <div className="flex-1 p-4 overflow-y-auto">
                    <p className={`text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2 ${!sidebarOpen && 'hidden'}`}>Gestión</p>
                    <SidebarItem id="overview" icon={LayoutGrid} label="Panel Principal" />
                    <SidebarItem id="billing" icon={CreditCard} label="Suscripción" />
                    <SidebarItem id="settings" icon={Settings} label="Configuración" />

                    <div className="my-6 border-t border-gray-100 dark:border-gray-800"></div>

                    <a href={`https://wa.me/${SUPPORT_PHONE}`} target="_blank" rel="noreferrer" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10`} 
                       style={{':hover': { color: branding.primaryColor }}}>
                        <LifeBuoy size={20} />
                        {sidebarOpen && <span>Soporte Técnico</span>}
                    </a>
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                    <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all font-medium text-sm">
                        <LogOut size={20} />
                        {sidebarOpen && <span>Cerrar Sesión</span>}
                    </button>
                </div>
            </aside>

            {/* 2. AREA DE CONTENIDO */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[#F8FAFC] dark:bg-[#0f1117]">

                {/* TOP HEADER */}
                <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800 flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500">
                            <Menu size={20} />
                        </button>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                            {activeTab === 'overview' ? 'Panel Principal' : activeTab === 'billing' ? 'Gestión de Suscripción' : 'Configuración'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs border border-white/20 shadow-sm" style={{backgroundColor: branding.primaryColor}}>
                            AG
                        </div>
                    </div>
                </header>

                {/* SCROLLABLE MAIN */}
                <main className="flex-1 overflow-y-auto p-6 md:p-8">

                    {/* --- VISTA 1: OVERVIEW --- */}
                    {activeTab === 'overview' && accountInfo && (
                        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                <StatCard title="Subcuentas" value={`${accountInfo.limits.used_subagencies} / ${accountInfo.limits.max_subagencies}`} icon={Building2} color="bg-indigo-500" />
                                <StatCard title="Conexiones WA" value={`${accountInfo.limits.used_slots} / ${accountInfo.limits.max_slots}`} icon={Smartphone} color="bg-emerald-500" />
                                <StatCard title="Plan Actual" value={accountInfo.plan === 'active' ? 'Activo' : 'Trial'} subtext={accountInfo.trial_ends ? `Fin: ${new Date(accountInfo.trial_ends).toLocaleDateString()}` : null} icon={ShieldCheck} color={accountInfo.plan === 'active' ? "bg-blue-500" : "bg-amber-500"} />
                                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-5 rounded-2xl text-white shadow-lg flex flex-col justify-between cursor-pointer hover:shadow-indigo-500/25 transition-shadow" onClick={() => setActiveTab('billing')}>
                                    <div><p className="text-indigo-200 text-xs font-bold uppercase tracking-wide mb-1">¿Necesitas más?</p><h3 className="text-xl font-bold">Mejorar Plan</h3></div>
                                    <div className="self-end bg-white/20 p-2 rounded-lg mt-1"><TrendingUp size={20} /></div>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-800"></div>

                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Users className="text-gray-400" /> Subcuentas Activas</h3>
                                    <div className="flex w-full md:w-auto gap-3">
                                        <div className="relative flex-1 md:w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 outline-none text-sm dark:text-white transition-all" style={{'--tw-ring-color': branding.primaryColor}} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                        </div>
                                        <button onClick={refreshData} className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:text-indigo-600 transition"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
                                        <button onClick={handleInstallApp} className="px-5 py-2.5 text-white rounded-xl font-bold transition flex items-center gap-2 text-sm shadow-lg hover:opacity-90" style={{backgroundColor: branding.primaryColor}}><Plus size={18} /> Nueva</button>
                                    </div>
                                </div>

                                {loading && locations.length === 0 ? <div className="py-20 text-center text-gray-400">Cargando datos...</div> : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredLocations.map(loc => (
                                            <div key={loc.location_id} onClick={() => setSelectedLocation(loc)} className="group bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer relative overflow-hidden hover:border-indigo-500">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                                <div className="relative z-10">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="w-12 h-12 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-indigo-600 transition-colors shadow-sm"><Building2 size={24} /></div>
                                                        <button onClick={(e) => handleDeleteTenant(e, loc.location_id, loc.name)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                                                    </div>
                                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1 truncate pr-2">{loc.name || "Sin Nombre"}</h4>
                                                    <p className="text-xs font-mono text-gray-400 mb-6 bg-gray-50 dark:bg-gray-800/50 inline-block px-1.5 py-0.5 rounded">{loc.location_id}</p>
                                                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                                                        <p className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2"><Smartphone size={16} className="text-indigo-500" /> {loc.total_slots || 0} <span className="text-gray-400 font-normal text-xs">Conexiones</span></p>
                                                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 group-hover:bg-indigo-600 group-hover:text-white transition-all"><ChevronRight size={16} /></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {!searchTerm && accountInfo && Array.from({ length: Math.max(0, accountInfo.limits.max_subagencies - locations.length) }).map((_, idx) => (
                                            <div key={`empty-${idx}`} onClick={handleInstallApp} className="group relative bg-gray-50/50 dark:bg-gray-900/20 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500 transition-all duration-300 min-h-[220px]">
                                                <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-all"><Plus size={32} className="text-gray-300 group-hover:text-indigo-600" /></div>
                                                <h4 className="font-bold text-gray-900 dark:text-white mb-1">Espacio Disponible</h4>
                                                <p className="text-xs text-gray-500 px-6">Tienes licencia para conectar una nueva subagencia.</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- VISTA 2: SETTINGS (Con Marca Blanca) --- */}
                    {activeTab === 'settings' && (
                        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4">
                            
                            {/* Tarjeta Perfil */}
                            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><User size={20} /> Información de la Cuenta</h3>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label className="block text-sm font-medium text-gray-500 mb-1.5">ID de Agencia</label><div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 font-mono font-medium">{AGENCY_ID}</div></div>
                                        <div><label className="block text-sm font-medium text-gray-500 mb-1.5">Email Registrado</label><div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 font-medium">{userEmail || 'Cargando...'}</div></div>
                                    </div>
                                </div>
                            </div>

                            {/* ✅ TARJETA DE MARCA BLANCA */}
                            <WhiteLabelSettings />

                            {/* Tarjeta Seguridad */}
                            <SecurityCard token={token} />

                            {/* Tarjeta Apariencia */}
                            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
                                <div><h4 className="text-sm font-bold text-gray-900 dark:text-white">Modo Oscuro</h4><p className="text-xs text-gray-500 mt-1">Alternar tema.</p></div>
                                <button onClick={toggleTheme} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 transition text-gray-600 dark:text-gray-300">{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
                            </div>
                        </div>
                    )}

                    {/* --- VISTA 3: BILLING --- */}
                    {activeTab === 'billing' && <SubscriptionManager token={token} accountInfo={accountInfo} onDataChange={refreshData} />}
                </main>
            </div>

            {/* MODALES */}
            {selectedLocation && (
                <LocationDetailsModal
                    location={selectedLocation}
                    token={token}
                    onLogout={onLogout}
                    onClose={() => setSelectedLocation(null)}
                    onUpgrade={() => setActiveTab('billing')}
                    onDataChange={refreshData}
                />
            )}
        </div>
    );
}

// ... (SecurityCard y otros subcomponentes se mantienen igual, solo asegúrate de que SecurityCard esté definido al final del archivo como antes) ...

// 🔐 COMPONENTE SECURITY CARD (CAMBIO DE CONTRASEÑA)
const SecurityCard = ({ token }) => {
    const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
    const [loading, setLoading] = useState(false);

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passData.new !== passData.confirm) return toast.error("Las contraseñas no coinciden");
        if (passData.new.length < 6) return toast.error("Mínimo 6 caracteres");

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ currentPassword: passData.current, newPassword: passData.new })
            });
            const data = await res.json();
            if (res.ok) { toast.success("Contraseña actualizada"); setPassData({ current: '', new: '', confirm: '' }); }
            else toast.error(data.error);
        } catch (err) { toast.error("Error de conexión"); } finally { setLoading(false); }
    };

    return (
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><ShieldCheck size={20} /> Seguridad</h3>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                <div><label className="block text-sm font-medium mb-1">Actual</label><input type="password" required className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={passData.current} onChange={e => setPassData({ ...passData, current: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium mb-1">Nueva</label><input type="password" required className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={passData.new} onChange={e => setPassData({ ...passData, new: e.target.value })} /></div>
                    <div><label className="block text-sm font-medium mb-1">Confirmar</label><input type="password" required className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={passData.confirm} onChange={e => setPassData({ ...passData, confirm: e.target.value })} /></div>
                </div>
                <button type="submit" disabled={loading} className="mt-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-700 transition">{loading ? "..." : "Actualizar"}</button>
            </form>
        </div>
    );
};