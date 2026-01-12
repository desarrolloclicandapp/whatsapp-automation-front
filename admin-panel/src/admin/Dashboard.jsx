import React, { useState, useEffect } from 'react';
import SupportManager from './SupportManager';
import LocationDetailsModal from './LocationDetailsModal';
import ThemeToggle from '../components/ThemeToggle';
import { useBranding } from '../context/BrandingContext'; 
import { toast } from 'sonner'; 
import {
    Settings, Search, Palette, RefreshCw, Building2, Smartphone, 
    ArrowLeft, LogOut, RotateCcw, Image as ImageIcon, Link, Users, 
    Trash2, Clock, CalendarDays, Check, Plus, CheckCircle2
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

export default function AdminDashboard({ token, onLogout }) {
    const { systemBranding, updateSystemBranding, DEFAULT_BRANDING } = useBranding();
    const [view, setView] = useState('agencies'); 
    const [selectedAgency, setSelectedAgency] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [agencies, setAgencies] = useState([]);
    const [subaccounts, setSubaccounts] = useState([]);
    const [users, setUsers] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // ✅ ESTADO PARA MODAL DE TRIAL
    const [trialModal, setTrialModal] = useState({ show: false, userId: null, userName: '', currentEnd: null });

    // ✅ FIX FAVICON
    useEffect(() => {
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = systemBranding.faviconUrl || DEFAULT_BRANDING.faviconUrl;
        document.getElementsByTagName('head')[0].appendChild(link);
        document.title = "Panel Maestro | Admin"; 
    }, [systemBranding]);

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

    // --- CARGA DE DATOS ---

    const fetchAgencies = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`/admin/agencies`);
            const data = await res.json();
            setAgencies(Array.isArray(data) ? data : []);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const fetchSubaccounts = async (agencyId) => {
        setLoading(true);
        try {
            const safeId = encodeURIComponent(agencyId);
            const res = await authFetch(`/admin/tenants?agencyId=${safeId}`);
            const data = await res.json();
            setSubaccounts(Array.isArray(data) ? data : []);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`/admin/users`);
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    // --- LÓGICA DE USUARIOS ---

    const handleDeleteUser = async (userId, userName) => {
        if (!confirm(`⚠️ ¿Estás seguro de eliminar al usuario "${userName || 'Sin nombre'}"?\n\nEsta acción es irreversible y borrará sus subcuentas.`)) return;
        
        try {
            const res = await authFetch(`/admin/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success("Usuario eliminado");
                fetchUsers();
            } else {
                const data = await res.json();
                toast.error(data.error || "Error al eliminar");
            }
        } catch (error) { toast.error("Error de conexión"); }
    };

    const handleExtendTrial = async (days) => {
        const { userId } = trialModal;
        if (!userId) return;

        try {
            const res = await authFetch(`/admin/users/${userId}/trial`, {
                method: 'PUT',
                body: JSON.stringify({ days })
            });
            const data = await res.json();
            
            if (res.ok) {
                const msg = days > 0 ? `Trial extendido ${days} días` : `Trial reducido ${Math.abs(days)} días`;
                toast.success(msg);
                setTrialModal({ show: false, userId: null, userName: '', currentEnd: null });
                fetchUsers(); // Recargar lista
            } else {
                toast.error(data.error || "Error actualizando trial");
            }
        } catch (e) {
            toast.error("Error de conexión");
        }
    };

    useEffect(() => {
        if (view === 'agencies') fetchAgencies();
        if (view === 'users') fetchUsers();
    }, [view]);

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

    // --- FILTRADO SEGURO (Anti-Crash) ---
    // Usamos (val || "") para asegurar que siempre haya un string antes de toLowerCase()

    const filteredAgencies = agencies.filter(a => 
        (a.agency_id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.agency_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredSubaccounts = subaccounts.filter(s => 
        (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.location_id || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredUsers = users.filter(u => 
        (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.agency_id || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- SUBCOMPONENTE: MARCA GLOBAL + GALERÍA ---
    const GlobalBrandingSettings = () => {
        const [form, setForm] = useState(systemBranding || DEFAULT_BRANDING);
        const [uploading, setUploading] = useState(false);
        const [galleryImages, setGalleryImages] = useState([]);
        const [loadingGallery, setLoadingGallery] = useState(false);
        const [showGallery, setShowGallery] = useState(false);

        const fetchGallery = async () => {
            setLoadingGallery(true);
            try {
                const res = await authFetch('/admin/storage-files');
                if (res.ok) {
                    const data = await res.json();
                    setGalleryImages(data);
                }
            } catch (e) { toast.error("Error cargando galería"); } finally { setLoadingGallery(false); }
        };

        useEffect(() => { fetchGallery(); }, []);

        const handleFileUpload = async (e, field) => {
            const file = e.target.files[0];
            if (!file) return;
            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await fetch(`${API_URL}/agency/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await res.json();
                if (res.ok) {
                    setForm(prev => ({ ...prev, [field]: data.url }));
                    toast.success("Imagen subida");
                    fetchGallery();
                } else throw new Error(data.error);
            } catch (err) { toast.error("Error al subir"); } finally { setUploading(false); }
        };

        const handleSelectImage = (url) => {
            if (showGallery === 'logo') setForm({ ...form, logoUrl: url });
            if (showGallery === 'favicon') setForm({ ...form, faviconUrl: url });
            if (showGallery === 'background') setForm({ ...form, loginImage: url });
            setShowGallery(false);
            toast.success("Imagen seleccionada");
        };

        const handleSave = () => {
            updateSystemBranding(form, token);
            toast.success("Marca Global Actualizada");
        };

        return (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600"><Palette size={24} /></div>
                        <div><h3 className="text-xl font-bold text-gray-900 dark:text-white">Identidad Global</h3><p className="text-sm text-gray-500">Configura Login y Registro.</p></div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">Nombre Plataforma</label><input type="text" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-3 rounded-xl border dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2" /></div>
                                <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">Slogan</label><input type="text" value={form.slogan || ''} onChange={e => setForm({...form, slogan: e.target.value})} className="w-full p-3 rounded-xl border dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2" /></div>
                            </div>
                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <h4 className="text-xs font-bold text-gray-400 uppercase">Textos Login</h4>
                                <textarea rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" placeholder="Descripción..." />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" value={form.loginTitle || ''} onChange={e => setForm({...form, loginTitle: e.target.value})} className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" placeholder="Título Form" />
                                    <input type="text" value={form.loginSubtitle || ''} onChange={e => setForm({...form, loginSubtitle: e.target.value})} className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" placeholder="Subtítulo Form" />
                                </div>
                            </div>
                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <h4 className="text-xs font-bold text-gray-400 uppercase">Imágenes</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-2"><label className="text-xs font-bold text-gray-500">Logo</label><div className="aspect-square border rounded bg-gray-50 flex items-center justify-center p-2"><img src={form.logoUrl} className="max-w-full max-h-full object-contain" alt="Logo" onError={(e)=>e.target.style.display='none'}/></div><div className="flex flex-col gap-1 text-xs"><label className="cursor-pointer text-indigo-600 font-bold hover:underline">Subir <input type="file" className="hidden" onChange={(e)=>handleFileUpload(e,'logoUrl')} disabled={uploading}/></label><button onClick={()=>setShowGallery('logo')} className="text-gray-500 hover:text-gray-900 text-left">Galería</button></div></div>
                                    <div className="flex flex-col gap-2"><label className="text-xs font-bold text-gray-500">Favicon</label><div className="aspect-square border rounded bg-gray-50 flex items-center justify-center p-4"><img src={form.faviconUrl} className="max-w-full max-h-full object-contain" alt="Fav" onError={(e)=>e.target.style.display='none'}/></div><div className="flex flex-col gap-1 text-xs"><label className="cursor-pointer text-indigo-600 font-bold hover:underline">Subir <input type="file" className="hidden" onChange={(e)=>handleFileUpload(e,'faviconUrl')} disabled={uploading}/></label><button onClick={()=>setShowGallery('favicon')} className="text-gray-500 hover:text-gray-900 text-left">Galería</button></div></div>
                                    <div className="flex flex-col gap-2"><label className="text-xs font-bold text-gray-500">Fondo</label><div className="aspect-square border rounded bg-gray-50 flex items-center justify-center overflow-hidden"><img src={form.loginImage} className="w-full h-full object-cover" alt="Fondo" onError={(e)=>e.target.style.display='none'}/></div><div className="flex flex-col gap-1 text-xs"><label className="cursor-pointer text-indigo-600 font-bold hover:underline">Subir <input type="file" className="hidden" onChange={(e)=>handleFileUpload(e,'loginImage')} disabled={uploading}/></label><button onClick={()=>setShowGallery('background')} className="text-gray-500 hover:text-gray-900 text-left">Galería</button></div></div>
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-4">
                                <button onClick={()=>setForm(DEFAULT_BRANDING)} className="text-gray-500 hover:text-gray-700 flex items-center gap-2 text-sm font-medium px-4"><RotateCcw size={16}/> Restaurar</button>
                                <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2"><CheckCircle2 size={18}/> Guardar</button>
                            </div>
                        </div>
                        <div className={`border-l border-gray-100 dark:border-gray-800 pl-0 lg:pl-10 transition-all ${!showGallery ? 'hidden lg:block lg:opacity-40 lg:pointer-events-none grayscale' : ''}`}>
                            <div className="flex justify-between items-center mb-4"><h4 className="font-bold dark:text-white flex items-center gap-2"><ImageIcon size={20} className="text-indigo-500"/> Galería</h4><button onClick={fetchGallery} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><RefreshCw size={16} className={loadingGallery ? 'animate-spin' : ''}/></button></div>
                            {showGallery && <div className="mb-4 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-xs font-bold text-center">Selecciona para: {showGallery.toUpperCase()}</div>}
                            <div className="grid grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar content-start">
                                {galleryImages.map((img, idx) => (
                                    <div key={idx} onClick={()=>showGallery && handleSelectImage(img.url)} className={`aspect-square rounded-lg border dark:border-gray-700 overflow-hidden bg-gray-50 transition hover:border-indigo-500 ${showGallery ? 'cursor-pointer' : 'cursor-default'}`}>
                                        <img src={img.url} className="w-full h-full object-contain p-1" loading="lazy" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
            {/* HEADER */}
            <header className="bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-800 sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {view === 'subaccounts' && (
                            <button onClick={handleBackToAgencies} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition text-gray-600 dark:text-gray-300">
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">CA</div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white hidden sm:block">
                            {view === 'branding' ? 'Marca Global' : view === 'users' ? 'Gestión de Usuarios' : 'Panel Maestro'}
                        </h1>
                        <div className="hidden md:flex items-center gap-1 ml-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                            <button onClick={() => setView('agencies')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-2 ${view === 'agencies' || view === 'subaccounts' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}><Building2 size={16}/> Agencias</button>
                            <button onClick={() => setView('users')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-2 ${view === 'users' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}><Users size={16}/> Usuarios</button>
                            <button onClick={() => setView('branding')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-2 ${view === 'branding' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}><Settings size={16}/> Marca</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <button onClick={onLogout} className="p-2.5 text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 border border-red-100 dark:border-red-900/30">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                
                {/* --- VISTA: BRANDING --- */}
                {view === 'branding' && <GlobalBrandingSettings />}

                {/* --- VISTA: USUARIOS --- */}
                {view === 'users' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por email, nombre o agencia..."
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {loading ? (
                            <div className="text-center py-24"><RefreshCw className="animate-spin mx-auto text-indigo-600 mb-4" /> Cargando usuarios...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                                <Users className="mx-auto text-gray-300 mb-4" size={48} />
                                <p className="text-gray-500">No se encontraron usuarios.</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Usuario / Email</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Plan & Estado</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vencimiento Trial</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {filteredUsers.map(user => {
                                                const canManageTrial = user.role !== 'admin' && (user.plan_status === 'trial' || user.plan_status === 'suspended');
                                                return (
                                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition duration-150">
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-gray-900 dark:text-white text-sm">{user.name || 'Sin nombre'}</div>
                                                            <div className="text-xs text-gray-500">{user.email}</div>
                                                            {user.agency_id && <div className="mt-1 text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded w-fit">{user.agency_id}</div>}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                                                user.plan_status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                user.plan_status === 'trial' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                                'bg-red-100 text-red-700 border-red-200'
                                                            }`}>
                                                                {user.plan_status ? user.plan_status.toUpperCase() : 'TRIAL'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                                                            {user.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString() : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end items-center gap-2">
                                                                {canManageTrial && (
                                                                    <button 
                                                                        onClick={() => setTrialModal({ show: true, userId: user.id, userName: user.name, currentEnd: user.trial_ends_at })}
                                                                        className="p-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800"
                                                                        title="Extender/Reducir Trial"
                                                                    >
                                                                        <CalendarDays size={18} />
                                                                    </button>
                                                                )}
                                                                <button 
                                                                    onClick={() => handleDeleteUser(user.id, user.name)}
                                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                                    title="Eliminar Usuario"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- VISTA: AGENCIAS (Sin cambios) --- */}
                {(view === 'agencies' || view === 'subaccounts') && (
                    <>
                        <div className="mb-8 space-y-6 animate-in fade-in">
                            {view === 'agencies' && <SupportManager token={token} />}
                            <div className="relative w-full max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder={view === 'agencies' ? "Buscar agencia..." : "Buscar subcuenta..."}
                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        {view === 'agencies' && !loading && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
                                {filteredAgencies.map((agency) => (
                                    <div key={agency.agency_id} onClick={() => handleAgencyClick(agency)} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-indigo-500 cursor-pointer group">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Building2 size={24}/></div>
                                            <div><h3 className="font-bold text-lg dark:text-white">{agency.agency_name || "Agencia"}</h3><p className="text-xs text-gray-500">{agency.agency_id}</p></div>
                                        </div>
                                        <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-4"><p className="text-2xl font-bold dark:text-white">{agency.total_subaccounts}</p><p className="text-xs text-gray-500 uppercase font-bold mt-2">Subcuentas</p></div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {view === 'subaccounts' && !loading && (
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-950 border-b dark:border-gray-800">
                                        <tr><th className="px-6 py-4 text-xs font-bold text-gray-500">Nombre</th><th className="px-6 py-4 text-xs font-bold text-gray-500 text-right">Acción</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {filteredSubaccounts.map(sub => (
                                            <tr key={sub.location_id}><td className="px-6 py-4 font-bold dark:text-white">{sub.name}</td><td className="px-6 py-4 text-right"><button onClick={() => setSelectedLocation(sub)} className="text-indigo-600 font-bold text-sm hover:underline">Gestionar</button></td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* MODAL DE EXTENSIÓN DE TRIAL */}
                {trialModal.show && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6">
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Clock size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Gestionar Trial</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Usuario: <span className="font-bold">{trialModal.userName || 'Usuario'}</span></p>
                                <p className="text-xs text-gray-400 mt-1">Vence: {trialModal.currentEnd ? new Date(trialModal.currentEnd).toLocaleDateString() : 'Hoy'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <button onClick={() => handleExtendTrial(7)} className="flex items-center justify-center gap-1 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-sm transition">
                                    <Plus size={14} /> 7 Días
                                </button>
                                <button onClick={() => handleExtendTrial(14)} className="flex items-center justify-center gap-1 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-sm transition">
                                    <Plus size={14} /> 14 Días
                                </button>
                                <button onClick={() => handleExtendTrial(30)} className="flex items-center justify-center gap-1 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-sm transition">
                                    <Plus size={14} /> 30 Días
                                </button>
                                <button onClick={() => handleExtendTrial(-7)} className="flex items-center justify-center gap-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-xl font-bold text-sm transition">
                                    - 7 Días
                                </button>
                            </div>

                            <button 
                                onClick={() => setTrialModal({ show: false, userId: null, userName: '', currentEnd: null })}
                                className="w-full py-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl font-medium text-sm transition"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

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