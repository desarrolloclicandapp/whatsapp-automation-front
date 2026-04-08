import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import QRCode from "react-qr-code";
import {
    X, Smartphone, Plus, Trash2, Settings, Tag,
    RefreshCw, Edit2, Loader2, User, Hash, Link2, MessageSquare, Users, AlertTriangle, Star, CheckCircle2, QrCode, Power, Zap, Save, Mic, Play, Copy
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket'; // ✅ Importar Hook de Socket
import { useLanguage } from '../context/LanguageContext';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

function translateOr(t, key, fallback) {
    const translated = typeof t === 'function' ? t(key) : null;
    if (!translated || translated === key) return fallback;
    return translated;
}

export default function LocationDetailsModal({ location, onClose, token, onLogout, onUpgrade, onDataChange, isAdminMode = false }) {
    const { t } = useLanguage();
    const [slots, setSlots] = useState([]);
    const [healthSummary, setHealthSummary] = useState(null);
    const [keywords, setKeywords] = useState([]);
    const [crmUsers, setCrmUsers] = useState([]);
    const [locationName, setLocationName] = useState(location.name || "");
    const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(true);
    const [tenantSettings, setTenantSettings] = useState(location.settings || {});
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
    const [chatwootConfigBySlot, setChatwootConfigBySlot] = useState({});
    const [loadingChatwootBySlot, setLoadingChatwootBySlot] = useState({});
    const [savingChatwootBySlot, setSavingChatwootBySlot] = useState({});
    const [officialConfigBySlot, setOfficialConfigBySlot] = useState({});
    const [loadingOfficialBySlot, setLoadingOfficialBySlot] = useState({});
    const [savingOfficialBySlot, setSavingOfficialBySlot] = useState({});
    const [startingOfficialEmbeddedBySlot, setStartingOfficialEmbeddedBySlot] = useState({});
    const [completingOfficialEmbeddedBySlot, setCompletingOfficialEmbeddedBySlot] = useState({});
    const [officialTemplatesBySlot, setOfficialTemplatesBySlot] = useState({});
    const [loadingOfficialTemplatesBySlot, setLoadingOfficialTemplatesBySlot] = useState({});
    const [sendingOfficialTemplateBySlot, setSendingOfficialTemplateBySlot] = useState({});
    const [facebookSdkState, setFacebookSdkState] = useState({
        ready: false,
        loading: false,
        appId: "",
        sdkVersion: "",
        error: ""
    });
    const [chatwootInboxes, setChatwootInboxes] = useState([]);
    const [loadingChatwootInboxes, setLoadingChatwootInboxes] = useState(false);
    const [chatwootInboxesLoaded, setChatwootInboxesLoaded] = useState(false);
    const [ghlAccessInfo, setGhlAccessInfo] = useState(null);
    const [loadingGhlAccess, setLoadingGhlAccess] = useState(false);
    const [showGhlAccessModal, setShowGhlAccessModal] = useState(false);
    const [chatwootAccessInfo, setChatwootAccessInfo] = useState(null);
    const [loadingChatwootAccess, setLoadingChatwootAccess] = useState(false);
    const [showChatwootAccessModal, setShowChatwootAccessModal] = useState(false);
    const [customProxyBySlot, setCustomProxyBySlot] = useState({});
    const [loadingCustomProxyBySlot, setLoadingCustomProxyBySlot] = useState({});
    const [savingCustomProxyBySlot, setSavingCustomProxyBySlot] = useState({});
    const facebookSdkPromiseRef = useRef(null);
    const embeddedSignupFlowRef = useRef({
        slotId: null,
        completionSent: false,
        authCode: "",
        accessToken: "",
        businessAccountId: "",
        phoneNumberId: "",
        businessId: "",
        displayPhoneNumber: ""
    });
    const crmType = String(tenantSettings?.crm_type || location?.crm_type || "ghl").toLowerCase();
    const isGhlMode = crmType === "ghl";
    const isChatwootMode = crmType === "chatwoot";
    const isEnabledTenantFlag = (value) => {
        if (value === true || value === 1) return true;
        const normalized = String(value ?? "").trim().toLowerCase();
        return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
    };
    const isHostedWaflowMode = isChatwootMode
        && isEnabledTenantFlag(tenantSettings?.is_auto_provisioned)
        && !isEnabledTenantFlag(tenantSettings?.is_byoc);
    const managedInboxBrandName = isHostedWaflowMode ? "WaFloW" : "Chatwoot";
    const getManagedInboxText = (translatedText, fallbackText = "") => {
        const baseText = translatedText || fallbackText;
        if (!isHostedWaflowMode || !baseText) return baseText;
        return String(baseText).replace(/Chatwoot/g, "WaFloW");
    };
    const supportsSmsTab = isGhlMode || isChatwootMode;
    const supportsKeywordsTab = isGhlMode;
    const OFFICIAL_WHATSAPP_API_UI_ENABLED = isEnabledTenantFlag(
        import.meta.env.VITE_OFFICIAL_WHATSAPP_API_UI_ENABLED ?? true
    );
    const SLOT_CONNECTION_MODE_CHANGE_ENABLED = false;
    const SHOW_OFFICIAL_WEBHOOK_DEBUG = !!isAdminMode;
    const getEffectiveSlotConnectionMode = (slot) => {
        if (!slot) return null;
        if (!OFFICIAL_WHATSAPP_API_UI_ENABLED) return 'qr';
        const explicitMode = String(slot?.settings?.connection_mode || "").trim().toLowerCase();
        if (explicitMode === 'official_api' || explicitMode === 'qr') return explicitMode;

        const officialSettings = slot?.settings?.official_api || {};
        const hasOfficialData = Boolean(
            String(officialSettings?.businessAccountId || "").trim() ||
            String(officialSettings?.phoneNumberId || "").trim() ||
            String(officialSettings?.status || "").trim()
        );
        if (hasOfficialData) return 'official_api';

        if (slot?.is_connected === true || String(slot?.phone_number || "").trim()) {
            return 'qr';
        }

        return null;
    };
    const hasOfficialWhatsappConfig = (slot) => {
        const officialSettings = slot?.settings?.official_api || {};
        return Boolean(
            String(officialSettings?.businessAccountId || "").trim() ||
            String(officialSettings?.phoneNumberId || "").trim() ||
            String(officialSettings?.accessToken || "").trim() ||
            String(officialSettings?.accessTokenEncrypted || "").trim() ||
            String(officialSettings?.status || "").trim()
        );
    };
    const expandedSlot = slots.find((slot) => slot.slot_id === expandedSlotId) || null;
    const expandedConnectionMode = getEffectiveSlotConnectionMode(expandedSlot);
    const isExpandedChatwootLoaded = Boolean(
        expandedSlotId && chatwootConfigBySlot[expandedSlotId]?.loaded
    );
    const isExpandedOfficialLoaded = Boolean(
        expandedSlotId && officialConfigBySlot[expandedSlotId]?.loaded
    );

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

        if (res.status === 401) {
            onLogout();
            onClose();
            return null;
        }

        if (res.status === 403) {
            const body = await res.clone().json().catch(() => null);
            if (body?.error !== "account_suspended") {
                onLogout();
                onClose();
                return null;
            }
        }
        return res;
    };

    const confirmToast = (title, description, action, isDestructive = false) => {
        toast(title, {
            description,
            icon: <AlertTriangle className={isDestructive ? "text-red-500" : "text-amber-500"} />,
            action: {
                label: isDestructive ? 'Confirmar' : 'Aceptar',
                onClick: action
            },
            cancel: {
                label: 'Cancelar'
            }
        });
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
                if (payload.type === 'connection' && payload.status === 'open') {
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
        if (activeSlotTab !== 'integration' || !expandedSlotId) return;
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
        if (activeSlotTab !== 'integration' || !expandedSlotId || !isGhlMode) return;
        if (customProxyBySlot[expandedSlotId]?.loaded) return;
        loadCustomProxyConfig(expandedSlotId);
    }, [activeSlotTab, expandedSlotId, customProxyBySlot, isGhlMode]);

    useEffect(() => {
        if (activeSlotTab !== 'integration' || !expandedSlotId || !isChatwootMode) return;
        if (isExpandedChatwootLoaded) return;
        loadChatwootConfig(expandedSlotId);
    }, [activeSlotTab, expandedSlotId, isChatwootMode, isExpandedChatwootLoaded]);

    useEffect(() => {
        if (!expandedSlotId || expandedConnectionMode !== 'official_api') return;
        if (isExpandedOfficialLoaded) return;
        loadOfficialWhatsappConfig(expandedSlotId);
    }, [expandedSlotId, expandedConnectionMode, isExpandedOfficialLoaded]);

    useEffect(() => {
        if (!expandedSlotId || expandedConnectionMode !== 'official_api') return;
        const official = officialConfigBySlot[expandedSlotId];
        if (!official?.loaded || !official?.businessAccountId || !official?.hasAccessToken) return;
        if (officialTemplatesBySlot[expandedSlotId]?.loaded) return;
        loadOfficialWhatsappTemplates(expandedSlotId);
    }, [expandedSlotId, expandedConnectionMode, officialConfigBySlot, officialTemplatesBySlot]);

    useEffect(() => {
        const handleEmbeddedSignupMessage = (event) => {
            const origin = String(event?.origin || '').toLowerCase();
            if (!origin || (!origin.includes('facebook.com') && !origin.includes('fb.com'))) {
                return;
            }

            const flow = embeddedSignupFlowRef.current;
            if (!flow?.slotId) return;

            const parsed = normalizeEmbeddedSignupMessage(event.data);
            if (!parsed) return;

            if (parsed.status === 'cancel') {
                setStartingOfficialEmbeddedBySlot(prev => ({ ...prev, [flow.slotId]: false }));
                setCompletingOfficialEmbeddedBySlot(prev => ({ ...prev, [flow.slotId]: false }));
                toast.error(t('slots.official.embedded.cancelled') || 'El asistente de Meta fue cancelado');
                resetEmbeddedSignupFlow();
                return;
            }

            if (parsed.status === 'error') {
                setStartingOfficialEmbeddedBySlot(prev => ({ ...prev, [flow.slotId]: false }));
                setCompletingOfficialEmbeddedBySlot(prev => ({ ...prev, [flow.slotId]: false }));
                toast.error(t('slots.official.embedded.error') || 'Meta devolvió un error en el Embedded Signup', {
                    description: parsed.errorMessage || undefined
                });
                resetEmbeddedSignupFlow();
                return;
            }

            flow.authCode = pickFirstNonEmptyString(parsed.authCode, flow.authCode);
            flow.accessToken = pickFirstNonEmptyString(parsed.accessToken, flow.accessToken);
            flow.businessAccountId = pickFirstNonEmptyString(parsed.businessAccountId, flow.businessAccountId);
            flow.phoneNumberId = pickFirstNonEmptyString(parsed.phoneNumberId, flow.phoneNumberId);
            flow.businessId = pickFirstNonEmptyString(parsed.businessId, flow.businessId);
            flow.displayPhoneNumber = pickFirstNonEmptyString(parsed.displayPhoneNumber, flow.displayPhoneNumber);

            if (!flow.completionSent && flow.phoneNumberId && (flow.authCode || flow.accessToken)) {
                const snapshot = { ...flow };
                flow.completionSent = true;
                completeOfficialEmbeddedSignup(snapshot.slotId, snapshot).catch(() => { });
            }
        };

        window.addEventListener('message', handleEmbeddedSignupMessage);
        return () => window.removeEventListener('message', handleEmbeddedSignupMessage);
    }, [location.location_id, officialConfigBySlot, slots, t]);

    useEffect(() => {
        if (!supportsKeywordsTab && activeSlotTab === 'keywords') {
            setActiveSlotTab('general');
        }
    }, [supportsKeywordsTab, activeSlotTab]);

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
                authFetch(`/agency/crm-users/${location.location_id}`)
            ]);

            if (detailsRes && detailsRes.ok) {
                const data = await detailsRes.json();
                setSlots(data.slots || []);
                setHealthSummary(data.healthSummary || null);
                setKeywords(data.keywords || []);

                if (data.name) setLocationName(data.name);
                setWhiteLabelEnabled(data.settings?.white_label ?? true);
                setTenantSettings(data.settings || {});
                const nextCrmType = String(data.settings?.crm_type || data.crmType || location?.crm_type || "ghl").toLowerCase();
                if (nextCrmType === "chatwoot") {
                    setGhlAccessInfo(null);
                    loadChatwootAccessInfo();
                } else {
                    setChatwootAccessInfo(null);
                    loadGhlAccessInfo();
                }
            }

            if (usersRes && usersRes.ok) {
                const users = await usersRes.json();
                setCrmUsers(users || []);
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
        const loadingId = toast.loading(isChatwootMode ? (t('slots.chatwoot_inbox.creating') || "Creando inbox...") : "Creando dispositivo...");
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
                const successDescription = isChatwootMode
                    ? (tenantSettings?.is_auto_provisioned
                        ? getManagedInboxText(t('slots.chatwoot.auto_provisioned_ready'), "Configurado automaticamente en Chatwoot.")
                        : "Listo para vincular.")
                    : "Listo para vincular.";
                toast.success(isChatwootMode ? (t('slots.chatwoot_inbox.added') || "Inbox agregado") : "Dispositivo agregado", { description: successDescription });
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
                    toast.error("Error", { description: data.error || (isChatwootMode ? "No se pudo agregar el inbox." : "No se pudo agregar el dispositivo.") });
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
        toast(isChatwootMode ? "¿Eliminar inbox?" : "¿Eliminar dispositivo?", {
            description: "Esta acción desconectará el número y borrará su configuración.",
            action: {
                label: 'Eliminar',
                onClick: async () => {
                    setDeletingSlotId(slotId);
                    const res = await authFetch(`/agency/slots/${location.location_id}/${slotId}`, { method: "DELETE" });
                    setDeletingSlotId(null);
                    if (res && res.ok) {
                        toast.success(isChatwootMode ? "Inbox eliminado" : "Dispositivo eliminado");
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

    const focusSlotConnectionSelector = (slotId) => {
        setExpandedSlotId(slotId);
        setActiveSlotTab('general');
        window.setTimeout(() => {
            const target = document.getElementById(`slot-card-${slotId}`);
            if (!target) return;
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 140);
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
        setGroups([]);
        try {
            const res = await authFetch(`/agency/slots/${location.location_id}/${slotId}/groups`);
            if (res.ok) {
                const data = await res.json();
                setGroups(Array.isArray(data) ? data : []);
            } else {
                const errorData = await res.json().catch(() => ({}));
                toast.error(errorData?.error || t('agency.server_error'));
            }
        } catch (e) {
            toast.error(t('agency.server_error'));
        }
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



    const createEmptyCustomProxyState = () => ({
        loaded: false,
        configured: false,
        host: "",
        port: "",
        username: "",
        password: "",
        passwordMasked: "",
        hasPassword: false,
        protocol: "http",
        invalidConfig: false
    });

    const loadCustomProxyConfig = async (slotId, forceRefresh = false) => {
        if (!slotId || !location?.location_id) return;
        if (!forceRefresh && customProxyBySlot[slotId]?.loaded) return;

        setLoadingCustomProxyBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/slots/${location.location_id}/${slotId}/proxy`);
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo cargar proxy custom");
            }

            const data = await res.json();
            const proxy = data.proxy || null;
            setCustomProxyBySlot(prev => ({
                ...prev,
                [slotId]: {
                    loaded: true,
                    configured: !!data.configured,
                    host: proxy?.host || "",
                    port: proxy?.port ? String(proxy.port) : "",
                    username: proxy?.username || "",
                    password: "",
                    passwordMasked: proxy?.passwordMasked || "",
                    hasPassword: !!proxy?.hasPassword,
                    protocol: proxy?.protocol || "http",
                    invalidConfig: !!data.invalidConfig
                }
            }));
        } catch (e) {
            toast.error("Error cargando proxy", { description: e.message });
        } finally {
            setLoadingCustomProxyBySlot(prev => ({ ...prev, [slotId]: false }));
        }
    };

    const updateCustomProxyField = (slotId, key, value) => {
        setCustomProxyBySlot(prev => {
            const current = prev[slotId] || createEmptyCustomProxyState();
            return {
                ...prev,
                [slotId]: {
                    ...current,
                    loaded: true,
                    [key]: value
                }
            };
        });
    };

    const saveCustomProxyConfig = async (slotId) => {
        const current = customProxyBySlot[slotId] || createEmptyCustomProxyState();
        const host = (current.host || "").trim();
        const port = Number(current.port);
        const username = (current.username || "").trim();
        const password = (current.password || "").trim();
        const protocol = String(current.protocol || "http").toLowerCase();

        if (!host || !Number.isFinite(port) || port <= 0) {
            toast.error("Completa host y puerto validos");
            return;
        }

        const payload = {
            host,
            port,
            username: username || null,
            protocol
        };
        if (password) payload.password = password;

        setSavingCustomProxyBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/slots/${location.location_id}/${slotId}/proxy`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo guardar proxy custom");
            }

            toast.success("Proxy custom guardado");
            await loadCustomProxyConfig(slotId, true);
        } catch (e) {
            toast.error("Error guardando proxy", { description: e.message });
        } finally {
            setSavingCustomProxyBySlot(prev => ({ ...prev, [slotId]: false }));
        }
    };

    const clearCustomProxyConfig = async (slotId, { skipConfirm = false } = {}) => {
        if (!confirm("¿Quitar proxy personalizado de este numero?")) return;

        const loadingId = toast.loading("Quitando proxy custom...");
        try {
            const res = await authFetch(`/agency/slots/${location.location_id}/${slotId}/proxy`, {
                method: 'DELETE',
                body: JSON.stringify({})
            });
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo limpiar proxy custom");
            }

            setCustomProxyBySlot(prev => ({
                ...prev,
                [slotId]: {
                    ...createEmptyCustomProxyState(),
                    loaded: true
                }
            }));
            toast.success("Proxy custom eliminado");
        } catch (e) {
            toast.error("Error limpiando proxy", { description: e.message });
        } finally {
            toast.dismiss(loadingId);
        }
    };

    const chatwootWebhookBaseUrl = `${API_URL}/chatwoot/webhook`;

    const buildChatwootWebhookUrl = (secretValue = "") => {
        const safeSecret = String(secretValue || "").trim();
        if (!safeSecret) return chatwootWebhookBaseUrl;
        return `${chatwootWebhookBaseUrl}?secret=${encodeURIComponent(safeSecret)}`;
    };

    const generateRandomSecret = (length = 32) => {
        const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        if (window?.crypto?.getRandomValues) {
            const bytes = new Uint8Array(length);
            window.crypto.getRandomValues(bytes);
            for (let i = 0; i < length; i++) {
                result += alphabet[bytes[i] % alphabet.length];
            }
            return result;
        }
        for (let i = 0; i < length; i++) {
            result += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        return result;
    };

    const copyToClipboard = async (value, successMessage) => {
        const safeValue = String(value || "");
        if (!safeValue.trim()) return;
        try {
            await navigator.clipboard.writeText(safeValue);
            toast.success(successMessage || t('common.copied') || "Copiado");
        } catch (_) {
            toast.error(t('slots.chatwoot.copy_error') || "No se pudo copiar");
        }
    };

    const loadChatwootAccessInfo = async () => {
        if (!location?.location_id) return;
        setLoadingChatwootAccess(true);
        try {
            const res = await authFetch(`/agency/chatwoot/access-info?locationId=${location.location_id}`);
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || getManagedInboxText("", "No se pudo cargar el acceso Chatwoot"));
            }
            const data = await res.json();
            setChatwootAccessInfo(data?.chatwoot || null);
        } catch (e) {
            setChatwootAccessInfo(null);
        } finally {
            setLoadingChatwootAccess(false);
        }
    };

    const loadGhlAccessInfo = async () => {
        if (!location?.location_id) return;
        setLoadingGhlAccess(true);
        try {
            const res = await authFetch(`/agency/ghl/access-info?locationId=${location.location_id}`);
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo cargar el acceso GoHighLevel");
            }
            const data = await res.json();
            setGhlAccessInfo(data?.ghl || null);
        } catch (e) {
            setGhlAccessInfo(null);
        } finally {
            setLoadingGhlAccess(false);
        }
    };

    const generateChatwootSecret = (slotId) => {
        const secret = generateRandomSecret(32);
        updateChatwootField(slotId, "webhookSecret", secret);
        toast.success(t('slots.chatwoot.secret_generated') || "Webhook secret generado");
    };

    const loadChatwootInboxes = async (forceRefresh = false) => {
        if (!location?.location_id) return;
        if (!forceRefresh && chatwootInboxesLoaded) return;

        setLoadingChatwootInboxes(true);
        try {
            const res = await authFetch(`/agency/chatwoot/inboxes?locationId=${location.location_id}`);
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudieron cargar inboxes");
            }
            const data = await res.json();
            const inboxes = Array.isArray(data?.inboxes) ? data.inboxes : [];
            setChatwootInboxes(inboxes);
            setChatwootInboxesLoaded(true);
        } catch (e) {
            setChatwootInboxes([]);
            setChatwootInboxesLoaded(false);
            toast.error(t('slots.chatwoot.inboxes_error') || "Error cargando inboxes", {
                description: e.message
            });
        } finally {
            setLoadingChatwootInboxes(false);
        }
    };

    const createEmptyChatwootState = () => ({
        loaded: false,
        configured: false,
        hasGlobalConfig: false,
        chatwootUrl: "",
        apiToken: "",
        accountId: "",
        inboxId: "",
        webhookSecret: "",
        chatwootUrlMasked: "",
        apiTokenMasked: "",
        hasApiToken: false,
        hasWebhookSecret: false,
        showAdvancedDetails: false,
        csatEnabled: false,
        csatMessage: ""
    });

    const createEmptyOfficialWhatsappState = () => ({
        loaded: false,
        configured: false,
        connectionMode: "official_api",
        status: "draft",
        businessAccountId: "",
        phoneNumberId: "",
        accessToken: "",
        accessTokenMasked: "",
        hasAccessToken: false,
        webhookVerifyToken: "",
        webhookUrl: "",
        verifiedAt: null,
        lastValidationAt: null,
        lastValidationError: "",
        lastWebhookAt: null,
        displayPhoneNumber: "",
        verifiedName: "",
        qualityRating: "",
        nameStatus: "",
        setupSource: "",
        embeddedSignupCompletedAt: null,
        embeddedSignupBusinessId: "",
        embeddedSignupPhone: "",
        embeddedSignupError: "",
        embeddedSignupEnabled: false,
        embeddedSignupAppId: "",
        embeddedSignupConfigurationId: "",
        embeddedSignupSdkVersion: "",
        embeddedSignupGraphVersion: "",
        embeddedSignupSessionInfoVersion: 3,
        embeddedSignupSolutionId: "",
        embeddedSignupProviderTokenConfigured: false,
        embeddedSignupMissing: []
    });

    const createEmptyOfficialTemplateState = () => ({
        loaded: false,
        templates: [],
        fetchedAt: null,
        targetPhone: "",
        selectedTemplateKey: "",
        componentsJson: "",
        parameterValues: {}
    });

    const resetEmbeddedSignupFlow = () => {
        embeddedSignupFlowRef.current = {
            slotId: null,
            completionSent: false,
            authCode: "",
            accessToken: "",
            businessAccountId: "",
            phoneNumberId: "",
            businessId: "",
            displayPhoneNumber: ""
        };
    };

    const pickFirstNonEmptyString = (...values) => {
        for (const value of values) {
            const normalized = String(value ?? "").trim();
            if (normalized) return normalized;
        }
        return "";
    };

    const safeParseJson = (value) => {
        if (typeof value !== "string") return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        try {
            return JSON.parse(trimmed);
        } catch (_) {
            return null;
        }
    };

    const deepFindFirstString = (input, keys, depth = 0) => {
        if (!input || depth > 6) return "";
        if (Array.isArray(input)) {
            for (const item of input) {
                const fromItem = deepFindFirstString(item, keys, depth + 1);
                if (fromItem) return fromItem;
            }
            return "";
        }

        if (typeof input !== "object") return "";

        for (const key of keys) {
            const value = input[key];
            if (value === undefined || value === null) continue;
            const normalized = String(value).trim();
            if (normalized && normalized !== "[object Object]") {
                return normalized;
            }
        }

        for (const value of Object.values(input)) {
            const fromNested = deepFindFirstString(value, keys, depth + 1);
            if (fromNested) return fromNested;
        }

        return "";
    };

    const normalizeEmbeddedSignupMessage = (rawPayload) => {
        const payload = typeof rawPayload === "string"
            ? (safeParseJson(rawPayload) || null)
            : rawPayload;
        if (!payload || typeof payload !== "object") return null;

        const eventName = pickFirstNonEmptyString(
            payload?.event,
            payload?.eventType,
            payload?.type,
            payload?.data?.event,
            payload?.data?.eventType,
            payload?.data?.type
        ).toUpperCase();

        const phoneNumberId = deepFindFirstString(payload, ["phone_number_id", "phoneNumberId"]);
        const businessAccountId = deepFindFirstString(payload, ["waba_id", "wabaId", "business_account_id", "businessAccountId"]);
        const businessId = deepFindFirstString(payload, ["business_id", "businessId", "business_manager_id", "businessManagerId"]);
        const displayPhoneNumber = deepFindFirstString(payload, ["display_phone_number", "displayPhoneNumber", "phone_number", "phoneNumber"]);
        const authCode = deepFindFirstString(payload, ["code", "authCode"]);
        const accessToken = deepFindFirstString(payload, ["access_token", "accessToken"]);
        const errorMessage = deepFindFirstString(payload, ["error_message", "errorMessage", "message", "error"]);

        let status = "";
        if (eventName.includes("FINISH") || eventName.includes("COMPLETE")) {
            status = "finish";
        } else if (eventName.includes("CANCEL")) {
            status = "cancel";
        } else if (eventName.includes("ERROR") || eventName.includes("FAIL")) {
            status = "error";
        } else if (phoneNumberId || businessAccountId || authCode || accessToken) {
            status = "finish";
        }

        if (!status) return null;

        return {
            status,
            authCode,
            accessToken,
            phoneNumberId,
            businessAccountId,
            businessId,
            displayPhoneNumber,
            errorMessage
        };
    };

    const ensureFacebookSdk = async (officialConfig = {}) => {
        const appId = String(officialConfig?.embeddedSignupAppId || "").trim();
        const sdkVersion = String(officialConfig?.embeddedSignupSdkVersion || "v24.0").trim() || "v24.0";
        if (!appId) {
            throw new Error("Falta el App ID de Meta para el Embedded Signup.");
        }

        if (
            window.FB &&
            facebookSdkState.ready &&
            facebookSdkState.appId === appId &&
            facebookSdkState.sdkVersion === sdkVersion
        ) {
            return window.FB;
        }

        if (facebookSdkPromiseRef.current) {
            return facebookSdkPromiseRef.current;
        }

        setFacebookSdkState({
            ready: false,
            loading: true,
            appId,
            sdkVersion,
            error: ""
        });

        facebookSdkPromiseRef.current = new Promise((resolve, reject) => {
            const finishInit = () => {
                if (!window.FB) {
                    const err = new Error("No se pudo inicializar el SDK de Facebook.");
                    setFacebookSdkState({
                        ready: false,
                        loading: false,
                        appId,
                        sdkVersion,
                        error: err.message
                    });
                    reject(err);
                    return;
                }

                try {
                    window.FB.init({
                        appId,
                        autoLogAppEvents: true,
                        xfbml: false,
                        version: sdkVersion
                    });
                    setFacebookSdkState({
                        ready: true,
                        loading: false,
                        appId,
                        sdkVersion,
                        error: ""
                    });
                    resolve(window.FB);
                } catch (err) {
                    setFacebookSdkState({
                        ready: false,
                        loading: false,
                        appId,
                        sdkVersion,
                        error: err.message
                    });
                    reject(err);
                }
            };

            if (window.FB) {
                finishInit();
                return;
            }

            window.fbAsyncInit = finishInit;

            const existingScript = document.getElementById("waflow-facebook-sdk");
            if (existingScript) {
                return;
            }

            const script = document.createElement("script");
            script.id = "waflow-facebook-sdk";
            script.async = true;
            script.defer = true;
            script.crossOrigin = "anonymous";
            script.src = "https://connect.facebook.net/en_US/sdk.js";
            script.onerror = () => {
                const err = new Error("No se pudo cargar el SDK de Facebook.");
                setFacebookSdkState({
                    ready: false,
                    loading: false,
                    appId,
                    sdkVersion,
                    error: err.message
                });
                reject(err);
            };
            document.body.appendChild(script);
        }).finally(() => {
            facebookSdkPromiseRef.current = null;
        });

        return facebookSdkPromiseRef.current;
    };

    const getOfficialTemplateKey = (template) => {
        const safeName = String(template?.name || "").trim();
        const safeLanguage = String(template?.language || "").trim();
        return `${safeName}::${safeLanguage}`;
    };

    const extractTemplatePlaceholderIndexes = (text = "") => {
        const safeText = String(text || "");
        const indexes = new Set();
        const regex = /\{\{\s*(\d+)\s*\}\}/g;
        let match = regex.exec(safeText);
        while (match) {
            indexes.add(Number.parseInt(match[1], 10));
            match = regex.exec(safeText);
        }
        return Array.from(indexes).filter(Number.isFinite).sort((a, b) => a - b);
    };

    const getOfficialTemplateParameterFields = (template = {}) => {
        const components = Array.isArray(template?.components) ? template.components : [];
        const fields = [];

        components.forEach((component, componentIndex) => {
            const componentType = String(component?.type || "").trim().toUpperCase();
            const componentFormat = String(component?.format || "").trim().toUpperCase();
            const componentText = String(component?.text || "").trim();

            if (componentType === 'HEADER' && componentFormat === 'TEXT') {
                extractTemplatePlaceholderIndexes(componentText).forEach((placeholderIndex) => {
                    fields.push({
                        key: `header_text_${placeholderIndex}`,
                        label: `${t('slots.official.templates.header_var') || 'Header'} {{${placeholderIndex}}}`,
                        componentType: 'header',
                        valueType: 'text',
                        placeholderIndex
                    });
                });
            }

            if (componentType === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(componentFormat)) {
                fields.push({
                    key: 'header_media_url',
                    label: `${t('slots.official.templates.header_media_url') || 'URL del header'} (${componentFormat})`,
                    componentType: 'header',
                    valueType: componentFormat.toLowerCase()
                });
            }

            if (componentType === 'BODY') {
                extractTemplatePlaceholderIndexes(componentText).forEach((placeholderIndex) => {
                    fields.push({
                        key: `body_text_${placeholderIndex}`,
                        label: `${t('slots.official.templates.body_var') || 'Body'} {{${placeholderIndex}}}`,
                        componentType: 'body',
                        valueType: 'text',
                        placeholderIndex
                    });
                });
            }

            if (componentType === 'BUTTONS') {
                const buttons = Array.isArray(component?.buttons) ? component.buttons : [];
                buttons.forEach((button, buttonIndex) => {
                    const buttonType = String(button?.type || "").trim().toUpperCase();
                    const buttonUrl = String(button?.url || "").trim();
                    if (buttonType !== 'URL' || !buttonUrl.includes('{{')) return;

                    extractTemplatePlaceholderIndexes(buttonUrl).forEach((placeholderIndex) => {
                        fields.push({
                            key: `button_${componentIndex}_${buttonIndex}_${placeholderIndex}`,
                            label: `${t('slots.official.templates.button_var') || 'Botón'} ${buttonIndex + 1} {{${placeholderIndex}}}`,
                            componentType: 'button',
                            buttonIndex,
                            valueType: 'text',
                            placeholderIndex
                        });
                    });
                });
            }
        });

        return fields;
    };

    const buildOfficialTemplateComponents = (template = {}, parameterValues = {}) => {
        const components = [];
        const rawComponents = Array.isArray(template?.components) ? template.components : [];

        rawComponents.forEach((component, componentIndex) => {
            const componentType = String(component?.type || "").trim().toUpperCase();
            const componentFormat = String(component?.format || "").trim().toUpperCase();
            const componentText = String(component?.text || "").trim();

            if (componentType === 'HEADER' && componentFormat === 'TEXT') {
                const indexes = extractTemplatePlaceholderIndexes(componentText);
                if (indexes.length > 0) {
                    components.push({
                        type: 'header',
                        parameters: indexes.map((placeholderIndex) => ({
                            type: 'text',
                            text: String(parameterValues[`header_text_${placeholderIndex}`] || '').trim()
                        }))
                    });
                }
                return;
            }

            if (componentType === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(componentFormat)) {
                const link = String(parameterValues.header_media_url || '').trim();
                if (link) {
                    const mediaType = componentFormat.toLowerCase();
                    components.push({
                        type: 'header',
                        parameters: [{
                            type: mediaType,
                            [mediaType]: { link }
                        }]
                    });
                }
                return;
            }

            if (componentType === 'BODY') {
                const indexes = extractTemplatePlaceholderIndexes(componentText);
                if (indexes.length > 0) {
                    components.push({
                        type: 'body',
                        parameters: indexes.map((placeholderIndex) => ({
                            type: 'text',
                            text: String(parameterValues[`body_text_${placeholderIndex}`] || '').trim()
                        }))
                    });
                }
                return;
            }

            if (componentType === 'BUTTONS') {
                const buttons = Array.isArray(component?.buttons) ? component.buttons : [];
                buttons.forEach((button, buttonIndex) => {
                    const buttonType = String(button?.type || "").trim().toUpperCase();
                    const buttonUrl = String(button?.url || "").trim();
                    if (buttonType !== 'URL' || !buttonUrl.includes('{{')) return;

                    const indexes = extractTemplatePlaceholderIndexes(buttonUrl);
                    if (indexes.length === 0) return;

                    components.push({
                        type: 'button',
                        sub_type: 'url',
                        index: String(buttonIndex),
                        parameters: indexes.map((placeholderIndex) => ({
                            type: 'text',
                            text: String(parameterValues[`button_${componentIndex}_${buttonIndex}_${placeholderIndex}`] || '').trim()
                        }))
                    });
                });
            }
        });

        return components;
    };

    const syncSlotConnectionMode = (slotId, nextMode, officialConfig = undefined) => {
        setSlots(prev => prev.map(slot => {
            if (slot.slot_id !== slotId) return slot;
            const nextSettings = { ...(slot.settings || {}) };
            if (nextMode) nextSettings.connection_mode = nextMode;
            else delete nextSettings.connection_mode;

            if (officialConfig === null) {
                delete nextSettings.official_api;
            } else if (officialConfig && typeof officialConfig === "object") {
                nextSettings.official_api = officialConfig;
            }

            return { ...slot, settings: nextSettings };
        }));
    };

    const selectSlotConnectionMode = async (slot, nextMode) => {
        const nextSettings = { ...(slot.settings || {}) };
        if (nextMode) nextSettings.connection_mode = nextMode;
        else delete nextSettings.connection_mode;
        await updateSettingsBackend(slot.slot_id, nextSettings);
        if (nextMode === 'qr') {
            setActiveSlotTab('qr');
        }
        if (nextMode === 'official_api') {
            setOfficialConfigBySlot(prev => ({
                ...prev,
                [slot.slot_id]: {
                    ...(prev[slot.slot_id] || createEmptyOfficialWhatsappState()),
                    loaded: true,
                    connectionMode: 'official_api'
                }
            }));
        }
    };

    const loadOfficialWhatsappConfig = async (slotId, forceRefresh = false) => {
        if (!slotId || !location?.location_id) return;
        if (!forceRefresh && officialConfigBySlot[slotId]?.loaded) return;

        const previousOfficial = officialConfigBySlot[slotId] || createEmptyOfficialWhatsappState();
        setLoadingOfficialBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/whatsapp-official/config?locationId=${location.location_id}&slotId=${slotId}`);
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo cargar la configuración oficial");
            }
            const data = await res.json();
            const nextBusinessAccountId = data.businessAccountId ? String(data.businessAccountId) : "";
            const nextHasAccessToken = !!data.hasAccessToken;
            const embeddedSignup = data?.embeddedSignup || {};
            setOfficialConfigBySlot(prev => ({
                ...prev,
                [slotId]: {
                    loaded: true,
                    configured: !!data.configured,
                    connectionMode: data.connectionMode || 'official_api',
                    status: data.status || 'draft',
                    businessAccountId: nextBusinessAccountId,
                    phoneNumberId: data.phoneNumberId ? String(data.phoneNumberId) : "",
                    accessToken: "",
                    accessTokenMasked: data.accessTokenMasked || "",
                    hasAccessToken: nextHasAccessToken,
                    webhookVerifyToken: data.webhookVerifyToken || "",
                    webhookUrl: data.webhookUrl || "",
                    verifiedAt: data.verifiedAt || null,
                    lastValidationAt: data.lastValidationAt || null,
                    lastValidationError: data.lastValidationError || "",
                    lastWebhookAt: data.lastWebhookAt || null,
                    displayPhoneNumber: data.displayPhoneNumber || "",
                    verifiedName: data.verifiedName || "",
                    qualityRating: data.qualityRating || "",
                    nameStatus: data.nameStatus || ""
                }
            }));
            if (
                String(previousOfficial.businessAccountId || "").trim() !== nextBusinessAccountId ||
                !!previousOfficial.hasAccessToken !== nextHasAccessToken
            ) {
                setOfficialTemplatesBySlot(prev => ({
                    ...prev,
                    [slotId]: createEmptyOfficialTemplateState()
                }));
            }
        } catch (e) {
            toast.error(t('slots.official.load_error') || "Error cargando WhatsApp API oficial", {
                description: e.message
            });
        } finally {
            setLoadingOfficialBySlot(prev => ({ ...prev, [slotId]: false }));
        }
    };

    const updateOfficialTemplateState = (slotId, updater) => {
        setOfficialTemplatesBySlot(prev => {
            const current = prev[slotId] || createEmptyOfficialTemplateState();
            const nextState = typeof updater === 'function'
                ? updater(current)
                : { ...current, ...(updater || {}) };
            return {
                ...prev,
                [slotId]: nextState
            };
        });
    };

    const loadOfficialWhatsappTemplates = async (slotId, forceRefresh = false) => {
        const official = officialConfigBySlot[slotId] || createEmptyOfficialWhatsappState();
        if (!location?.location_id) return;
        if (!official.businessAccountId) {
            updateOfficialTemplateState(slotId, {
                ...createEmptyOfficialTemplateState(),
                loaded: false
            });
            return;
        }
        if (!forceRefresh && officialTemplatesBySlot[slotId]?.loaded) return;

        setLoadingOfficialTemplatesBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/whatsapp-official/templates?locationId=${location.location_id}&slotId=${slotId}`);
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || (t('slots.official.templates.load_error') || 'No se pudieron cargar los templates'));
            }
            const data = await res.json();
            const templates = Array.isArray(data?.templates) ? data.templates : [];
            updateOfficialTemplateState(slotId, (current) => {
                const approvedTemplates = templates.filter((template) => String(template?.status || '').trim().toUpperCase() === 'APPROVED');
                const validTemplatePool = approvedTemplates.length > 0 ? approvedTemplates : templates;
                const nextSelectedTemplateKey = current.selectedTemplateKey && validTemplatePool.some((template) => getOfficialTemplateKey(template) === current.selectedTemplateKey)
                    ? current.selectedTemplateKey
                    : (validTemplatePool[0] ? getOfficialTemplateKey(validTemplatePool[0]) : "");
                return {
                    ...current,
                    loaded: true,
                    templates,
                    fetchedAt: data?.fetchedAt || new Date().toISOString(),
                    selectedTemplateKey: nextSelectedTemplateKey
                };
            });
        } catch (e) {
            toast.error(t('slots.official.templates.load_error') || 'Error cargando templates', {
                description: e.message
            });
        } finally {
            setLoadingOfficialTemplatesBySlot(prev => ({ ...prev, [slotId]: false }));
        }
    };

    const updateOfficialTemplateField = (slotId, key, value) => {
        updateOfficialTemplateState(slotId, (current) => ({
            ...current,
            [key]: value,
            ...(key === 'selectedTemplateKey'
                ? {
                    componentsJson: "",
                    parameterValues: {}
                }
                : {})
        }));
    };

    const updateOfficialTemplateParameter = (slotId, key, value) => {
        updateOfficialTemplateState(slotId, (current) => ({
            ...current,
            parameterValues: {
                ...(current.parameterValues || {}),
                [key]: value
            }
        }));
    };

    const sendOfficialTemplateTest = async (slotId) => {
        const official = officialConfigBySlot[slotId] || createEmptyOfficialWhatsappState();
        const templateState = officialTemplatesBySlot[slotId] || createEmptyOfficialTemplateState();
        const selectedTemplate = (templateState.templates || []).find((template) => getOfficialTemplateKey(template) === templateState.selectedTemplateKey);

        if (!official.businessAccountId) {
            toast.error(t('slots.official.templates.missing_waba') || 'Completa el WABA ID antes de usar templates');
            return;
        }
        if (!selectedTemplate) {
            toast.error(t('slots.official.templates.select_template') || 'Selecciona un template');
            return;
        }
        if (String(selectedTemplate.status || '').trim().toUpperCase() !== 'APPROVED') {
            toast.error(t('slots.official.templates.not_approved') || 'El template seleccionado no está aprobado');
            return;
        }

        const safeTargetPhone = String(templateState.targetPhone || '').trim();
        if (!safeTargetPhone) {
            toast.error(t('slots.official.templates.target_required') || 'Ingresa un número destino');
            return;
        }

        let components = [];
        const safeComponentsJson = String(templateState.componentsJson || '').trim();
        if (safeComponentsJson) {
            try {
                const parsed = JSON.parse(safeComponentsJson);
                if (!Array.isArray(parsed)) {
                    throw new Error(t('slots.official.templates.components_json_invalid') || 'El JSON de components debe ser un arreglo');
                }
                components = parsed;
            } catch (e) {
                toast.error(t('slots.official.templates.components_json_invalid') || 'Components JSON inválido', {
                    description: e.message
                });
                return;
            }
        } else {
            const fields = getOfficialTemplateParameterFields(selectedTemplate);
            const missingFields = fields.filter((field) => !String(templateState.parameterValues?.[field.key] || '').trim());
            if (missingFields.length > 0) {
                toast.error(t('slots.official.templates.missing_params') || 'Completa las variables requeridas del template');
                return;
            }
            components = buildOfficialTemplateComponents(selectedTemplate, templateState.parameterValues || {});
        }

        setSendingOfficialTemplateBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/whatsapp-official/send-template`, {
                method: 'POST',
                body: JSON.stringify({
                    locationId: location.location_id,
                    slotId,
                    targetPhone: safeTargetPhone,
                    templateName: selectedTemplate.name,
                    languageCode: selectedTemplate.language,
                    components
                })
            });
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || (t('slots.official.templates.send_error') || 'No se pudo enviar el template'));
            }
            toast.success(t('slots.official.templates.send_success') || 'Template enviado');
        } catch (e) {
            toast.error(t('slots.official.templates.send_error') || 'Error enviando template', {
                description: e.message
            });
        } finally {
            setSendingOfficialTemplateBySlot(prev => ({ ...prev, [slotId]: false }));
        }
    };

    const updateOfficialWhatsappField = (slotId, key, value) => {
        setOfficialConfigBySlot(prev => {
            const current = prev[slotId] || createEmptyOfficialWhatsappState();
            return {
                ...prev,
                [slotId]: {
                    ...current,
                    loaded: true,
                    [key]: value
                }
            };
        });
        if (key === 'businessAccountId' || key === 'accessToken') {
            setOfficialTemplatesBySlot(prev => {
                const current = prev[slotId] || createEmptyOfficialTemplateState();
                return {
                    ...prev,
                    [slotId]: {
                        ...createEmptyOfficialTemplateState(),
                        targetPhone: current.targetPhone || ""
                    }
                };
            });
        }
    };

    const saveOfficialWhatsappConfig = async (slotId) => {
        const current = officialConfigBySlot[slotId] || createEmptyOfficialWhatsappState();
        const payload = {
            locationId: location.location_id,
            slotId
        };

        if ((current.businessAccountId || "").trim()) payload.businessAccountId = current.businessAccountId.trim();
        if ((current.phoneNumberId || "").trim()) payload.phoneNumberId = current.phoneNumberId.trim();
        if ((current.accessToken || "").trim()) payload.accessToken = current.accessToken.trim();

        setSavingOfficialBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/whatsapp-official/config`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo guardar la configuración oficial");
            }
            toast.success(t('slots.official.saved') || "Configuración oficial guardada");
            await loadOfficialWhatsappConfig(slotId, true);
            syncSlotConnectionMode(slotId, 'official_api');
        } catch (e) {
            toast.error(t('slots.official.save_error') || "Error guardando WhatsApp API oficial", {
                description: e.message
            });
        } finally {
            setSavingOfficialBySlot(prev => ({ ...prev, [slotId]: false }));
        }
    };

    const validateOfficialWhatsappConfigSlot = async (slotId) => {
        const current = officialConfigBySlot[slotId] || createEmptyOfficialWhatsappState();
        const payload = {
            locationId: location.location_id,
            slotId
        };

        if ((current.businessAccountId || "").trim()) payload.businessAccountId = current.businessAccountId.trim();
        if ((current.phoneNumberId || "").trim()) payload.phoneNumberId = current.phoneNumberId.trim();
        if ((current.accessToken || "").trim()) payload.accessToken = current.accessToken.trim();

        const loadingId = toast.loading(t('slots.official.validating') || "Validando WhatsApp API oficial...");
        setSavingOfficialBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/whatsapp-official/validate`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!res) return false;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo validar la configuración oficial");
            }
            const data = await res.json();
            toast.success(t('slots.official.valid') || "WhatsApp API oficial validada");
            await loadOfficialWhatsappConfig(slotId, true);
            syncSlotConnectionMode(slotId, 'official_api', {
                ...(slots.find((slot) => slot.slot_id === slotId)?.settings?.official_api || {}),
                businessAccountId: data.businessAccountId || "",
                phoneNumberId: data.phoneNumberId || "",
                status: data.status || "verified",
                verifiedAt: data.verifiedAt || null,
                displayPhoneNumber: data.displayPhoneNumber || "",
                verifiedName: data.verifiedName || "",
                qualityRating: data.qualityRating || "",
                nameStatus: data.nameStatus || ""
            });
            return true;
        } catch (e) {
            toast.error(t('slots.official.invalid') || "Validación oficial falló", {
                description: e.message
            });
            return false;
        } finally {
            setSavingOfficialBySlot(prev => ({ ...prev, [slotId]: false }));
            toast.dismiss(loadingId);
        }
    };

    const clearOfficialWhatsappConfig = async (slotId) => {
        const loadingId = toast.loading(t('slots.official.clearing') || "Limpiando configuración oficial...");
        setSavingOfficialBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/whatsapp-official/config`, {
                method: 'PUT',
                body: JSON.stringify({
                    locationId: location.location_id,
                    slotId,
                    clear: true,
                    preserveConnectionMode: true
                })
            });
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo limpiar la configuración oficial");
            }
            toast.success(t('slots.official.cleared') || "Configuración oficial eliminada");
            setOfficialConfigBySlot(prev => ({
                ...prev,
                [slotId]: createEmptyOfficialWhatsappState()
            }));
            setOfficialTemplatesBySlot(prev => ({
                ...prev,
                [slotId]: createEmptyOfficialTemplateState()
            }));
            syncSlotConnectionMode(slotId, null, null);
        } catch (e) {
            toast.error(t('slots.official.clear_error') || "Error limpiando WhatsApp API oficial", {
                description: e.message
            });
        } finally {
            setSavingOfficialBySlot(prev => ({ ...prev, [slotId]: false }));
            toast.dismiss(loadingId);
        }
    };

    const clearOfficialWhatsappConfigKeepMode = async (slotId) => {
        const loadingId = toast.loading(t('slots.official.clearing') || "Limpiando configuracion oficial...");
        setSavingOfficialBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/whatsapp-official/config`, {
                method: 'PUT',
                body: JSON.stringify({
                    locationId: location.location_id,
                    slotId,
                    clear: true,
                    preserveConnectionMode: true
                })
            });
            if (!res) return;
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "No se pudo limpiar la configuracion oficial");
            }
            const embeddedSignup = data?.embeddedSignup || {};
            toast.success(t('slots.official.cleared') || "Configuracion oficial eliminada");
            setOfficialConfigBySlot(prev => ({
                ...prev,
                [slotId]: {
                    loaded: true,
                    configured: !!data.configured,
                    connectionMode: data.connectionMode || 'official_api',
                    status: data.status || 'draft',
                    businessAccountId: data.businessAccountId ? String(data.businessAccountId) : "",
                    phoneNumberId: data.phoneNumberId ? String(data.phoneNumberId) : "",
                    accessToken: "",
                    accessTokenMasked: data.accessTokenMasked || "",
                    hasAccessToken: !!data.hasAccessToken,
                    webhookVerifyToken: data.webhookVerifyToken || "",
                    webhookUrl: data.webhookUrl || "",
                    verifiedAt: data.verifiedAt || null,
                    lastValidationAt: data.lastValidationAt || null,
                    lastValidationError: data.lastValidationError || "",
                    lastWebhookAt: data.lastWebhookAt || null,
                    displayPhoneNumber: data.displayPhoneNumber || "",
                    verifiedName: data.verifiedName || "",
                    qualityRating: data.qualityRating || "",
                    nameStatus: data.nameStatus || "",
                    setupSource: data.setupSource || "",
                    embeddedSignupCompletedAt: data.embeddedSignupCompletedAt || null,
                    embeddedSignupBusinessId: data.embeddedSignupBusinessId || "",
                    embeddedSignupPhone: data.embeddedSignupPhone || "",
                    embeddedSignupError: data.embeddedSignupError || "",
                    embeddedSignupEnabled: !!embeddedSignup.enabled,
                    embeddedSignupAppId: embeddedSignup.appId ? String(embeddedSignup.appId) : "",
                    embeddedSignupConfigurationId: embeddedSignup.configurationId ? String(embeddedSignup.configurationId) : "",
                    embeddedSignupSdkVersion: embeddedSignup.sdkVersion ? String(embeddedSignup.sdkVersion) : "",
                    embeddedSignupGraphVersion: embeddedSignup.graphVersion ? String(embeddedSignup.graphVersion) : "",
                    embeddedSignupSessionInfoVersion: Number(embeddedSignup.sessionInfoVersion) || 3,
                    embeddedSignupSolutionId: embeddedSignup.solutionId ? String(embeddedSignup.solutionId) : "",
                    embeddedSignupProviderTokenConfigured: embeddedSignup.providerTokenConfigured === true,
                    embeddedSignupMissing: Array.isArray(embeddedSignup.missing) ? embeddedSignup.missing : []
                }
            }));
            setOfficialTemplatesBySlot(prev => ({
                ...prev,
                [slotId]: createEmptyOfficialTemplateState()
            }));
            syncSlotConnectionMode(slotId, 'official_api', {
                ...(slots.find((slot) => slot.slot_id === slotId)?.settings?.official_api || {}),
                businessAccountId: data.businessAccountId || "",
                phoneNumberId: data.phoneNumberId || "",
                accessToken: "",
                webhookVerifyToken: data.webhookVerifyToken || "",
                status: data.status || 'draft',
                verifiedAt: data.verifiedAt || null,
                displayPhoneNumber: data.displayPhoneNumber || "",
                verifiedName: data.verifiedName || "",
                qualityRating: data.qualityRating || "",
                nameStatus: data.nameStatus || ""
            });
        } catch (e) {
            toast.error(t('slots.official.clear_error') || "Error limpiando WhatsApp API oficial", {
                description: e.message
            });
        } finally {
            setSavingOfficialBySlot(prev => ({ ...prev, [slotId]: false }));
            toast.dismiss(loadingId);
        }
    };

    const formatOfficialDatetime = (value) => {
        if (!value) return "";
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return "";
        return parsed.toLocaleString();
    };

    const completeOfficialEmbeddedSignup = async (slotId, flowSnapshot) => {
        const loadingId = toast.loading(t('slots.official.embedded.completing') || 'Completando vinculación con Meta...');
        setCompletingOfficialEmbeddedBySlot(prev => ({ ...prev, [slotId]: true }));
        setStartingOfficialEmbeddedBySlot(prev => ({ ...prev, [slotId]: false }));
        try {
            const res = await authFetch(`/agency/whatsapp-official/embedded-signup/complete`, {
                method: 'POST',
                body: JSON.stringify({
                    locationId: location.location_id,
                    slotId,
                    authCode: flowSnapshot?.authCode || "",
                    accessToken: flowSnapshot?.accessToken || "",
                    businessAccountId: flowSnapshot?.businessAccountId || "",
                    phoneNumberId: flowSnapshot?.phoneNumberId || "",
                    businessId: flowSnapshot?.businessId || "",
                    displayPhoneNumber: flowSnapshot?.displayPhoneNumber || ""
                })
            });
            if (!res) return;
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || (t('slots.official.embedded.complete_error') || 'No se pudo completar la vinculación con Meta'));
            }

            await loadData();
            await loadOfficialWhatsappConfig(slotId, true);
            syncSlotConnectionMode(slotId, 'official_api', {
                ...(slots.find((slot) => slot.slot_id === slotId)?.settings?.official_api || {}),
                businessAccountId: data.businessAccountId || "",
                phoneNumberId: data.phoneNumberId || "",
                status: data.status || "verified",
                verifiedAt: data.verifiedAt || null,
                displayPhoneNumber: data.displayPhoneNumber || "",
                verifiedName: data.verifiedName || "",
                qualityRating: data.qualityRating || "",
                nameStatus: data.nameStatus || "",
                setupSource: data.setupSource || "embedded_signup",
                embeddedSignupCompletedAt: data.embeddedSignupCompletedAt || null,
                embeddedSignupBusinessId: data.embeddedSignupBusinessId || "",
                embeddedSignupPhone: data.embeddedSignupPhone || ""
            });
            toast.success(t('slots.official.embedded.completed') || 'WhatsApp oficial conectado desde Meta');
        } catch (e) {
            toast.error(t('slots.official.embedded.complete_error') || 'Error completando la vinculación con Meta', {
                description: e.message
            });
            throw e;
        } finally {
            toast.dismiss(loadingId);
            setCompletingOfficialEmbeddedBySlot(prev => ({ ...prev, [slotId]: false }));
            resetEmbeddedSignupFlow();
        }
    };

    const startOfficialEmbeddedSignup = async (slotId) => {
        const official = officialConfigBySlot[slotId] || createEmptyOfficialWhatsappState();
        const missing = Array.isArray(official.embeddedSignupMissing) ? official.embeddedSignupMissing : [];

        if (!official.embeddedSignupEnabled) {
            toast.error(t('slots.official.embedded.unavailable') || 'El Embedded Signup de Meta no está configurado en este entorno', {
                description: missing.length > 0
                    ? `${t('slots.official.embedded.missing') || 'Faltan'}: ${missing.join(', ')}`
                    : undefined
            });
            return;
        }

        setStartingOfficialEmbeddedBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const fb = await ensureFacebookSdk(official);
            resetEmbeddedSignupFlow();
            embeddedSignupFlowRef.current.slotId = slotId;

            const extras = {
                sessionInfoVersion: Number(official.embeddedSignupSessionInfoVersion) || 3
            };
            if (String(official.embeddedSignupSolutionId || '').trim()) {
                extras.setup = {
                    solutionID: String(official.embeddedSignupSolutionId || '').trim()
                };
            }

            fb.login((response) => {
                const authResponse = response?.authResponse || null;
                if (!authResponse) {
                    setStartingOfficialEmbeddedBySlot(prev => ({ ...prev, [slotId]: false }));
                    window.setTimeout(() => {
                        const currentFlow = embeddedSignupFlowRef.current;
                        if (
                            currentFlow?.slotId === slotId &&
                            !currentFlow.completionSent &&
                            !currentFlow.authCode &&
                            !currentFlow.accessToken
                        ) {
                            toast.error(t('slots.official.embedded.cancelled') || 'El asistente de Meta fue cancelado');
                            resetEmbeddedSignupFlow();
                        }
                    }, 800);
                    return;
                }

                embeddedSignupFlowRef.current.authCode = pickFirstNonEmptyString(
                    authResponse.code,
                    embeddedSignupFlowRef.current.authCode
                );
                embeddedSignupFlowRef.current.accessToken = pickFirstNonEmptyString(
                    authResponse.accessToken,
                    embeddedSignupFlowRef.current.accessToken
                );
                setStartingOfficialEmbeddedBySlot(prev => ({ ...prev, [slotId]: false }));

                const flow = embeddedSignupFlowRef.current;
                if (!flow.completionSent && flow.phoneNumberId && (flow.authCode || flow.accessToken)) {
                    const snapshot = { ...flow };
                    flow.completionSent = true;
                    completeOfficialEmbeddedSignup(snapshot.slotId, snapshot).catch(() => { });
                }
            }, {
                config_id: official.embeddedSignupConfigurationId,
                response_type: 'code',
                override_default_response_type: true,
                extras
            });
        } catch (e) {
            setStartingOfficialEmbeddedBySlot(prev => ({ ...prev, [slotId]: false }));
            toast.error(t('slots.official.embedded.start_error') || 'No se pudo abrir el Embedded Signup de Meta', {
                description: e.message
            });
            resetEmbeddedSignupFlow();
        }
    };

    const resetSlotConnectionMode = async (slot) => {
        const currentMode = getEffectiveSlotConnectionMode(slot);
        if (!currentMode) return;

        const loadingId = toast.loading(t('slots.connection_mode.resetting') || 'Cambiando tipo de conexión...');
        try {
            if (currentMode === 'qr') {
                const hasLinkedQr = slot?.is_connected === true || String(slot?.phone_number || "").trim();
                if (hasLinkedQr) {
                    const disconnectRes = await authFetch(`/agency/slots/${location.location_id}/${slot.slot_id}/disconnect`, {
                        method: 'DELETE'
                    });
                    if (!disconnectRes) return;
                    if (!disconnectRes.ok) {
                        const err = await disconnectRes.json().catch(() => ({}));
                        throw new Error(err.error || 'No se pudo cerrar la conexión QR');
                    }
                }

                const nextSettings = { ...(slot.settings || {}) };
                delete nextSettings.connection_mode;
                delete nextSettings.official_api;
                await updateSettingsBackend(slot.slot_id, nextSettings);
                setOfficialConfigBySlot(prev => ({
                    ...prev,
                    [slot.slot_id]: createEmptyOfficialWhatsappState()
                }));
            } else {
                const res = await authFetch(`/agency/whatsapp-official/config`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        locationId: location.location_id,
                        slotId: slot.slot_id,
                        clear: true
                    })
                });
                if (!res) return;
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'No se pudo limpiar la configuración oficial');
                }
                setOfficialConfigBySlot(prev => ({
                    ...prev,
                    [slot.slot_id]: createEmptyOfficialWhatsappState()
                }));
                syncSlotConnectionMode(slot.slot_id, null, null);
            }

            await loadData();
            focusSlotConnectionSelector(slot.slot_id);
            toast.success(t('slots.connection_mode.reset_done') || 'Elige el nuevo tipo de conexión');
        } catch (e) {
            toast.error(t('slots.connection_mode.reset_error') || 'No se pudo cambiar el tipo de conexión', {
                description: e.message
            });
        } finally {
            toast.dismiss(loadingId);
        }
    };

    const requestSlotConnectionModeChange = (slot) => {
        const currentMode = getEffectiveSlotConnectionMode(slot);
        if (!currentMode) return;

        const isQrMode = currentMode === 'qr';
        const hasLinkedQr = isQrMode && (slot?.is_connected === true || String(slot?.phone_number || "").trim());
        const hasOfficialConfig = !isQrMode && hasOfficialWhatsappConfig(slot);
        const requiresWarning = hasLinkedQr || hasOfficialConfig;

        if (!requiresWarning) {
            resetSlotConnectionMode(slot);
            return;
        }

        const title = t('slots.connection_mode.confirm_title') || 'Cambiar tipo de conexión';
        const description = hasLinkedQr
            ? (t('slots.connection_mode.confirm_qr_desc') || 'Si cambias el tipo de conexión, este slot se desconectará, se borrará la sesión QR actual y tendrás que volver a configurarlo desde cero.')
            : (t('slots.connection_mode.confirm_official_desc') || 'Si cambias el tipo de conexión, se eliminará la configuración oficial guardada para este slot y tendrás que volver a cargarla.');

        confirmToast(title, description, () => {
            resetSlotConnectionMode(slot);
        }, true);
    };

    const loadChatwootConfig = async (slotId, forceRefresh = false) => {
        if (!slotId || !location?.location_id) return;
        if (!forceRefresh && chatwootConfigBySlot[slotId]?.loaded) return;

        setLoadingChatwootBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/chatwoot/config?locationId=${location.location_id}&slotId=${slotId}`);
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo cargar Chatwoot");
            }
            const data = await res.json();
            setChatwootConfigBySlot(prev => ({
                ...prev,
                [slotId]: {
                    loaded: true,
                    configured: !!data.configured,
                    hasGlobalConfig: !!data.hasGlobalConfig,
                    chatwootUrl: "",
                    apiToken: "",
                    accountId: data.accountId ? String(data.accountId) : "",
                    inboxId: data.inboxId ? String(data.inboxId) : "",
                    webhookSecret: "",
                    chatwootUrlMasked: data.chatwootUrlMasked || "",
                    apiTokenMasked: data.apiTokenMasked || "",
                    hasApiToken: !!data.hasApiToken,
                    hasWebhookSecret: !!data.hasWebhookSecret,
                    showAdvancedDetails: !!prev[slotId]?.showAdvancedDetails,
                    csatEnabled: Boolean(data.csatEnabled),
                    csatMessage: data.csatMessage || ""
                }
            }));
            if (data.hasGlobalConfig) {
                await loadChatwootInboxes(forceRefresh);
            }
        } catch (e) {
            toast.error(t('slots.chatwoot.load_error') || "Error cargando Chatwoot", { description: e.message });
        } finally {
            setLoadingChatwootBySlot(prev => ({ ...prev, [slotId]: false }));
        }
    };

    const updateChatwootField = (slotId, key, value) => {
        setChatwootConfigBySlot(prev => {
            const current = prev[slotId] || createEmptyChatwootState();
            return {
                ...prev,
                [slotId]: {
                    ...current,
                    loaded: true,
                    [key]: value
                }
            };
        });
    };

    const validateChatwootConfigSlot = async (slotId) => {
        const current = chatwootConfigBySlot[slotId] || createEmptyChatwootState();
        const payload = { locationId: location.location_id };

        const chatwootUrl = (current.chatwootUrl || "").trim();
        const apiToken = (current.apiToken || "").trim();
        const accountIdRaw = String(current.accountId || "").trim();

        if (chatwootUrl) payload.chatwootUrl = chatwootUrl;
        if (apiToken) payload.apiToken = apiToken;
        if (accountIdRaw) {
            const parsedAccount = Number.parseInt(accountIdRaw, 10);
            if (!Number.isFinite(parsedAccount) || parsedAccount <= 0) {
                toast.error(t('slots.chatwoot.invalid_account') || "Account ID inválido");
                return false;
            }
            payload.accountId = parsedAccount;
        }

        const loadingId = toast.loading(t('slots.chatwoot.validating') || "Validando Chatwoot...");
        try {
            const res = await authFetch(`/agency/chatwoot/test`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!res) return false;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo validar Chatwoot");
            }
            const data = await res.json().catch(() => ({}));
            const description = Number.isFinite(data?.agentsCount)
                ? `${t('slots.chatwoot.agents') || "Agentes encontrados"}: ${data.agentsCount}`
                : undefined;
            toast.success(t('slots.chatwoot.valid') || "Chatwoot validado", { description });
            return true;
        } catch (e) {
            toast.error(t('slots.chatwoot.invalid') || "Validación Chatwoot falló", { description: e.message });
            return false;
        } finally {
            toast.dismiss(loadingId);
        }
    };

    const saveChatwootConfig = async (slotId) => {
        const current = chatwootConfigBySlot[slotId] || createEmptyChatwootState();
        const chatwootUrl = (current.chatwootUrl || "").trim();
        const apiToken = (current.apiToken || "").trim();
        const webhookSecret = (current.webhookSecret || "").trim();
        const accountIdRaw = String(current.accountId || "").trim();
        const inboxIdRaw = String(current.inboxId || "").trim();

        const hasUrl = chatwootUrl || current.chatwootUrlMasked;
        const hasToken = apiToken || current.apiTokenMasked || current.hasApiToken;
        if (!hasUrl || !hasToken || !accountIdRaw || !inboxIdRaw) {
            toast.error(t('slots.chatwoot.required') || "Completa URL, API Token, Account ID e Inbox ID");
            return;
        }

        const parsedAccount = Number.parseInt(accountIdRaw, 10);
        if (!Number.isFinite(parsedAccount) || parsedAccount <= 0) {
            toast.error(t('slots.chatwoot.invalid_account') || "Account ID inválido");
            return;
        }

        const parsedInbox = Number.parseInt(inboxIdRaw, 10);
        if (!Number.isFinite(parsedInbox) || parsedInbox <= 0) {
            toast.error(t('slots.chatwoot.invalid_inbox') || "Inbox ID inválido");
            return;
        }

        const payload = {
            locationId: location.location_id,
            slotId,
            accountId: parsedAccount,
            inboxId: parsedInbox,
            csatEnabled: Boolean(current.csatEnabled),
            csatMessage: String(current.csatMessage || "").trim()
        };
        if (chatwootUrl) payload.chatwootUrl = chatwootUrl;
        if (apiToken) payload.apiToken = apiToken;
        if (webhookSecret) payload.webhookSecret = webhookSecret;

        setSavingChatwootBySlot(prev => ({ ...prev, [slotId]: true }));
        try {
            const res = await authFetch(`/agency/chatwoot/config`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo guardar Chatwoot");
            }
            toast.success(t('slots.chatwoot.saved') || "Configuración Chatwoot guardada");
            await loadChatwootConfig(slotId, true);
        } catch (e) {
            toast.error(t('slots.chatwoot.save_error') || "Error guardando Chatwoot", { description: e.message });
        } finally {
            setSavingChatwootBySlot(prev => ({ ...prev, [slotId]: false }));
        }
    };

    const clearChatwootSlotConfig = async (slotId) => {
        if (!confirm(t('slots.chatwoot.confirm_clear_slot') || "¿Quitar el Inbox ID de este número?")) return;

        const loadingId = toast.loading(t('slots.chatwoot.clearing') || "Limpiando Chatwoot...");
        try {
            const res = await authFetch(`/agency/chatwoot/config`, {
                method: 'PUT',
                body: JSON.stringify({
                    locationId: location.location_id,
                    slotId,
                    clearSlot: true
                })
            });
            if (!res) return;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo limpiar Chatwoot");
            }
            toast.success(t('slots.chatwoot.cleared') || "Inbox de Chatwoot limpiado");
            await loadChatwootConfig(slotId, true);
        } catch (e) {
            toast.error(t('slots.chatwoot.clear_error') || "Error limpiando Chatwoot", { description: e.message });
        } finally {
            toast.dismiss(loadingId);
        }
    };

    const loadTwilioConfig = async (slotId, forceRefresh = false) => {
        if (!slotId || !location?.location_id) return;
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
                throw new Error(err.error || "Credenciales inv�lidas");
            }
            toast.success("Twilio validado correctamente");
            return true;
        } catch (e) {
            toast.error("Validaci�n Twilio fall�", { description: e.message });
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
            toast.error("Completa SID, Auth Token y n�mero Twilio");
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
            toast.success("Configuraci�n Twilio guardada");
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
    const chatwootHeaderLoginUrl = String(
        chatwootAccessInfo?.directLoginUrl ||
        chatwootAccessInfo?.loginUrl ||
        (tenantSettings?.chatwoot_url ? `${String(tenantSettings.chatwoot_url).replace(/\/$/, "")}/app/login` : "")
    ).trim();
    const chatwootHeaderEmail = String(
        chatwootAccessInfo?.clientEmail ||
        tenantSettings?.chatwoot_client_email ||
        ""
    ).trim();
    const chatwootHeaderPassword = String(chatwootAccessInfo?.clientPassword || "").trim();
    const ghlHeaderOpenUrl = String(
        ghlAccessInfo?.dashboardUrl ||
        ghlAccessInfo?.loginUrl ||
        "https://app.gohighlevel.com"
    ).trim();
    const ghlHeaderPortalUrl = String(
        ghlAccessInfo?.loginUrl ||
        "https://app.gohighlevel.com"
    ).trim();
    const ghlHeaderBusinessEmail = String(
        ghlAccessInfo?.businessEmail ||
        tenantSettings?.ghl_subaccount_email ||
        ""
    ).trim();
    const ghlHeaderBusinessPhone = String(
        ghlAccessInfo?.businessPhone ||
        tenantSettings?.ghl_subaccount_phone ||
        ""
    ).trim();
    const ghlHeaderLocationId = String(
        ghlAccessInfo?.locationId ||
        location?.location_id ||
        ""
    ).trim();
    const ghlHeaderCompanyId = String(ghlAccessInfo?.companyId || "").trim();
    const ghlHeaderDashboardUrl = String(ghlAccessInfo?.dashboardUrl || "").trim();
    const ghlOAuthConnected = Boolean(ghlAccessInfo?.oauthConnected);

    const renderConnectionModeSelector = (slot) => (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-indigo-500 mb-3">
                    {t('slots.connection_mode.eyebrow') || 'Selecciona el tipo de conexión'}
                </p>
                <h4 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
                    {t('slots.connection_mode.title') || '¿Cómo quieres vincular este número?'}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                    {t('slots.connection_mode.desc') || 'Elige si este slot operará con un dispositivo conectado por QR o con la API oficial de WhatsApp.'}
                </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
                <button
                    type="button"
                    onClick={() => selectSlotConnectionMode(slot, 'qr')}
                    className="text-left rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 hover:border-indigo-400 hover:shadow-lg transition"
                >
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center mb-5">
                        <QrCode size={22} />
                    </div>
                    <h5 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">
                        {t('slots.connection_mode.qr_title') || 'Conexión QR'}
                    </h5>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-6">
                        {t('slots.connection_mode.qr_desc') || 'Vincula el número escaneando un QR y usa el panel actual de conexión, reconexión y grupos.'}
                    </p>
                </button>

                <button
                    type="button"
                    onClick={() => selectSlotConnectionMode(slot, 'official_api')}
                    className="relative text-left rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 p-6 pt-10 hover:border-emerald-400 hover:shadow-lg transition"
                >
                    <span className="absolute left-6 top-0 -translate-y-1/2 inline-flex items-center rounded-full bg-emerald-400 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-950 shadow-[0_10px_24px_rgba(16,185,129,0.28)]">
                        {t('slots.connection_mode.official_badge') || 'Beta'}
                    </span>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center mb-5">
                        <Link2 size={22} />
                    </div>
                    <h5 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">
                        {t('slots.connection_mode.official_title') || 'API oficial de WhatsApp'}
                    </h5>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-6">
                        {t('slots.connection_mode.official_desc') || 'Configura WABA, Phone Number ID, token y webhook de Meta. Este modo solo opera mensajes desde Chatwoot o GoHighLevel y no usa el panel QR, grupos ni reglas de gestión de Waflow.'}
                    </p>
                </button>
            </div>
        </div>
    );

    const renderOfficialWhatsappPanel = (slot) => {
        const official = officialConfigBySlot[slot.slot_id] || createEmptyOfficialWhatsappState();
        const isLoadingOfficial = !!loadingOfficialBySlot[slot.slot_id];
        const isSavingOfficial = !!savingOfficialBySlot[slot.slot_id];
        const isStartingEmbedded = !!startingOfficialEmbeddedBySlot[slot.slot_id];
        const isCompletingEmbedded = !!completingOfficialEmbeddedBySlot[slot.slot_id];
        const isWorkingEmbedded = isStartingEmbedded || isCompletingEmbedded;
        const templateState = officialTemplatesBySlot[slot.slot_id] || createEmptyOfficialTemplateState();
        const isLoadingTemplates = !!loadingOfficialTemplatesBySlot[slot.slot_id];
        const isSendingTemplate = !!sendingOfficialTemplateBySlot[slot.slot_id];
        const approvedTemplates = (templateState.templates || []).filter((template) => String(template.status || '').trim().toUpperCase() === 'APPROVED');
        const selectedTemplate = (templateState.templates || []).find((template) => getOfficialTemplateKey(template) === templateState.selectedTemplateKey) || null;
        const selectedTemplateIsApproved = !!selectedTemplate && String(selectedTemplate.status || '').trim().toUpperCase() === 'APPROVED';
        const templateFields = selectedTemplate ? getOfficialTemplateParameterFields(selectedTemplate) : [];
        const canSyncTemplates = Boolean(String(official.businessAccountId || '').trim() && official.hasAccessToken);
        const status = String(official.status || 'draft').toLowerCase();
        const statusClassName = status === 'verified'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            : official.configured
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
        const statusLabel = status === 'verified'
            ? (t('slots.official.verified') || 'Verificada')
            : official.configured
                ? (t('slots.official.pending') || 'Pendiente de validación')
                : (t('slots.official.not_configured') || 'Sin configurar');

        const embeddedMissingLabel = Array.isArray(official.embeddedSignupMissing) && official.embeddedSignupMissing.length > 0
            ? official.embeddedSignupMissing.join(', ')
            : '';

        return (
            <div className="max-w-3xl space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                                    <Link2 size={18} />
                                </div>
                                <h4 className="text-xl font-extrabold text-gray-900 dark:text-white">
                                    {t('slots.official.title') || 'WhatsApp API oficial'}
                                </h4>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                                {t('slots.official.desc') || 'Configura este slot con la API oficial de Meta. Este modo queda enfocado en recibir y enviar mensajes desde Chatwoot o GoHighLevel, sin el panel QR ni extras del flujo Baileys.'}
                            </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${statusClassName}`}>
                            {statusLabel}
                        </span>
                    </div>

                    {isLoadingOfficial && !official.loaded ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="animate-spin text-indigo-500" size={24} />
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="rounded-3xl border border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950/30 dark:via-gray-900 dark:to-teal-950/20 p-5">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="max-w-2xl">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-600 mb-2">
                                            {t('slots.official.embedded.eyebrow') || 'Recomendado'}
                                        </p>
                                        <h5 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">
                                            {t('slots.official.embedded.title') || 'Conectar con WhatsApp Business'}
                                        </h5>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-6">
                                            {t('slots.official.embedded.desc') || 'Abre el flujo oficial de Meta dentro de Waflow para crear o vincular la cuenta, elegir el número y dejar el slot listo sin copiar IDs ni tokens manualmente.'}
                                        </p>
                                        {official.setupSource === 'embedded_signup' && official.embeddedSignupCompletedAt ? (
                                            <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                                {t('slots.official.embedded.connected_at') || 'Conectado desde Meta'}: {formatOfficialDatetime(official.embeddedSignupCompletedAt)}
                                            </p>
                                        ) : null}
                                        {!official.embeddedSignupEnabled ? (
                                            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                                                {embeddedMissingLabel
                                                    ? `${t('slots.official.embedded.missing') || 'Faltan'}: ${embeddedMissingLabel}`
                                                    : (t('slots.official.embedded.unavailable') || 'Este entorno todavía no tiene configurado el Embedded Signup de Meta.')}
                                            </p>
                                        ) : null}
                                        {facebookSdkState.error ? (
                                            <p className="mt-3 text-xs text-rose-700 dark:text-rose-300">
                                                {facebookSdkState.error}
                                            </p>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => startOfficialEmbeddedSignup(slot.slot_id)}
                                        disabled={!official.embeddedSignupEnabled || isWorkingEmbedded || isSavingOfficial}
                                        className="min-w-[240px] px-5 py-3 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-3 font-bold shadow-[0_18px_40px_rgba(16,185,129,0.25)]"
                                    >
                                        {isWorkingEmbedded ? <Loader2 className="animate-spin" size={18} /> : <Link2 size={18} />}
                                        {isCompletingEmbedded
                                            ? (t('slots.official.embedded.completing_cta') || 'Conectando...')
                                            : isStartingEmbedded
                                                ? (t('slots.official.embedded.starting') || 'Abriendo Meta...')
                                                : (t('slots.official.embedded.cta') || 'Conectar con WhatsApp Business')}
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/20 p-5">
                                <div className="mb-4">
                                    <h5 className="text-base font-bold text-gray-900 dark:text-white">
                                        {t('slots.official.manual.title') || 'Configuración manual avanzada'}
                                    </h5>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {t('slots.official.manual.desc') || 'Usa esta sección solo si prefieres cargar el WABA ID, el Phone Number ID y el token manualmente o si Meta exige un ajuste puntual.'}
                                    </p>
                                </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        {t('slots.official.phone_number_id') || 'Phone Number ID'}
                                    </label>
                                    <input
                                        type="text"
                                        value={official.phoneNumberId || ""}
                                        onChange={(e) => updateOfficialWhatsappField(slot.slot_id, "phoneNumberId", e.target.value)}
                                        placeholder={t('slots.official.ph_phone_number_id') || 'Ej: 109876543210987'}
                                        autoComplete="off"
                                        className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        {t('slots.official.business_account_id') || 'Business Account ID / WABA ID'}
                                    </label>
                                    <input
                                        type="text"
                                        value={official.businessAccountId || ""}
                                        onChange={(e) => updateOfficialWhatsappField(slot.slot_id, "businessAccountId", e.target.value)}
                                        placeholder={t('slots.official.ph_business_account_id') || 'Ej: 123456789012345'}
                                        autoComplete="off"
                                        className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                    />
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {t('slots.official.waba_hint') || 'Si Meta no lo detecta automáticamente, puedes completarlo manualmente para habilitar templates y la suscripción automática de la WABA.'}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    {t('slots.official.access_token') || 'Access Token'}
                                </label>
                                <input
                                    type="password"
                                    value={official.accessToken || ""}
                                    onChange={(e) => updateOfficialWhatsappField(slot.slot_id, "accessToken", e.target.value)}
                                    placeholder={official.accessTokenMasked || (t('slots.official.ph_access_token') || 'Pega aquí el token del system user o token permanente')}
                                    autoComplete="new-password"
                                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                />
                            </div>

                            {SHOW_OFFICIAL_WEBHOOK_DEBUG ? (
                                <>
                            <div>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                        {t('slots.official.verify_token') || 'Webhook Verify Token'}
                                    </label>
                                    {official.webhookVerifyToken ? (
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(official.webhookVerifyToken, t('slots.official.verify_token_copied') || 'Verify token copiado')}
                                            className="text-xs font-bold uppercase tracking-wide text-indigo-600 hover:text-indigo-500"
                                        >
                                            {t('slots.official.copy_verify_token') || 'Copiar'}
                                        </button>
                                    ) : null}
                                </div>
                                <input
                                    type="text"
                                    value={official.webhookVerifyToken || ""}
                                    placeholder={t('slots.official.ph_verify_token') || 'Se genera automáticamente al guardar si lo dejas vacío'}
                                    autoComplete="off"
                                    readOnly
                                    className="w-full p-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 outline-none transition font-mono text-sm"
                                />
                            </div>

                            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/60 p-4">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div>
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                                            {t('slots.official.webhook_url') || 'Webhook URL'}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('slots.official.webhook_hint') || 'Pega esta URL en Meta y usa el mismo Verify Token en la configuración del webhook.'}
                                        </p>
                                    </div>
                                    {official.webhookUrl ? (
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(official.webhookUrl, t('slots.official.webhook_copied') || 'Webhook copiado')}
                                            className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40 transition flex items-center gap-2 text-sm font-semibold"
                                        >
                                            <Copy size={14} />
                                            {t('slots.official.copy_webhook') || 'Copiar'}
                                        </button>
                                    ) : null}
                                </div>
                                <input
                                    type="text"
                                    readOnly
                                    value={official.webhookUrl || (t('slots.official.webhook_pending') || 'Guarda la configuración para generar la URL del webhook')}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 font-mono text-xs"
                                />
                            </div>
                                </>
                            ) : (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                                    WaFloW configura y enruta el webhook oficial automÃ¡ticamente para este canal. El cliente no necesita copiar ni pegar nada en Meta por slot.
                                </div>
                            )}

                            </div>

                            {(official.verifiedName || official.displayPhoneNumber || official.qualityRating || official.lastWebhookAt) && (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {official.displayPhoneNumber ? (
                                        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                                                {t('slots.official.display_phone') || 'Número visible'}
                                            </p>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{official.displayPhoneNumber}</p>
                                        </div>
                                    ) : null}
                                    {official.verifiedName ? (
                                        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                                                {t('slots.official.verified_name') || 'Verified name'}
                                            </p>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{official.verifiedName}</p>
                                        </div>
                                    ) : null}
                                    {official.qualityRating ? (
                                        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                                                {t('slots.official.quality_rating') || 'Quality rating'}
                                            </p>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{official.qualityRating}</p>
                                        </div>
                                    ) : null}
                                    {official.lastWebhookAt ? (
                                        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                                                {t('slots.official.last_webhook') || 'Último webhook'}
                                            </p>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatOfficialDatetime(official.lastWebhookAt)}</p>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            <div className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/30 p-5 space-y-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h5 className="text-base font-bold text-gray-900 dark:text-white">
                                            {t('slots.official.templates.title') || 'Templates oficiales'}
                                        </h5>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
                                            {t('slots.official.templates.desc') || 'Sincroniza los templates aprobados de la WABA y envía pruebas directamente desde WaFloW.'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => loadOfficialWhatsappTemplates(slot.slot_id, true)}
                                        disabled={!canSyncTemplates || isLoadingTemplates || isLoadingOfficial || isSavingOfficial}
                                        className="px-4 py-2 rounded-xl bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:bg-gray-950 dark:text-indigo-300 dark:border-indigo-900/40 dark:hover:bg-indigo-900/20 disabled:opacity-50 transition flex items-center gap-2"
                                    >
                                        <RefreshCw size={16} className={isLoadingTemplates ? "animate-spin" : ""} />
                                        {isLoadingTemplates
                                            ? (t('slots.official.templates.syncing') || 'Sincronizando...')
                                            : (t('slots.official.templates.sync') || 'Sincronizar templates')}
                                    </button>
                                </div>

                                {!official.businessAccountId ? (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                                        {t('slots.official.templates.missing_waba') || 'Completa el WABA ID antes de usar templates.'}
                                    </div>
                                ) : !official.hasAccessToken ? (
                                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-200">
                                        {t('slots.official.templates.needs_saved_token') || 'Guarda o valida primero la configuración oficial para poder sincronizar templates desde Meta.'}
                                    </div>
                                ) : (
                                    <>
                                        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950/50 overflow-hidden">
                                            <div className="grid grid-cols-[minmax(0,1.5fr)_110px_120px_110px] gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200 dark:border-gray-800">
                                                <span>{t('slots.official.templates.name') || 'Template'}</span>
                                                <span>{t('slots.official.templates.language') || 'Idioma'}</span>
                                                <span>{t('slots.official.templates.category') || 'Categoría'}</span>
                                                <span>{t('slots.official.templates.status') || 'Estado'}</span>
                                            </div>
                                            {(templateState.templates || []).length > 0 ? (
                                                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                                                    {(templateState.templates || []).map((template) => {
                                                        const templateKey = getOfficialTemplateKey(template);
                                                        const isApproved = String(template.status || '').trim().toUpperCase() === 'APPROVED';
                                                        return (
                                                            <div
                                                                key={templateKey}
                                                                className={`grid grid-cols-[minmax(0,1.5fr)_110px_120px_110px] gap-3 px-4 py-3 text-sm ${templateState.selectedTemplateKey === templateKey ? 'bg-indigo-50/70 dark:bg-indigo-900/10' : 'bg-transparent'}`}
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-gray-900 dark:text-white truncate">{template.name}</p>
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                                        {Array.isArray(template.components) ? template.components.length : 0} {t('slots.official.templates.components_count') || 'componentes'}
                                                                    </p>
                                                                </div>
                                                                <span className="text-gray-700 dark:text-gray-200 font-mono text-xs self-center">{template.language || '-'}</span>
                                                                <span className="text-gray-700 dark:text-gray-200 text-xs self-center">{template.category || '-'}</span>
                                                                <span className={`text-xs font-bold self-center ${isApproved ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
                                                                    {template.status || '-'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
                                                    {t('slots.official.templates.empty') || 'No se encontraron templates en esta WABA todavía.'}
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('slots.official.templates.manage_hint') || 'WaFloW sincroniza y envía templates. La creación o edición avanzada sigue haciéndose en Meta.'}
                                        </p>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                    {t('slots.official.templates.target_phone') || 'Número destino'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={templateState.targetPhone || ""}
                                                    onChange={(e) => updateOfficialTemplateField(slot.slot_id, "targetPhone", e.target.value)}
                                                    placeholder={t('slots.official.templates.ph_target_phone') || 'Ej: 595981234567'}
                                                    autoComplete="off"
                                                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                    {t('slots.official.templates.select_template') || 'Template aprobado'}
                                                </label>
                                                <select
                                                    value={templateState.selectedTemplateKey || ""}
                                                    onChange={(e) => updateOfficialTemplateField(slot.slot_id, "selectedTemplateKey", e.target.value)}
                                                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm"
                                                    disabled={approvedTemplates.length === 0}
                                                >
                                                    <option value="">{t('slots.official.templates.select_template_placeholder') || 'Selecciona un template aprobado'}</option>
                                                    {approvedTemplates.map((template) => (
                                                        <option key={getOfficialTemplateKey(template)} value={getOfficialTemplateKey(template)}>
                                                            {template.name} · {template.language}
                                                        </option>
                                                    ))}
                                                </select>
                                                {approvedTemplates.length === 0 ? (
                                                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                                                        {t('slots.official.templates.no_approved') || 'Todavía no hay templates aprobados disponibles para enviar.'}
                                                    </p>
                                                ) : selectedTemplate && !selectedTemplateIsApproved ? (
                                                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                                                        {t('slots.official.templates.not_approved') || 'El template seleccionado no está aprobado'}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>

                                        {selectedTemplate ? (
                                            <div className="space-y-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950/50 p-4">
                                                {templateFields.length > 0 ? (
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        {templateFields.map((field) => (
                                                            <div key={field.key}>
                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                                    {field.label}
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={templateState.parameterValues?.[field.key] || ""}
                                                                    onChange={(e) => updateOfficialTemplateParameter(slot.slot_id, field.key, e.target.value)}
                                                                    autoComplete="off"
                                                                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                                        {t('slots.official.templates.no_params') || 'Este template no requiere variables dinámicas comunes. Puedes enviarlo directo o usar el JSON avanzado si necesitas un payload especial.'}
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                        {t('slots.official.templates.advanced_json') || 'Components JSON avanzado'}
                                                    </label>
                                                    <textarea
                                                        rows={4}
                                                        value={templateState.componentsJson || ""}
                                                        onChange={(e) => updateOfficialTemplateField(slot.slot_id, "componentsJson", e.target.value)}
                                                        placeholder='[{"type":"body","parameters":[{"type":"text","text":"valor"}]}]'
                                                        className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-xs"
                                                    />
                                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                        {t('slots.official.templates.advanced_json_hint') || 'Si completas este JSON, WaFloW lo enviará tal cual y omitirá las variables simples del formulario.'}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : null}

                                        <div className="flex flex-wrap items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => sendOfficialTemplateTest(slot.slot_id)}
                                                disabled={isSendingTemplate || isLoadingTemplates || !selectedTemplateIsApproved || !String(templateState.targetPhone || '').trim()}
                                                className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2"
                                            >
                                                {isSendingTemplate ? <Loader2 className="animate-spin" size={16} /> : <MessageSquare size={16} />}
                                                {t('slots.official.templates.send') || 'Enviar template de prueba'}
                                            </button>
                                            {templateState.fetchedAt ? (
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {t('slots.official.templates.last_sync') || 'Última sincronización'}: {formatOfficialDatetime(templateState.fetchedAt)}
                                                </span>
                                            ) : null}
                                        </div>
                                    </>
                                )}
                            </div>

                            {official.lastValidationError ? (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                                    <span className="font-bold mr-2">{t('slots.official.validation_error') || 'Último error'}:</span>
                                    {official.lastValidationError}
                                </div>
                            ) : null}

                            <div className="flex flex-wrap items-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => validateOfficialWhatsappConfigSlot(slot.slot_id)}
                                    disabled={isLoadingOfficial || isSavingOfficial || isWorkingEmbedded}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition flex items-center gap-2"
                                >
                                    <CheckCircle2 size={16} />
                                    {t('slots.official.validate') || 'Validar con Meta'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => saveOfficialWhatsappConfig(slot.slot_id)}
                                    disabled={isLoadingOfficial || isSavingOfficial || isWorkingEmbedded}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2"
                                >
                                    {isSavingOfficial ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                    {t('slots.official.save') || 'Guardar'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => clearOfficialWhatsappConfigKeepMode(slot.slot_id)}
                                    disabled={isLoadingOfficial || isSavingOfficial || isWorkingEmbedded}
                                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 transition"
                                >
                                    {t('slots.official.clear') || 'Limpiar'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => loadOfficialWhatsappConfig(slot.slot_id, true)}
                                    disabled={isLoadingOfficial || isSavingOfficial || isWorkingEmbedded}
                                    className="px-3 py-2 rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition"
                                    title={t('slots.official.reload') || 'Recargar configuración'}
                                >
                                    <RefreshCw size={16} className={isLoadingOfficial ? "animate-spin" : ""} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
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
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-14">{t('slots.subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                {isChatwootMode && showChatwootAccessModal && (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setShowChatwootAccessModal(false)}
                    >
                        <div
                            className="w-full max-w-lg rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{`Info de acceso ${managedInboxBrandName}`}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Datos del usuario para compartir con el cliente final.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowChatwootAccessModal(false)}
                                    className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition text-gray-400 hover:text-gray-600"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Email</p>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-all">
                                        {loadingChatwootAccess ? "Cargando..." : (chatwootHeaderEmail || "No disponible")}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Contraseña inicial</p>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-all">
                                        {loadingChatwootAccess ? "Cargando..." : (chatwootHeaderPassword || "No disponible")}
                                    </p>
                                    {!chatwootHeaderPassword && !loadingChatwootAccess && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                            Solo aparece si la contraseña pudo guardarse durante el aprovisionamiento.
                                        </p>
                                    )}
                                </div>

                                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Login</p>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-all">
                                        {loadingChatwootAccess ? "Cargando..." : (chatwootHeaderLoginUrl || "No disponible")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isGhlMode && showGhlAccessModal && (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setShowGhlAccessModal(false)}
                    >
                        <div
                            className="w-full max-w-lg rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Info de acceso GoHighLevel</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Datos de referencia para abrir la subcuenta desde el portal de GHL.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowGhlAccessModal(false)}
                                    className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition text-gray-400 hover:text-gray-600"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Email del negocio</p>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-all">
                                        {loadingGhlAccess ? "Cargando..." : (ghlHeaderBusinessEmail || "No disponible")}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Teléfono</p>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-all">
                                        {loadingGhlAccess ? "Cargando..." : (ghlHeaderBusinessPhone || "No disponible")}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Location ID</p>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-all">
                                            {loadingGhlAccess ? "Cargando..." : (ghlHeaderLocationId || "No disponible")}
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Company ID</p>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-all">
                                            {loadingGhlAccess ? "Cargando..." : (ghlHeaderCompanyId || "No disponible")}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Portal</p>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-all">
                                        {loadingGhlAccess ? "Cargando..." : (ghlHeaderPortalUrl || "No disponible")}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Acceso directo</p>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-all">
                                        {loadingGhlAccess ? "Cargando..." : (ghlHeaderDashboardUrl || "No disponible")}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        {ghlOAuthConnected
                                            ? "La subcuenta tiene tokens OAuth guardados en Waflow."
                                            : "Waflow no guarda contraseñas de GHL; el acceso depende del usuario con permisos en esa subcuenta."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50 dark:bg-black/20">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-[0.18em] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                    {isGhlMode ? "GOHIGHLEVEL" : managedInboxBrandName.toUpperCase()}
                                </span>
                                {isGhlMode && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => window.open(ghlHeaderOpenUrl, '_blank', 'noopener,noreferrer')}
                                            disabled={!ghlHeaderOpenUrl}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition"
                                        >
                                            <Link2 size={16} />
                                            Abrir Login
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowGhlAccessModal(true)}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                                        >
                                            <User size={16} />
                                            Info
                                        </button>
                                    </>
                                )}
                                {isChatwootMode && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => window.open(chatwootHeaderLoginUrl, '_blank', 'noopener,noreferrer')}
                                            disabled={!chatwootHeaderLoginUrl}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition"
                                        >
                                            <Link2 size={16} />
                                            Abrir Login
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowChatwootAccessModal(true)}
                                            disabled={loadingChatwootAccess}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition"
                                        >
                                            <User size={16} />
                                            Info
                                        </button>
                                    </>
                                )}
                            </div>

                            {canWhiteLabel && !isChatwootMode && (
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
                        </div>
                        <div className="flex justify-end gap-3 flex-wrap">
                            <button onClick={handleAddSlot} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition transform hover:-translate-y-0.5 active:scale-95">
                                <Plus size={18} /> {isChatwootMode ? (t('slots.chatwoot_inbox.new') || "Nuevo Inbox") : t('slots.new')}
                            </button>
                        </div>
                    </div>

                    {healthSummary && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">{t('agency.reliability.online_slots') || 'Slots en línea'}</p>
                                <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                                    {healthSummary.connected_slots || 0}/{healthSummary.total_slots || 0}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">{t('agency.reliability.sent_24h') || 'Enviados 24h'}</p>
                                <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                                    {healthSummary.sent_24h || 0}
                                </p>
                            </div>
                        </div>
                    )}

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
                                const slotSettings = slot.settings || {};
                                const officialSlotSettings = (slotSettings.official_api && typeof slotSettings.official_api === 'object')
                                    ? slotSettings.official_api
                                    : {};
                                const connectionMode = getEffectiveSlotConnectionMode(slot);
                                const isOfficialSlotMode = connectionMode === 'official_api';
                                const officialStatus = String(officialSlotSettings.status || '').trim().toLowerCase();
                                const isOfficialConnected = isOfficialSlotMode && ['verified', 'active', 'connected'].includes(officialStatus);
                                const isConnected = isOfficialSlotMode ? isOfficialConnected : slot.is_connected === true;
                                const connectedPhone = isOfficialSlotMode
                                    ? String(officialSlotSettings.displayPhoneNumber || slot.phone_number || '').trim()
                                    : (isConnected ? (slot.phone_number || "") : "");
                                const currentPrio = slot.priority || 99;
                                const settings = slotSettings;
                                const slotHealth = slot.health || {};
                                const slotSent24h = Number(slotHealth.sent_24h || 0);
                                const slotHeaderModeLabel = isOfficialSlotMode
                                    ? (t('slots.card.official_mode') || 'Meta API')
                                    : (isExpanded ? t('slots.card.managing') : t('slots.card.manage'));

                                return (
                                    <div id={`slot-card-${slot.slot_id}`} key={slot.slot_id} className={`bg-white dark:bg-gray-900 border rounded-2xl transition-all duration-300 overflow-hidden ${isExpanded ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-xl' : 'border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md'}`}>

                                        {/* CABECERA SLOT */}
                                        <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleExpandSlot(slot.slot_id)}>
                                            <div className="flex items-center gap-5">
                                                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="font-bold text-gray-900 dark:text-white text-xl">{slot.slot_name || (isChatwootMode ? `Inbox ${slot.slot_id}` : `Dispositivo ${slot.slot_id}`)}</h3>
                                                        <div className="flex gap-1">
                                                            {connectionMode && !isOfficialSlotMode && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(slot.slot_id, slot.is_favorite); }}
                                                                    className={`p-1.5 rounded-lg transition ${slot.is_favorite ? 'text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : 'text-gray-300 hover:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                                                    title="Favorito"
                                                                >
                                                                    <Star size={18} fill={slot.is_favorite ? "currentColor" : "none"} />
                                                                </button>
                                                            )}
                                                            {SLOT_CONNECTION_MODE_CHANGE_ENABLED && OFFICIAL_WHATSAPP_API_UI_ENABLED && connectionMode && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        requestSlotConnectionModeChange(slot);
                                                                    }}
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300 dark:hover:bg-sky-900/35 transition text-xs font-semibold"
                                                                    title={t('slots.connection_mode.change') || 'Cambiar conexión'}
                                                                >
                                                                    <Link2 size={14} />
                                                                    <span>{t('slots.connection_mode.change') || 'Cambiar conexión'}</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); editSlotName(slot.slot_id, slot.slot_name); }}
                                                                className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1 flex items-center gap-2">
                                                        {isConnected && connectedPhone
                                                            ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{connectedPhone}</span>
                                                            : isOfficialSlotMode && officialStatus && officialStatus !== 'draft'
                                                                ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">{t('slots.card.official_verified') || 'Meta API validada'}</span>
                                                            : t('slots.card.disconnected')}
                                                        {isGhlMode && !isOfficialSlotMode && (
                                                            <>
                                                                <span className="text-gray-300 dark:text-gray-600">•</span>
                                                                <span>{t('slots.card.priority')}: {currentPrio}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                                                            {(t('agency.reliability.sent_24h') || 'Enviados 24h')}: {slotSent24h}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                    {slotHeaderModeLabel}
                                                </span>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteSlot(slot.slot_id); }} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition" disabled={deletingSlotId === slot.slot_id}>
                                                    {deletingSlotId === slot.slot_id ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* CONTENIDO EXPANDIBLE */}
                                        {isExpanded && (
                                            <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-black/20 animate-in slide-in-from-top-2">
                                                {connectionMode === null ? (
                                                    <div className="p-8">
                                                        {renderConnectionModeSelector(slot)}
                                                    </div>
                                                ) : connectionMode === 'official_api' ? (
                                                    <div className="p-8">
                                                        {renderOfficialWhatsappPanel(slot)}
                                                    </div>
                                                ) : (
                                                    <>
                                                {/* TABS */}
                                                <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800 px-6 pt-3 bg-slate-50/90 dark:bg-gray-950/50">
                                                    <TabButton active={activeSlotTab === 'general'} onClick={() => setActiveSlotTab('general')} icon={<Settings size={16} />} label={t('slots.tab.general')} />
                                                    <TabButton active={activeSlotTab === 'integration'} onClick={() => setActiveSlotTab('integration')} icon={<Link2 size={16} />} label={t('slots.tab.integration')} />
                                                    {supportsSmsTab && (
                                                        <TabButton active={activeSlotTab === 'sms'} onClick={() => setActiveSlotTab('sms')} icon={<Smartphone size={16} />} label={t('slots.tab.sms')} />
                                                    )}
                                                    {supportsKeywordsTab && (
                                                        <TabButton active={activeSlotTab === 'keywords'} onClick={() => setActiveSlotTab('keywords')} icon={<MessageSquare size={16} />} label={t('slots.tab.keywords')} />
                                                    )}
                                                    <TabButton active={activeSlotTab === 'groups'} onClick={() => { if (!isConnected) return toast.warning("Conecta WhatsApp primero."); setActiveSlotTab('groups'); loadGroups(slot.slot_id); }} icon={<Users size={16} />} label={t('slots.tab.groups')} disabled={!isConnected} />
                                                    <TabButton active={activeSlotTab === 'qr'} onClick={() => setActiveSlotTab('qr')} icon={<QrCode size={16} />} label={t('slots.tab.connection') || "Conexión"} />
                                                </div>

                                                <div className="p-8">
                                                    {/* CONFIG PANELS */}
                                                    {activeSlotTab === 'general' && (
                                                        <div className="max-w-2xl">
                                                            {isGhlMode && (
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
                                                            )}
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
                                                    {activeSlotTab === 'integration' && (
                                                        <div className="max-w-2xl space-y-6">
                                                            {isGhlMode && (
                                                                <>
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
                                                                                        if (confirm("¿Borrar API Key de este número?")) {
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

                                                                    {!isChatwootMode && (
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
                                                                    )}
                                                                    {(() => {
                                                                        const customProxy = customProxyBySlot[slot.slot_id] || createEmptyCustomProxyState();
                                                                        const isLoadingCustomProxy = !!loadingCustomProxyBySlot[slot.slot_id];
                                                                        const isSavingCustomProxy = !!savingCustomProxyBySlot[slot.slot_id];

                                                                        return (
                                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
                                                                                <div className="flex flex-wrap items-start justify-between gap-4">
                                                                                    <div>
                                                                                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('slots.proxy.title')}</h4>
                                                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('slots.proxy.desc')}</p>
                                                                                    </div>
                                                                                    <div className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${customProxy.configured ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                                                        {customProxy.configured ? t('slots.proxy.configured') : t('slots.proxy.not_configured')}
                                                                                    </div>
                                                                                </div>

                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                                    <div>
                                                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.proxy.host')}</label>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={customProxy.host || ""}
                                                                                            onChange={(e) => updateCustomProxyField(slot.slot_id, "host", e.target.value)}
                                                                                            placeholder={t('slots.proxy.ph_host')}
                                                                                            autoComplete="off"
                                                                                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                                                        />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.proxy.port')}</label>
                                                                                        <input
                                                                                            type="number"
                                                                                            value={customProxy.port || ""}
                                                                                            onChange={(e) => updateCustomProxyField(slot.slot_id, "port", e.target.value)}
                                                                                            placeholder={t('slots.proxy.ph_port')}
                                                                                            autoComplete="off"
                                                                                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                                                        />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.proxy.username')}</label>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={customProxy.username || ""}
                                                                                            onChange={(e) => updateCustomProxyField(slot.slot_id, "username", e.target.value)}
                                                                                            placeholder={t('slots.proxy.ph_username')}
                                                                                            autoComplete="off"
                                                                                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                                                        />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.proxy.password')}</label>
                                                                                        <input
                                                                                            type="password"
                                                                                            value={customProxy.password || ""}
                                                                                            onChange={(e) => updateCustomProxyField(slot.slot_id, "password", e.target.value)}
                                                                                            placeholder={customProxy.passwordMasked || t('slots.proxy.ph_password')}
                                                                                            autoComplete="new-password"
                                                                                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                                                        />
                                                                                    </div>
                                                                                </div>

                                                                                <div>
                                                                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.proxy.protocol')}</label>
                                                                                    <select
                                                                                        value={customProxy.protocol || "http"}
                                                                                        onChange={(e) => updateCustomProxyField(slot.slot_id, "protocol", e.target.value)}
                                                                                        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                                                    >
                                                                                        <option value="http">http</option>
                                                                                        <option value="socks5">socks5</option>
                                                                                    </select>
                                                                                </div>

                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                    <button
                                                                                        onClick={() => saveCustomProxyConfig(slot.slot_id)}
                                                                                        disabled={isLoadingCustomProxy || isSavingCustomProxy}
                                                                                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2"
                                                                                    >
                                                                                        {isSavingCustomProxy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                                                                        {t('slots.proxy.save')}
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => clearCustomProxyConfig(slot.slot_id)}
                                                                                        disabled={isLoadingCustomProxy || isSavingCustomProxy || !customProxy.configured}
                                                                                        className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 transition"
                                                                                    >
                                                                                        {t('slots.proxy.clear')}
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => loadCustomProxyConfig(slot.slot_id, true)}
                                                                                        disabled={isLoadingCustomProxy || isSavingCustomProxy}
                                                                                        className="px-3 py-2 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition"
                                                                                        title={t('slots.proxy.reload')}
                                                                                    >
                                                                                        <RefreshCw size={16} className={isLoadingCustomProxy ? "animate-spin" : ""} />
                                                                                    </button>
                                                                                </div>

                                                                                <p className="text-xs text-gray-500 dark:text-gray-400">{t('slots.proxy.apply_note')}</p>
                                                                                {customProxy.invalidConfig && (
                                                                                    <p className="text-xs text-amber-600 dark:text-amber-400">{t('slots.proxy.invalid')}</p>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </>
                                                            )}
                                                            {isChatwootMode && (() => {
                                                                const chatwoot = chatwootConfigBySlot[slot.slot_id] || createEmptyChatwootState();
                                                                const isLoadingChatwoot = !!loadingChatwootBySlot[slot.slot_id];
                                                                const isSavingChatwoot = !!savingChatwootBySlot[slot.slot_id];
                                                                const mappedInboxId = slot.chatwoot_inbox_id || chatwoot.inboxId || null;
                                                                const showAdvancedChatwootDetails = !!chatwoot.showAdvancedDetails;
                                                                const isReadOnlyChatwootView = !showAdvancedChatwootDetails;
                                                                const chatwootAccessCard = null;

                                                                if (isReadOnlyChatwootView) {
                                                                    return (
                                                                        <div className="space-y-4">
                                                                            {chatwootAccessCard}
                                                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                                                                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-100 dark:border-emerald-800 text-sm flex items-start gap-3">
                                                                                <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
                                                                                <div>
                                                                                    <p className="font-bold">{t('slots.chatwoot.auto_provision_title') || "Aprovisionamiento Automático"}</p>
                                                                                    <p className="text-xs opacity-90 mt-1">
                                                                                        {getManagedInboxText(t('slots.chatwoot.auto_provision_desc'), "Las credenciales de Chatwoot (URL, Token, Account ID y Webhooks) se gestionan internamente para esta cuenta.")}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                                                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('slots.chatwoot.dashboard_apps_title') || "Apps del panel"}</p>
                                                                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{getManagedInboxText(t('slots.chatwoot.dashboard_apps_desc'), "Conversation Hub se publica automáticamente. Las pestañas legacy se limpian en la siguiente sincronización.")}</p>
                                                                                </div>
                                                                                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('slots.chatwoot.custom_attrs_title') || "Atributos sincronizados"}</p>
                                                                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{t('slots.chatwoot.custom_attrs_desc') || "Se actualizan slot, tipo de chat, grupo, origen del lead y último preview del contacto."}</p>
                                                                                </div>
                                                                                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('slots.chatwoot.csat_title') || "CSAT automático"}</p>
                                                                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                                                                        {chatwoot.csatEnabled
                                                                                            ? (t('slots.chatwoot.csat_enabled_summary') || "Activo al resolver conversaciones directas.")
                                                                                            : (t('slots.chatwoot.csat_disabled_summary') || "Desactivado. Puedes activarlo en la configuración del slot.")}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="pt-1">
                                                                                <button
                                                                                    type="button"
                                                                                        onClick={() => updateChatwootField(slot.slot_id, "showAdvancedDetails", true)}
                                                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40 transition"
                                                                                    >
                                                                                        {t('slots.chatwoot.show_debug') || "Ver detalles técnicos"}
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }

                                                                const statusLabel = chatwoot.configured
                                                                    ? t('slots.chatwoot.configured')
                                                                    : chatwoot.hasGlobalConfig
                                                                        ? t('slots.chatwoot.global_only')
                                                                        : t('slots.chatwoot.not_configured');
                                                                const statusClass = chatwoot.configured
                                                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                                                                    : chatwoot.hasGlobalConfig
                                                                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'
                                                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300';
                                                                const inboxIdNumber = Number.parseInt(String(chatwoot.inboxId || ""), 10);
                                                                const hasInboxMapping = Number.isFinite(inboxIdNumber) && inboxIdNumber > 0;
                                                                const hasTypedSecret = Boolean((chatwoot.webhookSecret || "").trim());
                                                                const hasAnySecret = hasTypedSecret || chatwoot.hasWebhookSecret;
                                                                const webhookUrl = buildChatwootWebhookUrl(chatwoot.webhookSecret || "");
                                                                const stepGlobalReady = chatwoot.hasGlobalConfig;
                                                                const stepInboxReady = hasInboxMapping;
                                                                const stepWebhookReady = hasAnySecret;

                                                                return (
                                                                    <div className="space-y-4">
                                                                        {chatwootAccessCard}
                                                                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
                                                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                                                            <div>
                                                                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">{getManagedInboxText(t('slots.chatwoot.title'), "Chatwoot")}</h4>
                                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{getManagedInboxText(t('slots.chatwoot.desc'), "Configura Chatwoot para este numero. URL/token/cuenta son globales por location; Inbox ID es por slot.")}</p>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => updateChatwootField(slot.slot_id, "showAdvancedDetails", false)}
                                                                                    className="px-2 py-1 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition"
                                                                                >
                                                                                    {t('slots.chatwoot.hide_debug') || "Ocultar debug"}
                                                                                </button>
                                                                                <div className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${statusClass}`}>
                                                                                    {statusLabel}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                                            <div className={`rounded-lg border px-3 py-2 ${stepGlobalReady ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40'}`}>
                                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('slots.chatwoot.step1')}</p>
                                                                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-1">{t('slots.chatwoot.step1_desc')}</p>
                                                                            </div>
                                                                            <div className={`rounded-lg border px-3 py-2 ${stepInboxReady ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40'}`}>
                                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('slots.chatwoot.step2')}</p>
                                                                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-1">{t('slots.chatwoot.step2_desc')}</p>
                                                                            </div>
                                                                            <div className={`rounded-lg border px-3 py-2 ${stepWebhookReady ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40'}`}>
                                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('slots.chatwoot.step3')}</p>
                                                                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-1">{t('slots.chatwoot.step3_desc')}</p>
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            {tenantSettings.is_auto_provisioned ? (
                                                                                <div className="md:col-span-2 p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-800 text-sm flex items-center gap-3">
                                                                                    <CheckCircle2 className="shrink-0" size={18} />
                                                                                    <div>
                                                                                        <p className="font-bold">Aprovisionamiento Automático</p>
                                                                                        <p className="text-xs opacity-90">{getManagedInboxText("", "Las credenciales de Chatwoot (URL, Token y Account ID) se gestionan internamente para esta cuenta.")}</p>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    <div className="md:col-span-2">
                                                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.chatwoot.url')}</label>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={chatwoot.chatwootUrl || ""}
                                                                                            onChange={(e) => updateChatwootField(slot.slot_id, "chatwootUrl", e.target.value)}
                                                                                            placeholder={chatwoot.chatwootUrlMasked || t('slots.chatwoot.ph_url')}
                                                                                            autoComplete="off"
                                                                                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                                                        />
                                                                                    </div>

                                                                                    <div>
                                                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.chatwoot.api_token')}</label>
                                                                                        <input
                                                                                            type="password"
                                                                                            value={chatwoot.apiToken || ""}
                                                                                            onChange={(e) => updateChatwootField(slot.slot_id, "apiToken", e.target.value)}
                                                                                            placeholder={chatwoot.apiTokenMasked || t('slots.chatwoot.ph_token')}
                                                                                            autoComplete="new-password"
                                                                                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                                                                        />
                                                                                    </div>

                                                                                    <div>
                                                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.chatwoot.account_id')}</label>
                                                                                        <input
                                                                                            type="number"
                                                                                            min="1"
                                                                                            value={chatwoot.accountId || ""}
                                                                                            onChange={(e) => updateChatwootField(slot.slot_id, "accountId", e.target.value)}
                                                                                            placeholder={t('slots.chatwoot.ph_account_id')}
                                                                                            autoComplete="off"
                                                                                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                                                                        />
                                                                                    </div>
                                                                                </>
                                                                            )}

                                                                            <div>
                                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.chatwoot.inbox_id')}</label>
                                                                                {chatwootInboxes.length > 0 ? (
                                                                                    <select
                                                                                        value={chatwoot.inboxId || ""}
                                                                                        onChange={(e) => updateChatwootField(slot.slot_id, "inboxId", e.target.value)}
                                                                                        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm"
                                                                                    >
                                                                                        <option value="">{t('slots.chatwoot.select_inbox')}</option>
                                                                                        {chatwootInboxes.map((inbox) => (
                                                                                            <option key={inbox.id} value={String(inbox.id)}>
                                                                                                {inbox.name} (#{inbox.id}{inbox.phoneNumber ? ` - ${inbox.phoneNumber}` : ""})
                                                                                            </option>
                                                                                        ))}
                                                                                    </select>
                                                                                ) : (
                                                                                    <input
                                                                                        type="number"
                                                                                        min="1"
                                                                                        value={chatwoot.inboxId || ""}
                                                                                        onChange={(e) => updateChatwootField(slot.slot_id, "inboxId", e.target.value)}
                                                                                        placeholder={t('slots.chatwoot.ph_inbox_id')}
                                                                                        autoComplete="off"
                                                                                        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                                                                    />
                                                                                )}
                                                                                <div className="mt-2">
                                                                                    <button
                                                                                        onClick={() => loadChatwootInboxes(true)}
                                                                                        disabled={isLoadingChatwoot || isSavingChatwoot || loadingChatwootInboxes}
                                                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition disabled:opacity-60"
                                                                                    >
                                                                                        {loadingChatwootInboxes ? (t('slots.chatwoot.loading_inboxes')) : t('slots.chatwoot.load_inboxes')}
                                                                                    </button>
                                                                                </div>
                                                                            </div>

                                                                            <div className="md:col-span-2">
                                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.chatwoot.webhook_secret')}</label>
                                                                                <div className="flex flex-col md:flex-row gap-2">
                                                                                    <input
                                                                                        type="password"
                                                                                        value={chatwoot.webhookSecret || ""}
                                                                                        onChange={(e) => updateChatwootField(slot.slot_id, "webhookSecret", e.target.value)}
                                                                                        placeholder={chatwoot.hasWebhookSecret ? "********" : t('slots.chatwoot.ph_webhook_secret')}
                                                                                        autoComplete="new-password"
                                                                                        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                                                                    />
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => generateChatwootSecret(slot.slot_id)}
                                                                                        disabled={isLoadingChatwoot || isSavingChatwoot}
                                                                                        className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition disabled:opacity-60 text-sm font-semibold whitespace-nowrap"
                                                                                    >
                                                                                        {t('slots.chatwoot.generate_secret')}
                                                                                    </button>
                                                                                </div>
                                                                                {chatwoot.hasWebhookSecret && !hasTypedSecret && (
                                                                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{t('slots.chatwoot.secret_masked_hint')}</p>
                                                                                )}
                                                                            </div>

                                                                            <div className="md:col-span-2">
                                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.chatwoot.webhook_url')}</label>
                                                                                <div className="flex flex-col md:flex-row gap-2">
                                                                                    <input
                                                                                        type="text"
                                                                                        value={webhookUrl}
                                                                                        readOnly
                                                                                        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/60 dark:text-white outline-none transition font-mono text-xs"
                                                                                    />
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => copyToClipboard(webhookUrl, t('slots.chatwoot.webhook_copied'))}
                                                                                        className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition text-sm font-semibold flex items-center justify-center gap-1 whitespace-nowrap"
                                                                                    >
                                                                                        <Copy size={14} />
                                                                                        {t('slots.chatwoot.copy_webhook')}
                                                                                    </button>
                                                                                </div>
                                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{getManagedInboxText(t('slots.chatwoot.webhook_hint'), "Copia esta URL y configúrala en Chatwoot. Mantén el mismo secret en ambos lados.")}</p>
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3">
                                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('slots.chatwoot.dashboard_apps_title') || "Apps del panel"}</p>
                                                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-1">{getManagedInboxText(t('slots.chatwoot.dashboard_apps_desc'), "Conversation Hub se publica automáticamente. Las pestañas legacy se limpian en la siguiente sincronización.")}</p>
                                                                            </div>
                                                                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3">
                                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('slots.chatwoot.custom_attrs_title') || "Atributos sincronizados"}</p>
                                                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-1">{t('slots.chatwoot.custom_attrs_desc') || "Se actualizan slot, tipo de chat, grupo, origen del lead y último preview del contacto."}</p>
                                                                            </div>
                                                                        </div>

                                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{getManagedInboxText(t('slots.chatwoot.scope_note'), "Los campos globales aplican a toda la location. Inbox ID aplica solo a este numero (slot).")}</p>

                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <button
                                                                                onClick={() => validateChatwootConfigSlot(slot.slot_id)}
                                                                                disabled={isLoadingChatwoot || isSavingChatwoot}
                                                                                className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 transition flex items-center gap-2"
                                                                            >
                                                                                <CheckCircle2 size={16} />
                                                                                {t('slots.chatwoot.validate')}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => saveChatwootConfig(slot.slot_id)}
                                                                                disabled={isLoadingChatwoot || isSavingChatwoot}
                                                                                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2"
                                                                            >
                                                                                {isSavingChatwoot ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                                                                {t('slots.chatwoot.save')}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => clearChatwootSlotConfig(slot.slot_id)}
                                                                                disabled={isLoadingChatwoot || isSavingChatwoot || (!chatwoot.inboxId && !chatwoot.configured)}
                                                                                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 transition"
                                                                            >
                                                                                {t('slots.chatwoot.clear_slot')}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => loadChatwootConfig(slot.slot_id, true)}
                                                                                disabled={isLoadingChatwoot || isSavingChatwoot}
                                                                                className="px-3 py-2 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition"
                                                                                title={t('slots.chatwoot.reload')}
                                                                            >
                                                                                <RefreshCw size={16} className={isLoadingChatwoot ? "animate-spin" : ""} />
                                                                            </button>
                                                                        </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                            {isGhlMode && (
                                                                <>
                                                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.integration.tag_auto')}</label>
                                                                        <input type="text" placeholder={t('slots.integration.tag_auto_ph')} className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition" value={settings.crm_contact_tag ?? settings.ghl_contact_tag ?? ""} onChange={(e) => changeSlotSetting(slot.slot_id, 'crm_contact_tag', e.target.value, settings)} />
                                                                    </div>
                                                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{isChatwootMode ? "Agente Asignado" : t('slots.integration.user')}</label>
                                                                        <select className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={settings.crm_assigned_user ?? settings.ghl_assigned_user ?? ""} onChange={(e) => changeSlotSetting(slot.slot_id, 'crm_assigned_user', e.target.value, settings)}>
                                                                            <option value="">{t('slots.integration.user_none')}</option>
                                                                            {crmUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {isChatwootMode && (
                                                                <>
                                                                {(() => {
                                                                    const chatwoot = chatwootConfigBySlot[slot.slot_id] || createEmptyChatwootState();
                                                                    const isLoadingChatwoot = !!loadingChatwootBySlot[slot.slot_id];
                                                                    const isSavingChatwoot = !!savingChatwootBySlot[slot.slot_id];
                                                                    return (
                                                                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                            <div className="flex justify-between items-start mb-4 gap-4">
                                                                                <div>
                                                                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                                                                        <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded flex items-center justify-center">
                                                                                            <Star size={14} />
                                                                                        </div>
                                                                                        {t('slots.chatwoot.csat_title') || "CSAT automático"}
                                                                                    </label>
                                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                                        {t('slots.chatwoot.csat_desc') || "Envía una encuesta 1-5 cuando la conversación se marca como resuelta. Solo aplica a conversaciones directas."}
                                                                                    </p>
                                                                                </div>
                                                                                <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={Boolean(chatwoot.csatEnabled)}
                                                                                        onChange={(e) => updateChatwootField(slot.slot_id, "csatEnabled", e.target.checked)}
                                                                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                                                    />
                                                                                    <span>{chatwoot.csatEnabled ? (t('common.enabled') || "Activo") : (t('common.disabled') || "Inactivo")}</span>
                                                                                </label>
                                                                            </div>

                                                                            <div>
                                                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.chatwoot.csat_message') || "Mensaje de encuesta"}</label>
                                                                                <textarea
                                                                                    rows={4}
                                                                                    value={chatwoot.csatMessage || ""}
                                                                                    onChange={(e) => updateChatwootField(slot.slot_id, "csatMessage", e.target.value)}
                                                                                    placeholder={t('slots.chatwoot.csat_message_placeholder') || "Gracias por contactar con nuestro equipo. ¿Cómo calificarías la atención recibida del 1 al 5?"}
                                                                                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm"
                                                                                />
                                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('slots.chatwoot.csat_hint') || "El contacto debe responder con un número entre 1 y 5. El último valor queda visible dentro del dashboard app."}</p>
                                                                            </div>

                                                                            <div className="flex justify-end pt-1">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => saveChatwootConfig(slot.slot_id)}
                                                                                    disabled={isSavingChatwoot || isLoadingChatwoot}
                                                                                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2"
                                                                                >
                                                                                    <Save size={16} />
                                                                                    {isSavingChatwoot
                                                                                        ? (t('common.saving') || "Guardando...")
                                                                                        : (t('common.save') || "Guardar")}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}
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
                                                                                Configura una key única para este inbox. Dejar vacío para desactivar.
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
                                                                            name={`openai_key_chatwoot_${slot.slot_id}`}
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
                                                                                    if (confirm("¿Borrar API Key de este inbox?")) {
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
                                                                    <div className="flex justify-between items-start mb-4">
                                                                        <div>
                                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                                                                <div className="w-6 h-6 bg-sky-100 dark:bg-sky-900/30 text-sky-600 rounded flex items-center justify-center">
                                                                                    <Mic size={14} />
                                                                                </div>
                                                                                ElevenLabs API Key (Voces)
                                                                            </label>
                                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                                Configura una key única para este inbox. Dejar vacío para desactivar.
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
                                                                            name={`elevenlabs_key_chatwoot_${slot.slot_id}`}
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
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                    {supportsSmsTab && activeSlotTab === 'sms' && (
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
                                                                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('slots.sms.title')}</h4>
                                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                                    {t('slots.sms.desc')}
                                                                                </p>
                                                                            </div>
                                                                            <div className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${twilio.configured ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                                                {twilio.configured ? t('slots.sms.configured') : t('slots.sms.not_configured')}
                                                                            </div>
                                                                        </div>

                                                                        <div>
                                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.sms.account_sid')}</label>
                                                                            <input
                                                                                type="text"
                                                                                value={twilio.accountSid || ""}
                                                                                onChange={(e) => updateTwilioField(slot.slot_id, "accountSid", e.target.value)}
                                                                                placeholder={twilio.accountSidMasked || t('slots.sms.ph_sid')}
                                                                                autoComplete="off"
                                                                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                                                            />
                                                                        </div>

                                                                        <div>
                                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.sms.auth_token')}</label>
                                                                            <input
                                                                                type="password"
                                                                                value={twilio.authToken || ""}
                                                                                onChange={(e) => updateTwilioField(slot.slot_id, "authToken", e.target.value)}
                                                                                placeholder={twilio.authTokenMasked || t('slots.sms.ph_token')}
                                                                                autoComplete="new-password"
                                                                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-sm"
                                                                            />
                                                                        </div>

                                                                        <div>
                                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('slots.sms.phone_number')}</label>
                                                                            <input
                                                                                type="text"
                                                                                value={twilio.phoneNumber || ""}
                                                                                onChange={(e) => updateTwilioField(slot.slot_id, "phoneNumber", e.target.value)}
                                                                                placeholder={t('slots.sms.ph_phone')}
                                                                                autoComplete="off"
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
                                                                                {t('slots.sms.validate')}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => saveTwilioConfig(slot.slot_id)}
                                                                                disabled={isLoadingTwilio || isSavingTwilio}
                                                                                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2"
                                                                            >
                                                                                {isSavingTwilio ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                                                                {t('slots.sms.save')}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => clearTwilioConfig(slot.slot_id)}
                                                                                disabled={isLoadingTwilio || isSavingTwilio}
                                                                                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 transition"
                                                                            >
                                                                                {t('slots.sms.clear')}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => loadTwilioConfig(slot.slot_id, true)}
                                                                                disabled={isLoadingTwilio || isSavingTwilio}
                                                                                className="px-3 py-2 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition"
                                                                                title={t('slots.sms.reload')}
                                                                            >
                                                                                <RefreshCw size={16} className={isLoadingTwilio ? "animate-spin" : ""} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}

                                                    {supportsKeywordsTab && activeSlotTab === 'keywords' && (
                                                        <div className="max-w-2xl">
                                                            <form onSubmit={(e) => handleAddKeyword(e, slot.slot_id)} className="flex gap-3 mb-6">
                                                                <input name="keyword" required placeholder={t('slots.kw.input')} className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                                <input name="tag" required placeholder={t('slots.kw.tag')} className="w-1/3 p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                                                <button type="submit" className="bg-indigo-600 text-white px-5 rounded-xl hover:bg-indigo-700 font-bold"><Plus size={20} /></button>
                                                            </form>
                                                            <div className="space-y-2">
                                                                {keywords.filter(k => k.slot_id === slot.slot_id).map(k => (
                                                                    <div key={k.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                                                        <div className="flex gap-2 items-center"><span className="font-bold text-gray-800 dark:text-white">"{k.keyword}"</span> <span className="text-gray-400">&rarr;</span> <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded text-xs font-bold">{k.tag}</span></div>
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
                                                                groups.length === 0 ? (
                                                                    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-8 text-center">
                                                                        <p className="font-semibold text-gray-700 dark:text-gray-200">{t('slots.groups.empty')}</p>
                                                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('slots.groups.empty_help')}</p>
                                                                    </div>
                                                                ) : (
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
                                                                )
                                                            }
                                                        </div>
                                                    )}
                                                    {activeSlotTab === 'qr' && (
                                                        <SlotConnectionManager
                                                            slot={slot}
                                                            locationId={location.location_id}
                                                            token={token}
                                                            onUpdate={loadData}
                                                            isAdminMode={isAdminMode}
                                                        />
                                                    )}
                                                </div>
                                                    </>
                                                )}
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
    <button
        onClick={onClick}
        disabled={disabled}
        className={`-mb-px flex items-center gap-2 rounded-t-xl border px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all ${active
            ? 'border-gray-200 border-b-indigo-600 bg-white text-indigo-600 shadow-sm dark:border-gray-800 dark:border-b-indigo-400 dark:bg-gray-900 dark:text-indigo-300'
            : 'border-transparent bg-transparent text-gray-500 hover:border-gray-200 hover:bg-white/80 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-800 dark:hover:bg-gray-900/60 dark:hover:text-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
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
function SlotConnectionManager({ slot, locationId, token, onUpdate, isAdminMode = false }) {
    const { t } = useLanguage();
    const [status, setStatus] = useState({
        connected: slot?.is_connected === true,
        myNumber: slot?.phone_number || null
    });
    const [qr, setQr] = useState(null);
    const [qrUpdatedAt, setQrUpdatedAt] = useState(null);
    const [loading, setLoading] = useState(false);
    const [accountSuspensionState, setAccountSuspensionState] = useState(null);
    const [slotSuspendedBy, setSlotSuspendedBy] = useState(slot?.suspended_by || null);
    const [slotLockMessage, setSlotLockMessage] = useState(null);
    const [qrExpired, setQrExpired] = useState(false);
    const [shareUrl, setShareUrl] = useState("");
    const [isGeneratingShareUrl, setIsGeneratingShareUrl] = useState(false);
    const pollInterval = useRef(null);

    const authFetch = async (endpoint, options = {}) => {
        return fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: { ...options.headers, 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
    };

    const readAccessError = async (res) => {
        if (!res || res.status !== 403) return null;
        const data = await res.clone().json().catch(() => null);
        if (!data?.error) return null;

        if (data.error === 'account_suspended') {
            return {
                kind: 'account',
                status: data.suspension_status || 'suspended',
                message: data.message || 'Tu cuenta esta suspendida. No puedes vincular numeros en este momento.'
            };
        }

        if (data.error === 'slot_suspended') {
            return {
                kind: 'slot',
                status: data.suspended_by || 'system',
                message: data.message || 'Este slot esta temporalmente suspendido.'
            };
        }

        if (data.error === 'admin_lock') {
            return {
                kind: 'admin_lock',
                status: 'admin',
                message: data.message || 'Este slot fue suspendido por administracion y no puede reconectarse.'
            };
        }

        return null;
    };

    const stopPolling = () => {
        if (pollInterval.current) {
            clearTimeout(pollInterval.current);
            pollInterval.current = null;
        }
    };

    const isFreshQrTimestamp = (rawTimestamp) => {
        if (!rawTimestamp) return false;
        const parsed = new Date(rawTimestamp).getTime();
        if (!Number.isFinite(parsed)) return true;
        return (Date.now() - parsed) <= 25000;
    };

    const applyAccessError = (accessError) => {
        if (!accessError) return false;

        if (accessError.kind === 'account') {
            setAccountSuspensionState(accessError);
        }

        if (accessError.kind === 'slot' || accessError.kind === 'admin_lock') {
            setSlotSuspendedBy(accessError.status || 'system');
            setSlotLockMessage(accessError.message || null);
        }

        setLoading(false);
        setQr(null);
        setQrUpdatedAt(null);
        setQrExpired(false);
        stopPolling();
        return true;
    };

    const checkStatus = async () => {
        try {
            const res = await authFetch(`/agency/slots/${locationId}/${slot.slot_id}/status`);
            const accessError = await readAccessError(res);
            if (applyAccessError(accessError)) return;

            if (res.ok) {
                const data = await res.json();
                setAccountSuspensionState(null);
                setStatus({ connected: data.connected, myNumber: data.myNumber });
                setSlotSuspendedBy(data.suspended_by || null);
                if (!data.suspended_by) setSlotLockMessage(null);

                if (data.connected) {
                    setQr(null);
                    setQrUpdatedAt(null);
                    setLoading(false);
                    stopPolling();
                    onUpdate();
                }
            }
        } catch (e) { }
    };

    useEffect(() => {
        checkStatus();
        return () => stopPolling();
    }, [locationId, slot?.slot_id]);

    useEffect(() => {
        setShareUrl("");
        setIsGeneratingShareUrl(false);
        setQrExpired(false);
    }, [locationId, slot?.slot_id]);

    useEffect(() => {
        const nextConnected = slot?.is_connected === true;
        const nextNumber = slot?.phone_number || null;

        setStatus((current) => {
            const resolvedNumber = nextNumber || current.myNumber || null;
            if (current.connected === nextConnected && current.myNumber === resolvedNumber) {
                return current;
            }
            return {
                connected: nextConnected,
                myNumber: resolvedNumber
            };
        });

        setSlotSuspendedBy(slot?.suspended_by || null);

        if (nextConnected) {
            setQr(null);
            setQrUpdatedAt(null);
            setQrExpired(false);
            setLoading(false);
            stopPolling();
        }
    }, [slot?.slot_id, slot?.is_connected, slot?.phone_number, slot?.suspended_by]);

    const handleConnect = async () => {
        if (!isAdminMode && (slotSuspendedBy === 'admin' || slotSuspendedBy === 'system')) {
            toast.error('Este slot esta bloqueado temporalmente');
            return;
        }

        setLoading(true);
        setQrExpired(false);
        setQr(null);
        setQrUpdatedAt(null);
        try {
            const res = await authFetch(`/agency/slots/${locationId}/${slot.slot_id}/start`, { method: 'POST' });
            const accessError = await readAccessError(res);
            if (applyAccessError(accessError)) return;

            if (!res.ok) throw new Error('Fallo al iniciar');

            setAccountSuspensionState(null);
            stopPolling();
            let sawFreshQr = false;

            const pollStep = async () => {
                try {
                    const qrRes = await authFetch(`/agency/slots/${locationId}/${slot.slot_id}/qr`);
                    const qrError = await readAccessError(qrRes);
                    if (applyAccessError(qrError)) return;

                    if (qrRes.ok) {
                        const data = await qrRes.json();
                        const nextQrUpdatedAt = data.qrUpdatedAt || null;
                        const nextQr = data.qr && isFreshQrTimestamp(nextQrUpdatedAt)
                            ? data.qr
                            : null;
                        setQrUpdatedAt(nextQrUpdatedAt);
                        setQr(nextQr);
                        if (nextQr) {
                            sawFreshQr = true;
                        } else if (!data.connected && sawFreshQr) {
                            setLoading(false);
                            setQrExpired(true);
                            stopPolling();
                            return;
                        }
                        if (data.connected) {
                            checkStatus();
                            return; // Stop polling, checkStatus will clear the rest
                        }
                    }
                } catch (e) { }

                // Adaptive delay: 3s
                pollInterval.current = setTimeout(pollStep, 3000);
            };

            pollStep();
        } catch (e) {
            toast.error('Error iniciando conexion');
            setLoading(false);
        }
    };

    const handleSoftDisconnect = async (skipConfirm = false) => {
        if (!skipConfirm) {
            confirmToast(
                'Pausar dispositivo',
                'Pausar este dispositivo sin borrar la sesion?',
                () => handleSoftDisconnect(true)
            );
            return;
        }
        if (!skipConfirm && !confirm('Pausar este dispositivo sin borrar la sesion?')) return;
        setLoading(true);
        try {
            const res = await authFetch(`/agency/slots/${locationId}/${slot.slot_id}/soft-disconnect`, { method: 'POST' });
            const accessError = await readAccessError(res);
            if (applyAccessError(accessError)) return;

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'No se pudo pausar');
            }

            const data = await res.json().catch(() => ({}));
            const newLock = data.suspended_by || (isAdminMode ? 'admin' : 'agency');

            setStatus({ connected: false, myNumber: status.myNumber || slot.phone_number || null });
            setSlotSuspendedBy(newLock);
            setSlotLockMessage(newLock === 'admin'
                ? 'Pausado por administracion. Solo admin puede reactivar.'
                : 'Pausado por ti. Puedes reconectar sin escanear QR.');
            setQrExpired(false);
            setQr(null);
            setQrUpdatedAt(null);
            stopPolling();
            onUpdate();
            toast.success('Slot pausado');
        } catch (e) {
            toast.error(e.message || 'Error pausando slot');
        }
        setLoading(false);
    };

    const handleReconnect = async () => {
        if (!isAdminMode && (slotSuspendedBy === 'admin' || slotSuspendedBy === 'system')) {
            toast.error('Este slot esta bloqueado temporalmente');
            return;
        }

        if (accountSuspensionState) {
            toast.error('No puedes reconectar mientras tu cuenta este en gracia o suspendida');
            return;
        }

        setLoading(true);
        try {
            const res = await authFetch(`/agency/slots/${locationId}/${slot.slot_id}/reconnect`, { method: 'POST' });
            const accessError = await readAccessError(res);
            if (applyAccessError(accessError)) return;

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'No se pudo reconectar');
            }

            setSlotSuspendedBy(null);
            setSlotLockMessage(null);
            setAccountSuspensionState(null);
            setQrExpired(false);
            setQr(null);
            setQrUpdatedAt(null);
            toast.success('Reconectando...');

            stopPolling();

            const reconnectPollStep = async () => {
                await checkStatus();
                // If it successfully connected, checkStatus handles stopPolling.
                // Otherwise, keep checking status every 4 seconds.
                if (pollInterval.current) {
                    pollInterval.current = setTimeout(reconnectPollStep, 4000);
                }
            };

            pollInterval.current = setTimeout(reconnectPollStep, 4000);
            setLoading(false);
        } catch (e) {
            toast.error(e.message || 'Error reconectando slot');
            setLoading(false);
        }
    };

    const handleDisconnect = async (skipConfirm = false) => {
        if (!skipConfirm) {
            confirmToast(
                'Desconectar dispositivo',
                'Desconectar este dispositivo?',
                () => handleDisconnect(true),
                true
            );
            return;
        }
        if (!skipConfirm && !confirm('Desconectar este dispositivo?')) return;
        setLoading(true);
        try {
            const res = await authFetch(`/agency/slots/${locationId}/${slot.slot_id}/disconnect`, { method: 'DELETE' });
            const accessError = await readAccessError(res);
            if (applyAccessError(accessError)) return;

            if (!res.ok) throw new Error('Error desconectando');

            setStatus({ connected: false, myNumber: null });
            setSlotSuspendedBy(null);
            setSlotLockMessage(null);
            setQrExpired(false);
            setQr(null);
            setQrUpdatedAt(null);
            stopPolling();
            onUpdate();
            toast.success('Desconectado');
        } catch (e) {
            toast.error('Error desconectando');
        }
        setLoading(false);
    };

    const handleGenerateShareUrl = async () => {
        setIsGeneratingShareUrl(true);
        try {
            const res = await authFetch(`/agency/slots/${locationId}/${slot.slot_id}/qr-share-link`, { method: 'POST' });
            const accessError = await readAccessError(res);
            if (applyAccessError(accessError)) return;
            if (!res?.ok) {
                const err = await res?.json().catch(() => ({}));
                throw new Error(err?.error || 'No se pudo generar la URL QR');
            }

            const data = await res.json().catch(() => ({}));
            if (!data?.shareUrl) throw new Error('No se pudo generar la URL QR');

            setShareUrl(data.shareUrl);
            try {
                await navigator.clipboard.writeText(data.shareUrl);
                toast.success(t('slots.share.link_ready') || 'URL QR generada', {
                    description: t('slots.share.link_ready_slot_desc') || 'Tu cliente podrá abrirla y generar manualmente el QR de este slot cuando lo necesite.'
                });
            } catch (_) {
                toast.success(t('slots.share.link_ready') || 'URL QR generada', {
                    description: t('slots.share.copy_hint') || 'Copia la URL desde el campo para compartirla con tu cliente.'
                });
            }
        } catch (e) {
            toast.error(t('slots.share.error') || 'No se pudo generar el enlace QR', {
                description: e.message || undefined
            });
        } finally {
            setIsGeneratingShareUrl(false);
        }
    };

    const headerTitle = slotSuspendedBy === 'admin'
        ? 'Suspendido por Admin'
        : slotSuspendedBy === 'system'
            ? 'Suspendido por Sistema'
            : slotSuspendedBy === 'agency'
                ? 'Slot Pausado'
                : status.connected
                    ? 'Dispositivo Conectado'
                    : 'Vincular WhatsApp';

    const headerDescription = slotSuspendedBy === 'admin'
        ? 'Este slot esta bloqueado por administracion.'
        : slotSuspendedBy === 'system'
            ? 'Este slot esta bloqueado temporalmente por el sistema.'
            : slotSuspendedBy === 'agency'
                ? `Numero: +${status.myNumber || slot.phone_number || 'N/A'}`
                : status.connected
                    ? `Numero: +${status.myNumber}`
                    : 'Escanea el codigo QR para conectar.';

    return (
        <div className="max-w-2xl bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center">
            <div className="flex items-center gap-4 mb-6">
                <div className={`p-4 rounded-full ${status.connected ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-gray-100 text-gray-400 dark:bg-gray-700'}`}>
                    {status.connected ? <Smartphone size={32} /> : <QrCode size={32} />}
                </div>
                <div className="text-center md:text-left">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{headerTitle}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{headerDescription}</p>
                </div>
            </div>

            {accountSuspensionState && (
                <div className="w-full mb-5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
                    <div className="flex items-start gap-2">
                        <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                Cuenta en suspension ({accountSuspensionState.status})
                            </p>
                            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                                {accountSuspensionState.message}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {slotSuspendedBy === 'admin' && (
                <div className="w-full mb-5 rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 p-4">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Bloqueado por administracion</p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">{slotLockMessage || 'Contacta soporte para habilitar este slot.'}</p>
                </div>
            )}

            {slotSuspendedBy === 'agency' && (
                <div className="w-full mb-5 rounded-xl border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 p-4">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Pausado por ti</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">{slotLockMessage || 'Puedes reconectar sin QR.'}</p>
                </div>
            )}

            {slotSuspendedBy === 'system' && (
                <div className="w-full mb-5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Bloqueado por sistema</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{slotLockMessage || 'Debes regularizar el estado de la cuenta para reactivar este slot.'}</p>
                </div>
            )}

            {accountSuspensionState ? (
                <div className="w-full flex justify-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Reconexion bloqueada mientras la cuenta este en gracia o suspendida.
                    </p>
                </div>
            ) : status.connected ? (
                <div className="w-full flex flex-col sm:flex-row gap-3 justify-center">
                    <button onClick={handleSoftDisconnect} disabled={loading} className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition flex items-center justify-center gap-2 disabled:opacity-60">
                        <Power size={18} /> Pausar
                    </button>
                    <button onClick={handleDisconnect} disabled={loading} className="border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20 px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-60">
                        <Power size={18} /> Desconectar
                    </button>
                </div>
            ) : slotSuspendedBy === 'agency' ? (
                <div className="w-full flex flex-col sm:flex-row gap-3 justify-center">
                    <button onClick={handleReconnect} disabled={loading} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-60">
                        <Play size={18} /> Reconectar
                    </button>
                    <button onClick={handleDisconnect} disabled={loading} className="border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20 px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-60">
                        <Power size={18} /> Desconectar
                    </button>
                </div>
            ) : (slotSuspendedBy === 'admin' || slotSuspendedBy === 'system') ? (
                <div className="w-full flex justify-center">
                    {isAdminMode ? (
                        <button onClick={handleReconnect} disabled={loading} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-60">
                            <Play size={18} /> Reactivar como Admin
                        </button>
                    ) : (
                        <p className="text-sm text-red-600 dark:text-red-400 font-semibold">
                            {slotSuspendedBy === 'admin' ? 'Reconectar bloqueado por Admin' : 'Reconectar bloqueado por Sistema'}
                        </p>
                    )}
                </div>
            ) : (
                <div className="w-full flex flex-col items-center">
                    {!qr && !loading && !accountSuspensionState && (
                        <div className="flex flex-col items-center gap-3">
                            {qrExpired && (
                                <p className="text-sm text-amber-700 dark:text-amber-300 text-center">
                                    El QR expiro. Pulsa de nuevo para generar uno nuevo.
                                </p>
                            )}
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <button onClick={handleConnect} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2">
                                    <QrCode size={20} /> Generar Codigo QR
                                </button>
                                <button
                                    onClick={handleGenerateShareUrl}
                                    disabled={isGeneratingShareUrl}
                                    className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:bg-gray-900 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-900/20 px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 disabled:opacity-60"
                                >
                                    {isGeneratingShareUrl ? <Loader2 className="animate-spin" size={18} /> : <Link2 size={18} />}
                                    {t('slots.share.generate_link') || "Generar URL QR"}
                                </button>
                            </div>
                        </div>
                    )}

                    {!accountSuspensionState && (qr || loading) && (
                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                            <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 dark:border-gray-600 mb-4">
                                {qr ? <QRCode value={qr} size={220} /> : <RefreshCw className="animate-spin text-indigo-500 w-12 h-12" />}
                            </div>
                            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4">
                                {qr
                                    ? '📷 Escanea con WhatsApp (Expira pronto)'
                                    : (slotSuspendedBy ? '🔄 Reconectando automáticamente...' : '⏳ Consiguiendo QR seguro...')
                                }
                            </p>
                            <button onClick={() => { setQr(null); setQrUpdatedAt(null); setLoading(false); stopPolling(); }} className="text-gray-400 hover:text-red-500 underline text-sm transition">Cancelar</button>
                        </div>
                    )}

                    {!qr && shareUrl && (
                        <div className="w-full mt-5 max-w-xl">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={shareUrl}
                                    className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 dark:text-white outline-none text-sm font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast.success(t('slots.share.copied') || 'URL QR copiada')).catch(() => toast.error(t('slots.chatwoot.copy_error') || 'No se pudo copiar'))}
                                    className="px-4 py-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 transition font-semibold flex items-center justify-center gap-2"
                                >
                                    <Copy size={16} />
                                    {t('slots.share.copy_link') || "Copiar URL"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}

