import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import LocationDetailsModal from './LocationDetailsModalNext';
import SubscriptionManager from './SubscriptionManagerNext';
import SupportManager from './SupportManagerNext';
import SubscriptionModal from './SubscriptionModal'; 
import SubscriptionBlocker from './SubscriptionBlocker';
import ExpiryPopup from './ExpiryPopup'; // ✅ Importar Popup
import InactiveUserModal from './InactiveUserModal'; // ✅ Importar Modal Inactivo
import InteractiveMessageBuilder from './InteractiveMessageBuilderNext';
import OfficialTemplateBuilder from './OfficialTemplateBuilderNext';
import WorkflowAgentsPanel from './WorkflowAgentsPanelNext';
import ThemeToggle from '../components/ThemeToggleNext';
import LanguageSelector from '../components/LanguageSelectorNext'; 
import { useLanguage } from '../context/LanguageContext'; 
import { useTheme } from '../context/ThemeContext';
import { useBranding } from '../context/BrandingContext';
import { classifyGhlInstallCallback } from '../utils/ghlInstallCallback';
import '../index.next.css';

import {
    LayoutGrid, CreditCard, LifeBuoy, LogOut,
    Plus, Search, Building2, Smartphone, RefreshCw, List,
    ExternalLink, Menu, CheckCircle2, ChevronRight, ArrowRight, Zap,
    TrendingUp, ShieldCheck, Settings, Trash2,
    Lock, User, Users, Moon, Sun, Link, MousePointer2,
    Key, Copy, Terminal, Globe, Save, Palette, RotateCcw, BookOpen, Hammer, FileText,
    Sparkles, Bot, CalendarCheck, MessageSquareText, Download, MessageSquare, Loader2, X, Info,
    Activity, AlertTriangle, Send // ✅ Iconos
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");
const SUPPORT_PHONE = import.meta.env.SUPPORT_PHONE || "34611770270";
const DEFAULT_GHL_INSTALL_PATH = "/integration/6968d10f1f0b9e6b537024cd";
const RELIABILITY_PAGE_SIZE = 10;
const MANAGED_GHL_REQUEST_INTENT_KEY = "waflow:managed-ghl-request-intent";
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

function formatOperationalTimestamp(value) {
    if (!value) return "";
    const timestamp = new Date(value);
    if (!Number.isFinite(timestamp.getTime())) return "";
    return timestamp.toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function translateOr(t, key, fallback) {
    const translated = typeof t === "function" ? t(key) : null;
    if (!translated || translated === key) return fallback;
    return translated;
}

function getPreventiveRiskLabel(level, t) {
    const labels = {
        info: translateOr(t, 'agency.reliability.risk_low', 'Riesgo bajo'),
        attention: translateOr(t, 'agency.reliability.risk_attention', 'Atención recomendada'),
        high: translateOr(t, 'agency.reliability.risk_elevated', 'Riesgo elevado'),
        critical: translateOr(t, 'agency.reliability.risk_high', 'Riesgo alto')
    };
    return labels[String(level || '').toLowerCase()]
        || translateOr(t, 'agency.reliability.risk_unknown', 'Sin señal activa');
}

function getPreventiveSignalTitle(type, t) {
    const titles = {
        reply_ratio_low: translateOr(t, 'agency.reliability.signal_reply_ratio', 'Baja proporción de respuestas'),
        follow_up_without_reply: translateOr(t, 'agency.reliability.signal_follow_up', 'Seguimientos sin respuesta'),
        repetitive_copy: translateOr(t, 'agency.reliability.signal_repetitive', 'Mensajes repetidos'),
        burst_sending: translateOr(t, 'agency.reliability.signal_burst', 'Ritmo de envío acelerado'),
        spam_like_copy: translateOr(t, 'agency.reliability.signal_content', 'Contenido potencialmente sensible')
    };
    return titles[String(type || '').toLowerCase()]
        || translateOr(t, 'agency.reliability.signal_other', 'Patrón preventivo detectado');
}

function getPreventiveSignalAction(type, t) {
    const actions = {
        reply_ratio_low: translateOr(t, 'agency.reliability.signal_reply_ratio_action', 'Reduce temporalmente el volumen y prioriza conversaciones con clientes que ya respondieron.'),
        follow_up_without_reply: translateOr(t, 'agency.reliability.signal_follow_up_action', 'Espacia los reintentos y detén seguimientos a contactos que ya acumulan mensajes sin respuesta.'),
        repetitive_copy: translateOr(t, 'agency.reliability.signal_repetitive_action', 'Varía el contenido y separa mejor las audiencias antes de continuar con el mismo mensaje.'),
        burst_sending: translateOr(t, 'agency.reliability.signal_burst_action', 'Reduce la cadencia y distribuye los envíos en periodos más amplios.'),
        spam_like_copy: translateOr(t, 'agency.reliability.signal_content_action', 'Suaviza el tono comercial y revisa urgencias, enlaces o afirmaciones promocionales.')
    };
    return actions[String(type || '').toLowerCase()]
        || translateOr(t, 'agency.reliability.signal_other_action', 'Modera el ritmo y revisa en tu CRM los envíos recientes asociados con esta cuenta.');
}

function polishPreventiveSignalText(value) {
    return String(value || '')
        .replace(/Ã¡/g, 'á')
        .replace(/Ã©/g, 'é')
        .replace(/Ã­/g, 'í')
        .replace(/Ã³/g, 'ó')
        .replace(/Ãº/g, 'ú')
        .replace(/Ã±/g, 'ñ')
        .replace(/â€¦/g, '…')
        .replace(/\bdespues\b/gi, 'después')
        .replace(/\bobservacion\b/gi, 'observación')
        .replace(/\benvio(s)?\b/gi, 'envío$1')
        .replace(/\bmaxima\b/gi, 'máxima')
        .replace(/\bidentica(s)?\b/gi, 'idéntica$1')
        .replace(/\bdetecto\b/gi, 'detectó')
        .replace(/\btrafico\b/gi, 'tráfico')
        .trim();
}

function toFiniteMetric(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getHealthTone(status) {
    switch (String(status || "").toLowerCase()) {
        case "blocked":
        case "critical":
        case "high":
        case "review":
        case "delicate":
            return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-800";
        case "attention":
        case "watch":
        case "sensitive":
            return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-200 dark:border-sky-800";
        case "info":
        case "care":
            return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-200 dark:border-indigo-800";
        case "paused":
        case "unknown":
            return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700";
        default:
            return "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
    }
}

function getNumberQualityLabel(level, t) {
    switch (String(level || "").toLowerCase()) {
        case "delicate":
            return translateOr(t, 'agency.reliability.number_quality_delicate', 'Delicada');
        case "sensitive":
            return translateOr(t, 'agency.reliability.number_quality_sensitive', 'Sensible');
        case "care":
            return translateOr(t, 'agency.reliability.number_quality_care', 'A cuidar');
        case "good":
            return translateOr(t, 'agency.reliability.number_quality_good', 'Buena');
        default:
            return translateOr(t, 'agency.reliability.number_quality_unknown', 'Sin datos recientes');
    }
}

function getNumberQualitySourceLabel(source = "", t) {
    const normalized = String(source || "").toLowerCase();
    if (normalized.includes("official")) {
        return translateOr(t, 'agency.reliability.number_quality_source_meta', 'Calidad Meta');
    }
    if (normalized === "internal_history") {
        return translateOr(t, 'agency.reliability.number_quality_source_internal', 'Calidad del número');
    }
    return translateOr(t, 'agency.reliability.number_quality_source_unknown', 'Calidad del número');
}

function getNumberQualityTooltip(source = "", t) {
    const normalized = String(source || "").toLowerCase();
    if (normalized.includes("official")) {
        return translateOr(t, 'agency.reliability.number_quality_tooltip_meta', 'Rating oficial de Meta combinado con señales internas recientes.');
    }
    if (normalized === "internal_history") {
        return translateOr(t, 'agency.reliability.number_quality_tooltip_internal', 'Estimación interna de WaFloW basada en actividad reciente, respuestas, volumen y repetición.');
    }
    return translateOr(t, 'agency.reliability.number_quality_tooltip_unknown', 'No hay suficientes datos recientes asociados a este slot. No significa que el número sea nuevo ni malo.');
}

function getNumberQualityPreviewIdentity(preview = {}, t) {
    const phone = String(preview?.phone_number || preview?.phoneNumber || "").trim();
    if (phone) return phone;

    const slotName = String(preview?.slot_name || preview?.slotName || "").trim();
    if (slotName) return slotName;

    const slotId = Number.parseInt(preview?.slot_id ?? preview?.slotId, 10) || 0;
    if (slotId > 0) {
        return `${translateOr(t, 'workflow_agents.slot_prefix', 'Slot')} ${slotId}`;
    }

    return translateOr(t, 'agency.reliability.number_preview_unknown', 'Número sin identificar');
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

function InlineInfoHint({ text, ariaLabel = "Más información" }) {
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

function formatTimelineTooltip(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString([], {
        day: '2-digit',
        month: 'short'
    });
}

export default function AgencyDashboard({ token, onLogout }) {
    const { t, language } = useLanguage();
    // ✅ Agregamos loadAgencyBranding para cargar desde server
    const { branding, updateBranding, resetBranding, DEFAULT_BRANDING, systemBranding, loadAgencyBranding } = useBranding();

    const [storedAgencyId, setStoredAgencyId] = useState(localStorage.getItem("agencyId"));
    const queryParams = new URLSearchParams(window.location.search);
    const AGENCY_ID = storedAgencyId || queryParams.get("agencyId");
    const initialTabParam = String(queryParams.get("tab") || "").trim().toLowerCase();
    const initialTab = ["overview", "billing", "reliability", "settings", "builder", "templates-meta"].includes(initialTabParam)
        ? initialTabParam
        : ["templates", "my-templates"].includes(initialTabParam)
            ? "templates-meta"
        : "overview";
    const initialTemplatesMetaTab = initialTabParam === "my-templates" ? "library" : "builder";
    const { theme, toggleTheme } = useTheme();

    const [activeTab, setActiveTab] = useState(initialTab);
    const [templatesMetaTab, setTemplatesMetaTab] = useState(initialTemplatesMetaTab);
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
    const [reliabilityView, setReliabilityView] = useState('summary');
    const [reachoutChecking, setReachoutChecking] = useState(null);

    const [accountInfo, setAccountInfo] = useState(null);
    const isRestricted = (accountInfo?.plan || '').toLowerCase().includes('starter');
    const [crmPreference, setCrmPreference] = useState(localStorage.getItem("crmType") || "ghl");
    const agencyCrmType = String(accountInfo?.crm_type || crmPreference || "ghl").toLowerCase();
    const isGhlAgency = agencyCrmType === "ghl";
    const isChatwootAgency = agencyCrmType === "chatwoot";
    const isCrmLocked = Boolean(accountInfo?.crm_type);
    const planStatus = String(accountInfo?.plan || "").trim().toLowerCase();
    const accountRole = String(accountInfo?.role || "").trim().toLowerCase();
    const hasPaidPlanAccess =
        accountInfo?.has_paid_subscription === true ||
        (accountInfo?.has_paid_subscription === undefined && planStatus === "active");
    const canRequestManagedGhlSubaccount =
        hasPaidPlanAccess ||
        accountRole === "admin" ||
        accountRole === "superadmin" ||
        accountRole === "super_admin";
    const crmLabelMap = { ghl: "GoHighLevel", waflow: "Waflow Inbox", chatwoot: "Waflow Inbox", odoo: "Odoo" };
    const activeCrmLabel = crmLabelMap[agencyCrmType] || agencyCrmType.toUpperCase();
    const isSpanish = language === 'es';
    const onboardingCardTitles = {
        ghl: 'GoHighLevel',
        waflow: isSpanish ? 'Waflow Inbox' : 'Waflow Inbox',
        chatwoot: isSpanish ? 'Waflow Inbox' : 'Waflow Inbox',
    };
    const chatwootMasterBenefitCopy = isSpanish
        ? 'Este usuario habilita nuevas cuentas Waflow Inbox hospedadas por nosotros.'
        : 'This user provisions new Waflow Inbox accounts hosted by us.';
    const [searchTerm, setSearchTerm] = useState("");
    const [reliabilityPage, setReliabilityPage] = useState(1);
    const [userEmail, setUserEmail] = useState("");

    const [isAccountSuspended, setIsAccountSuspended] = useState(false);
    const [suspensionStatus, setSuspensionStatus] = useState(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showManagedGhlPaidGate, setShowManagedGhlPaidGate] = useState(false);
    const [showManagedGhlBillingModal, setShowManagedGhlBillingModal] = useState(false);
    const [pendingManagedGhlRequest, setPendingManagedGhlRequest] = useState(() => {
        try {
            return window.sessionStorage.getItem(MANAGED_GHL_REQUEST_INTENT_KEY) === "1";
        } catch (_) {
            return false;
        }
    });

    // Modal state for adding locations
    const [showAddModal, setShowAddModal] = useState(false);
    const [tenantPendingDeletion, setTenantPendingDeletion] = useState(null);
    const [isDeletingTenant, setIsDeletingTenant] = useState(false);
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
    const [accountsFilter, setAccountsFilter] = useState("all"); // "all" | "ghl" | "chatwoot"
    const [accountsView, setAccountsView] = useState(() => localStorage.getItem("waflow:accounts-view-v2") || "expanded");
    const [settingsSection, setSettingsSection] = useState("guide");
    const [settingsIntegrationTab, setSettingsIntegrationTab] = useState("ghl");
    const [settingsSupportBrandTab, setSettingsSupportBrandTab] = useState("support");
    const [integrationOpenAiAccounts, setIntegrationOpenAiAccounts] = useState([]);
    const [integrationOpenAiKeys, setIntegrationOpenAiKeys] = useState([]);
    const [integrationOpenAiKeyNameDraft, setIntegrationOpenAiKeyNameDraft] = useState("");
    const [integrationOpenAiKeyValueDraft, setIntegrationOpenAiKeyValueDraft] = useState("");
    const [integrationOpenAiKeyFormOpen, setIntegrationOpenAiKeyFormOpen] = useState(true);
    const [integrationOpenAiSearch, setIntegrationOpenAiSearch] = useState("");
    const [integrationOpenAiLoading, setIntegrationOpenAiLoading] = useState(false);
    const [integrationOpenAiSaving, setIntegrationOpenAiSaving] = useState(false);
    const [integrationOpenAiSavingAccountId, setIntegrationOpenAiSavingAccountId] = useState(null);

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
                return data;
            } else if (!AGENCY_ID) {
                setLoading(false);
                return null;
            }
        } catch (error) {
            console.error("Error refrescando datos", error);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const resolveEffectiveAgencyIdForAgencyRequests = async () => {
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

        return effectiveAgencyId || null;
    };

    const fetchAgencyLocationsSnapshot = async () => {
        const effectiveAgencyId = await resolveEffectiveAgencyIdForAgencyRequests();
        if (!effectiveAgencyId) return [];

        const locRes = await authFetch(`/agency/locations?agencyId=${encodeURIComponent(effectiveAgencyId)}`);
        if (!locRes?.ok) return [];

        const locData = await locRes.json().catch(() => []);
        return Array.isArray(locData) ? locData : [];
    };

    const fetchIntegrationOpenAiAccounts = async ({ silent = false } = {}) => {
        if (!silent) setIntegrationOpenAiLoading(true);
        try {
            const effectiveAgencyId = await resolveEffectiveAgencyIdForAgencyRequests();
            if (!effectiveAgencyId) {
                setIntegrationOpenAiAccounts([]);
                return;
            }

            const res = await authFetch(`/agency/openai-eligible-accounts?agencyId=${encodeURIComponent(effectiveAgencyId)}`);
            if (!res?.ok) {
                const body = await parseApiResponse(res);
                const errorMessage = body?.error || body?.rawText || (t('agency.integrations.openai_accounts_load_error') || 'No se pudo cargar la lista de cuentas.');
                console.error("OpenAI eligible accounts request failed", {
                    status: res?.status,
                    body
                });
                throw new Error(`${errorMessage} (HTTP ${res?.status || 'unknown'})`);
            }

            const body = await res.json().catch(() => ({}));
            const accounts = Array.isArray(body?.accounts) ? body.accounts : [];
            setIntegrationOpenAiAccounts((previousAccounts) => {
                const previousById = new Map(previousAccounts.map((account) => [account.location_id, account]));
                return accounts.map((account) => ({
                    ...account,
                    openai_key_id: previousById.get(account.location_id)?.openai_key_id || (
                        account.openai_key_configured ? "__existing__" : null
                    )
                }));
            });
        } catch (error) {
            console.error("Error cargando cuentas elegibles para OpenAI", error);
            if (!silent) {
                toast.error(error.message || (t('agency.integrations.openai_accounts_load_error') || 'No se pudo cargar la lista de cuentas.'));
            }
        } finally {
            if (!silent) setIntegrationOpenAiLoading(false);
        }
    };

    const createIntegrationOpenAiKey = async () => {
        const keyName = String(integrationOpenAiKeyNameDraft || "").trim();
        const keyValue = String(integrationOpenAiKeyValueDraft || "").trim();
        if (!keyName) {
            toast.error(t('agency.integrations.openai_key_name_empty_error') || 'Escribe un nombre para la key.');
            return;
        }
        if (!keyValue) {
            toast.error(t('agency.integrations.openai_key_empty_error') || 'Pega una OpenAI API key antes de guardar.');
            return;
        }

        const nextKey = {
            id: `openai-key-${Date.now()}`,
            name: keyName,
            value: keyValue,
            masked: `sk-••••••••${keyValue.slice(-4)}`
        };
        setIntegrationOpenAiKeys((previous) => [...previous, nextKey]);
        setIntegrationOpenAiKeyNameDraft("");
        setIntegrationOpenAiKeyValueDraft("");
        setIntegrationOpenAiKeyFormOpen(false);
        toast.success(t('agency.integrations.openai_key_created') || 'Key creada. Ahora puedes asignarla a una subcuenta.');
    };

    const assignIntegrationOpenAiKey = async (locationId, keyId) => {
        const safeLocationId = String(locationId || "").trim();
        if (!safeLocationId) return;
        if (keyId === "__existing__") return;
        const selectedKey = integrationOpenAiKeys.find((key) => key.id === keyId);
        const nextValue = selectedKey?.value || "";

        setIntegrationOpenAiSaving(true);
        setIntegrationOpenAiSavingAccountId(safeLocationId);

        try {
            const res = await authFetch(`/agency/settings/${encodeURIComponent(safeLocationId)}`, {
                method: 'PUT',
                body: JSON.stringify({ openai_api_key: nextValue })
            });
            if (!res?.ok) {
                const body = await parseApiResponse(res);
                throw new Error(body?.error || "No se pudo guardar la OpenAI key");
            }

            setIntegrationOpenAiAccounts((previous) => previous.map((account) => (
                account.location_id === safeLocationId
                    ? { ...account, openai_key_configured: Boolean(nextValue), openai_key_id: keyId || null }
                    : account
            )));
            toast.success(
                nextValue
                    ? (t('agency.integrations.openai_key_assigned') || 'Key asignada a la subcuenta.')
                    : (t('agency.integrations.openai_key_unassigned') || 'Key retirada de la subcuenta.')
            );
        } catch (error) {
            toast.error(error.message || (t('agency.integrations.openai_key_error') || 'No se pudo guardar la OpenAI key.'));
        } finally {
            setIntegrationOpenAiSaving(false);
            setIntegrationOpenAiSavingAccountId(null);
        }
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

    const syncGhlUpdate = async (code) => {
        const safeCode = String(code || "").trim();
        if (!safeCode) return;
        try {
            const res = await authFetch(`/agency/sync-ghl`, {
                method: "POST",
                body: JSON.stringify({
                    locationIdToVerify: null,
                    code: safeCode,
                    expectedAgencyId: accountInfo?.agencyId || null,
                    syncIntent: "update"
                })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || t('agency.install.error'));
            }

            const syncedAgencyId = data.agencyId || data.newAgencyId || accountInfo?.agencyId || null;
            if (syncedAgencyId) {
                localStorage.setItem("agencyId", syncedAgencyId);
                setStoredAgencyId(syncedAgencyId);
            }

            refreshData();
            toast.success(data.message || "App actualizada");
        } catch (error) {
            toast.error(error.message || t('agency.install.error'));
        } finally {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };


    useEffect(() => {
        let cancelled = false;
        console.log("📍 URL Search Params:", window.location.search);
        const callback = classifyGhlInstallCallback(queryParams);
        const oauthCode = callback.code;
        const targetLocationId = callback.targetLocationId;
        console.log(`🔎 Parsed Params -> Location: ${targetLocationId}, Code: ${oauthCode ? 'PRESENT' : 'MISSING'}`);
        
        // GHL install callbacks may arrive before accountInfo loads or while the UI
        // is still pinned to another CRM in localStorage. The callback itself is the
        // source of truth here, so do not gate auto-sync by current CRM mode.
        if (callback.hasLegacyCompanyOnlyCallback && !isAutoSyncing) {
            console.warn("[Install] Legacy callback with new_install only detected. Waiting for webhook instead of calling sync-ghl.");
            window.history.replaceState({}, document.title, window.location.pathname);
            waitForLegacyInstallCompletion({ isCancelled: () => cancelled });
        } else if (callback.isGhlUpdateCallback && !isAutoSyncing) {
            syncGhlUpdate(oauthCode);
        } else if (callback.shouldAutoSyncInstall && !isAutoSyncing) {
            // Con OAuth code directo (marketplace), no bloqueamos esperando webhook.
            autoSyncAgency(targetLocationId, oauthCode, { skipInstallPolling: callback.skipInstallPolling });
        }
        try { const payload = JSON.parse(atob(token.split('.')[1])); setUserEmail(payload.email); } catch (e) { }

        // ✅ Cargar Branding del Servidor al montar
        if(token && loadAgencyBranding) {
            loadAgencyBranding(token);
        }

        // ✅ NUEVO: Manejar retorno de Stripe
        // ✅ NUEVO: Manejar retorno de Stripe y Tracking de Compra
        const paymentStatus = queryParams.get("payment");
        if (paymentStatus === "success") {
            // 🚀 INICIO TRACKING COMPRA (Navegador)
            if (typeof window.fbq === 'function') {
                // Disparamos la compra. El valor lo mandamos en 0 porque el monto exacto 
                // lo enviará tu servidor (n8n) para evitar que el usuario manipule la URL.
                window.fbq('track', 'Purchase', { currency: 'USD', value: 0 }); 
            }
            // 🏁 FIN TRACKING

            toast.success(t('agency.payment.success'), { duration: 6000 });
            refreshData();
            // Limpiar URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (paymentStatus === "cancelled") {
            toast.error(t('agency.payment.cancelled'), { duration: 8000 });
            clearManagedGhlPaymentIntent();
            setShowManagedGhlBillingModal(false);
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

    useEffect(() => {
        if (activeTab !== 'reliability') return;
        setReliabilityPage(1);
    }, [activeTab, accountsFilter, searchTerm]);

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

    const getHostedWaflowPrimaryIdentity = () => {
        const primaryEmail = String(
            chatwootMasterEmail || accountInfo?.email || userEmail || ""
        ).trim().toLowerCase();
        const fallbackNameFromEmail = primaryEmail ? primaryEmail.split("@")[0] : "";
        const primaryName = String(
            chatwootMasterName || accountInfo?.name || fallbackNameFromEmail || ""
        ).trim();

        return {
            name: primaryName,
            email: primaryEmail
        };
    };

    const handleDeleteTenant = (e, locationId, name) => {
        e.stopPropagation();
        setTenantPendingDeletion({ locationId, name: name || locationId });
    };

    const confirmDeleteTenant = async () => {
        if (!tenantPendingDeletion || isDeletingTenant) return;
        const { locationId } = tenantPendingDeletion;
        setIsDeletingTenant(true);
        const tId = toast.loading(t('agency.tenant.deleting'));
        try {
            const res = await authFetch(`/agency/tenants/${locationId}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('agency.tenant.deleted'), { id: tId });
                setTenantPendingDeletion(null);
                refreshData();
            }
            else throw new Error(t('agency.tenant.delete_error'));
        } catch (err) { toast.error(t('agency.tenant.delete_error'), { id: tId }); }
        finally { setIsDeletingTenant(false); }
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

    const openOnboardingChatwootAddModal = ({ external = false, onboardingType = "chatwoot", connectionType = null } = {}) => {
        setOnboardingCrmType(onboardingType);
        setOnboardingConnectionType(
            external
                ? "chatwoot_existing"
                : (connectionType || "waflow_crm_hosted")
        );
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
            openOnboardingWaflowPrimaryFlow();
        }, 120);
    };

    const openOnboardingWaflowPrimaryFlow = () => {
        openOnboardingChatwootAddModal({
            external: false,
            onboardingType: "waflow_crm",
            connectionType: "waflow_crm_self"
        });
    };

    const openOnboardingWaflowClientFlow = () => {
        openOnboardingChatwootAddModal({
            external: false,
            onboardingType: "waflow_crm",
            connectionType: "waflow_crm_client"
        });
    };

    useEffect(() => {
        if (!showAddModal) return;
        // Some password managers/autofill tools inject values after mount; force-clear once more.
        const isHostedSelfFlow =
            String(onboardingCrmType || "").toLowerCase() === "waflow_crm" &&
            onboardingConnectionType === "waflow_crm_self";
        const primaryIdentity = getHostedWaflowPrimaryIdentity();
        const suggestedHostedAccountName = String(primaryIdentity.name || "").trim();
        const shouldClearSuggestedName =
            Boolean(suggestedHostedAccountName) &&
            existingWaflowInboxNames.has(suggestedHostedAccountName.toLowerCase());
        const timer = setTimeout(() => {
            setAddModalName(
                isHostedSelfFlow
                    ? (shouldClearSuggestedName ? "" : suggestedHostedAccountName)
                    : ""
            );
            setAddModalInboxName("");
            setAddModalClientEmail("");
            setAddModalClientPassword("");
            setAddModalChatwootUrl("");
            setAddModalChatwootApiToken("");
            if (isHostedSelfFlow) {
                setAddModalClientEmail(primaryIdentity.email);
            }
        }, 60);
        return () => clearTimeout(timer);
    }, [showAddModal, onboardingCrmType, onboardingConnectionType, locations]);

    const confirmAddLocationModal = async (e) => {
        e.preventDefault();
        const currentCrmType = String(
            addModalCrmType || onboardingCrmType || agencyCrmType || "ghl"
        ).toLowerCase();
        const currentOnboardingType = String(onboardingCrmType || "").toLowerCase();
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
        const hostedPrimaryIdentity = getHostedWaflowPrimaryIdentity();
        const hostedPrimaryName = String(hostedPrimaryIdentity.name || "").trim();
        const hostedPrimaryEmail = String(hostedPrimaryIdentity.email || "").trim().toLowerCase();
        const isWaflowSelfFlow =
            isChatwootView &&
            !isExternalChatwoot &&
            currentOnboardingType === "waflow_crm" &&
            onboardingConnectionType === "waflow_crm_self";
        const effectiveAccountName = safeName;
        const effectiveClientEmail = isWaflowSelfFlow
            ? hostedPrimaryEmail
            : safeClientEmail;
        const effectiveClientName = isWaflowSelfFlow
            ? (hostedPrimaryName || effectiveAccountName)
            : (isChatwootView && !isExternalChatwoot
                ? effectiveAccountName
                : safeClientName);
        const effectiveSelfManagedChatwootEmail = String(
            chatwootMasterEmail || accountInfo?.email || userEmail || ""
        ).trim().toLowerCase();
        const isSameEmailAsPrimaryChatwootUser =
            Boolean(
                isChatwootView &&
                !isExternalChatwoot &&
                effectiveClientEmail &&
                effectiveSelfManagedChatwootEmail &&
                effectiveClientEmail === effectiveSelfManagedChatwootEmail
            );
        const safeClientPassword = isSameEmailAsPrimaryChatwootUser ? "" : rawClientPassword;

        if (isWaflowSelfFlow && (!hostedPrimaryName || !hostedPrimaryEmail)) {
            toast.error(
                t('agency.onboarding.waflow_crm_self_missing_identity') ||
                "No pudimos recuperar tu acceso principal. Completa tu perfil o revisa el Usuario Maestro antes de continuar."
            );
            return;
        }

        if (!effectiveAccountName) {
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
            if (isWaflowSelfFlow && !safeInboxName) {
                toast.error(
                    t('dash.chatwoot_accounts.inbox_required') || "El nombre del primer teléfono es obligatorio."
                );
                return;
            }

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

            if (!isExternalChatwoot && safeClientPassword && !effectiveClientEmail) {
                toast.error(
                    t('dash.chatwoot_accounts.client_email_required') || "El email del cliente final es requerido."
                );
                return;
            }

            if (effectiveClientEmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(effectiveClientEmail)) {
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
                            email: effectiveClientEmail,
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
                name: effectiveAccountName,
                crmType: isExternalChatwoot ? "chatwoot_external" : currentCrmType
            };

            if (isChatwootView) {
                bodyPayload.inboxName = safeInboxName;
                if (isExternalChatwoot) {
                    bodyPayload.chatwootUrl = safeExternalUrl;
                    bodyPayload.chatwootAccountId = safeExternalAccountId;
                    bodyPayload.chatwootApiToken = safeExternalApiToken;
                } else if (effectiveClientEmail) {
                    bodyPayload.clientName = effectiveClientName;
                    bodyPayload.clientEmail = effectiveClientEmail;
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
                    ? (t('dash.chatwoot_accounts.created') || "Cuenta Waflow Inbox creada")
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

    const openManagedGhlRequestForm = () => {
        resetOnboardingSubaccountForm();
        setOnboardingStep(1);
        setOnboardingCrmType('ghl');
        setOnboardingConnectionType('ghl_create_subaccount');
        setShowManagedGhlPaidGate(false);
        setShowManagedGhlBillingModal(false);
        setShowOnboarding(true);
    };

    const setManagedGhlPaymentIntent = () => {
        setPendingManagedGhlRequest(true);
        try {
            window.sessionStorage.setItem(MANAGED_GHL_REQUEST_INTENT_KEY, "1");
        } catch (_) { }
    };

    const clearManagedGhlPaymentIntent = () => {
        setPendingManagedGhlRequest(false);
        try {
            window.sessionStorage.removeItem(MANAGED_GHL_REQUEST_INTENT_KEY);
        } catch (_) { }
    };

    const openManagedGhlBillingFlow = () => {
        setManagedGhlPaymentIntent();
        setShowManagedGhlPaidGate(false);
        setShowOnboarding(false);
        setShowManagedGhlBillingModal(true);
    };

    const closeManagedGhlBillingFlow = () => {
        setShowManagedGhlBillingModal(false);
        clearManagedGhlPaymentIntent();
    };

    const handleManagedGhlBillingDataChange = async () => {
        await refreshData();
    };

    const handleRequestManagedGhlSubaccount = () => {
        if (!canRequestManagedGhlSubaccount) {
            setShowManagedGhlPaidGate(true);
            return;
        }
        openManagedGhlRequestForm();
    };

    useEffect(() => {
        if (!pendingManagedGhlRequest || !canRequestManagedGhlSubaccount) return;
        try {
            window.sessionStorage.removeItem(MANAGED_GHL_REQUEST_INTENT_KEY);
        } catch (_) { }
        setPendingManagedGhlRequest(false);
        openManagedGhlRequestForm();
    }, [pendingManagedGhlRequest, canRequestManagedGhlSubaccount]);

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
            : "rounded-xl p-4 bg-transparent";
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
                    <div className="mt-4 p-1 space-y-4">
                        <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                {((t('agency.integrations.config_for') || "Configuración de {crm}")).replace("{crm}", "GoHighLevel")}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {t('agency.integrations.ghl_config_desc') || "Configura el link de instalación y las notas de voz para dejar el onboarding listo en un solo paso."}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="rounded-xl p-4">
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

            return null;
        };

        const renderOpenAiAccountsPanel = () => {
            if (!showContextConfig) return null;

            const productLabelMap = {
                ghl: 'GoHighLevel',
                waflow: 'WaFloW',
                chatwoot: 'Waflow Inbox'
            };
            const safeSearch = String(integrationOpenAiSearch || "").trim().toLowerCase();
            const filteredAccounts = integrationOpenAiAccounts.filter((account) => {
                if (!safeSearch) return true;
                return String(account?.name || "").toLowerCase().includes(safeSearch)
                    || String(account?.location_id || "").toLowerCase().includes(safeSearch);
            });

            return (
                <div className="mt-4 space-y-6">
                    <section className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                                    {t('agency.integrations.openai_key_panel_title') || 'Keys de OpenAI'}
                                </h4>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {t('agency.integrations.openai_key_panel_desc') || 'Crea y administra las keys disponibles para tus subcuentas.'}
                                </p>
                            </div>
                            {integrationOpenAiKeys.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => setIntegrationOpenAiKeyFormOpen((open) => !open)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                                >
                                    <Plus size={15} />
                                    {t('agency.integrations.openai_key_new') || 'Crear key'}
                                </button>
                            ) : null}
                        </div>

                        {integrationOpenAiKeyFormOpen || integrationOpenAiKeys.length === 0 ? (
                            <div className="grid gap-3 border-b border-gray-200 pb-5 dark:border-gray-800 md:grid-cols-[minmax(180px,0.7fr)_minmax(260px,1.3fr)_auto] md:items-end">
                                <label className="block text-sm text-gray-600 dark:text-gray-300">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                        {t('agency.integrations.openai_key_name_label') || 'Nombre de la key'}
                                    </span>
                                    <input
                                        type="text"
                                        value={integrationOpenAiKeyNameDraft}
                                        onChange={(event) => setIntegrationOpenAiKeyNameDraft(event.target.value)}
                                        placeholder={t('agency.integrations.openai_key_name_placeholder') || 'Ej. Producción'}
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                    />
                                </label>
                                <label className="block text-sm text-gray-600 dark:text-gray-300">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                        {t('agency.integrations.openai_key_label') || 'Valor de la key'}
                                    </span>
                                    <input
                                        type="password"
                                        value={integrationOpenAiKeyValueDraft}
                                        onChange={(event) => setIntegrationOpenAiKeyValueDraft(event.target.value)}
                                        placeholder={t('agency.integrations.openai_key_placeholder') || 'sk-...'}
                                        autoComplete="new-password"
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={createIntegrationOpenAiKey}
                                    disabled={integrationOpenAiSaving}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {integrationOpenAiSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    {t('agency.integrations.openai_key_create_button') || 'Guardar key'}
                                </button>
                            </div>
                        ) : null}

                        {integrationOpenAiKeys.length > 0 ? (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {integrationOpenAiKeys.map((key) => {
                                    const assignedCount = integrationOpenAiAccounts.filter((account) => account.openai_key_id === key.id).length;
                                    return (
                                        <div key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">{key.name}</div>
                                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{key.masked}</div>
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {assignedCount} {assignedCount === 1 ? 'subcuenta asignada' : 'subcuentas asignadas'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}
                    </section>

                    <section className="space-y-4 border-t border-gray-200 pt-5 dark:border-gray-800">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                                    {t('agency.integrations.openai_accounts_targets_title') || 'Subcuentas'}
                                </h4>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {t('agency.integrations.openai_accounts_targets_desc') || 'Elige qué key utilizará cada subcuenta.'}
                                </p>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={integrationOpenAiSearch}
                                    onChange={(event) => setIntegrationOpenAiSearch(event.target.value)}
                                    placeholder={t('agency.integrations.openai_accounts_search') || 'Buscar cuenta...'}
                                    className="wf-input-with-icon w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                        </div>

                        {integrationOpenAiLoading ? (
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500 dark:text-gray-400">
                                <Loader2 size={16} className="animate-spin" />
                                {t('agency.integrations.openai_accounts_loading') || 'Cargando subcuentas...'}
                            </div>
                        ) : filteredAccounts.length === 0 ? (
                            <div className="py-8 text-sm text-gray-500 dark:text-gray-400">
                                {integrationOpenAiAccounts.length === 0
                                    ? (t('agency.integrations.openai_accounts_empty') || 'No hay subcuentas disponibles.')
                                    : (t('agency.integrations.openai_accounts_empty_search') || 'No hay resultados para esa búsqueda.')}
                            </div>
                        ) : (
                            <div className="wf-soft-scrollbar max-h-[28rem] overflow-y-auto divide-y divide-gray-100 pr-1 dark:divide-gray-800">
                                {filteredAccounts.map((account) => {
                                    const productLabel = productLabelMap[String(account?.product_type || '').toLowerCase()] || 'Cuenta';
                                    const hasKey = account.openai_key_configured === true;
                                    const isSaving = integrationOpenAiSavingAccountId === account.location_id;
                                    return (
                                        <div key={account.location_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{account.name}</span>
                                                    <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{productLabel}</span>
                                                    <span className={`text-[11px] font-semibold ${hasKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                                        {hasKey
                                                            ? (t('agency.integrations.openai_accounts_status_ready') || 'Con key')
                                                            : (t('agency.integrations.openai_accounts_status_missing') || 'Sin key')}
                                                    </span>
                                                </div>
                                                <div className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">{account.location_id}</div>
                                            </div>
                                            <div className="flex w-full items-center gap-2 sm:w-64 sm:shrink-0">
                                                <select
                                                    value={account.openai_key_id || ""}
                                                    onChange={(event) => assignIntegrationOpenAiKey(account.location_id, event.target.value)}
                                                    disabled={integrationOpenAiSaving || integrationOpenAiKeys.length === 0}
                                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                                >
                                                    <option value="">{t('agency.integrations.openai_key_unassigned_option') || 'Sin key asignada'}</option>
                                                    {account.openai_key_id === "__existing__" ? (
                                                        <option value="__existing__" disabled>{t('agency.integrations.openai_key_existing_option') || 'Configuración actual'}</option>
                                                    ) : null}
                                                    {integrationOpenAiKeys.map((key) => (
                                                        <option key={key.id} value={key.id}>{key.name}</option>
                                                    ))}
                                                </select>
                                                {isSaving ? <Loader2 size={15} className="shrink-0 animate-spin text-indigo-500" /> : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            );
        };

        return (
            <div className={isOverview ? `bg-white dark:bg-gray-900 ${panelPadding} rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm` : `${panelPadding}`}>
                {!isOverview && (
                    <nav className="mb-5 overflow-x-auto border-b border-gray-200 dark:border-gray-800" aria-label="Subsecciones de integraciones">
                        <div className="flex min-w-max items-end gap-1">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={settingsIntegrationTab === "ghl"}
                                onClick={() => setSettingsIntegrationTab("ghl")}
                                className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${settingsIntegrationTab === "ghl"
                                    ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                                    : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                    }`}
                            >
                                <Globe size={15} />
                                {t('agency.settings_nav.integrations_ghl') || "GoHighLevel"}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={settingsIntegrationTab === "openai"}
                                onClick={() => setSettingsIntegrationTab("openai")}
                                className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${settingsIntegrationTab === "openai"
                                    ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                                    : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                    }`}
                            >
                                <Key size={15} />
                                {t('agency.settings_nav.integrations_openai') || "OpenAI"}
                            </button>
                        </div>
                    </nav>
                )}

                {(isOverview || settingsIntegrationTab === "ghl") && (
                    <>
                        <div className={gridClass}>
                            {renderCard("ghl", "GoHighLevel", t('agency.integrations.ghl_desc'), Globe, { showOpen: true, onOpen: openGhlPortal })}
                        </div>
                        {renderSelectedConfigPanel()}
                    </>
                )}
                {(isOverview || settingsIntegrationTab === "openai") && renderOpenAiAccountsPanel()}
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
                label: "Waflow Inbox",
                icon: Sparkles,
                badgeClassName: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800"
            };
        }

        if (productType === "chatwoot") {
            return {
                type: "chatwoot",
                label: "Waflow Inbox",
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

    const isWaflowInboxTenant = (tenant) => ['waflow', 'chatwoot'].includes(resolveTenantProductType(tenant));

    // Integration filter: show all locations or filtered by visible product type
    const accountsFilteredLocations = accountsFilter === "all"
        ? locations
        : accountsFilter === 'chatwoot'
            ? locations.filter(isWaflowInboxTenant)
            : locations.filter((loc) => resolveTenantProductType(loc) === accountsFilter);

    const filteredLocations = accountsFilteredLocations.filter(loc =>
        (loc.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (loc.location_id || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );
    const allLocationRuntimeCards = locations.map((loc) => ({
        loc,
        ...getLocationRuntimeMeta(loc)
    }));
    const existingWaflowInboxNames = new Set(
        locations
            .filter(isWaflowInboxTenant)
            .map((loc) => String(loc?.name || '').trim().toLowerCase())
            .filter(Boolean)
    );
    const filteredLocationCards = filteredLocations.map((loc) => ({
        loc,
        ...getLocationRuntimeMeta(loc)
    }));
    const hasCreatedFirstAccount = locations.length > 0;
    const hasConfiguredFirstInbox = allLocationRuntimeCards.some((entry) => entry.totalSlots > 0);
    const activeLocationRows = locations.filter((loc) => (Number.parseInt(loc?.connected_slot_count, 10) || 0) > 0);
    const hasFirstChannelOnline = allLocationRuntimeCards.some((entry) => entry.connectedSlotCount > 0);
    const needsQuickStartGuide = !hasCreatedFirstAccount || !hasConfiguredFirstInbox || !hasFirstChannelOnline;
    const nextAccountToSetup =
        allLocationRuntimeCards.find((entry) => entry.totalSlots <= 0 || entry.connectedSlotCount <= 0)?.loc ||
        locations[0] ||
        null;
    const quickStartSteps = [
        {
            id: 'account',
            title: t('agency.quick_start.step_account_title') || 'Crea tu cuenta',
            desc: t('agency.quick_start.step_account_desc') || 'Abre tu primera cuenta.',
            actionLabel: t('agency.quick_start.step_account_cta') || 'Nueva cuenta',
            doneLabel: t('agency.quick_start.step_account_done') || 'Lista',
            done: hasCreatedFirstAccount,
            enabled: true,
            onClick: () => {
                setOnboardingStep(0);
                setOnboardingCrmType(null);
                setOnboardingConnectionType(null);
                setOnboardingHoveredCard(null);
                setShowOnboarding(true);
            }
        },
        {
            id: 'inbox',
            title: t('agency.quick_start.step_inbox_title') || 'Añade tu inbox',
            desc: t('agency.quick_start.step_inbox_desc') || 'Entra en Gestionar y crea el primero.',
            actionLabel: t('agency.quick_start.step_inbox_cta') || 'Gestionar',
            doneLabel: t('agency.quick_start.step_inbox_done') || 'Inbox listo',
            done: hasConfiguredFirstInbox,
            enabled: hasCreatedFirstAccount && Boolean(nextAccountToSetup),
            onClick: () => {
                if (nextAccountToSetup) setSelectedLocation(nextAccountToSetup);
            }
        },
        {
            id: 'online',
            title: t('agency.quick_start.step_online_title') || 'Ponla en línea',
            desc: t('agency.quick_start.step_online_desc') || 'Conecta el canal y valida la cuenta.',
            actionLabel: t('agency.quick_start.step_online_cta') || 'Conectar',
            doneLabel: t('agency.quick_start.step_online_done') || 'En línea',
            done: hasFirstChannelOnline,
            enabled: hasConfiguredFirstInbox && Boolean(nextAccountToSetup),
            onClick: () => {
                if (nextAccountToSetup) setSelectedLocation(nextAccountToSetup);
            }
        }
    ];
    const quickStartDoneCount = quickStartSteps.filter((step) => step.done).length;
    const reliabilityFilterOptions = [
        { id: 'all', label: t('agency.onboarding.filter_all') || 'Todas', icon: null, count: activeLocationRows.length },
        { id: 'ghl', label: 'GoHighLevel', icon: Globe, count: activeLocationRows.filter((l) => resolveTenantProductType(l) === 'ghl').length },
        { id: 'chatwoot', label: 'Waflow Inbox', icon: MessageSquare, count: activeLocationRows.filter(isWaflowInboxTenant).length }
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
        { id: 'chatwoot', label: 'Waflow Inbox', icon: MessageSquare, count: locations.filter(isWaflowInboxTenant).length }
    ];
    const visibleAccountFilterOptions = accountFilterOptions;
    const reliabilityTotalAccounts = reliabilityBaseCards.length;
    const reliabilityTimeline = Array.isArray(reliabilityOverview?.timeline) ? reliabilityOverview.timeline : [];
    const reliabilityTotals = reliabilityOverview?.totals || {};
    const accountActivity = Array.isArray(reliabilityOverview?.account_activity)
        ? reliabilityOverview.account_activity
        : (Array.isArray(reliabilityOverview?.accountActivity) ? reliabilityOverview.accountActivity : []);
    const timelineSummary = reliabilityTimeline.reduce((acc, item) => {
        const sent = Number(item?.sent) || 0;
        const total = Number(item?.total) || 0;
        acc.sent += sent;
        if (total > 0) acc.activeHours += 1;
        return acc;
    }, { sent: 0, activeHours: 0 });
    const reliabilityTrendPoints = reliabilityTimeline.map((point) => ({
        bucketStart: point?.bucket_start || point?.timestamp,
        sent: Number(point?.sent) || 0
    }));
    const reliabilityTrendMax = reliabilityTrendPoints.reduce(
        (max, point) => Math.max(max, point.sent),
        0
    );
    const sent24h = Number(reliabilityTotals?.sent_24h) || timelineSummary.sent;
    const replyRate24h = toFiniteMetric(reliabilityTotals?.reply_rate_24h, 0);
    const contactedContacts24h = Number(reliabilityTotals?.contacted_contacts_24h ?? reliabilityTotals?.inbound_24h) || 0;
    const engagedContacts24h = Number(reliabilityTotals?.engaged_contacts_24h ?? reliabilityTotals?.answered_inbound_24h) || 0;
    const unansweredContacts24h = Number(reliabilityTotals?.unanswered_contacts_24h ?? reliabilityTotals?.unanswered_inbound_24h) || 0;
    const replyAlertAccounts = Number(reliabilityTotals?.reply_alert_accounts) || 0;
    const metaRiskAlertAccounts = Number(reliabilityTotals?.meta_risk_alert_accounts) || 0;
    const metaRiskInfoAccounts = Number(reliabilityTotals?.meta_risk_info_accounts) || 0;
    const metaRiskAttentionAccounts = Number(reliabilityTotals?.meta_risk_attention_accounts) || 0;
    const metaRiskHighAccounts = Number(reliabilityTotals?.meta_risk_high_accounts) || 0;
    const metaRiskCriticalAccounts = Number(reliabilityTotals?.meta_risk_critical_accounts) || 0;
    const hasReplySample = contactedContacts24h > 0;
    const replyNoSampleLabel = translateOr(t, 'agency.reliability.reply_no_sample_readable', 'Todavía no hay clientes contactados para medir respuestas');
    const metaRiskLabel = translateOr(t, 'agency.reliability.meta_risk', 'Señales de calidad');
    const overallOperationalState = (metaRiskCriticalAccounts > 0 || metaRiskHighAccounts > 0)
        ? 'review'
        : ((metaRiskAttentionAccounts > 0 || replyAlertAccounts > 0 || metaRiskInfoAccounts > 0) ? 'watch' : 'healthy');
    const overallOperationalLabel = overallOperationalState === 'review'
        ? (metaRiskCriticalAccounts > 0
            ? getPreventiveRiskLabel('critical', t)
            : getPreventiveRiskLabel('high', t))
        : (overallOperationalState === 'watch'
            ? getPreventiveRiskLabel('attention', t)
            : translateOr(t, 'agency.reliability.state_all_good', 'Sin señales relevantes'));
    const overallOperationalDesc = overallOperationalState === 'review'
        ? translateOr(t, 'agency.reliability.state_review_today_desc', 'Hay cuentas con patrones preventivos que requieren ajustar el ritmo o el contenido. Esta vista no bloquea ni desconecta números.')
        : (overallOperationalState === 'watch'
            ? translateOr(t, 'agency.reliability.state_follow_up_desc', 'Hay patrones que conviene corregir antes de aumentar el volumen. No representan una sanción confirmada por Meta.')
            : translateOr(t, 'agency.reliability.state_all_good_desc', 'No se detectaron patrones preventivos relevantes dentro de la ventana observada.'));
    const riskBreakdownItems = [
        {
            label: getPreventiveRiskLabel('info', t),
            value: metaRiskInfoAccounts,
            tone: 'info'
        },
        {
            label: getPreventiveRiskLabel('attention', t),
            value: metaRiskAttentionAccounts,
            tone: 'attention'
        },
        {
            label: getPreventiveRiskLabel('high', t),
            value: metaRiskHighAccounts,
            tone: 'high'
        },
        {
            label: getPreventiveRiskLabel('critical', t),
            value: metaRiskCriticalAccounts,
            tone: 'review'
        }
    ];
    const locationsById = new Map(
        locations.map((loc) => [String(loc?.location_id || ''), loc])
    );
    const verifyReachoutState = async (slot) => {
        const key = `${slot.locationId}_slot${slot.slot_id}`;
        if (reachoutChecking) return;
        setReachoutChecking(key);
        try {
            const response = await authFetch(
                `/agency/slots/${encodeURIComponent(slot.locationId)}/${slot.slot_id}/reachout/verify`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
            );
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body?.error || body?.code || `HTTP ${response.status}`);
            toast.success(body?.reachout?.state === 'restricted'
                ? translateOr(t, 'agency.reliability.verify_restricted_success', 'Meta confirmó una limitación temporal.')
                : translateOr(t, 'agency.reliability.verify_clear_success', 'Meta no informa una limitación activa.'));
            await refreshData();
        } catch (error) {
            toast.error(`${translateOr(t, 'agency.reliability.verify_reachout_error', 'No se pudo verificar ahora:')} ${error.message}`);
        } finally {
            setReachoutChecking(null);
        }
    };
    const reliabilityAccountRows = accountActivity
        .map((entry) => ({
            entry,
            linkedLocation: locationsById.get(String(entry?.location_id || '')) || null
        }))
        .map(({ entry, linkedLocation }) => {
            const productMeta = linkedLocation
                ? getTenantProductMeta(linkedLocation)
                : {
                    label: translateOr(t, 'agency.reliability.unknown_channel', 'Cuenta'),
                    badgeClassName: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700"
                };
            const contactedCount = Number(entry.contacted_contacts_24h ?? entry.inbound_24h) || 0;
            const engagedCount = Number(entry.engaged_contacts_24h ?? entry.answered_inbound_24h) || 0;
            const unansweredCount = Number(entry.unanswered_contacts_24h ?? entry.unanswered_inbound_24h) || 0;
            const outboundMessageCount = Number(entry.outbound_messages_24h ?? entry.sent) || 0;
            const replyRate = toFiniteMetric(entry.reply_rate_24h, contactedCount > 0 ? 0 : 100);
            const connectedSlotCount = Number(entry.connected_slot_count ?? linkedLocation?.connected_slot_count) || 0;
            const totalSlots = Number(linkedLocation?.total_slots) || connectedSlotCount;
            const metaRiskLevel = String(entry.meta_risk_level || 'healthy').toLowerCase();
            const numberQualityLevel = String(entry.number_quality_level || 'unknown').toLowerCase();
            const numberQualitySource = String(entry.number_quality_source || 'unknown').toLowerCase();
            const numberQualityPreview = Array.isArray(entry.number_quality_preview)
                ? entry.number_quality_preview
                    .map((preview) => ({
                        slot_id: Number(preview?.slot_id) || null,
                        slot_name: preview?.slot_name || null,
                        phone_number: preview?.phone_number || null,
                        level: String(preview?.level || 'unknown').toLowerCase()
                    }))
                    .filter((preview) => preview.slot_id || preview.phone_number || preview.slot_name)
                : [];
            const replyStrikes = Number(entry.reply_strikes) || 0;
            const metaRiskSignals = Array.isArray(entry.meta_risk_signals)
                ? entry.meta_risk_signals.filter((signal) => signal && typeof signal === 'object')
                : [];
            const operationalState = (metaRiskLevel === 'critical' || metaRiskLevel === 'high')
                ? 'review'
                : ((metaRiskLevel === 'attention' || metaRiskLevel === 'info' || replyStrikes > 0 || Boolean(entry.reply_auto_blocked))
                    ? 'watch'
                    : 'healthy');
            const operationalStateLabel = operationalState === 'review'
                ? translateOr(t, 'agency.reliability.ban_risk_high', 'Alto')
                : (operationalState === 'watch'
                    ? translateOr(t, 'agency.reliability.ban_risk_medium', 'Medio')
                    : translateOr(t, 'agency.reliability.ban_risk_low', 'Bajo'));
            const suggestedAction = (operationalState === 'review' || numberQualityLevel === 'delicate')
                ? translateOr(t, 'agency.reliability.action_review', 'Revisa los números más delicados y baja el ritmo en esos slots antes de seguir enviando.')
                : ((operationalState === 'watch' || numberQualityLevel === 'sensitive')
                    ? translateOr(t, 'agency.reliability.action_watch', 'Conviene moderar los números que más escriben a clientes que no responden y evitar insistir.')
                    : (numberQualityLevel === 'care'
                        ? translateOr(t, 'agency.reliability.action_care', 'Mantené un ritmo moderado en los números con más volumen y evitá repetir el mismo mensaje.')
                        : (numberQualityLevel === 'unknown'
                            ? translateOr(t, 'agency.reliability.action_unknown', 'Todavía no hay suficiente historial. Conviene empezar con poco volumen y revisar la respuesta.')
                            : translateOr(t, 'agency.reliability.action_stable', 'La mayoría de los números se ve estable. Igual conviene evitar ráfagas muy agresivas.'))));

            return {
                locationId: String(entry.location_id || ''),
                name: entry.location_name || t('agency.location.no_name'),
                channelLabel: productMeta.label,
                channelBadgeClassName: productMeta.badgeClassName,
                sent: contactedCount,
                contactedCount,
                engagedCount,
                unansweredCount,
                outboundMessageCount,
                replyRate,
                replyStrikes,
                replyAutoBlocked: Boolean(entry.reply_auto_blocked),
                connectedSlotCount,
                totalSlots,
                metaRiskLevel,
                metaRiskScore: toFiniteMetric(entry.meta_risk_score, 0),
                metaRiskSignals,
                metaRiskRecommendedAction: polishPreventiveSignalText(entry.meta_risk_recommended_action),
                operationalState,
                operationalStateLabel,
                numberQualitySource,
                numberQualityPreview,
                suggestedAction,
                onClick: linkedLocation ? () => setSelectedLocation(linkedLocation) : null
            };
        });
    const preventiveSignalRows = reliabilityAccountRows.filter((item) => (
        ['info', 'attention', 'high', 'critical'].includes(item.metaRiskLevel)
        || item.replyStrikes > 0
        || item.replyAutoBlocked
    ));
    const reliabilityTotalPages = Math.max(1, Math.ceil(reliabilityAccountRows.length / RELIABILITY_PAGE_SIZE));
    const safeReliabilityPage = Math.min(reliabilityPage, reliabilityTotalPages);
    const paginatedReliabilityAccounts = reliabilityAccountRows.slice(
        (safeReliabilityPage - 1) * RELIABILITY_PAGE_SIZE,
        safeReliabilityPage * RELIABILITY_PAGE_SIZE
    );
    const reliabilityRangeStart = reliabilityAccountRows.length === 0
        ? 0
        : ((safeReliabilityPage - 1) * RELIABILITY_PAGE_SIZE) + 1;
    const reliabilityRangeEnd = reliabilityAccountRows.length === 0
        ? 0
        : Math.min(reliabilityAccountRows.length, safeReliabilityPage * RELIABILITY_PAGE_SIZE);
    const operationalSlots = filteredLocationCards.flatMap(({ loc }) =>
        (Array.isArray(loc?.slot_health) ? loc.slot_health : []).map((slot) => ({
            ...slot,
            locationName: loc?.name || loc?.location_id,
            locationId: loc?.location_id
        }))
    );
    const operationalAlerts = operationalSlots.filter((slot) => (
        slot?.capabilities?.requiresQr
        || slot?.reachout?.state === 'restricted'
        || slot?.reachout?.state === 'suspected'
        || (!slot?.is_connected && !slot?.suspended_by)
    ));
    const confirmedReachoutCount = operationalSlots.filter((slot) => (
        slot?.reachout?.state === 'restricted' && slot?.reachout?.confirmedByMeta === true
    )).length;
    useEffect(() => {
        if (reliabilityPage > reliabilityTotalPages) {
            setReliabilityPage(reliabilityTotalPages);
        }
    }, [reliabilityPage, reliabilityTotalPages]);
    const modalCrmType = String(
        addModalCrmType || onboardingCrmType || agencyCrmType || "ghl"
    ).toLowerCase();
    const isChatwootModal = modalCrmType === "chatwoot";
    const isWaflowCrmHostedModal =
        isChatwootModal &&
        addModalChatwootModeLocked &&
        !addModalChatwootExternal &&
        onboardingCrmType === "waflow_crm";
    const isWaflowCrmSelfModal =
        isWaflowCrmHostedModal &&
        onboardingConnectionType === "waflow_crm_self";
    const hostedWaflowPrimaryIdentity = getHostedWaflowPrimaryIdentity();
    const hostedWaflowPrimaryName = String(hostedWaflowPrimaryIdentity.name || "").trim();
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
            ? "text-emerald-700 dark:text-emerald-300"
            : accountStatusCode === "grace"
                ? "text-amber-700 dark:text-amber-300"
                : "text-rose-700 dark:text-rose-300";
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
                { id: "support-brand", label: t('agency.settings_nav.support_brand') || "Marca Blanca", icon: Palette }
            ]
        },
        {
            key: "advanced",
            label: t('agency.settings_nav.advanced') || "Avanzado",
            items: [
                { id: "developer", label: t('dash.settings.dev_title') || "Desarrolladores", icon: Terminal }
            ]
        }
    ];
    const allSettingsSectionIds = settingsMenuGroups.flatMap((group) => group.items.map((item) => item.id));
    const normalizedSettingsSection = settingsSection === "support" || settingsSection === "whitelabel"
        ? "support-brand"
        : settingsSection;
    const currentSettingsSectionId = allSettingsSectionIds.includes(normalizedSettingsSection)
        ? normalizedSettingsSection
        : (allSettingsSectionIds[0] || "guide");
    const settingsSectionTitleMap = settingsMenuGroups.reduce((acc, group) => {
        for (const item of group.items) acc[item.id] = item.label;
        return acc;
    }, {});
    const activeSettingsSectionTitle = settingsSectionTitleMap[currentSettingsSectionId] || (t('dash.header.settings') || "Configuración");

    useEffect(() => {
        if (!allSettingsSectionIds.includes(normalizedSettingsSection)) {
            setSettingsSection(allSettingsSectionIds[0] || "guide");
        }
    }, [normalizedSettingsSection, isGhlAgency, isChatwootAgency]);

    useEffect(() => {
        if (activeTab !== 'settings' || currentSettingsSectionId !== 'integrations' || settingsIntegrationTab !== 'openai') return;
        fetchIntegrationOpenAiAccounts({
            silent: integrationOpenAiAccounts.length > 0
        });
    }, [activeTab, currentSettingsSectionId, settingsIntegrationTab, accountInfo?.agencyId, storedAgencyId, AGENCY_ID]);

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
                <div className="p-1 animate-in fade-in slide-in-from-right-4">
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">{t('agency.wl.agency_name')}</label>
                            <input type="text" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">{t('agency.wl.logo_url')}</label>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"><img src={form.logoUrl} alt="Preview" className="h-full w-full object-contain" onError={(e) => e.target.style.display = 'none'} /></div>
                                    <div className="relative min-w-0 flex-1"><Link size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="url" value={form.logoUrl === systemBranding?.logoUrl ? '' : (form.logoUrl || '')} onChange={e => setForm({ ...form, logoUrl: e.target.value || systemBranding.logoUrl })} className="wf-input-with-icon w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none transition-all dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="URL Logo" /></div>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">{t('agency.wl.favicon_url')}</label>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"><img src={form.faviconUrl} alt="Preview" className="h-7 w-7 object-contain" onError={(e) => e.target.style.display = 'none'} /></div>
                                    <div className="relative min-w-0 flex-1"><MousePointer2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="url" value={form.faviconUrl === systemBranding?.faviconUrl ? '' : (form.faviconUrl || '')} onChange={e => setForm({ ...form, faviconUrl: e.target.value || systemBranding.faviconUrl })} className="wf-input-with-icon w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none transition-all dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="URL Favicon" /></div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-start gap-2 pt-1 sm:flex-row sm:items-center">
                            <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"><CheckCircle2 size={16} /> {t('agency.wl.save_changes')}</button>
                            <button type="button" onClick={handleReset} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"><RotateCcw size={15} /> {t('agency.wl.reset')}</button>
                        </div>
                    </form>
                </div>
            </RestrictedFeatureWrapper>
        );
    };

    return (
        <div className="agency-dashboard-ui--redesign flex h-screen bg-[#F8FAFC] dark:bg-[#0f1117] font-sans overflow-hidden">
            <ExpiryPopup token={token} /> {/* ✅ Popup Global */}
            {isAccountSuspended && <SubscriptionBlocker token={token} onLogout={onLogout} accountInfo={accountInfo} />}
            {showManagedGhlPaidGate && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/10 bg-[#101827] shadow-2xl shadow-black/40">
                        <div className="border-b border-white/10 px-6 py-5 flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-amber-500/10 border border-amber-400/20 flex items-center justify-center">
                                    <CreditCard size={20} className="text-amber-300" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-extrabold text-white">
                                        {t('agency.onboarding.ghl_paid_gate_title') || 'Solo para planes de pago'}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {t('agency.onboarding.ghl_paid_gate_kicker') || 'Subcuenta GoHighLevel gestionada'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowManagedGhlPaidGate(false);
                                    clearManagedGhlPaymentIntent();
                                }}
                                className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
                                aria-label="Cerrar"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="px-6 py-6 space-y-5">
                            <p className="text-sm leading-6 text-slate-300">
                                {t('agency.onboarding.ghl_paid_gate_desc') || 'Para solicitar una subcuenta GoHighLevel creada por nuestra agencia necesitas activar un plan de pago. Si ya tienes tu propia cuenta de GoHighLevel, puedes conectarla durante el trial.'}
                            </p>
                            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 flex gap-3">
                                <ShieldCheck size={18} className="mt-0.5 text-emerald-300 shrink-0" />
                                <p className="text-xs leading-5 text-emerald-100">
                                    {t('agency.onboarding.ghl_paid_gate_after_payment') || 'Después de activar un plan, abriremos automáticamente el formulario de solicitud.'}
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowManagedGhlPaidGate(false);
                                        clearManagedGhlPaymentIntent();
                                    }}
                                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white transition"
                                >
                                    {t('agency.onboarding.ghl_paid_gate_later') || 'Volver'}
                                </button>
                                <button
                                    type="button"
                                    onClick={openManagedGhlBillingFlow}
                                    className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-orange-900/25 hover:brightness-110 transition flex items-center justify-center gap-2"
                                >
                                    {t('agency.onboarding.ghl_paid_gate_view_plans') || 'Ver planes'}
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showManagedGhlBillingModal && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-6xl h-[92vh] overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0B0D12] shadow-2xl flex flex-col">
                        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4 bg-white dark:bg-gray-900">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-500">
                                    {t('agency.onboarding.ghl_paid_gate_kicker') || 'Subcuenta GoHighLevel gestionada'}
                                </p>
                                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                                    {t('agency.onboarding.ghl_paid_gate_choose_plan') || 'Elige un plan para continuar'}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {t('agency.onboarding.ghl_paid_gate_choose_plan_desc') || 'Cuando el pago quede activo, abriremos el formulario de solicitud automáticamente.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeManagedGhlBillingFlow}
                                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition"
                                aria-label="Cerrar"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-[#0B0D12]">
                            <SubscriptionManager
                                token={token}
                                accountInfo={accountInfo}
                                onDataChange={handleManagedGhlBillingDataChange}
                                isChatwootAgency={isChatwootAgency}
                            />
                        </div>
                    </div>
                </div>
            )}
            {showUpgradeModal && (isGhlAgency || onboardingCrmType === 'ghl') && <SubscriptionModal token={token} accountInfo={accountInfo} onClose={() => setShowUpgradeModal(false)} onDataChange={refreshData} />}

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

            <aside className={`fixed inset-x-0 bottom-0 z-30 flex h-16 w-full flex-col border-t border-gray-200/70 bg-[#FBFCFE] dark:border-gray-800 dark:bg-gray-900 md:static md:h-auto ${sidebarOpen ? 'md:w-64' : 'md:w-20'} md:border-t-0 md:transition-all md:duration-300`}>
                <div className={`group relative hidden h-16 items-center md:flex ${sidebarOpen ? 'gap-2 pl-6 pr-4' : 'justify-center px-2'}`}>
                    <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-white font-bold ${!sidebarOpen ? 'transition duration-200 group-hover:scale-90 group-hover:opacity-0' : ''}`}
                        style={{ backgroundColor: branding.logoUrl ? 'transparent' : branding.primaryColor }}
                    >
                        {branding.logoUrl && (
                            <img
                                src={branding.logoUrl}
                                alt="Logo"
                                className="h-full w-full object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement.style.backgroundColor = branding.primaryColor || '#4F46E5';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                            />
                        )}
                        <Building2
                            size={17}
                            aria-hidden="true"
                            className={branding.logoUrl ? 'hidden text-white/90' : 'text-white/90'}
                        />
                    </div>
                    {sidebarOpen && <span className="min-w-0 truncate text-sm font-bold tracking-tight text-gray-900 dark:text-white">{branding.name}</span>}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        aria-label={sidebarOpen ? 'Contraer barra lateral' : 'Expandir barra lateral'}
                        title={sidebarOpen ? 'Contraer barra lateral' : 'Expandir barra lateral'}
                        className={sidebarOpen
                            ? 'ml-auto shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800'
                            : 'absolute inset-1 z-10 flex items-center justify-center rounded-lg bg-[#FBFCFE] text-gray-500 opacity-0 scale-95 transition duration-200 group-hover:scale-100 group-hover:opacity-100 hover:bg-gray-100 hover:text-indigo-600 dark:bg-gray-900 dark:hover:bg-gray-800'}
                    >
                        <Menu size={19} />
                    </button>
                </div>
                <div className="wf-sidebar-scroll flex h-full items-center gap-1 overflow-x-auto px-3 py-2 md:block md:h-auto md:flex-1 md:overflow-x-hidden md:overflow-y-auto md:px-4 md:pb-4 md:pt-2">
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="overview" icon={LayoutGrid} label={t('dash.nav.overview')} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="billing" icon={CreditCard} label={t('dash.nav.billing')} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="reliability" icon={Activity} label={t('dash.nav.reliability') || 'Confiabilidad'} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="agents" icon={Bot} label={t('dash.nav.agents') || "Agentes"} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="settings" icon={Settings} label={t('dash.nav.settings')} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="builder" icon={Hammer} label={t('dash.nav.builder') || "Constructor"} branding={branding} sidebarOpen={sidebarOpen} />
                    <SidebarItem activeTab={activeTab} setActiveTab={setActiveTab} id="templates-meta" icon={FileText} label={t('dash.nav.templates_meta') || "Templates Meta"} branding={branding} sidebarOpen={sidebarOpen} />
                    <div className="my-6 hidden border-t border-gray-100 dark:border-gray-800 md:block"></div>
                    <a href="https://docs.waflow.ai" target="_blank" rel="noreferrer" title={t('dash.nav.docs')} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-medium text-gray-500 transition-all hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-indigo-900/10 md:h-auto md:py-3 ${sidebarOpen ? 'md:w-full md:justify-start md:gap-3 md:px-4' : 'md:mx-auto md:w-12 md:justify-center md:px-0'}`}><BookOpen className="h-5 w-5" /><span className={`${sidebarOpen ? 'hidden md:inline' : 'hidden'}`}>{t('dash.nav.docs')}</span></a>
                    <a href={`https://wa.me/${SUPPORT_PHONE}`} target="_blank" rel="noreferrer" title={t('dash.nav.support')} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-medium text-gray-500 transition-all hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-indigo-900/10 md:h-auto md:py-3 ${sidebarOpen ? 'md:w-full md:justify-start md:gap-3 md:px-4' : 'md:mx-auto md:w-12 md:justify-center md:px-0'}`}><LifeBuoy className="h-5 w-5" /><span className={`${sidebarOpen ? 'hidden md:inline' : 'hidden'}`}>{t('dash.nav.support')}</span></a>
                    <button onClick={onLogout} title={t('dash.nav.logout')} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-medium text-red-500 transition-all hover:bg-red-50 dark:hover:bg-red-900/10 md:mt-2 md:h-auto md:py-3 ${sidebarOpen ? 'md:w-full md:justify-start md:gap-3 md:px-4' : 'md:mx-auto md:w-12 md:justify-center md:px-0'}`}><LogOut className="h-5 w-5" /><span className={`${sidebarOpen ? 'hidden md:inline' : 'hidden'}`}>{t('dash.nav.logout')}</span></button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-white dark:bg-[#0f1117]">
                <header className="h-14 bg-white dark:bg-gray-900 flex items-center justify-between gap-4 px-5 z-20">
                    <h2 className="min-w-0 truncate text-base font-bold text-gray-900 dark:text-white">
                        {activeTab === 'overview'
                            ? (t('dash.header.overview') || 'Panel Principal')
                            : activeTab === 'billing'
                                ? t('dash.header.billing')
                                : activeTab === 'reliability'
                                    ? (t('dash.header.reliability') || 'Confiabilidad operativa')
                                    : activeTab === 'agents'
                                        ? (t('dash.header.agents') || 'Agentes')
                                        : activeTab === 'builder'
                                            ? (t('dash.header.builder') || 'Constructor')
                                                : activeTab === 'templates-meta'
                                                ? (t('dash.header.templates_meta') || 'Templates Meta')
                                                : t('dash.header.settings')}
                    </h2>
                    <div className="flex shrink-0 items-center gap-2">
                        {activeTab === 'overview' && (
                            <div className="hidden items-center gap-1 rounded-lg bg-gray-50 p-1 sm:flex dark:bg-gray-800/70" aria-label="Vista de cuentas">
                                <button
                                    type="button"
                                    onClick={() => { setAccountsView('compact'); localStorage.setItem('waflow:accounts-view-v2', 'compact'); }}
                                    aria-label="Vista compacta"
                                    title="Vista compacta"
                                    className={`rounded-md p-1.5 transition ${accountsView === 'compact' ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-300' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
                                >
                                    <List size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setAccountsView('expanded'); localStorage.setItem('waflow:accounts-view-v2', 'expanded'); }}
                                    aria-label="Vista amplia"
                                    title="Vista amplia"
                                    className={`rounded-md p-1.5 transition ${accountsView === 'expanded' ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-300' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
                                >
                                    <LayoutGrid size={16} />
                                </button>
                            </div>
                        )}
                        <LanguageSelector /><ThemeToggle />
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6 pb-24 md:px-8 md:pb-8 md:pt-6">
                    {activeTab === 'overview' && (
                        !accountInfo ? (<div className="flex justify-center items-center h-full text-gray-400"><RefreshCw className="animate-spin mr-2" /> {t('agency.loading_panel')}</div>) : (
                            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                    {/* Métricas esenciales: compactas, horizontales y con contraste */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="min-h-[92px] flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300">
                                                    <Building2 size={18} />
                                                </div>
                                                <p className="truncate text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                                                    {isChatwootAgency ? t('dash.stats.cw_accounts') : (t('dash.stats.subaccounts') || "Subcuentas")}
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-3xl font-bold tracking-tight text-indigo-950 dark:text-white">
                                                {accountInfo.limits?.used_subagencies || 0}<span className="text-xl font-normal text-indigo-400 dark:text-indigo-300">/{accountInfo.limits?.max_subagencies || 0}</span>
                                            </div>
                                        </div>

                                        <div className="min-h-[92px] flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
                                                    <Smartphone size={18} />
                                                </div>
                                                <p className="truncate text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{t('dash.stats.connections')}</p>
                                            </div>
                                            <div className="shrink-0 text-3xl font-bold tracking-tight text-emerald-950 dark:text-white">
                                                {accountInfo.limits?.used_slots || 0}<span className="text-xl font-normal text-emerald-400 dark:text-emerald-300">/{accountInfo.limits?.max_slots || 0}</span>
                                            </div>
                                        </div>

                                        <div className="min-h-[92px] flex items-center justify-between gap-4 rounded-2xl border border-indigo-700 bg-indigo-600 px-5 py-4 text-white shadow-sm">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
                                                    <ShieldCheck size={18} />
                                                </div>
                                                <p className="truncate text-xs font-bold uppercase tracking-wide text-indigo-100">{t('dash.stats.plan')}</p>
                                            </div>
                                            <div className="shrink-0 text-xl font-bold">
                                                {accountInfo.plan === 'active' ? t('dash.stats.active') : t('dash.stats.trial')}
                                            </div>
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
                                        {needsQuickStartGuide && (
                                            <div className="mb-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50 via-white to-white dark:from-indigo-950/30 dark:via-gray-900 dark:to-gray-900 shadow-sm">
                                                <div className="flex flex-col gap-4 p-5 md:p-6">
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                        <div>
                                                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                                <Sparkles size={18} className="text-indigo-500" />
                                                                {t('agency.quick_start.title') || 'Empieza aquí'}
                                                            </h3>
                                                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                                {t('agency.quick_start.desc') || 'Tres pasos para dejar lista tu primera cuenta.'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-bold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
                                                                {(t('agency.quick_start.progress') || '{done}/{total} listos')
                                                                    .replace('{done}', String(quickStartDoneCount))
                                                                    .replace('{total}', String(quickStartSteps.length))}
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    setActiveTab('settings');
                                                                    setSettingsSection('guide');
                                                                }}
                                                                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                                                            >
                                                                <BookOpen size={13} />
                                                                {t('agency.quick_start.open_guide') || 'Ver guía'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                                                        {quickStartSteps.map((step, index) => (
                                                            <div
                                                                key={step.id}
                                                                className={`rounded-xl border p-4 transition ${
                                                                    step.done
                                                                        ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-900/20'
                                                                        : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
                                                                }`}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <div
                                                                        className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                                                            step.done
                                                                                ? 'bg-emerald-600 text-white'
                                                                                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                                                        }`}
                                                                    >
                                                                        {step.done ? <CheckCircle2 size={16} /> : index + 1}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{step.title}</p>
                                                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{step.desc}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="mt-4">
                                                                    <button
                                                                        onClick={step.onClick}
                                                                        disabled={!step.enabled}
                                                                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                                                            step.done
                                                                                ? 'border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-700 dark:bg-gray-900 dark:text-emerald-300 dark:hover:bg-emerald-900/30'
                                                                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                                        } disabled:cursor-not-allowed disabled:opacity-50`}
                                                                    >
                                                                        {step.done ? <CheckCircle2 size={14} /> : <ArrowRight size={14} />}
                                                                        {step.done ? step.doneLabel : step.actionLabel}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mb-5 flex flex-col gap-2 xl:flex-row xl:items-center">
                                            <div className="wf-account-filters flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 xl:flex-1 xl:flex-wrap xl:gap-2 xl:overflow-visible xl:pb-0">
                                                {visibleAccountFilterOptions.map(tab => (
                                                        <button
                                                            key={tab.id}
                                                            onClick={() => setAccountsFilter(tab.id)}
                                                            className={`inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all border sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-xs ${
                                                                accountsFilter === tab.id
                                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 shadow-sm'
                                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800 dark:hover:border-gray-700'
                                                            }`}
                                                        >
                                                            {tab.label}
                                                            <span className={`ml-0.5 px-1 py-0.5 rounded-md text-[9px] font-bold sm:px-1.5 sm:text-[10px] ${
                                                                accountsFilter === tab.id
                                                                    ? 'bg-indigo-200/60 text-indigo-800 dark:bg-indigo-800/40 dark:text-indigo-200'
                                                                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                                                            }`}>{tab.count}</span>
                                                        </button>
                                                ))}
                                            </div>
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:shrink-0">
                                                <div className="relative min-w-0 sm:w-64 xl:w-80">
                                                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                    <input
                                                        type="text"
                                                        autoComplete="off"
                                                        placeholder={t('agency.onboarding.search_accounts') || 'Buscar cuentas...'}
                                                        className="wf-input-with-icon w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition"
                                                        value={searchTerm}
                                                        onChange={e => setSearchTerm(e.target.value)}
                                                    />
                                                </div>
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
                                                {filteredLocationCards.map(({ loc, totalSlots, connectedSlotCount, connectedNumbers, connectedPreview, remainingConnected }) => {
                                                    const productMeta = getTenantProductMeta(loc);
                                                    const accountProductLabel = productMeta.type === 'ghl' ? 'GoHighLevel' : 'Waflow Inbox';
                                                    const accountProductClassName = productMeta.type === 'ghl'
                                                        ? 'text-blue-600 dark:text-blue-300'
                                                        : 'text-emerald-600 dark:text-emerald-300';
                                                    const onlineLabel = `${connectedSlotCount}/${totalSlots || connectedSlotCount} en línea`;
                                                    const numbersLabel = connectedNumbers.length > 0
                                                        ? `${connectedPreview.join(' · ')}${remainingConnected > 0 ? ` +${remainingConnected} más` : ''}`
                                                        : 'Sin números en línea';

                                                    return (
                                                        <div key={loc.location_id} onClick={() => setSelectedLocation(loc)} className={`group relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer ${accountsView === 'expanded' ? 'p-5 pt-6 pb-4' : 'flex min-h-[72px] items-center p-3.5'}`}>
                                                            <div className={accountsView === 'expanded' ? 'flex flex-col items-start gap-4' : 'flex w-full items-center'}>
                                                                <div className={accountsView === 'expanded' ? 'flex w-full items-center justify-between gap-3 pr-10' : 'min-w-0 flex w-full items-center gap-2 pr-10'}>
                                                                    <Building2 size={16} className="shrink-0 text-gray-400 dark:text-gray-500" />
                                                                    <h4 className={`${accountsView === 'expanded' ? 'text-base' : 'text-sm'} min-w-0 flex-1 truncate font-semibold text-gray-900 dark:text-white`}>{loc.name || t('agency.location.no_name')}</h4>
                                                                    <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${accountProductClassName}`}>
                                                                        {accountProductLabel}
                                                                    </span>
                                                                </div>
                                                                {accountsView === 'expanded' && (
                                                                    <div className="flex w-full items-center justify-between gap-3">
                                                                    <span
                                                                        title={onlineLabel}
                                                                        aria-label={onlineLabel}
                                                                        className={`shrink-0 ${accountsView === 'expanded' ? 'text-sm' : 'text-xs'} font-semibold ${
                                                                        connectedSlotCount > 0
                                                                            ? 'text-emerald-600 dark:text-emerald-300'
                                                                            : 'text-gray-400 dark:text-gray-500'
                                                                        }`}
                                                                    >
                                                                        {accountsView === 'expanded' ? onlineLabel : `${connectedSlotCount}/${totalSlots || connectedSlotCount}`}
                                                                    </span>
                                                                    </div>
                                                                )}
                                                                {accountsView === 'expanded' && (
                                                                    <div className="flex w-full min-w-0 items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                                                                        <div className="flex min-w-0 items-center gap-2">
                                                                            <Smartphone size={14} className="shrink-0 text-gray-400 dark:text-gray-500" />
                                                                            <span className="min-w-0 truncate" title={numbersLabel}>{numbersLabel}</span>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); setSelectedLocation(loc); }}
                                                                            aria-label={`Entrar en ${loc.name || t('agency.location.no_name')}`}
                                                                            className="shrink-0 p-1 text-gray-300 transition hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-300"
                                                                        >
                                                                            <ArrowRight size={16} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                <button onClick={(e) => handleDeleteTenant(e, loc.location_id, loc.name)} className="absolute right-3 top-3 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {!searchTerm && accountInfo && Array.from({ length: Math.max(0, (accountInfo.limits?.max_subagencies || 0) - locations.length) }).map((_, idx) => (
                                                    <div key={`empty-${idx}`} onClick={() => { setOnboardingStep(0); setOnboardingCrmType(null); setOnboardingConnectionType(null); setOnboardingHoveredCard(null); setShowOnboarding(true); }} className={`group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-center transition-all hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-gray-700 dark:hover:bg-indigo-900/10 ${accountsView === 'expanded' ? 'min-h-[140px] p-4' : 'min-h-[72px] p-3.5'}`}>
                                                        <div className={`flex items-center justify-center rounded-full bg-gray-50 transition-transform group-hover:scale-110 dark:bg-gray-800 ${accountsView === 'expanded' ? 'mb-2 h-10 w-10' : 'mb-1 h-7 w-7'}`}>
                                                            <Plus size={accountsView === 'expanded' ? 20 : 16} className="text-gray-300 group-hover:text-indigo-600" />
                                                        </div>
                                                        <p className={`font-medium text-gray-500 ${accountsView === 'expanded' ? 'text-xs' : 'truncate px-1 text-[11px]'}`}>
                                                            {isGhlAgency ? t('agency.location.empty_title') : (t('dash.chatwoot_accounts.new_empty') || "Nueva cuenta Waflow Inbox")}
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
                            <div className="space-y-5 pb-1">
                                <div className="space-y-4">
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Users size={12} />
                                                    {reliabilityTotalAccounts} {t('agency.reliability.active_only_note') || 'cuentas activas'}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Smartphone size={12} />
                                                    {reliabilitySummary.connectedSlots}/{reliabilitySummary.totalSlots || 0} {t('agency.reliability.online_slots') || 'slots en línea'}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <ShieldCheck size={12} />
                                                    {overallOperationalLabel}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <RefreshCw size={12} className={reliabilityLoading ? "animate-spin" : ""} />
                                                    {t('agency.reliability.last_update') || 'Actualizado'} {reliabilityLastUpdated ? formatRelativeTime(reliabilityLastUpdated) : (t('agency.reliability.none_short') || 'recién')}
                                                </span>
                                        </div>
                                        <nav
                                            aria-label="Vistas de monitoreo"
                                            className="flex gap-6 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
                                            style={{ scrollbarWidth: 'none' }}
                                        >
                                            {[
                                                ['summary', t('agency.reliability.view_summary') || 'Resumen'],
                                                ['accounts', t('agency.reliability.view_accounts') || 'Cuentas'],
                                                ['signals', t('agency.reliability.view_signals') || 'Señales'],
                                                ['health', t('agency.reliability.view_health') || 'Centro de salud']
                                            ].map(([viewId, label]) => (
                                                <button
                                                    key={viewId}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={reliabilityView === viewId}
                                                    onClick={() => setReliabilityView(viewId)}
                                                    className={`shrink-0 border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors ${
                                                        reliabilityView === viewId
                                                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300'
                                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </nav>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {reliabilityFilterOptions.map(tab => (
                                                <button
                                                    key={`reliability-hero-${tab.id}`}
                                                    onClick={() => setAccountsFilter(tab.id)}
                                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                                                        accountsFilter === tab.id
                                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 shadow-sm'
                                                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-gray-700'
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
                                                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                <input
                                                    type="text"
                                                    autoComplete="off"
                                                    placeholder={t('agency.onboarding.search_accounts') || 'Buscar cuentas...'}
                                                    className="wf-input-with-icon w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-white sm:w-52"
                                                    value={searchTerm}
                                                    onChange={e => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <button
                                                onClick={handleReliabilityRefresh}
                                                disabled={isAutoSyncing || reliabilityLoading}
                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
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
                            ) : reliabilityTotalAccounts === 0 && reliabilityView !== 'health' ? (
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
                                    <div className={reliabilityView === 'summary' ? 'grid gap-6 lg:grid-cols-[minmax(240px,.72fr)_minmax(0,1.28fr)] lg:items-start' : 'space-y-6'}>
                                    <div className={`min-w-0 ${reliabilityView === 'summary' ? 'grid grid-cols-1 gap-y-4 lg:pr-2' : 'grid grid-cols-2 gap-x-5 gap-y-5 md:grid-cols-4 md:gap-x-6'} ${reliabilityView === 'summary' ? '' : 'hidden'}`}>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                                                {t('agency.reliability.sent_24h') || 'Enviados 24h'}
                                            </p>
                                            <p className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{sent24h}</p>
                                            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                {t('agency.reliability.kpi_sent_note') || 'Actividad de salida en las últimas 24 horas.'}
                                            </p>
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                                                {t('agency.reliability.clients_contacted') || 'Clientes contactados'}
                                            </p>
                                            <p className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{contactedContacts24h}</p>
                                            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                {t('agency.reliability.unique_contacts_note') || 'Clientes únicos con al menos un envío.'}
                                            </p>
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                                                {t('agency.reliability.clients_replied') || 'Clientes que respondieron'}
                                            </p>
                                            <p className="mt-1 text-2xl font-black text-gray-900 dark:text-white">
                                                {engagedContacts24h}
                                                {hasReplySample && (
                                                    <span className="text-base font-semibold text-gray-400 dark:text-gray-500">
                                                        {` / ${contactedContacts24h}`}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                {hasReplySample
                                                    ? `${replyRate24h}% · ${t('agency.reliability.reply_rate_secondary') || 'sobre clientes contactados'}`
                                                    : replyNoSampleLabel}
                                            </p>
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                                                {t('agency.reliability.pending_replies') || 'Pendientes de respuesta'}
                                            </p>
                                            <p className="mt-1 text-2xl font-black text-gray-900 dark:text-white">{unansweredContacts24h}</p>
                                            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                {t('agency.reliability.pending_window_note') || 'Clientes que aún no responden dentro de la ventana observada.'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`min-w-0 grid grid-cols-1 gap-6 ${reliabilityView === 'summary' || reliabilityView === 'signals' ? 'xl:grid-cols-1' : 'hidden'}`}>
                                        <div className={`pb-2 pt-0 ${reliabilityView === 'signals' ? 'hidden' : ''}`}>
                                            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                                <div>
                                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                                        {t('agency.reliability.activity_24h') || 'Mensajes en las últimas 24 horas'}
                                                    </h4>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                        {t('agency.reliability.activity_24h_desc') || 'La línea azul muestra mensajes enviados durante las últimas 24 horas.'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-5">
                                                <ReliabilityLineChart
                                                    data={reliabilityTrendPoints}
                                                    maxValue={reliabilityTrendMax}
                                                    emptyLabel={t('agency.reliability.no_activity') || 'Sin mensajes recientes en este periodo.'}
                                                    seriesLabel={t('agency.reliability.sent_label') || 'Mensajes enviados'}
                                                />
                                            </div>
                                        </div>

                                        <div className={`py-5 ${reliabilityView === 'summary' ? 'hidden' : ''}`}>
                                            <div className="grid gap-7 lg:grid-cols-[minmax(240px,.75fr)_minmax(0,1.25fr)] lg:gap-10">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                                                        {t('agency.reliability.overview_state_title') || 'Panorama de hoy'}
                                                    </p>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <p className="text-xl font-black text-gray-900 dark:text-white">{overallOperationalLabel}</p>
                                                        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${getHealthTone(overallOperationalState)}`}>
                                                            {metaRiskAlertAccounts} {metaRiskLabel}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">{overallOperationalDesc}</p>
                                                    <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                                                        {t('agency.reliability.soft_note_no_block') || 'Estas señales no implican bloqueo automático.'}
                                                    </p>
                                                </div>

                                                <div className="min-w-0">
                                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                                        {metaRiskLabel}
                                                    </h4>
                                                    <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                                                        {t('agency.reliability.risk_section_desc_soft') || 'Son señales preventivas para cuidar la calidad del canal y ajustar el ritmo con tiempo.'}
                                                    </p>

                                                    <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                                                        {riskBreakdownItems.map((item) => (
                                                            <div key={item.label} className="flex items-center justify-between gap-4">
                                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{item.label}</p>
                                                                <span className={`inline-flex min-w-9 items-center justify-center rounded-full border px-2 py-1 text-sm font-bold ${getHealthTone(item.tone)}`}>
                                                                    {item.value}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-7 border-t border-gray-100 pt-6 dark:border-gray-800">
                                                <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                                                    <Info size={18} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-300" />
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                            {translateOr(t, 'agency.reliability.signals_notice_title', 'Señales preventivas, no bloqueos')}
                                                        </p>
                                                        <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300">
                                                            {translateOr(t, 'agency.reliability.signals_notice_desc', 'WaFloW analiza patrones agregados de actividad para ayudarte a cuidar el canal. Esta vista no suspende, desconecta ni confirma sanciones de Meta.')}
                                                        </p>
                                                    </div>
                                                </div>

                                                {preventiveSignalRows.length === 0 ? (
                                                    <div className="mt-5 rounded-xl border border-gray-200 bg-white px-5 py-8 text-center dark:border-gray-800 dark:bg-gray-900">
                                                        <ShieldCheck size={24} className="mx-auto text-emerald-500" />
                                                        <p className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
                                                            {translateOr(t, 'agency.reliability.signals_empty_title', 'No hay señales preventivas activas')}
                                                        </p>
                                                        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                            {translateOr(t, 'agency.reliability.signals_empty_desc', 'La actividad observada no requiere ajustes especiales en este momento.')}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="mt-5 space-y-4">
                                                        {preventiveSignalRows.map((item) => {
                                                            const signalReasons = item.metaRiskSignals.length > 0
                                                                ? item.metaRiskSignals.map((signal) => ({
                                                                    type: signal.type,
                                                                    title: getPreventiveSignalTitle(signal.type, t),
                                                                    summary: polishPreventiveSignalText(signal.summary)
                                                                        || translateOr(t, 'agency.reliability.signals_fallback_reason', 'La actividad reciente superó uno de los umbrales preventivos de la cuenta.')
                                                                }))
                                                                : [{
                                                                    type: 'other',
                                                                    title: getPreventiveSignalTitle('other', t),
                                                                    summary: translateOr(
                                                                        t,
                                                                        'agency.reliability.signals_fallback_reason',
                                                                        'La actividad reciente superó uno de los umbrales preventivos de la cuenta.'
                                                                    )
                                                                }];
                                                            const recommendedActions = Array.from(new Set(
                                                                (item.metaRiskSignals.length > 0
                                                                    ? item.metaRiskSignals.map((signal) => getPreventiveSignalAction(signal.type, t))
                                                                    : [item.metaRiskRecommendedAction || item.suggestedAction]
                                                                ).filter(Boolean)
                                                            ));

                                                            return (
                                                                <article key={item.locationId || item.name} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                                                    <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
                                                                        <div className="min-w-0">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <h5 className="truncate text-base font-black text-gray-900 dark:text-white">{item.name}</h5>
                                                                                <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${getHealthTone(item.operationalState)}`}>
                                                                                    {getPreventiveRiskLabel(item.metaRiskLevel, t)}
                                                                                </span>
                                                                            </div>
                                                                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                                                                {translateOr(t, 'agency.reliability.signals_period', 'Actividad de las últimas 24 horas')}
                                                                            </p>
                                                                        </div>
                                                                        <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${item.channelBadgeClassName}`}>
                                                                            {item.channelLabel}
                                                                        </span>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 border-b border-gray-100 sm:grid-cols-5 dark:border-gray-800">
                                                                        {[
                                                                            [translateOr(t, 'agency.reliability.metric_contacted', 'Contactados'), item.contactedCount],
                                                                            [translateOr(t, 'agency.reliability.metric_replied', 'Respondieron'), item.engagedCount],
                                                                            [translateOr(t, 'agency.reliability.metric_unanswered', 'Sin respuesta'), item.unansweredCount],
                                                                            [translateOr(t, 'agency.reliability.metric_outbound', 'Mensajes enviados'), item.outboundMessageCount],
                                                                            [translateOr(t, 'agency.reliability.metric_reply_rate', 'Tasa de respuesta'), `${Math.round(item.replyRate)}%`]
                                                                        ].map(([label, value]) => (
                                                                            <div key={label} className="border-b border-r border-gray-100 px-4 py-3 last:border-r-0 sm:border-b-0 dark:border-gray-800">
                                                                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
                                                                                <p className="mt-1 text-base font-black text-gray-900 dark:text-white">{value}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
                                                                        <div>
                                                                            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                                                                                {translateOr(t, 'agency.reliability.signals_why', 'Por qué aparece')}
                                                                            </p>
                                                                            <div className="mt-3 space-y-3">
                                                                                {signalReasons.map((signal, index) => (
                                                                                    <div key={`${signal.type}-${index}`} className="flex items-start gap-3">
                                                                                        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                                                                                        <div>
                                                                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{signal.title}</p>
                                                                                            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{signal.summary}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>

                                                                        <div>
                                                                            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                                                                                {translateOr(t, 'agency.reliability.signals_what_to_do', 'Qué puedes hacer')}
                                                                            </p>
                                                                            <div className="mt-3 space-y-3">
                                                                                {recommendedActions.map((action) => (
                                                                                    <div key={action} className="flex items-start gap-3">
                                                                                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                                                                                        <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">{polishPreventiveSignalText(action)}</p>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4 dark:border-gray-800 dark:bg-gray-950/30">
                                                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">
                                                                            {translateOr(t, 'agency.reliability.signals_observed_numbers', 'Números observados en esta cuenta')}
                                                                        </p>
                                                                        {item.numberQualityPreview.length > 0 ? (
                                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                                {item.numberQualityPreview.map((preview, index) => (
                                                                                    <span key={`${preview.slot_id || 'slot'}-${preview.phone_number || index}`} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                                                                                        <Smartphone size={12} />
                                                                                        {getNumberQualityPreviewIdentity(preview, t)}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                                                {translateOr(t, 'agency.reliability.signals_no_numbers', 'La señal no incluye un número o slot identificable con los datos disponibles.')}
                                                                            </p>
                                                                        )}
                                                                        <p className="mt-3 text-[11px] leading-5 text-gray-400 dark:text-gray-500">
                                                                            {translateOr(t, 'agency.reliability.signals_scope_note', 'La señal se calcula con actividad agregada de la cuenta. Con estos datos no puede atribuirse a un workflow o slot específico. Esta vista es informativa y no ejecuta bloqueos ni desconexiones.')}
                                                                        </p>
                                                                    </div>
                                                                </article>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    </div>

                                    <div className={`space-y-5 ${reliabilityView === 'health' ? '' : 'hidden'}`}>
                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                                                    {t('agency.reliability.health_numbers') || 'Números observados'}
                                                </p>
                                                <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{operationalSlots.length}</p>
                                            </div>
                                            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                                                    {t('agency.reliability.health_open') || 'Requieren atención'}
                                                </p>
                                                <p className={`mt-2 text-2xl font-black ${operationalAlerts.length ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                                                    {operationalAlerts.length}
                                                </p>
                                            </div>
                                            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                                                    {t('agency.reliability.health_meta_confirmed') || 'Confirmados por Meta'}
                                                </p>
                                                <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{confirmedReachoutCount}</p>
                                            </div>
                                        </div>

                                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                            <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
                                                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                                    operationalAlerts.length
                                                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300'
                                                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300'
                                                }`}>
                                                    {operationalAlerts.length ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                                        {t('agency.reliability.health_title') || 'Centro de salud operativo'}
                                                    </h4>
                                                    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                        {t('agency.reliability.health_desc') || 'Muestra únicamente estados actuales que requieren una acción. Los eventos recuperados permanecen en el historial.'}
                                                    </p>
                                                </div>
                                            </div>

                                            {operationalAlerts.length === 0 ? (
                                                <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                                    {t('agency.reliability.health_empty') || 'No hay incidentes operativos abiertos para este filtro.'}
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                                    {operationalAlerts.map((slot) => {
                                                        const key = `${slot.locationId}_slot${slot.slot_id}`;
                                                        const requiresQr = slot?.capabilities?.requiresQr;
                                                        const confirmed = slot?.reachout?.state === 'restricted' && slot?.reachout?.confirmedByMeta;
                                                        const suspected = slot?.reachout?.state === 'suspected';
                                                        const statusLabel = requiresQr
                                                            ? (t('agency.reliability.health_requires_qr') || 'Requiere QR')
                                                            : confirmed
                                                                ? (t('agency.reliability.health_meta_limited') || 'Limitación temporal confirmada por Meta')
                                                                : suspected
                                                                    ? (t('agency.reliability.health_meta_pending') || 'Señal de Meta pendiente de verificar')
                                                                    : (t('agency.reliability.health_disconnected') || 'Desconectado temporalmente');

                                                        return (
                                                            <div key={key} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                                        {slot.locationName} · {slot.slot_name || `Slot ${slot.slot_id}`}
                                                                    </p>
                                                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                                        {statusLabel}
                                                                        {slot?.reachout?.restrictedUntil
                                                                            ? ` · ${(t('agency.reliability.health_until') || 'hasta')} ${formatOperationalTimestamp(slot.reachout.restrictedUntil)}`
                                                                            : ''}
                                                                    </p>
                                                                </div>
                                                                {(confirmed || suspected) && slot?.capabilities?.verifyNow && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => verifyReachoutState(slot)}
                                                                        disabled={Boolean(reachoutChecking)}
                                                                        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                                                                    >
                                                                        {reachoutChecking === key
                                                                            ? (t('agency.reliability.verifying_reachout') || 'Consultando Meta…')
                                                                            : (t('agency.reliability.verify_reachout') || 'Verificar con Meta')}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`space-y-5 ${reliabilityView === 'accounts' ? '' : 'hidden'}`}>
                                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                                    {t('agency.reliability.accounts_table_title') || 'Listado de cuentas'}
                                                </h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    {t('agency.reliability.accounts_table_desc') || 'Vista compacta por cuenta para revisar actividad, respuesta y seguimiento sin ocupar demasiado espacio.'}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Smartphone size={12} />
                                                    {replyAlertAccounts} {t('agency.reliability.follow_up_accounts') || 'cuentas con seguimiento'}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <ShieldCheck size={12} />
                                                    {metaRiskAlertAccounts} {metaRiskLabel}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-5">
                                            <ReliabilityAccountsTable
                                                data={paginatedReliabilityAccounts}
                                                emptyLabel={t('agency.reliability.all_good_desc') || 'Aún no hay cuentas con movimiento en este filtro.'}
                                                page={safeReliabilityPage}
                                                totalPages={reliabilityTotalPages}
                                                rangeStart={reliabilityRangeStart}
                                                rangeEnd={reliabilityRangeEnd}
                                            totalItems={reliabilityAccountRows.length}
                                            onPageChange={setReliabilityPage}
                                            showingText={t('agency.reliability.showing_accounts') || 'Mostrando'}
                                            ofText={t('agency.reliability.of') || 'de'}
                                            previousText={t('agency.reliability.prev_page') || 'Anterior'}
                                            nextText={t('agency.reliability.next_page') || 'Siguiente'}
                                            t={t}
                                            columns={{
                                                account: t('agency.reliability.table_account') || 'Cuenta',
                                                channel: t('agency.reliability.table_channel') || 'Canal',
                                                state: t('agency.reliability.table_state') || 'Posible baneo',
                                                sent: t('agency.reliability.table_sent') || 'Enviados',
                                                    replies: t('agency.reliability.table_no_replies') || 'No respondieron',
                                                    slots: t('agency.reliability.table_slots') || 'Slots',
                                                    quality: t('agency.reliability.table_quality') || 'Calidad por número',
                                                    action: t('agency.reliability.table_action') || 'Recomendación'
                                                }}
                                                noSampleText={t('agency.reliability.no_sample_short') || 'Sin muestra'}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}


                    {activeTab === 'settings' && (
                        <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-6">
                                <nav
                                    aria-label={t('dash.header.settings') || "Configuración"}
                                    className="wf-soft-scrollbar overflow-x-auto rounded-2xl bg-white/80 p-2 shadow-sm dark:bg-gray-900/80"
                                >
                                    <div className="flex min-w-max items-end gap-5 px-1">
                                        {settingsMenuGroups.map((group) => (
                                            <div key={group.key} className="flex shrink-0 flex-col gap-1.5">
                                                <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                                                    {group.label}
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    {group.items.map((item) => {
                                                        const Icon = item.icon;
                                                        const isActive = currentSettingsSectionId === item.id;
                                                        return (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                onClick={() => setSettingsSection(item.id)}
                                                                aria-current={isActive ? "page" : undefined}
                                                                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                                                                    isActive
                                                                        ? "bg-indigo-600 text-white shadow-[0_12px_24px_-18px_rgba(79,70,229,0.75)]"
                                                                        : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-gray-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-200"
                                                                }`}
                                                            >
                                                                <Icon size={15} className={isActive ? "text-white" : "text-gray-500 dark:text-gray-400"} />
                                                                <span className="font-semibold">{item.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </nav>
                                <div className="space-y-6">
                            {currentSettingsSectionId === 'guide' && (
                            <div className="p-2">
                                <div className="mt-2 divide-y divide-gray-200 dark:divide-gray-800">
                                    <div className="pb-6">
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
                                                    <span>{t('agency.settings_guide.required_chatwoot_master') || "Configurar usuario maestro de Waflow Inbox."}</span>
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

                                    <div className="pt-6">
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
                            <div className="p-2">
                                <div className="wf-account-details grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
                                        <span className={`text-sm font-semibold ${accountStatusToneClass}`}>
                                            {accountStatusLabel}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t('agency.account.integrations') || "Integraciones activas"}</label>
                                        <div className="flex flex-wrap gap-2">
                                            {activeIntegrationLabels.map((label) => {
                                                const normalizedLabel = String(label || '').toLowerCase();
                                                const integrationToneClass = normalizedLabel.includes('waflow inbox')
                                                    ? 'text-emerald-700 dark:text-emerald-300'
                                                    : normalizedLabel.includes('gohighlevel')
                                                        ? 'text-blue-700 dark:text-blue-300'
                                                        : 'text-gray-700 dark:text-gray-200';
                                                return (
                                            <span key={label} className={`text-sm font-semibold ${integrationToneClass}`}>
                                                {label}
                                            </span>
                                                );
                                            })}
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

                            {currentSettingsSectionId === 'support-brand' && (
                                <div className="space-y-5">
                                    <nav className="overflow-x-auto border-b border-gray-200 dark:border-gray-800" aria-label="Subsecciones de soporte y marca">
                                        <div className="flex min-w-max items-end gap-1">
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={settingsSupportBrandTab === 'support'}
                                                onClick={() => setSettingsSupportBrandTab('support')}
                                                className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${settingsSupportBrandTab === 'support'
                                                    ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                                                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                                                    }`}
                                            >
                                                <LifeBuoy size={15} />
                                                {t('agency.settings_nav.support_short') || 'Soporte'}
                                            </button>
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={settingsSupportBrandTab === 'whitelabel'}
                                                onClick={() => setSettingsSupportBrandTab('whitelabel')}
                                                className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${settingsSupportBrandTab === 'whitelabel'
                                                    ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                                                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                                                    }`}
                                            >
                                                <Palette size={15} />
                                                {t('agency.wl.title') || 'Marca Blanca'}
                                            </button>
                                        </div>
                                    </nav>

                                    {settingsSupportBrandTab === 'support' ? (
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
                                    ) : (
                                        <WhiteLabelSettings />
                                    )}
                                </div>
                            )}

                            {currentSettingsSectionId === 'developer' && (
                            <RestrictedFeatureWrapper isRestricted={isRestricted} title={t('dash.settings.dev_title')}>
                                <div className="p-2 animate-in fade-in slide-in-from-right-4">
                                    <div className="mb-4 flex justify-end">
                                        <span className="px-3 py-1 text-xs font-bold uppercase rounded-full border bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/30 dark:border-pink-800">Pro Feature</span>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                                <div className="flex items-start justify-between gap-4 py-2">
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
                                                            {t('agency.account.agency_id') || "ID de Agencia"}
                                                        </p>
                                                        <h4 className="mt-2 text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                            <Key size={16} className="text-emerald-500" />
                                                            {t('dash.settings.n8n_agency_id') || "Agency ID"}
                                                        </h4>
                                                        <p className="mt-2 font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-200 break-all">
                                                            {accountInfo?.agencyId || AGENCY_ID || (t('common.not_available') || "No disponible")}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const agencyIdToCopy = accountInfo?.agencyId || AGENCY_ID || "";
                                                            if (!agencyIdToCopy) return;
                                                            navigator.clipboard.writeText(agencyIdToCopy);
                                                            toast.success(t('common.copied') || "Copiado");
                                                        }}
                                                        className="shrink-0 rounded-xl border border-emerald-200 bg-white/80 px-3 py-2 text-emerald-600 transition hover:bg-white dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                        title={t('common.copy') || "Copiar"}
                                                    >
                                                        <Copy size={16} />
                                                    </button>
                                                </div>
                                                <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                    {t('dash.settings.n8n_agency_id_help') || "Usa este valor como Agency ID de referencia en n8n. Luego el nodo oficial te deja elegir la cuenta y el slot desde listas dinámicas."}
                                                </p>
                                        </div>

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
                            {showNewKeyModal && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('dash.settings.key_generated') || "Clave Generada"}</h3>
                                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('dash.settings.key_copy_warning') || "Cópiala ahora, no podrás verla después."}</p>
                                            </div>
                                            <button type="button" onClick={() => { setShowNewKeyModal(false); setGeneratedKey(null); }} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800" aria-label="Cerrar">
                                                <X size={18} />
                                            </button>
                                        </div>
                                        <div className="relative mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                                            <div className="break-all pr-10 font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">{generatedKey}</div>
                                            <button onClick={() => { navigator.clipboard.writeText(generatedKey); toast.success(t('common.copied') || "Copiado"); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 transition hover:bg-white hover:text-indigo-600 dark:hover:bg-gray-900" aria-label={t('common.copy') || "Copiar"}>
                                                <Copy size={18} />
                                            </button>
                                        </div>
                                        <button onClick={() => { setShowNewKeyModal(false); setGeneratedKey(null); }} className="mt-5 w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-500">{t('common.understood') || "Entendido"}</button>
                                    </div>
                                </div>
                            )}

                            {/* MODAL WEBHOOK */}
                            {showNewWebhookModal && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
                                        <div className="flex items-start justify-between gap-4">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('dash.settings.new_webhook') || "Nuevo Webhook"}</h3>
                                            <button type="button" onClick={() => setShowNewWebhookModal(false)} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800" aria-label="Cerrar">
                                                <X size={18} />
                                            </button>
                                        </div>
                                        <form onSubmit={handleCreateWebhook} className="mt-5 space-y-4">
                                            <div>
                                                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.name') || "Nombre"}</label>
                                                <input name="hookName" placeholder="Ej: n8n Producción" required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                            </div>
                                            <div>
                                                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">URL</label>
                                                <input name="hookUrl" type="url" placeholder="https://..." required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                            </div>
                                            <div>
                                                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.events') || "Eventos"}</label>
                                                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                                                    <label className="flex cursor-pointer items-center gap-3 py-3">
                                                        <input type="checkbox" name="events" value="whatsapp inbound message" defaultChecked className="h-5 w-5 rounded text-indigo-600" />
                                                        <span className="text-sm text-gray-700 dark:text-gray-200">Inbound Message</span>
                                                    </label>
                                                    <label className="flex cursor-pointer items-center gap-3 py-3">
                                                        <input type="checkbox" name="events" value="whatsapp outbound message" defaultChecked className="h-5 w-5 rounded text-indigo-600" />
                                                        <span className="text-sm text-gray-700 dark:text-gray-200">Outbound Message</span>
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                                                <button type="button" onClick={() => setShowNewWebhookModal(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">{t('common.cancel') || "Cancelar"}</button>
                                                <button type="submit" className="flex-1 rounded-xl bg-indigo-600 py-2.5 font-semibold text-white transition hover:bg-indigo-500">{t('common.create') || "Crear"}</button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

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

                    {activeTab === 'agents' && (
                        <WorkflowAgentsPanel
                            locations={locations}
                            onUnauthorized={onLogout}
                            token={token}
                            onOpenSettings={() => {
                                setActiveTab('settings');
                                setSettingsSection('integrations');
                            }}
                            onOpenIntegrations={() => {
                                setActiveTab('settings');
                                setSettingsSection('integrations');
                            }}
                        />
                    )}

                    {activeTab === 'builder' && <InteractiveMessageBuilder />}
                    {activeTab === 'templates-meta' && (
                        <div className="space-y-5">
                            <nav className="mx-auto flex max-w-7xl items-center gap-1 border-b border-gray-200 dark:border-gray-800" aria-label="Secciones de Templates Meta">
                                <button
                                    type="button"
                                    onClick={() => setTemplatesMetaTab('builder')}
                                    className={`border-b-2 px-3 py-2.5 text-sm font-semibold transition ${templatesMetaTab === 'builder'
                                        ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                                        : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                                        }`}
                                >
                                    {t('dash.nav.templates') || 'Generar templates'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTemplatesMetaTab('library')}
                                    className={`border-b-2 px-3 py-2.5 text-sm font-semibold transition ${templatesMetaTab === 'library'
                                        ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                                        : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                                        }`}
                                >
                                    {t('dash.nav.my_templates') || 'Mis templates'}
                                </button>
                            </nav>

                            {templatesMetaTab === 'builder' ? (
                                <OfficialTemplateBuilder
                                    locations={locations}
                                    token={token}
                                    onUnauthorized={onLogout}
                                />
                            ) : (
                                <OfficialTemplateBuilder
                                    locations={locations}
                                    token={token}
                                    onUnauthorized={onLogout}
                                    view="library"
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <SubscriptionManager token={token} accountInfo={accountInfo} onDataChange={refreshData} isChatwootAgency={isChatwootAgency} />
                    )}

                    {/* MODAL ADD LOCATION/ACCOUNT */}
                    {showAddModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {isWaflowCrmHostedModal
                                            ? (t('agency.onboarding.waflow_crm_title') || "Waflow Inbox")
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
                                    {!isWaflowCrmSelfModal ? (
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
                                    ) : (
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                                {t('agency.onboarding.waflow_crm_self_modal_account_name') || "Nombre de la cuenta"}
                                            </label>
                                            <input
                                                type="text"
                                                value={addModalName}
                                                onChange={(e) => setAddModalName(e.target.value)}
                                                placeholder={t('agency.onboarding.waflow_crm_self_modal_account_placeholder') || "Ej: Operaciones Viraltia"}
                                                name="cw_account_name"
                                                autoComplete="off"
                                                required
                                                autoFocus
                                                className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                            />
                                            {Boolean(hostedWaflowPrimaryName) &&
                                                existingWaflowInboxNames.has(hostedWaflowPrimaryName.toLowerCase()) && (
                                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                        {t('agency.onboarding.waflow_crm_self_modal_name_conflict') || "Ese nombre ya existe. Elige otro para esta cuenta."}
                                                    </p>
                                                )}
                                        </div>
                                    )}
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
                                                        Conectar inbox externo
                                                    </label>
                                                </div>
                                            )}

                                            {addModalChatwootExternal ? (
                                                <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                                                    <p className="text-xs text-gray-500 mb-2">
                                                        Conecta tu Waflow Inbox externo.
                                                    </p>
                                                    <div>
                                                        <div className="mb-2 flex items-center gap-2">
                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                                                URL del inbox
                                                            </label>
                                                            <InlineInfoHint
                                                                ariaLabel="Ayuda para URL del inbox"
                                                                text={t('agency.onboarding.chatwoot_url_help') || 'Usa el dominio base de tu inbox. Ejemplo: https://chat.tuempresa.com.'}
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
                                                                ariaLabel="Ayuda para Account ID"
                                                                text={t('agency.onboarding.chatwoot_account_id_help') || 'Abre la cuenta y copia el número que aparece después de /app/accounts/.'}
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
                                                                Access Token
                                                            </label>
                                                            <InlineInfoHint
                                                                ariaLabel="Ayuda para Access Token"
                                                                text={t('agency.onboarding.chatwoot_api_token_help') || 'Usa el api_access_token de un usuario administrador.'}
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
                                                    {isWaflowCrmSelfModal ? "Nombre del primer número" : (t('dash.chatwoot_accounts.inbox_prompt') || "Nombre del primer inbox")}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={addModalInboxName}
                                                    onChange={(e) => setAddModalInboxName(e.target.value)}
                                                    placeholder={isWaflowCrmSelfModal ? "Ej: Número Principal" : (t('dash.chatwoot_accounts.inbox_placeholder') || "Ej: Número Principal")}
                                                    name="cw_first_inbox_name"
                                                    autoComplete="off"
                                                    autoFocus={isWaflowCrmSelfModal}
                                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                                />
                                            </div>
                                            {!isWaflowCrmSelfModal && (
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
                                                                    ? (t('dash.chatwoot_accounts.shared_primary_password_ignored') || "Se reutilizará el mismo acceso principal")
                                                                    : (t('dash.chatwoot_accounts.client_password_optional') || "Opcional: si lo dejas vacío, se genera automáticamente")
                                                            }
                                                            name="cw_client_password"
                                                            autoComplete="new-password"
                                                            disabled={isSharedPrimaryChatwootEmailInModal}
                                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
                                                        />
                                                        <p className="text-[11px] text-gray-500 mt-1">
                                                            {isSharedPrimaryChatwootEmailInModal
                                                                ? (t('dash.chatwoot_accounts.shared_primary_password_ignored') || "Se reutilizará el mismo acceso principal")
                                                                : "Sugerencia: Usa una contraseña segura (mínimo 6 caracteres)."}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            )}
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
                                        {!isWaflowCrmSelfModal && (
                                            <button
                                                type="button"
                                                onClick={closeAddLocationModal}
                                                disabled={isAddingLocation}
                                                className="flex-1 py-3 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white rounded-xl font-bold transition-colors disabled:opacity-60"
                                            >
                                                {t('common.cancel') || "Cancelar"}
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={
                                                isAddingLocation ||
                                                (isWaflowCrmSelfModal
                                                    ? (!addModalName.trim() || !addModalInboxName.trim())
                                                    : !addModalName.trim())
                                            }
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
                        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => { resetOnboardingWizard(); setShowOnboarding(false); }}>
                            <div
                                className={`flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:max-h-[calc(100dvh-2rem)] sm:w-full ${
                                    onboardingStep === 0 ? "max-w-5xl" : "max-w-xl"
                                }`}
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-4 sm:px-6">
                                    <div className="flex min-w-0 items-center gap-3">
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
                                        <div className="min-w-0">
                                            <h3 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                                                {onboardingStep === 0 && (t('agency.onboarding.title') || 'Nueva Cuenta')}
                                                {onboardingStep === 1 && onboardingCrmType === 'ghl' && 'GoHighLevel'}
                                                {onboardingStep === 1 && onboardingCrmType === 'waflow_crm' && onboardingConnectionType !== 'chatwoot_setup_master' && (t('agency.onboarding.waflow_crm_title') || 'Waflow Inbox')}
                                                {onboardingStep === 1 && (onboardingCrmType === 'chatwoot' || onboardingCrmType === 'waflow_crm') && onboardingConnectionType === 'chatwoot_setup_master' && (t('dash.chatwoot_master.title') || 'Usuario maestro de Waflow Inbox')}
                                            </h3>
                                            {onboardingStep === 0 && (
                                                <p className="mt-0.5 max-w-[min(72vw,42rem)] break-words text-xs leading-5 text-gray-500 dark:text-gray-400 sm:text-sm">
                                                    Conecta tu CRM o usa una bandeja de mensajería gestionada por WaFloW.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => { resetOnboardingWizard(); setShowOnboarding(false); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 transition">
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className={`min-h-0 overflow-y-auto p-4 sm:p-5 md:p-6 ${
                                    onboardingStep === 1 && onboardingCrmType === 'ghl' && onboardingConnectionType === 'ghl_create_subaccount'
                                        ? 'pt-1 sm:pt-2 md:pt-3'
                                        : ''
                                }`}>
                                    {/* Step 0: Choose integration type */}
                                    {onboardingStep === 0 && (
                                        <div>
                                            <div className="grid grid-cols-1 items-stretch gap-4 sm:gap-6 md:grid-cols-2 md:gap-8">
                                                <button
                                                    onClick={() => goToOnboardingConnectionStep('ghl')}
                                                    onMouseEnter={() => setOnboardingHoveredCard('ghl')}
                                                    onMouseLeave={() => setOnboardingHoveredCard(null)}
                                                    onFocus={() => setOnboardingHoveredCard('ghl')}
                                                    onBlur={() => setOnboardingHoveredCard(null)}
                                                    className={`group flex h-full min-h-0 flex-col rounded-xl border-2 p-4 text-left transition-all duration-200 sm:p-5 ${
                                                        onboardingHoveredCard === 'ghl'
                                                            ? 'border-blue-600 dark:border-blue-400 bg-blue-50/60 dark:bg-blue-900/20 shadow-[0_14px_30px_rgba(37,99,235,0.25)] -translate-y-0.5'
                                                            : onboardingHoveredCard
                                                                ? 'opacity-75 border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-900'
                                                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-[0_10px_24px_rgba(59,130,246,0.18)]'
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
                                                    <div className="mt-4 flex items-center gap-3">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 shrink-0">
                                                            <Globe size={20} className="text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <h5 className="min-w-0 break-words text-xl leading-[1.08] font-extrabold tracking-tight uppercase text-gray-900 dark:text-white sm:text-2xl md:text-[1.75rem]">
                                                            {onboardingCardTitles.ghl}
                                                        </h5>
                                                    </div>
                                                    <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                                                        {t('agency.onboarding.benefits_title_ghl') || 'Listado de beneficios'}
                                                    </p>
                                                    <ul className="mt-3 space-y-2 text-xs leading-5 text-gray-800 dark:text-gray-200 sm:text-sm">
                                                        <li className="flex items-start gap-2.5"><CheckCircle2 size={13} className="mt-1 text-blue-600 shrink-0" /><span className="min-w-0">{t('agency.onboarding.ghl_benefit_1') || 'Pipeline y CRM en un solo lugar'}</span></li>
                                                        <li className="flex items-start gap-2.5"><CheckCircle2 size={13} className="mt-1 text-blue-600 shrink-0" /><span className="min-w-0">{t('agency.onboarding.ghl_benefit_2') || 'Automatizaciones y campañas'}</span></li>
                                                        <li className="flex items-start gap-2.5"><CheckCircle2 size={13} className="mt-1 text-blue-600 shrink-0" /><span className="min-w-0">{t('agency.onboarding.ghl_benefit_3') || 'Instalación rápida de Waflow'}</span></li>
                                                        <li className="flex items-start gap-2.5"><CheckCircle2 size={13} className="mt-1 text-blue-600 shrink-0" /><span className="min-w-0">{t('agency.onboarding.ghl_benefit_4') || 'Perfecto para pipeline, campañas y seguimiento'}</span></li>
                                                        <li className="flex items-start gap-2.5"><CheckCircle2 size={13} className="mt-1 text-blue-600 shrink-0" /><span className="min-w-0">{t('agency.onboarding.ghl_benefit_5') || 'Opción disponible en marca blanca'}</span></li>
                                                    </ul>
                                                </button>

                                                <button
                                                    onClick={openOnboardingWaflowCrmFlow}
                                                    onMouseEnter={() => setOnboardingHoveredCard('waflow_crm')}
                                                    onMouseLeave={() => setOnboardingHoveredCard(null)}
                                                    onFocus={() => setOnboardingHoveredCard('waflow_crm')}
                                                    onBlur={() => setOnboardingHoveredCard(null)}
                                                    className={`group relative flex h-full min-h-0 flex-col rounded-xl border-2 p-4 text-left transition-all duration-200 sm:p-5 ${
                                                        onboardingHoveredCard === 'waflow_crm'
                                                            ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/20 shadow-[0_14px_30px_rgba(5,150,105,0.22)] -translate-y-0.5'
                                                            : onboardingHoveredCard
                                                                ? 'opacity-75 border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-900'
                                                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-[0_10px_24px_rgba(16,185,129,0.18)]'
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
                                                    <div className="mt-4 flex items-center gap-3">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30 shrink-0">
                                                            <Building2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                        <h5 className="min-w-0 break-words text-xl leading-[1.08] font-extrabold tracking-tight uppercase text-gray-900 dark:text-white sm:text-2xl md:text-[1.75rem]">
                                                            {onboardingCardTitles.waflow}
                                                        </h5>
                                                    </div>
                                                    <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                                                        {t('agency.onboarding.benefits_title_waflow') || 'Listado de beneficios'}
                                                    </p>
                                                    <ul className="mt-3 space-y-2 text-xs leading-5 text-gray-800 dark:text-gray-200 sm:text-sm">
                                                        <li className="flex items-start gap-2.5"><CheckCircle2 size={13} className="mt-1 text-emerald-600 shrink-0" /><span className="min-w-0">{t('agency.onboarding.waflow_crm_benefit_1') || 'Cuenta lista para operar en minutos'}</span></li>
                                                        <li className="flex items-start gap-2.5"><CheckCircle2 size={13} className="mt-1 text-emerald-600 shrink-0" /><span className="min-w-0">{t('agency.onboarding.waflow_crm_benefit_2') || 'WhatsApp, inboxes y usuarios en un solo flujo'}</span></li>
                                                        <li className="flex items-start gap-2.5"><CheckCircle2 size={13} className="mt-1 text-emerald-600 shrink-0" /><span className="min-w-0">{t('agency.onboarding.waflow_crm_benefit_3') || 'Operación diaria dentro de Waflow'}</span></li>
                                                        <li className="flex items-start gap-2.5"><CheckCircle2 size={13} className="mt-1 text-emerald-600 shrink-0" /><span className="min-w-0">{t('agency.onboarding.waflow_crm_benefit_4') || 'Ideal para equipos de soporte, ventas y atención'}</span></li>
                                                        <li className="flex items-start gap-2.5"><CheckCircle2 size={13} className="mt-1 text-emerald-600 shrink-0" /><span className="min-w-0">{t('agency.onboarding.waflow_crm_benefit_5') || 'Permite gestionar varios clientes desde una sola cuenta Maestra'}</span></li>
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
                                                onClick={handleRequestManagedGhlSubaccount}
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

                                    {/* Step 1 WaFloW: Who is this account for? */}
                                    {onboardingStep === 1 && onboardingCrmType === 'waflow_crm' && !onboardingConnectionType && (
                                        <div className="space-y-3">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                                {t('agency.onboarding.waflow_crm_usage_title') || '¿Para quién es esta cuenta?'}
                                            </p>
                                            <button
                                                onClick={openOnboardingWaflowPrimaryFlow}
                                                className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 bg-white dark:bg-gray-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all group text-left flex items-center gap-4"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                                    <User size={20} className="text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                                                        {t('agency.onboarding.waflow_crm_for_self_title') || 'Para mi negocio'}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                        {t('agency.onboarding.waflow_crm_for_self_desc') || 'Usa tu acceso principal y crea la cuenta con tus propios datos.'}
                                                    </p>
                                                </div>
                                                <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-500 ml-auto shrink-0 transition" />
                                            </button>
                                            <button
                                                onClick={openOnboardingWaflowClientFlow}
                                                className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 bg-white dark:bg-gray-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all group text-left flex items-center gap-4"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                                    <Users size={20} className="text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                                                        {t('agency.onboarding.waflow_crm_for_client_title') || 'Para un cliente'}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                        {t('agency.onboarding.waflow_crm_for_client_desc') || 'Crea una cuenta separada y define el acceso del cliente final.'}
                                                    </p>
                                                </div>
                                                <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-500 ml-auto shrink-0 transition" />
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
                                                    if (data?.requiresUpgrade) {
                                                        setShowManagedGhlPaidGate(true);
                                                        return;
                                                    }
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
                                        }} className="space-y-3">
                                            <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                                                {t('agency.onboarding.ghl_create_subaccount_form') || 'Solicita una nueva subcuenta GoHighLevel con nuestro equipo'}
                                            </p>
                                            <p className="text-[11px] leading-4 text-amber-600 dark:text-amber-400">
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
                                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="Mi Negocio"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                                                        className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                                                        className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                        placeholder="+1234567890"
                                                    />
                                                </div>
                                            </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {t('agency.onboarding.ghl_subaccount_notes') || 'Notas adicionales'}
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={onboardingSubaccountNotes}
                                                    onChange={e => setOnboardingSubaccountNotes(e.target.value)}
                                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                                    placeholder={t('agency.onboarding.ghl_subaccount_notes_placeholder') || 'Cuéntanos si necesitas dominio, nicho, país o cualquier detalle útil para preparar la subcuenta.'}
                                                />
                                            </div>
                                            <div className="flex justify-end gap-2 pt-1">
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
                                                setOnboardingConnectionType(null);
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

            {tenantPendingDeletion && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:p-6"
                    role="presentation"
                    onClick={() => !isDeletingTenant && setTenantPendingDeletion(null)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:p-6"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-tenant-title"
                        aria-describedby="delete-tenant-description"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="min-w-0">
                                <h2 id="delete-tenant-title" className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                                    {t('agency.tenant.confirm_title') || 'Eliminar subcuenta'}
                                </h2>
                                <p id="delete-tenant-description" className="mt-2 text-sm leading-5 text-gray-500 dark:text-gray-400">
                                    {t('agency.tenant.confirm_description') || 'Esta acción eliminará la subcuenta y no se puede deshacer.'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 dark:border-gray-700 dark:bg-gray-800/60">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white" title={tenantPendingDeletion.name}>
                                {tenantPendingDeletion.name}
                            </p>
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setTenantPendingDeletion(null)}
                                disabled={isDeletingTenant}
                                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                                {t('common.cancel') || 'Cancelar'}
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteTenant}
                                disabled={isDeletingTenant}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isDeletingTenant ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                {isDeletingTenant
                                    ? (t('agency.tenant.deleting') || 'Eliminando...')
                                    : (t('agency.tenant.confirm_action') || 'Eliminar subcuenta')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

const SidebarItem = ({ id, icon: Icon, label, activeTab, setActiveTab, branding, sidebarOpen }) => (
    <button
        onClick={() => setActiveTab(id)}
        title={label}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-medium transition-all md:mb-1 md:h-auto md:py-3
            ${sidebarOpen ? 'md:w-full md:justify-start md:gap-3 md:px-4' : 'md:mx-auto md:w-12 md:justify-center md:px-0'}
            ${activeTab === id ? 'font-bold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}
        `}
        style={activeTab === id ? { color: branding?.primaryColor || '#4F46E5', backgroundColor: (branding?.primaryColor || '#4F46E5') + '15' } : {}}
    >
        <Icon size={20} className="h-5 w-5 shrink-0" />
        {sidebarOpen && <span className="hidden whitespace-nowrap md:inline">{label}</span>}
    </button>
);

const ReliabilityLineChart = ({ data, maxValue, emptyLabel, seriesLabel }) => {
    if (!Array.isArray(data) || data.length === 0 || !data.some((item) => Number(item?.sent) > 0)) {
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

    const seriesPath = buildPath((point) => point?.sent);

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

                <path d={seriesPath} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                {data.map((point, index) => {
                    const x = padding.left + (index * stepX);
                    const seriesY = padding.top + chartHeight - (((Number(point?.sent) || 0) / safeMax) * chartHeight);
                            const tooltipText = [
                                formatTimelineTooltip(point?.bucketStart),
                                `${seriesLabel}: ${Number(point?.sent) || 0}`
                    ].filter(Boolean).join('\n');

                    return (
                        <g key={`point-${point?.bucketStart || index}`}>
                            <circle cx={x} cy={seriesY} r="7" fill="transparent" className="cursor-help">
                                <title>{tooltipText}</title>
                            </circle>
                            <circle cx={x} cy={seriesY} r="3.5" fill="#3b82f6" pointerEvents="none" />
                        </g>
                    );
                })}
            </svg>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> {seriesLabel}</span>
            </div>
        </div>
    );
};

const ReliabilityAccountsTable = ({
    data,
    emptyLabel,
    page,
    totalPages,
    rangeStart,
    rangeEnd,
    totalItems,
    onPageChange,
    showingText,
    ofText,
    previousText,
    nextText,
    t,
    columns,
    noSampleText
}) => {
    const translate = typeof t === 'function' ? t : ((key) => key);

    if (!Array.isArray(data) || data.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/30 p-5 text-sm text-gray-500 dark:text-gray-400">
                {emptyLabel}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="hidden xl:block">
                <table className="w-full table-fixed border-collapse text-sm">
                    <colgroup>
                        <col className="w-[20%]" />
                        <col className="w-[18%]" />
                        <col className="w-[15%]" />
                        <col className="w-[8%]" />
                        <col className="w-[23%]" />
                        <col className="w-[16%]" />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-gray-200 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:border-gray-800">
                            <th className="px-3 pb-3 font-bold">{columns.account}</th>
                            <th className="px-3 pb-3 font-bold">{columns.channel} / {columns.state}</th>
                            <th className="px-3 pb-3 font-bold">{columns.sent} / {columns.replies}</th>
                            <th className="px-3 pb-3 font-bold">{columns.slots}</th>
                            <th className="px-3 pb-3 font-bold">{columns.quality}</th>
                            <th className="px-3 pb-3 font-bold">{columns.action}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {data.map((item) => {
                            const replySample = (Number(item?.contactedCount) || 0) > 0;
                            const rowInteractive = typeof item?.onClick === 'function';

                            return (
                                <tr
                                    key={`table-${item.locationId}`}
                                    onClick={rowInteractive ? item.onClick : undefined}
                                    className={rowInteractive ? "cursor-pointer transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/30" : ""}
                                >
                                    <td className="px-3 py-4 align-top">
                                        <p className="truncate font-semibold text-gray-900 dark:text-white">{item.name}</p>
                                        <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{item.locationId}</p>
                                    </td>
                                    <td className="px-3 py-4 align-top">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-1 text-[11px] font-semibold ${item.channelBadgeClassName}`}>
                                                {item.channelLabel}
                                            </span>
                                            <span className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-1 text-[11px] font-semibold ${getHealthTone(item.operationalState)}`}>
                                                {item.operationalStateLabel}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 align-top">
                                        <div className="space-y-1">
                                            <p><span className="text-xs text-gray-400">{columns.sent}:</span> <span className="font-semibold text-gray-900 dark:text-white">{item.sent}</span></p>
                                            <p><span className="text-xs text-gray-400">{columns.replies}:</span> <span className="font-semibold text-gray-900 dark:text-white">{replySample ? item.unansweredCount : noSampleText}</span></p>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 align-top font-semibold text-gray-900 dark:text-white">
                                        {item.connectedSlotCount}/{item.totalSlots || item.connectedSlotCount}
                                    </td>
                                    <td className="px-3 py-4 align-top">
                                        <div className="min-w-0">
                                            <div className="truncate text-[10px] font-bold uppercase tracking-wide text-gray-400" title={getNumberQualityTooltip(item.numberQualitySource, translate)}>
                                                {getNumberQualitySourceLabel(item.numberQualitySource, translate)}
                                            </div>
                                            {Array.isArray(item.numberQualityPreview) && item.numberQualityPreview.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                                                    {item.numberQualityPreview.slice(0, 2).map((preview) => (
                                                        <div key={`${item.locationId}-table-${preview.slot_id || preview.phone_number || preview.slot_name}`} className="flex min-w-0 items-center gap-2 text-xs">
                                                            <span className="max-w-[130px] truncate font-semibold text-gray-700 dark:text-gray-200">
                                                                {getNumberQualityPreviewIdentity(preview, translate)}
                                                            </span>
                                                            <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${getHealthTone(preview.level)}`}>
                                                                {getNumberQualityLabel(preview.level, translate)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {item.numberQualityPreview.length > 2 ? (
                                                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                            {translateOr(translate, 'agency.reliability.more_numbers', '+{count} más')
                                                                .replace('{count}', String(item.numberQualityPreview.length - 2))}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <span className={`mt-2 inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${getHealthTone('unknown')}`}>
                                                    {noSampleText}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 align-top text-sm leading-5 text-gray-600 dark:text-gray-300">
                                        {item.suggestedAction}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800 xl:hidden">
                {data.map((item) => {
                    const replySample = (Number(item?.contactedCount) || 0) > 0;
                    const rowInteractive = typeof item?.onClick === 'function';
                    const rowClassName = rowInteractive
                        ? "cursor-pointer rounded-xl transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/30"
                        : "";

                    return (
                        <div
                            key={item.locationId}
                            onClick={rowInteractive ? item.onClick : undefined}
                            className={`grid grid-cols-1 gap-4 px-3 py-5 md:grid-cols-2 md:gap-x-6 md:gap-y-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,.9fr)_minmax(0,.55fr)_minmax(0,1.25fr)_minmax(0,1fr)] xl:items-start xl:gap-4 xl:py-4 ${rowClassName}`}
                        >
                            <div className="min-w-0">
                                <p className="truncate font-semibold text-gray-900 dark:text-white">{item.name}</p>
                                <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{item.locationId}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 md:col-span-1 xl:block xl:space-y-2">
                                <div className="min-w-0">
                                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400 xl:hidden">{columns.channel}</span>
                                    <span className={`inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-1 text-xs font-semibold ${item.channelBadgeClassName}`}>
                                        {item.channelLabel}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400 xl:hidden">{columns.state}</span>
                                    <span className={`inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-1 text-xs font-semibold ${getHealthTone(item.operationalState)}`}>
                                        {item.operationalStateLabel}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 md:col-span-1 xl:block xl:space-y-2">
                                <div>
                                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400 xl:hidden">{columns.sent}</span>
                                    <p className="font-semibold text-gray-900 dark:text-white">{item.sent}</p>
                                </div>
                                <div>
                                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400 xl:hidden">{columns.replies}</span>
                                    <p className="font-semibold text-gray-900 dark:text-white">{replySample ? item.unansweredCount : noSampleText}</p>
                                </div>
                            </div>

                            <div>
                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400 xl:hidden">{columns.slots}</span>
                                <p className="font-semibold text-gray-900 dark:text-white">{item.connectedSlotCount}/{item.totalSlots || item.connectedSlotCount}</p>
                            </div>

                            <div className="min-w-0">
                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400 xl:hidden">{columns.quality}</span>
                                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400" title={getNumberQualityTooltip(item.numberQualitySource, translate)}>
                                    {getNumberQualitySourceLabel(item.numberQualitySource, translate)}
                                </div>
                                {Array.isArray(item.numberQualityPreview) && item.numberQualityPreview.length > 0 ? (
                                    <div className="mt-2 space-y-1.5">
                                        {item.numberQualityPreview.slice(0, 2).map((preview) => (
                                            <div key={`${item.locationId}-${preview.slot_id || preview.phone_number || preview.slot_name}`} className="flex min-w-0 items-center justify-between gap-3 text-xs">
                                                <span className="min-w-0 truncate font-semibold text-gray-700 dark:text-gray-200">
                                                    {getNumberQualityPreviewIdentity(preview, translate)}
                                                </span>
                                                <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${getHealthTone(preview.level)}`}>
                                                    {getNumberQualityLabel(preview.level, translate)}
                                                </span>
                                            </div>
                                        ))}
                                        {item.numberQualityPreview.length > 2 ? (
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                {translateOr(translate, 'agency.reliability.more_numbers', '+{count} más')
                                                    .replace('{count}', String(item.numberQualityPreview.length - 2))}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <span className={`mt-2 inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${getHealthTone('unknown')}`}>
                                        {noSampleText}
                                    </span>
                                )}
                            </div>

                            <div className="min-w-0">
                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400 xl:hidden">{columns.action}</span>
                                <p className="text-sm leading-5 text-gray-600 dark:text-gray-300">{item.suggestedAction}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 dark:border-gray-800 pt-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {`${showingText} ${rangeStart}-${rangeEnd} ${ofText} ${totalItems}`}
                </p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onPageChange(Math.max(1, page - 1))}
                        disabled={page <= 1}
                        className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-200 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {previousText}
                    </button>
                    <span className="px-2 text-sm text-gray-500 dark:text-gray-400">{page}/{totalPages}</span>
                    <button
                        type="button"
                        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                        disabled={page >= totalPages}
                        className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-200 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {nextText}
                    </button>
                </div>
            </div>
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



