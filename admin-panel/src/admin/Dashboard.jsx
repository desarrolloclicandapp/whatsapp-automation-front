import React, { useState, useEffect } from 'react';
import SupportManager from './SupportManager';
import LocationDetailsModal from './LocationDetailsModal';
import ThemeToggle from '../components/ThemeToggle';
import {
    Settings, Search, CheckCircle,
    RefreshCw, Building2, Smartphone,
    ArrowLeft, LogOut
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.clicandapp.com").replace(/\/$/, "");

export default function AdminDashboard({ token, onLogout }) {
    const [view, setView] = useState('agencies');
    const [selectedAgency, setSelectedAgency] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);

    const [agencies, setAgencies] = useState([]);
    const [subaccounts, setSubaccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

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

    const fetchAgencies = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`/admin/agencies`);
            const data = await res.json();
            setAgencies(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error cargando agencias:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubaccounts = async (agencyId) => {
        setLoading(true);
        try {
            const safeId = encodeURIComponent(agencyId);
            const res = await authFetch(`/admin/tenants?agencyId=${safeId}`);
            const data = await res.json();
            setSubaccounts(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error cargando subcuentas:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgencies();
    }, []);

    const handleAgencyClick = (agency) => {
        setSelectedAgency(agency);
        setView('subaccounts');
        setSearchTerm("");
        fetchSubaccounts(agency.agency_id);
    };

    const handleBackToAgencies = () => {
        setSelectedAgency(null);
        setView('agencies');
        setSearchTerm("");
        setSubaccounts([]);
        fetchAgencies();
    };

    const filteredAgencies = agencies.filter(a => {
        const term = searchTerm.toLowerCase();
        const idMatch = a.agency_id && a.agency_id.toLowerCase().includes(term);
        const nameMatch = a.agency_name && a.agency_name.toLowerCase().includes(term);
        return idMatch || nameMatch;
    });

    const filteredSubaccounts = subaccounts.filter(s => {
        const term = searchTerm.toLowerCase();
        const nameMatch = s.name && s.name.toLowerCase().includes(term);
        const idMatch = s.location_id && s.location_id.toLowerCase().includes(term);
        return nameMatch || idMatch;
    });

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
            {/* HEADER */}
            <header className="bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-800 sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {view === 'subaccounts' && (
                            <button
                                onClick={handleBackToAgencies}
                                className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition text-gray-600 dark:text-gray-300"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
                            CA
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-tight text-gray-900 dark:text-white">
                                {view === 'agencies' ? 'Panel Maestro' : `Agencia: ${selectedAgency?.agency_name}`}
                            </h1>
                            {view === 'subaccounts' && <p className="text-xs text-gray-500 dark:text-gray-400">Gestionando {subaccounts.length} subcuentas</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <ThemeToggle />

                        <button
                            onClick={() => view === 'agencies' ? fetchAgencies() : fetchSubaccounts(selectedAgency.agency_id)}
                            className="p-2.5 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 bg-gray-100 dark:bg-gray-800 rounded-lg transition hover:scale-105"
                            title="Recargar datos"
                        >
                            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                        </button>

                        <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

                        <button
                            onClick={onLogout}
                            className="p-2.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30 transition font-medium text-sm flex items-center gap-2"
                        >
                            <LogOut size={18} />
                            <span className="hidden sm:inline">Salir</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* BARRA SUPERIOR (SEARCH + SUPPORT) */}
                <div className="mb-8 space-y-6">
                    {/* Bot de soporte solo visible en vista principal */}
                    {view === 'agencies' && <SupportManager token={token} />}

                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder={view === 'agencies' ? "Buscar agencia..." : "Buscar subcuenta..."}
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm text-sm text-gray-900 dark:text-white placeholder-gray-400 transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* VISTA 1: AGENCIAS */}
                {view === 'agencies' && (
                    <>
                        {loading ? (
                            <div className="text-center py-24">
                                <RefreshCw className="animate-spin mx-auto text-indigo-600 dark:text-indigo-400 mb-4" size={40} />
                                <p className="text-gray-500 dark:text-gray-400 text-lg">Cargando agencias...</p>
                            </div>
                        ) : filteredAgencies.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                                <Building2 className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={64} />
                                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No se encontraron agencias.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredAgencies.map((agency) => (
                                    <div
                                        key={agency.agency_id}
                                        onClick={() => handleAgencyClick(agency)}
                                        className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-300 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition transform group-hover:scale-110 duration-500">
                                            <Building2 size={80} className="text-indigo-900 dark:text-white" />
                                        </div>

                                        <div className="relative z-10">
                                            <div className="flex items-center gap-4 mb-6">
                                                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                                                    <Building2 size={28} />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate transition-colors">
                                                        {agency.agency_name || agency.agency_id}
                                                    </h3>
                                                    <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold mt-0.5">Agencia Partner</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
                                                <div className="text-center w-1/2 border-r border-gray-200 dark:border-gray-800">
                                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{agency.total_subaccounts}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Total</p>
                                                </div>
                                                <div className="text-center w-1/2">
                                                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{agency.active_subaccounts || 0}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Activas</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* VISTA 2: SUBCUENTAS */}
                {view === 'subaccounts' && (
                    <>
                        {loading ? (
                            <div className="text-center py-24">
                                <RefreshCw className="animate-spin mx-auto text-indigo-600 dark:text-indigo-400 mb-4" size={40} />
                                <p className="text-gray-500 dark:text-gray-400 text-lg">Cargando subcuentas...</p>
                            </div>
                        ) : filteredSubaccounts.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                                <Smartphone className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={56} />
                                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Esta agencia no tiene subcuentas vinculadas.</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-300 dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-100 dark:bg-gray-950 border-b border-gray-300 dark:border-gray-800">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location ID</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Creado</th>
                                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                            {filteredSubaccounts.map(sub => (
                                                <tr key={sub.location_id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition duration-150">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-gray-900 dark:text-white text-base">
                                                            {sub.name || "Sin Nombre"}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded text-gray-500 dark:text-gray-400">
                                                                <Smartphone size={16} />
                                                            </div>
                                                            <div className="font-mono text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                                                                {sub.location_id}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${sub.status === 'active'
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                                            : sub.status === 'trial'
                                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
                                                            }`}>
                                                            {sub.status === 'active' && <CheckCircle size={12} className="mr-1" />}
                                                            {sub.status?.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 capitalize font-medium">{sub.plan_name || 'Trial'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 tabular-nums">{new Date(sub.created_at).toLocaleDateString()}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => setSelectedLocation(sub)}
                                                            className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-600 dark:hover:border-indigo-400 px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm hover:shadow"
                                                        >
                                                            <Settings size={16} /> Gestionar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* MODAL DETALLES */}
                {selectedLocation && (
                    <LocationDetailsModal
                        location={selectedLocation}
                        token={token}
                        onLogout={onLogout}
                        onClose={() => setSelectedLocation(null)}
                    />
                )}
            </main>
        </div>
    );
}