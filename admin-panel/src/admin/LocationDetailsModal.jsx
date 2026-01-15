import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import QRCode from "react-qr-code";
import {
    X, Smartphone, Plus, Trash2, Settings, Tag,
    RefreshCw, Edit2, Loader2, User, Hash, Link2, MessageSquare, Users, AlertTriangle, Star, CheckCircle2, QrCode, Power, Zap, Save
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useLanguage } from '../context/LanguageContext';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

// --- HELPER COMPONENTS ---

const TabButton = ({ active, onClick, icon, label, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`relative flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {icon} {label}
        {active && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>}
    </button>
);

const SettingRow = ({ label, desc, checked, onChange }) => (
    <div
        className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer group shadow-sm"
        onClick={onChange}
    >
        <div className="pr-4">
            <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
        </div>
        <div className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
            <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
        </div>
    </div>
);

function SlotConnectionManager({ slot, locationId, token, onUpdate }) {
    const [status, setStatus] = useState({ connected: false, myNumber: null });
    const [qr, setQr] = useState(null);
    const [loading, setLoading] = useState(false);
    const pollInterval = useRef(null);

    const authFetch = async (endpoint, options = {}) => {
        return fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: { ...options.headers, 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
    };

    const checkStatus = async () => {
        try {
            const res = await authFetch(`/agency/slots/${locationId}/${slot.slot_id}/status`);
            if (res.ok) {
                const data = await res.json();
                setStatus({ connected: data.connected, myNumber: data.myNumber });
                if (data.connected) {
                    setQr(null);
                    setLoading(false);
                    stopPolling();
                    onUpdate();
                }
            }
        } catch (e) { }
    };

    const stopPolling = () => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
        }
    };

    useEffect(() => {
        checkStatus();
        return () => stopPolling();
    }, []);

    const handleConnect = async () => {
        setLoading(true);
        setQr(null);
        try {
            const res = await authFetch(`/agency/slots/${locationId}/${slot.slot_id}/start`, { method: 'POST' });
            if (!res.ok) throw new Error("Fallo al iniciar");

            // Polling QR
            stopPolling();
            pollInterval.current = setInterval(async () => {
                try {
                    const qrRes = await authFetch(`/agency/slots/${locationId}/${slot.slot_id}/qr`);
                    if (qrRes.ok) {
                        const data = await qrRes.json();
                        if (data.qr) setQr(data.qr);
                        if (data.connected) { checkStatus(); }
                    }
                } catch (e) { }
            }, 2000);

        } catch (e) {
            toast.error("Error iniciando conexión");
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm("¿Desconectar este dispositivo?")) return;
        setLoading(true);
        try {
            await authFetch(`/agency/slots/${locationId}/${slot.slot_id}/disconnect`, { method: 'DELETE' });
            setStatus({ connected: false, myNumber: null });
            setQr(null);
            stopPolling();
            onUpdate();
            toast.success("Desconectado");
        } catch (e) { toast.error("Error desconectando"); }
        setLoading(false);
    };

    return (
        <div className="max-w-2xl bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center">

            <div className="flex items-center gap-4 mb-6">
                 <div className={`p-4 rounded-full ${status.connected ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-gray-100 text-gray-400 dark:bg-gray-700'}`}>
                    {status.connected ? <Smartphone size={32} /> : <QrCode size={32} />}
                 </div>
                 <div className="text-center md:text-left">
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                         {status.connected ? "Dispositivo Conectado" : "Vincular WhatsApp"}
                     </h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400">
                         {status.connected ? `Número: +${status.myNumber}` : "Escanea el código QR para conectar."}
                     </p>
                 </div>
            </div>

            {!status.connected ? (
                <div className="w-full flex flex-col items-center">
                    {!qr && !loading && (
                         <button onClick={handleConnect} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2">
                             <QrCode size={20} /> Generar Código QR
                         </button>
                    )}

                    {(qr || loading) && (
                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                             <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 dark:border-gray-600 mb-4">
                                 {qr ? <QRCode value={qr} size={220} /> : <RefreshCw className="animate-spin text-indigo-500 w-12 h-12" />}
                             </div>
                             <p className="text-sm text-gray-500 mb-4">{qr ? "Escanea con tu teléfono" : "Iniciando sesión..."}</p>
                             <button onClick={() => { setQr(null); setLoading(false); stopPolling(); }} className="text-gray-400 hover:text-gray-600 underline text-sm">Cancelar</button>
                        </div>
                    )}
                </div>
            ) : (
                <button onClick={handleDisconnect} disabled={loading} className="border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20 px-6 py-3 rounded-xl font-bold transition flex items-center gap-2">
                    <Power size={20} /> Desconectar
                </button>
            )}
        </div>
    );
}

// --- MAIN COMPONENT ---

export default function LocationDetailsModal({ location, onClose, token, onLogout, onUpgrade, onDataChange }) {
    const { t } = useLanguage();
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

        if (socket && location.location_id) {
            console.log(`🔌 Uniéndose a sala: ${location.location_id}`);
            socket.emit('join_room', location.location_id);
        }

        const handleEvent = (payload) => {
            if (payload.locationId === location.location_id) {
                if (payload.type === 'connection') {
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

            if (!res) return;

            const data = await res.json();
            toast.dismiss(loadingId);

            if (data.success) {
                toast.success("Dispositivo agregado", { description: "Listo para vincular." });
                loadData();
                if (onDataChange) onDataChange();
            } else {
                if (data.requiresUpgrade) {
                    toast.error("Límite Alcanzado", {
                        description: data.error,
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
                    toast.error("Error", { description: data.error || "No se pudo agregar el dispositivo." });
                }
            }
        } catch (e) {
            toast.dismiss(loadingId);
            toast.error("Error de conexión");
            console.error(e);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 rounded-[28px] shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 ring-1 ring-black/5">

                {/* HEADER */}
                <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm">
                                <Smartphone size={28} strokeWidth={2} />
                            </div>
                            {locationName || location.location_id}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 ml-[4.5rem] font-medium">{t('slots.subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition text-gray-400 hover:text-gray-600">
                        <X size={26} />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto bg-gray-50/80 dark:bg-[#0B0D11]">
                    <div className="max-w-5xl mx-auto p-8">
                        <div className="flex justify-between items-center mb-8">
                             <h3 className="text-lg font-bold text-gray-900 dark:text-white">Dispositivos Conectados</h3>
                             <button onClick={handleAddSlot} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 dark:shadow-none transition-all hover:scale-[1.02] active:scale-95">
                                <Plus size={20} /> {t('slots.new')}
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center p-20 gap-4">
                                <RefreshCw className="animate-spin text-indigo-500 w-8 h-8" />
                                <p className="text-gray-400 font-medium">Cargando...</p>
                            </div>
                        ) : slots.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl bg-white/50 dark:bg-gray-900/20">
                                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 text-gray-300 dark:text-gray-600">
                                    <Smartphone size={32} />
                                </div>
                                <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('slots.empty')}</h4>
                                <p className="text-gray-500 dark:text-gray-400 max-w-sm text-center">No hay dispositivos conectados en esta ubicación.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {slots.map(slot => {
                                    const isExpanded = expandedSlotId === slot.slot_id;
                                    const isConnected = !!slot.phone_number;
                                    const currentPrio = slot.priority || 99;
                                    const settings = slot.settings || {};

                                    return (
                                        <div key={slot.slot_id} className={`group bg-white dark:bg-gray-900 border rounded-2xl transition-all duration-300 overflow-hidden ${isExpanded ? 'border-indigo-500/50 ring-4 ring-indigo-500/10 shadow-2xl scale-[1.01]' : 'border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700'}`}>

                                            {/* CABECERA SLOT */}
                                            <div className="p-6 flex items-center justify-between cursor-pointer" onClick={() => handleExpandSlot(slot.slot_id)}>
                                                <div className="flex items-center gap-6">
                                                    <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${isConnected ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'}`}>
                                                        <Smartphone size={24} />
                                                        {isConnected && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center"><CheckCircle2 size={14} className="text-emerald-500 fill-current" /></div>}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h3 className="font-bold text-gray-900 dark:text-white text-xl tracking-tight">{slot.slot_name || `Dispositivo ${slot.slot_id}`}</h3>
                                                            {slot.is_favorite && <Star size={16} className="text-amber-400 fill-current" />}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm font-medium">
                                                            <div className={`px-2.5 py-0.5 rounded-md flex items-center gap-1.5 ${isConnected ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                                                {isConnected ? `+${slot.phone_number}` : 'Desconectado'}
                                                            </div>
                                                            <span className="text-gray-300 dark:text-gray-700">|</span>
                                                            <span className="text-gray-500 dark:text-gray-400">Prioridad: {currentPrio}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="flex bg-gray-50 dark:bg-gray-800 p-1 rounded-xl mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleFavorite(slot.slot_id, slot.is_favorite); }}
                                                            className={`p-2 rounded-lg transition ${slot.is_favorite ? 'text-amber-400' : 'text-gray-400 hover:text-amber-400 hover:bg-white dark:hover:bg-gray-700 shadow-sm'}`}
                                                            title="Favorito"
                                                        >
                                                            <Star size={18} fill={slot.is_favorite ? "currentColor" : "none"} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); editSlotName(slot.slot_id, slot.slot_name); }}
                                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-700 shadow-sm rounded-lg transition"
                                                            title="Editar Nombre"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                    </div>

                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSlot(slot.slot_id); }} className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition" disabled={deletingSlotId === slot.slot_id}>
                                                        {deletingSlotId === slot.slot_id ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                                    </button>

                                                    <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-gray-100 dark:bg-gray-800' : ''}`}>
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="m6 9 6 6 6-6"/></svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* CONTENIDO EXPANDIBLE */}
                                            {isExpanded && (
                                                <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-[#0B0D11]/50 animate-in slide-in-from-top-2">
                                                    {/* TABS */}
                                                    <div className="flex px-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 overflow-x-auto">
                                                        <TabButton active={activeSlotTab === 'general'} onClick={() => setActiveSlotTab('general')} icon={<Settings size={18} />} label={t('slots.tab.general')} />
                                                        <TabButton active={activeSlotTab === 'ghl'} onClick={() => setActiveSlotTab('ghl')} icon={<Link2 size={18} />} label={t('slots.tab.integration')} />
                                                        <TabButton active={activeSlotTab === 'keywords'} onClick={() => setActiveSlotTab('keywords')} icon={<MessageSquare size={18} />} label={t('slots.tab.keywords')} />
                                                        <TabButton active={activeSlotTab === 'groups'} onClick={() => { if (!isConnected) return toast.warning("Conecta WhatsApp primero."); setActiveSlotTab('groups'); loadGroups(slot.slot_id); }} icon={<Users size={18} />} label={t('slots.tab.groups')} disabled={!isConnected} />
                                                        <TabButton active={activeSlotTab === 'qr'} onClick={() => setActiveSlotTab('qr')} icon={<QrCode size={18} />} label={t('slots.tab.connection') || "Conexión"} />
                                                    </div>

                                                    <div className="p-8">
                                                        {/* CONFIG PANELS */}
                                                        {activeSlotTab === 'general' && (
                                                            <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-right-4">
                                                                <div>
                                                                    <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Hash size={14} /> {t('slots.settings.order')}</h4>
                                                                    <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                        <div>
                                                                            <label className="text-base font-bold text-gray-900 dark:text-white block">{t('slots.settings.priority_level')}</label>
                                                                            <p className="text-sm text-gray-500 mt-1">Define el orden de uso de este número.</p>
                                                                        </div>
                                                                        <select className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 block p-3 min-w-[120px] outline-none font-bold" value={currentPrio} onChange={(e) => changePriority(slot.slot_id, e.target.value)}>
                                                                            {Array.from({ length: slots.length }, (_, k) => k + 1).map(p => <option key={p} value={p}>{p} {p === 1 ? '(Alta)' : ''}</option>)}
                                                                            {currentPrio > slots.length && <option value={currentPrio}>{currentPrio}</option>}
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Zap size={14} /> {t('slots.settings.behavior')}</h4>
                                                                    <div className="grid grid-cols-1 gap-3">
                                                                        <SettingRow label={t('slots.settings.source_label')} desc={t('slots.settings.source_desc')} checked={settings.show_source_label ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'show_source_label', settings)} />
                                                                        <SettingRow label={t('slots.settings.transcribe')} desc={t('slots.settings.transcribe_desc')} checked={settings.transcribe_audio ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'transcribe_audio', settings)} />
                                                                        <SettingRow label={t('slots.settings.create_contacts')} desc={t('slots.settings.create_contacts_desc')} checked={settings.create_unknown_contacts ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'create_unknown_contacts', settings)} />
                                                                        <SettingRow label={t('slots.settings.alert_disconnect')} desc={t('slots.settings.alert_disconnect_desc')} checked={settings.send_disconnect_message ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'send_disconnect_message', settings)} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                    {/* OTHER PANELS (GHL, Keywords, Groups) */}
                                                    {activeSlotTab === 'ghl' && (
                                                        <div className="max-w-2xl space-y-6">
                                                            
                                                            {/* 🔥 NUEVO: OpenAI Key para este Slot */}
                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div>
                                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                                                            <div className="w-6 h-6 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded flex items-center justify-center">
                                                                                <Zap size={14} />
                                                                            </div>
                                                                            OpenAI API Key (Transcripción)
                                                                        </label>
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                            Configura una key única para este número. Dejar vacío para desactivar.
                                                                        </p>
                                                                    </div>
                                                                    {slot.openai_api_key && (
                                                                        <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
                                                                            Conectado
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                
                                                                <div className="flex gap-2">
                                                                     <input 
                                                                        type="password" 
                                                                        name={`openai_key_${slot.slot_id}`}
                                                                        autoComplete="new-password"
                                                                        placeholder={slot.openai_api_key ? "•••••••••••••••• (Oculto)" : "sk-..."}
                                                                        className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition font-mono text-sm"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                const val = e.target.value.trim();
                                                                                if (val) {
                                                                                    authFetch(`/agency/update-slot-config`, {
                                                                                        method: 'POST',
                                                                                        body: JSON.stringify({ locationId: location.location_id, slotId: slot.slot_id, openai_api_key: val })
                                                                                    }).then(() => { toast.success("API Key guardada"); e.target.value = ""; loadData(); });
                                                                                }
                                                                            }
                                                                        }}
                                                                     />
                                                                     <button 
                                                                        onClick={(e) => {
                                                                             // Buscamos el input hermano anterior
                                                                             const input = e.currentTarget.previousElementSibling;
                                                                             const val = input.value.trim();
                                                                             if (val) {
                                                                                 authFetch(`/agency/update-slot-config`, {
                                                                                     method: 'POST',
                                                                                     body: JSON.stringify({ locationId: location.location_id, slotId: slot.slot_id, openai_api_key: val })
                                                                                 }).then(() => { toast.success("API Key guardada"); input.value = ""; loadData(); });
                                                                             } else {
                                                                                 toast.error("Ingresa una Key válida");
                                                                             }
                                                                        }}
                                                                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold transition shadow-sm flex items-center gap-2"
                                                                     >
                                                                         <Save size={18} /> Guardar
                                                                     </button>
                                                                     
                                                                     {slot.openai_api_key && (
                                                                         <button 
                                                                            onClick={() => {
                                                                                if(confirm("¿Borrar API Key de este número?")) {
                                                                                    authFetch(`/agency/update-slot-config`, {
                                                                                        method: 'POST',
                                                                                        body: JSON.stringify({ locationId: location.location_id, slotId: slot.slot_id, openai_api_key: "" })
                                                                                    }).then(() => { toast.success("API Key eliminada"); loadData(); });
                                                                                }
                                                                            }}
                                                                            className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                                            title="Borrar Key"
                                                                         >
                                                                             <Trash2 size={18} />
                                                                         </button>
                                                                     )}
                                                                </div>
                                                            </div>

                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.ghl.tag_auto')}</label>
                                                                <input type="text" placeholder={t('slots.ghl.tag_auto_ph')} className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition" value={settings.ghl_contact_tag || ""} onChange={(e) => changeSlotSetting(slot.slot_id, 'ghl_contact_tag', e.target.value, settings)} />
                                                            </div>
                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.ghl.user')}</label>
                                                                <select className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={settings.ghl_assigned_user || ""} onChange={(e) => changeSlotSetting(slot.slot_id, 'ghl_assigned_user', e.target.value, settings)}>
                                                                    <option value="">{t('slots.ghl.user_none')}</option>
                                                                    {ghlUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.ghl.routing')}</label>
                                                                <input type="text" placeholder={t('slots.ghl.routing_ph')} className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition" value={settings.routing_tag || ""} onChange={(e) => changeSlotSetting(slot.slot_id, 'routing_tag', e.target.value, settings)} />
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Si el contacto tiene el tag <strong>[PRIOR]: {settings.routing_tag || "..."}</strong>, se usará este número.</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeSlotTab === 'keywords' && (
                                                        <div className="max-w-2xl">
                                                            <form onSubmit={(e) => handleAddKeyword(e, slot.slot_id)} className="flex gap-3 mb-6">
                                                                <input name="keyword" required placeholder={t('slots.kw.input')} className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                                <input name="tag" required placeholder={t('slots.kw.tag')} className="w-1/3 p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
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
                                                                <h4 className="font-bold text-gray-700 dark:text-gray-300">{t('slots.groups.detected')}</h4>
                                                                <button onClick={() => loadGroups(slot.slot_id)} className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-2 rounded-lg transition"><RefreshCw size={18} /></button>
                                                            </div>
                                                            {loadingGroups ? <div className="text-center py-10"><RefreshCw className="animate-spin mx-auto text-indigo-500" /></div> :
                                                                <div className="space-y-3">
                                                                    {groups.map(g => {
                                                                        const isActive = settings.groups?.[g.id]?.active;
                                                                        return (
                                                                            <div key={g.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                                <div><h5 className="font-bold text-gray-800 dark:text-white">{g.subject}</h5><p className="text-xs text-gray-500 dark:text-gray-400">{g.participants} {t('slots.groups.participants')}</p></div>
                                                                                <div className="flex items-center gap-4">
                                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                                        <input type="checkbox" className="sr-only peer" checked={!!isActive} onChange={() => toggleGroupActive(slot.slot_id, g.id, g.subject, settings)} />
                                                                                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:ring-4 peer-focus:ring-indigo-100 dark:peer-focus:ring-indigo-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                                                    </label>
                                                                                    <button onClick={() => handleSyncMembers(slot.slot_id, g.id)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 rounded-lg" title={t('slots.groups.sync')}><Users size={18} /></button>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            }
                                                        </div>
                                                    )}

                                                    {activeSlotTab === 'qr' && (
                                                        <SlotConnectionManager 
                                                            slot={slot} 
                                                            locationId={location.location_id} 
                                                            token={token} 
                                                            onUpdate={loadData} 
                                                        />
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
    </div>
    );
}
