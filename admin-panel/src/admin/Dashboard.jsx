import React, { useState, useEffect } from 'react';
import SupportManager from './SupportManager';
import LocationDetailsModal from './LocationDetailsModal';
import ThemeToggle from '../components/ThemeToggle';
import { useBranding } from '../context/BrandingContext'; 
import { toast } from 'sonner'; 
import {
    Settings, Search, Palette, Upload,
    RefreshCw, Building2, Smartphone, CheckCircle2,
    ArrowLeft, LogOut, RotateCcw, Image as ImageIcon, Link, Users, Trash2
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

export default function AdminDashboard({ token, onLogout }) {
    const { systemBranding, updateSystemBranding, DEFAULT_BRANDING } = useBranding();
    const [view, setView] = useState('agencies'); 
    const [selectedAgency, setSelectedAgency] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [agencies, setAgencies] = useState([]);
    const [subaccounts, setSubaccounts] = useState([]);
    const [users, setUsers] = useState([]); // ✅ Nuevo estado para usuarios
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // ✅ FIX FAVICON: Forzar el icono del sistema al entrar al Admin
    useEffect(() => {
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        // Usamos el favicon del sistema o el default, ignorando el de la agencia local
        link.href = systemBranding.faviconUrl || DEFAULT_BRANDING.faviconUrl;
        document.getElementsByTagName('head')[0].appendChild(link);
        document.title = "Panel Maestro | Admin"; // Título forzado
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

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`/admin/users`);
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error cargando usuarios:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!confirm("¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.")) return;
        
        try {
            const res = await authFetch(`/admin/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success("Usuario eliminado correctamente");
                fetchUsers();
            } else {
                const data = await res.json();
                toast.error(data.error || "Error al eliminar usuario");
            }
        } catch (error) {
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

    const filteredAgencies = agencies.filter(a => 
        (a.agency_id && a.agency_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.agency_name && a.agency_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredSubaccounts = subaccounts.filter(s => 
        (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.location_id && s.location_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredUsers = users.filter(u => 
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.agency_id && u.agency_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // --- SUBCOMPONENTE: MARCA GLOBAL + GALERÍA ---
    const GlobalBrandingSettings = () => {
        const [form, setForm] = useState(systemBranding || DEFAULT_BRANDING);
        const [uploading, setUploading] = useState(false);
        
        // Estado para la galería
        const [galleryImages, setGalleryImages] = useState([]);
        const [loadingGallery, setLoadingGallery] = useState(false);
        const [showGallery, setShowGallery] = useState(false); // 'logo' | 'favicon' | 'background'

        // Cargar imágenes del servidor (Galería)
        const fetchGallery = async () => {
            setLoadingGallery(true);
            try {
                const res = await authFetch('/admin/storage-files');
                if (res.ok) {
                    const data = await res.json();
                    setGalleryImages(data);
                }
            } catch (e) {
                toast.error("No se pudo cargar la galería");
            } finally {
                setLoadingGallery(false);
            }
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
                    toast.success("Imagen subida correctamente 🚀");
                    fetchGallery(); // Recargar galería
                } else {
                    throw new Error(data.error);
                }
            } catch (err) {
                toast.error("Error al subir imagen");
            } finally {
                setUploading(false);
            }
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
            toast.success("Marca Global Actualizada 🌎", { description: "Los cambios se verán en el Login para todos." });
        };

        return (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                            <Palette size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Identidad Global del Sistema</h3>
                            <p className="text-sm text-gray-500">Configura Login y Registro (Solo visible para Super Admin).</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        
                        {/* COLUMNA IZQUIERDA: FORMULARIO */}
                        <div className="space-y-6">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nombre Plataforma</label>
                                    <input type="text" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Slogan Login</label>
                                    <input type="text" value={form.slogan || ''} onChange={e => setForm({...form, slogan: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 transition-all" />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Textos Pantalla Login</h4>
                                <div>
                                    <label className="block text-sm font-bold mb-1 dark:text-gray-300">Descripción (Bajada)</label>
                                    <textarea rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 outline-none focus:ring-2" placeholder="Tecnología humana para flujos inteligentes..." />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1 dark:text-gray-300">Título Formulario</label>
                                        <input type="text" value={form.loginTitle || ''} onChange={e => setForm({...form, loginTitle: e.target.value})} className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" placeholder="Empieza Ahora" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 dark:text-gray-300">Subtítulo Formulario</label>
                                        <input type="text" value={form.loginSubtitle || ''} onChange={e => setForm({...form, loginSubtitle: e.target.value})} className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" placeholder="Ingresa a la nueva era..." />
                                    </div>
                                </div>
                            </div>

                            {/* CONFIGURACIÓN DEL BOTÓN CTA */}
                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Botón Promocional (CTA)</h4>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={form.ctaButton?.show || false} onChange={e => setForm({...form, ctaButton: {...form.ctaButton, show: e.target.checked}})} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">Activar</span>
                                    </label>
                                </div>
                                {form.ctaButton?.show && (
                                    <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                                        <div>
                                            <label className="block text-xs font-bold mb-1 text-gray-500">Texto Botón</label>
                                            <input type="text" value={form.ctaButton?.text || ''} onChange={e => setForm({...form, ctaButton: {...form.ctaButton, text: e.target.value}})} className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700 text-sm" placeholder="Ver Oferta" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold mb-1 text-gray-500">URL Destino</label>
                                            <div className="flex items-center">
                                                <Link size={14} className="mr-2 text-gray-400"/>
                                                <input type="url" value={form.ctaButton?.url || ''} onChange={e => setForm({...form, ctaButton: {...form.ctaButton, url: e.target.value}})} className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700 text-sm" placeholder="https://..." />
                                            </div>
                                        </div>
                                        {/* COLOR DE FONDO CTA */}
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold mb-1 text-gray-500">Color Fondo Botón (Opcional)</label>
                                            <div className="flex items-center gap-3">
                                                <input type="color" value={form.ctaButton?.backgroundColor || '#ffffff'} onChange={e => setForm({...form, ctaButton: {...form.ctaButton, backgroundColor: e.target.value}})} className="h-9 w-12 rounded cursor-pointer border" />
                                                <input type="text" value={form.ctaButton?.backgroundColor || ''} onChange={e => setForm({...form, ctaButton: {...form.ctaButton, backgroundColor: e.target.value}})} className="flex-1 p-2 rounded border dark:bg-gray-900 dark:border-gray-700 text-sm font-mono" placeholder="Vacío para efecto cristal" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* IMÁGENES (Logo, Favicon, Fondo) */}
                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Imágenes</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    {/* Logo */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-gray-500">Logo</label>
                                        <div className="w-full aspect-square border rounded bg-gray-50 flex items-center justify-center p-2"><img src={form.logoUrl} className="max-w-full max-h-full object-contain" alt="Logo" onError={(e) => e.target.style.display='none'} /></div>
                                        <div className="flex flex-col gap-1 text-xs">
                                            <label className="cursor-pointer text-indigo-600 font-bold hover:underline">Subir <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'logoUrl')} disabled={uploading}/></label>
                                            <button onClick={() => setShowGallery('logo')} className="text-gray-500 hover:text-gray-900 text-left">Galería</button>
                                        </div>
                                    </div>
                                    {/* Favicon */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-gray-500">Favicon</label>
                                        <div className="w-full aspect-square border rounded bg-gray-50 flex items-center justify-center p-4"><img src={form.faviconUrl} className="max-w-full max-h-full object-contain" alt="Fav" onError={(e) => e.target.style.display='none'} /></div>
                                        <div className="flex flex-col gap-1 text-xs">
                                            <label className="cursor-pointer text-indigo-600 font-bold hover:underline">Subir <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'faviconUrl')} disabled={uploading}/></label>
                                            <button onClick={() => setShowGallery('favicon')} className="text-gray-500 hover:text-gray-900 text-left">Galería</button>
                                        </div>
                                    </div>
                                    {/* Fondo */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-gray-500">Fondo</label>
                                        <div className="w-full aspect-square border rounded bg-gray-50 flex items-center justify-center overflow-hidden"><img src={form.loginImage} className="w-full h-full object-cover" alt="Fondo" onError={(e) => e.target.style.display='none'} /></div>
                                        <div className="flex flex-col gap-1 text-xs">
                                            <label className="cursor-pointer text-indigo-600 font-bold hover:underline">Subir <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'loginImage')} disabled={uploading}/></label>
                                            <button onClick={() => setShowGallery('background')} className="text-gray-500 hover:text-gray-900 text-left">Galería</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* COLORES */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <div><label className="block text-xs font-bold mb-1 text-gray-500">Primario</label><div className="flex gap-2"><input type="color" value={form.primaryColor} onChange={e => setForm({...form, primaryColor: e.target.value})} className="h-8 w-8 rounded cursor-pointer border" /><input type="text" value={form.primaryColor} readOnly className="flex-1 p-1 text-xs border rounded" /></div></div>
                                <div><label className="block text-xs font-bold mb-1 text-gray-500">Acento</label><div className="flex gap-2"><input type="color" value={form.accentColor} onChange={e => setForm({...form, accentColor: e.target.value})} className="h-8 w-8 rounded cursor-pointer border" /><input type="text" value={form.accentColor} readOnly className="flex-1 p-1 text-xs border rounded" /></div></div>
                            </div>

                            <div className="pt-4 flex justify-end gap-4">
                                <button onClick={() => setForm(DEFAULT_BRANDING)} className="text-gray-500 hover:text-gray-700 flex items-center gap-2 text-sm font-medium px-4">
                                    <RotateCcw size={16}/> Restaurar Defaults
                                </button>
                                <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2 hover:-translate-y-0.5 transition">
                                    <CheckCircle2 size={18}/> Guardar Cambios
                                </button>
                            </div>
                        </div>

                        {/* COLUMNA DERECHA: GALERÍA */}
                        <div className={`border-l border-gray-100 dark:border-gray-800 pl-0 lg:pl-10 transition-all duration-300 ${!showGallery ? 'hidden lg:block lg:opacity-40 lg:pointer-events-none grayscale' : ''}`}>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <ImageIcon size={20} className="text-indigo-500"/> Galería del Servidor
                                </h4>
                                <button onClick={() => fetchGallery()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500" title="Recargar Galería">
                                    <RefreshCw size={16} className={loadingGallery ? 'animate-spin' : ''}/>
                                </button>
                            </div>

                            {showGallery && (
                                <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded-lg text-xs font-bold text-center border border-indigo-100 dark:border-indigo-800">
                                    Selecciona una imagen para: {showGallery.toUpperCase()}
                                </div>
                            )}
                            
                            <div className="grid grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar content-start">
                                {loadingGallery ? (
                                    <div className="col-span-3 text-center py-10 text-gray-400">Cargando imágenes...</div>
                                ) : galleryImages.length === 0 ? (
                                    <div className="col-span-3 text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                                        <ImageIcon className="mx-auto text-gray-300 mb-2" size={32}/>
                                        <p className="text-sm text-gray-400">No hay imágenes guardadas.</p>
                                    </div>
                                ) : (
                                    galleryImages.map((img, idx) => (
                                        <div 
                                            key={idx} 
                                            onClick={() => showGallery && handleSelectImage(img.url)}
                                            className={`group relative aspect-square rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-black/20 transition-all hover:border-indigo-500 hover:shadow-md ${showGallery ? 'cursor-pointer' : 'cursor-default'}`}
                                        >
                                            <img src={img.url} alt={img.name} className="w-full h-full object-contain p-1" loading="lazy" />
                                            {showGallery && (
                                                <div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[1px]">
                                                    <span className="bg-white text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition">
                                                        Seleccionar
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* Botón Atrás (Subcuentas) */}
                        {view === 'subaccounts' && (
                            <button onClick={handleBackToAgencies} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition text-gray-600 dark:text-gray-300">
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">CA</div>
                        
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-tight text-gray-900 dark:text-white">
                                {view === 'branding' ? 'Configuración Global' : view === 'users' ? 'Gestión de Usuarios' : view === 'agencies' ? 'Panel Maestro' : `Agencia: ${selectedAgency?.agency_name}`}
                            </h1>
                            {view === 'subaccounts' && <p className="text-xs text-gray-500 dark:text-gray-400">Gestionando {subaccounts.length} subcuentas</p>}
                            {view === 'users' && <p className="text-xs text-gray-500 dark:text-gray-400">{users.length} usuarios registrados</p>}
                        </div>

                        {/* TABS DE NAVEGACIÓN */}
                        <div className="hidden md:flex items-center gap-1 ml-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                            <button 
                                onClick={() => { setView('agencies'); setSubaccounts([]); setSelectedAgency(null); }} 
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-2 ${view === 'agencies' || view === 'subaccounts' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                            >
                                <Building2 size={16} /> Agencias
                            </button>
                            <button 
                                onClick={() => setView('users')} 
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-2 ${view === 'users' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                            >
                                <Users size={16} /> Usuarios
                            </button>
                            <button 
                                onClick={() => setView('branding')} 
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-2 ${view === 'branding' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                            >
                                <Settings size={16} /> Marca Global
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <ThemeToggle />

                        <button
                            onClick={() => view === 'agencies' ? fetchAgencies() : (selectedAgency ? fetchSubaccounts(selectedAgency.agency_id) : null)}
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

                {/* --- VISTA: MARCA GLOBAL --- */}
                {view === 'branding' && <GlobalBrandingSettings />}

                {/* --- VISTA: USUARIOS --- */}
                {view === 'users' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por email, nombre o agencia..."
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {loading ? (
                            <div className="text-center py-24">
                                <RefreshCw className="animate-spin mx-auto text-indigo-600 mb-4" size={40} />
                                <p className="text-gray-500">Cargando usuarios...</p>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                                <Users className="mx-auto text-gray-300 mb-4" size={64} />
                                <p className="text-gray-500 text-lg">No se encontraron usuarios.</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-300 dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Usuario</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Rol</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Agencia ID</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Registro</th>
                                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {filteredUsers.map(user => (
                                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-gray-900 dark:text-white">{user.name || 'Sin nombre'}</div>
                                                        <div className="text-xs text-gray-500">{user.email}</div>
                                                        {user.phone && <div className="text-[10px] text-indigo-500 font-mono">+{user.phone}</div>}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-xs">
                                                        <span className={`px-2 py-1 rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {user.role?.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{user.agency_id || '-'}</td>
                                                    <td className="px-6 py-4 text-xs text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                            title="Eliminar Usuario"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- VISTA: AGENCIAS / SUBCUENTAS --- */}
                {(view === 'agencies' || view === 'subaccounts') && (
                    <>
                        <div className="mb-8 space-y-6 animate-in fade-in slide-in-from-bottom-2">
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

                        {/* LISTA AGENCIAS */}
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
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

                        {/* LISTA SUBCUENTAS */}
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
                                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-300 dark:border-gray-700 shadow-sm overflow-hidden animate-in fade-in">
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
                                                                    {sub.status === 'active' && <CheckCircle2 size={12} className="mr-1" />}
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
                    </>
                )}

                {/* MODALES */}
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