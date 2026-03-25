import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import LocationDetailsModal from './LocationDetailsModal';
import SubscriptionManager from './SubscriptionManager';
import SupportManager from './SupportManager';
import SubscriptionModal from './SubscriptionModal'; 
import SubscriptionBlocker from './SubscriptionBlocker';
import ExpiryPopup from './ExpiryPopup'; // ✅ Importar Popup
import InactiveUserModal from './InactiveUserModal'; // ✅ Importar Modal Inactivo
import InteractiveMessageBuilder from './InteractiveMessageBuilder';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSelector from '../components/LanguageSelector'; 
import { useLanguage } from '../context/LanguageContext'; 
import { useTheme } from '../context/ThemeContext';
import { useBranding } from '../context/BrandingContext';

import {
    LayoutGrid, CreditCard, LifeBuoy, LogOut,
    Plus, Search, Building2, Smartphone, RefreshCw,
    ExternalLink, Menu, CheckCircle2, ChevronRight, ArrowRight, Zap,
    TrendingUp, ShieldCheck, Settings, Trash2,
    Lock, User, Users, Moon, Sun, Link, MousePointer2,
    Key, Copy, Terminal, Globe, Save, Palette, RotateCcw, BookOpen, Hammer,
    Sparkles, Bot, CalendarCheck, MessageSquareText, Download, MessageSquare, Loader2, X, Info,
    Activity, AlertTriangle, Send // ✅ Iconos
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");
const SUPPORT_PHONE = import.meta.env.SUPPORT_PHONE || "34611770270";
const DEFAULT_GHL_INSTALL_PATH = "/integration/6968d10f1f0b9e6b537024cd";
const DEFAULT_INSTALL_APP_URL =
    import.meta.env.DEFAULT_INSTALL_APP_URL || `https://app.gohighlevel.com${DEFAULT_GHL_INSTALL_PATH}`;
const CHATWOOT_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;

function normalizeInstallLink(rawValue = "") {
    const raw = String(rawValue || "").trim();
    if (!raw) return null;

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed;
    try {
        parsed = new URL(withProtocol);
    } catch (_) {
        return null;
    }

    if (!/^https?:$/i.test(parsed.protocol)) return null;
    if (!/\/integration\/[^/?#]+/i.test(parsed.pathname)) return null;
    parsed.hash = "";
    return parsed.toString();
}

function normalizeInstallDomain(rawValue = "") {
    const raw = String(rawValue || "").trim();
    if (!raw) return null;

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed;
    try {
        parsed = new URL(withProtocol);
    } catch (_) {
        return null;
    }

    if (!/^https?:$/i.test(parsed.protocol)) return null;
    return `${parsed.protocol}//${parsed.host}`;
}

function extractInstallPath(rawInstallLink = "", fallbackPath = DEFAULT_GHL_INSTALL_PATH) {
    const normalized = normalizeInstallLink(rawInstallLink);
    if (!normalized) return fallbackPath;

    try {
        const parsed = new URL(normalized);
        const path = `${parsed.pathname}${parsed.search || ""}`;
        if (!/\/integration\/[^/?#]+/i.test(parsed.pathname)) return fallbackPath;
        return path || fallbackPath;
    } catch (_) {
        return fallbackPath;
    }
}

function buildInstallLinkFromDomain(rawDomain = "", installPath = DEFAULT_GHL_INSTALL_PATH) {
    const domain = normalizeInstallDomain(rawDomain);
    if (!domain) return null;
    const cleanPath = String(installPath || "").trim();
    if (!cleanPath) return null;
    const normalizedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
    return `${domain}${normalizedPath}`;
}

const ENV_INSTALL_APP_URL = normalizeInstallLink(
    String(import.meta.env.VITE_INSTALL_APP_URL || DEFAULT_INSTALL_APP_URL).trim()
) || DEFAULT_INSTALL_APP_URL;
const ENV_GHL_INSTALL_PATH = extractInstallPath(ENV_INSTALL_APP_URL, DEFAULT_GHL_INSTALL_PATH);

function formatRelativeTime(value) {
    if (!value) return "";
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) return "";
    const diffMs = Date.now() - ms;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "0m";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
}

function getHealthTone(status) {
    switch (String(status || "").toLowerCase()) {
        case "blocked":
        case "critical":
            return "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
        case "attention":
            return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800";
        case "paused":
            return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700";
        default:
            return "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
    }
}

function getHealthPriority(status) {
    switch (String(status || "").toLowerCase()) {
        case "blocked":
        case "critical":
            return 0;
        case "attention":
            return 1;
        case "paused":
            return 2;
        default:
            return 3;
    }
}

function getLocationRuntimeMeta(loc) {
    const totalSlots = Number.parseInt(loc?.total_slots, 10) || 0;
    const connectedSlotCount = Number.parseInt(loc?.connected_slot_count, 10) || 0;
    const reconnects24h = Number.parseInt(loc?.reconnects_24h, 10) || 0;
    const connectedNumbers = Array.isArray(loc?.connected_numbers)
        ? loc.connected_numbers.filter(Boolean)
        : [];
    const hasConnectedSlots = connectedSlotCount > 0;
    const healthStatus = String(loc?.health_status || (hasConnectedSlots ? 'healthy' : 'critical')).toLowerCase();
    const lastIncident = loc?.last_incident || null;
    const connectedPreview = connectedNumbers.slice(0, 2);
    const remainingConnected = Math.max(0, connectedNumbers.length - connectedPreview.length);

    return {
        totalSlots,
        connectedSlotCount,
        reconnects24h,
        connectedNumbers,
        hasConnectedSlots,
        healthStatus,
        lastIncident,
        connectedPreview,
        remainingConnected
    };
}

function InlineInfoHint({ text, ariaLabel = "Mas informacion" }) {
    return (
        <span className="relative inline-flex items-center group/info">
            <button
                type="button"
                aria-label={ariaLabel}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-gray-500 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"
            >
                <Info size={12} />
            </button>
            <span
                role="tooltip"
                className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-72 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] leading-5 text-gray-600 shadow-xl group-hover/info:block group-focus-within/info:block dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
                {text}
            </span>
        </span>
    );
}

function formatTimelineHour(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimelineTooltip(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString([], {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export default function AgencyDashboard({ token, onLogout }) {
    const { t, language } = useLanguage();
    // ✅ Agregamos loadAgencyBranding para cargar desde server
    const { branding, updateBranding, resetBranding, DEFAULT_BRANDING, systemBranding, loadAgencyBranding } = useBranding();

    const [storedAgencyId, setStoredAgencyId] = useState(localStorage.getItem("agencyId"));
    const queryParams = new URLSearchParams(window.location.search);
    const AGENCY_ID = storedAgencyId || queryParams.get("agencyId");
    const { theme, toggleTheme } = useTheme();

    const [activeTab, setActiveTab] = useState('overview');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAutoSyncing, setIsAutoSyncing] = useState(false);
    const [reliabilityOverview, setReliabilityOverview] = useState({
        activeAccounts: 0,
        periodHours: 24,
        timeline: [],
        totals: {},
        accountActivity: []
    });
    const [reliabilityLoading, setReliabilityLoading] = useState(false);
    const [reliabilityLastUpdated, setReliabilityLastUpdated] = useState(null);

    const [accountInfo, setAccountInfo] = useState(null);
    const isRestricted = (accountInfo?.plan || '').toLowerCase().includes('starter');
    const [crmPreference, setCrmPreference] = useState(localStorage.getItem("crmType") || "ghl");
    const agencyCrmType = String(accountInfo?.crm_type || crmPreference || "ghl").toLowerCase();
    const isGhlAgency = agencyCrmType === "ghl";
    const isChatwootAgency = agencyCrmType === "chatwoot";
    const isCrmLocked = Boolean(accountInfo?.crm_type);
    const crmLabelMap = { ghl: "GoHighLevel", waflow: "WaFloW", chatwoot: "Chatwoot", odoo: "Odoo" };
    const activeCrmLabel = crmLabelMap[agencyCrmType] || agencyCrmType.toUpperCase();
    const isSpanish = language === 'es';
    const onboardingCardTitles = {
        ghl: 'GoHighLevel',
        waflow: isSpanish ? 'Waflow Inbox' : 'Waflow Inbox',
        chatwoot: isSpanish ? 'Tu Chatwoot' : 'Your Chatwoot',
    };
    const chatwootMasterBenefitCopy = isSpanish
        ? 'Este usuario se reutiliza para aprovisionar nuevas cuentas Waflow Mensajeria hospedadas por nosotros, acelerar el alta de inboxes y usuarios, y dejar cada cuenta lista para operar sin configuraciones manuales en cada cliente.'
        : 'This master user is reused to provision new Waflow Messaging accounts hosted by us, speed up inbox and user setup, and leave each account ready to operate without manual setup for every client.';
    const [searchTerm, setSearchTerm] = useState("");
    const [userEmail, setUserEmail] = useState("");

    const [isAccountSuspended, setIsAccountSuspended] = useState(false);
    const [suspensionStatus, setSuspensionStatus] = useState(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Modal state for adding locations
    const [showAddModal, setShowAddModal] = useState(false);
    const [addModalName, setAddModalName] = useState("");
    const [addModalInboxName, setAddModalInboxName] = useState("");
    const [addModalClientName, setAddModalClientName] = useState("");
    const [addModalClientEmail, setAddModalClientEmail] = useState("");
    const [addModalClientPassword, setAddModalClientPassword] = useState("");
    const [addModalChatwootExternal, setAddModalChatwootExternal] = useState(false);
    const [addModalChatwootUrl, setAddModalChatwootUrl] = useState("");
    const [addModalChatwootAccountId, setAddModalChatwootAccountId] = useState("");
    const [addModalChatwootApiToken, setAddModalChatwootApiToken] = useState("");
    const [addModalCrmType, setAddModalCrmType] = useState(null);
    const [addModalChatwootModeLocked, setAddModalChatwootModeLocked] = useState(false);
    const [isAddingLocation, setIsAddingLocation] = useState(false);
    const [chatwootMasterConfigured, setChatwootMasterConfigured] = useState(false);
    const [chatwootMasterName, setChatwootMasterName] = useState("");
    const [chatwootMasterEmail, setChatwootMasterEmail] = useState("");
    const [chatwootMasterPassword, setChatwootMasterPassword] = useState("");
    const [chatwootMasterVerificationPassword, setChatwootMasterVerificationPassword] = useState("");
    const [chatwootMasterEmailMasked, setChatwootMasterEmailMasked] = useState("");
    const [isLoadingChatwootMaster, setIsLoadingChatwootMaster] = useState(false);
    const [isSavingChatwootMaster, setIsSavingChatwootMaster] = useState(false);
    const [isTestingChatwootMaster, setIsTestingChatwootMaster] = useState(false);
    const [chatwootMasterTestStatus, setChatwootMasterTestStatus] = useState(null);
    const chatwootMasterDraftDirtyRef = React.useRef(false);
    const chatwootMasterSavedEmailRef = React.useRef("");

    const getDaysLeft = (dateValue) => {
        if (!dateValue) return null;
        const diff = new Date(dateValue).getTime() - Date.now();
        return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
    };
    const formatDateTime = (dateValue) => {
        if (!dateValue) return null;
        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toLocaleString();
    };



    // ✅ Estado para dominio base de instalación CRM (persistido por usuario en backend)
    const [crmInstallDomain, setCrmInstallDomain] = useState(
        normalizeInstallDomain(ENV_INSTALL_APP_URL) || "https://app.gohighlevel.com"
    );
    const backendDefaultInstallLink =
        normalizeInstallLink(accountInfo?.ghl_default_installation_link || "") || ENV_INSTALL_APP_URL;
    const lockedInstallPath = extractInstallPath(backendDefaultInstallLink, ENV_GHL_INSTALL_PATH);
    const installUrlPreview =
        normalizeInstallLink(buildInstallLinkFromDomain(crmInstallDomain, lockedInstallPath) || "") ||
        normalizeInstallLink(accountInfo?.ghl_instalation_link || "") ||
        backendDefaultInstallLink;

    // Estados API Keys & Webhooks
    const [apiKeys, setApiKeys] = useState([]);
    const [loadingKeys, setLoadingKeys] = useState(false);
    const [showNewKeyModal, setShowNewKeyModal] = useState(false);
    const [generatedKey, setGeneratedKey] = useState(null);
    const [webhooks, setWebhooks] = useState([]);
    const [showNewWebhookModal, setShowNewWebhookModal] = useState(false);

    // Onboarding Wizard state
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [onboardingCrmType, setOnboardingCrmType] = useState(null); // "ghl" | "chatwoot"
    const [onboardingConnectionType, setOnboardingConnectionType] = useState(null);
    // "ghl_create_subaccount" | "chatwoot_existing" | "chatwoot_selfhosted"
    const [onboardingSubaccountName, setOnboardingSubaccountName] = useState("");
    const [onboardingSubaccountEmail, setOnboardingSubaccountEmail] = useState("");
    const [onboardingSubaccountPhone, setOnboardingSubaccountPhone] = useState("");
    const [onboardingSubaccountNotes, setOnboardingSubaccountNotes] = useState("");
    const [isCreatingSubaccount, setIsCreatingSubaccount] = useState(false);
    const [onboardingHoveredCard, setOnboardingHoveredCard] = useState(null);

    // Integration filter for accounts list
    const [accountsFilter, setAccountsFilter] = useState("all"); // "all" | "ghl" | "waflow" | "chatwoot"
    const [settingsSection, setSettingsSection] = useState("guide");

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
            throw new Error(t('agency.session_expired'));
        }
        return res;
    };

    const parseApiResponse = async (res) => {
        const rawText = await res.text();
        if (!rawText) return null;
        try {
            return JSON.parse(rawText);
        } catch (_) {
            return { rawText };
        }
    };

    const markChatwootMasterDraftDirty = () => {
        chatwootMasterDraftDirtyRef.current = true;
    };

    const applyChatwootMasterServerState = ({
        configured = false,
        name = null,
        email = null,
        emailMasked = null,
        clearPasswords = false,
        preserveDraft = false
    } = {}) => {
        setChatwootMasterConfigured(Boolean(configured));

        if (typeof emailMasked === "string") {
            setChatwootMasterEmailMasked(String(emailMasked || ""));
        }

        if (typeof email === "string") {
            const normalizedEmail = String(email || "").trim().toLowerCase();
            chatwootMasterSavedEmailRef.current = normalizedEmail;
            if (!preserveDraft) {
                setChatwootMasterEmail(normalizedEmail);
            }
        } else if (!configured) {
            chatwootMasterSavedEmailRef.current = "";
            if (!preserveDraft) {
                setChatwootMasterEmail("");
            }
        }

        if (preserveDraft) {
            return;
        }

        if (typeof name === "string") {
            setChatwootMasterName(String(name || ""));
        }

        if (clearPasswords) {
            setChatwootMasterPassword("");
            setChatwootMasterVerificationPassword("");
        }

        chatwootMasterDraftDirtyRef.current = false;
    };

    const resetOnboardingSubaccountForm = () => {
        setOnboardingSubaccountName('');
        setOnboardingSubaccountEmail('');
        setOnboardingSubaccountPhone('');
        setOnboardingSubaccountNotes('');
    };

    const fetchReliabilityOverview = async ({
        agencyId,
        crmType = accountsFilter,
        search = searchTerm,
        silent = false
    } = {}) => {
        if (!agencyId) {
            setReliabilityOverview({ activeAccounts: 0, periodHours: 24, timeline: [], totals: {}, accountActivity: [] });
            setReliabilityLastUpdated(null);
            return;
        }

        if (!silent) setReliabilityLoading(true);
        try {
            const params = new URLSearchParams({
                agencyId,
                crmType: crmType || "all",
                search: search || ""
            });
            const res = await authFetch(`/agency/reliability/overview?${params.toString()}`);
            if (!res?.ok) throw new Error(`HTTP ${res?.status || 500}`);
            const data = await res.json();
            setReliabilityOverview({
                activeAccounts: Number.parseInt(data?.active_accounts, 10) || 0,
                periodHours: Number.parseInt(data?.period_hours, 10) || 24,
                timeline: Array.isArray(data?.timeline) ? data.timeline : [],
                totals: (data?.totals && typeof data.totals === 'object') ? data.totals : {},
                accountActivity: Array.isArray(data?.account_activity) ? data.account_activity : []
            });
            setReliabilityLastUpdated(new Date().toISOString());
        } catch (error) {
            console.error("Error cargando resumen de confiabilidad", error);
            setReliabilityOverview({ activeAccounts: 0, periodHours: 24, timeline: [], totals: {}, accountActivity: [] });
        } finally {
            if (!silent) setReliabilityLoading(false);
        }
    };

    const handleReliabilityRefresh = async () => {
        const effectiveAgencyId = accountInfo?.agencyId || storedAgencyId || AGENCY_ID;
        if (!effectiveAgencyId) return;

        setReliabilityLoading(true);
        try {
            const locRes = await authFetch(`/agency/locations?agencyId=${effectiveAgencyId}`);
            if (locRes && locRes.ok) {
                const locData = await locRes.json();
                if (Array.isArray(locData)) setLocations(locData);
            }

            await fetchReliabilityOverview({
                agencyId: effectiveAgencyId,
                silent: true
            });
        } catch (error) {
            console.error("Error actualizando monitoreo", error);
        } finally {
            setReliabilityLoading(false);
        }
    };

    const refreshData = async () => {
        try {
            const [accRes, suspensionRes] = await Promise.all([
                authFetch('/agency/info'),
                authFetch('/agency/my-suspension-status')
            ]);

            if (accRes && accRes.ok) {
                const data = await accRes.json();
                setAccountInfo(data);
                const chatwootConfigured = Boolean(data.chatwoot_master_configured);
                applyChatwootMasterServerState({
                    configured: chatwootConfigured,
                    name: String(data.chatwoot_master_name || ""),
                    email: chatwootConfigured ? null : "",
                    emailMasked: String(data.chatwoot_master_email_masked || ""),
                    clearPasswords: !chatwootConfigured,
                    preserveDraft: chatwootMasterDraftDirtyRef.current
                });
                const resolvedInstallDomain = normalizeInstallDomain(
                    data.ghl_instalation_link ||
                    data.ghl_default_installation_link ||
                    ENV_INSTALL_APP_URL
                );
                if (resolvedInstallDomain) {
                    setCrmInstallDomain(resolvedInstallDomain);
                }

                let liveSuspension = null;
                if (suspensionRes && suspensionRes.ok) {
                    liveSuspension = await suspensionRes.json();
                } else if (data.suspension) {
                    liveSuspension = {
                        status: data.suspension.status || null,
                        reason: data.suspension.reason || null,
                        suspended_at: data.suspension.suspended_at || null,
                        grace_ends_at: data.suspension.grace_ends_at || null,
                        permanent_delete_at: data.suspension.permanent_delete_at || null
                    };
                }
                setSuspensionStatus(liveSuspension);

                let effectiveAgencyId = AGENCY_ID;
                if (!effectiveAgencyId && data.agencyId) {
                    effectiveAgencyId = data.agencyId;
                    setStoredAgencyId(data.agencyId);
                    localStorage.setItem("agencyId", data.agencyId);
                }

                if (effectiveAgencyId) {
                    const locRes = await authFetch(`/agency/locations?agencyId=${ data.agencyId}`);
                    if (locRes && locRes.ok) {
                        const locData = await locRes.json();
                        if (Array.isArray(locData)) setLocations(locData);
                    }
                    if (activeTab === 'reliability') {
                        await fetchReliabilityOverview({
                            agencyId: effectiveAgencyId,
                            silent: true
                        });
                    }
                }

                const planStatus = (data.plan || '').toLowerCase();
                const now = new Date();
                const trialEnd = data.trial_ends ? new Date(data.trial_ends) : null;
                const suspensionCode = (liveSuspension?.status || '').toLowerCase();
                const isHardSuspended = ['suspended', 'pending_deletion', 'permanently_deleted'].includes(suspensionCode);

                if (isHardSuspended || planStatus === 'suspended' || planStatus === 'cancelled' || planStatus === 'past_due') {
                    setIsAccountSuspended(true);
                } else if (planStatus === 'trial' && trialEnd && trialEnd < now) {
                    setIsAccountSuspended(true);
                } else {
                    setIsAccountSuspended(false);
                }
            } else if (!AGENCY_ID) {
                setLoading(false);
                return;
            }
        } catch (error) {
            console.error("Error refrescando datos", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAgencyLocationsSnapshot = async () => {
        let effectiveAgencyId = accountInfo?.agencyId || storedAgencyId || AGENCY_ID || null;

        if (!effectiveAgencyId) {
            const accRes = await authFetch('/agency/info');
            if (accRes?.ok) {
                const data = await accRes.json();
                effectiveAgencyId = data?.agencyId || null;
                if (effectiveAgencyId) {
                    localStorage.setItem("agencyId", effectiveAgencyId);
                    setStoredAgencyId(effectiveAgencyId);
                }
            }
        }

        if (!effectiveAgencyId) return [];

        const locRes = await authFetch(`/agency/locations?agencyId=${encodeURIComponent(effectiveAgencyId)}`);
        if (!locRes?.ok) return [];

        const locData = await locRes.json().catch(() => []);
        return Array.isArray(locData) ? locData : [];
    };

    const findLegacyInstalledLocation = (snapshot, baselineIds, watchStartedAt) => {
        const recentThresholdMs = watchStartedAt - 15000;

        return snapshot.find((loc) => {
            const locationId = String(loc?.location_id || "").trim();
            if (!locationId) return false;
            if (!baselineIds.has(locationId)) return true;

            const createdAtMs = loc?.created_at ? new Date(loc.created_at).getTime() : Number.NaN;
            return Number.isFinite(createdAtMs) && createdAtMs >= recentThresholdMs;
        }) || null;
    };

    const waitForLegacyInstallCompletion = async (options = {}) => {
        const {
            isCancelled = () => false,
            baselineSnapshot: providedBaselineSnapshot = null,
            watchStartedAt: providedWatchStartedAt = null,
            manageLoading = true,
            showCompletionToast = true
        } = options;
        const watchStartedAt = Number.isFinite(providedWatchStartedAt) ? providedWatchStartedAt : Date.now();
        if (manageLoading) {
            setIsAutoSyncing(true);
        }

        try {
            const baselineSnapshot = Array.isArray(providedBaselineSnapshot)
                ? providedBaselineSnapshot
                : await fetchAgencyLocationsSnapshot();
            const baselineIds = new Set(
                baselineSnapshot
                    .map((loc) => String(loc?.location_id || "").trim())
                    .filter(Boolean)
            );

            for (let attempt = 0; attempt < 20; attempt++) {
                if (isCancelled()) return;

                const snapshot = attempt === 0
                    ? baselineSnapshot
                    : await fetchAgencyLocationsSnapshot();
                const installedLocation = findLegacyInstalledLocation(snapshot, baselineIds, watchStartedAt);

                if (installedLocation) {
                    if (isCancelled()) return;
                    setLocations(snapshot);
                    await refreshData();
                    if (showCompletionToast) {
                        toast.success(t('agency.install.completed'), {
                            description: installedLocation?.name
                                ? `${installedLocation.name}`
                                : undefined
                        });
                    }
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return installedLocation;
                }

                await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            if (isCancelled()) return;
            await refreshData();
            toast.info(t('agency.install.waiting_webhook'));
            window.history.replaceState({}, document.title, window.location.pathname);
            return null;
        } catch (error) {
            if (isCancelled()) return;
            toast.error(error.message || t('agency.install.error'));
            return null;
        } finally {
            if (manageLoading && !isCancelled()) {
                setIsAutoSyncing(false);
            }
        }
    };

    const autoSyncAgency = async (locationId, code, options = {}) => {
        const { skipInstallPolling = false } = options;
        const resolvedLocationId = locationId ? String(locationId).trim() : "";
        setIsAutoSyncing(true);
        const installWatchStartedAt = Date.now();
        let installBaselineSnapshot = null;
        // const toastId = toast.loading(t('agency.install.waiting')); // Removido por overlay visual

        try {
            if (!resolvedLocationId && !code) {
                throw new Error("No se recibió location_id ni code OAuth");
            }

            if (code) {
                installBaselineSnapshot = await fetchAgencyLocationsSnapshot().catch(() => []);
            }

            // 🔥 STEP 1: Wait for GHL webhook to complete installation
            let installed = false;
            let lastCheckData = null;
            let attempts = 0;
            const maxWaitAttempts = 30; // 60 seconds max wait (30 * 2s)

            while (!skipInstallPolling && resolvedLocationId && !installed && attempts < maxWaitAttempts) {
                try {
                    const checkRes = await authFetch(`/agency/check-install/${resolvedLocationId}`);
                    if (checkRes.ok) {
                        const checkData = await checkRes.json();
                        lastCheckData = checkData;
                        if (checkData.installed) {
                            installed = true;
                            // toast.loading(t('agency.install.detected'), { id: toastId });
                            break;
                        }
                    }
                } catch (e) {
                    console.log("Waiting for install...", e.message);
                }
                
                attempts++;
                if (attempts % 5 === 0) {
                    console.log(`${t('agency.install.waiting_webhook')} (${attempts * 2}s)`);
                }
                await new Promise(r => setTimeout(r, 2000));
            }

            // No hard-fail here: if we came from legacy new_install (agency id), check-install can be false negative.
            // Continue to sync-ghl and let backend resolve/link.
            if (!installed && !code && !skipInstallPolling) {
                console.warn("[Install] check-install timeout, attempting sync-ghl anyway as fallback.");
            }

            // 🔥 STEP 2: Now call sync-ghl to link the user
            let data;
            let syncAttempts = 0;
            const maxSyncAttempts = 5;
            let lastSyncError = null;

            while (syncAttempts < maxSyncAttempts) {
                try {
                    const res = await authFetch(`/agency/sync-ghl`, {
                        method: "POST",
                        body: JSON.stringify({
                            locationIdToVerify: resolvedLocationId || null,
                            code: code || null,
                            expectedAgencyId: accountInfo?.agencyId || null
                        })
                    });

                    if (res.ok) {
                        data = await res.json();
                        break;
                    }

                    const errData = await res.json().catch(() => ({}));
                    const syncError = new Error(errData.error || t('agency.server_error'));

                    if ((res.status === 404 || res.status === 409) && !installed) {
                        lastSyncError = syncError;
                        syncAttempts++;
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }

                    syncError.nonRetryable = true;
                    throw syncError;
                } catch (e) { 
                    if (e?.nonRetryable) throw e;
                    lastSyncError = e;
                    syncAttempts++;
                    if (syncAttempts < maxSyncAttempts) {
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            }

            if (!data || !data.success) {
                throw (lastSyncError || new Error(t('agency.install.sync_failed')));
            }

            const syncedAgencyId = data.agencyId || data.newAgencyId || accountInfo?.agencyId || null;
            if (syncedAgencyId) {
                localStorage.setItem("agencyId", syncedAgencyId);
                setStoredAgencyId(syncedAgencyId);
            }

            if (data?.scope === "company" || data?.pendingLocationInstall) {
                const installedLocation = await waitForLegacyInstallCompletion({
                    baselineSnapshot: installBaselineSnapshot,
                    watchStartedAt: installWatchStartedAt,
                    manageLoading: false,
                    showCompletionToast: false
                });

                if (!installedLocation?.location_id) {
                    throw new Error(t('agency.install.waiting_webhook'));
                }

                const finalizeRes = await authFetch(`/agency/sync-ghl`, {
                    method: "POST",
                    body: JSON.stringify({
                        locationIdToVerify: installedLocation.location_id,
                        code: null,
                        expectedAgencyId: syncedAgencyId || null
                    })
                });

                if (!finalizeRes.ok) {
                    const finalizeErr = await finalizeRes.json().catch(() => ({}));
                    throw new Error(finalizeErr.error || t('agency.install.sync_failed'));
                }

                data = await finalizeRes.json();
            }

            refreshData();
            toast.success(data.message || t('agency.install.completed'));
            window.history.replaceState({}, document.title, window.location.pathname);

        } catch (error) {
            toast.error(error.message || t('agency.install.error'));
        } finally {
            setIsAutoSyncing(false);
        }
    };


    useEffect(() => {
        let cancelled = false;
        console.log("📍 URL Search Params:", window.location.search);
        const locationIdParam = queryParams.get("location_id");
        const legacyInstallParam = queryParams.get("new_install");
        const oauthCode = queryParams.get("code");
        const hasLegacyCompanyOnlyCallback = Boolean(legacyInstallParam && !locationIdParam && !oauthCode);
        const targetLocationId = locationIdParam || (oauthCode ? legacyInstallParam : "");
        console.log(`🔎 Parsed Params -> Location: ${targetLocationId}, Code: ${oauthCode ? 'PRESENT' : 'MISSING'}`);
        
        // GHL install callbacks may arrive before accountInfo loads or while the UI
        // is still pinned to another CRM in localStorage. The callback itself is the
        // source of truth here, so do not gate auto-sync by current CRM mode.
        if (hasLegacyCompanyOnlyCallback && !isAutoSyncing) {
            console.warn("[Install] Legacy callback with new_install only detected. Waiting for webhook instead of calling sync-ghl.");
            window.history.replaceState({}, document.title, window.location.pathname);
            waitForLegacyInstallCompletion({ isCancelled: () => cancelled });
        } else if ((targetLocationId || oauthCode) && !isAutoSyncing) {
            // Con OAuth code directo (marketplace), no bloqueamos esperando webhook.
            const skipInstallPolling = Boolean(oauthCode) || Boolean(legacyInstallParam && !locationIdParam) || !targetLocationId;
            autoSyncAgency(targetLocationId, oauthCode, { skipInstallPolling });
        }
        try { const payload = JSON.parse(atob(token.split('.')[1])); setUserEmail(payload.email); } catch (e) { }

        // ✅ Cargar Branding del Servidor al montar
        if(token && loadAgencyBranding) {
            loadAgencyBranding(token);
        }

        // ✅ NUEVO: Manejar retorno de Stripe
        const paymentStatus = queryParams.get("payment");
        if (paymentStatus === "success") {
            toast.success(t('agency.payment.success'), { duration: 6000 });
            // Limpiar URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (paymentStatus === "cancelled") {
            toast.error(t('agency.payment.cancelled'), { duration: 8000 });
            // Limpiar URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (AGENCY_ID) {
            refreshData();
            fetchApiKeys(); 
            fetchWebhooks(); 
            const interval = setInterval(refreshData, 30000);
            return () => clearInterval(interval);
        }
    }, [AGENCY_ID]);

    useEffect(() => {
        if (activeTab !== 'reliability') return;

        const effectiveAgencyId = accountInfo?.agencyId || storedAgencyId || AGENCY_ID || null;
        if (!effectiveAgencyId) return;

        const timer = setTimeout(() => {
            fetchReliabilityOverview({
                agencyId: effectiveAgencyId,
                crmType: accountsFilter,
                search: searchTerm
            });
        }, 250);

        return () => clearTimeout(timer);
    }, [activeTab, accountInfo?.agencyId, storedAgencyId, AGENCY_ID, accountsFilter, searchTerm]);

    const fetchWebhooks = async () => {
        try {
            const res = await authFetch('/agency/webhooks');
            if (res.ok) {
                const data = await res.json();
                setWebhooks(data.hooks);
            }
        } catch (e) { console.error("Error webhooks:", e); }
    };

    const handleCreateWebhook = async (e) => {
        e.preventDefault();
        const name = e.target.hookName.value;
        const url = e.target.hookUrl.value;
        const events = Array.from(e.target.elements)
            .filter(el => el.name === "events" && el.checked)
            .map(el => el.value);

        if (!name || !url) return toast.error(t('agency.webhook.name_url_required'));

        const tId = toast.loading(t('agency.webhook.creating'));
        try {
            const res = await authFetch('/agency/webhooks', {
                method: 'POST',
                body: JSON.stringify({ name, targetUrl: url, events })
            });
            if (res.ok) {
                toast.success(t('agency.webhook.created'), { id: tId });
                fetchWebhooks();
                setShowNewWebhookModal(false);
                e.target.reset();
            } else {
                toast.error(t('agency.webhook.create_error'), { id: tId });
            }
        } catch (err) { toast.error(t('agency.connection_error'), { id: tId }); }
    };

    const handleDeleteWebhook = async (id) => {
        if (!confirm(t('agency.webhook.confirm_delete'))) return;
        const tId = toast.loading(t('agency.webhook.deleting'));
        try {
            const res = await authFetch(`/agency/webhooks/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('agency.webhook.deleted'), { id: tId });
                fetchWebhooks();
            } else {
                toast.error(t('agency.webhook.delete_error'), { id: tId });
            }
        } catch (err) { toast.error(t('agency.connection_error'), { id: tId }); }
    };

    const fetchApiKeys = async () => {
        setLoadingKeys(true);
        try {
            const res = await authFetch('/agency/api-keys');
            if (res.ok) {
                const data = await res.json();
                setApiKeys(data.keys);
            }
        } catch (e) { console.error("Error keys:", e); } finally { setLoadingKeys(false); }
    };

    const handleGenerateKey = async (e) => {
        e.preventDefault();
        const name = e.target.keyName.value;
        if (!name) return toast.error(t('agency.apikey.name_required'));

        const tId = toast.loading(t('agency.apikey.generating'));
        try {
            const res = await authFetch('/agency/api-keys', {
                method: 'POST',
                body: JSON.stringify({ keyName: name })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(t('agency.apikey.generated'), { id: tId });
                setGeneratedKey(data.apiKey);
                setShowNewKeyModal(true);
                fetchApiKeys();
                e.target.reset();
            } else {
                toast.error(data.error || t('agency.tenant.delete_error'), { id: tId });
            }
        } catch (err) { toast.error(t('agency.connection_error'), { id: tId }); }
    };

    const handleRevokeKey = async (id) => {
        if (!confirm(t('agency.apikey.confirm_delete'))) return;
        const tId = toast.loading(t('agency.webhook.deleting'));
        try {
            const res = await authFetch(`/agency/api-keys/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('agency.apikey.deleted'), { id: tId });
                fetchApiKeys();
            } else {
                toast.error(t('agency.tenant.delete_error'), { id: tId });
            }
        } catch (err) { toast.error(t('agency.connection_error'), { id: tId }); }
    };

    const buildVoiceScript = () => {
        const apiUrl = API_URL;
        return `<script src=\"${apiUrl}/loader.js\"></script>`;
    };

    const handleDeleteTenant = async (e, locationId, name) => {
        e.stopPropagation();
        if (!confirm(`⚠️ ${t('agency.tenant.confirm_delete')} "${name || locationId}"?`)) return;
        const tId = toast.loading(t('agency.tenant.deleting'));
        try {
            const res = await authFetch(`/agency/tenants/${locationId}`, { method: 'DELETE' });
            if (res.ok) { toast.success(t('agency.tenant.deleted'), { id: tId }); refreshData(); }
            else throw new Error(t('agency.tenant.delete_error'));
        } catch (err) { toast.error(t('agency.tenant.delete_error'), { id: tId }); }
    };

    const openAddLocationModal = (options = {}) => {
        const opts = typeof options === "boolean" ? { isExternal: options } : options;
        const resolvedCrmType = String(
            opts.crmType || onboardingCrmType || agencyCrmType || "ghl"
        ).toLowerCase();
        const lockMode = Boolean(opts.lockExternalMode) && resolvedCrmType === "chatwoot";

        setAddModalName("");
        setAddModalInboxName("");
        setAddModalClientName("");
        setAddModalClientEmail("");
        setAddModalClientPassword("");
        setAddModalCrmType(resolvedCrmType);
        setAddModalChatwootModeLocked(lockMode);
        setAddModalChatwootExternal(Boolean(opts.isExternal));
        setAddModalChatwootUrl("");
        setAddModalChatwootAccountId("");
        setAddModalChatwootApiToken("");
        setShowAddModal(true);
    };

    const closeAddLocationModal = () => {
        setShowAddModal(false);
        setAddModalCrmType(null);
        setAddModalChatwootModeLocked(false);
    };

    const resetOnboardingWizard = () => {
        resetOnboardingSubaccountForm();
        setOnboardingStep(0);
        setOnboardingCrmType(null);
        setOnboardingConnectionType(null);
        setOnboardingHoveredCard(null);
    };

    const goBackToChatwootOnboarding = () => {
        closeAddLocationModal();
        resetOnboardingWizard();
        setShowOnboarding(true);
    };

    const openOnboardingChatwootAddModal = ({ external = false, onboardingType = "chatwoot" } = {}) => {
        setOnboardingCrmType(onboardingType);
        setOnboardingConnectionType(external ? "chatwoot_existing" : "waflow_crm_hosted");
        setShowOnboarding(false);
        openAddLocationModal({
            crmType: "chatwoot",
            isExternal: external,
            lockExternalMode: true
        });
    };

    const goToOnboardingConnectionStep = (crmType) => {
        setOnboardingCrmType(crmType);
        setOnboardingHoveredCard(crmType);
        setTimeout(() => {
            setOnboardingStep(1);
            setOnboardingHoveredCard(null);
        }, 120);
    };

    const openOnboardingChatwootByocFlow = () => {
        setOnboardingCrmType("chatwoot");
        setOnboardingHoveredCard("chatwoot");
        setTimeout(() => {
            setOnboardingHoveredCard(null);
            openOnboardingChatwootAddModal({ external: true, onboardingType: "chatwoot" });
        }, 120);
    };

    const openOnboardingWaflowCrmFlow = () => {
        setOnboardingCrmType("waflow_crm");
        setOnboardingHoveredCard("waflow_crm");
        setTimeout(() => {
            setOnboardingHoveredCard(null);
            openOnboardingChatwootAddModal({ external: false, onboardingType: "waflow_crm" });
        }, 120);
    };

    useEffect(() => {
        if (!showAddModal) return;
        // Some password managers/autofill tools inject values after mount; force-clear once more.
        const timer = setTimeout(() => {
            setAddModalInboxName("");
            setAddModalClientEmail("");
            setAddModalClientPassword("");
            setAddModalChatwootUrl("");
            setAddModalChatwootApiToken("");
        }, 60);
        return () => clearTimeout(timer);
    }, [showAddModal]);

    const confirmAddLocationModal = async (e) => {
        e.preventDefault();
        const currentCrmType = String(
            addModalCrmType || onboardingCrmType || agencyCrmType || "ghl"
        ).toLowerCase();
        const isChatwootView = currentCrmType === "chatwoot";
        const safeName = String(addModalName || "").trim();
        const safeInboxName = String(addModalInboxName || "").trim();
        const safeClientName = String(addModalClientName || "").trim();
        const safeClientEmail = String(addModalClientEmail || "").trim().toLowerCase();
        const rawClientPassword = String(addModalClientPassword || "");
        const safeClientRole = "administrator";

        const isExternalChatwoot = isChatwootView && Boolean(addModalChatwootExternal);
        const safeExternalUrl = String(addModalChatwootUrl || "").trim();
        const safeExternalAccountId = String(addModalChatwootAccountId || "").trim();
        const safeExternalApiToken = String(addModalChatwootApiToken || "").trim();
        const effectiveClientName = isChatwootView && !isExternalChatwoot
            ? safeName
            : safeClientName;
        const effectiveSelfManagedChatwootEmail = String(
            chatwootMasterEmail || accountInfo?.email || userEmail || ""
        ).trim().toLowerCase();
        const isSameEmailAsPrimaryChatwootUser =
            Boolean(
                isChatwootView &&
                !isExternalChatwoot &&
                safeClientEmail &&
                effectiveSelfManagedChatwootEmail &&
                safeClientEmail === effectiveSelfManagedChatwootEmail
            );
        const safeClientPassword = isSameEmailAsPrimaryChatwootUser ? "" : rawClientPassword;

        if (!safeName) {
            toast.error(
                isChatwootView
                    ? (t('dash.chatwoot_accounts.create_error') || "Error creando cuenta Chatwoot")
                    : (t('dash.locations.create_error') || "Error creando location"),
                {
                    description: t('common.name') || "Nombre requerido"
                }
            );
            return;
        }

        if (isChatwootView) {
            if (isExternalChatwoot) {
                if (!safeExternalUrl || !safeExternalAccountId || !safeExternalApiToken) {
                    toast.error(
                        t('dash.chatwoot_accounts.external_required') ||
                        "URL, ID de Cuenta y Token son requeridos para cuentas BYOC."
                    );
                    return;
                }
            }

            if (safeClientPassword && !CHATWOOT_PASSWORD_REGEX.test(safeClientPassword)) {
                toast.error(
                    t('dash.chatwoot_accounts.password_invalid') || "Contraseña inválida",
                    { description: t('dash.chatwoot_accounts.password_rules') || "Debe tener mínimo 6 caracteres, incluyendo mayúscula, minúscula, número y símbolo." }
                );
                return;
            }

            if (!isExternalChatwoot && safeClientPassword && !safeClientEmail) {
                toast.error(
                    t('dash.chatwoot_accounts.client_email_required') || "El email del cliente final es requerido."
                );
                return;
            }

            if (safeClientEmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(safeClientEmail)) {
                    toast.error(
                        t('dash.chatwoot_accounts.client_email_invalid') || "Email del cliente final inválido."
                    );
                    return;
                }

                try {
                    const shouldSkipSelfManagedPrecheck =
                        isSameEmailAsPrimaryChatwootUser && !safeClientPassword;
                    const emailCheck = shouldSkipSelfManagedPrecheck
                        ? { exists: true, credentials: { checked: false, valid: null }, skippedBecauseSharedPrimaryUser: true }
                        : await checkChatwootEmailAvailability({
                            email: safeClientEmail,
                            password: safeClientPassword
                        });

                    if (emailCheck?.exists && !safeClientPassword && !isSameEmailAsPrimaryChatwootUser) {
                        toast.error(
                            t('dash.chatwoot_accounts.client_email_exists_password_required') ||
                            "Ese email ya existe en Chatwoot. Debes indicar su contraseña actual o usar otro email."
                        );
                        return;
                    }

                    if (emailCheck?.exists && emailCheck?.credentials?.checked && emailCheck.credentials.valid === false) {
                        toast.error(
                            t('dash.chatwoot_accounts.client_email_exists_invalid_password') ||
                            "Ese email ya existe en Chatwoot y la contraseña indicada no coincide."
                        );
                        return;
                    }
                } catch (precheckErr) {
                    toast.error(precheckErr.message || "No se pudo verificar el email en Chatwoot");
                    return;
                }
            }
        }

        setIsAddingLocation(true);
        const loadingId = toast.loading(t('common.create') || "Crear");
        try {
            const bodyPayload = {
                name: safeName,
                crmType: isExternalChatwoot ? "chatwoot_external" : currentCrmType
            };

            if (isChatwootView) {
                bodyPayload.inboxName = safeInboxName;
                if (isExternalChatwoot) {
                    bodyPayload.chatwootUrl = safeExternalUrl;
                    bodyPayload.chatwootAccountId = safeExternalAccountId;
                    bodyPayload.chatwootApiToken = safeExternalApiToken;
                } else if (safeClientEmail) {
                    bodyPayload.clientName = effectiveClientName;
                    bodyPayload.clientEmail = safeClientEmail;
                    bodyPayload.clientRole = safeClientRole;
                    if (safeClientPassword) {
                        bodyPayload.clientPassword = safeClientPassword;
                    }
                }
            }

            const res = await authFetch('/agency/add-location', {
                method: 'POST',
                body: JSON.stringify(bodyPayload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
                throw new Error(
                    data?.error || (
                        isChatwootView
                            ? (t('dash.chatwoot_accounts.create_error') || "Error creando cuenta Chatwoot")
                            : (t('dash.locations.create_error') || "Error creando location")
                    )
                );
            }
            toast.success(
                isChatwootView
                    ? (t('dash.chatwoot_accounts.created') || "Cuenta Chatwoot creada")
                    : (t('dash.locations.created') || "Location creada"),
                { id: loadingId }
            );

            if (isChatwootView && data?.chatwootClient?.provisioned) {
                const generatedPassword = String(data.chatwootClient.generatedPassword || "");
                const safeEmail = String(data.chatwootClient.email || "").trim();
                const safeRoleLabel = data.chatwootClient.role === "administrator"
                    ? (t('dash.chatwoot_accounts.client_role_admin') || "Administrador")
                    : (t('dash.chatwoot_accounts.client_role_agent') || "Agente (Recomendado)");

                toast.success(
                    t('dash.chatwoot_accounts.client_access_ready') || "Acceso del cliente final listo",
                    {
                        description: generatedPassword
                            ? `${safeEmail} (${safeRoleLabel}) | Password temporal: ${generatedPassword}`
                            : data.chatwootClient.reusedMasterUser
                                ? `${safeEmail} (${safeRoleLabel}) | ${t('dash.chatwoot_accounts.shared_primary_access') || "usando el mismo acceso principal"}`
                                : `${safeEmail} (${safeRoleLabel})`
                    }
                );
            }

            closeAddLocationModal();
            setAddModalName(""); // ✅ Clean up input form
            setAddModalInboxName("");
            setAddModalClientName("");
            setAddModalClientEmail("");
            setAddModalClientPassword("");
            await refreshData();
        } catch (e) {
            toast.error(
                isChatwootView
                    ? (t('dash.chatwoot_accounts.create_error') || "Error creando cuenta Chatwoot")
                    : (t('dash.locations.create_error') || "Error creando location"),
                {
                    id: loadingId,
                    description: e.message
                }
            );
        } finally {
            setIsAddingLocation(false);
        }
    };

    // ✅ LÓGICA DE INSTALACIÓN DINÁMICA
    const handleInstallApp = async (options = {}) => {
        const opts = typeof options === "string" ? { installUrl: options } : options;
        const resolvedInstallUrl =
            normalizeInstallLink(opts.installUrl || "") ||
            normalizeInstallLink(installUrlPreview || "");
        const popupWindow = opts.popupWindow || null;

        if (!resolvedInstallUrl) {
            if (popupWindow && !popupWindow.closed) {
                popupWindow.close();
            }
            toast.error(t('agency.crm.invalid_domain') || "Ingresa un dominio válido de GHL");
            return false;
        }

        const tId = toast.loading(t('agency.install.verifying'));
        try {
            const res = await authFetch('/agency/validate-limits?type=tenant');
            const data = await res.json();

            toast.dismiss(tId);

            if (data.allowed) {
                const pendingRes = await authFetch('/agency/ghl-install-pending', {
                    method: 'POST'
                });
                const pendingData = await pendingRes.json().catch(() => ({}));
                if (!pendingRes.ok || !pendingData?.success) {
                    throw new Error(pendingData.error || t('agency.install.error'));
                }

                console.log("Redirigiendo a:", resolvedInstallUrl);
                if (popupWindow && !popupWindow.closed) {
                    try {
                        popupWindow.opener = null;
                    } catch (_) { }
                    popupWindow.location.href = resolvedInstallUrl;
                } else if (opts.newTab) {
                    window.open(resolvedInstallUrl, "_blank", "noopener");
                } else {
                    window.location.href = resolvedInstallUrl;
                }
                return true;
            } else {
                if (popupWindow && !popupWindow.closed) {
                    popupWindow.close();
                }
                toast.error(t('agency.install.limit_reached'), { description: data.reason });
                setShowUpgradeModal(true);
                return false;
            }
        } catch (e) {
            if (popupWindow && !popupWindow.closed) {
                popupWindow.close();
            }
            toast.dismiss(tId);
            toast.error(t('agency.install.limit_error'));
            return false;
        }
    };

    const handleInstallExistingGhlAccount = async () => {
        const popupWindow = window.open("about:blank", "_blank");
        const installed = await handleInstallApp({
            installUrl: ENV_INSTALL_APP_URL,
            popupWindow
        });

        if (installed) {
            setShowOnboarding(false);
            setOnboardingConnectionType(null);
        }
    };

    // ✅ GUARDAR LINK DE INSTALACIÓN CRM POR USUARIO
    const handleSaveCrmDomain = async (options = {}) => {
        const opts = typeof options === "boolean" ? { silentSuccess: options } : options;
        const normalizedDomain = normalizeInstallDomain(crmInstallDomain || "");
        if (!normalizedDomain) {
            toast.error(t('agency.crm.invalid_domain') || "Ingresa un dominio válido de GHL");
            return null;
        }

        const normalizedLink = buildInstallLinkFromDomain(normalizedDomain, lockedInstallPath);
        if (!normalizedLink) {
            toast.error(t('agency.crm.invalid_domain') || "Ingresa un dominio válido de GHL");
            return null;
        }

        const tId = toast.loading(t('common.save'));
        try {
            const res = await authFetch('/agency/ghl-installation-link', {
                method: 'PUT',
                body: JSON.stringify({
                    ghl_installation_domain: normalizedDomain,
                    ghl_instalation_link: normalizedLink
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || t('agency.server_error'));
            }

            const savedLink = normalizeInstallLink(data.ghl_instalation_link || "") || normalizedLink;
            const savedDomain = normalizeInstallDomain(savedLink) || normalizedDomain;

            setCrmInstallDomain(savedDomain);
            setAccountInfo(prev => prev ? { ...prev, ghl_instalation_link: savedLink } : prev);
            if (!opts.silentSuccess) {
                toast.success(t('agency.crm.domain_saved'), {
                    id: tId,
                    description: `${t('agency.crm.domain_saved_desc')} ${savedLink}`
                });
            } else {
                toast.dismiss(tId);
            }
            return savedLink;
        } catch (e) {
            toast.error(e.message || t('agency.connection_error'), { id: tId });
            return null;
        }
    };

    const fetchChatwootMasterUser = async ({ silent = true } = {}) => {
        if (agencyCrmType !== "chatwoot") return;
        setIsLoadingChatwootMaster(true);
        try {
            const res = await authFetch('/agency/chatwoot/master-user');
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "No se pudo cargar la configuración maestra de Chatwoot");
            }

            const configured = Boolean(data.configured);
            const preserveDraft = chatwootMasterDraftDirtyRef.current;
            applyChatwootMasterServerState({
                configured,
                name: String(data.masterName || ""),
                email: configured ? String(data.masterEmail || "") : "",
                emailMasked: String(data.masterEmailMasked || ""),
                clearPasswords: !configured,
                preserveDraft
            });
            if (!preserveDraft) {
                setChatwootMasterVerificationPassword("");
            }
        } catch (e) {
            if (!silent) {
                toast.error(e.message || "Error cargando usuario maestro de Chatwoot");
            }
        } finally {
            setIsLoadingChatwootMaster(false);
        }
    };

    const checkChatwootEmailAvailability = async ({ email, password = "" } = {}) => {
        const safeEmail = String(email || "").trim().toLowerCase();
        if (!safeEmail) {
            return { exists: false, credentials: { checked: false, valid: null } };
        }

        const res = await authFetch('/agency/chatwoot/check-email', {
            method: 'POST',
            body: JSON.stringify({
                email: safeEmail,
                password: String(password || "")
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) {
            throw new Error(data?.error || "No se pudo verificar el email en Chatwoot");
        }
        return data;
    };

    const handleSaveChatwootMasterUser = async (e) => {
        if (e?.preventDefault) e.preventDefault();

        const safeName = String(chatwootMasterName || "").trim();
        const safeEmail = String(chatwootMasterEmail || "").trim().toLowerCase();
        const safePassword = String(chatwootMasterPassword || "");
        const safeVerificationPassword = String(chatwootMasterVerificationPassword || "");

        if (!safeName || !safeEmail || !safePassword) {
            toast.error(t('dash.chatwoot_master.required') || "Completa nombre, email y contraseña del usuario maestro.");
            return false;
        }

        if (chatwootMasterConfigured && !safeVerificationPassword) {
            toast.error(t('dash.chatwoot_master.verify_required') || "Ingresa la contraseña actual para verificar los cambios.");
            return false;
        }

        if (!CHATWOOT_PASSWORD_REGEX.test(safePassword)) {
            toast.error(
                t('dash.chatwoot_accounts.password_invalid') || "Contraseña inválida",
                { description: t('dash.chatwoot_accounts.password_rules') || "Debe tener mínimo 6 caracteres, incluyendo mayúscula, minúscula, número y símbolo." }
            );
            return false;
        }

        const previousMasterEmail = String(chatwootMasterSavedEmailRef.current || "").trim().toLowerCase();
        const shouldPrecheckMasterEmail = !chatwootMasterConfigured || safeEmail !== previousMasterEmail;
        if (shouldPrecheckMasterEmail) {
            try {
                const emailCheck = await checkChatwootEmailAvailability({
                    email: safeEmail,
                    password: safePassword
                });
                if (emailCheck?.exists && emailCheck?.credentials?.checked && emailCheck.credentials.valid === false) {
                    toast.error(
                        t('dash.chatwoot_master.email_exists_invalid_password') ||
                        "Ese email ya existe en Chatwoot y la contraseña indicada no coincide."
                    );
                    return false;
                }
            } catch (precheckErr) {
                toast.error(precheckErr.message || "No se pudo verificar el email en Chatwoot");
                return false;
            }
        }

        setIsSavingChatwootMaster(true);
        const loadingId = toast.loading(t('common.save') || "Guardar");
        try {
            const res = await authFetch('/agency/chatwoot/master-user', {
                method: 'PUT',
                body: JSON.stringify({
                    masterName: safeName,
                    masterEmail: safeEmail,
                    masterPassword: safePassword,
                    verificationPassword: safeVerificationPassword
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "No se pudo guardar el usuario maestro de Chatwoot");
            }

            applyChatwootMasterServerState({
                configured: Boolean(data.configured),
                name: String(data.masterName || safeName),
                email: String(data.masterEmail || safeEmail),
                emailMasked: String(data.masterEmailMasked || ""),
                clearPasswords: true,
                preserveDraft: false
            });
            setAccountInfo(prev => prev ? {
                ...prev,
                chatwoot_master_configured: true,
                chatwoot_master_name: String(data.masterName || safeName),
                chatwoot_master_email_masked: String(data.masterEmailMasked || "")
            } : prev);

            toast.success(
                t('dash.chatwoot_master.saved') || "Usuario maestro de Chatwoot guardado",
                { id: loadingId }
            );
            return true;
        } catch (e2) {
            toast.error(e2.message || "No se pudo guardar el usuario maestro de Chatwoot", { id: loadingId });
            return false;
        } finally {
            setIsSavingChatwootMaster(false);
        }
    };

    const handleTestChatwootMasterUser = async () => {
        if (agencyCrmType !== "chatwoot") return;

        setIsTestingChatwootMaster(true);
        const loadingId = toast.loading(t('dash.chatwoot_master.testing') || "Probando conexión...");
        try {
            const res = await authFetch('/agency/chatwoot/master-user/test', {
                method: 'POST'
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || (t('dash.chatwoot_master.test_error') || "No se pudo validar el Usuario Maestro."));
            }

            const safeName = String(data.masterName || chatwootMasterName || "").trim();
            const safeEmail = String(data.masterEmail || chatwootMasterEmail || "").trim().toLowerCase();
            const safeEmailMasked = String(data.masterEmailMasked || chatwootMasterEmailMasked || "");
            const successMessage = String(data.message || "").trim() || (t('dash.chatwoot_master.test_success') || "Conexión validada correctamente.");

            chatwootMasterSavedEmailRef.current = safeEmail;
            chatwootMasterDraftDirtyRef.current = false;
            setChatwootMasterConfigured(Boolean(data.configured));
            setChatwootMasterName(safeName);
            setChatwootMasterEmail(safeEmail);
            setChatwootMasterEmailMasked(safeEmailMasked);
            setChatwootMasterTestStatus({
                ok: true,
                message: successMessage,
                checkedAt: Date.now()
            });
            setAccountInfo(prev => prev ? {
                ...prev,
                chatwoot_master_configured: Boolean(data.configured),
                chatwoot_master_name: safeName,
                chatwoot_master_email_masked: safeEmailMasked
            } : prev);

            toast.success(successMessage, { id: loadingId });
        } catch (err) {
            const errorMessage = String(err?.message || "").trim() || (t('dash.chatwoot_master.test_error') || "No se pudo validar el Usuario Maestro.");
            setChatwootMasterTestStatus({
                ok: false,
                message: errorMessage,
                checkedAt: Date.now()
            });
            toast.error(t('dash.chatwoot_master.test_error') || "No se pudo validar el Usuario Maestro.", {
                id: loadingId,
                description: errorMessage
            });
        } finally {
            setIsTestingChatwootMaster(false);
        }
    };

    const openGhlPortal = () => {
        try {
            const parsed = new URL(installUrlPreview);
            window.open(`${parsed.protocol}//${parsed.host}`, "_blank", "noopener");
        } catch (_) {
            window.open("https://app.gohighlevel.com", "_blank", "noopener");
        }
    };
    const openChatwootPortal = () => {
        // Try to open the user's own Chatwoot instance from tenant settings
        const cwTenant = locations.find(l => {
            const s = l.settings || {};
            return s.crm_type === 'chatwoot' && s.chatwoot_url;
        });
        const cwUrl = cwTenant?.settings?.chatwoot_url || "https://www.chatwoot.com";
        window.open(cwUrl, "_blank", "noopener");
    };
    const handleSelectCrm = (crmType) => {
        if (isCrmLocked) {
            toast.info(t('agency.integrations.locked'));
            return;
        }
        setCrmPreference(crmType);
        localStorage.setItem("crmType", crmType);
        if (crmType === "odoo") {
            toast.info(t('agency.integrations.coming_soon'));
        }
    };

    useEffect(() => {
        localStorage.setItem("crmType", crmPreference);
    }, [crmPreference]);

    useEffect(() => {
        if (agencyCrmType !== "chatwoot") return;
        fetchChatwootMasterUser({ silent: true });
    }, [agencyCrmType]);

    const renderIntegrationsPanel = (variant = "settings") => {
        const isOverview = variant === "overview";
        const panelPadding = isOverview ? "p-5" : "p-5";
        const gridClass = isOverview ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-3";
        const cardClass = isOverview
            ? "border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-900 hover:shadow-sm transition-all"
            : "border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-gray-50/70 dark:bg-gray-800/40";
        const descKey = isOverview ? 'agency.integrations.overview_desc' : 'agency.integrations.desc';
        const showContextConfig = !isOverview;

        const renderCard = (id, name, desc, Icon, options = {}) => {
            const isSelected = agencyCrmType === id;
            const isLocked = isCrmLocked && !isSelected;
            const isSoon = Boolean(options.soon);
            const canSelect = !isLocked && !isSoon;
            const statusLabel = isLocked
                ? t('agency.integrations.status_locked')
                : isSoon
                    ? t('agency.integrations.status_soon')
                    : isSelected
                        ? t('agency.integrations.status_active')
                        : t('agency.integrations.status_available');
            const statusClass = isLocked
                ? 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-800'
                : isSoon
                    ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                    : isSelected
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-800';

            return (
                <div
                    key={id}
                    onClick={() => {
                        if (canSelect) handleSelectCrm(id);
                    }}
                    className={`${cardClass} ${canSelect ? "cursor-pointer" : ""}`}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
                                <Icon size={15} className={isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-300"} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{name}</h4>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${statusClass}`}>
                                {statusLabel}
                            </span>
                            {!isSoon && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectCrm(id);
                                    }}
                                    disabled={isLocked || isSelected}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                                        isSelected
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                                            : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-700 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700"
                                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                                >
                                    {isSelected ? t('agency.integrations.selected') : t('agency.integrations.select')}
                                </button>
                            )}
                            {options.showOpen && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        options.onOpen?.();
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
                                >
                                    <ExternalLink size={12} /> {t('agency.integrations.open')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        };

        const renderSelectedConfigPanel = () => {
            if (!showContextConfig) return null;

            if (agencyCrmType === "ghl") {
                return (
                    <div className="mt-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 space-y-4">
                        <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                {((t('agency.integrations.config_for') || "Configuración de {crm}")).replace("{crm}", "GoHighLevel")}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {t('agency.integrations.ghl_config_desc') || "Configura el link de instalación y las notas de voz para dejar el onboarding listo en un solo paso."}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                                <div className="mb-3">
                                    <h5 className="text-sm font-bold text-gray-900 dark:text-white">{t('agency.voice.title')}</h5>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                                    {t('agency.voice.desc')}
                                </p>
                                <div className="relative rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
                                    <pre className="text-[11px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap pr-8">{buildVoiceScript()}</pre>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(buildVoiceScript());
                                            toast.success(t('common.copied') || "Copiado");
                                        }}
                                        className="absolute right-2 top-2 p-1.5 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-900 transition"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(buildVoiceScript());
                                            toast.success(t('common.copied') || "Copiado");
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-500 transition"
                                    >
                                        <Copy size={13} /> {t('agency.integrations.voice_copy_script') || "Copiar script"}
                                    </button>
                                </div>
                                {isRestricted && (
                                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2">
                                        {t('agency.integrations.voice_requires_pro') || "Notas de voz requiere plan superior."}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            }

            if (agencyCrmType === "chatwoot") {
                return (
                    <div className="mt-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-5">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                    {((t('agency.integrations.config_for') || "Configuración de {crm}")).replace("{crm}", "Chatwoot")}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    {t('agency.integrations.chatwoot_config_desc') || "Define el Usuario Maestro para aprovisionar cuentas Chatwoot hospedadas automáticamente."}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${
                                    chatwootMasterConfigured
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                                }`}>
                                    {chatwootMasterConfigured
                                        ? (t('agency.integrations.chatwoot_master_state_ready') || "Usuario maestro configurado")
                                        : (t('agency.integrations.chatwoot_master_state_pending') || "Pendiente de configuración")}
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleSaveChatwootMasterUser} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                                    {t('dash.chatwoot_master.name') || "Nombre del Usuario Maestro"}
                                </label>
                                <input
                                    type="text"
                                    value={chatwootMasterName}
                                    onChange={(e) => {
                                        markChatwootMasterDraftDirty();
                                        setChatwootMasterName(e.target.value);
                                    }}
                                    placeholder="Ej: Soporte Agencia"
                                    autoComplete="off"
                                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                                    {t('dash.chatwoot_master.email') || "Email del Usuario Maestro"}
                                </label>
                                <input
                                    type="email"
                                    value={chatwootMasterEmail}
                                    onChange={(e) => {
                                        markChatwootMasterDraftDirty();
                                        setChatwootMasterEmail(e.target.value);
                                    }}
                                    placeholder="soporte@agencia.com"
                                    autoComplete="off"
                                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                {chatwootMasterConfigured && chatwootMasterEmailMasked && (
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                                        {(t('dash.chatwoot_master.configured_as') || "Configurado como") + ` ${chatwootMasterEmailMasked}`}
                                    </p>
                                )}
                            </div>
                            {chatwootMasterConfigured && (
                                <div className="xl:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                                        {t('dash.chatwoot_master.verify_password') || "Contraseña actual para verificar cambios"}
                                    </label>
                                    <input
                                        type="password"
                                        value={chatwootMasterVerificationPassword}
                                        onChange={(e) => {
                                            markChatwootMasterDraftDirty();
                                            setChatwootMasterVerificationPassword(e.target.value);
                                        }}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                        {t('dash.chatwoot_master.verify_password_desc') || "Antes de guardar cambios, verifica con la contraseña actual del Usuario Maestro."}
                                    </p>
                                </div>
                            )}
                            <div className="xl:col-span-2">
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                                    {chatwootMasterConfigured
                                        ? (t('dash.chatwoot_master.new_password') || "Nueva contraseña del Usuario Maestro")
                                        : (t('dash.chatwoot_master.password') || "Contraseña del Usuario Maestro")}
                                </label>
                                <input
                                    type="password"
                                    value={chatwootMasterPassword}
                                    onChange={(e) => {
                                        markChatwootMasterDraftDirty();
                                        setChatwootMasterPassword(e.target.value);
                                    }}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="xl:col-span-2 flex flex-wrap justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={handleTestChatwootMasterUser}
                                    disabled={isTestingChatwootMaster || isLoadingChatwootMaster}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-60 transition-colors"
                                >
                                    {isTestingChatwootMaster ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                                    {t('dash.chatwoot_master.test_button') || "Probar conexión"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fetchChatwootMasterUser({ silent: false })}
                                    disabled={isLoadingChatwootMaster || isTestingChatwootMaster}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors"
                                >
                                    <RotateCcw size={13} />
                                    {isLoadingChatwootMaster ? (t('common.loading') || "Cargando...") : (t('common.reload') || "Recargar")}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingChatwootMaster}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-60"
                                >
                                    {isSavingChatwootMaster ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    {t('dash.chatwoot_master.save') || "Guardar Usuario Maestro"}
                                </button>
                            </div>
                            {chatwootMasterTestStatus?.message && (
                                <p className={`xl:col-span-2 text-[11px] ${
                                    chatwootMasterTestStatus.ok
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-rose-600 dark:text-rose-400"
                                }`}>
                                    {chatwootMasterTestStatus.message}
                                </p>
                            )}
                        </form>
                    </div>
                );
            }

            return null;
        };

        return (
            <div className={`bg-white dark:bg-gray-900 ${panelPadding} rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm`}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Link size={16} className="text-indigo-500" /> {t('agency.integrations.title')}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t(descKey)}
                        </p>
                    </div>
                </div>
                <div className={gridClass}>
                    {renderCard("ghl", "GoHighLevel", t('agency.integrations.ghl_desc'), Globe, { showOpen: true, onOpen: openGhlPortal })}
                    {renderCard("chatwoot", "Chatwoot", t('agency.integrations.chatwoot_desc'), MessageSquareText, { showOpen: true, onOpen: openChatwootPortal })}
                </div>
                {renderSelectedConfigPanel()}
            </div>
        );
    };

    const renderIntegrationPlaceholder = (titleKey, descKey) => (
        <div className="max-w-5xl mx-auto bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-10 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {t(titleKey).replace('{crm}', activeCrmLabel)}
                    </h3>
                    <p className="text-sm text-gray-500 mt-2">
                        {t(descKey).replace('{crm}', activeCrmLabel)}
                    </p>
                </div>
                <button
                    onClick={() => window.open(`https://wa.me/${SUPPORT_PHONE}`, "_blank", "noopener")}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md transition"
                >
                    <LifeBuoy size={16} /> {t('agency.integrations.contact_support')}
                </button>
            </div>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50/60 dark:bg-gray-800/40">
                    <div className="text-xs uppercase tracking-widest text-gray-400">{t('agency.integrations.step_one')}</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mt-2">{t('agency.integrations.step_one_desc')}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50/60 dark:bg-gray-800/40">
                    <div className="text-xs uppercase tracking-widest text-gray-400">{t('agency.integrations.step_two')}</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mt-2">{t('agency.integrations.step_two_desc')}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50/60 dark:bg-gray-800/40">
                    <div className="text-xs uppercase tracking-widest text-gray-400">{t('agency.integrations.step_three')}</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mt-2">{t('agency.integrations.step_three_desc')}</div>
                </div>
            </div>
        </div>
    );

    const parseTenantSettings = (tenant) => {
        let settings = tenant?.settings || {};
        if (typeof settings === "string") {
            try {
                settings = JSON.parse(settings);
            } catch (_) {
                settings = {};
            }
        }
        return settings;
    };

    const isEnabledTenantFlag = (value) =>
        value === true ||
        value === "true" ||
        value === 1 ||
        value === "1";

    const resolveTenantCrmType = (tenant) => {
        const settings = parseTenantSettings(tenant);
        const tenantCrm = String(settings?.crm_type || "").trim().toLowerCase();
        if (tenantCrm === "ghl" || tenantCrm === "chatwoot") {
            return tenantCrm;
        }

        const hasChatwootHints = Boolean(
            settings?.chatwoot_url ||
            settings?.chatwoot_api_token ||
            settings?.chatwoot_account_id
        );
        return hasChatwootHints ? "chatwoot" : "ghl";
    };

    const resolveTenantProductType = (tenant) => {
        const crmType = resolveTenantCrmType(tenant);
        if (crmType !== "chatwoot") return crmType;

        const settings = parseTenantSettings(tenant);
        const isByoc = isEnabledTenantFlag(settings?.is_byoc);
        const isAutoProvisioned = isEnabledTenantFlag(settings?.is_auto_provisioned);

        if (isAutoProvisioned && !isByoc) {
            return "waflow";
        }

        return "chatwoot";
    };

    const getTenantProductMeta = (tenant) => {
        const productType = resolveTenantProductType(tenant);

        if (productType === "waflow") {
            return {
                type: "waflow",
                label: "WaFloW",
                icon: Sparkles,
                badgeClassName: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800"
            };
        }

        if (productType === "chatwoot") {
            return {
                type: "chatwoot",
                label: "Chatwoot",
                icon: MessageSquareText,
                badgeClassName: "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800"
            };
        }

        return {
            type: "ghl",
            label: "GoHighLevel",
            icon: Globe,
            badgeClassName: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
        };
    };

    // Integration filter: show all locations or filtered by visible product type
    const accountsFilteredLocations = accountsFilter === "all"
        ? locations
        : locations.filter((loc) => resolveTenantProductType(loc) === accountsFilter);

    const filteredLocations = accountsFilteredLocations.filter(loc =>
        (loc.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (loc.location_id || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );
    const filteredLocationCards = filteredLocations.map((loc) => ({
        loc,
        ...getLocationRuntimeMeta(loc)
    }));
    const activeLocationRows = locations.filter((loc) => (Number.parseInt(loc?.connected_slot_count, 10) || 0) > 0);
    const reliabilityFilterOptions = [
        { id: 'all', label: t('agency.onboarding.filter_all') || 'Todas', icon: null, count: activeLocationRows.length },
        { id: 'ghl', label: 'GoHighLevel', icon: Globe, count: activeLocationRows.filter((l) => resolveTenantProductType(l) === 'ghl').length },
        { id: 'waflow', label: 'WaFloW', icon: Sparkles, count: activeLocationRows.filter((l) => resolveTenantProductType(l) === 'waflow').length },
        { id: 'chatwoot', label: 'Chatwoot', icon: MessageSquare, count: activeLocationRows.filter((l) => resolveTenantProductType(l) === 'chatwoot').length }
    ];
    const reliabilityBaseCards = filteredLocationCards.filter((entry) => entry.connectedSlotCount > 0);
    const reliabilitySummary = reliabilityBaseCards.reduce((acc, entry) => {
        acc.connectedSlots += entry.connectedSlotCount;
        acc.totalSlots += entry.totalSlots;

        return acc;
    }, {
        connectedSlots: 0,
        totalSlots: 0
    });
    const accountFilterOptions = [
        { id: 'all', label: t('agency.onboarding.filter_all') || 'Todas', icon: null, count: locations.length },
        { id: 'ghl', label: 'GoHighLevel', icon: Globe, count: locations.filter((l) => resolveTenantProductType(l) === 'ghl').length },
        { id: 'waflow', label: 'WaFloW', icon: Sparkles, count: locations.filter((l) => resolveTenantProductType(l) === 'waflow').length },
        { id: 'chatwoot', label: 'Chatwoot', icon: MessageSquare, count: locations.filter((l) => resolveTenantProductType(l) === 'chatwoot').length }
    ];
    const reliabilityTotalAccounts = reliabilityBaseCards.length;
    const reliabilityTimeline = Array.isArray(reliabilityOverview?.timeline) ? reliabilityOverview.timeline : [];
    const reliabilityTotals = reliabilityOverview?.totals || {};
    const accountActivity = Array.isArray(reliabilityOverview?.account_activity)
        ? reliabilityOverview.account_activity
        : (Array.isArray(reliabilityOverview?.accountActivity) ? reliabilityOverview.accountActivity : []);
    const timelineSummary = reliabilityTimeline.reduce((acc, item) => {
        const sent = Number(item?.sent) || 0;
        const failed = Number(item?.failed) || 0;
        const total = Number(item?.total) || 0;
        acc.sent += sent;
        acc.failed += failed;
        if (total > 0) acc.activeHours += 1;
        return acc;
    }, { sent: 0, failed: 0, activeHours: 0 });
    const reliabilityPeriodHours = Number.parseInt(reliabilityOverview?.periodHours, 10) || 24;
    const reliabilityTrendPoints = reliabilityTimeline.map((point) => ({
        bucketStart: point?.bucket_start,
        sent: Number(point?.sent) || 0,
        failed: Number(point?.failed) || 0
    }));
    const reliabilityTrendMax = reliabilityTrendPoints.reduce(
        (max, point) => Math.max(max, point.sent, point.failed),
        0
    );
    const replyRate24h = Number(reliabilityTotals?.reply_rate_24h);
    const replyInbound24h = Number(reliabilityTotals?.inbound_24h) || 0;
    const replyAnswered24h = Number(reliabilityTotals?.answered_inbound_24h) || 0;
    const replyUnanswered24h = Number(reliabilityTotals?.unanswered_inbound_24h) || 0;
    const replyAlertAccounts = Number(reliabilityTotals?.reply_alert_accounts) || 0;
    const hasReplySample = replyInbound24h > 0;
    const accountEventBars = accountActivity
        .map((entry) => ({
            locationId: entry.location_id,
            name: entry.location_name || t('agency.location.no_name'),
            sent: Number(entry.sent) || 0,
            failed: Number(entry.failed) || 0,
            totalEvents: Math.max(
                Number(entry.total) || ((Number(entry.sent) || 0) + (Number(entry.failed) || 0)),
                Number(entry.inbound_24h) || 0
            ),
            replyRate: Number(entry.reply_rate_24h) || 100,
            inboundCount: Number(entry.inbound_24h) || 0,
            answeredCount: Number(entry.answered_inbound_24h) || 0,
            unansweredCount: Number(entry.unanswered_inbound_24h) || 0,
            replyStrikes: Number(entry.reply_strikes) || 0,
            replyStatus: String(entry.reply_status || 'healthy').toLowerCase(),
            replyAutoBlocked: Boolean(entry.reply_auto_blocked)
        }))
        .filter((entry) => entry.totalEvents > 0)
        .slice(0, 8);
    const modalCrmType = String(
        addModalCrmType || onboardingCrmType || agencyCrmType || "ghl"
    ).toLowerCase();
    const isChatwootModal = modalCrmType === "chatwoot";
    const isWaflowCrmHostedModal =
        isChatwootModal &&
        addModalChatwootModeLocked &&
        !addModalChatwootExternal &&
        onboardingCrmType === "waflow_crm";
    const canGoBackToChatwootOnboarding = isChatwootModal && addModalChatwootModeLocked;
    const primaryHostedChatwootEmail = String(
        chatwootMasterEmail || accountInfo?.email || userEmail || ""
    ).trim().toLowerCase();
    const modalClientEmail = String(addModalClientEmail || "").trim().toLowerCase();
    const isSharedPrimaryChatwootEmailInModal =
        Boolean(
            isChatwootModal &&
            !addModalChatwootExternal &&
            modalClientEmail &&
            primaryHostedChatwootEmail &&
            modalClientEmail === primaryHostedChatwootEmail
        );
    const chatwootMasterDisplayEmail = String(chatwootMasterEmailMasked || chatwootMasterEmail || "").trim();
    const accountPlanCode = String(accountInfo?.plan || "").toLowerCase();
    const accountPlanLabelMap = {
        active: t('agency.account.plan_active') || "Activo",
        trial: t('agency.account.plan_trial') || "Prueba",
        suspended: t('agency.account.plan_suspended') || "Suspendido",
        cancelled: t('agency.account.plan_cancelled') || "Cancelado",
        past_due: t('agency.account.plan_past_due') || "Pago pendiente"
    };
    const accountPlanLabel =
        accountPlanLabelMap[accountPlanCode] ||
        (String(accountInfo?.plan || "").trim() || (t('agency.account.loading') || "Cargando..."));
    const accountProfileEmail =
        String(accountInfo?.email || userEmail || "").trim() ||
        (t('agency.account.loading') || "Cargando...");
    const accountProfilePhone =
        String(accountInfo?.phone || "").trim() ||
        (t('agency.account.not_available') || "No disponible");
    const activeIntegrationLabels = Array.from(
        new Set(
            (locations || [])
                .map((loc) => resolveTenantProductType(loc))
                .filter(Boolean)
                .map((crm) => crmLabelMap[crm] || String(crm || "").toUpperCase())
        )
    );
    if (activeIntegrationLabels.length === 0 && activeCrmLabel) {
        activeIntegrationLabels.push(activeCrmLabel);
    }
    const accountCreatedAtLabel =
        formatDateTime(accountInfo?.created_at) ||
        (t('agency.account.not_available') || "No disponible");

    useEffect(() => {
        if (!isSharedPrimaryChatwootEmailInModal) return;
        if (!addModalClientPassword) return;
        setAddModalClientPassword("");
    }, [isSharedPrimaryChatwootEmailInModal, addModalClientPassword]);
    const accountStatusCode = String(
        suspensionStatus?.status ||
        (accountInfo?.is_active === false ? "inactive" : "active")
    ).toLowerCase();
    const accountStatusLabelMap = {
        active: t('agency.account.status_active') || "Activa",
        inactive: t('agency.account.status_inactive') || "Inactiva",
        grace: t('agency.account.status_grace') || "En gracia",
        suspended: t('agency.account.status_suspended') || "Suspendida",
        pending_deletion: t('agency.account.status_pending_deletion') || "Pendiente de eliminación",
        permanently_deleted: t('agency.account.status_deleted') || "Eliminada"
    };
    const accountStatusLabel =
        accountStatusLabelMap[accountStatusCode] ||
        (t('agency.account.status_unknown') || "Estado no definido");
    const accountStatusToneClass =
        accountStatusCode === "active"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
            : accountStatusCode === "grace"
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800";
    const accountUsageAccounts = `${accountInfo?.limits?.used_subagencies || 0}/${accountInfo?.limits?.max_subagencies || 0}`;
    const accountUsageSlots = `${accountInfo?.limits?.used_slots || 0}/${accountInfo?.limits?.max_slots || 0}`;
    const settingsMenuGroups = [
        {
            key: "general",
            label: t('agency.settings_nav.general') || "General",
            items: [
                { id: "guide", label: t('agency.settings_nav.guide') || (t('agency.settings_guide.title') || "Guía rápida"), icon: Sparkles },
                { id: "account", label: t('agency.account.title') || "Cuenta", icon: User }
            ]
        },
        {
            key: "ops",
            label: t('agency.settings_nav.operations') || "Operación",
            items: [
                { id: "integrations", label: t('agency.integrations.title') || "Integraciones", icon: Link },
                { id: "support", label: t('agency.settings_nav.support_short') || "Soporte", icon: LifeBuoy },
                { id: "whitelabel", label: t('agency.wl.title') || "Marca Blanca", icon: Palette }
            ]
        },
        {
            key: "advanced",
            label: t('agency.settings_nav.advanced') || "Avanzado",
            items: [
                { id: "developer", label: t('dash.settings.dev_title') || "Desarrolladores", icon: Terminal },
                { id: "appearance", label: t('agency.settings_nav.appearance') || "Apariencia", icon: Moon }
            ]
        }
    ];
    const allSettingsSectionIds = settingsMenuGroups.flatMap((group) => group.items.map((item) => item.id));
    const currentSettingsSectionId = allSettingsSectionIds.includes(settingsSection)
        ? settingsSection
        : (allSettingsSectionIds[0] || "guide");
    const settingsSectionTitleMap = settingsMenuGroups.reduce((acc, group) => {
        for (const item of group.items) acc[item.id] = item.label;
        return acc;
    }, {});
    const activeSettingsSectionTitle = settingsSectionTitleMap[currentSettingsSectionId] || (t('dash.header.settings') || "Configuración");

    useEffect(() => {
        if (!allSettingsSectionIds.includes(settingsSection)) {
            setSettingsSection(allSettingsSectionIds[0] || "guide");
        }
    }, [settingsSection, isGhlAgency, isChatwootAgency]);

    // ✅ Componente de Bloqueo "Glass" (Visible pero no interactivo)
    const RestrictedFeatureWrapper = ({ isRestricted, children, title }) => {
        if (!isRestricted) return children;

        return (
            <div className="relative group overflow-hidden rounded-2xl">
                {/* Overlay de Bloqueo */}
                <div className="absolute inset-0 z-50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center transition-all duration-300">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 mb-4 shadow-sm animate-in zoom-in duration-300">
                        <Lock size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {title || t('dash.locked.title') || "Función Premium"}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 max-w-sm mb-6">
                        {t('dash.locked.desc') || "Actualiza tu plan para desbloquear esta característica y potenciar tu agencia."}
                    </p>
                    <button 
                        onClick={() => setActiveTab('billing')} 
                        className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-lg shadow-amber-600/20 transition-transform active:scale-95 flex items-center gap-2 hover:-translate-y-0.5"
                    >
                        <Zap size={18} fill="currentColor" /> {t('dash.upgrade.cta') || "Desbloquear Ahora"}
                    </button>
                </div>

                {/* Contenido Difuminado */}
                <div className="filter blur-[1px] opacity-50 pointer-events-none select-none grayscale-[0.3]">
                    {children}
                </div>
            </div>
        );
    };

    const WhiteLabelSettings = () => {
        const [form, setForm] = useState(branding || DEFAULT_BRANDING);

        useEffect(() => { if (branding) setForm(branding); }, [branding]);

        const handleSave = (e) => {
            e.preventDefault();
            if (updateBranding) {
                // ✅ Pasamos token para persistencia en servidor
                updateBranding(form, token); 
                toast.success(t('agency.wl.saved'));
            }
        };

        const handleReset = () => {
            if (confirm(t('agency.wl.confirm_reset'))) {
                if (resetBranding) {
                    resetBranding(token);
                    setForm(DEFAULT_BRANDING);
                    toast.success(t('agency.wl.reset_success'));
                }
            }
        };

        return (
            <RestrictedFeatureWrapper isRestricted={isRestricted} title={t('agency.wl.title')}>
                <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-right-4">
                    <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Palette size={24} className="text-indigo-500" /> {t('agency.wl.title')}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('agency.wl.desc')}</p>
                        </div>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 text-xs font-bold uppercase rounded-full border bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800">{t('agency.wl.pro_feature')}</span>
                        </div>
                    </div>

                    <form onSubmit={handleSave} className="space-y-8">
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">{t('agency.wl.identity')}</h4>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('agency.wl.agency_name')}</label>
                                <input type="text" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-2">{t('agency.wl.graphics')}</h4>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('agency.wl.logo_url')}</label>
                                <div className="flex gap-4 items-center">
                                    <div className="w-16 h-16 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-800 overflow-hidden shrink-0 shadow-sm"><img src={form.logoUrl} alt="Preview" className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} /></div>
                                    <div className="flex-1 relative"><Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="url" value={form.logoUrl === systemBranding?.logoUrl ? '' : (form.logoUrl || '')} onChange={e => setForm({ ...form, logoUrl: e.target.value || systemBranding.logoUrl })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 transition-all text-sm" placeholder="URL Logo" /></div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('agency.wl.favicon_url')}</label>
                                <div className="flex gap-4 items-center">
                                    <div className="w-16 h-16 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-800 overflow-hidden shrink-0 shadow-sm"><img src={form.faviconUrl} alt="Preview" className="w-8 h-8 object-contain" onError={(e) => e.target.style.display = 'none'} /></div>
                                    <div className="flex-1 relative"><MousePointer2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="url" value={form.faviconUrl === systemBranding?.faviconUrl ? '' : (form.faviconUrl || '')} onChange={e => setForm({ ...form, faviconUrl: e.target.value || systemBranding.faviconUrl })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 transition-all text-sm" placeholder="URL Favicon" /></div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 flex flex-col md:flex-row items-center gap-4 border-t border-gray-100 dark:border-gray-800">
                            <button type="submit" className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg flex items-center gap-2"><CheckCircle2 size={18} /> {t('agency.wl.save_changes')}</button>
                            <button type="button" onClick={handleReset} className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-medium text-sm transition flex items-center gap-2 px-4"><RotateCcw size={16} /> {t('agency.wl.reset')}</button>
                        </div>
                    </form>
                </div>
            </RestrictedFeatureWrapper>
        );
    };

    return (
        <div className="agency-dashboard-ui flex h-screen bg-[#F8FAFC] dark:bg-[#0f1117] font-sans overflow-hidden">
            <ExpiryPopup token={token} /> {/* ✅ Popup Global */}
            {isAccountSuspended && <SubscriptionBlocker token={token} onLogout={onLogout} accountInfo={accountInfo} />}
            {showUpgradeModal && isGhlAgency && <SubscriptionModal token={token} accountInfo={accountInfo} onClose={() => setShowUpgradeModal(false)} onDataChange={refreshData} />}

            {/* 🔥 OVERLAY DE BLOQUEO DURANTE INSTALACIÓN */}
            {isAutoSyncing && (
                <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 shadow-2xl border border-gray-200 dark:border-gray-800 max-w-md w-full mx-4 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 relative">
                            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900/50"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin"></div>
                            <div className="absolute inset-3 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                <RefreshCw size={28} className="text-indigo-600 animate-pulse" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            {t('agency.install.title')}
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            {t('agency.install.warning')}
                        </p>
                        <div className="mt-6 flex justify-center gap-1">
                            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                    </div>
                </div>
            )}

            <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col z-30`}>
                <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shrink-0 overflow-hidden"
                        style={{ backgroundColor: branding.logoUrl ? 'transparent' : branding.primaryColor }}
                    >
                        <img
                            src={branding.logoUrl}
                            alt="Logo"
                            className="w-full h-full object-contain"
                            onError={(e) => e.target.style.display = 'none'}
                        />
                    </div>
                    {sidebarOpen && <span className="ml-3 font-bold text-gray-900 dark:text-white tracking-tight truncate">{branding.name}</span>}
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                    <p className={`text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2 ${!sidebarOpen && 'hidden'}`}>{t('dash.nav.management')}</p>
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="overview" icon={LayoutGrid} label={t('dash.nav.overview')} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="billing" icon={CreditCard} label={t('dash.nav.billing')} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="reliability" icon={Activity} label={t('dash.nav.reliability') || 'Confiabilidad'} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="settings" icon={Settings} label={t('dash.nav.settings')} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="builder" icon={Hammer} label={t('dash.nav.builder') || "Constructor"} branding={branding} sidebarOpen={sidebarOpen} />
                    <div className="my-6 border-t border-gray-100 dark:border-gray-800"></div>
                    <a href="https://docs.waflow.ai" target="_blank" rel="noreferrer" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-indigo-900/10`}><BookOpen size={20} />{sidebarOpen && <span>{t('dash.nav.docs')}</span>}</a>
                    <a href={`https://wa.me/${SUPPORT_PHONE}`} target="_blank" rel="noreferrer" className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-indigo-900/10`}><LifeBuoy size={20} />{sidebarOpen && <span>{t('dash.nav.support')}</span>}</a>
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                    <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all font-medium text-sm"><LogOut size={20} />{sidebarOpen && <span>{t('dash.nav.logout')}</span>}</button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[#F8FAFC] dark:bg-[#0f1117]">
                <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800 flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500"><Menu size={20} /></button><h2 className="text-lg font-bold text-gray-900 dark:text-white capitalize">{activeTab === 'overview' ? t('dash.header.overview') : activeTab === 'billing' ? t('dash.header.billing') : activeTab === 'reliability' ? (t('dash.header.reliability') || 'Confiabilidad operativa') : activeTab === 'builder' ? (t('dash.header.builder') || "Constructor") : t('dash.header.settings')}</h2></div>
                    <div className="flex items-center gap-4"><LanguageSelector /><ThemeToggle /><div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs border border-white/20 shadow-sm" style={{ backgroundColor: branding.primaryColor }}>AG</div></div>
                </header>

                <main className="flex-1 overflow-y-auto p-6 md:p-8">
                    {activeTab === 'overview' && (
                        !accountInfo ? (<div className="flex justify-center items-center h-full text-gray-400"><RefreshCw className="animate-spin mr-2" /> {t('agency.loading_panel')}</div>) : (
                            <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* WAFLOW CRM — Sección independiente */}
                                {/*<div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 dark:border-indigo-800/30 bg-gradient-to-r from-white via-indigo-50/30 to-violet-50/20 dark:from-gray-900 dark:via-indigo-950/20 dark:to-violet-950/10 p-5 shadow-sm">
                                    <div className="absolute -top-10 -right-10 w-28 h-28 bg-indigo-500/8 dark:bg-indigo-400/5 rounded-full blur-2xl pointer-events-none" />
                                    
                                    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                                                <Sparkles size={16} className="text-white" />
                                            </div>
                                            /*<div>
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                    Waflow CRM
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white tracking-wider">
                                                        <Zap size={8} fill="currentColor" /> Próximamente
                                                    </span>
                                                </h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    CRM independiente con IA integrada — califica leads, agenda citas y cierra ventas.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-1.5 shrink-0">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/40 text-gray-600 dark:text-gray-300">
                                                <Bot size={12} className="text-indigo-500" /> Agentes IA
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/40 text-gray-600 dark:text-gray-300">
                                                <TrendingUp size={12} className="text-emerald-500" /> Pipeline
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/40 text-gray-600 dark:text-gray-300">
                                                <CalendarCheck size={12} className="text-blue-500" /> Calendario
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/40 text-gray-600 dark:text-gray-300">
                                                <MessageSquareText size={12} className="text-violet-500" /> Inbox
                                            </span>
                                        </div>
                                    </div>
                                </div>*/}


                                <>
                                    {/* ESTADÍSTICAS - Diseño Minimalista */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                                    <Building2 size={20} className="text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{isChatwootAgency ? t('dash.stats.cw_accounts') : (t('dash.stats.subaccounts') || "Subcuentas")}</span>
                                            </div>
                                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {accountInfo.limits?.used_subagencies || 0}<span className="text-gray-400 font-normal text-lg">/{accountInfo.limits?.max_subagencies || 0}</span>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                                    <Smartphone size={20} className="text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t('dash.stats.connections')}</span>
                                            </div>
                                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {accountInfo.limits?.used_slots || 0}<span className="text-gray-400 font-normal text-lg">/{accountInfo.limits?.max_slots || 0}</span>
                                            </div>
                                        </div>

                                        <div className={`rounded-2xl p-5 border shadow-sm hover:shadow-md transition-shadow ${accountInfo.plan === 'active' ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-transparent' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accountInfo.plan === 'active' ? 'bg-white/20' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                                                    <ShieldCheck size={20} className={accountInfo.plan === 'active' ? 'text-white' : 'text-amber-600 dark:text-amber-400'} />
                                                </div>
                                                <span className={`text-xs font-medium uppercase tracking-wide ${accountInfo.plan === 'active' ? 'text-blue-200' : 'text-gray-400'}`}>{t('dash.stats.plan')}</span>
                                            </div>
                                            <div className={`text-xl font-bold ${accountInfo.plan === 'active' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                {accountInfo.plan === 'active' ? t('dash.stats.active') : t('dash.stats.trial')}
                                            </div>
                                            {accountInfo.trial_ends && (
                                                <div className={`text-xs mt-1 ${accountInfo.plan === 'active' ? 'text-blue-200' : 'text-amber-600 dark:text-amber-400'}`}>
                                                    Fin: {new Date(accountInfo.trial_ends).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {suspensionStatus?.status === 'grace' && (
                                        <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/40 p-4 rounded-xl">
                                            <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">
                                                Tu cuenta está en periodo de gracia.
                                            </p>
                                            <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                                                Será suspendida en {getDaysLeft(suspensionStatus.grace_ends_at) ?? 0} día(s).
                                                {suspensionStatus.grace_ends_at && ` Fecha límite: ${new Date(suspensionStatus.grace_ends_at).toLocaleString()}.`}
                                            </p>
                                            <button onClick={() => setActiveTab('billing')} className="mt-3 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold text-xs transition">
                                                Actualizar método de pago
                                            </button>
                                        </div>
                                    )}

                                    {['suspended', 'pending_deletion', 'permanently_deleted'].includes(suspensionStatus?.status || '') && (
                                        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-4 rounded-xl">
                                            <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                                                Tu cuenta está suspendida.
                                            </p>
                                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                                Contacta soporte para reactivarla.
                                                {suspensionStatus?.reason ? ` Motivo: ${suspensionStatus.reason}` : ''}
                                            </p>
                                        </div>
                                    )}

                                    {accountInfo.plan === 'trial' && (
                                        <div className="mt-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-4 rounded-xl flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center">
                                                    <Zap size={20} className="text-amber-600" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{t('agency.trial.title')}</p>
                                                    <p className="text-xs text-amber-700 dark:text-amber-400">Expira: {new Date(accountInfo.trial_ends).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setActiveTab('billing')} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-sm transition">
                                                {t('agency.trial.choose_plan')}
                                            </button>
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex items-center justify-between gap-3 mb-4">
                                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                                {t('agency.onboarding.accounts_title') || 'Cuentas Activas'}
                                            </h3>
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                <div className="flex items-center gap-2">
                                                    {accountFilterOptions.map(tab => (
                                                        <button
                                                            key={tab.id}
                                                            onClick={() => setAccountsFilter(tab.id)}
                                                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                                                                accountsFilter === tab.id
                                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 shadow-sm'
                                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800 dark:hover:border-gray-700'
                                                            }`}
                                                        >
                                                            {tab.icon && <tab.icon size={13} />}
                                                            {tab.label}
                                                            <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                                                accountsFilter === tab.id
                                                                    ? 'bg-indigo-200/60 text-indigo-800 dark:bg-indigo-800/40 dark:text-indigo-200'
                                                                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                                                            }`}>{tab.count}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                    <input
                                                        type="text"
                                                        autoComplete="off"
                                                        placeholder={t('agency.onboarding.search_accounts') || 'Buscar cuentas...'}
                                                        className="pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white w-40 focus:w-52 transition-all"
                                                        value={searchTerm}
                                                        onChange={e => setSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                                <button onClick={refreshData} disabled={isAutoSyncing} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:text-indigo-600 transition disabled:opacity-50">
                                                    <RefreshCw size={16} className={loading || isAutoSyncing ? "animate-spin" : ""} />
                                                </button>
                                                <button
                                                    onClick={() => { setOnboardingStep(0); setOnboardingCrmType(null); setOnboardingConnectionType(null); setOnboardingHoveredCard(null); setShowOnboarding(true); }}
                                                    className="px-4 py-2 text-white rounded-lg font-medium text-sm flex items-center gap-1.5 transition"
                                                    style={{ backgroundColor: branding.primaryColor }}
                                                >
                                                    <Plus size={16} /> {t('agency.onboarding.new_account') || 'Nueva Cuenta'}
                                                </button>
                                            </div>
                                        </div>

                                        {loading && locations.length === 0 ? (
                                            <div className="py-12 text-center text-gray-400">{t('agency.loading_data')}</div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {filteredLocationCards.map(({ loc, totalSlots, connectedSlotCount, connectedNumbers, hasConnectedSlots, connectedPreview, remainingConnected }) => {
                                                    const productMeta = getTenantProductMeta(loc);
                                                    const ProductIcon = productMeta.icon;

                                                    return (
                                                        <div key={loc.location_id} onClick={() => setSelectedLocation(loc)} className="group bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer">
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                                                                    <ProductIcon size={18} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full border ${productMeta.badgeClassName}`}>
                                                                        {productMeta.label}
                                                                    </span>
                                                                    <button onClick={(e) => handleDeleteTenant(e, loc.location_id, loc.name)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1 truncate text-sm">{loc.name || t('agency.location.no_name')}</h4>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                                                    hasConnectedSlots
                                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                                                                        : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                                                }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${hasConnectedSlots ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                                    {hasConnectedSlots
                                                                        ? `${connectedSlotCount}/${totalSlots || connectedSlotCount} ${t('agency.location.online') || 'en línea'}`
                                                                        : (t('agency.location.none_online') || 'Sin números en línea')}
                                                                </span>
                                                            </div>
                                                            {connectedNumbers.length > 0 && (
                                                                <p
                                                                    className="text-[11px] text-emerald-600 dark:text-emerald-400 mb-3 truncate"
                                                                    title={connectedNumbers.join(' · ')}
                                                                >
                                                                    {(t('agency.location.online_numbers') || 'Números en línea')}: {connectedPreview.join(' · ')}{remainingConnected > 0 ? ` +${remainingConnected}` : ''}
                                                                </p>
                                                            )}
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                    <Smartphone size={12} /> {totalSlots}
                                                                </span>
                                                                <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {!searchTerm && accountInfo && Array.from({ length: Math.max(0, (accountInfo.limits?.max_subagencies || 0) - locations.length) }).map((_, idx) => (
                                                    <div key={`empty-${idx}`} onClick={() => { setOnboardingStep(0); setOnboardingCrmType(null); setOnboardingConnectionType(null); setOnboardingHoveredCard(null); setShowOnboarding(true); }} className="group border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all min-h-[140px]">
                                                        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                            <Plus size={20} className="text-gray-300 group-hover:text-indigo-600" />
                                                        </div>
                                                        <p className="text-xs font-medium text-gray-500">
                                                            {isGhlAgency ? t('agency.location.empty_title') : (t('dash.chatwoot_accounts.new_empty') || "Nueva Cuenta Chatwoot")}
                                                        </p>
                                                    </div>
                                                ))}
                                                
                                                {/* Empty State when no locations and no slots available */}
                                                {filteredLocations.length === 0 && Math.max(0, (accountInfo?.limits?.max_subagencies || 0) - locations.length) === 0 && (
                                                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed">
                                                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                                            {isChatwootAgency ? <MessageSquareText size={32} /> : <Building2 size={32} />}
                                                        </div>
                                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                                            {t('dash.empty.no_locations_title') || "No hay cuentas"}
                                                        </h3>
                                                        <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                                                            {t('dash.empty.no_locations_desc') || "Has alcanzado el límite global de tu plan actual y no puedes crear más. Si ya tienes cuentas en otro CRM, debes eliminarlas o hacer un upgrade para crear aquí."}
                                                        </p>
                                                        <button onClick={() => setActiveTab('billing')} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-md">
                                                            <Zap size={18} fill="currentColor" /> {t('dash.upgrade.cta') || "Desbloquear Límite"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            </div>
                        )
                    )}

                    {activeTab === 'reliability' && (
                        <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-right-4 space-y-6">
                            <div className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                                <div className="absolute inset-y-0 right-0 w-64 bg-gradient-to-l from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
                                <div className="relative p-6 md:p-7">
                                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                        <div className="max-w-2xl">
                                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {t('agency.reliability.title') || 'Estado de tus cuentas'}
                                            </h3>
                                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                                {t('agency.reliability.subtitle_short') || 'Revisa si tus números están estables, si hubo alertas y qué cuenta necesita atención.'}
                                            </p>
                                            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40">
                                                    <Users size={12} />
                                                    {reliabilityTotalAccounts} {t('agency.reliability.active_only_note') || 'cuentas activas'}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40">
                                                    <Smartphone size={12} />
                                                    {reliabilitySummary.connectedSlots}/{reliabilitySummary.totalSlots || 0} {t('agency.reliability.online_slots') || 'slots en línea'}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40">
                                                    <RefreshCw size={12} className={reliabilityLoading ? "animate-spin" : ""} />
                                                    {t('agency.reliability.last_update') || 'Actualizado'} {reliabilityLastUpdated ? formatRelativeTime(reliabilityLastUpdated) : (t('agency.reliability.none_short') || 'recién')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {reliabilityFilterOptions.map(tab => (
                                                <button
                                                    key={`reliability-hero-${tab.id}`}
                                                    onClick={() => setAccountsFilter(tab.id)}
                                                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                                                        accountsFilter === tab.id
                                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 shadow-sm'
                                                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800 dark:hover:border-gray-700'
                                                    }`}
                                                >
                                                    {tab.icon && <tab.icon size={13} />}
                                                    {tab.label}
                                                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                                        accountsFilter === tab.id
                                                            ? 'bg-indigo-200/60 text-indigo-800 dark:bg-indigo-800/40 dark:text-indigo-200'
                                                            : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                                                    }`}>{tab.count}</span>
                                                </button>
                                            ))}
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                <input
                                                    type="text"
                                                    autoComplete="off"
                                                    placeholder={t('agency.onboarding.search_accounts') || 'Buscar cuentas...'}
                                                    className="pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white w-44 focus:w-56 transition-all"
                                                    value={searchTerm}
                                                    onChange={e => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <button
                                                onClick={handleReliabilityRefresh}
                                                disabled={isAutoSyncing || reliabilityLoading}
                                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-600 dark:text-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition disabled:opacity-50"
                                            >
                                                <RefreshCw size={16} className={reliabilityLoading ? "animate-spin" : ""} />
                                                {t('agency.refresh')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {loading && locations.length === 0 ? (
                                <div className="py-14 text-center text-gray-400">{t('agency.loading_data')}</div>
                            ) : reliabilityTotalAccounts === 0 ? (
                                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm py-14 px-6 text-center">
                                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mb-4">
                                        <Activity size={24} />
                                    </div>
                                    <h5 className="text-base font-bold text-gray-900 dark:text-white">
                                        {t('agency.reliability.empty_title') || 'No hay cuentas para mostrar'}
                                    </h5>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                        {t('agency.reliability.empty_desc') || 'Ajusta los filtros o espera actividad para empezar a ver métricas del canal.'}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                                            <Send size={14} className="text-blue-500" />
                                            {Number(reliabilityTotals?.sent_24h) || timelineSummary.sent} {t('agency.reliability.sent_24h') || 'Enviados 24h'}
                                        </span>
                                        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                                            <AlertTriangle size={14} className="text-amber-500" />
                                            {Number(reliabilityTotals?.failed_24h) || timelineSummary.failed} {t('agency.reliability.failed_24h') || 'No enviados 24h'}
                                        </span>
                                        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                                            <MessageSquare size={14} className="text-emerald-500" />
                                            {hasReplySample
                                                ? `${t('agency.reliability.reply_ratio') || 'ratio de respuesta'}: ${replyRate24h || 0}% · ${replyAnswered24h}/${replyInbound24h}`
                                                : `${t('agency.reliability.reply_ratio') || 'ratio de respuesta'}: ${t('agency.reliability.reply_no_sample') || 'Sin muestra suficiente'}`}
                                        </span>
                                        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                                            <Smartphone size={14} className={replyAlertAccounts > 0 ? "text-rose-500" : "text-emerald-500"} />
                                            {replyAlertAccounts} {t('agency.reliability.reply_alert_accounts') || 'cuentas en alerta'}
                                        </span>
                                    </div>

                                    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 md:p-6">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                                    {t('agency.reliability.activity_24h') || 'Mensajes en las últimas 24 horas'}
                                                </h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    {t('agency.reliability.activity_24h_desc') || 'La línea azul muestra mensajes enviados. La línea ámbar muestra mensajes que no pudieron salir.'}
                                                </p>
                                            </div>
                                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                                {t('agency.reliability.chart_axes') || 'Hora vs cantidad de mensajes'}
                                            </p>
                                        </div>

                                        <div className="mt-5">
                                            <ReliabilityLineChart
                                                data={reliabilityTrendPoints}
                                                maxValue={reliabilityTrendMax}
                                                emptyLabel={t('agency.reliability.no_activity') || 'Sin mensajes recientes en este periodo.'}
                                                reconnectLabel={t('agency.reliability.sent_label') || 'Mensajes enviados'}
                                                incidentLabel={t('agency.reliability.failed_label') || 'No enviados'}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 md:p-6">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                                    {t('agency.reliability.coverage_by_account') || 'Cuentas con más movimiento'}
                                                </h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    {t('agency.reliability.recent_movement') || 'Cada barra compara dónde hubo más envíos o fallos hoy.'}
                                                </p>
                                            </div>
                                            {accountEventBars.length > 0 && (
                                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                                    {t('agency.reliability.account_bars_help') || 'Más alto = más mensajes en esa cuenta'}
                                                </p>
                                            )}
                                        </div>

                                        <div className="mt-5">
                                            <ReliabilityAccountBars
                                                data={accountEventBars}
                                                emptyLabel={t('agency.reliability.all_good_desc') || 'Aún no hay cuentas con movimiento en este filtro.'}
                                                reconnectText={t('agency.reliability.sent_short') || 'enviados'}
                                                alertText={t('agency.reliability.failed_short') || 'no enviados'}
                                                replyRatioText={t('agency.reliability.reply_ratio') || 'ratio de respuesta'}
                                                replyNoSampleText={t('agency.reliability.reply_no_sample') || 'Sin muestra suficiente'}
                                                replyStrikeText={t('agency.reliability.reply_strike') || 'strike'}
                                                replyAnsweredText={t('agency.reliability.reply_answered_short') || 'respondidos'}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}


                    {activeTab === 'settings' && (
                        <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-right-4">
                            <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
                                    <aside className="xl:sticky xl:top-6 bg-white dark:bg-gray-900/90 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 xl:p-6">
                                    <div className="space-y-5">
                                        {settingsMenuGroups.map((group) => (
                                            <div key={group.key}>
                                                <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-gray-500 dark:text-gray-400 mb-2">
                                                    {group.label}
                                                </p>
                                                <div className="space-y-1.5">
                                                    {group.items.map((item) => {
                                                        const Icon = item.icon;
                                                        const isActive = currentSettingsSectionId === item.id;
                                                        return (
                                                            <button
                                                                key={item.id}
                                                                onClick={() => setSettingsSection(item.id)}
                                                                className={`w-full text-left rounded-xl border px-3.5 py-3 transition-all duration-150 flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                                                                    isActive
                                                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-[0_12px_24px_-18px_rgba(79,70,229,0.75)]"
                                                                        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-500"
                                                                }`}
                                                            >
                                                                <Icon size={15} className={isActive ? "text-white" : "text-gray-500 dark:text-gray-400"} />
                                                                <span className="text-sm font-semibold">{item.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </aside>
                                <div className="space-y-6">
                            {currentSettingsSectionId === 'guide' && (
                            <div className="bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <Sparkles size={20} className="text-indigo-500" /> {t('agency.settings_guide.title') || "Guía rápida de configuración"}
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            {t('agency.settings_guide.desc') || "Esto te muestra lo mínimo que debes configurar para empezar, y lo que puedes dejar para después."}
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300">
                                        {t('agency.settings_guide.tag') || "Onboarding"}
                                    </span>
                                </div>

                                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 p-4">
                                        <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                                            <CheckCircle2 size={16} /> {t('agency.settings_guide.required_title') || "Necesario para empezar"}
                                        </h4>
                                        <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                            <li className="flex gap-2">
                                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                                <span>{t('agency.settings_guide.required_create_accounts') || "Crear cuentas desde Overview > New Account (flujo principal)."}</span>
                                            </li>
                                            {isChatwootAgency && (
                                                <li className="flex gap-2">
                                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                                    <span>{t('agency.settings_guide.required_chatwoot_master') || "Configurar Usuario Maestro de Chatwoot (sin esto no podrás aprovisionar cuentas hosted)."}</span>
                                                </li>
                                            )}
                                        </ul>
                                        <div className="mt-4 flex gap-2">
                                            <button
                                                onClick={() => setActiveTab('overview')}
                                                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5"
                                            >
                                                <LayoutGrid size={14} /> {t('agency.settings_guide.go_overview') || "Ir a Overview"}
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('billing')}
                                                className="px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition hover:bg-emerald-100/70 dark:hover:bg-emerald-900/30 flex items-center gap-1.5"
                                            >
                                                <CreditCard size={14} /> {t('agency.settings_guide.go_billing') || "Ver plan"}
                                            </button>
                                            <button
                                                onClick={() => setSettingsSection('integrations')}
                                                className="px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition hover:bg-emerald-100/70 dark:hover:bg-emerald-900/30 flex items-center gap-1.5"
                                            >
                                                <Settings size={14} />
                                                {t('agency.settings_nav.open_advanced') || "Ir a Configuración Avanzada"}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 p-4">
                                        <h4 className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                                            <Zap size={16} /> {t('agency.settings_guide.optional_title') || "Opcional / avanzado (puedes omitir al inicio)"}
                                        </h4>
                                        <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                            <li className="flex gap-2">
                                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                                <span>{t('agency.settings_guide.optional_integrations') || "Panel de Integraciones (referencia y accesos rápidos)."}</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                                <span>{t('agency.settings_guide.optional_whitelabel') || "White Label (branding visual de tu panel)."}</span>
                                            </li>
                                            {isGhlAgency && (
                                                <li className="flex gap-2">
                                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                                    <span>{t('agency.settings_guide.optional_voice') || "Notas de voz en CRM (script avanzado)."}</span>
                                                </li>
                                            )}
                                            <li className="flex gap-2">
                                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                                <span>{t('agency.settings_guide.optional_dev') || "API Keys y Webhooks (integraciones técnicas)."}</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                                <span>{t('agency.settings_guide.optional_support') || "Soporte white-label (si tu operación ya requiere atención dedicada)."}</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                                <span>{t('agency.settings_guide.optional_theme') || "Tema claro/oscuro (preferencia visual)."}</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            )}

                            {currentSettingsSectionId === 'account' && (
                            <div className="bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><User size={20} /> {t('agency.account.title')}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t('agency.account.agency_id')}</label>
                                        <div className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 break-all">{AGENCY_ID}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t('agency.account.email')}</label>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-all">{accountProfileEmail}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t('agency.account.phone') || "Teléfono registrado"}</label>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{accountProfilePhone}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t('agency.account.plan') || "Plan activo"}</label>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{accountPlanLabel}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t('agency.account.status') || "Estado de cuenta"}</label>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wide ${accountStatusToneClass}`}>
                                            {accountStatusLabel}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t('agency.account.integrations') || "Integraciones activas"}</label>
                                        <div className="flex flex-wrap gap-2">
                                            {activeIntegrationLabels.map((label) => (
                                                <span
                                                    key={label}
                                                    className="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wide bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                                                >
                                                    {label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t('agency.account.created_at') || "Fecha de registro"}</label>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{accountCreatedAtLabel}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t('agency.account.subaccounts_limit') || "Subcuentas usadas / límite"}</label>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{accountUsageAccounts}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t('agency.account.slots_limit') || "Conexiones usadas / límite"}</label>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{accountUsageSlots}</div>
                                    </div>
                                </div>
                            </div>
                            )}

                            {currentSettingsSectionId === 'integrations' && renderIntegrationsPanel("settings")}

                            {currentSettingsSectionId === 'support' && (
                                <RestrictedFeatureWrapper isRestricted={isRestricted} title={t('agency.support.title')}>
                                    <SupportManager
                                        token={token}
                                        apiPrefix="/agency/support"
                                        socketRoom={`__AGENCY_SUPPORT_${AGENCY_ID}__`}
                                        title={t('agency.support.title')}
                                        showDisconnectWarning={false}
                                        demoMode={isRestricted}
                                    />
                                </RestrictedFeatureWrapper>
                            )}

                            {currentSettingsSectionId === 'whitelabel' && <WhiteLabelSettings />}

                            {currentSettingsSectionId === 'developer' && (
                            <RestrictedFeatureWrapper isRestricted={isRestricted} title={t('dash.settings.dev_title')}>
                                <div className={`bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-right-4`}>
                                    <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Terminal size={24} className="text-pink-500" /> {t('dash.settings.dev_title') || "Desarrolladores"}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('dash.settings.dev_desc') || "Gestiona claves API y Webhooks para integraciones."}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="px-3 py-1 text-xs font-bold uppercase rounded-full border bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/30 dark:border-pink-800">Pro Feature</span>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        {/* API KEYS SECTION */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('dash.settings.api_keys') || "Claves API"}</h4>
                                                <form onSubmit={handleGenerateKey} className="flex gap-2">
                                                    <input name="keyName" placeholder={t('dash.settings.key_name_placeholder') || "Nombre..."} required className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none text-sm" />
                                                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl font-bold text-sm shadow flex items-center gap-2">
                                                        <Plus size={16} /> {t('common.create') || "Crear"}
                                                    </button>
                                                </form>
                                            </div>
                                            <div className={`overflow-x-auto`}>
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-xs font-bold text-gray-400 uppercase border-b dark:border-gray-700">
                                                            <th className="pb-3">{t('common.name') || "Nombre"}</th>
                                                            <th className="pb-3">{t('common.prefix') || "Prefijo"}</th>
                                                            <th className="pb-3 text-right">{t('common.action') || "Acción"}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y dark:divide-gray-800">
                                                        {apiKeys.map(k => (
                                                            <tr key={k.id}>
                                                                <td className="py-3 font-bold text-sm dark:text-white">{k.key_name}</td>
                                                                <td className="py-3 font-mono text-xs text-gray-500">{k.key_prefix}...</td>
                                                                <td className="py-3 text-right">
                                                                    <button onClick={() => handleRevokeKey(k.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={16} /></button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {apiKeys.length === 0 && <p className="text-center py-6 text-sm text-gray-400">{t('dash.settings.no_keys') || "Sin claves activas."}</p>}
                                            </div>
                                        </div>

                                        {/* WEBHOOKS SECTION */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('dash.settings.webhooks') || "Webhooks"}</h4>
                                                <button onClick={() => setShowNewWebhookModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow flex items-center gap-2">
                                                    <Plus size={16} /> {t('common.create') || "Crear"}
                                                </button>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-xs font-bold text-gray-400 uppercase border-b dark:border-gray-700">
                                                            <th className="pb-3">{t('common.name') || "Nombre"}</th>
                                                            <th className="pb-3">URL</th>
                                                            <th className="pb-3 text-right">{t('common.action') || "Acción"}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y dark:divide-gray-800">
                                                        {webhooks.map(h => (
                                                            <tr key={h.id}>
                                                                <td className="py-3 font-bold text-sm dark:text-white">{h.name}</td>
                                                                <td className="py-3 text-xs text-gray-500 truncate max-w-[200px]">{h.target_url}</td>
                                                                <td className="py-3 text-right">
                                                                    <button onClick={() => handleDeleteWebhook(h.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={16} /></button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {webhooks.length === 0 && <p className="text-center py-6 text-sm text-gray-400">{t('dash.settings.no_webhooks') || "Sin webhooks configurados."}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </RestrictedFeatureWrapper>
                            )}

                            {/* MODAL API KEY */}
                            {showNewKeyModal && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200"><div className="mb-6 text-center"><div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600"><ShieldCheck size={32} /></div><h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('dash.settings.key_generated') || "Clave Generada"}</h3><p className="text-sm text-gray-500 mt-2">{t('dash.settings.key_copy_warning') || "Cópiala ahora, no podrás verla después."}</p></div><div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 mb-6 relative group"><div className="font-mono text-sm break-all pr-10 text-indigo-600 dark:text-indigo-400 font-bold">{generatedKey}</div><button onClick={() => { navigator.clipboard.writeText(generatedKey); toast.success(t('common.copied') || "Copiado"); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-indigo-600 transition"><Copy size={18} /></button></div><button onClick={() => { setShowNewKeyModal(false); setGeneratedKey(null); }} className="w-full py-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl font-bold hover:opacity-90 transition">{t('common.understood') || "Entendido"}</button></div></div>)}

                            {/* MODAL WEBHOOK */}
                            {showNewWebhookModal && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('dash.settings.new_webhook') || "Nuevo Webhook"}</h3><button onClick={() => setShowNewWebhookModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div><form onSubmit={handleCreateWebhook} className="space-y-6"><div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('common.name') || "Nombre"}</label><input name="hookName" placeholder="Ej: n8n Producción" required className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div><div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">URL</label><input name="hookUrl" type="url" placeholder="https://..." required className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div><div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">{t('common.events') || "Eventos"}</label><div className="grid grid-cols-1 gap-3"><label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer"><input type="checkbox" name="events" value="whatsapp inbound message" defaultChecked className="w-5 h-5 rounded text-blue-600" /><div className="flex-1"><div className="text-sm font-bold dark:text-white">Inbound Message</div></div></label><label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer"><input type="checkbox" name="events" value="whatsapp outbound message" defaultChecked className="w-5 h-5 rounded text-blue-600" /><div className="flex-1"><div className="text-sm font-bold dark:text-white">Outbound Message</div></div></label></div></div><div className="flex gap-3"><button type="button" onClick={() => setShowNewWebhookModal(false)} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl font-bold">{t('common.cancel') || "Cancelar"}</button><button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">{t('common.create') || "Crear"}</button></div></form></div></div>)}

                            {currentSettingsSectionId === 'appearance' && (
                                <div className="bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{activeSettingsSectionTitle}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('agency.theme.toggle')}</p>
                                        <div className="mt-4">
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">{t('agency.theme.dark_mode')}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {theme === 'light'
                                                    ? (t('agency.theme.light_enabled') || "Tema claro activo.")
                                                    : (t('agency.theme.dark_enabled') || "Tema oscuro activo.")}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={toggleTheme} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-600 dark:text-yellow-400">{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
                                </div>
                            )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'builder' && <InteractiveMessageBuilder />}

                    {activeTab === 'billing' && (
                        (isGhlAgency || isChatwootAgency)
                            ? <SubscriptionManager token={token} accountInfo={accountInfo} onDataChange={refreshData} isChatwootAgency={isChatwootAgency} />
                            : renderIntegrationPlaceholder('agency.integrations.billing_title', 'agency.integrations.billing_desc')
                    )}

                    {/* MODAL ADD LOCATION/ACCOUNT */}
                    {showAddModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {isWaflowCrmHostedModal
                                            ? (t('agency.onboarding.waflow_crm_new_account') || "Nueva Cuenta Waflow Mensajeria")
                                            : (t('agency.onboarding.new_account') || "Nueva Cuenta")}
                                    </h3>
                                    <button onClick={closeAddLocationModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                <form onSubmit={confirmAddLocationModal} className="space-y-6" autoComplete="off">
                                    <input
                                        type="text"
                                        name="cw_fake_user"
                                        autoComplete="username"
                                        tabIndex={-1}
                                        className="hidden"
                                        aria-hidden="true"
                                    />
                                    <input
                                        type="password"
                                        name="cw_fake_pass"
                                        autoComplete="current-password"
                                        tabIndex={-1}
                                        className="hidden"
                                        aria-hidden="true"
                                    />
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            {isWaflowCrmHostedModal
                                                ? (t('agency.onboarding.waflow_crm_name_prompt') || "Nombre de Cuenta")
                                                : isChatwootModal
                                                    ? (t('dash.chatwoot_accounts.name_prompt') || "Nombre de la cuenta (Ej: Empresa)")
                                                    : (t('dash.locations.name_prompt') || "Nombre de la location")}
                                        </label>
                                        <input
                                            type="text"
                                            value={addModalName}
                                            onChange={(e) => setAddModalName(e.target.value)}
                                            placeholder={isWaflowCrmHostedModal ? "Ej: Operaciones Viraltia" : (isChatwootModal ? "Ej: Mi Empresa LLC" : "Ej: Sucursal Centro")}
                                            name="cw_account_name"
                                            autoComplete="off"
                                            required
                                            autoFocus
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                        />
                                    </div>
                                    {isChatwootModal && (
                                        <>
                                            {!addModalChatwootModeLocked && (
                                                <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                                                    <input
                                                        type="checkbox"
                                                        id="cw_external_toggle"
                                                        checked={addModalChatwootExternal}
                                                        onChange={e => setAddModalChatwootExternal(e.target.checked)}
                                                        className="w-5 h-5 text-indigo-600 rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                                                    />
                                                    <label htmlFor="cw_external_toggle" className="text-sm font-bold text-indigo-900 dark:text-indigo-200 cursor-pointer user-select-none">
                                                        Bring Your Own Chatwoot (BYOC)
                                                    </label>
                                                </div>
                                            )}

                                            {addModalChatwootExternal ? (
                                                <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                                                    <p className="text-xs text-gray-500 mb-2">
                                                        Conecta Waflow a un Chatwoot alojado externamente.
                                                    </p>
                                                    <div>
                                                        <div className="mb-2 flex items-center gap-2">
                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                                                URL de Chatwoot
                                                            </label>
                                                            <InlineInfoHint
                                                                ariaLabel="Ayuda para URL de Chatwoot"
                                                                text={t('agency.onboarding.chatwoot_url_help') || 'Usa el dominio base donde inicias sesion en Chatwoot. Ejemplo: https://chat.tuempresa.com. No pegues rutas internas ni links del widget.'}
                                                            />
                                                        </div>
                                                        <input
                                                            type="url"
                                                            value={addModalChatwootUrl}
                                                            onChange={(e) => setAddModalChatwootUrl(e.target.value)}
                                                            placeholder="https://chat.tuempresa.com"
                                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="mb-2 flex items-center gap-2">
                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                                                Account ID
                                                            </label>
                                                            <InlineInfoHint
                                                                ariaLabel="Ayuda para Account ID de Chatwoot"
                                                                text={t('agency.onboarding.chatwoot_account_id_help') || 'Abre la cuenta que quieres conectar y copia el numero que aparece en la URL despues de /app/accounts/. Tambien suele verse en la configuracion de la cuenta.'}
                                                            />
                                                        </div>
                                                        <input
                                                            type="number"
                                                            value={addModalChatwootAccountId}
                                                            onChange={(e) => setAddModalChatwootAccountId(e.target.value)}
                                                            placeholder="Ej: 1"
                                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="mb-2 flex items-center gap-2">
                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                                                Access Token de API
                                                            </label>
                                                            <InlineInfoHint
                                                                ariaLabel="Ayuda para Access Token de API de Chatwoot"
                                                                text={t('agency.onboarding.chatwoot_api_token_help') || 'Entra con un usuario administrador de esa cuenta y copia su access token personal desde el perfil o ajustes de usuario. Usa el api_access_token, no el inbox token ni un webhook token.'}
                                                            />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={addModalChatwootApiToken}
                                                            onChange={(e) => setAddModalChatwootApiToken(e.target.value)}
                                                            placeholder="Token de acceso (api_access_token)"
                                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                    {t('dash.chatwoot_accounts.inbox_prompt') || "Nombre del primer Telefono"}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={addModalInboxName}
                                                    onChange={(e) => setAddModalInboxName(e.target.value)}
                                                    placeholder="Ej: Soporte Principal"
                                                    name="cw_first_inbox_name"
                                                    autoComplete="off"
                                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                                />
                                            </div>
                                            <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
                                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mt-4 mb-3">
                                                            {t('dash.chatwoot_accounts.client_access_title') || "Acceso del Usuario"}
                                                </p>
                                                <div className="space-y-3">
                                                    <p className="text-[11px] text-gray-500 -mt-1">
                                                        {t('dash.chatwoot_accounts.client_name_auto_note') || "El nombre del usuario final se tomará automáticamente desde el Nombre de Cuenta."}
                                                    </p>
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                            {t('dash.chatwoot_accounts.client_email_prompt') || "Email del usuario del cliente final:"}
                                                        </label>
                                                        <input
                                                            type="email"
                                                            value={addModalClientEmail}
                                                            onChange={(e) => setAddModalClientEmail(e.target.value)}
                                                            placeholder="cliente@empresa.com"
                                                            name="cw_client_email"
                                                            autoComplete="email"
                                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                            {t('dash.chatwoot_accounts.client_password_prompt') || "Contraseña del usuario del cliente final:"}
                                                        </label>
                                                        <input
                                                            type="password"
                                                            value={addModalClientPassword}
                                                            onChange={(e) => setAddModalClientPassword(e.target.value)}
                                                            placeholder={
                                                                isSharedPrimaryChatwootEmailInModal
                                                                    ? (t('dash.chatwoot_accounts.shared_primary_password_ignored') || "Se reutilizara el mismo acceso principal")
                                                                    : (t('dash.chatwoot_accounts.client_password_optional') || "Opcional: si lo dejas vacío, se genera automática")
                                                            }
                                                            name="cw_client_password"
                                                            autoComplete="new-password"
                                                            disabled={isSharedPrimaryChatwootEmailInModal}
                                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
                                                        />
                                                        <p className="text-[11px] text-gray-500 mt-1">
                                                            {isSharedPrimaryChatwootEmailInModal
                                                                ? (t('dash.chatwoot_accounts.shared_primary_password_ignored') || "Se reutilizara el mismo acceso principal")
                                                                : "Sugerencia: Usa una contraseña segura (mínimo 6 caracteres)."}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                        )}
                                        </>
                                    )}


                                    <div className="flex gap-3 pt-2">
                                        {canGoBackToChatwootOnboarding && (
                                            <button
                                                type="button"
                                                onClick={goBackToChatwootOnboarding}
                                                disabled={isAddingLocation}
                                                className="flex-1 py-3 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white rounded-xl font-bold transition-colors disabled:opacity-60"
                                            >
                                                {t('agency.onboarding.back') || "Volver"}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={closeAddLocationModal}
                                            disabled={isAddingLocation}
                                            className="flex-1 py-3 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white rounded-xl font-bold transition-colors disabled:opacity-60"
                                        >
                                            {t('common.cancel') || "Cancelar"}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isAddingLocation || !addModalName.trim()}
                                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                                        >
                                            {isAddingLocation ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                            {t('common.create') || "Crear"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════ ONBOARDING WIZARD MODAL ═══════════════ */}
                    {showOnboarding && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { resetOnboardingWizard(); setShowOnboarding(false); }}>
                            <div
                                className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full mx-4 overflow-hidden ${
                                    onboardingStep === 0 ? "max-w-6xl" : "max-w-lg"
                                }`}
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-3">
                                        {onboardingStep > 0 && (
                                            <button
                                                onClick={() => {
                                                    resetOnboardingWizard();
                                                }}
                                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
                                            >
                                                <ChevronRight size={18} className="rotate-180" />
                                            </button>
                                        )}
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            {onboardingStep === 0 && (t('agency.onboarding.title') || 'Nueva Cuenta')}
                                            {onboardingStep === 1 && onboardingCrmType === 'ghl' && 'GoHighLevel'}
                                            {onboardingStep === 1 && onboardingCrmType === 'waflow_crm' && onboardingConnectionType !== 'chatwoot_setup_master' && (t('agency.onboarding.waflow_crm_title') || 'Waflow Mensajeria')}
                                            {onboardingStep === 1 && (onboardingCrmType === 'chatwoot' || onboardingCrmType === 'waflow_crm') && onboardingConnectionType === 'chatwoot_setup_master' && (t('dash.chatwoot_master.title') || 'Usuario Maestro de Chatwoot')}
                                        </h3>
                                    </div>
                                    <button onClick={() => { resetOnboardingWizard(); setShowOnboarding(false); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 transition">
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="p-6 md:p-7">
                                    {/* Step 0: Choose integration type */}
                                    {onboardingStep === 0 && (
                                        <div className="rounded-[28px] border-2 border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/40 p-5 md:p-8">
                                            <h4 className="text-center text-base md:text-lg font-bold text-gray-900 dark:text-white">
                                                {t('agency.onboarding.compare_title') || 'Compara beneficios y elige tu plataforma'}
                                            </h4>
                                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                                                {t('agency.onboarding.choose_integration') || 'Elige el tipo de integración para la nueva cuenta'}
                                            </p>
                                            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                {t('agency.onboarding.choose_integration_summary') || 'Elige la experiencia ideal para cada cliente. Puedes crear cuentas mixtas dentro de la misma agencia.'}
                                            </p>

                                            <div className="mt-10 grid grid-cols-1 items-stretch gap-7 md:grid-cols-3 md:gap-8">
                                                <button
                                                    onClick={() => goToOnboardingConnectionStep('ghl')}
                                                    onMouseEnter={() => setOnboardingHoveredCard('ghl')}
                                                    onMouseLeave={() => setOnboardingHoveredCard(null)}
                                                    onFocus={() => setOnboardingHoveredCard('ghl')}
                                                    onBlur={() => setOnboardingHoveredCard(null)}
                                                    className={`group flex h-full min-h-[29rem] flex-col rounded-[28px] border-[3px] p-7 text-left transition-all duration-200 ${
                                                        onboardingHoveredCard === 'ghl'
                                                            ? 'border-blue-600 dark:border-blue-400 bg-blue-50/60 dark:bg-blue-900/20 shadow-[0_14px_30px_rgba(37,99,235,0.25)] -translate-y-0.5'
                                                            : onboardingHoveredCard
                                                                ? 'opacity-75 border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-900'
                                                                : 'border-gray-900 dark:border-gray-200 bg-white dark:bg-gray-900 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-[0_10px_24px_rgba(59,130,246,0.18)]'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3 justify-between">
                                                        <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md border ${
                                                            onboardingHoveredCard === 'ghl'
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                                                        }`}>
                                                            {onboardingHoveredCard === 'ghl' ? (t('agency.onboarding.card_selected') || 'Seleccionado') : (t('agency.onboarding.card_select') || 'Seleccionar')}
                                                        </span>
                                                        <ChevronRight size={18} className={`shrink-0 transition ${
                                                            onboardingHoveredCard === 'ghl'
                                                                ? 'text-blue-600 dark:text-blue-300'
                                                                : 'text-gray-300 group-hover:text-blue-500'
                                                        }`} />
                                                    </div>
                                                    <div className="mt-5 flex items-center gap-4">
                                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 shrink-0">
                                                            <Globe size={20} className="text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <h5 className="text-[1.75rem] leading-[1.05] font-extrabold tracking-tight uppercase text-gray-900 dark:text-white">
                                                            {onboardingCardTitles.ghl}
                                                        </h5>
                                                    </div>
                                                    <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                                                        {t('agency.onboarding.benefits_title_ghl') || 'Listado de beneficios'}
                                                    </p>
                                                    <ul className="mt-4 space-y-3 text-[15px] leading-7 text-gray-800 dark:text-gray-200">
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-blue-600 shrink-0" /><span>{t('agency.onboarding.ghl_benefit_1') || 'Pipeline y CRM en un solo lugar'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-blue-600 shrink-0" /><span>{t('agency.onboarding.ghl_benefit_2') || 'Automatizaciones y campañas'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-blue-600 shrink-0" /><span>{t('agency.onboarding.ghl_benefit_3') || 'Instalación rápida de Waflow'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-blue-600 shrink-0" /><span>{t('agency.onboarding.ghl_benefit_4') || 'Mayor control comercial del cliente'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-blue-600 shrink-0" /><span>{t('agency.onboarding.ghl_benefit_5') || 'Escalable para múltiples subcuentas'}</span></li>
                                                    </ul>
                                                </button>

                                                <button
                                                    onClick={openOnboardingWaflowCrmFlow}
                                                    onMouseEnter={() => setOnboardingHoveredCard('waflow_crm')}
                                                    onMouseLeave={() => setOnboardingHoveredCard(null)}
                                                    onFocus={() => setOnboardingHoveredCard('waflow_crm')}
                                                    onBlur={() => setOnboardingHoveredCard(null)}
                                                    className={`group relative flex h-full min-h-[29rem] flex-col rounded-[28px] border-[3px] p-7 text-left transition-all duration-200 ${
                                                        onboardingHoveredCard === 'waflow_crm'
                                                            ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/20 shadow-[0_14px_30px_rgba(5,150,105,0.22)] -translate-y-0.5'
                                                            : onboardingHoveredCard
                                                                ? 'opacity-75 border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-900'
                                                                : 'border-gray-900 dark:border-gray-200 bg-white dark:bg-gray-900 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-[0_10px_24px_rgba(16,185,129,0.18)]'
                                                    }`}
                                                >
                                                    <span className="absolute -top-4 left-6 inline-flex items-center rounded-full border border-emerald-300 bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-emerald-500/25 dark:border-emerald-200/20 dark:bg-emerald-400 dark:text-emerald-950">
                                                        {t('agency.onboarding.waflow_crm_free_badge') || 'Incluido gratis'}
                                                    </span>
                                                    <div className="flex items-center gap-3 justify-between">
                                                        <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md border ${
                                                            onboardingHoveredCard === 'waflow_crm'
                                                                ? 'bg-emerald-600 text-white border-emerald-600'
                                                                : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                                                        }`}>
                                                            {onboardingHoveredCard === 'waflow_crm' ? (t('agency.onboarding.card_selected') || 'Seleccionado') : (t('agency.onboarding.card_select') || 'Seleccionar')}
                                                        </span>
                                                        <ChevronRight size={18} className={`shrink-0 transition ${
                                                            onboardingHoveredCard === 'waflow_crm'
                                                                ? 'text-emerald-600 dark:text-emerald-300'
                                                                : 'text-gray-300 group-hover:text-emerald-500'
                                                        }`} />
                                                    </div>
                                                    <div className="mt-5 flex items-center gap-4">
                                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30 shrink-0">
                                                            <Building2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                        <h5 className="text-[1.75rem] leading-[1.05] font-extrabold tracking-tight uppercase text-gray-900 dark:text-white">
                                                            {onboardingCardTitles.waflow}
                                                        </h5>
                                                    </div>
                                                    <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                                                        {t('agency.onboarding.benefits_title_waflow') || 'Listado de beneficios'}
                                                    </p>
                                                    <ul className="mt-4 space-y-3 text-[15px] leading-7 text-gray-800 dark:text-gray-200">
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-emerald-600 shrink-0" /><span>{t('agency.onboarding.waflow_crm_benefit_1') || 'Cuenta lista para operar en minutos'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-emerald-600 shrink-0" /><span>{t('agency.onboarding.waflow_crm_benefit_2') || 'WhatsApp, inboxes y usuarios en un solo flujo'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-emerald-600 shrink-0" /><span>{t('agency.onboarding.waflow_crm_benefit_3') || 'Operación diaria dentro de Waflow'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-emerald-600 shrink-0" /><span>{t('agency.onboarding.waflow_crm_benefit_4') || 'Infraestructura administrada por nuestro equipo'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-emerald-600 shrink-0" /><span>{t('agency.onboarding.waflow_crm_benefit_5') || 'Ideal para agencias que quieren marca propia'}</span></li>
                                                    </ul>
                                                </button>

                                                <button
                                                    onClick={openOnboardingChatwootByocFlow}
                                                    onMouseEnter={() => setOnboardingHoveredCard('chatwoot')}
                                                    onMouseLeave={() => setOnboardingHoveredCard(null)}
                                                    onFocus={() => setOnboardingHoveredCard('chatwoot')}
                                                    onBlur={() => setOnboardingHoveredCard(null)}
                                                    className={`group flex h-full min-h-[29rem] flex-col rounded-[28px] border-[3px] p-7 text-left transition-all duration-200 ${
                                                        onboardingHoveredCard === 'chatwoot'
                                                            ? 'border-violet-600 dark:border-violet-400 bg-violet-50/60 dark:bg-violet-900/20 shadow-[0_14px_30px_rgba(124,58,237,0.25)] -translate-y-0.5'
                                                            : onboardingHoveredCard
                                                                ? 'opacity-75 border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-900'
                                                                : 'border-gray-900 dark:border-gray-200 bg-white dark:bg-gray-900 hover:border-violet-500 dark:hover:border-violet-400 hover:shadow-[0_10px_24px_rgba(139,92,246,0.2)]'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3 justify-between">
                                                        <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md border ${
                                                            onboardingHoveredCard === 'chatwoot'
                                                                ? 'bg-violet-600 text-white border-violet-600'
                                                                : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                                                        }`}>
                                                            {onboardingHoveredCard === 'chatwoot' ? (t('agency.onboarding.card_selected') || 'Seleccionado') : (t('agency.onboarding.card_select') || 'Seleccionar')}
                                                        </span>
                                                        <ChevronRight size={18} className={`shrink-0 transition ${
                                                            onboardingHoveredCard === 'chatwoot'
                                                                ? 'text-violet-600 dark:text-violet-300'
                                                                : 'text-gray-300 group-hover:text-violet-500'
                                                        }`} />
                                                    </div>
                                                    <div className="mt-5 flex items-center gap-4">
                                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30 shrink-0">
                                                            <MessageSquare size={20} className="text-violet-600 dark:text-violet-400" />
                                                        </div>
                                                        <h5 className="text-[1.75rem] leading-[1.05] font-extrabold tracking-tight uppercase text-gray-900 dark:text-white">
                                                            {onboardingCardTitles.chatwoot}
                                                        </h5>
                                                    </div>
                                                    <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                                                        {t('agency.onboarding.benefits_title_chatwoot') || 'Listado de beneficios'}
                                                    </p>
                                                    <ul className="mt-4 space-y-3 text-[15px] leading-7 text-gray-800 dark:text-gray-200">
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-violet-600 shrink-0" /><span>{t('agency.onboarding.chatwoot_benefit_1') || 'Bandeja omnicanal colaborativa'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-violet-600 shrink-0" /><span>{t('agency.onboarding.chatwoot_benefit_2') || 'Asignación por equipo e inbox'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-violet-600 shrink-0" /><span>{t('agency.onboarding.chatwoot_benefit_3') || 'Conexión nativa con WhatsApp'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-violet-600 shrink-0" /><span>{t('agency.onboarding.chatwoot_benefit_4') || 'Contexto completo por conversación'}</span></li>
                                                        <li className="flex gap-3"><CheckCircle2 size={14} className="mt-1 text-violet-600 shrink-0" /><span>{t('agency.onboarding.chatwoot_benefit_5') || 'Ideal para equipos de soporte/operación'}</span></li>
                                                    </ul>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 1 GHL: Connection type */}
                                    {onboardingStep === 1 && onboardingCrmType === 'ghl' && !onboardingConnectionType && (
                                        <div className="space-y-3">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                                {t('agency.onboarding.connection_type') || '¿Cómo deseas conectar tu cuenta?'}
                                            </p>
                                            <button
                                                onClick={handleInstallExistingGhlAccount}
                                                className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-gray-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group text-left flex items-center gap-4"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                                    <Download size={20} className="text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                                                        {t('agency.onboarding.already_have_account') || 'Ya tengo una cuenta'}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                        {t('agency.onboarding.ghl_install_panel') || 'Instala la app de Waflow en tu location existente'}
                                                    </p>
                                                </div>
                                                <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 ml-auto shrink-0 transition" />
                                            </button>
                                            <button
                                                onClick={() => setOnboardingConnectionType('ghl_create_subaccount')}
                                                className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-gray-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group text-left flex items-center gap-4"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                                    <Plus size={20} className="text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                                                        {t('agency.onboarding.create_subaccount') || 'Solicitar Cuenta con nuestra agencia'}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                        {t('agency.onboarding.ghl_create_subaccount_form') || 'Creamos una nueva subcuenta GoHighLevel para ti'}
                                                    </p>
                                                </div>
                                                <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 ml-auto shrink-0 transition" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Step 1 GHL: Manual sub-account request form */}
                                    {onboardingStep === 1 && onboardingCrmType === 'ghl' && onboardingConnectionType === 'ghl_create_subaccount' && (
                                        <form onSubmit={async (e) => {
                                            e.preventDefault();
                                            if (
                                                !onboardingSubaccountName.trim() ||
                                                !onboardingSubaccountEmail.trim() ||
                                                !onboardingSubaccountPhone.trim()
                                            ) {
                                                toast.error('Completa nombre, email y teléfono antes de enviar la solicitud.');
                                                return;
                                            }
                                            setIsCreatingSubaccount(true);
                                            try {
                                                const resp = await authFetch('/agency/ghl/subaccount-request', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        name: onboardingSubaccountName.trim(),
                                                        email: onboardingSubaccountEmail.trim(),
                                                        phone: onboardingSubaccountPhone.trim(),
                                                        notes: onboardingSubaccountNotes.trim()
                                                    })
                                                });
                                                const data = await parseApiResponse(resp);
                                                if (!resp.ok) {
                                                    throw new Error(
                                                        data?.error ||
                                                        data?.rawText ||
                                                        `Error creando subcuenta (HTTP ${resp.status})`
                                                    );
                                                }
                                                toast.success(
                                                    data?.message ||
                                                    t('agency.onboarding.subaccount_request_submitted') ||
                                                    'Solicitud enviada. En un plazo de 24 a 48 horas nuestro equipo se pondrá en contacto contigo.'
                                                );
                                                setShowOnboarding(false);
                                                resetOnboardingSubaccountForm();
                                                setOnboardingConnectionType(null);
                                            } catch (err) {
                                                toast.error(err.message || 'Error enviando la solicitud');
                                            } finally {
                                                setIsCreatingSubaccount(false);
                                            }
                                        }} className="space-y-4">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                                {t('agency.onboarding.ghl_create_subaccount_form') || 'Solicita una nueva subcuenta GoHighLevel con nuestro equipo'}
                                            </p>
                                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                                {t('agency.onboarding.ghl_subaccount_request_hint') || 'Completa el formulario y en un plazo de 24 a 48 horas nuestro equipo se pondrá en contacto contigo para crear la subcuenta.'}
                                            </p>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {t('agency.onboarding.ghl_subaccount_name') || 'Nombre de la Cuenta'} *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={onboardingSubaccountName}
                                                    onChange={e => setOnboardingSubaccountName(e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="Mi Negocio"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {t('agency.onboarding.ghl_subaccount_email') || 'Email del negocio'} *
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="email"
                                                        required
                                                        value={onboardingSubaccountEmail}
                                                        onChange={e => {
                                                            setOnboardingSubaccountEmail(e.target.value);
                                                            setOnboardingSubaccountEmailCode('');
                                                            setSubaccountEmailOtpRequested(false);
                                                        }}
                                                        className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                        placeholder="email@negocio.com"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {t('agency.onboarding.ghl_subaccount_phone') || 'Teléfono'} *
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="tel"
                                                        required
                                                        value={onboardingSubaccountPhone}
                                                        onChange={e => {
                                                            setOnboardingSubaccountPhone(e.target.value);
                                                            setOnboardingSubaccountPhoneCode('');
                                                            setSubaccountPhoneOtpRequested(false);
                                                        }}
                                                        className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                        placeholder="+1234567890"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {t('agency.onboarding.ghl_subaccount_notes') || 'Notas adicionales'}
                                                </label>
                                                <textarea
                                                    rows={4}
                                                    value={onboardingSubaccountNotes}
                                                    onChange={e => setOnboardingSubaccountNotes(e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                                    placeholder={t('agency.onboarding.ghl_subaccount_notes_placeholder') || 'Cuéntanos si necesitas dominio, nicho, país o cualquier detalle útil para preparar la subcuenta.'}
                                                />
                                            </div>
                                            <div className="flex justify-end gap-2 pt-2">
                                                <button type="button" onClick={() => { resetOnboardingSubaccountForm(); setOnboardingConnectionType(null); }} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition">
                                                    {t('agency.onboarding.back') || 'Volver'}
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={
                                                        isCreatingSubaccount ||
                                                        !onboardingSubaccountName.trim() ||
                                                        !onboardingSubaccountEmail.trim() ||
                                                        !onboardingSubaccountPhone.trim()
                                                    }
                                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isCreatingSubaccount ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                                    {t('agency.onboarding.send_request') || 'Enviar solicitud'}
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {/* Step 1 Chatwoot: Master user quick setup */}
                                    {onboardingStep === 1 && (onboardingCrmType === 'chatwoot' || onboardingCrmType === 'waflow_crm') && onboardingConnectionType === 'chatwoot_setup_master' && (
                                        <form
                                            onSubmit={async (e) => {
                                                const saved = await handleSaveChatwootMasterUser(e);
                                                if (!saved) return;
                                                setOnboardingConnectionType('waflow_crm_hosted');
                                                openOnboardingChatwootAddModal({ external: false, onboardingType: 'waflow_crm' });
                                            }}
                                            className="space-y-4"
                                        >
                                            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/20 p-4">
                                                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                                                    {chatwootMasterBenefitCopy}
                                                </p>
                                                {chatwootMasterDisplayEmail && (
                                                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2">
                                                        {(t('dash.chatwoot_master.configured_as') || 'Configurado como') + ` ${chatwootMasterDisplayEmail}`}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                    {t('dash.chatwoot_master.name') || 'Nombre del Usuario Maestro'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={chatwootMasterName}
                                                    onChange={(e) => {
                                                        markChatwootMasterDraftDirty();
                                                        setChatwootMasterName(e.target.value);
                                                    }}
                                                    placeholder="Ej: Soporte Agencia"
                                                    autoComplete="off"
                                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                    {t('dash.chatwoot_master.email') || 'Email del Usuario Maestro'}
                                                </label>
                                                <input
                                                    type="email"
                                                    value={chatwootMasterEmail}
                                                    onChange={(e) => {
                                                        markChatwootMasterDraftDirty();
                                                        setChatwootMasterEmail(e.target.value);
                                                    }}
                                                    placeholder="soporte@agencia.com"
                                                    autoComplete="off"
                                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                                />
                                            </div>
                                            {chatwootMasterConfigured && (
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                        {t('dash.chatwoot_master.verify_password') || 'Contraseña actual para verificar cambios'}
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={chatwootMasterVerificationPassword}
                                                        onChange={(e) => {
                                                            markChatwootMasterDraftDirty();
                                                            setChatwootMasterVerificationPassword(e.target.value);
                                                        }}
                                                        placeholder="••••••••"
                                                        autoComplete="current-password"
                                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        {t('dash.chatwoot_master.verify_password_desc') || 'Antes de guardar cambios, verifica con la contraseña actual del Usuario Maestro.'}
                                                    </p>
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                    {chatwootMasterConfigured
                                                        ? (t('dash.chatwoot_master.new_password') || 'Nueva contraseña del Usuario Maestro')
                                                        : (t('dash.chatwoot_master.password') || 'Contraseña del Usuario Maestro')}
                                                </label>
                                                <input
                                                    type="password"
                                                    value={chatwootMasterPassword}
                                                    onChange={(e) => {
                                                        markChatwootMasterDraftDirty();
                                                        setChatwootMasterPassword(e.target.value);
                                                    }}
                                                    placeholder="••••••••"
                                                    autoComplete="new-password"
                                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                                />
                                                <p className="text-xs text-gray-500 mt-2">
                                                    {t('dash.chatwoot_accounts.password_rules') || 'Debe tener mínimo 6 caracteres, incluyendo mayúscula, minúscula, número y símbolo.'}
                                                </p>
                                            </div>
                                            <div className="flex justify-end gap-2 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={resetOnboardingWizard}
                                                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
                                                >
                                                    {t('agency.onboarding.back') || 'Volver'}
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={isSavingChatwootMaster}
                                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isSavingChatwootMaster ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                    {t('agency.onboarding.chatwoot_master_save_continue') || 'Guardar y continuar'}
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                </div>
                            </div>
                        </div>
                    )}

                </main>

            </div>

            {selectedLocation && (
                <LocationDetailsModal
                    location={selectedLocation}
                    token={token}
                    onLogout={onLogout}
                    onClose={() => setSelectedLocation(null)}
                    onUpgrade={() => setShowUpgradeModal(true)}
                    onDataChange={refreshData}
                />
            )}
            {/* ✅ MODAL DE INACTIVIDAD (BLOQUEO TOTAL) */}
            <InactiveUserModal 
                show={accountInfo && accountInfo.is_active === false} 
                onLogout={onLogout} 
            />

            {/* ✅ POPUP DE EXPIRACIÓN (SOLO VISUAL) */}
            <ExpiryPopup accountInfo={accountInfo} />

        </div>
    );
}

const SidebarItem = ({ id, icon: Icon, label, activeTab, setActiveTab, branding, sidebarOpen }) => (
    <button
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm mb-1
            ${activeTab === id ? 'font-bold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}
        `}
        style={activeTab === id ? { color: branding?.primaryColor || '#4F46E5', backgroundColor: (branding?.primaryColor || '#4F46E5') + '15' } : {}}
    >
        <Icon size={20} />
        {sidebarOpen && <span>{label}</span>}
    </button>
);

const ReliabilityLineChart = ({ data, maxValue, emptyLabel, reconnectLabel, incidentLabel }) => {
    if (!Array.isArray(data) || data.length === 0 || !data.some((item) => Number(item?.sent) > 0 || Number(item?.failed) > 0)) {
        return (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/30 p-5 text-sm text-gray-500 dark:text-gray-400">
                {emptyLabel}
            </div>
        );
    }

    const width = 720;
    const height = 240;
    const padding = { top: 20, right: 16, bottom: 36, left: 34 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const safeMax = Math.max(1, Number(maxValue) || 1);
    const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;
    const yTickStep = safeMax <= 6 ? 1 : Math.ceil(safeMax / 5);
    const yTickValues = [];

    for (let tick = safeMax; tick >= 0; tick -= yTickStep) {
        yTickValues.push(tick);
    }
    if (yTickValues[yTickValues.length - 1] !== 0) {
        yTickValues.push(0);
    }

    const buildPath = (selector) => data.map((point, index) => {
        const rawValue = Number(selector(point)) || 0;
        const x = padding.left + (index * stepX);
        const y = padding.top + chartHeight - ((rawValue / safeMax) * chartHeight);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const reconnectPath = buildPath((point) => point?.sent);
    const incidentPath = buildPath((point) => point?.failed);

    return (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/30 p-4">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                {yTickValues.map((tickValue) => {
                    const y = padding.top + chartHeight - ((tickValue / safeMax) * chartHeight);
                    return (
                        <g key={`grid-${tickValue}`}>
                            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="currentColor" className="text-gray-200 dark:text-gray-800" strokeDasharray="3 5" />
                            <text x={padding.left - 10} y={y + 4} textAnchor="end" className="fill-gray-400 text-[10px]">{tickValue}</text>
                        </g>
                    );
                })}

                <path d={reconnectPath} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d={incidentPath} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                {data.map((point, index) => {
                    const x = padding.left + (index * stepX);
                    const reconnectY = padding.top + chartHeight - (((Number(point?.sent) || 0) / safeMax) * chartHeight);
                    const incidentY = padding.top + chartHeight - (((Number(point?.failed) || 0) / safeMax) * chartHeight);
                    const showTick = index % 6 === 0 || index === data.length - 1;
                    const tooltipText = [
                        formatTimelineTooltip(point?.bucketStart),
                        `${reconnectLabel}: ${Number(point?.sent) || 0}`,
                        `${incidentLabel}: ${Number(point?.failed) || 0}`
                    ].filter(Boolean).join('\n');

                    return (
                        <g key={`point-${point?.bucketStart || index}`}>
                            <circle cx={x} cy={reconnectY} r="7" fill="transparent" className="cursor-help">
                                <title>{tooltipText}</title>
                            </circle>
                            <circle cx={x} cy={incidentY} r="7" fill="transparent" className="cursor-help">
                                <title>{tooltipText}</title>
                            </circle>
                            <circle cx={x} cy={reconnectY} r="3.5" fill="#3b82f6" pointerEvents="none" />
                            <circle cx={x} cy={incidentY} r="3.5" fill="#f59e0b" pointerEvents="none" />
                            {showTick && (
                                <text x={x} y={height - 10} textAnchor="middle" className="fill-gray-400 text-[10px]">
                                    {formatTimelineHour(point?.bucketStart)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> {reconnectLabel}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> {incidentLabel}</span>
            </div>
        </div>
    );
};

const ReliabilityAccountBars = ({
    data,
    emptyLabel,
    reconnectText,
    alertText,
    replyRatioText,
    replyNoSampleText,
    replyStrikeText,
    replyAnsweredText
}) => {
    if (!Array.isArray(data) || data.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/30 p-5 text-sm text-gray-500 dark:text-gray-400">
                {emptyLabel}
            </div>
        );
    }

    const maxValue = Math.max(1, ...data.map((item) => Number(item?.totalEvents) || 0));

    return (
        <div className="space-y-4">
            {data.map((item) => {
                const percent = Math.max(6, Math.round(((Number(item?.totalEvents) || 0) / maxValue) * 100));
                const strikeCount = Number(item?.replyStrikes) || 0;
                const hasReplySample = (Number(item?.inboundCount) || 0) > 0;
                const statusTone = item?.replyAutoBlocked
                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800"
                    : strikeCount > 0
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
                const ratioText = hasReplySample
                    ? `${replyRatioText}: ${Number(item?.replyRate) || 0}%`
                    : `${replyRatioText}: ${replyNoSampleText}`;
                const detailText = `${Number(item?.answeredCount) || 0}/${Number(item?.inboundCount) || 0} ${replyAnsweredText}`;
                return (
                    <div key={item.locationId} className="grid grid-cols-[minmax(0,220px)_1fr_auto] gap-3 items-center">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {item.sent} {reconnectText} · {item.failed} {alertText}
                            </p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                                {ratioText} · {detailText}
                            </p>
                        </div>
                        <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${strikeCount > 0 ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-blue-500 to-amber-500'}`}
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                            {strikeCount > 0 && (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full border text-[11px] font-semibold ${statusTone}`}>
                                    {replyStrikeText} {strikeCount}/3
                                </span>
                            )}
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{item.totalEvents}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

//const SecurityCard = ({ token }) => {
//    const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
//    const [loading, setLoading] = useState(false);

//    const handleChangePassword = async (e) => {
//        e.preventDefault();
//        if (passData.new !== passData.confirm) return toast.error("Las contraseñas no coinciden");
//        if (passData.new.length < 6) return toast.error("Mínimo 6 caracteres");

//        setLoading(true);
//        try {
//            const res = await fetch(`${API_URL}/auth/change-password`, {
//                method: 'POST',
//                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
//                body: JSON.stringify({ currentPassword: passData.current, newPassword: passData.new })
//            });
//            const data = await res.json();
//            if (res.ok) { toast.success("Contraseña actualizada"); setPassData({ current: '', new: '', confirm: '' }); }
//            else toast.error(data.error);
//        } catch (err) { toast.error("Error de conexión"); } finally { setLoading(false); }
//    };

//    return (
//        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
//            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><ShieldCheck size={20} /> Seguridad</h3>
//            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
//                <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Actual</label><input type="password" required className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={passData.current} onChange={e => setPassData({ ...passData, current: e.target.value })} /></div>
//                <div className="grid grid-cols-2 gap-4">
//                    <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nueva</label><input type="password" required className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={passData.new} onChange={e => setPassData({ ...passData, new: e.target.value })} /></div>
//                    <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Confirmar</label><input type="password" required className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={passData.confirm} onChange={e => setPassData({ ...passData, confirm: e.target.value })} /></div>
//                </div>
//                <button type="submit" disabled={loading} className="mt-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-700 transition">{loading ? "..." : "Actualizar"}</button>
//            </form>
//        </div>
//    );
//};



