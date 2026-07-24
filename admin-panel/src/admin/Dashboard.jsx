import React, { useState, useEffect } from 'react';
import SupportManager from './SupportManager';
import LocationDetailsModal from './LocationDetailsModal';
import AdminTemplateVisibility from './AdminTemplateVisibility';
import ThemeToggle from '../components/ThemeToggle';
import { useBranding } from '../context/BrandingContext';
import { useLanguage } from '../context/LanguageContext'; // Added import
import { toast } from 'sonner'; 
import {
    Settings, Search, Palette,
    RefreshCw, Building2, Smartphone, CheckCircle2,
    ArrowLeft, LogOut, RotateCcw, Image as ImageIcon, Link, Users, Trash2,
    Clock, CalendarDays, Plus, AlertCircle, Save, X, AlertTriangle, FileText,
    ArrowUpDown, ChevronDown, Pin, Activity, Database, Filter, ShieldAlert
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

export default function AdminDashboard({ token, onLogout }) {
    const { t } = useLanguage(); // Initialize hook
    const {
        systemBranding,
        standaloneBranding,
        updateSystemBranding,
        updateStandaloneBranding,
        DEFAULT_BRANDING,
        DEFAULT_STANDALONE_BRANDING
    } = useBranding();
    const [view, setView] = useState('users');
    const [selectedAgency, setSelectedAgency] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [agencies, setAgencies] = useState([]);
    const [subaccounts, setSubaccounts] = useState([]);
    const [users, setUsers] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchDraft, setSearchDraft] = useState("");
    const [userSort, setUserSort] = useState({ key: 'name', direction: 'asc' });
    const [userStatusFilters, setUserStatusFilters] = useState({
        active: true,
        trial: true,
        adminFree: true,
        grace: true,
        suspended: false,
        inactive: false,
        other: true
    });
    const [showUserStatusFilters, setShowUserStatusFilters] = useState(false);
    const [pinnedUserIds, setPinnedUserIds] = useState(() => {
        try {
            const stored = localStorage.getItem('adminPinnedUserIds');
            const parsed = stored ? JSON.parse(stored) : [];
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch (error) {
            return [];
        }
    });
    const [masterOtp, setMasterOtp] = useState(null);
    const [masterOtpExpiresAt, setMasterOtpExpiresAt] = useState(null);
    const [masterOtpTick, setMasterOtpTick] = useState(Date.now());
    const [manualUserModal, setManualUserModal] = useState({ show: false, name: "", email: "", phone: "" });
    const [adminLogs, setAdminLogs] = useState([]);
    const [adminLogSummary, setAdminLogSummary] = useState({ total: 0, critical: 0, warning: 0, info: 0, bySource: {}, byType: {}, byCode: {} });
    const [adminLogOptions, setAdminLogOptions] = useState({ types: [] });
    const [adminLogsLoading, setAdminLogsLoading] = useState(false);
    const [showReviewedLogs, setShowReviewedLogs] = useState(false);
    const [numberHealth, setNumberHealth] = useState([]);
    const [numberHealthSummary, setNumberHealthSummary] = useState({ total: 0, stable: 0, attention: 0, unstable: 0, restricted: 0, connected: 0, recovering: 0, requiresQr: 0, offline: 0, historicalRestrictions: 0 });
    const [numberHealthLoading, setNumberHealthLoading] = useState(false);
    const [numberHealthQuery, setNumberHealthQuery] = useState('');
    const [numberHealthQueryDraft, setNumberHealthQueryDraft] = useState('');
    const [numberHealthStatus, setNumberHealthStatus] = useState('all');
    const [adminLogFilters, setAdminLogFilters] = useState({
        source: 'all',
        severity: 'actionable',
        type: '',
        code: '',
        query: '',
        hoursBack: '24'
    });
    const [adminLogQueryDraft, setAdminLogQueryDraft] = useState('');

    // Estado para modal de trial
    const [trialModal, setTrialModal] = useState({ show: false, userId: null, userName: '', currentEnd: null });
    const [trialDaysInput, setTrialDaysInput] = useState(0);

    // Estado para modal de bonus subcuentas
    const [bonusModal, setBonusModal] = useState({ show: false, userId: null, userName: '', currentBonus: 0, maxSubs: 0 });
    const [bonusInput, setBonusInput] = useState(0);
    // Estado para acceso gratuito manual: subcuentas y numeros definidos por admin
    const [manualEntitlementsModal, setManualEntitlementsModal] = useState({ show: false, userId: null, userName: '', maxSubagencies: 1, maxSlots: 5, enabled: false });
    const [manualEntitlementsInput, setManualEntitlementsInput] = useState({ maxSubagencies: 1, maxSlots: 5 });

    // Nuevo: estado para modal de confirmacion (reemplaza window.confirm)
    const [confirmModal, setConfirmModal] = useState({ 
        show: false, 
        title: "", 
        message: "", 
        action: null, 
        isDestructive: false 
    });

    // Fix favicon
    useEffect(() => {
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = systemBranding.faviconUrl || DEFAULT_BRANDING.faviconUrl;
        document.getElementsByTagName('head')[0].appendChild(link);
        document.title = "Panel Maestro | Admin"; 
    }, [systemBranding]);

    useEffect(() => {
        const id = setInterval(() => setMasterOtpTick(Date.now()), 60000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('adminPinnedUserIds', JSON.stringify(pinnedUserIds));
        } catch (error) {
            // Ignore localStorage write failures; pinning remains available in memory.
        }
    }, [pinnedUserIds]);

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
            const deduped = Array.isArray(data)
                ? Array.from(
                    data.reduce((map, item) => {
                        const key = String(item?.agency_id || "").trim() || String(item?.agency_name || "").trim();
                        if (!key) return map;
                        if (!map.has(key)) {
                            map.set(key, item);
                            return map;
                        }
                        const existing = map.get(key);
                        map.set(key, {
                            ...existing,
                            ...item,
                            agency_name: existing?.agency_name || item?.agency_name || key,
                            total_subaccounts: Math.max(Number(existing?.total_subaccounts || 0), Number(item?.total_subaccounts || 0)),
                            active_subaccounts: Math.max(Number(existing?.active_subaccounts || 0), Number(item?.active_subaccounts || 0))
                        });
                        return map;
                    }, new Map()).values()
                )
                : [];
            setAgencies(deduped);
        } catch (error) { console.error("Error agencias:", error); } finally { setLoading(false); }
    };

    const fetchSubaccounts = async (agencyId) => {
        setLoading(true);
        try {
            const safeId = encodeURIComponent(agencyId);
            const res = await authFetch(`/admin/tenants?agencyId=${safeId}`);
            const data = await res.json();
            const deduped = Array.isArray(data)
                ? Array.from(
                    data.reduce((map, item) => {
                        const key = String(item?.location_id || "").trim();
                        if (!key) return map;
                        if (!map.has(key)) {
                            map.set(key, item);
                        }
                        return map;
                    }, new Map()).values()
                )
                : [];
            setSubaccounts(deduped);
        } catch (error) { console.error("Error subcuentas:", error); } finally { setLoading(false); }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`/admin/users`);
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (error) { console.error("Error usuarios:", error); } finally { setLoading(false); }
    };

    const fetchAdminLogs = async () => {
        setAdminLogsLoading(true);
        try {
            const params = new URLSearchParams({
                limit: '250',
                hoursBack: adminLogFilters.hoursBack || '24'
            });
            if (adminLogFilters.source && adminLogFilters.source !== 'all') params.set('source', adminLogFilters.source);
            if (adminLogFilters.severity && adminLogFilters.severity !== 'all') params.set('severity', adminLogFilters.severity);
            if (adminLogFilters.type) params.set('type', adminLogFilters.type);
            if (adminLogFilters.code) params.set('code', adminLogFilters.code);
            if (adminLogFilters.query) params.set('query', adminLogFilters.query);
            if (showReviewedLogs) params.set('includeReviewed', 'true');

            const res = await authFetch(`/admin/logs?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "No se pudieron cargar los logs");

            setAdminLogs(Array.isArray(data.logs) ? data.logs : []);
            setAdminLogSummary(data.summary || { total: 0, critical: 0, warning: 0, info: 0, bySource: {}, byType: {}, byCode: {} });
            setAdminLogOptions(data.filterOptions || { types: [] });
        } catch (error) {
            console.error("Error logs:", error);
            toast.error(error.message || "Error cargando logs");
        } finally {
            setAdminLogsLoading(false);
        }
    };

    const updateLogReview = async (log, status) => {
        try {
            const res = await authFetch(`/admin/logs/${encodeURIComponent(log.source)}/${encodeURIComponent(log.id)}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el incidente');
            toast.success(status === 'resolved' ? 'Incidente cerrado manualmente.' : status === 'reviewed' ? 'Incidente marcado como revisado.' : 'Incidente reabierto.');
            fetchAdminLogs();
        } catch (error) {
            toast.error(error.message || 'No se pudo actualizar el incidente');
        }
    };

    const downloadAdminLogsCsv = async () => {
        try {
            const params = new URLSearchParams({ limit: '5000', export: 'true', hoursBack: adminLogFilters.hoursBack || '24' });
            if (adminLogFilters.source && adminLogFilters.source !== 'all') params.set('source', adminLogFilters.source);
            if (adminLogFilters.severity && adminLogFilters.severity !== 'all') params.set('severity', adminLogFilters.severity);
            if (adminLogFilters.type) params.set('type', adminLogFilters.type);
            if (adminLogFilters.code) params.set('code', adminLogFilters.code);
            if (adminLogFilters.query) params.set('query', adminLogFilters.query);
            if (showReviewedLogs) params.set('includeReviewed', 'true');

            const res = await authFetch(`/admin/logs?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudieron preparar los logs');
            const logs = Array.isArray(data.logs) ? data.logs : [];
            if (logs.length === 0) throw new Error('No hay logs para los filtros seleccionados');

            const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
            const formatParts = (value) => {
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return { date: '', time: '' };
                return { date: date.toLocaleDateString('sv-SE'), time: date.toLocaleTimeString('es-ES', { hour12: false }) };
            };
            const headers = ['fecha', 'hora', 'fuente', 'tipo', 'severidad', 'codigo', 'titulo', 'causa', 'target', 'sub_cuenta', 'numero', 'conexion', 'cat', 'servicio', 'impacto', 'accion', 'detalle', 'contexto', 'repeticiones', 'primera_vez', 'ultima_vez'];
            const rows = logs.map((log) => {
                const human = getHumanizedLog(log);
                const date = formatParts(log.created_at);
                const target = log.session_id || log.location_id || log.client_id || log.phone_number || 'global';
                return [date.date, date.time, getAdminLogSourceLabel(log.source), log.type, log.severity || log.level, log.code, human.title, human.cause, target, log.client_name || log.location_id || log.client_id, log.phone_number, log.session_id, log.category, log.service, human.impact, human.action, log.message || log.reason, formatMetadataPreview(log.metadata), log.occurrence_count || 1, log.first_seen_at, log.last_seen_at].map(quote).join(',');
            });
            const url = URL.createObjectURL(new Blob([`\uFEFF${[headers.join(','), ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8' }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `waflow-logs-${adminLogFilters.severity || 'all'}-${adminLogFilters.hoursBack || '24'}h.csv`;
            anchor.click();
            URL.revokeObjectURL(url);
            toast.success(`${logs.length} logs descargados en CSV.`);
        } catch (error) {
            toast.error(error.message || 'No se pudo descargar el CSV');
        }
    };

    const fetchNumberHealth = async (refresh = false) => {
        setNumberHealthLoading(true);
        try {
            const res = await authFetch(`/admin/number-health${refresh ? '?refresh=true' : ''}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo cargar la salud de los números');
            setNumberHealth(Array.isArray(data.numbers) ? data.numbers : []);
            setNumberHealthSummary(data.summary || { total: 0, stable: 0, attention: 0, unstable: 0, restricted: 0 });
        } catch (error) {
            console.error('Error salud de números:', error);
            toast.error(error.message || 'Error cargando la salud de números');
        } finally {
            setNumberHealthLoading(false);
        }
    };

    const fetchMasterOtp = async () => {
        try {
            const res = await authFetch(`/admin/master-otp`);
            if (res.ok) {
                const data = await res.json();
                setMasterOtp(data.otp || null);
                setMasterOtpExpiresAt(data.expiresAt || null);
            }
        } catch (error) { console.error("Error master OTP:", error); }
    };

    useEffect(() => {
        fetchMasterOtp();
    }, []);

    // --- ACCIONES ADMINISTRATIVAS (Ahora usan el Modal Custom) ---

    // Función auxiliar para abrir el modal
    const openConfirm = (title, message, action, isDestructive = false) => {
        setConfirmModal({ show: true, title, message, action, isDestructive });
    };
    const getActivePlansForUser = (user) => Array.isArray(user?.active_plans) ? user.active_plans : [];

    const buildActivePlanWarning = (activePlans) => {
        if (!activePlans.length) return '';
        const planLines = activePlans
            .map((plan) => `- ${plan.name || 'Plan activo'}${Number(plan.quantity || 0) > 1 ? ` x${plan.quantity}` : ''}`)
            .join('\n');
        return `\n\nATENCION: este usuario tiene plan activo vigente.\n${planLines}\n\nAl confirmar, WaFlow programara la cancelacion de esas suscripciones en Stripe y eliminara/desactivara el usuario.`;
    };

    const executeDeleteUser = async (userId, options = {}) => {
        try {
            const res = await authFetch(`/admin/users/${userId}`, {
                method: 'DELETE',
                body: JSON.stringify({ forceActivePlanDeletion: options.forceActivePlanDeletion === true })
            });
            if (res.ok) {
                toast.success(t('dash.users.soft_delete_success'));
                fetchUsers();
            } else {
                const data = await res.json();
                // Proteccion de planes
                if (data.error && data.error.includes("plan activo")) {
                    toast.error(t('dash.users.protected_plan'));
                } else {
                    toast.error(data.error || t('common.error'));
                }
            }
        } catch (error) { toast.error(t('sub.toast.error_connection')); }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const executeHardDeleteUser = async (userId, options = {}) => {
        const tId = toast.loading(t('agency.tenant.deleting'));
        try {
            const res = await authFetch(`/admin/users/${userId}/hard`, {
                method: 'DELETE',
                body: JSON.stringify({ forceActivePlanDeletion: options.forceActivePlanDeletion === true })
            });
            if (res.ok) {
                toast.success(t('dash.users.hard_delete_success'), { id: tId });
                fetchUsers();
            } else {
                const data = await res.json();
                if (data.error && data.error.includes("plan activo")) {
                    toast.error(t('dash.users.protected_plan'), { id: tId });
                } else {
                    toast.error(data.error || t('sub.toast.error_unknown'), { id: tId });
                }
            }
        } catch (error) { toast.error(t('sub.toast.error_connection'), { id: tId }); }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const executeReactivateUser = async (userId) => {
        try {
            const res = await authFetch(`/admin/users/${userId}/reactivate`, { method: 'PUT' });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                const status = data.plan_status ? String(data.plan_status).toUpperCase() : null;
                const trialEnds = data.trial_ends_at ? new Date(data.trial_ends_at).toLocaleDateString() : null;
                const suffix = status === 'TRIAL' && trialEnds ? ` (TRIAL hasta ${trialEnds})` : status ? ` (${status})` : '';
                toast.success(`${t('dash.users.reactivate_success')}${suffix}`);
                fetchUsers();
            } else {
                toast.error(data.error || t('common.error'));
            }
        } catch (error) { toast.error(t('sub.toast.error_connection')); }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const executeSoftDisconnectUser = async (userId) => {
        try {
            const res = await authFetch(`/admin/users/${userId}/soft-disconnect`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                const disconnected = Number(data.disconnected_slots || 0);
                const total = Number(data.total_slots || 0);
                toast.success(`Usuario inactivado en modo suave. Slots desconectados: ${disconnected}/${total}`);
                fetchUsers();
            } else {
                toast.error(data.error || 'No se pudo inactivar en modo suave');
            }
        } catch (error) {
            toast.error(t('sub.toast.error_connection'));
        }
        setConfirmModal({ ...confirmModal, show: false });
    };
    const executeSuspendUser = async (userId, reason = 'Manual admin action') => {
        try {
            const res = await authFetch(`/admin/users/${userId}/suspend`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                const affected = Number(data.disconnected_slots || 0);
                toast.success("Usuario suspendido. Slots pausados: " + affected);
                fetchUsers();
            } else {
                toast.error(data.error || 'No se pudo suspender');
            }
        } catch (error) {
            toast.error(t('sub.toast.error_connection'));
        }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const executeReactivateSuspension = async (userId) => {
        try {
            const res = await authFetch(`/admin/users/${userId}/reactivate`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                const attempts = Number(data.reconnect_attempts || 0);
                const status = data.plan_status ? String(data.plan_status).toUpperCase() : null;
                const trialEnds = data.trial_ends_at ? new Date(data.trial_ends_at).toLocaleDateString() : null;
                const statusSuffix = status === 'TRIAL' && trialEnds ? ` | Plan: TRIAL hasta ${trialEnds}` : status ? ` | Plan: ${status}` : '';
                toast.success(`Usuario reactivado. Reconexiones iniciadas: ${attempts}${statusSuffix}`);
                fetchUsers();
            } else {
                toast.error(data.error || 'No se pudo reactivar');
            }
        } catch (error) {
            toast.error(t('sub.toast.error_connection'));
        }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const handleImpersonateUser = async (user) => {
        if (!user?.id) return;
        if (user.role === 'admin') {
            toast.error("No puedes impersonar a otro admin.");
            return;
        }

        const tId = toast.loading("Ingresando como usuario...");
        try {
            const res = await authFetch(`/auth/impersonate`, {
                method: 'POST',
                body: JSON.stringify({ userId: user.id })
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                toast.error(data.error || "Error al impersonar usuario", { id: tId });
                return;
            }

            const previousRole = localStorage.getItem("userRole") || 'admin';
            const previousAgencyId = localStorage.getItem("agencyId");

            localStorage.setItem("admin_restore_token", token);
            localStorage.setItem("admin_restore_role", previousRole);
            if (previousAgencyId) localStorage.setItem("admin_restore_agencyId", previousAgencyId);

            localStorage.setItem("authToken", data.token);
            localStorage.setItem("userRole", data.user?.role || data.role || "agency");

            if (data.user?.agencyId) localStorage.setItem("agencyId", data.user.agencyId);
            else localStorage.removeItem("agencyId");

            if (data.user?.subscriptionStatus) {
                localStorage.setItem("subscriptionStatus", JSON.stringify(data.user.subscriptionStatus));
            } else if (data.subscriptionStatus) {
                localStorage.setItem("subscriptionStatus", JSON.stringify(data.subscriptionStatus));
            } else {
                localStorage.removeItem("subscriptionStatus");
            }

            if (data.user?.features) {
                localStorage.setItem("agencyFeatures", JSON.stringify(data.user.features));
            } else if (data.features) {
                localStorage.setItem("agencyFeatures", JSON.stringify(data.features));
            } else {
                localStorage.removeItem("agencyFeatures");
            }

            toast.success(`Ahora viendo como ${data.user?.email || user.email}`, { id: tId });
            window.location.href = "/";
        } catch (error) {
            toast.error("Error de conexión", { id: tId });
        }
    };

    const handleOpenManualUserModal = () => {
        setManualUserModal({ show: true, name: "", email: "", phone: "" });
    };

    const handleCreateManualUser = async () => {
        const email = manualUserModal.email?.trim();
        const name = manualUserModal.name?.trim();
        const phone = manualUserModal.phone?.trim();

        if (!email) {
            toast.warning("Email requerido");
            return;
        }

        const tId = toast.loading("Creando usuario...");
        try {
            const res = await authFetch(`/admin/users/manual`, {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    name: name || null,
                    phone: phone || null
                })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                toast.success("Usuario creado", { id: tId });
                setManualUserModal({ show: false, name: "", email: "", phone: "" });
                fetchUsers();
            } else {
                toast.error(data.error || "Error al crear usuario", { id: tId });
            }
        } catch (error) {
            toast.error("Error de conexión", { id: tId });
        }
    };
const handleDeleteUser = (user, type = 'soft') => {
        if (user.role === 'admin') {
            toast.error('No se puede desactivar ni destruir a un usuario admin.');
            return;
        }

        const activePlans = getActivePlansForUser(user);
        const activePlanWarning = buildActivePlanWarning(activePlans);
        const forceActivePlanDeletion = activePlans.length > 0;

        if (type === 'hard') {
             openConfirm(
                t('dash.users.hard_delete_title'),
                `${t('dash.users.hard_delete_msg').replace('{name}', user.name || user.email)}${activePlanWarning}`,
                () => executeHardDeleteUser(user.id, { forceActivePlanDeletion }),
                true
            );
        } else if (user.is_active === false) {
             openConfirm(
                t('dash.users.reactivate_title'),
                t('dash.users.reactivate_msg').replace('{name}', user.name || user.email),
                () => executeReactivateUser(user.id),
                false
            );
        } else {
            openConfirm(
                t('dash.users.soft_delete_title'),
                `${t('dash.users.soft_delete_msg').replace('{name}', user.name || 'Usuario')}${activePlanWarning}`,
                () => executeDeleteUser(user.id, { forceActivePlanDeletion }),
                true
            );
        }
    };

    const executeDeleteAgency = async (agencyId) => {
        const tId = toast.loading("Eliminando agencia y desconectando...");
        try {
            const res = await authFetch(`/admin/agencies/${agencyId}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success("Agencia eliminada correctamente", { id: tId });
                fetchAgencies(); 
            } else {
                const data = await res.json();
                toast.error(data.error || "Error al eliminar", { id: tId });
            }
        } catch (error) { toast.error("Error de conexión", { id: tId }); }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const handleDeleteAgency = (e, agencyId, agencyName) => {
        e.stopPropagation();
        openConfirm(
            "Eliminar Agencia",
            `PELIGRO: Eliminar la agencia "${agencyName || agencyId}"?\n\nEsto borrara TODAS sus subcuentas, desconectara los numeros de WhatsApp y desvinculara a los usuarios.`,
            () => executeDeleteAgency(agencyId),
            true
        );
    };

    // Guardar cambios del trial
    const handleSaveTrial = async () => {
        const { userId } = trialModal;
        const days = parseInt(trialDaysInput);

        if (!userId || isNaN(days) || days === 0) {
            return toast.warning("Ingresa una cantidad de días válida.");
        }

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
                fetchUsers(); 
            } else {
                toast.error(data.error || "Error actualizando trial");
            }
        } catch (e) {
            toast.error("Error de conexión");
        }
    };

    const calculatePreviewDate = () => {
        if (!trialModal.currentEnd) return new Date();
        let baseDate = new Date(trialModal.currentEnd);
        if (baseDate < new Date()) baseDate = new Date();
        const preview = new Date(baseDate);
        preview.setDate(preview.getDate() + parseInt(trialDaysInput || 0));
        return preview.toLocaleDateString();
    };

    // Guardar cambios del bonus subcuentas
    const handleSaveBonus = async () => {
        const { userId } = bonusModal;
        const bonus = parseInt(bonusInput);

        if (!userId || isNaN(bonus) || bonus < 0) {
            return toast.warning("Ingresa un número válido (>= 0).");
        }

        try {
            const res = await authFetch(`/admin/users/${userId}/bonus`, {
                method: 'PUT',
                body: JSON.stringify({ bonus })
            });
            const data = await res.json();
            
            if (res.ok) {
                toast.success(`Bonus actualizado a ${bonus} subcuentas extra.`);
                setBonusModal({ show: false, userId: null, userName: '', currentBonus: 0, maxSubs: 0 });
                fetchUsers(); 
            } else {
                toast.error(data.error || "Error actualizando bonus");
            }
        } catch (e) {
            toast.error("Error de conexión");
        }
    };

    const handleSaveManualEntitlements = async () => {
        const { userId } = manualEntitlementsModal;
        const maxSubagencies = parseInt(manualEntitlementsInput.maxSubagencies, 10);
        const maxSlots = parseInt(manualEntitlementsInput.maxSlots, 10);

        if (!userId || isNaN(maxSubagencies) || isNaN(maxSlots) || maxSubagencies < 1 || maxSlots < 1) {
            return toast.warning("Ingresa subcuentas y numeros validos (>= 1).");
        }

        const tId = toast.loading("Guardando acceso gratis...");
        try {
            const res = await authFetch(`/admin/users/${userId}/manual-entitlements`, {
                method: 'PUT',
                body: JSON.stringify({ enabled: true, maxSubagencies, maxSlots })
            });
            const data = await res.json();

            if (res.ok) {
                toast.success(`Acceso gratis activo: ${maxSubagencies} subcuentas y ${maxSlots} numeros.`, { id: tId });
                setManualEntitlementsModal({ show: false, userId: null, userName: '', maxSubagencies: 1, maxSlots: 5, enabled: false });
                fetchUsers();
            } else {
                toast.error(data.error || "Error actualizando acceso gratis", { id: tId });
            }
        } catch (e) {
            toast.error("Error de conexion", { id: tId });
        }
    };

    // Nuevo: logica para dar plan admin
    const executeGrantAdmin = async (userId) => {
        const tId = toast.loading("Aplicando Plan Admin...");
        try {
            const res = await authFetch(`/admin/users/${userId}/grant-admin`, { method: 'POST' });
            const data = await res.json();
            
            if (res.ok) {
                toast.success("Usuario actualizado a Admin Service.", { id: tId });
                fetchUsers();
            } else {
                toast.error(data.error || "Error al actualizar", { id: tId });
            }
        } catch (error) {
            toast.error("Error de conexión", { id: tId });
        }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const handleGrantAdmin = (userId, userName) => {
        openConfirm(
            "Otorgar Servicio Admin",
            `Deseas convertir a "${userName}" en Admin Service?\n\nBeneficios:\n- Tiempo ilimitado (Sin expiracion)\n- 50 Agencias permitidas\n- 99 Numeros WhatsApp`,
            () => executeGrantAdmin(userId),
            false // No es destructivo
        );
    };

    // Nuevo: eliminar subcuenta (tenant)
    const executeDeleteTenant = async (locationId) => {
        const tId = toast.loading("Eliminando subcuenta y desconectando...");
        try {
            const res = await authFetch(`/agency/tenants/${locationId}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success("Subcuenta eliminada correctamente", { id: tId });
                if (selectedAgency) fetchSubaccounts(selectedAgency.agency_id);
            } else {
                const data = await res.json();
                toast.error(data.error || "Error al eliminar", { id: tId });
            }
        } catch (error) { toast.error("Error de conexión", { id: tId }); }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const handleDeleteTenant = (locationId, name) => {
        openConfirm(
            "Eliminar Subcuenta",
            `PELIGRO: Eliminar la subcuenta "${name || locationId}"?\n\nEsto desconectara TODOS los numeros de WhatsApp asociados y eliminara la configuracion permanentemente.`,
            () => executeDeleteTenant(locationId),
            true
        );
    };

    // --- EFECTOS ---

    useEffect(() => {
        if (view === 'agencies') fetchAgencies();
        if (view === 'users') fetchUsers();
        if (view === 'numberHealth') fetchNumberHealth();
    }, [view]);

    useEffect(() => {
        if (view !== 'logs') return;
        const timer = setTimeout(() => fetchAdminLogs(), 250);
        return () => clearTimeout(timer);
    }, [view, adminLogFilters, showReviewedLogs]);

    useEffect(() => {
        const timer = setTimeout(() => setSearchTerm(searchDraft), 400);
        return () => clearTimeout(timer);
    }, [searchDraft]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setAdminLogFilters((current) => (
                current.query === adminLogQueryDraft
                    ? current
                    : { ...current, query: adminLogQueryDraft }
            ));
        }, 500);
        return () => clearTimeout(timer);
    }, [adminLogQueryDraft]);

    useEffect(() => {
        const timer = setTimeout(() => setNumberHealthQuery(numberHealthQueryDraft), 350);
        return () => clearTimeout(timer);
    }, [numberHealthQueryDraft]);

    const handleAgencyClick = (agency) => {
        setSelectedAgency(agency);
        setView('subaccounts');
        setSearchTerm("");
        setSearchDraft("");
        fetchSubaccounts(agency.agency_id);
    };

    const handleBackToAgencies = () => {
        setSelectedAgency(null);
        setView('agencies');
        setSearchTerm("");
        setSearchDraft("");
        setSubaccounts([]);
        fetchAgencies();
    };

    const filteredAgencies = agencies.filter(a => 
        (a.agency_id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.agency_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredSubaccounts = subaccounts.filter(s => 
        (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.location_id || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const userStatusFilterOptions = [
        { key: 'active', label: 'Con plan', description: 'Planes activos o plan_status ACTIVE' },
        { key: 'trial', label: 'Trial', description: 'Usuarios en periodo de prueba' },
        { key: 'adminFree', label: 'Gratis admin', description: 'Acceso manual gratuito' },
        { key: 'grace', label: 'Grace', description: 'Periodo de gracia' },
        { key: 'suspended', label: 'Suspendidos', description: 'Suspendidos o pending deletion' },
        { key: 'inactive', label: 'Inactivos', description: 'is_active=false' },
        { key: 'other', label: 'Otros', description: 'Estados no clasificados' }
    ];

    const getUserStatusCategory = (user) => {
        const suspensionStatus = String(user?.suspension_status || '').toLowerCase();
        const planStatus = String(user?.plan_status || '').toLowerCase();
        if (user?.is_active === false) return 'inactive';
        if (['suspended', 'pending_deletion', 'permanently_deleted'].includes(suspensionStatus)) return 'suspended';
        if (suspensionStatus === 'grace') return 'grace';
        if (user?.manual_entitlements_enabled === true) return 'adminFree';
        if (Array.isArray(user?.active_plans) && user.active_plans.length > 0) return 'active';
        if (planStatus === 'active') return 'active';
        if (planStatus === 'trial' || !planStatus) return 'trial';
        return 'other';
    };

    const getUserSortValue = (user, key) => {
        if (key === 'name') return `${user?.name || ''} ${user?.email || ''}`.trim().toLowerCase();
        if (key === 'plan') return getUserStatusCategory(user);
        if (key === 'accounts') return Number(user?.max_subagencies || 0) + Number(user?.bonus_subagencies || 0);
        if (key === 'numbers') return Number(user?.connected_slot_count || 0);
        if (key === 'trial') return user?.trial_ends_at ? new Date(user.trial_ends_at).getTime() : Number.MAX_SAFE_INTEGER;
        return '';
    };

    const handleUserSort = (key) => {
        setUserSort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const togglePinnedUser = (userId) => {
        const id = String(userId);
        setPinnedUserIds((current) => current.includes(id)
            ? current.filter((item) => item !== id)
            : [...current, id]
        );
    };

    const filteredUsers = (() => {
        const needle = searchTerm.trim().toLowerCase();
        const visible = users.filter((u) => {
            const matchesSearch = !needle ||
                (u.email || "").toLowerCase().includes(needle) ||
                (u.name || "").toLowerCase().includes(needle) ||
                (u.agency_id || "").toLowerCase().includes(needle);

            if (!matchesSearch) return false;
            return userStatusFilters[getUserStatusCategory(u)] !== false;
        });

        return [...visible].sort((a, b) => {
            const aPinned = pinnedUserIds.includes(String(a.id));
            const bPinned = pinnedUserIds.includes(String(b.id));
            if (aPinned !== bPinned) return aPinned ? -1 : 1;

            const aValue = getUserSortValue(a, userSort.key);
            const bValue = getUserSortValue(b, userSort.key);
            let comparison = 0;

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            } else {
                comparison = String(aValue).localeCompare(String(bValue), 'es', { numeric: true, sensitivity: 'base' });
            }

            if (comparison === 0) {
                comparison = String(a.email || '').localeCompare(String(b.email || ''), 'es', { numeric: true, sensitivity: 'base' });
            }

            return userSort.direction === 'asc' ? comparison : -comparison;
        });
    })();

    const getMasterOtpLabel = () => {
        if (!masterOtpExpiresAt) return "";
        const remainingMs = new Date(masterOtpExpiresAt).getTime() - masterOtpTick;
        if (remainingMs <= 0) return "Expirado";
        const hours = Math.floor(remainingMs / 3600000);
        const minutes = Math.floor((remainingMs % 3600000) / 60000);
        if (hours <= 0) return `Expira en ${Math.max(minutes, 1)}m`;
        return `Expira en ${hours}h ${minutes}m`;
    };

    const SortableUserHeader = ({ sortKey, children, align = 'left' }) => {
        const active = userSort.key === sortKey;
        return (
            <button
                type="button"
                onClick={() => handleUserSort(sortKey)}
                className={`group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition ${align === 'right' ? 'justify-end w-full' : ''} ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                title={`Ordenar por ${children}`}
            >
                <span>{children}</span>
                <ArrowUpDown size={13} className={active ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'} />
                {active && (
                    <span className="text-[10px] normal-case tracking-normal">
                        {userSort.direction === 'asc' ? 'asc' : 'desc'}
                    </span>
                )}
            </button>
        );
    };

    const updateAdminLogFilter = (key, value) => {
        setAdminLogFilters((current) => ({ ...current, [key]: value }));
    };

    const clearAdminLogFilters = () => {
        setAdminLogQueryDraft('');
        setAdminLogFilters({
            source: 'all',
            severity: 'actionable',
            type: '',
            code: '',
            query: '',
            hoursBack: '24'
        });
    };

    const formatAdminLogDate = (value) => {
        if (!value) return 'Sin fecha';
        try {
            return new Date(value).toLocaleString('es', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return String(value);
        }
    };

    const getAdminLogSeverityStyle = (severity) => {
        const value = String(severity || '').toLowerCase();
        if (value === 'critical' || value === 'error') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900';
        if (value === 'warning' || value === 'warn') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900';
    };

    const getAdminLogSourceLabel = (source) => {
        if (source === 'system_events') return 'Sistema';
        if (source === 'connectivity_logs') return 'Conexión';
        if (source === 'error_logs') return 'Aplicación';
        return source || 'Log';
    };

    const getHumanizedLog = (log = {}) => {
        const code = String(log.code || '').toUpperCase();
        const text = `${code} ${log.message || ''} ${log.reason || ''}`.toLowerCase();
        const repeats = Number(log.occurrence_count || 1);
        if (code === 'MEDIA_UPLOAD_RECOVERED') return {
            title: 'Multimedia recuperado automáticamente',
            cause: 'La subida principal a WhatsApp falló, pero el mecanismo alternativo completó el envío.',
            impact: 'Impacto: el archivo continuó su envío; no representa una pérdida definitiva.',
            action: 'Acción: no requiere intervención. Revisar únicamente si aumentan los fallos definitivos.'
        };
        if (code === 'MEDIA_UPLOAD_FAILED') return {
            title: 'Fallo definitivo al enviar multimedia',
            cause: 'Fallaron tanto la subida principal como el mecanismo alternativo de WhatsApp.',
            impact: 'Impacto: el archivo de esta operación no pudo enviarse.',
            action: 'Acción: revisar el archivo y la conectividad; evitar reenvíos automáticos para no producir duplicados.'
        };
        if (code === 'GHL_DELIVERY_PENDING') return {
            title: 'Entrega aceptada y pendiente en la cola',
            cause: 'La API aceptó el mensaje y espera el resultado terminal del worker.',
            impact: 'Impacto: todavía no existe evidencia de fallo; no se debe reenviar.',
            action: 'Acción: esperar la reconciliación automática. Intervenir sólo si queda pendiente por más de 24 horas.'
        };
        if (log.incident_status === 'recovered') return {
            title: 'Incidente de conexión recuperado automáticamente',
            cause: `La sesión presentó ${code || 'una interrupción'}, pero existe una conexión exitosa posterior.`,
            impact: `Impacto: la interrupción quedó cerrada${repeats > 1 ? ` después de ${repeats} eventos relacionados` : ''}.`,
            action: 'Acción: no requiere intervención. Vigilar únicamente si vuelve a repetirse.'
        };
        if (code === 'META_RESTRICTION_SUSPECTED' || code === 'WHATSAPP_ACCOUNT_RESTRICTED' || text.includes('account has been restricted') || text.includes('| 463 |')) return {
            title: 'Meta informó una posible limitación de envío',
            cause: 'Se recibió una señal 463 que debe verificarse con el timelock, su vencimiento y los ACK posteriores.',
            impact: 'Impacto: la conexión y las credenciales permanecen activas. Esta señal no requiere QR ni suspensión del slot.',
            action: 'Acción: comprobar la capacidad de envío. Permitir recepción y respuestas elegibles mientras se verifica.'
        };
        if (code === 'WHATSAPP_REACHOUT_TIMELOCK' || text.includes('reachout_timelock')) return {
            title: 'Meta limita temporalmente conversaciones nuevas',
            cause: 'WhatsApp comunicó un reachout timelock con una fecha de vencimiento.',
            impact: 'Impacto: el número sigue conectado, recibe mensajes y puede responder conversaciones recientes elegibles.',
            action: 'Acción: diferir contactos nuevos hasta el vencimiento. No pedir QR ni suspender la conexión.'
        };
        if (code === 'OFFICIAL_TEMPLATE_REQUIRED' || text.includes('plantilla aprobada') || text.includes('inicio conversacion')) return {
            title: 'Se requiere una plantilla aprobada de WhatsApp',
            cause: 'El contacto no tiene una conversación activa dentro de la ventana de 24 horas.',
            impact: 'Impacto: este mensaje no se envió; el resto de los números y conversaciones no se ven afectados.',
            action: 'Acción: enviar una plantilla aprobada de Meta o esperar una respuesta del contacto. No requiere reintentos.'
        };
        if (code === 'DESTINATARIO_SIN_WHATSAPP' || code === 'WHATSAPP_TARGET_NOT_FOUND' || text.includes('no esta disponible en whatsapp')) return {
            title: 'El destinatario no utiliza WhatsApp',
            cause: 'El número de destino no tiene una cuenta activa de WhatsApp o fue informado de forma incorrecta.',
            impact: 'Impacto: sólo ese destinatario no recibió el mensaje; el número conectado de WaFloW continúa operativo.',
            action: 'Acción: verificar y corregir el número del contacto. No requiere reintentos.'
        };
        if (code === 'GHL_DELIVERY_CONFIRMATION_PENDING' || text.includes('whatsapp_ack_timeout') || text.includes('job wait') && text.includes('timed out')) return {
            title: 'La confirmación de entrega tardó más de lo esperado',
            cause: 'La cola todavía no había informado el resultado terminal cuando venció la espera de seguimiento.',
            impact: 'Impacto: no demuestra que el mensaje haya fallado y no provoca un reenvío automático.',
            action: 'Acción: esperar la reconciliación final. Revisar sólo si luego aparece un fallo terminal de la misma operación.'
        };
        if (code === 'WHATSAPP_CHANNEL_NOT_CONNECTED' || text.includes('no devices connected')) return {
            title: 'El canal configurado no está disponible',
            cause: 'La cuenta intentó enviar sin una sesión QR conectada ni una configuración oficial utilizable.',
            impact: 'Impacto: ese mensaje no salió; no implica una caída general de WaFloW.',
            action: 'Acción: revisar el tipo de conexión de ese slot. Si usa Meta oficial, completar o renovar esa conexión; si usa QR, revisar su estado actual.'
        };
        if (code === 'META_OFFICIAL_PERMISSIONS_LOST' || text.includes('ya no tenemos acceso a la cuenta de whatsapp business') || text.includes('unsupported get request')) return {
            title: 'Meta retiró permisos del canal oficial',
            cause: 'La autorización guardada ya no permite consultar u operar la cuenta de WhatsApp Business vinculada.',
            impact: 'Impacto: el canal oficial de ese slot no puede operar hasta renovar los permisos; otros slots no se ven afectados.',
            action: 'Acción: volver a conectar la API oficial de Meta desde ese slot. No generar un QR de Baileys.'
        };
        if (code === 'GHL_LOCATION_FORBIDDEN' || text.includes('status code 403')) return {
            title: 'GoHighLevel rechazó el acceso de esta subcuenta',
            cause: 'Las credenciales o permisos de la ubicación no autorizan la operación solicitada.',
            impact: 'Impacto: la operación de GHL para esta subcuenta no se completó; WhatsApp no debe reintentarlo automáticamente.',
            action: 'Acción: reconectar GHL y revisar los permisos de la ubicación.'
        };
        if (code === 'SUPPORT_WHATSAPP_UNCONFIGURED' || text.includes('bot de soporte desconectado')) return {
            title: 'El bot de soporte no tiene un canal de WhatsApp disponible',
            cause: 'No hay un número conectado para enviar la alerta por WhatsApp.',
            impact: 'Impacto: esta alerta no pudo enviarse por WhatsApp; el servicio principal no queda detenido.',
            action: 'Acción: configurar el número del bot de soporte o confirmar el canal SMS alternativo.'
        };
        if (['408', '428', '479', '515'].includes(code) || text.includes('connection terminated') || text.includes('connection was lost')) return {
            title: 'Conexión de WhatsApp interrumpida',
            cause: 'La sesión perdió la conexión con WhatsApp.',
            impact: `Impacto: la sesión se interrumpió${repeats > 1 ? ` ${repeats} veces` : ''}, aunque el sistema intentó recuperarla automáticamente.`,
            action: 'Acción: vigilar la estabilidad; si se repite, revisar red, sesión y reconectar el número.'
        };
        return {
            title: log.message || log.reason || 'Incidente operativo sin detalle',
            cause: 'No hay una clasificación específica disponible para este evento.',
            impact: log.severity === 'critical' ? 'Impacto: hay una operación afectada que requiere revisión técnica.' : 'Impacto: señal operativa a vigilar.',
            action: 'Acción: abrir el contexto técnico y revisar la cuenta o servicio indicado.'
        };
    };

    const formatMetadataPreview = (metadata) => {
        if (!metadata || typeof metadata !== 'object') return '';
        try {
            return JSON.stringify(metadata, null, 2);
        } catch (error) {
            return String(metadata);
        }
    };

    const LogsPanel = () => {
        const sourceOptions = [
            { value: 'all', label: 'Todas' },
            { value: 'system_events', label: 'Sistema' },
            { value: 'connectivity_logs', label: 'Conexión' },
            { value: 'error_logs', label: 'Aplicación' }
        ];
        const severityOptions = [
            { value: 'actionable', label: 'Accionables' },
            { value: 'critical', label: 'Críticos' },
            { value: 'warning', label: 'Warnings' },
            { value: 'info', label: 'Solo info' },
            { value: 'all', label: 'Todo (auditoría)' }
        ];
        const topTypes = Array.isArray(adminLogOptions.types) ? adminLogOptions.types.slice(0, 8) : [];

        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-gray-500">Total</span>
                            <Activity size={18} className="text-indigo-500" />
                        </div>
                        <p className="mt-1 text-xl font-black text-gray-900 dark:text-white">{adminLogSummary.total || 0}</p>
                    </div>
                    <div className="rounded-xl border border-red-100 bg-white p-3 dark:border-red-900/60 dark:bg-gray-900">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-red-600 dark:text-red-300">Críticos</span>
                            <ShieldAlert size={18} className="text-red-500" />
                        </div>
                        <p className="mt-1 text-xl font-black text-red-600 dark:text-red-300">{adminLogSummary.critical || 0}</p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-white p-3 dark:border-amber-900/60 dark:bg-gray-900">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-amber-600 dark:text-amber-300">Warnings</span>
                            <AlertTriangle size={18} className="text-amber-500" />
                        </div>
                        <p className="mt-1 text-xl font-black text-amber-600 dark:text-amber-300">{adminLogSummary.warning || 0}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-gray-500">Fuentes</span>
                            <Database size={18} className="text-sky-500" />
                        </div>
                        <p className="mt-1 text-xl font-black text-gray-900 dark:text-white">{Object.keys(adminLogSummary.bySource || {}).length}</p>
                    </div>
                </div>

                <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200">
                    La vista prioriza incidentes que requieren decisión. Los eventos <strong>info</strong> quedan ocultos por defecto y las reconexiones repetidas se consolidan en un solo resumen.
                </div>

                <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.6fr)_140px_140px_130px_130px_auto]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                value={adminLogQueryDraft}
                                onChange={(e) => setAdminLogQueryDraft(e.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        updateAdminLogFilter('query', adminLogQueryDraft);
                                    }
                                }}
                                placeholder="Buscar por sesión, location, mensaje, servicio o teléfono..."
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950"
                            />
                        </div>
                        <select value={adminLogFilters.source} onChange={(e) => updateAdminLogFilter('source', e.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold dark:border-gray-700 dark:bg-gray-950">
                            {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <select value={adminLogFilters.severity} onChange={(e) => updateAdminLogFilter('severity', e.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold dark:border-gray-700 dark:bg-gray-950">
                            {severityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <input
                            type="text"
                            value={adminLogFilters.type}
                            onChange={(e) => updateAdminLogFilter('type', e.target.value)}
                            placeholder="Tipo"
                            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950"
                        />
                        <input
                            type="text"
                            value={adminLogFilters.code}
                            onChange={(e) => updateAdminLogFilter('code', e.target.value)}
                            placeholder="Código"
                            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950"
                        />
                        <div className="flex items-center gap-2">
                            <select value={adminLogFilters.hoursBack} onChange={(e) => updateAdminLogFilter('hoursBack', e.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold dark:border-gray-700 dark:bg-gray-950">
                                <option value="2">2h</option>
                                <option value="6">6h</option>
                                <option value="24">24h</option>
                                <option value="72">72h</option>
                                <option value="168">7d</option>
                            </select>
                            <button onClick={fetchAdminLogs} className="rounded-lg bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-700" title="Recargar logs">
                                <RefreshCw size={18} className={adminLogsLoading ? 'animate-spin' : ''} />
                            </button>
                            <button onClick={clearAdminLogFilters} className="rounded-lg bg-gray-100 p-2.5 text-gray-600 transition hover:text-indigo-600 dark:bg-gray-800 dark:text-gray-300" title="Limpiar filtros">
                                <Filter size={18} />
                            </button>
                            <button onClick={() => setShowReviewedLogs((current) => !current)} className={`whitespace-nowrap rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${showReviewedLogs ? 'bg-slate-700 text-white border-slate-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}>
                                {showReviewedLogs ? 'Ocultar cerrados' : 'Ver revisados'}
                            </button>
                            <button type="button" onClick={downloadAdminLogsCsv} className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 transition hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" title="Descargar todos los logs que coinciden con los filtros actuales">CSV</button>
                        </div>
                    </div>

                    {topTypes.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {topTypes.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => updateAdminLogFilter('type', item.value)}
                                    className={`px-3 py-1.5 rounded-full border text-xs font-bold transition ${adminLogFilters.type === item.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-400'}`}
                                >
                                    {item.value} <span className="opacity-70">{item.count}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    {adminLogsLoading ? (
                        <div className="py-20 text-center text-gray-500">
                            <RefreshCw className="animate-spin mx-auto mb-3 text-indigo-600" size={32} />
                            Cargando logs...
                        </div>
                    ) : adminLogs.length === 0 ? (
                        <div className="py-20 text-center text-gray-500">
                            <Database className="mx-auto mb-3 text-gray-300" size={40} />
                            No hay logs para los filtros seleccionados.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-800">
                            {adminLogs.map((log) => {
                                const metadata = formatMetadataPreview(log.metadata);
                                const target = log.session_id || log.location_id || log.client_id || log.phone_number || 'global';
                                const identity = [
                                    log.client_name && `Cliente: ${log.client_name}`,
                                    log.slot_name && `Slot: ${log.slot_name}`,
                                    log.phone_number && `Número: ${log.phone_number}`,
                                    log.location_id && `Cuenta: ${log.location_id}`
                                ].filter(Boolean);
                                const human = getHumanizedLog(log);
                                return (
                                    <div key={`${log.source}-${log.id}`} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-950/70 transition">
                                        <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-4">
                                            <div className="lg:w-32 shrink-0">
                                                <div className="text-xs font-bold text-gray-500 tabular-nums">{formatAdminLogDate(log.created_at)}</div>
                                                <div className="mt-2 text-[11px] font-bold uppercase text-gray-400">{getAdminLogSourceLabel(log.source)}</div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-full border ${getAdminLogSeverityStyle(log.severity)}`}>{log.severity || log.level || 'info'}</span>
                                                    {log.type && <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-full border bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">{log.type}</span>}
                                                    {log.code && <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-full border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900">Código {log.code}</span>}
                                                    {log.notification_status && <span className="text-[11px] text-gray-400">alerta: {log.notification_status}</span>}
                                                    {Number(log.occurrence_count || 1) > 1 && <span className="text-[11px] text-gray-400">repeticiones: {log.occurrence_count}</span>}
                                                    {log.incident_status === 'recovered' && <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900">Recuperado automáticamente</span>}
                                                    {log.incident_status === 'open' && <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-full border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900">Incidente abierto</span>}
                                                </div>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white break-words">{human.title}</p>
                                                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Causa: {human.cause}</p>
                                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                                    {identity.length > 0 ? identity.map((item) => <span key={item} className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{item}</span>) : <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">target: {target}</span>}
                                                    {log.worker_id && <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">worker: {log.worker_id}</span>}
                                                    {log.category && <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">cat: {log.category}</span>}
                                                </div>
                                                <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">{human.impact}</p>
                                                <p className="mt-2 text-xs font-medium text-indigo-700 dark:text-indigo-300">{human.action}</p>
                                                {human.title !== (log.message || log.reason || '') && <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Detalle técnico: {log.message || log.reason}</p>}
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    {log.review_status ? (
                                                        <>
                                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{log.review_status === 'resolved' ? 'Resuelto' : 'Revisado'}</span>
                                                            <button type="button" onClick={() => updateLogReview(log, 'open')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300">Reabrir</button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button type="button" onClick={() => updateLogReview(log, 'reviewed')} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-gray-900 dark:text-slate-200">Marcar revisado</button>
                                                            <button type="button" onClick={() => updateLogReview(log, 'resolved')} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">Cerrar manualmente</button>
                                                        </>
                                                    )}
                                                </div>
                                                {Number(log.occurrence_count || 1) > 1 && log.first_seen_at && log.last_seen_at && (
                                                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Resumen: desde {formatAdminLogDate(log.first_seen_at)} hasta {formatAdminLogDate(log.last_seen_at)}</p>
                                                )}
                                                {metadata && metadata !== '{}' && (
                                                    <details className="mt-3">
                                                        <summary className="cursor-pointer text-xs font-bold text-indigo-600 dark:text-indigo-300">Ver contexto</summary>
                                                        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-950 text-gray-100 p-3 text-xs whitespace-pre-wrap">{metadata}</pre>
                                                    </details>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const getNumberHealthStatusLabel = (status) => ({
        stable: 'Estable',
        attention: 'Atención',
        unstable: 'Inestable',
        connected: 'Conectado',
        recovering: 'Reconectando',
        offline: 'Desconectado',
        restricted: 'Permisos perdidos / revincular',
        requires_qr: 'Requiere QR',
        review_required: 'Revisión necesaria',
        business_disabled: 'Negocio inactivo',
        official_configured: 'Canal oficial configurado',
        official_not_configured: 'Canal oficial sin configurar',
        blocked: 'Bloqueado',
        paused: 'Pausado',
        unknown: 'Sin evidencia reciente'
    }[String(status || '').toLowerCase()] || 'Sin datos');

    const getNumberHealthStatusStyle = (status) => {
        const value = String(status || '').toLowerCase();
        if (value === 'stable' || value === 'connected' || value === 'official_configured') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900';
        if (value === 'attention') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900';
        if (value === 'unstable' || value === 'recovering') return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900';
        if (value === 'paused' || value === 'unknown' || value === 'business_disabled') return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
        if (value === 'official_not_configured') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900';
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900';
    };

    const getAuthHealthLabel = (state) => ({
        valid: 'Credencial válida',
        unpaired: 'Sin vincular',
        requires_qr: 'Requiere QR',
        review_required: 'Revisión necesaria',
        disabled_business: 'Negocio inactivo',
        unknown: 'Sin inventario'
    }[String(state || '').toLowerCase()] || 'Sin inventario');

    const getSendCapabilityLabel = (state) => ({
        allowed: 'Envíos permitidos',
        verification_pending: 'Limitación en verificación',
        reachout_limited: 'Nuevas conversaciones limitadas',
        recipient_unavailable: 'Destinatario no disponible',
        review_required: 'Revisión necesaria',
        unknown: 'Capacidad no confirmada'
    }[String(state || '').toLowerCase()] || 'Capacidad no confirmada');

    const getNumberQualityLabel = (level) => ({
        good: 'Buena', care: 'A cuidar', sensitive: 'Sensible', delicate: 'Delicada'
    }[String(level || '').toLowerCase()] || 'Sin historial');

    const NumberHealthPanel = () => {
        const normalizedQuery = numberHealthQuery.trim().toLowerCase();
        const rows = numberHealth.filter((item) => {
            const matchesStatus = numberHealthStatus === 'all'
                || item.connection_status === numberHealthStatus
                || item.current_connection_state === numberHealthStatus
                || item.sendCapability?.state === numberHealthStatus
                || (numberHealthStatus === 'historical_restriction' && item.restriction_recovered)
                || (numberHealthStatus === 'delivery_pending' && Number(item.delivery?.pending || 0) > 0)
                || (numberHealthStatus === 'delivery_failed' && Number(item.delivery?.terminalFailures24h || 0) > 0)
                || (numberHealthStatus === 'media_recovered' && Number(item.media?.recovered24h || 0) > 0)
                || (numberHealthStatus === 'media_failed' && Number(item.media?.finalFailures24h || 0) > 0);
            const searchable = [item.phone_number, item.client_name, item.location_id, item.slot_name, item.slot_id].join(' ').toLowerCase();
            return matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
        }).sort((left, right) => {
            const priority = { restricted: 0, requires_qr: 0, official_not_configured: 0, blocked: 0, offline: 1, review_required: 1, recovering: 2, unstable: 3, attention: 4, paused: 5, official_configured: 6, stable: 6 };
            const leftState = left.current_connection_state === 'connected' ? left.connection_status : left.current_connection_state;
            const rightState = right.current_connection_state === 'connected' ? right.connection_status : right.current_connection_state;
            return (priority[leftState] ?? 9) - (priority[rightState] ?? 9)
                || Number(right.reconnect_incidents_72h || 0) - Number(left.reconnect_incidents_72h || 0);
        });
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-base font-black text-gray-900 dark:text-white">Salud de números</h2>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Estado actual, actividad e incidentes recientes.</p>
                    </div>
                    <button onClick={() => fetchNumberHealth(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
                        <RefreshCw size={17} className={numberHealthLoading ? 'animate-spin' : ''} /> Actualizar
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                    {[
                        ['Números', numberHealthSummary.total, 'text-gray-900 dark:text-white'],
                        ['Conectados', numberHealthSummary.connected, 'text-emerald-600 dark:text-emerald-300'],
                        ['Reconectando', numberHealthSummary.recovering, 'text-orange-600 dark:text-orange-300'],
                        ['Requieren QR', numberHealthSummary.requiresQr, 'text-red-600 dark:text-red-300'],
                        ['Limitación Meta', numberHealthSummary.reachoutLimited, 'text-amber-600 dark:text-amber-300'],
                        ['Restricción superada', numberHealthSummary.historicalRestrictions, 'text-sky-600 dark:text-sky-300'],
                        ['Entregas pendientes', numberHealthSummary.deliveryPending, 'text-amber-600 dark:text-amber-300'],
                        ['Multimedia fallida 24h', numberHealthSummary.mediaFinalFailures24h, 'text-red-600 dark:text-red-300']
                    ].map(([label, value, color]) => <div key={label} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"><p className="truncate text-[10px] font-bold uppercase tracking-wide text-gray-400" title={label}>{label}</p><p className={`mt-1 text-xl font-black ${color}`}>{value || 0}</p></div>)}
                </div>
                <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 md:flex-row">
                    <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} /><input value={numberHealthQueryDraft} onChange={(event) => setNumberHealthQueryDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setNumberHealthQuery(numberHealthQueryDraft); }} placeholder="Buscar número, cliente, location o slot..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    <select value={numberHealthStatus} onChange={(event) => setNumberHealthStatus(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold dark:border-gray-700 dark:bg-gray-950"><option value="all">Todos los estados</option><option value="connected">Conectados</option><option value="recovering">Reconectando</option><option value="offline">Desconectados</option><option value="requires_qr">Requieren QR</option><option value="official_not_configured">Canal oficial sin configurar</option><option value="reachout_limited">Nuevas conversaciones limitadas</option><option value="verification_pending">Limitación en verificación</option><option value="restricted">Permisos perdidos / revincular</option><option value="historical_restriction">Restricción superada</option><option value="delivery_pending">Entregas pendientes</option><option value="delivery_failed">Fallos reales de entrega</option><option value="media_recovered">Multimedia recuperada</option><option value="media_failed">Multimedia fallida</option><option value="unstable">Conectados inestables</option><option value="attention">Conectados en atención</option><option value="blocked">Bloqueados</option><option value="paused">Pausados</option></select>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    {numberHealthLoading ? <div className="py-20 text-center text-gray-500"><RefreshCw className="animate-spin mx-auto mb-3 text-indigo-600" size={32} />Cargando salud de números...</div> : rows.length === 0 ? <div className="py-20 text-center text-gray-500"><Activity className="mx-auto mb-3 text-gray-300" size={40} />No hay números para los filtros seleccionados.</div> : <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-950 text-[11px] uppercase tracking-wide text-gray-500"><tr><th className="text-left px-4 py-3">Número / cliente</th><th className="text-left px-4 py-3">Estado actual</th><th className="text-left px-4 py-3">Credencial e historial</th><th className="text-left px-4 py-3">Calidad</th><th className="text-right px-4 py-3">Actividad 28d</th><th className="text-right px-4 py-3">Entrega / multimedia</th><th className="text-right px-4 py-3">Incidentes 72h</th></tr></thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{rows.map((item) => {
                                const currentState = item.current_connection_state || item.connection_status || 'unknown';
                                const stabilityState = currentState === 'connected' ? item.connection_status : null;
                                return <tr key={`${item.location_id}-${item.slot_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-950/60">
                                    <td className="px-4 py-4"><p className="font-bold text-gray-900 dark:text-white">{item.phone_number}</p><p className="mt-1 text-xs text-gray-500">{item.client_name || item.location_id} · {item.slot_name || `Slot ${item.slot_id}`}</p></td>
                                    <td className="px-4 py-4"><span className={`inline-flex px-2 py-1 rounded-full border text-xs font-bold ${getNumberHealthStatusStyle(currentState)}`}>{getNumberHealthStatusLabel(currentState)}</span><p className="mt-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">{getSendCapabilityLabel(item.sendCapability?.state)}</p>{item.sendCapability?.state === 'reachout_limited' && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Recibe y responde contactos recientes · nuevos contactos hasta {formatAdminLogDate(item.sendCapability?.expiresAt)}</p>}{currentState === 'official_not_configured' && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Completa o renueva la conexión con Meta. No requiere QR.</p>}{stabilityState && <p className="mt-1 text-[11px] text-gray-500">Estabilidad: {getNumberHealthStatusLabel(stabilityState)}</p>}{item.last_error_code && currentState !== 'connected' && <p className="mt-1 text-[11px] text-gray-500">Último código: {item.last_error_code}</p>}</td>
                                    <td className="px-4 py-4"><p className="font-semibold text-gray-800 dark:text-gray-200">{getAuthHealthLabel(item.auth_health_state)}</p>{item.auth_reason_code && <p className="mt-1 text-[11px] text-gray-500">Motivo: {item.auth_reason_code}</p>}{item.restriction_recovered && <p className="mt-1 text-[11px] font-semibold text-sky-600 dark:text-sky-300">Restricción histórica superada</p>}</td>
                                    <td className="px-4 py-4"><p className="font-semibold text-gray-800 dark:text-gray-200">{getNumberQualityLabel(item.number_quality_level)}</p><p className="mt-1 text-[11px] text-gray-500">{item.number_quality_source === 'internal_history' ? 'Historial interno' : item.number_quality_source === 'hybrid_official_meta' ? 'Meta + historial' : 'Aún sin historial'}</p></td>
                                    <td className="px-4 py-4 text-right"><p className="font-bold text-gray-900 dark:text-white">{Number(item.sent_messages_28d || 0).toLocaleString()} envíos</p><p className="mt-1 text-[11px] text-gray-500">{item.active_days_28d || 0} días activos</p></td>
                                    <td className="px-4 py-4 text-right"><p className={Number(item.delivery?.terminalFailures24h || 0) > 0 ? 'font-black text-red-600 dark:text-red-300' : 'font-bold text-gray-900 dark:text-white'}>{item.delivery?.pending || 0} pendientes · {item.delivery?.terminalFailures24h || 0} fallos</p><p className="mt-1 text-[11px] text-gray-500">Multimedia: {item.media?.recovered24h || 0} recuperados · {item.media?.finalFailures24h || 0} fallidos</p></td>
                                    <td className="px-4 py-4 text-right"><p className={Number(item.reconnect_incidents_72h || 0) >= 5 ? 'font-black text-orange-600 dark:text-orange-300' : 'font-bold text-gray-900 dark:text-white'}>{item.reconnect_incidents_72h || 0} incidentes</p><p className="mt-1 text-[11px] text-gray-500">{item.reconnects_72h || 0} intentos técnicos</p></td>
                                </tr>;
                            })}</tbody>
                        </table>
                    </div>}
                </div>
            </div>
        );
    };

    // --- SUBCOMPONENTE: MARCA (GLOBAL / STANDALONE) ---
    const BrandingSettings = ({ mode = 'global' }) => {
        const isStandaloneMode = mode === 'standalone';
        const defaultBranding = isStandaloneMode ? DEFAULT_STANDALONE_BRANDING : DEFAULT_BRANDING;
        const sourceBranding = isStandaloneMode ? standaloneBranding : systemBranding;
        const [form, setForm] = useState(sourceBranding || defaultBranding);
        const [uploading, setUploading] = useState(false);
        const [galleryImages, setGalleryImages] = useState([]);
        const [loadingGallery, setLoadingGallery] = useState(false);
        const [showGallery, setShowGallery] = useState(false);

        useEffect(() => {
            setForm(sourceBranding || defaultBranding);
        }, [sourceBranding, defaultBranding]);

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
                    toast.success("Imagen subida correctamente.");
                    fetchGallery();
                } else throw new Error(data.error);
            } catch (err) { toast.error("Error al subir imagen"); } finally { setUploading(false); }
        };

        const handleSelectImage = (url) => {
            if (showGallery === 'logo') setForm({ ...form, logoUrl: url });
            if (showGallery === 'favicon') setForm({ ...form, faviconUrl: url });
            if (showGallery === 'background') setForm({ ...form, loginImage: url });
            setShowGallery(false);
            toast.success("Imagen seleccionada");
        };

        const handleSave = () => {
            if (isStandaloneMode) {
                updateStandaloneBranding(form, token);
                toast.success("Marca Standalone actualizada.");
                return;
            }
            updateSystemBranding(form, token);
            toast.success("Marca Global actualizada.");
        };

        return (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600"><Palette size={24} /></div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {isStandaloneMode ? 'Identidad Standalone del Sistema' : 'Identidad Global del Sistema'}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {isStandaloneMode
                                    ? 'Configura Login y Registro para Standalone (Solo visible para Super Admin).'
                                    : 'Configura Login y Registro (Solo visible para Super Admin).'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nombre Plataforma</label><input type="text" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-3 rounded-xl border dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 transition-all" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Slogan Login</label><input type="text" value={form.slogan || ''} onChange={e => setForm({...form, slogan: e.target.value})} className="w-full p-3 rounded-xl border dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 transition-all" /></div>
                            </div>
                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Textos Pantalla Login</h4>
                                <div><label className="block text-sm font-bold mb-1 dark:text-gray-300">Descripción (Bajada)</label><textarea rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 outline-none focus:ring-2" placeholder="Tecnología humana para flujos inteligentes..." /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-bold mb-1 dark:text-gray-300">Título Formulario</label><input type="text" value={form.loginTitle || ''} onChange={e => setForm({...form, loginTitle: e.target.value})} className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" placeholder="Empieza Ahora" /></div>
                                    <div><label className="block text-sm font-bold mb-1 dark:text-gray-300">Subtítulo Formulario</label><input type="text" value={form.loginSubtitle || ''} onChange={e => setForm({...form, loginSubtitle: e.target.value})} className="w-full p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700" placeholder="Ingresa a la nueva era..." /></div>
                                </div>
                            </div>
                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center justify-between"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Botón Promocional (CTA)</h4><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={form.ctaButton?.show || false} onChange={e => setForm({...form, ctaButton: {...form.ctaButton, show: e.target.checked}})} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div><span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">Activar</span></label></div>
                                {form.ctaButton?.show && (<div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl"><div><label className="block text-xs font-bold mb-1 text-gray-500">Texto Botón</label><input type="text" value={form.ctaButton?.text || ''} onChange={e => setForm({...form, ctaButton: {...form.ctaButton, text: e.target.value}})} className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700 text-sm" placeholder="Ver Oferta" /></div><div><label className="block text-xs font-bold mb-1 text-gray-500">URL Destino</label><div className="flex items-center"><Link size={14} className="mr-2 text-gray-400"/><input type="url" value={form.ctaButton?.url || ''} onChange={e => setForm({...form, ctaButton: {...form.ctaButton, url: e.target.value}})} className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700 text-sm" placeholder="https://..." /></div></div><div className="col-span-2"><label className="block text-xs font-bold mb-1 text-gray-500">Color Fondo Botón (Opcional)</label><div className="flex items-center gap-3"><input type="color" value={form.ctaButton?.backgroundColor || '#ffffff'} onChange={e => setForm({...form, ctaButton: {...form.ctaButton, backgroundColor: e.target.value}})} className="h-9 w-12 rounded cursor-pointer border" /><input type="text" value={form.ctaButton?.backgroundColor || ''} onChange={e => setForm({...form, ctaButton: {...form.ctaButton, backgroundColor: e.target.value}})} className="flex-1 p-2 rounded border dark:bg-gray-900 dark:border-gray-700 text-sm font-mono" placeholder="Vacío para efecto cristal" /></div></div></div>)}
                            </div>
                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Imágenes</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-2"><label className="text-xs font-bold text-gray-500">Logo</label><div className="w-full aspect-square border rounded bg-gray-50 flex items-center justify-center p-2"><img src={form.logoUrl} className="max-w-full max-h-full object-contain" alt="Logo" onError={(e)=>e.target.style.display='none'}/></div><div className="flex flex-col gap-1 text-xs"><label className="cursor-pointer text-indigo-600 font-bold hover:underline">Subir <input type="file" className="hidden" onChange={(e)=>handleFileUpload(e,'logoUrl')} disabled={uploading}/></label><button onClick={()=>setShowGallery('logo')} className="text-gray-500 hover:text-gray-900 text-left">Galería</button></div></div>
                                    <div className="flex flex-col gap-2"><label className="text-xs font-bold text-gray-500">Favicon</label><div className="w-full aspect-square border rounded bg-gray-50 flex items-center justify-center p-4"><img src={form.faviconUrl} className="max-w-full max-h-full object-contain" alt="Fav" onError={(e)=>e.target.style.display='none'}/></div><div className="flex flex-col gap-1 text-xs"><label className="cursor-pointer text-indigo-600 font-bold hover:underline">Subir <input type="file" className="hidden" onChange={(e)=>handleFileUpload(e,'faviconUrl')} disabled={uploading}/></label><button onClick={()=>setShowGallery('favicon')} className="text-gray-500 hover:text-gray-900 text-left">Galería</button></div></div>
                                    <div className="flex flex-col gap-2"><label className="text-xs font-bold text-gray-500">Fondo</label><div className="w-full aspect-square border rounded bg-gray-50 flex items-center justify-center overflow-hidden"><img src={form.loginImage} className="w-full h-full object-cover" alt="Fondo" onError={(e)=>e.target.style.display='none'}/></div><div className="flex flex-col gap-1 text-xs"><label className="cursor-pointer text-indigo-600 font-bold hover:underline">Subir <input type="file" className="hidden" onChange={(e)=>handleFileUpload(e,'loginImage')} disabled={uploading}/></label><button onClick={()=>setShowGallery('background')} className="text-gray-500 hover:text-gray-900 text-left">Galería</button></div></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <div><label className="block text-xs font-bold mb-1 text-gray-500">Primario</label><div className="flex gap-2"><input type="color" value={form.primaryColor} onChange={e => setForm({...form, primaryColor: e.target.value})} className="h-8 w-8 rounded cursor-pointer border" /><input type="text" value={form.primaryColor} readOnly className="flex-1 p-1 text-xs border rounded" /></div></div>
                                <div><label className="block text-xs font-bold mb-1 text-gray-500">Acento</label><div className="flex gap-2"><input type="color" value={form.accentColor} onChange={e => setForm({...form, accentColor: e.target.value})} className="h-8 w-8 rounded cursor-pointer border" /><input type="text" value={form.accentColor} readOnly className="flex-1 p-1 text-xs border rounded" /></div></div>
                            </div>
                            <div className="pt-4 flex justify-end gap-4"><button onClick={()=>setForm(defaultBranding)} className="text-gray-500 hover:text-gray-700 flex items-center gap-2 text-sm font-medium px-4"><RotateCcw size={16}/> Restaurar Defaults</button><button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2 hover:-translate-y-0.5 transition"><CheckCircle2 size={18}/> Guardar Cambios</button></div>
                        </div>
                        <div className={`border-l border-gray-100 dark:border-gray-800 pl-0 lg:pl-10 transition-all duration-300 ${!showGallery ? 'hidden lg:block lg:opacity-40 lg:pointer-events-none grayscale' : ''}`}>
                            <div className="flex justify-between items-center mb-4"><h4 className="font-bold dark:text-white flex items-center gap-2"><ImageIcon size={20} className="text-indigo-500"/> Galería del Servidor</h4><button onClick={() => fetchGallery()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500" title="Recargar Galería"><RefreshCw size={16} className={loadingGallery ? 'animate-spin' : ''}/></button></div>
                            {showGallery && (<div className="mb-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded-lg text-xs font-bold text-center border border-indigo-100 dark:border-indigo-800">Selecciona una imagen para: {showGallery.toUpperCase()}</div>)}
                            <div className="grid grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar content-start">
                                {loadingGallery ? (<div className="col-span-3 text-center py-10 text-gray-400">Cargando imágenes...</div>) : galleryImages.length === 0 ? (<div className="col-span-3 text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl"><ImageIcon className="mx-auto text-gray-300 mb-2" size={32}/><p className="text-sm text-gray-400">No hay imágenes guardadas.</p></div>) : (galleryImages.map((img, idx) => (<div key={idx} onClick={() => showGallery && handleSelectImage(img.url)} className={`group relative aspect-square rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-black/20 transition-all hover:border-indigo-500 hover:shadow-md ${showGallery ? 'cursor-pointer' : 'cursor-default'}`}><img src={img.url} alt={img.name} className="w-full h-full object-contain p-1" loading="lazy" />{showGallery && (<div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[1px]"><span className="bg-white text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition">Seleccionar</span></div>)}</div>)))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="admin-master-ui min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
            {/* HEADER */}
            <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
                <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-5">
                    {view === 'subaccounts' && (
                        <button onClick={handleBackToAgencies} className="shrink-0 rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800" title="Volver a agencias">
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <div className="flex shrink-0 items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white">CA</div>
                        <h1 className="whitespace-nowrap text-sm font-black tracking-tight text-gray-900 dark:text-white sm:text-base">Panel Maestro</h1>
                    </div>

                    {masterOtp && (
                        <div className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 xl:flex">
                            <span>OTP</span>
                            <span className="font-mono text-xs font-black">{masterOtp}</span>
                            {masterOtpExpiresAt && <span className="text-[10px] text-amber-700">{getMasterOtpLabel()}</span>}
                        </div>
                    )}

                    <nav className="min-w-0 flex-1 overflow-x-auto" aria-label="Panel Maestro">
                        <div className="flex min-w-max items-center gap-1">
                            {[
                                ['users', 'Usuarios', Users],
                                ['agencies', 'Agencias', Building2],
                                ['logs', 'Logs', Activity],
                                ['numberHealth', 'Salud', ShieldAlert],
                                ['templateVisibility', 'Templates', FileText],
                                ['branding', 'Marca global', Settings],
                                ['standaloneBranding', 'Marca standalone', Smartphone]
                            ].map(([itemView, label, Icon]) => {
                                const active = itemView === 'agencies'
                                    ? (view === 'agencies' || view === 'subaccounts')
                                    : view === itemView;
                                return (
                                    <button
                                        key={itemView}
                                        type="button"
                                        onClick={() => {
                                            if (itemView === 'agencies') {
                                                setSubaccounts([]);
                                                setSelectedAgency(null);
                                            }
                                            setView(itemView);
                                            setSearchTerm('');
                                            setSearchDraft('');
                                        }}
                                        className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2 text-xs font-semibold transition-colors ${
                                            active
                                                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300'
                                                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                        }`}
                                    >
                                        <Icon size={14} />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </nav>

                    <div className="flex shrink-0 items-center gap-1">
                        <ThemeToggle />
                        <button
                            onClick={() => view === 'agencies' ? fetchAgencies() : view === 'users' ? fetchUsers() : view === 'logs' ? fetchAdminLogs() : view === 'numberHealth' ? fetchNumberHealth(true) : (selectedAgency ? fetchSubaccounts(selectedAgency.agency_id) : null)}
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-indigo-300"
                            title="Recargar datos"
                        >
                            <RefreshCw size={17} className={(loading || adminLogsLoading || numberHealthLoading) ? "animate-spin" : ""} />
                        </button>
                        <button onClick={onLogout} className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" title="Cerrar sesión">
                            <LogOut size={17} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-[1500px] px-3 py-5 sm:px-5">
                
                {/* VISTA: BRANDING */}
                {view === 'branding' && <BrandingSettings mode="global" />}
                {view === 'standaloneBranding' && <BrandingSettings mode="standalone" />}
                {view === 'logs' && LogsPanel()}
                {view === 'numberHealth' && NumberHealthPanel()}
                {view === 'templateVisibility' && <AdminTemplateVisibility token={token} agencies={agencies} onUnauthorized={onLogout} />}

                {/* VISTA: USUARIOS */}
                {view === 'users' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                            <div className="relative w-full min-w-0 lg:max-w-lg">
                                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar por email, nombre o agencia..."
                                    className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-indigo-900/30"
                                    value={searchDraft}
                                    onChange={(event) => setSearchDraft(event.target.value)}
                                    onKeyDown={(event) => { if (event.key === 'Enter') setSearchTerm(searchDraft); }}
                                />
                            </div>
                            <button
                                onClick={handleOpenManualUserModal}
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                            >
                                <Plus size={16} /> Crear usuario
                            </button>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowUserStatusFilters((current) => !current)}
                                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                >
                                    <Filter size={15} /> Filtros
                                    <ChevronDown size={16} className={`transition ${showUserStatusFilters ? 'rotate-180' : ''}`} />
                                </button>
                                {showUserStatusFilters && (
                                    <div className="absolute z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900 right-0 lg:left-0 lg:right-auto">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Plan y estado</span>
                                            <button
                                                type="button"
                                                onClick={() => setUserStatusFilters({
                                                    active: true,
                                                    trial: true,
                                                    adminFree: true,
                                                    grace: true,
                                                    suspended: false,
                                                    inactive: false,
                                                    other: true
                                                })}
                                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                                            >
                                                Restablecer
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1">
                                            {userStatusFilterOptions.map((option) => (
                                                <label key={option.key} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                                                    <input
                                                        type="checkbox"
                                                        checked={userStatusFilters[option.key] !== false}
                                                        onChange={(event) => setUserStatusFilters((current) => ({ ...current, [option.key]: event.target.checked }))}
                                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{option.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 lg:ml-auto">
                                Mostrando <span className="font-bold text-gray-800 dark:text-gray-100">{filteredUsers.length}</span> de {users.length}
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-24"><RefreshCw className="animate-spin mx-auto text-indigo-600 mb-4" size={40} /><p className="text-gray-500">Cargando usuarios...</p></div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700"><Users className="mx-auto text-gray-300 mb-4" size={64} /><p className="text-gray-500 text-lg">No se encontraron usuarios.</p></div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                <div className="overflow-x-auto">
                                    <table className="admin-users-table w-full min-w-[1080px] border-collapse text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
                                            <tr>
                                                <th className="px-6 py-4"><SortableUserHeader sortKey="name">Usuario / Email</SortableUserHeader></th>
                                                <th className="px-6 py-4"><SortableUserHeader sortKey="plan">Plan & Estado</SortableUserHeader></th>
                                                <th className="px-6 py-4"><SortableUserHeader sortKey="accounts">Cuentas Límite</SortableUserHeader></th>
                                                <th className="px-6 py-4"><SortableUserHeader sortKey="numbers">Números</SortableUserHeader></th>
                                                <th className="px-6 py-4"><SortableUserHeader sortKey="trial">Vencimiento Trial</SortableUserHeader></th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-40">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {filteredUsers.map(user => {
                                                const canManageTrial = user.role !== 'admin' && (user.plan_status === 'trial' || user.plan_status === 'suspended');
                                                const suspensionStatus = user.suspension_status || null;
                                                const isSuspended = ['grace', 'suspended', 'pending_deletion', 'permanently_deleted'].includes(suspensionStatus);
                                                const graceDaysLeft = user.grace_ends_at ? Math.max(0, Math.ceil((new Date(user.grace_ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null;
                                                const productInterface = String(user.product_interface || '').toLowerCase();
                                                const isInboxUser = productInterface === 'inbox' || String(user.interface || '').toLowerCase() === 'standalone';
                                                const canEditAccountLimit = user.can_edit_account_limit !== false && !isInboxUser;
                                                const productBadgeLabel = user.product_interface_label || (isInboxUser ? 'Waflow Inbox' : 'CRM Waflow');
                                                const connectedSlotCount = Number(user.connected_slot_count || 0);
                                                const totalSlotCount = Number(user.total_slot_count || 0);
                                                const connectedNumbers = Array.isArray(user.connected_numbers) ? user.connected_numbers : [];
                                                const hasConnectedNumbers = connectedSlotCount > 0;
                                                const connectedNumbersTitle = hasConnectedNumbers
                                                    ? connectedNumbers.map(item => `${item.phone_number || 'Sin numero'}${item.slot_name ? ` · ${item.slot_name}` : ''}`).join('\n')
                                                    : 'Sin numeros conectados';
                                                const isPinned = pinnedUserIds.includes(String(user.id));
                                                return (
                                                    <tr key={user.id} className={`${isPinned ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50 transition`}>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => togglePinnedUser(user.id)}
                                                                    className={`p-1 rounded-md transition ${isPinned ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                                                                    title={isPinned ? 'Quitar pin' : 'Fijar arriba'}
                                                                    aria-label={isPinned ? 'Quitar pin del usuario' : 'Fijar usuario arriba'}
                                                                >
                                                                    <Pin size={14} fill={isPinned ? 'currentColor' : 'none'} />
                                                                </button>
                                                                <div className="font-bold text-gray-900 dark:text-white text-sm">{user.name || 'Sin nombre'}</div>
                                                                {user.is_active === false && <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-red-100 text-red-600 rounded border border-red-200">Inactivo</span>}
                                                            </div>
                                                            <div className="text-xs text-gray-500">{user.email}</div>
                                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                                {user.agency_id && <div className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded w-fit">{user.agency_id}</div>}
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${isInboxUser ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-900/40' : 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-900/40'}`}>
                                                                    {productBadgeLabel}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {user.active_plans && user.active_plans.length > 0 ? (
                                                                <div className="flex flex-col gap-1 items-start">
                                                                    {user.active_plans.map((p, idx) => (
                                                                        <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border bg-emerald-100 text-emerald-700 border-emerald-200">
                                                                            {p.name || 'Plan Activo'} {p.quantity > 1 ? `(x${p.quantity})` : ''}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${user.plan_status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : user.plan_status === 'trial' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                                    {user.plan_status ? user.plan_status.toUpperCase() : 'TRIAL'}
                                                                </span>
                                                                                                                        )}
                                                            {user.manual_entitlements_enabled === true && (
                                                                <div className="mt-2">
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                                                                        GRATIS ADMIN
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {suspensionStatus && (
                                                                <div className="mt-2 flex flex-col gap-1 items-start">
                                                                    {suspensionStatus === 'grace' && (
                                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-100 text-amber-700 border-amber-200">
                                                                            GRACE {graceDaysLeft !== null ? `(${graceDaysLeft}d)` : ''}
                                                                        </span>
                                                                    )}
                                                                    {['suspended', 'pending_deletion', 'permanently_deleted'].includes(suspensionStatus) && (
                                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border bg-red-100 text-red-700 border-red-200">
                                                                            {suspensionStatus.toUpperCase()}
                                                                        </span>
                                                                    )}
                                                                    {user.suspension_reason && (
                                                                        <span className="text-[10px] text-gray-500">{user.suspension_reason}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-gray-900 dark:text-white">{isInboxUser ? '1 fija' : (user.max_subagencies || 1)}</span>
                                                                {!isInboxUser && user.bonus_subagencies > 0 && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-bold border border-purple-200">
                                                                        +{user.bonus_subagencies} bonus
                                                                    </span>
                                                                )}
                                                                {canEditAccountLimit ? (
                                                                    <button
                                                                        onClick={() => {
                                                                            setBonusModal({
                                                                                show: true,
                                                                                userId: user.id,
                                                                                userName: user.name || user.email,
                                                                                currentBonus: user.bonus_subagencies || 0,
                                                                                maxSubs: user.max_subagencies || 1
                                                                            });
                                                                            setBonusInput(user.bonus_subagencies || 0);
                                                                        }}
                                                                        className="p-1 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition"
                                                                        title="Editar Bonus Subcuentas"
                                                                    >
                                                                        <Plus size={14} />
                                                                    </button>
                                                                ) : (
                                                                    <span
                                                                        className="text-[10px] text-gray-400"
                                                                        title="Waflow Inbox usa una cuenta fija y multiples numeros desde slots."
                                                                    >
                                                                        Bloqueado
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1" title={connectedNumbersTitle}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`h-2.5 w-2.5 rounded-full ${hasConnectedNumbers ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]' : 'bg-gray-400 dark:bg-gray-600'}`} />
                                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{connectedSlotCount}/{user.max_slots || 0}</span>
                                                                    {user.manual_entitlements_enabled === true && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold border border-amber-200">
                                                                            gratis
                                                                        </span>
                                                                    )}
                                                                    {!isInboxUser ? (
                                                                        <button
                                                                            onClick={() => {
                                                                                const maxSubagencies = user.max_subagencies || 1;
                                                                                const maxSlots = user.max_slots || 5;
                                                                                setManualEntitlementsModal({
                                                                                    show: true,
                                                                                    userId: user.id,
                                                                                    userName: user.name || user.email,
                                                                                    maxSubagencies,
                                                                                    maxSlots,
                                                                                    enabled: user.manual_entitlements_enabled === true
                                                                                });
                                                                                setManualEntitlementsInput({ maxSubagencies, maxSlots });
                                                                            }}
                                                                            className="p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition"
                                                                            title="Configurar acceso gratis manual"
                                                                        >
                                                                            <Smartphone size={14} />
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-[10px] text-gray-400" title="Los usuarios Inbox se gestionan desde slots.">Inbox</span>
                                                                    )}
                                                                </div>
                                                                <span className={`text-[10px] font-semibold ${hasConnectedNumbers ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                                                                    {hasConnectedNumbers ? `${connectedSlotCount} conectado${connectedSlotCount === 1 ? '' : 's'}` : 'sin conectar'}{totalSlotCount > 0 ? ` · ${totalSlotCount} creado${totalSlotCount === 1 ? '' : 's'}` : ''}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                                                            {user.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString() : '-'}
                                                        </td>
                                                        <td className="px-4 py-4 text-right align-middle">
                                                            <div className="grid grid-cols-4 justify-items-end gap-1 min-w-[116px] max-w-[132px] ml-auto">
                                                                {user.role !== 'admin' && (isSuspended || user.is_active === false) && (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (isSuspended) {
                                                                                openConfirm(
                                                                                    'Reactivar suspension',
                                                                                    `Quieres reactivar la cuenta de ${user.name || user.email}?`,
                                                                                    () => executeReactivateSuspension(user.id),
                                                                                    false
                                                                                );
                                                                                return;
                                                                            }

                                                                            openConfirm(
                                                                                t('dash.users.reactivate_title'),
                                                                                t('dash.users.reactivate_msg').replace('{name}', user.name || user.email),
                                                                                () => executeReactivateUser(user.id),
                                                                                false
                                                                            );
                                                                        }}
                                                                        className="col-span-4 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-lg hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 transition"
                                                                        title={t('dash.users.reactivate_tooltip')}
                                                                    >
                                                                        {t('dash.users.reactivate_button')}
                                                                    </button>
                                                                )}
                                                                {canManageTrial && (
                                                                    <button 
                                                                        onClick={() => {
                                                                            setTrialModal({ show: true, userId: user.id, userName: user.email, currentEnd: user.trial_ends_at });
                                                                            setTrialDaysInput(0); 
                                                                        }} 
                                                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800"
                                                                        title="Extender/Reducir Trial"
                                                                    >
                                                                        <CalendarDays size={16} />
                                                                    </button>
                                                                )}
                                                                
                                                                {user.role !== 'admin' && user.is_active !== false && !isSuspended && (
                                                                    <button
                                                                        onClick={() => openConfirm(
                                                                            'Inactivar suave',
                                                                            `Quieres inactivar en modo suave a ${user.name || user.email}?\n\nEsto desconecta todos sus slots sin borrar credenciales.`,
                                                                            () => executeSoftDisconnectUser(user.id),
                                                                            true
                                                                        )}
                                                                        className="p-1.5 text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition"
                                                                        title="Inactivar suave (preserva credenciales)"
                                                                    >
                                                                        <RotateCcw size={16} />
                                                                    </button>
                                                                )}
                                                                {user.role !== 'admin' && !isSuspended && (
                                                                    <button
                                                                        onClick={() => openConfirm(
                                                                            'Suspender usuario',
                                                                            `Quieres suspender temporalmente a ${user.name || user.email}?`,
                                                                            () => executeSuspendUser(user.id, 'Manual admin action'),
                                                                            true
                                                                        )}
                                                                        className="p-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition"
                                                                        title="Suspender temporalmente"
                                                                    >
                                                                        <AlertCircle size={16} />
                                                                    </button>
                                                                )}

                                                                {user.role !== 'admin' && isSuspended && (
                                                                    <button
                                                                        onClick={() => openConfirm(
                                                                            'Reactivar suspension',
                                                                            `Quieres reactivar la cuenta de ${user.name || user.email}?`,
                                                                            () => executeReactivateSuspension(user.id),
                                                                            false
                                                                        )}
                                                                        className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition"
                                                                        title="Reactivar suspension"
                                                                    >
                                                                        <CheckCircle2 size={16} />
                                                                    </button>
                                                                )}

                                                                {user.role !== 'admin' && (
                                                                    <button
                                                                        onClick={() => handleImpersonateUser(user)}
                                                                        className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition"
                                                                        title="Impersonar usuario"
                                                                    >
                                                                        <span className="text-[11px] font-bold">IMP</span>
                                                                    </button>
                                                                )}
                                                                {/* Crown button: dar plan admin */}
                                                                <button
                                                                    onClick={() => handleGrantAdmin(user.id, user.name || user.email)}
                                                                    className="p-1.5 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition"
                                                                    title="Dar Plan Admin (Ilimitado)"
                                                                >
                                                                    <div className="flex items-center justify-center">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
                                                                    </div>
                                                                </button>

                                                                {user.role !== 'admin' && (
                                                                    <button onClick={() => handleDeleteUser(user)} className={`p-1.5 rounded-lg transition ${user.is_active === false ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}`} title={user.is_active === false ? t('dash.users.reactivate_tooltip') : t('dash.users.soft_delete_tooltip')}>
                                                                        {user.is_active === false ? <RefreshCw size={16} /> : <Trash2 size={16} />}
                                                                    </button>
                                                                )}
                                                                
                                                                {/* HARD DELETE BUTTON */}
                                                                {user.role !== 'admin' && (
                                                                    <button onClick={() => handleDeleteUser(user, 'hard')} className="p-1.5 text-gray-300 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition" title={t('dash.users.hard_delete_tooltip')}>
                                                                         <AlertTriangle size={16} />
                                                                    </button>
                                                                )}
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

                {/* VISTA: AGENCIAS / SUBCUENTAS */}
                {(view === 'agencies' || view === 'subaccounts') && (
                    <>
                        <div className="mb-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            {view === 'agencies' && <SupportManager token={token} />}
                            <div className="relative w-full max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input type="text" placeholder={view === 'agencies' ? "Buscar agencia..." : "Buscar subcuenta..."} className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setSearchTerm(searchDraft); }} />
                            </div>
                        </div>
                        {view === 'agencies' && (
                            <>
                                {loading ? (
                                    <div className="text-center py-24"><RefreshCw className="animate-spin mx-auto text-indigo-600 mb-4" size={40} /><p className="text-gray-500">Cargando agencias...</p></div>
                                ) : filteredAgencies.length === 0 ? (
                                    <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700"><Building2 className="mx-auto text-gray-300 mb-4" size={64} /><p className="text-gray-500 text-lg">No se encontraron agencias.</p></div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 animate-in fade-in">
                                        {filteredAgencies.map((agency) => (
                                            <div key={agency.agency_id} onClick={() => handleAgencyClick(agency)} className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-indigo-400 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                                
                                                {/* Boton de borrar agencia */}
                                                <button 
                                                    onClick={(e) => handleDeleteAgency(e, agency.agency_id, agency.agency_name)}
                                                    className="absolute right-3 top-3 z-20 rounded-lg p-1.5 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20"
                                                    title="Eliminar Agencia Completa"
                                                >
                                                    <Trash2 size={15} />
                                                </button>

                                                <div className="absolute right-0 top-0 p-3 opacity-[0.04] transition group-hover:opacity-[0.07]"><Building2 size={64} className="text-indigo-900 dark:text-white" /></div>
                                                <div className="relative z-10">
                                                    <div className="mb-4 flex items-center gap-3"><div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-900/30 dark:text-indigo-400"><Building2 size={20} /></div><div className="min-w-0"><h3 className="truncate text-sm font-bold dark:text-white group-hover:text-indigo-600">{agency.agency_name || agency.agency_id}</h3><p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Agencia partner</p></div></div>
                                                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800"><div className="w-1/2 border-r border-gray-100 text-center dark:border-gray-800"><p className="text-xl font-bold dark:text-white">{agency.total_subaccounts}</p><p className="text-[10px] font-medium uppercase text-gray-500">Total</p></div><div className="w-1/2 text-center"><p className="text-xl font-bold text-emerald-600">{agency.active_subaccounts || 0}</p><p className="text-[10px] font-medium uppercase text-gray-500">Activas</p></div></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                        {view === 'subaccounts' && (
                            <>
                                {loading ? (
                                    <div className="text-center py-24"><RefreshCw className="animate-spin mx-auto text-indigo-600 mb-4" size={40} /><p className="text-gray-500">Cargando subcuentas...</p></div>
                                ) : filteredSubaccounts.length === 0 ? (
                                    <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700"><Smartphone className="mx-auto text-gray-300 mb-4" size={56} /><p className="text-gray-500 text-lg">Esta agencia no tiene cuentas vinculadas.</p></div>
                                ) : (
                                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-300 dark:border-gray-700 shadow-sm overflow-hidden animate-in fade-in">
                                        <div className="overflow-x-auto">
                                            <table className="admin-data-table w-full text-left border-collapse">
                                                <thead className="bg-gray-100 dark:bg-gray-950 border-b border-gray-300 dark:border-gray-800"><tr><th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Nombre</th><th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Location ID</th><th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Estado</th><th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Plan</th><th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Creado</th><th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Acciones</th></tr></thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                                    {filteredSubaccounts.map(sub => (
                                                        <tr key={sub.location_id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition">
                                                            <td className="px-6 py-4"><div className="font-bold text-gray-900 dark:text-white text-base">{sub.name || "Sin Nombre"}</div></td>
                                                            <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded text-gray-500"><Smartphone size={16} /></div><div className="font-mono text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">{sub.location_id}</div></div></td>
                                                            <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${sub.status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : sub.status === 'trial' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-red-100 text-red-800 border-red-200'}`}>{sub.status === 'active' && <CheckCircle2 size={12} className="mr-1" />}{sub.status?.toUpperCase()}</span></td>
                                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 capitalize font-medium">{sub.plan_name || 'Trial'}</td>
                                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 tabular-nums">{new Date(sub.created_at).toLocaleDateString()}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex justify-end items-center gap-2">
                                                                    <button onClick={() => setSelectedLocation(sub)} className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:text-indigo-600 hover:border-indigo-600 px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm"><Settings size={16} /> Gestionar</button>
                                                                    <button onClick={() => handleDeleteTenant(sub.location_id, sub.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="Eliminar Subcuenta"><Trash2 size={18} /></button>
                                                                </div>
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

                {/* MODAL CREAR USUARIO MANUAL */}
                {manualUserModal.show && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6">
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Plus size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Crear Usuario Manual</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Se creará un usuario en trial.</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nombre</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 rounded-xl border dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
                                        value={manualUserModal.name}
                                        onChange={e => setManualUserModal({ ...manualUserModal, name: e.target.value })}
                                        placeholder="Nombre de la agencia"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email*</label>
                                    <input
                                        type="email"
                                        className="w-full p-3 rounded-xl border dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
                                        value={manualUserModal.email}
                                        onChange={e => setManualUserModal({ ...manualUserModal, email: e.target.value })}
                                        placeholder="correo@dominio.com"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Teléfono</label>
                                    <input
                                        type="tel"
                                        className="w-full p-3 rounded-xl border dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
                                        value={manualUserModal.phone}
                                        onChange={e => setManualUserModal({ ...manualUserModal, phone: e.target.value.replace(/\D/g, '') })}
                                        placeholder="595981..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setManualUserModal({ show: false, name: "", email: "", phone: "" })} className="flex-1 py-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl font-medium text-sm transition">Cancelar</button>
                                <button onClick={handleCreateManualUser} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition">Crear</button>
                            </div>
                        </div>
                    </div>
                )}
{/* MODAL DE GESTION DE TRIAL CON INPUT */}
{trialModal.show && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6">
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Clock size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Gestionar Trial</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Usuario: <span className="font-bold text-gray-800 dark:text-white">{trialModal.userName || 'Usuario'}</span></p>
                                <p className="text-xs text-gray-400 mt-1">Vence: {trialModal.currentEnd ? new Date(trialModal.currentEnd).toLocaleDateString() : 'Hoy'}</p>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Días a agregar/quitar</label>
                                <input 
                                    type="number" 
                                    className="w-full p-4 text-center text-lg font-bold bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 dark:text-white"
                                    value={trialDaysInput}
                                    onChange={e => setTrialDaysInput(e.target.value)}
                                    placeholder="0"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">Usa números positivos para extender (ej: 7) o negativos para reducir (ej: -5).</p>
                            </div>

                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 mb-6 flex justify-between items-center">
                                <span className="text-sm font-bold text-indigo-800 dark:text-indigo-300">Nueva Fecha:</span>
                                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{calculatePreviewDate()}</span>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setTrialModal({ show: false, userId: null, userName: '', currentEnd: null })} className="flex-1 py-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl font-medium text-sm transition">Cancelar</button>
                                <button onClick={handleSaveTrial} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition"><Save size={18} /> Guardar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de gestion de bonus subcuentas */}
                {bonusModal.show && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6">
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Plus size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bonus Subcuentas</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Usuario: <span className="font-bold text-gray-800 dark:text-white">{bonusModal.userName || 'Usuario'}</span></p>
                                <p className="text-xs text-gray-400 mt-1">Subcuentas actuales: <span className="font-bold">{bonusModal.maxSubs}</span> (Bonus actual: {bonusModal.currentBonus})</p>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Subcuentas Bonus a otorgar</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    className="w-full p-4 text-center text-lg font-bold bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-900 dark:text-white"
                                    value={bonusInput}
                                    onChange={e => setBonusInput(e.target.value)}
                                    placeholder="0"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">Estas subcuentas son adicionales al plan pagado del usuario.</p>
                            </div>

                            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800 mb-6 flex justify-between items-center">
                                <span className="text-sm font-bold text-purple-800 dark:text-purple-300">Nuevas Subcuentas:</span>
                                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{(bonusModal.maxSubs - bonusModal.currentBonus) + parseInt(bonusInput || 0)}</span>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setBonusModal({ show: false, userId: null, userName: '', currentBonus: 0, maxSubs: 0 })} className="flex-1 py-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl font-medium text-sm transition">Cancelar</button>
                                <button onClick={handleSaveBonus} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition"><Save size={18} /> Guardar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de acceso gratuito manual */}
                {manualEntitlementsModal.show && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6">
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Smartphone size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Acceso gratis manual</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Usuario: <span className="font-bold text-gray-800 dark:text-white">{manualEntitlementsModal.userName || 'Usuario'}</span></p>
                                <p className="text-xs text-gray-400 mt-1">Quedara activo sin vencimiento y sin depender de Stripe.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Subcuentas permitidas</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full p-4 text-center text-lg font-bold bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-gray-900 dark:text-white"
                                        value={manualEntitlementsInput.maxSubagencies}
                                        onChange={e => setManualEntitlementsInput(prev => ({ ...prev, maxSubagencies: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Numeros WhatsApp</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full p-4 text-center text-lg font-bold bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-gray-900 dark:text-white"
                                        value={manualEntitlementsInput.maxSlots}
                                        onChange={e => setManualEntitlementsInput(prev => ({ ...prev, maxSlots: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800 mb-6 text-sm text-amber-800 dark:text-amber-200">
                                Este override marca la cuenta como activa, borra el vencimiento de trial y usa exactamente estos limites manuales.
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setManualEntitlementsModal({ show: false, userId: null, userName: '', maxSubagencies: 1, maxSlots: 5, enabled: false })} className="flex-1 py-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl font-medium text-sm transition">Cancelar</button>
                                <button onClick={handleSaveManualEntitlements} className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition"><Save size={18} /> Guardar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de confirmacion personalizado (reemplaza alertas nativas) */}
                {confirmModal.show && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 p-8 transform transition-all scale-100">
                            <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner ${confirmModal.isDestructive ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-500' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'}`}>
                                {confirmModal.isDestructive ? <AlertTriangle size={32} /> : <AlertCircle size={32} />}
                            </div>
                            
                            <h3 className="text-xl font-black text-center text-gray-900 dark:text-white mb-3">
                                {confirmModal.title}
                            </h3>
                            
                            <p className="text-center text-gray-500 dark:text-gray-400 mb-8 leading-relaxed whitespace-pre-line">
                                {confirmModal.message}
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                                    className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={() => {
                                        if (confirmModal.action) confirmModal.action();
                                        setConfirmModal({ ...confirmModal, show: false });
                                    }}
                                    className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 ${confirmModal.isDestructive ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}
                                >
                                    {confirmModal.isDestructive ? <Trash2 size={18} /> : <CheckCircle2 size={18} />}
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL LOCATION */}
                {selectedLocation && (
                    <LocationDetailsModal
                        location={selectedLocation}
                        token={token}
                        onLogout={onLogout}
                        onClose={() => setSelectedLocation(null)}
                        isAdminMode={true}
                    />
                )}
            </main>
        </div>
    );
}

