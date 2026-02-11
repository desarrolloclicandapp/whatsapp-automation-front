import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import QRCode from "react-qr-code";
import {
    X, Smartphone, Plus, Trash2, Settings, Tag,
    RefreshCw, Edit2, Loader2, User, Hash, Link2, MessageSquare, Users, AlertTriangle, Star, CheckCircle2, QrCode, Power, Zap, Save, Mic, Play
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket'; // ✅ Importar Hook de Socket
import { useLanguage } from '../context/LanguageContext';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

export default function LocationDetailsModal({ location, onClose, token, onLogout, onUpgrade, onDataChange }) {
    const { t } = useLanguage();
    const [slots, setSlots] = useState([]);
    const [keywords, setKeywords] = useState([]);
    const [ghlUsers, setGhlUsers] = useState([]);
    const [locationName, setLocationName] = useState(location.name || "");
    const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(true);
    const [maxSubagencies, setMaxSubagencies] = useState(null);
    const [loading, setLoading] = useState(true);
    const rawFeatures = localStorage.getItem("agencyFeatures");
    const storedRole = localStorage.getItem("userRole");
    let canWhiteLabel = false;
    try {
        const features = rawFeatures ? JSON.parse(rawFeatures) : {};
        canWhiteLabel = (features?.whitelabel ?? features?.white_label) === true || storedRole === 'admin' || maxSubagencies === 50;
    } catch (e) {
        canWhiteLabel = storedRole === 'admin' || maxSubagencies === 50;
    }

    // Control de UI
    const [expandedSlotId, setExpandedSlotId] = useState(null);
    const [activeSlotTab, setActiveSlotTab] = useState('general');
    const [groups, setGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [deletingSlotId, setDeletingSlotId] = useState(null);
    const [elevenVoicesBySlot, setElevenVoicesBySlot] = useState({});
    const [loadingElevenVoices, setLoadingElevenVoices] = useState({});
    const previewAudioRef = useRef(null);
    const [previewTextBySlot, setPreviewTextBySlot] = useState({});
    const [twilioConfigBySlot, setTwilioConfigBySlot] = useState({});
    const [loadingTwilioBySlot, setLoadingTwilioBySlot] = useState({});
    const [savingTwilioBySlot, setSavingTwilioBySlot] = useState({});

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
                // 🔥 FIX: No recargar todo el modal por eventos de QR (lo maneja el componente hijo)
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
                // No es estrictamente necesario emitir 'leave_room' si el socket se desconecta,
                // pero al desmontar el componente dejamos de escuchar.
            }
        };
    }, [location, socket]);

    useEffect(() => {
        const loadAccountLimits = async () => {
            try {
                const res = await authFetch('/agency/info');
                if (res && res.ok) {
                    const data = await res.json();
                    setMaxSubagencies(data?.limits?.max_subagencies ?? null);
                }
            } catch (e) { }
        };
        loadAccountLimits();
    }, []);

    useEffect(() => {
        if (activeSlotTab !== 'ghl' || !expandedSlotId) return;
        const slot = slots.find(s => s.slot_id === expandedSlotId);
        if (!slot?.elevenlabs_api_key) return;
        if (elevenVoicesBySlot[slot.slot_id]) return;
        loadElevenVoices(slot.slot_id);
    }, [activeSlotTab, expandedSlotId, slots, elevenVoicesBySlot]);

    useEffect(() => {
        if (activeSlotTab !== 'sms' || !expandedSlotId) return;
        if (twilioConfigBySlot[expandedSlotId]) return;
        loadTwilioConfig(expandedSlotId);
    }, [activeSlotTab, expandedSlotId, twilioConfigBySlot]);

    useEffect(() => {
        return () => {
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current = null;
            }
        };
    }, []);

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
                setWhiteLabelEnabled(data.settings?.white_label ?? true);
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

    const loadElevenVoices = async (slotId, forceRefresh = false) => {
        if (!slotId) return;
        setLoadingElevenVoices(prev => ({ ...prev, [slotId]: true }));
        try {
            const refreshParam = forceRefresh ? "&refresh=1" : "";
            const res = await authFetch(`/agency/elevenlabs/voices?locationId=${location.location_id}&slotId=${slotId}${refreshParam}`);
            if (res && res.ok) {
                const data = await res.json();
                setElevenVoicesBySlot(prev => ({ ...prev, [slotId]: data.voices || [] }));
            } else if (res) {
                const errText = await res.text();
                toast.error("Error cargando voces", { description: errText || "Respuesta inválida" });
            }
        } catch (e) {
            toast.error("Error cargando voces");
        } finally {
            setLoadingElevenVoices(prev => ({ ...prev, [slotId]: false }));
        }
    };

    const saveElevenApiKey = async (slotId, rawKey) => {
        const apiKey = (rawKey || "").trim();
        if (!apiKey) {
            toast.error("Ingresa una Key válida");
            return false;
        }

        const loadingId = toast.loading("Validando API Key...");
        try {
            const validateRes = await authFetch(`/agency/elevenlabs/validate`, {
                method: 'POST',
                body: JSON.stringify({ apiKey })
            });

            if (!validateRes) return false;

            if (!validateRes.ok) {
                const err = await validateRes.json().catch(() => ({}));
                toast.error("API Key inválida", { description: err.error || "No se pudo validar" });
                return false;
            }

            const validateData = await validateRes.json();
            await authFetch(`/agency/update-slot-config`, {
                method: 'POST',
                body: JSON.stringify({ locationId: location.location_id, slotId, elevenlabs_api_key: apiKey })
            });

            toast.success("API Key guardada");
            setElevenVoicesBySlot(prev => ({ ...prev, [slotId]: validateData.voices || [] }));
            loadData();
            return true;
        } catch (e) {
            toast.error("Error validando API Key");
            return false;
        } finally {
            toast.dismiss(loadingId);
        }
    };

    const playVoicePreview = async (slotId, voiceId) => {
        try {
            if (!voiceId) {
                toast.error("Selecciona una voz para el preview");
                return;
            }
            const previewText = (previewTextBySlot[slotId] || "").trim();
            const res = await authFetch(`/agency/elevenlabs/preview`, {
                method: 'POST',
                body: JSON.stringify({
                    locationId: location.location_id,
                    slotId,
                    voiceId,
                    text: previewText || undefined
                })
            });

            if (!res) return;

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast.error("Preview falló", { description: err.error || "No se pudo generar" });
                return;
            }

            const data = await res.json();
            if (!data.url) {
                toast.error("Preview inválido");
                return;
            }

            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current = null;
            }

            const audio = new Audio(data.url);
            previewAudioRef.current = audio;
            await audio.play();
        } catch (e) {
            toast.error("Error reproduciendo preview");
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

            // Si authFetch devuelve null es porque hizo logout automático (401/403 real), salimos.
            if (!res) return;

            const data = await res.json();
            toast.dismiss(loadingId);

            // 🔥 NUEVA LÓGICA: Verificar 'data.success' aunque el status sea 200
            if (data.success) {
                toast.success("Dispositivo agregado", { description: "Listo para vincular." });
                loadData();
                if (onDataChange) onDataChange();
            } else {
                // Manejo de errores lógicos (Límites, etc.)
                if (data.requiresUpgrade) {
                    toast.error("Límite Alcanzado", {
                        description: data.error,
                        duration: 6000,
                        icon: <AlertTriangle className="text-amber-500" />,
                        action: {
                            label: 'Ampliar Plan',
                            onClick: () => {
                                onClose();
                                if (onUpgrade) onUpgrade(); // Abre el modal de suscripción
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

    const toggleWhiteLabel = async () => {
        const nextValue = !whiteLabelEnabled;
        setWhiteLabelEnabled(nextValue);
        try {
            const res = await authFetch(`/agency/settings/${location.location_id}`, {
                method: 'PUT',
                body: JSON.stringify({ settings: { white_label: nextValue } })
            });
            if (!res || !res.ok) throw new Error("Error");
            toast.success(nextValue ? "White Label activado" : "White Label desactivado");
        } catch (e) {
            toast.error("Error guardando White Label");
            setWhiteLabelEnabled(!nextValue);
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

    const loadTwilioConfig = async (slotId, forceRefresh = false) => {
        if (!slotId) return;
        if (!forceRefresh && twilioConfigBySlot[slotId]) return;

        setLoadingTwilioBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/twilio/config?locationId=${location.location_id}&slotId=${slotId}`);
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo cargar Twilio");
            }
            const data = await res.json();
            setTwilioConfigBySlot(prev => ({
                ...prev,
                [slotId]: {
                    accountSid: "",
                    authToken: "",
                    phoneNumber: data.phoneNumber || "",
                    accountSidMasked: data.accountSidMasked || "",
                    authTokenMasked: data.authTokenMasked || "",
                    hasAuthToken: !!data.hasAuthToken,
                    configured: !!data.configured
                }
            }));
        } catch (e) {
            toast.error("Error cargando Twilio", { description: e.message });
        } finally {
            setLoadingTwilioBySlot(prev => ({ ...prev, [slotId]: false }));
        }
    };

    const updateTwilioField = (slotId, key, value) => {
        setTwilioConfigBySlot(prev => {
            const current = prev[slotId] || {
                accountSid: "",
                authToken: "",
                phoneNumber: "",
                accountSidMasked: "",
                authTokenMasked: "",
                hasAuthToken: false,
                configured: false
            };
            return {
                ...prev,
                [slotId]: {
                    ...current,
                    [key]: value
                }
            };
        });
    };

    const validateTwilioConfigSlot = async (slotId) => {
        const current = twilioConfigBySlot[slotId] || {};
        const payload = {
            locationId: location.location_id,
            slotId
        };

        if ((current.accountSid || "").trim()) payload.accountSid = current.accountSid.trim();
        if ((current.authToken || "").trim()) payload.authToken = current.authToken.trim();
        if ((current.phoneNumber || "").trim()) payload.fromNumber = current.phoneNumber.trim();

        const loadingId = toast.loading("Validando Twilio...");
        try {
            const res = await authFetch(`/agency/twilio/validate`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!res) return false;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Credenciales inválidas");
            }
            toast.success("Twilio validado correctamente");
            return true;
        } catch (e) {
            toast.error("Validación Twilio falló", { description: e.message });
            return false;
        } finally {
            toast.dismiss(loadingId);
        }
    };

    const saveTwilioConfig = async (slotId) => {
        const current = twilioConfigBySlot[slotId] || {};
        const sidInput = (current.accountSid || "").trim();
        const tokenInput = (current.authToken || "").trim();
        const fromNumber = (current.phoneNumber || "").trim();

        const sidReady = sidInput || current.accountSidMasked;
        const tokenReady = tokenInput || current.authTokenMasked || current.hasAuthToken;

        if (!sidReady || !tokenReady || !fromNumber) {
            toast.error("Completa SID, Auth Token y número Twilio");
            return;
        }

        const payload = {
            locationId: location.location_id,
            slotId,
            fromNumber
        };
        if (sidInput) payload.accountSid = sidInput;
        if (tokenInput) payload.authToken = tokenInput;

        setSavingTwilioBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/twilio/config`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo guardar");
            }
            toast.success("Configuración Twilio guardada");
            await loadTwilioConfig(slotId, true);
        } catch (e) {
            toast.error("Error guardando Twilio", { description: e.message });
        } finally {
            setSavingTwilioBySlot(prev => ({ ...prev, [slotId]: false }));
        }
    };

    const clearTwilioConfig = async (slotId) => {
        const loadingId = toast.loading("Limpiando Twilio...");
        try {
            const res = await authFetch(`/agency/twilio/config`, {
                method: 'PUT',
                body: JSON.stringify({
                    locationId: location.location_id,
                    slotId,
                    clear: true
                })
            });
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo limpiar");
            }
            setTwilioConfigBySlot(prev => ({
                ...prev,
                [slotId]: {
                    accountSid: "",
                    authToken: "",
                    phoneNumber: "",
                    accountSidMasked: "",
                    authTokenMasked: "",
                    hasAuthToken: false,
                    configured: false
                }
            }));
            toast.success("Twilio limpiado");
        } catch (e) {
            toast.error("Error limpiando Twilio", { description: e.message });
        } finally {
            toast.dismiss(loadingId);
        }
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
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-14">{t('slots.subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50 dark:bg-black/20">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                        {canWhiteLabel && (
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 flex items-center gap-4 shadow-sm">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                                    <Settings size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">White Label</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">Usar branding de la agencia</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer ml-2">
                                    <input type="checkbox" className="sr-only peer" checked={whiteLabelEnabled} onChange={toggleWhiteLabel} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        )}
                        <div className="flex justify-end">
                            <button onClick={handleAddSlot} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition transform hover:-translate-y-0.5 active:scale-95">
                                <Plus size={18} /> {t('slots.new')}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-20"><RefreshCw className="animate-spin text-indigo-500 w-10 h-10" /></div>
                    ) : slots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900/50">
                            <Smartphone className="text-gray-300 dark:text-gray-600 w-16 h-16 mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">{t('slots.empty')}</p>
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
                                                        {isConnected ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{slot.phone_number}</span> : t('slots.card.disconnected')}
                                                        <span className="text-gray-300 dark:text-gray-600">•</span>
                                                        <span>{t('slots.card.priority')}: {currentPrio}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                    {isExpanded ? t('slots.card.managing') : t('slots.card.manage')}
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
                                                    <TabButton active={activeSlotTab === 'general'} onClick={() => setActiveSlotTab('general')} icon={<Settings size={16} />} label={t('slots.tab.general')} />
                                                    <TabButton active={activeSlotTab === 'ghl'} onClick={() => setActiveSlotTab('ghl')} icon={<Link2 size={16} />} label={t('slots.tab.integration')} />
                                                    <TabButton active={activeSlotTab === 'sms'} onClick={() => setActiveSlotTab('sms')} icon={<Smartphone size={16} />} label="SMS / Twilio" />
                                                    <TabButton active={activeSlotTab === 'keywords'} onClick={() => setActiveSlotTab('keywords')} icon={<MessageSquare size={16} />} label={t('slots.tab.keywords')} />
                                                    <TabButton active={activeSlotTab === 'groups'} onClick={() => { if (!isConnected) return toast.warning("Conecta WhatsApp primero."); setActiveSlotTab('groups'); loadGroups(slot.slot_id); }} icon={<Users size={16} />} label={t('slots.tab.groups')} disabled={!isConnected} />
                                                    <TabButton active={activeSlotTab === 'qr'} onClick={() => setActiveSlotTab('qr')} icon={<QrCode size={16} />} label={t('slots.tab.connection') || "Conexión"} />
                                                </div>

                                                <div className="p-8">
                                                    {/* CONFIG PANELS */}
                                                    {activeSlotTab === 'general' && (
                                                        <div className="max-w-2xl">
                                                            <div className="mb-8">
                                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{t('slots.settings.order')}</h4>
                                                                <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('slots.settings.priority_level')}:</label>
                                                                    <select className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none" value={currentPrio} onChange={(e) => changePriority(slot.slot_id, e.target.value)}>
                                                                        {Array.from({ length: slots.length }, (_, k) => k + 1).map(p => <option key={p} value={p}>{p} {p === 1 ? '(Alta)' : ''}</option>)}
                                                                        {currentPrio > slots.length && <option value={currentPrio}>{currentPrio}</option>}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{t('slots.settings.behavior')}</h4>
                                                            <div className="space-y-3 bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700">
                                                                <SettingRow label={t('slots.settings.source_label')} desc={t('slots.settings.source_desc')} checked={settings.show_source_label ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'show_source_label', settings)} />
                                                                <SettingRow label={t('slots.settings.transcribe')} desc={t('slots.settings.transcribe_desc')} checked={settings.transcribe_audio ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'transcribe_audio', settings)} />
                                                                <SettingRow label={t('slots.settings.create_contacts')} desc={t('slots.settings.create_contacts_desc')} checked={settings.create_unknown_contacts ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'create_unknown_contacts', settings)} />
                                                                <SettingRow label={t('slots.settings.alert_disconnect')} desc={t('slots.settings.alert_disconnect_desc')} checked={settings.send_disconnect_message ?? true} onChange={() => toggleSlotSetting(slot.slot_id, 'send_disconnect_message', settings)} />
                                                                <div className="p-3">
                                                                    <label className="text-sm font-bold text-gray-800 dark:text-gray-200 block">
                                                                        Número de Alerta / Alert Number
                                                                    </label>
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                                        Dejar vacío para enviar al número desconectado.
                                                                    </p>
                                                                    <input
                                                                        type="text"
                                                                        value={settings.alert_phone_number || ""}
                                                                        onChange={(e) => changeSlotSetting(slot.slot_id, 'alert_phone_number', e.target.value, settings)}
                                                                        placeholder="+1 555 000 0000"
                                                                        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* OTHER PANELS (GHL, Keywords, Groups) same as before... */}
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
                                                                                        body: JSON.stringify({ locationId: location.location_id, slotId: slot.slot_id, openai_api_key: "" }) // Send empty string to clear
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

                                                            {/* 🔥 NUEVO: ElevenLabs Key + Voz por defecto */}
                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div>
                                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                                                            <div className="w-6 h-6 bg-sky-100 dark:bg-sky-900/30 text-sky-600 rounded flex items-center justify-center">
                                                                                <Mic size={14} />
                                                                            </div>
                                                                            ElevenLabs API Key (Voces)
                                                                        </label>
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                            Configura una key única para este número. Dejar vacío para desactivar.
                                                                        </p>
                                                                    </div>
                                                                    {slot.elevenlabs_api_key && (
                                                                        <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
                                                                            Conectado
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="password"
                                                                        name={`elevenlabs_key_${slot.slot_id}`}
                                                                        autoComplete="new-password"
                                                                        placeholder={slot.elevenlabs_api_key ? "•••••••••••••••• (Oculto)" : "sk_..."}
                                                                        className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition font-mono text-sm"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                const val = e.target.value;
                                                                                saveElevenApiKey(slot.slot_id, val).then((ok) => {
                                                                                    if (ok) e.target.value = "";
                                                                                });
                                                                            }
                                                                        }}
                                                                    />
                                                                    <button
                                                                        onClick={(e) => {
                                                                            const input = e.currentTarget.previousElementSibling;
                                                                            const val = input.value;
                                                                            saveElevenApiKey(slot.slot_id, val).then((ok) => {
                                                                                if (ok) input.value = "";
                                                                            });
                                                                        }}
                                                                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold transition shadow-sm flex items-center gap-2"
                                                                    >
                                                                        <Save size={18} /> Guardar
                                                                    </button>

                                                                    {slot.elevenlabs_api_key && (
                                                                        <button
                                                                            onClick={() => {
                                                                                if (confirm("¿Borrar API Key de este número?")) {
                                                                                    authFetch(`/agency/update-slot-config`, {
                                                                                        method: 'POST',
                                                                                        body: JSON.stringify({ locationId: location.location_id, slotId: slot.slot_id, elevenlabs_api_key: "", elevenlabs_voice_id: "" })
                                                                                    }).then(() => {
                                                                                        toast.success("API Key eliminada");
                                                                                        loadData();
                                                                                        setElevenVoicesBySlot(prev => ({ ...prev, [slot.slot_id]: [] }));
                                                                                    });
                                                                                }
                                                                            }}
                                                                            className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                                            title="Borrar Key"
                                                                        >
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                <div className="mt-4">
                                                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                                        Voz por defecto
                                                                    </label>
                                                                    <div className="mb-2">
                                                                        <input
                                                                            type="text"
                                                                            value={previewTextBySlot[slot.slot_id] || ""}
                                                                            onChange={(e) => setPreviewTextBySlot(prev => ({ ...prev, [slot.slot_id]: e.target.value }))}
                                                                            placeholder="Texto para preview (opcional)"
                                                                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition text-sm"
                                                                        />
                                                                    </div>
                                                                    <div className="flex gap-2 items-center">
                                                                        <select
                                                                            className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                                                                            value={slot.elevenlabs_voice_id || ""}
                                                                            disabled={!slot.elevenlabs_api_key}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                authFetch(`/agency/update-slot-config`, {
                                                                                    method: 'POST',
                                                                                    body: JSON.stringify({ locationId: location.location_id, slotId: slot.slot_id, elevenlabs_voice_id: val })
                                                                                }).then(() => {
                                                                                    toast.success("Voz por defecto guardada");
                                                                                    loadData();
                                                                                });
                                                                            }}
                                                                        >
                                                                            <option value="">{slot.elevenlabs_api_key ? "Sin voz por defecto" : "Configura la API Key primero"}</option>
                                                                            {slot.elevenlabs_voice_id && !(elevenVoicesBySlot[slot.slot_id] || []).some(v => v.id === slot.elevenlabs_voice_id) && (
                                                                                <option value={slot.elevenlabs_voice_id}>Voz actual ({slot.elevenlabs_voice_id})</option>
                                                                            )}
                                                                            {(elevenVoicesBySlot[slot.slot_id] || []).map(v => (
                                                                                <option key={v.id} value={v.id}>{v.name}</option>
                                                                            ))}
                                                                        </select>
                                                                        <button
                                                                            onClick={() => loadElevenVoices(slot.slot_id, true)}
                                                                            disabled={!slot.elevenlabs_api_key || loadingElevenVoices[slot.slot_id]}
                                                                            className="px-3 py-2 text-sky-600 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-400 dark:hover:bg-sky-900/40 rounded-lg transition"
                                                                            title="Actualizar voces"
                                                                        >
                                                                            <RefreshCw size={18} className={loadingElevenVoices[slot.slot_id] ? "animate-spin" : ""} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const fallbackVoice = (elevenVoicesBySlot[slot.slot_id] || [])[0]?.id || "";
                                                                                const previewVoice = slot.elevenlabs_voice_id || fallbackVoice;
                                                                                playVoicePreview(slot.slot_id, previewVoice);
                                                                            }}
                                                                            disabled={!slot.elevenlabs_api_key || loadingElevenVoices[slot.slot_id]}
                                                                            className="px-3 py-2 text-sky-600 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-400 dark:hover:bg-sky-900/40 rounded-lg transition"
                                                                            title="Preview"
                                                                        >
                                                                            <Play size={18} />
                                                                        </button>
                                                                    </div>
                                                                    {slot.elevenlabs_api_key && (elevenVoicesBySlot[slot.slot_id] || []).length === 0 && !loadingElevenVoices[slot.slot_id] && (
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                                                            No hay voces cargadas o no se pudieron obtener.
                                                                        </p>
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
                                                            {/* 
                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.ghl.routing')}</label>
                                                                <input type="text" placeholder={t('slots.ghl.routing_ph')} className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition" value={settings.routing_tag || ""} onChange={(e) => changeSlotSetting(slot.slot_id, 'routing_tag', e.target.value, settings)} />
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Si el contacto tiene el tag <strong>[PRIOR]: {settings.routing_tag || "..."}</strong>, se usará este número.</p>
                                                            </div> 
                                                            */}
                                                        </div>
                                                    )}

                                                    {activeSlotTab === 'sms' && (
                                                        <div className="max-w-2xl space-y-6">
                                                            {(() => {
                                                                const twilio = twilioConfigBySlot[slot.slot_id] || {
                                                                    accountSid: "",
                                                                    authToken: "",
                                                                    phoneNumber: "",
                                                                    accountSidMasked: "",
                                                                    authTokenMasked: "",
                                                                    hasAuthToken: false,
                                                                    configured: false
                                                                };
                                                                const isLoadingTwilio = !!loadingTwilioBySlot[slot.slot_id];
                                                                const isSavingTwilio = !!savingTwilioBySlot[slot.slot_id];

                                                                return (
                                                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
                                                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                                                            <div>
                                                                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">SMS / Twilio</h4>
                                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                                    Usa el prefijo <code>!SMS!</code> para enviar por SMS en vez de WhatsApp.
                                                                                </p>
                                                                            </div>
                                                                            <div className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${twilio.configured ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                                                {twilio.configured ? "Configurado" : "No configurado"}
                                                                            </div>
                                                                        </div>

                                                                        <div>
                                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Account SID</label>
                                                                            <input
                                                                                type="text"
                                                                                value={twilio.accountSid || ""}
                                                                                onChange={(e) => updateTwilioField(slot.slot_id, "accountSid", e.target.value)}
                                                                                placeholder={twilio.accountSidMasked || "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                                                                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                                                            />
                                                                        </div>

                                                                        <div>
                                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Auth Token</label>
                                                                            <input
                                                                                type="password"
                                                                                value={twilio.authToken || ""}
                                                                                onChange={(e) => updateTwilioField(slot.slot_id, "authToken", e.target.value)}
                                                                                placeholder={twilio.authTokenMasked || "********************************"}
                                                                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                                                            />
                                                                        </div>

                                                                        <div>
                                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Twilio Phone Number</label>
                                                                            <input
                                                                                type="text"
                                                                                value={twilio.phoneNumber || ""}
                                                                                onChange={(e) => updateTwilioField(slot.slot_id, "phoneNumber", e.target.value)}
                                                                                placeholder="+1234567890"
                                                                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                                                            />
                                                                        </div>

                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <button
                                                                                onClick={() => validateTwilioConfigSlot(slot.slot_id)}
                                                                                disabled={isLoadingTwilio || isSavingTwilio}
                                                                                className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 transition flex items-center gap-2"
                                                                            >
                                                                                <CheckCircle2 size={16} />
                                                                                Validar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => saveTwilioConfig(slot.slot_id)}
                                                                                disabled={isLoadingTwilio || isSavingTwilio}
                                                                                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2"
                                                                            >
                                                                                {isSavingTwilio ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                                                                Guardar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => clearTwilioConfig(slot.slot_id)}
                                                                                disabled={isLoadingTwilio || isSavingTwilio}
                                                                                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 transition"
                                                                            >
                                                                                Limpiar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => loadTwilioConfig(slot.slot_id, true)}
                                                                                disabled={isLoadingTwilio || isSavingTwilio}
                                                                                className="px-3 py-2 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition"
                                                                                title="Recargar configuración"
                                                                            >
                                                                                <RefreshCw size={16} className={isLoadingTwilio ? "animate-spin" : ""} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
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

// ✅ COMPONENTE DE GESTIÓN DE CONEXIÓN
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
