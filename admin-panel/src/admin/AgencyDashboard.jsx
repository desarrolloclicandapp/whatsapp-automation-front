import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import LocationDetailsModal from './LocationDetailsModal';
import SubscriptionManager from './SubscriptionManager';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import {
    LayoutGrid, CreditCard, LifeBuoy, LogOut,
    Plus, Search, Building2, Smartphone, RefreshCw,
    ExternalLink, Menu, ChevronRight, CheckCircle2,
    AlertTriangle, TrendingUp, ShieldCheck, Settings, Trash2,
    User, Users, Moon, Sun, Mail, Hash
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.clicandapp.com").replace(/\/$/, "");
const INSTALL_APP_URL = import.meta.env.INSTALL_APP_URL || "https://gestion.clicandapp.com/integration/691623d58a49cdcb2c56ce9c";
const SUPPORT_PHONE = import.meta.env.SUPPORT_PHONE || "595984756159";

export default function AgencyDashboard({ token, onLogout }) {
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

    const authFetch = async (endpoint, options = {}) => {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        // ✅ CORRECCIÓN 1: Manejo de 403 (Token Expirado)
        // Si el token es inválido o expiró, cerramos sesión inmediatamente
        if (res.status === 401 || res.status === 403) {
            onLogout();
            throw new Error("Sesión expirada");
        }
        return res;
    };

    // --- FUNCIONES DE CARGA ---
    const refreshData = async () => {
        if (!AGENCY_ID) { setLoading(false); return; }
        setLoading(true);

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
            }
        } catch (error) {
            console.error("Error refrescando datos", error);
        } finally {
            setLoading(false);
        }
    };

    const autoSyncAgency = async (locationId) => {
        setIsAutoSyncing(true); // Activa la pantalla de carga completa
        const toastId = toast.loading('Finalizando instalación...', {
            description: 'Vinculando tu cuenta de GoHighLevel...'
        });

        try {
            // ✅ CORRECCIÓN 2: Reintentos Inteligentes (Polling para Sync)
            // Esperamos a que el webhook del backend termine de guardar el tenant
            let data;
            let attempts = 0;
            const maxAttempts = 10; // Intentaremos por 20 segundos (10 x 2s)

            while (attempts < maxAttempts) {
                try {
                    // Esperamos 2 segundos entre intentos
                    await new Promise(r => setTimeout(r, 2000));

                    // Intentamos vincular (el backend verificará si el tenant ya existe)
                    const res = await authFetch(`/agency/sync-ghl`, {
                        method: "POST",
                        body: JSON.stringify({ locationIdToVerify: locationId })
                    });

                    if (res.ok) {
                        data = await res.json();
                        break; // ¡Éxito! Salimos del bucle
                    }

                    // Si responde 404, significa que el webhook aun no termina. Seguimos intentando.
                    if (res.status === 404) {
                        console.log(`⏳ Intento ${attempts + 1}: Webhook aún procesando...`);
                        attempts++;
                    } else {
                        throw new Error("Error de servidor");
                    }
                } catch (e) {
                    attempts++; // Errores de red, seguimos intentando
                }
            }

            if (!data || !data.success) {
                throw new Error("El tiempo de espera de instalación se agotó. Por favor actualiza la página.");
            }

            // --- INSTALACIÓN EXITOSA ---

            // Guardamos la nueva agencia
            localStorage.setItem("agencyId", data.newAgencyId);
            setStoredAgencyId(data.newAgencyId);

            // 3. POLLING FINAL (Verificar visibilidad en lista)
            // Aunque ya vinculamos, esperamos a que aparezca en el endpoint de locations
            let found = false;
            let retriesLoc = 0;
            const maxRetriesLoc = 5;

            while (retriesLoc < maxRetriesLoc) {
                const locRes = await authFetch(`/agency/locations?agencyId=${data.newAgencyId}`);
                if (locRes.ok) {
                    const locationsData = await locRes.json();
                    const exists = Array.isArray(locationsData) && locationsData.find(l => l.location_id === locationId);
                    if (exists) {
                        found = true;
                        setLocations(locationsData);
                        break;
                    }
                }
                await new Promise(r => setTimeout(r, 2000));
                retriesLoc++;
            }

            // 4. Resultado final
            if (found) {
                toast.success('¡Instalación completada!', { id: toastId, description: 'La subcuenta está lista.' });
            } else {
                toast.warning('Instalación exitosa', {
                    id: toastId,
                    description: 'Vinculación correcta, pero la lista tarda en actualizarse. Presiona el botón de recargar.',
                    duration: 8000
                });
            }

            // Limpiamos la URL y recargamos todo
            window.history.replaceState({}, document.title, window.location.pathname);
            if (data.newAgencyId) refreshData();

        } catch (error) {
            console.error("AutoSync Error:", error);
            toast.error(error.message || 'Error de verificación.', { id: toastId });
        } finally {
            setIsAutoSyncing(false);
        }
    };

    // --- EFECTOS DE INICIO ---
    useEffect(() => {
        const newInstallId = queryParams.get("new_install");
        if (newInstallId && !isAutoSyncing) autoSyncAgency(newInstallId);

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUserEmail(payload.email);
        } catch (e) { }
    }, []);

    useEffect(() => {
        if (AGENCY_ID) {
            refreshData();
        }
    }, [AGENCY_ID]);

    const handleDeleteTenant = async (e, locationId, name) => {
        e.stopPropagation();
        if (!confirm(`⚠️ ¿Eliminar subcuenta "${name || locationId}"?\n\nSe borrarán todos sus datos y desconectarán los WhatsApps.`)) return;

        const tId = toast.loading("Eliminando...");
        try {
            const res = await authFetch(`/agency/tenants/${locationId}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success("Subcuenta eliminada");
                refreshData();
            } else {
                throw new Error("Error al eliminar");
            }
        } catch (err) { toast.error("No se pudo eliminar"); }
        finally { toast.dismiss(tId); }
    };

    const handleInstallApp = () => {
        if (accountInfo) {
            const { used_subagencies, max_subagencies } = accountInfo.limits;
            if (used_subagencies >= max_subagencies) {
                toast.error("Cupo de Subagencias Agotado", {
                    description: "Amplía tu plan para conectar más cuentas.",
                    icon: <AlertTriangle className="text-amber-500" />,
                    action: { label: 'Ampliar Plan', onClick: () => setActiveTab('billing') }
                });
                return;
            }
        }
        window.location.href = INSTALL_APP_URL;
    };

    const filteredLocations = locations.filter(loc =>
        loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.location_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- VISTA DE BIENVENIDA (SIN AGENCIA) ---
    if (!AGENCY_ID && !isAutoSyncing) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
                <div className="text-center max-w-md w-full">
                    <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/30">
                        <Building2 className="text-white" size={40} />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">Bienvenido</h2>
                    <p className="text-gray-500 mb-8">Conecta tu cuenta de GoHighLevel para comenzar.</p>
                    <button onClick={handleInstallApp} className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-600 transition flex items-center justify-center gap-2">
                        Conectar Agencia <ExternalLink size={18} />
                    </button>
                    <button onClick={onLogout} className="mt-6 text-sm text-gray-400 hover:text-red-500">Cerrar Sesión</button>
                </div>
            </div>
        );
    }

    if (isAutoSyncing) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

    const SidebarItem = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm mb-1
                ${activeTab === id
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
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

            {/* 1. SIDEBAR */}
            <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col z-30`}>
                <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0">CA</div>
                    {sidebarOpen && <span className="ml-3 font-bold text-gray-900 dark:text-white tracking-tight">Panel Agencia</span>}
                </div>

                <div className="flex-1 p-4 overflow-y-auto">
                    <p className={`text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2 ${!sidebarOpen && 'hidden'}`}>Gestión</p>
                    <SidebarItem id="overview" icon={LayoutGrid} label="Panel Principal" />
                    <SidebarItem id="billing" icon={CreditCard} label="Suscripción" />
                    <SidebarItem id="settings" icon={Settings} label="Configuración" />

                    <div className="my-6 border-t border-gray-100 dark:border-gray-800"></div>

                    <a href={`https://wa.me/${SUPPORT_PHONE}`} target="_blank" rel="noreferrer" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50`}>
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
                            {activeTab === 'overview' ? 'Panel Principal' : activeTab === 'billing' ? 'Gestión de Suscripción' : 'Configuración de Cuenta'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800">
                            AG
                        </div>
                    </div>
                </header>

                {/* SCROLLABLE MAIN */}
                <main className="flex-1 overflow-y-auto p-6 md:p-8">

                    {/* --- VISTA 1: OVERVIEW --- */}
                    {activeTab === 'overview' && accountInfo && (
                        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* Sección A: Estadísticas Rápidas */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                <StatCard
                                    title="Subcuentas"
                                    value={`${accountInfo.limits.used_subagencies} / ${accountInfo.limits.max_subagencies}`}
                                    icon={Building2}
                                    color="bg-indigo-500"
                                />
                                <StatCard
                                    title="Conexiones WA"
                                    value={`${accountInfo.limits.used_slots} / ${accountInfo.limits.max_slots}`}
                                    icon={Smartphone}
                                    color="bg-emerald-500"
                                />
                                <StatCard
                                    title="Plan Actual"
                                    value={accountInfo.plan === 'active' ? 'Activo' : 'Trial'}
                                    subtext={accountInfo.trial_ends ? `Fin: ${new Date(accountInfo.trial_ends).toLocaleDateString()}` : null}
                                    icon={ShieldCheck}
                                    color={accountInfo.plan === 'active' ? "bg-blue-500" : "bg-amber-500"}
                                />
                                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-5 rounded-2xl text-white shadow-lg flex flex-col justify-between cursor-pointer hover:shadow-indigo-500/25 transition-shadow" onClick={() => setActiveTab('billing')}>
                                    <div>
                                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-wide mb-1">¿Necesitas más?</p>
                                        <h3 className="text-xl font-bold">Mejorar Plan</h3>
                                    </div>
                                    <div className="self-end bg-white/20 p-2 rounded-lg mt-1"><TrendingUp size={20} /></div>
                                </div>
                            </div>

                            {/* Separador Sutil */}
                            <div className="border-t border-gray-200 dark:border-gray-800"></div>

                            {/* Sección B: Gestión de Subcuentas */}
                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Users className="text-gray-400" /> Subcuentas Activas
                                    </h3>

                                    <div className="flex w-full md:w-auto gap-3">
                                        <div className="relative flex-1 md:w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Buscar..."
                                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all"
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <button onClick={refreshData} className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
                                        <button onClick={handleInstallApp} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2 text-sm shadow-lg shadow-indigo-200 dark:shadow-none whitespace-nowrap"><Plus size={18} /> Nueva</button>
                                    </div>
                                </div>

                                {loading && locations.length === 0 ? (
                                    <div className="py-20 text-center text-gray-400">Cargando datos...</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredLocations.map(loc => (
                                            <div
                                                key={loc.location_id}
                                                onClick={() => setSelectedLocation(loc)}
                                                className="group bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all duration-300 cursor-pointer relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                                                <div className="relative z-10">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="w-12 h-12 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors shadow-sm">
                                                            <Building2 size={24} />
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleDeleteTenant(e, loc.location_id, loc.name)}
                                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                                                            title="Eliminar Subcuenta"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1 truncate pr-2" title={loc.name}>{loc.name || "Sin Nombre"}</h4>
                                                    <p className="text-xs font-mono text-gray-400 mb-6 bg-gray-50 dark:bg-gray-800/50 inline-block px-1.5 py-0.5 rounded">{loc.location_id}</p>
                                                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                                                        <p className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2"><Smartphone size={16} className="text-indigo-500" /> {loc.total_slots || 0} <span className="text-gray-400 font-normal text-xs">Conexiones</span></p>
                                                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 group-hover:bg-indigo-600 group-hover:text-white transition-all"><ChevronRight size={16} /></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {!searchTerm && accountInfo && Array.from({ length: Math.max(0, accountInfo.limits.max_subagencies - locations.length) }).map((_, idx) => (
                                            <div
                                                key={`empty-${idx}`}
                                                onClick={handleInstallApp}
                                                className="group relative bg-gray-50/50 dark:bg-gray-900/20 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all duration-300 min-h-[220px]"
                                            >
                                                <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100 dark:border-gray-700 group-hover:scale-110 group-hover:border-indigo-200 transition-all">
                                                    <Plus size={32} className="text-gray-300 group-hover:text-indigo-600 dark:text-gray-600 dark:group-hover:text-indigo-400" />
                                                </div>
                                                <h4 className="font-bold text-gray-900 dark:text-white mb-1">Espacio Disponible</h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 px-6 leading-relaxed">Tienes licencia para conectar una nueva subagencia. Haz clic para instalar.</p>
                                            </div>
                                        ))}

                                        {!searchTerm && accountInfo && (accountInfo.limits.max_subagencies - locations.length) === 0 && (
                                            <div
                                                onClick={() => setActiveTab('billing')}
                                                className="group relative bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all duration-300 min-h-[220px]"
                                            >
                                                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm group-hover:bg-white/20 transition-all">
                                                    <TrendingUp size={32} className="text-white" />
                                                </div>
                                                <h4 className="font-bold text-white mb-1 text-lg">¿Necesitas más?</h4>
                                                <p className="text-xs text-indigo-100 px-4 leading-relaxed mb-4">Has usado todas tus licencias. Amplía tu plan para seguir creciendo.</p>
                                                <span className="px-4 py-2 bg-white text-indigo-600 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">Mejorar Plan</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- VISTA 2: CONFIGURACIÓN --- */}
                    {activeTab === 'settings' && (
                        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4">
                            {/* Tarjeta Perfil */}
                            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><User size={20} /> Información de la Cuenta</h3>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">ID de Agencia</label>
                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                                                <Hash size={16} className="text-gray-400" />
                                                <span className="font-mono text-gray-900 dark:text-white font-medium">{AGENCY_ID}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">Email Registrado</label>
                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                                                <Mail size={16} className="text-gray-400" />
                                                <span className="font-mono text-gray-900 dark:text-white font-medium">{userEmail || 'Cargando...'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-start gap-3">
                                        <ShieldCheck className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" size={20} />
                                        <div>
                                            <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Cuenta Verificada</h4>
                                            <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">Tu agencia tiene acceso completo a las funciones de API y automatización.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ✅ NUEVA TARJETA: SEGURIDAD (CAMBIO DE PASSWORD) */}
                            <SecurityCard token={token} />

                            {/* Tarjeta Apariencia */}
                            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">Apariencia</h3>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">Modo Oscuro</h4>
                                        <p className="text-xs text-gray-500 mt-1">Alternar entre tema claro y oscuro.</p>
                                    </div>
                                    <button
                                        onClick={toggleTheme}
                                        className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-600 dark:text-gray-300"
                                    >
                                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- VISTA 3: FACTURACIÓN / SUSCRIPCIÓN --- */}
                    {activeTab === 'billing' && (
                        <SubscriptionManager
                            token={token}
                            accountInfo={accountInfo}
                            onDataChange={refreshData}
                        />
                    )}
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

// 🔐 COMPONENTE SECURITY CARD (CAMBIO DE CONTRASEÑA)
const SecurityCard = ({ token }) => {
    const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
    const [loading, setLoading] = useState(false);

    const handleChangePassword = async (e) => {
        e.preventDefault();

        if (passData.new !== passData.confirm) {
            toast.error("Las contraseñas nuevas no coinciden");
            return;
        }
        if (passData.new.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: passData.current,
                    newPassword: passData.new
                })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success("Contraseña actualizada correctamente");
                setPassData({ current: '', new: '', confirm: '' }); // Limpiar form
            } else {
                toast.error(data.error || "Error al actualizar");
            }
        } catch (err) {
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <ShieldCheck size={20} /> Seguridad
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña Actual</label>
                    <input
                        type="password"
                        required
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-colors"
                        value={passData.current}
                        onChange={e => setPassData({ ...passData, current: e.target.value })}
                        placeholder="••••••••"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nueva Contraseña</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-colors"
                            value={passData.new}
                            onChange={e => setPassData({ ...passData, new: e.target.value })}
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Nueva</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-colors"
                            value={passData.confirm}
                            onChange={e => setPassData({ ...passData, confirm: e.target.value })}
                            placeholder="Repetir contraseña"
                        />
                    </div>
                </div>
                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:-translate-y-0.5"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                        Actualizar Contraseña
                    </button>
                </div>
            </form>
        </div>
    );
};