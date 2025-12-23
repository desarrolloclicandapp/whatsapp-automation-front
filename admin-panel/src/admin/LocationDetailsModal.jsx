import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    X, Smartphone, Plus, Trash2, Settings, Tag,
    RefreshCw, Edit2, Loader2, User, Hash, Link2, MessageSquare, Users, AlertTriangle, Star, CheckCircle2
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket'; // ✅ Importar Hook de Socket

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.clicandapp.com").replace(/\/$/, "");

export default function LocationDetailsModal({ location, onClose, token, onLogout, onUpgrade, onDataChange }) {
    const [slots, setSlots] = useState([]);
    const [keywords, setKeywords] = useState([]);
    const [ghlUsers, setGhlUsers] = useState([]);
    const [locationName, setLocationName] = useState(location.name || "");
    const [loading, setLoading] = useState(true);

    // Control de UI
    const [expandedSlotId, setExpandedSlotId] = useState(null);
    const [activeSlotTab, setActiveSlotTab] = useState('general');
    const [groups, setGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [deletingSlotId, setDeletingSlotId] = useState(null);

    // ✅ Obtener instancia del socket
    const socket = useSocket();

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
            onClose();
            return null;
        }
        return res;
    };

    // ✅ LÓGICA DE TIEMPO REAL + ROOMS
    useEffect(() => {
        loadData(); // Carga inicial

        // 1. Unirse a la sala (Room) de esta ubicación
        // Esto es CRÍTICO para recibir eventos ahora que el backend usa io.to()
        if (socket && location.location_id) {
            console.log(`🔌 Uniéndose a sala: ${location.location_id}`);
            socket.emit('join_room', location.location_id);
        }

        // 2. Manejar eventos entrantes
        const handleEvent = (payload) => {
            // Doble verificación: aunque el backend filtre, aseguramos que sea para nosotros
            if (payload.locationId === location.location_id) {
                if (payload.type === 'connection' || payload.type === 'qr') {
                    loadData();
                }
            }
        };

        if (socket) {
            socket.on('wa_event', handleEvent);
        }

        return () => {
            if (socket) {
                socket.off('wa_event', handleEvent);
                // No es estrictamente necesario emitir 'leave_room' si el socket se desconecta,
                // pero al desmontar el componente dejamos de escuchar.
            }
        };
    }, [location, socket]);

    const loadData = async () => {
        if (slots.length === 0) setLoading(true);
        try {
            const [detailsRes, usersRes] = await Promise.all([
                authFetch(`/agency/location-details/${location.location_id}`),
                authFetch(`/agency/ghl-users/${location.location_id}`)
            ]);

            if (detailsRes && detailsRes.ok) {
                const data = await detailsRes.json();
                setSlots(data.slots || []);
                setKeywords(data.keywords || []);

                if (data.name) setLocationName(data.name);
            }

            if (usersRes && usersRes.ok) {
                const users = await usersRes.json();
                setGhlUsers(users || []);
            }
        } catch (e) {
            console.error("Error cargando datos:", e);
            if (slots.length === 0) toast.error("Error cargando datos", { description: "Verifica tu conexión." });
        } finally {
            setLoading(false);
        }
    };

    // --- ACCIONES PRINCIPALES ---

    const handleAddSlot = async () => {
        const loadingId = toast.loading("Creando dispositivo...");
        try {
            const res = await authFetch(`/agency/add-slot`, {
                method: "POST",
                body: JSON.stringify({ locationId: location.location_id })
            });
            const data = await res.json();
            toast.dismiss(loadingId);

            if (res.ok) {
                toast.success("Dispositivo agregado", { description: "Listo para vincular." });
                loadData();
                if (onDataChange) onDataChange();
            } else if (res.status === 403) {
                toast.error("Límite Alcanzado", {
                    description: "Has llegado al máximo de dispositivos de tu plan.",
                    duration: 6000,
                    icon: <AlertTriangle className="text-amber-500" />,
                    action: {
                        label: 'Ampliar Plan',
                        onClick: () => {
                            onClose();
                            if (onUpgrade) onUpgrade();
                        }
                    }
                });
            } else {
                toast.error("Error", { description: data.error });
            }
        } catch (e) {
            toast.dismiss(loadingId);
            toast.error("Error de conexión");
        }
    };

    const handleDeleteSlot = (slotId) => {
        toast("¿Eliminar dispositivo?", {
            description: "Esta acción desconectará el número y borrará su configuración.",
            action: {
                label: 'Eliminar',
                onClick: async () => {
                    setDeletingSlotId(slotId);
                    const res = await authFetch(`/agency/slots/${location.location_id}/${slotId}`, { method: "DELETE" });
                    setDeletingSlotId(null);
                    if (res && res.ok) {
                        toast.success("Dispositivo eliminado");
                        loadData();
                    } else {
                        toast.error("No se pudo eliminar");
                    }
                }
            },
            cancel: { label: 'Cancelar' }
        });
    };

    const toggleFavorite = async (slotId, currentState) => {
        const newState = !currentState;
        setSlots(prev => prev.map(s => {
            if (s.slot_id === slotId) return { ...s, is_favorite: newState };
            if (newState) return { ...s, is_favorite: false };
            return s;
        }));

        try {
            await authFetch(`/agency/update-slot-config`, {
                method: 'POST',
                body: JSON.stringify({ locationId: location.location_id, slotId, isFavorite: newState })
            });
            if (newState) toast.success("Marcado como Favorito ⭐");
        } catch (e) {
            loadData();
            toast.error("Error al actualizar favorito");
        }
    };

    const editSlotName = async (slotId, currentName) => {
        const newName = prompt("Nuevo nombre:", currentName || "");
        if (newName && newName !== currentName) {
            try {
                await authFetch(`/config-slot`, {
                    method: "POST",
                    body: JSON.stringify({ locationId: location.location_id, slot: slotId, slotName: newName })
                });
                toast.success("Nombre actualizado");
                setSlots(prev => prev.map(s => s.slot_id === slotId ? { ...s, slot_name: newName } : s));
            } catch (e) { toast.error("Error al renombrar"); }
        }
    };

    // --- CONFIGURACIÓN & TABS ---

    const handleExpandSlot = (slotId) => {
        if (expandedSlotId === slotId) {
            setExpandedSlotId(null);
        } else {
            setExpandedSlotId(slotId);
            setActiveSlotTab('general');
        }
    };

    const changePriority = async (slotId, newPriority) => {
        try {
            await authFetch(`/agency/update-slot-config`, {
                method: 'POST',
                body: JSON.stringify({ locationId: location.location_id, slotId, priority: parseInt(newPriority) })
            });
            toast.success("Prioridad actualizada");
            loadData();
        } catch (e) { toast.error("Error al cambiar prioridad"); }
    };

    const updateSettingsBackend = async (slotId, newSettings) => {
        setSlots(prev => prev.map(s => s.slot_id === slotId ? { ...s, settings: newSettings } : s));
        try {
            await authFetch(`/agency/slots/${location.location_id}/${slotId}/settings`, {
                method: 'PUT',
                body: JSON.stringify({ settings: newSettings })
            });
        } catch (e) {
            toast.error("Error guardando configuración");
            loadData();
        }
    };

    const toggleSlotSetting = (slotId, key, currentSettings) => {
        const safeSettings = { ...currentSettings };
        const newSettings = { ...safeSettings, [key]: !safeSettings[key] };
        updateSettingsBackend(slotId, newSettings);
    };

    const changeSlotSetting = (slotId, key, value, currentSettings) => {
        const safeSettings = { ...currentSettings };
        const newSettings = { ...safeSettings, [key]: value };
        updateSettingsBackend(slotId, newSettings);
    };

    // --- KEYWORDS ---
    const handleAddKeyword = async (e, slotId) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const keyword = fd.get('keyword');
        const tag = fd.get('tag');
        if (!keyword || !tag) return;

        const res = await authFetch(`/agency/keywords`, {
            method: 'POST',
            body: JSON.stringify({ locationId: location.location_id, slotId, keyword, tag })
        });
        if (res && res.ok) {
            toast.success("Regla agregada");
            e.target.reset();
            loadData();
        }
    };

    const deleteKeyword = async (id) => {
        await authFetch(`/agency/keywords/${id}`, { method: 'DELETE' });
        toast.success("Regla eliminada");
        loadData();
    };

    // --- GRUPOS ---
    const loadGroups = async (slotId) => {
        setLoadingGroups(true);
        try {
            const res = await authFetch(`/agency/slots/${location.location_id}/${slotId}/groups`);
            if (res.ok) setGroups(await res.json());
        } catch (e) { }
        setLoadingGroups(false);
    };

    const toggleGroupActive = (slotId, groupJid, groupName, currentSettings) => {
        const groupsConfig = currentSettings.groups || {};
        const isActive = !(groupsConfig[groupJid]?.active);
        const newGroupsConfig = {
            ...groupsConfig,
            [groupJid]: { active: isActive, name: groupName }
        };
        const newSettings = { ...currentSettings, groups: newGroupsConfig };
        updateSettingsBackend(slotId, newSettings);
        if (isActive) toast.success(`Grupo "${groupName}" activado`);
    };

    const handleSyncMembers = (slotId, groupJid) => {
        toast.promise(
            authFetch(`/agency/slots/${location.location_id}/${slotId}/groups/sync-members`, {
                method: 'POST', body: JSON.stringify({ groupJid })
            }),
            {
                loading: 'Sincronizando miembros...',
                success: 'Sincronización iniciada en segundo plano.',
                error: 'Error al iniciar sincronización.'
            }
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800">

                {/* HEADER */}
                <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 sticky top-0 z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                                <Smartphone size={24} />
                            </div>
                            {locationName || location.location_id}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-14">Gestión avanzada de dispositivos y reglas.</p>
                    </div>
                    <button onClick={onClose} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50 dark:bg-black/20">
                    <div className="flex justify-end mb-8">
                        <button onClick={handleAddSlot} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition transform hover:-translate-y-0.5 active:scale-95">
                            <Plus size={18} /> Nuevo Dispositivo
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-20"><RefreshCw className="animate-spin text-indigo-500 w-10 h-10" /></div>
                    ) : slots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900/50">
                            <Smartphone className="text-gray-300 dark:text-gray-600 w-16 h-16 mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">No hay dispositivos configurados.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {slots.map(slot => {
                                const isExpanded = expandedSlotId === slot.slot_id;
                                const isConnected = !!slot.phone_number;
                                const currentPrio = slot.priority || 99;
                                const settings = slot.settings || {};

                                return (
                                    <div key={slot.slot_id} className={`bg-white dark:bg-gray-900 border rounded-2xl transition-all duration-300 overflow-hidden ${isExpanded ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-xl' : 'border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md'}`}>

                                        {/* CABECERA SLOT */}
                                        <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleExpandSlot(slot.slot_id)}>
                                            <div className="flex items-center gap-5">
                                                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="font-bold text-gray-900 dark:text-white text-xl">{slot.slot_name || `Dispositivo ${slot.slot_id}`}</h3>
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); toggleFavorite(slot.slot_id, slot.is_favorite); }}
                                                                className={`p-1.5 rounded-lg transition ${slot.is_favorite ? 'text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : 'text-gray-300 hover:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                                                title="Favorito"
                                                            >
                                                                <Star size={18} fill={slot.is_favorite ? "currentColor" : "none"} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); editSlotName(slot.slot_id, slot.slot_name); }}
                                                                className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1 flex items-center gap-2">
                                                        {isConnected ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{slot.phone_number}</span> : 'Desconectado'}
                                                        <span className="text-gray-300 dark:text-gray-600">•</span>
                                                        <span>Prioridad: {currentPrio}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                    {isExpanded ? 'Editando' : 'Gestionar'}
                                                </span>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteSlot(slot.slot_id); }} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition" disabled={deletingSlotId === slot.slot_id}>
                                                    {deletingSlotId === slot.slot_id ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* CONTENIDO EXPANDIBLE */}
                                        {isExpanded && (
                                            <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20 animate-in slide-in-from-top-2">

                                                {/* TABS */}
                                                <div className="flex border-b border-gray-200 dark:border-gray-800 px-6 bg-white dark:bg-gray-900/50">
                                                    <TabButton active={activeSlotTab === 'general'} onClick={() => setActiveSlotTab('general')} icon={<Settings size={16} />} label="General" />
                                                    <TabButton active={activeSlotTab === 'ghl'} onClick={() => setActiveSlotTab('ghl')} icon={<Link2 size={16} />} label="Integración" />
                                                    <TabButton active={activeSlotTab === 'keywords'} onClick={() => setActiveSlotTab('keywords')} icon={<MessageSquare size={16} />} label="Keywords" />
                                                    <TabButton active={activeSlotTab === 'groups'} onClick={() => { if (!isConnected) return toast.warning("Conecta WhatsApp primero."); setActiveSlotTab('groups'); loadGroups(slot.slot_id); }} icon={<Users size={16} />} label="Grupos" disabled={!isConnected} />
                                                </div>

                                                <div className="p-8">
                                                    {/* CONFIG PANELS */}
                                                    {activeSlotTab === 'general' && (
                                                        <div className="max-w-2xl">
                                                            <div className="mb-8">
                                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Orden de Envío</h4>
                                                                <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Nivel de Prioridad:</label>
                                                                    <select className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none" value={currentPrio} onChange={(e) => changePriority(slot.slot_id, e.target.value)}>
                                                                        {Array.from({ length: slots.length }, (_, k) => k + 1).map(p => <option key={p} value={p}>{p} {p === 1 ? '(Alta)' : ''}</option>)}
                                                                        {currentPrio > slots.length && <option value={currentPrio}>{currentPrio}</option>}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Comportamiento</h4>
                                                            <div className="space-y-3 bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700">
                                                                <SettingRow label="Firma de Origen" desc="Añadir 'Source: [Nombre]' al final." checked={settings.show_source_label ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'show_source_label', settings)} />
                                                                <SettingRow label="Transcripción IA" desc="Audio a Texto (Whisper)." checked={settings.transcribe_audio ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'transcribe_audio', settings)} />
                                                                <SettingRow label="Crear Contactos" desc="Registrar desconocidos en GHL." checked={settings.create_unknown_contacts ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'create_unknown_contacts', settings)} />
                                                                <SettingRow label="Alerta Desconexión" desc="Avisar al número si se desconecta." checked={settings.send_disconnect_message ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'send_disconnect_message', settings)} />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* OTHER PANELS (GHL, Keywords, Groups) same as before... */}
                                                    {activeSlotTab === 'ghl' && (
                                                        <div className="max-w-2xl space-y-6">
                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Tag Automático (Entrante)</label>
                                                                <input type="text" placeholder="Ej: whatsapp-ventas" className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition" value={settings.ghl_contact_tag || ""} onChange={(e) => changeSlotSetting(slot.slot_id, 'ghl_contact_tag', e.target.value, settings)} />
                                                            </div>
                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Usuario Responsable</label>
                                                                <select className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={settings.ghl_assigned_user || ""} onChange={(e) => changeSlotSetting(slot.slot_id, 'ghl_assigned_user', e.target.value, settings)}>
                                                                    <option value="">-- Sin asignar --</option>
                                                                    {ghlUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Tag de Enrutamiento (Prioridad)</label>
                                                                <input type="text" placeholder="Ej: soporte" className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition" value={settings.routing_tag || ""} onChange={(e) => changeSlotSetting(slot.slot_id, 'routing_tag', e.target.value, settings)} />
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Si el contacto tiene el tag <strong>[PRIOR]: {settings.routing_tag || "..."}</strong>, se usará este número.</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeSlotTab === 'keywords' && (
                                                        <div className="max-w-2xl">
                                                            <form onSubmit={(e) => handleAddKeyword(e, slot.slot_id)} className="flex gap-3 mb-6">
                                                                <input name="keyword" required placeholder="Si el cliente dice..." className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                                <input name="tag" required placeholder="Agregar tag..." className="w-1/3 p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                                <button type="submit" className="bg-indigo-600 text-white px-5 rounded-xl hover:bg-indigo-700 font-bold"><Plus size={20} /></button>
                                                            </form>
                                                            <div className="space-y-2">
                                                                {keywords.filter(k => k.slot_id === slot.slot_id).map(k => (
                                                                    <div key={k.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                        <div className="flex gap-2 items-center"><span className="font-bold text-gray-800 dark:text-white">"{k.keyword}"</span> <span className="text-gray-400">→</span> <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded text-xs font-bold">{k.tag}</span></div>
                                                                        <button onClick={() => deleteKeyword(k.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeSlotTab === 'groups' && (
                                                        <div className="max-w-2xl">
                                                            <div className="flex justify-between items-center mb-6">
                                                                <h4 className="font-bold text-gray-700 dark:text-gray-300">Grupos Detectados</h4>
                                                                <button onClick={() => loadGroups(slot.slot_id)} className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-2 rounded-lg transition"><RefreshCw size={18} /></button>
                                                            </div>
                                                            {loadingGroups ? <div className="text-center py-10"><RefreshCw className="animate-spin mx-auto text-indigo-500" /></div> :
                                                                <div className="space-y-3">
                                                                    {groups.map(g => {
                                                                        const isActive = settings.groups?.[g.id]?.active;
                                                                        return (
                                                                            <div key={g.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                                <div><h5 className="font-bold text-gray-800 dark:text-white">{g.subject}</h5><p className="text-xs text-gray-500 dark:text-gray-400">{g.participants} participantes</p></div>
                                                                                <div className="flex items-center gap-4">
                                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                                        <input type="checkbox" className="sr-only peer" checked={!!isActive} onChange={() => toggleGroupActive(slot.slot_id, g.id, g.subject, settings)} />
                                                                                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:ring-4 peer-focus:ring-indigo-100 dark:peer-focus:ring-indigo-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                                                    </label>
                                                                                    <button onClick={() => handleSyncMembers(slot.slot_id, g.id)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 rounded-lg" title="Sincronizar Miembros"><Users size={18} /></button>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const TabButton = ({ active, onClick, icon, label, disabled }) => (
    <button onClick={onClick} disabled={disabled} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-colors ${active ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {icon} {label}
    </button>
);

const SettingRow = ({ label, desc, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer" onClick={onChange}>
        <div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
        </div>
        <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}></div>
        </div>
    </div>
);