import React, { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronLeft, FileText, Loader2, Play, RefreshCw, Save, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../context/LanguageContext";
import OpenAiKeySetupModal from "../components/OpenAiKeySetupModal";
import { resolveOpenAiAccountLabel } from "../utils/openAiKeySetup";

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");
const inputClassName = "w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
const textAreaCardClassName = "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white";
const DEFAULT_AGENT_BEHAVIOR = {
    role: "",
    tone: "",
    objective: "",
    guardrails: ""
};
const EMPTY_AGENT_ACTION_RULES = {
    add_tags: [],
    remove_tags: []
};
const OBJECTIVE_SENTENCES_FROM_BUSINESS_CONTEXT = [
    "Si falta informaci\u00f3n, pide el dato m\u00ednimo con empat\u00eda antes de responder.",
    "If information is missing, ask for the minimum detail with empathy before replying."
];
const DEFAULT_AGENT_PERMISSIONS = {
    view_appointments: true,
    add_tags: true,
    remove_tags: true,
    assign_owner: false,
    set_fields: true,
    create_appointment: true,
    reschedule_appointment: true,
    cancel_appointment: true
};

const WORKFLOW_AGENT_PRESET_KEYS = [
    "sales_inbox",
    "sales_ghl",
    "support_inbox",
    "appointments_ghl",
    "reception_both"
];

const WORKFLOW_AGENT_PRESET_SETTINGS = {
    sales_inbox: { integrationMode: "inbox", temperature: "0.5", maxOutputChars: "700" },
    sales_ghl: { integrationMode: "ghl", temperature: "0.4", maxOutputChars: "650" },
    support_inbox: { integrationMode: "inbox", temperature: "0.3", maxOutputChars: "750" },
    appointments_ghl: { integrationMode: "ghl", temperature: "0.3", maxOutputChars: "650" },
    reception_both: { integrationMode: "both", temperature: "0.4", maxOutputChars: "700" }
};

const PRESET_PERMISSION_PROFILES = {
    inbox_basic: {
        view_appointments: false,
        add_tags: false,
        remove_tags: false,
        assign_owner: false,
        set_fields: false,
        create_appointment: false,
        reschedule_appointment: false,
        cancel_appointment: false
    },
    ghl_sales: {
        view_appointments: true,
        add_tags: true,
        remove_tags: false,
        assign_owner: false,
        set_fields: true,
        create_appointment: true,
        reschedule_appointment: false,
        cancel_appointment: false
    },
    ghl_appointments: {
        view_appointments: true,
        add_tags: true,
        remove_tags: false,
        assign_owner: false,
        set_fields: true,
        create_appointment: true,
        reschedule_appointment: true,
        cancel_appointment: true
    },
    both_reception: {
        ...DEFAULT_AGENT_PERMISSIONS
    }
};

function applyIntegrationPermissionCaps(permissions = {}, integrationMode = "both") {
    const safePermissions = {
        ...DEFAULT_AGENT_PERMISSIONS,
        ...(permissions || {}),
        assign_owner: false
    };
    if (integrationMode !== "inbox") return safePermissions;

    return {
        ...safePermissions,
        view_appointments: false,
        set_fields: false,
        create_appointment: false,
        reschedule_appointment: false,
        cancel_appointment: false
    };
}

function normalizeTagsInput(value) {
    return String(value || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .filter((tag, index, list) => list.findIndex((candidate) => candidate.toLowerCase() === tag.toLowerCase()) === index);
}

function normalizeActionRuleDrafts(rules = []) {
    return (Array.isArray(rules) ? rules : [])
        .map((rule) => ({
            condition: String(rule?.condition || "").trim(),
            tags: Array.isArray(rule?.tags)
                ? normalizeTagsInput(rule.tags.join(","))
                : normalizeTagsInput(rule?.tagsText || rule?.tags || "")
        }))
        .filter((rule) => rule.condition && rule.tags.length > 0)
        .slice(0, 20);
}

function buildActionRuleDrafts(rules = []) {
    const normalized = normalizeActionRuleDrafts(rules);
    const source = normalized.length > 0 ? normalized : [{ condition: "", tags: [] }];
    return source.map((rule) => ({
        condition: rule.condition,
        tagsText: (rule.tags || []).join(", ")
    }));
}

function countActionRules(actionRules = {}, permissionKey) {
    const rules = Array.isArray(actionRules?.[permissionKey]) ? actionRules[permissionKey] : [];
    return normalizeActionRuleDrafts(rules).length;
}

function moveObjectiveSentenceFromBusinessContext(form = {}) {
    let systemPrompt = String(form.system_prompt || "");
    const behavior = {
        ...DEFAULT_AGENT_BEHAVIOR,
        ...(form.behavior || {})
    };
    let objective = String(behavior.objective || "").trim();

    for (const sentence of OBJECTIVE_SENTENCES_FROM_BUSINESS_CONTEXT) {
        if (!systemPrompt.includes(sentence)) continue;
        systemPrompt = systemPrompt.split(sentence).join("\n").replace(/\n{3,}/g, "\n\n").trim();
        if (!objective.toLowerCase().includes(sentence.toLowerCase())) {
            objective = objective ? `${objective} ${sentence}` : sentence;
        }
    }

    return {
        ...form,
        system_prompt: systemPrompt,
        behavior: {
            ...behavior,
            objective
        }
    };
}

function buildWorkflowAgentPresets(t) {
    return WORKFLOW_AGENT_PRESET_KEYS.map((key) => ({
        key,
        title: t(`workflow_agents.preset_${key}_title`),
        description: t(`workflow_agents.preset_${key}_desc`),
        badge: t(`workflow_agents.preset_${key}_badge`),
        integrationMode: WORKFLOW_AGENT_PRESET_SETTINGS[key]?.integrationMode || "both",
        name: t(`workflow_agents.preset_${key}_name`),
        temperature: WORKFLOW_AGENT_PRESET_SETTINGS[key]?.temperature || "0.4",
        maxOutputChars: WORKFLOW_AGENT_PRESET_SETTINGS[key]?.maxOutputChars || "700",
        businessContext: t(`workflow_agents.preset_${key}_business_context`),
        fallbackReply: t(`workflow_agents.preset_${key}_fallback`),
        behavior: {
            role: t(`workflow_agents.preset_${key}_role`),
            tone: t(`workflow_agents.preset_${key}_tone`),
            objective: t(`workflow_agents.preset_${key}_objective`),
            guardrails: t(`workflow_agents.preset_${key}_guardrails`)
        },
        permissions:
            key === "sales_ghl"
                ? PRESET_PERMISSION_PROFILES.ghl_sales
                : key === "appointments_ghl"
                    ? PRESET_PERMISSION_PROFILES.ghl_appointments
                    : key === "reception_both"
                        ? PRESET_PERMISSION_PROFILES.both_reception
                        : PRESET_PERMISSION_PROFILES.inbox_basic
    }));
}

function mergeAgentConfig(agent = {}) {
    return {
        behavior: {
            ...DEFAULT_AGENT_BEHAVIOR,
            ...(agent?.config?.behavior || {})
        },
        permissions: {
            ...DEFAULT_AGENT_PERMISSIONS,
            ...(agent?.config?.permissions || {}),
            assign_owner: false
        },
        action_rules: {
            add_tags: normalizeActionRuleDrafts(agent?.config?.action_rules?.add_tags || agent?.config?.actionRules?.addTags || []),
            remove_tags: normalizeActionRuleDrafts(agent?.config?.action_rules?.remove_tags || agent?.config?.actionRules?.removeTags || [])
        },
        calendar_scope: {
            mode: agent?.config?.calendar_scope?.mode === "selected" ? "selected" : "all",
            calendar_ids: Array.isArray(agent?.config?.calendar_scope?.calendar_ids)
                ? agent.config.calendar_scope.calendar_ids.map((value) => String(value))
                : []
        }
    };
}

function formatRunTimestamp(value) {
    if (!value) return "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString();
}

function formatDuration(value) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return "0 ms";
    return parsed < 1000 ? `${parsed} ms` : `${(parsed / 1000).toFixed(1)} s`;
}

function formatFileSize(bytes) {
    const safeBytes = Number.parseInt(String(bytes || ""), 10);
    if (!Number.isFinite(safeBytes) || safeBytes <= 0) return "0 KB";
    if (safeBytes < 1024) return `${safeBytes} B`;
    if (safeBytes < 1024 * 1024) return `${(safeBytes / 1024).toFixed(1)} KB`;
    return `${(safeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildDefaultIntegrations(catalog = []) {
    const defaults = {};
    for (const item of catalog) {
        defaults[item.key] = {
            enabled: item.default_enabled === true,
            config: {}
        };
    }
    if (!defaults.ghl) defaults.ghl = { enabled: true, config: {} };
    if (!defaults.chatwoot) defaults.chatwoot = { enabled: false, config: {} };
    return defaults;
}

function applyPresetIntegrationMode(integrations = {}, mode = "both") {
    const next = Object.entries(integrations || {}).reduce((acc, [key, value]) => {
        acc[key] = {
            ...(value || {}),
            config: value?.config || {}
        };
        return acc;
    }, {});

    if (!next.ghl) next.ghl = { enabled: false, config: {} };
    if (!next.chatwoot) next.chatwoot = { enabled: false, config: {} };

    next.ghl.enabled = mode === "ghl" || mode === "both";
    next.chatwoot.enabled = mode === "inbox" || mode === "both";

    return next;
}

function buildPresetForm(baseForm, preset) {
    const integrationMode = preset.integrationMode || "both";
    return moveObjectiveSentenceFromBusinessContext({
        ...baseForm,
        name: preset.name,
        status: "paused",
        temperature: preset.temperature,
        max_output_chars: preset.maxOutputChars,
        system_prompt: preset.businessContext,
        fallback_reply: preset.fallbackReply,
        description: preset.description,
        use_contact_context: true,
        behavior: {
            ...baseForm.behavior,
            ...preset.behavior
        },
        permissions: applyIntegrationPermissionCaps(
            {
                ...baseForm.permissions,
                ...preset.permissions
            },
            integrationMode
        ),
        integrations: applyPresetIntegrationMode(baseForm.integrations, integrationMode)
    });
}

function getWorkspacePresetMode(workspace = {}, catalog = []) {
    const location = workspace?.location || {};
    const crmType = String(location?.crm_type || location?.settings?.crm_type || "").toLowerCase();
    const ghlIntegration = catalog.find((item) => item?.key === "ghl") || {};
    const inboxIntegration = catalog.find((item) => item?.key === "chatwoot") || {};
    const hasGhl = crmType === "ghl" || ghlIntegration.connected === true || ghlIntegration.status === "ready";
    const hasInbox = crmType === "chatwoot" || inboxIntegration.connected === true || inboxIntegration.status === "connected";

    if (hasGhl && !hasInbox) return "ghl";
    if (hasInbox && !hasGhl) return "inbox";
    return "both";
}

function presetMatchesWorkspace(preset, workspaceMode) {
    if (!preset) return false;
    if (workspaceMode === "ghl") return preset.integrationMode === "ghl" || preset.integrationMode === "both";
    if (workspaceMode === "inbox") return preset.integrationMode === "inbox" || preset.integrationMode === "both";
    return true;
}

function resolvePresetIntegrationMode(preset, workspaceMode) {
    if (preset?.integrationMode !== "both") return preset?.integrationMode || "both";
    if (workspaceMode === "ghl" || workspaceMode === "inbox") return workspaceMode;
    return "both";
}

function buildEmptyForm(catalog = []) {
    return {
        name: "",
        agent_key: "",
        status: "paused",
        credential_mode: "location",
        slot_ids: [],
        manual_api_key: "",
        manual_api_key_configured: false,
        clear_manual_api_key: false,
        model: "",
        temperature: "0.4",
        max_output_chars: "600",
        system_prompt: "",
        fallback_reply: "",
        description: "",
        use_contact_context: true,
        behavior: { ...DEFAULT_AGENT_BEHAVIOR },
        permissions: { ...DEFAULT_AGENT_PERMISSIONS },
        action_rules: { ...EMPTY_AGENT_ACTION_RULES },
        calendar_scope_mode: "all",
        calendar_scope_ids: [],
        integrations: buildDefaultIntegrations(catalog)
    };
}

function buildFormFromAgent(agent, catalog = []) {
    const config = mergeAgentConfig(agent);
    const integrations = buildDefaultIntegrations(catalog);
    for (const item of catalog) {
        const binding = agent?.integrations?.[item.key];
        if (!binding) continue;
        integrations[item.key] = {
            enabled: binding.enabled === true,
            config: binding.config || {}
        };
    }

    return moveObjectiveSentenceFromBusinessContext({
        name: agent?.name || "",
        agent_key: agent?.agent_key || "",
        status: agent?.status || "active",
        credential_mode: "location",
        slot_ids: [],
        manual_api_key: "",
        manual_api_key_configured: agent?.manual_api_key_configured === true,
        clear_manual_api_key: false,
        model: agent?.model || "gpt-4o-mini",
        temperature: String(agent?.temperature ?? "0.4"),
        max_output_chars: String(agent?.max_output_chars ?? "600"),
        system_prompt: agent?.system_prompt || "",
        fallback_reply: agent?.fallback_reply || "",
        description: agent?.description || "",
        use_contact_context: agent?.use_contact_context !== false,
        behavior: { ...config.behavior },
        permissions: { ...config.permissions },
        action_rules: { ...config.action_rules },
        calendar_scope_mode: config.calendar_scope.mode,
        calendar_scope_ids: Array.isArray(config.calendar_scope.calendar_ids)
            ? config.calendar_scope.calendar_ids.map((value) => String(value))
            : [],
        integrations
    });
}

function getIntegrationTitle(t, integrationKey) {
    return t(`workflow_agents.integration_${integrationKey}_title`);
}

function getIntegrationDescription(t, integrationKey) {
    return t(`workflow_agents.integration_${integrationKey}_desc`);
}

function getIntegrationStatusLabel(t, status) {
    return t(`workflow_agents.integration_status_${status}`) || status;
}

function getIntegrationStatusKind(status) {
    if (status === "ready" || status === "connected") return "good";
    if (status === "setup_needed") return "warn";
    return "neutral";
}

function getRunSourceLabel(t, source) {
    return t(`workflow_agents.run_source_${String(source || "unknown").toLowerCase()}`) || String(source || "unknown");
}

function getRunStatusLabel(t, status) {
    return t(`workflow_agents.run_status_${String(status || "unknown").toLowerCase()}`) || String(status || "unknown");
}

function StatusPill({ label, kind = "neutral" }) {
    const className =
        kind === "good"
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
            : kind === "warn"
                ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200 border-amber-200 dark:border-amber-800/60"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>{label}</span>;
}

function TabButton({ active, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-2xl px-3.5 py-2 text-sm font-semibold transition ${
                active
                    ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
        >
            {label}
        </button>
    );
}

function EditorSection({ title, description, children, className = "" }) {
    return (
        <section className={`rounded-[24px] border border-gray-200 bg-gray-50/75 p-4 dark:border-gray-800 dark:bg-gray-950/40 ${className}`}>
            <div className="mb-3">
                <h5 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h5>
                {description ? <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{description}</p> : null}
            </div>
            {children}
        </section>
    );
}

export default function WorkflowAgentsPanel({ locations = [], onUnauthorized, token }) {
    const languageContext = useLanguage();
    const t = typeof languageContext?.t === "function" ? languageContext.t : ((key) => key);
    const documentInputRef = useRef(null);
    const [selectedLocationId, setSelectedLocationId] = useState("");
    const [workspace, setWorkspace] = useState(null);
    const [viewMode, setViewMode] = useState("list");
    const [createDialogMode, setCreateDialogMode] = useState(null);
    const [agentDraftMode, setAgentDraftMode] = useState(null);
    const [editingAgentId, setEditingAgentId] = useState(null);
    const [activeTab, setActiveTab] = useState("general");
    const [form, setForm] = useState(buildEmptyForm());
    const [agentQuery, setAgentQuery] = useState("");
    const [testMessage, setTestMessage] = useState("");
    const [testResult, setTestResult] = useState(null);
    const [testConversation, setTestConversation] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [resettingMemory, setResettingMemory] = useState(false);
    const [uploadingDocuments, setUploadingDocuments] = useState(false);
    const [availableModels, setAvailableModels] = useState([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [actionRuleModal, setActionRuleModal] = useState(null);
    const [actionRuleDrafts, setActionRuleDrafts] = useState([]);
    const [showOpenAiKeyModal, setShowOpenAiKeyModal] = useState(false);
    const agentPresets = useMemo(() => buildWorkflowAgentPresets(t), [t]);

    useEffect(() => {
        if (!selectedLocationId && locations.length > 0) {
            setSelectedLocationId(String(locations[0]?.location_id || ""));
        }
    }, [locations, selectedLocationId]);

    const authFetch = async (endpoint, options = {}) => {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            }
        });
        if (res.status === 401) {
            onUnauthorized?.();
            throw new Error(t("agency.session_expired"));
        }
        return res;
    };

    const parseResponse = async (res) => {
        const rawText = await res.text();
        if (!rawText) return null;
        try {
            return JSON.parse(rawText);
        } catch (_) {
            return { rawText };
        }
    };

    const authFileFetch = async (endpoint, options = {}) => {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            }
        });
        if (res.status === 401) {
            onUnauthorized?.();
            throw new Error(t("agency.session_expired"));
        }
        return res;
    };

    const loadAvailableModels = async (locationId, workspaceSnapshot = null) => {
        const safeLocationId = String(locationId || "").trim();
        const snapshot = workspaceSnapshot || workspace;
        const snapshotCredentials = snapshot?.credentials || {};
        const snapshotSlots = Array.isArray(snapshot?.slots) ? snapshot.slots : [];
        const snapshotHasLocationKey = snapshotCredentials?.has_location_openai_key === true;
        const snapshotHasAgencyKey = snapshotCredentials?.has_agency_openai_key === true;
        const snapshotHasSlotKey = snapshotCredentials?.has_any_slot_openai_key === true ||
            (!snapshotHasLocationKey && snapshotSlots.some((slot) => slot?.has_openai_api_key === true));
        const hasAnyOpenAiKey = snapshotHasLocationKey || snapshotHasAgencyKey || snapshotHasSlotKey;

        if (!safeLocationId || !hasAnyOpenAiKey) {
            setAvailableModels([]);
            return [];
        }

        setLoadingModels(true);
        try {
            const res = await authFetch(`/agency/workflow-agents/models?locationId=${encodeURIComponent(safeLocationId)}`);
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) throw new Error(data?.error || t("workflow_agents.models_load_error"));

            const nextModels = Array.isArray(data?.models)
                ? data.models.map((value) => String(value || "").trim()).filter(Boolean)
                : [];
            const nextDefaultModel = String(data?.defaultModel || "").trim();

            setAvailableModels(nextModels);
            setForm((prev) => {
                if (prev.model) return prev;
                const preferredModel = nextModels.includes(nextDefaultModel)
                    ? nextDefaultModel
                    : (nextModels[0] || "");
                return preferredModel ? { ...prev, model: preferredModel } : prev;
            });
            return nextModels;
        } catch (error) {
            setAvailableModels([]);
            toast.error(t("workflow_agents.models_load_error"), { description: error.message });
            return [];
        } finally {
            setLoadingModels(false);
        }
    };

    const applyAgentToForm = (agent, workspaceSnapshot = workspace, options = {}) => {
        const catalog = Array.isArray(workspaceSnapshot?.integration_catalog) ? workspaceSnapshot.integration_catalog : [];
        if (!agent) {
            setEditingAgentId(null);
            setAgentDraftMode(options.openEditor === true ? "blank" : null);
            setForm(buildEmptyForm(catalog));
            setTestMessage("");
            setTestResult(null);
            setTestConversation([]);
            setActiveTab("general");
            setViewMode(options.openEditor === true ? "editor" : "list");
            return;
        }

        setEditingAgentId(agent.id);
        setAgentDraftMode(null);
        setForm(buildFormFromAgent(agent, catalog));
        setTestMessage("");
        setTestResult(null);
        setTestConversation([]);
        setActiveTab("general");
        setViewMode("editor");
    };

    const openAgentCreationDialog = () => {
        setCreateDialogMode("choice");
    };

    const closeAgentCreationDialog = () => {
        setCreateDialogMode(null);
    };

    const startBlankAgent = () => {
        closeAgentCreationDialog();
        applyAgentToForm(null, workspace, { openEditor: true });
    };

    const startPresetAgent = (preset) => {
        if (!preset) return;
        const currentCatalog = Array.isArray(workspace?.integration_catalog) ? workspace.integration_catalog : [];
        const currentWorkspaceMode = getWorkspacePresetMode(workspace, currentCatalog);
        const resolvedPreset = {
            ...preset,
            integrationMode: resolvePresetIntegrationMode(preset, currentWorkspaceMode)
        };
        setEditingAgentId(null);
        setAgentDraftMode("preset");
        setForm(buildPresetForm(buildEmptyForm(currentCatalog), resolvedPreset));
        setTestMessage("");
        setTestResult(null);
        setTestConversation([]);
        setActiveTab("general");
        setViewMode("editor");
        closeAgentCreationDialog();
    };

    const loadWorkspace = async (locationId) => {
        const safeLocationId = String(locationId || "").trim();
        if (!safeLocationId) return null;

        setLoading(true);
        try {
            const res = await authFetch(`/agency/workflow-agents?locationId=${encodeURIComponent(safeLocationId)}`);
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) throw new Error(data?.error || t("workflow_agents.load_error"));
            setWorkspace(data);
            await loadAvailableModels(safeLocationId, data);
            return data;
        } catch (error) {
            toast.error(t("workflow_agents.load_error"), { description: error.message });
            return null;
        } finally {
            setLoading(false);
        }
    };

    const handleSaveOpenAiKey = async (openAiApiKey) => {
        const safeLocationId = String(selectedLocationId || "").trim();
        if (!safeLocationId) throw new Error(t("workflow_agents.location_required") || "Selecciona una cuenta.");

        const res = await authFetch(`/agency/settings/${encodeURIComponent(safeLocationId)}`, {
            method: "PUT",
            body: JSON.stringify({ openai_api_key: openAiApiKey })
        });
        const data = await parseResponse(res);
        if (!res.ok || data?.success === false) {
            throw new Error(data?.error || t("workflow_agents.location_key_save_error") || "No se pudo guardar la OpenAI key de la subcuenta");
        }

        toast.success(t("workflow_agents.location_key_saved") || "OpenAI key guardada en la subcuenta");
        await loadWorkspace(safeLocationId);
    };

    useEffect(() => {
        if (selectedLocationId) {
            setViewMode("list");
            setEditingAgentId(null);
            setForm(buildEmptyForm());
            setAvailableModels([]);
            setTestMessage("");
            setTestResult(null);
            setTestConversation([]);
            setActiveTab("general");
            setCreateDialogMode(null);
            setAgentDraftMode(null);
            loadWorkspace(selectedLocationId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLocationId]);

    const handleSave = async (event) => {
        event.preventDefault();
        if (!selectedLocationId) return;
        if (!hasAnyOpenAiKey && form.status === "active") {
            toast.error(t("workflow_agents.active_requires_openai_key") || "Carga una OpenAI API key antes de activar el agente.");
            setShowOpenAiKeyModal(true);
            return;
        }

        setSaving(true);
        try {
            const normalizedForm = moveObjectiveSentenceFromBusinessContext(form);
            const hasGhlEnabled = normalizedForm.integrations?.ghl?.enabled === true;
            const integrationAwarePermissions = applyIntegrationPermissionCaps(
                normalizedForm.permissions,
                hasGhlEnabled ? "both" : "inbox"
            );
            const payload = {
                locationId: selectedLocationId,
                name: normalizedForm.name,
                agent_key: normalizedForm.agent_key,
                status: normalizedForm.status,
                credential_mode: "location",
                slot_ids: [],
                model: normalizedForm.model,
                temperature: Number.parseFloat(normalizedForm.temperature || "0.4"),
                max_output_chars: Number.parseInt(normalizedForm.max_output_chars || "600", 10),
                system_prompt: normalizedForm.system_prompt,
                fallback_reply: normalizedForm.fallback_reply,
                description: normalizedForm.description,
                use_contact_context: normalizedForm.use_contact_context,
                config: {
                    behavior: normalizedForm.behavior,
                    permissions: integrationAwarePermissions,
                    action_rules: {
                        add_tags: normalizeActionRuleDrafts(normalizedForm.action_rules?.add_tags || []),
                        remove_tags: normalizeActionRuleDrafts(normalizedForm.action_rules?.remove_tags || [])
                    },
                    calendar_scope: {
                        mode: hasGhlEnabled && normalizedForm.calendar_scope_mode === "selected" ? "selected" : "all",
                        calendar_ids: hasGhlEnabled && normalizedForm.calendar_scope_mode === "selected"
                            ? normalizedForm.calendar_scope_ids.map((value) => String(value))
                            : []
                    }
                },
                integrations: normalizedForm.integrations
            };

            const endpoint = editingAgentId ? `/agency/workflow-agents/${editingAgentId}` : "/agency/workflow-agents";
            const method = editingAgentId ? "PUT" : "POST";

            const res = await authFetch(endpoint, { method, body: JSON.stringify(payload) });
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) throw new Error(data?.error || t("workflow_agents.save_error"));
            const wasCreatingAgent = !editingAgentId;
            toast.success(t("workflow_agents.saved_success"));
            const nextWorkspace = await loadWorkspace(selectedLocationId);
            if (wasCreatingAgent) {
                applyAgentToForm(null, nextWorkspace);
                return;
            }
            if (data.agent) {
                applyAgentToForm(
                    { ...data.agent, integrations: data.agent.integrations || normalizedForm.integrations },
                    { ...(nextWorkspace || workspace || {}), integration_catalog: nextWorkspace?.integration_catalog || workspace?.integration_catalog || [] },
                    { openEditor: true }
                );
            }
        } catch (error) {
            toast.error(t("workflow_agents.save_error"), { description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (agent) => {
        if (!agent?.id || !selectedLocationId || !window.confirm(t("workflow_agents.delete_confirm"))) return;
        try {
            const res = await authFetch(`/agency/workflow-agents/${agent.id}?locationId=${encodeURIComponent(selectedLocationId)}`, { method: "DELETE" });
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) throw new Error(data?.error || t("workflow_agents.delete_error"));
            toast.success(t("workflow_agents.deleted_success"));
            applyAgentToForm(null);
            await loadWorkspace(selectedLocationId);
        } catch (error) {
            toast.error(t("workflow_agents.delete_error"), { description: error.message });
        }
    };

    const handleToggleAgentStatusFromList = async (agent, event) => {
        event?.stopPropagation();
        if (!agent?.id || !selectedLocationId || saving) return;

        const nextStatus = agent.status === "active" ? "paused" : "active";
        if (nextStatus === "active" && !hasAnyOpenAiKey) {
            toast.error(t("workflow_agents.active_requires_openai_key") || "Carga una OpenAI API key antes de activar el agente.");
            setShowOpenAiKeyModal(true);
            return;
        }

        setSaving(true);
        try {
            const res = await authFetch(`/agency/workflow-agents/${agent.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    locationId: selectedLocationId,
                    status: nextStatus
                })
            });
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) throw new Error(data?.error || t("workflow_agents.save_error"));
            toast.success(nextStatus === "active" ? t("workflow_agents.status_active") : t("workflow_agents.status_paused"));
            const nextWorkspace = await loadWorkspace(selectedLocationId);
            if (editingAgentId === agent.id && data.agent) {
                applyAgentToForm(
                    { ...data.agent, integrations: data.agent.integrations || agent.integrations },
                    { ...(nextWorkspace || workspace || {}), integration_catalog: nextWorkspace?.integration_catalog || workspace?.integration_catalog || [] },
                    { openEditor: true }
                );
            }
        } catch (error) {
            toast.error(t("workflow_agents.save_error"), { description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleRunTest = async () => {
        if (!editingAgentId || !selectedLocationId) return;
        const nextMessage = String(testMessage || "").trim() || t("workflow_agents.test_placeholder");

        setTesting(true);
        try {
            const res = await authFetch(`/agency/workflow-agents/${editingAgentId}/test`, {
                method: "POST",
                body: JSON.stringify({
                    locationId: selectedLocationId,
                    message: nextMessage,
                    extraContext: form.description || "",
                    channel: "manual_test"
                })
            });
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) {
                setTestResult(data?.result || null);
                throw new Error(data?.error || t("workflow_agents.test_error"));
            }
            setTestResult(data.result || null);
            setTestConversation((prev) => [
                ...prev,
                { role: "user", text: nextMessage },
                { role: "assistant", text: data?.result?.reply_text || "-" }
            ]);
            setTestMessage("");
            toast.success(t("workflow_agents.test_success"));
            await loadWorkspace(selectedLocationId);
        } catch (error) {
            const rawMessage = String(error?.message || "").trim();
            const missingKeyMessage = rawMessage.includes("No hay OpenAI API key disponible")
                ? buildMissingCredentialMessage()
                : rawMessage;
            toast.error(t("workflow_agents.test_error"), { description: missingKeyMessage || t("workflow_agents.test_error") });
        } finally {
            setTesting(false);
        }
    };

    const handleResetTest = async () => {
        if (editingAgentId && selectedLocationId) {
            setResettingMemory(true);
            try {
                const res = await authFetch(`/agency/workflow-agents/${editingAgentId}/reset-memory`, {
                    method: "POST",
                    body: JSON.stringify({
                        locationId: selectedLocationId,
                        source: "manual_test"
                    })
                });
                const data = await parseResponse(res);
                if (!res.ok || !data?.success) {
                    throw new Error(data?.error || t("workflow_agents.memory_reset_error"));
                }
                toast.success(t("workflow_agents.memory_reset_success"));
            } catch (error) {
                toast.error(t("workflow_agents.memory_reset_error"), { description: error.message });
            } finally {
                setResettingMemory(false);
            }
        }
        setTestMessage("");
        setTestResult(null);
        setTestConversation([]);
    };

    const handleUploadDocuments = async (event) => {
        const fileList = Array.from(event?.target?.files || []);
        if (!editingAgentId || !selectedLocationId || fileList.length === 0) {
            if (event?.target) event.target.value = "";
            return;
        }

        const formData = new FormData();
        fileList.forEach((file) => formData.append("documents", file));

        setUploadingDocuments(true);
        try {
            const res = await authFileFetch(
                `/agency/workflow-agents/${editingAgentId}/documents?locationId=${encodeURIComponent(selectedLocationId)}`,
                {
                    method: "POST",
                    body: formData
                }
            );
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || t("workflow_agents.documents_upload_error"));
            }

            toast.success(
                t("workflow_agents.documents_upload_success").replace(
                    "{count}",
                    String(Array.isArray(data?.uploaded) ? data.uploaded.length : fileList.length)
                )
            );
            await loadWorkspace(selectedLocationId);
        } catch (error) {
            toast.error(t("workflow_agents.documents_upload_error"), { description: error.message });
        } finally {
            setUploadingDocuments(false);
            if (event?.target) event.target.value = "";
        }
    };

    const handleDeleteDocument = async (documentId) => {
        if (!editingAgentId || !selectedLocationId || !documentId) return;
        if (!window.confirm(t("workflow_agents.documents_delete_confirm"))) return;

        try {
            const res = await authFetch(
                `/agency/workflow-agents/${editingAgentId}/documents/${documentId}?locationId=${encodeURIComponent(selectedLocationId)}`,
                { method: "DELETE" }
            );
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || t("workflow_agents.documents_delete_error"));
            }
            toast.success(t("workflow_agents.documents_delete_success"));
            await loadWorkspace(selectedLocationId);
        } catch (error) {
            toast.error(t("workflow_agents.documents_delete_error"), { description: error.message });
        }
    };

    const catalog = Array.isArray(workspace?.integration_catalog) ? workspace.integration_catalog : [];
    const agents = Array.isArray(workspace?.agents) ? workspace.agents : [];
    const slots = Array.isArray(workspace?.slots) ? workspace.slots : [];
    const calendarsCatalog = Array.isArray(workspace?.crm_catalog?.calendars) ? workspace.crm_catalog.calendars : [];
    const openAiAccountLabel = resolveOpenAiAccountLabel({ workspace, selectedLocationId });
    const locationHasOpenAiKey = workspace?.credentials?.has_location_openai_key === true;
    const agencyHasOpenAiKey = workspace?.credentials?.has_agency_openai_key === true;
    const usingLegacySlotKeys = !locationHasOpenAiKey && slots.some((slot) => slot?.has_openai_api_key === true);
    const hasAnyOpenAiKey = locationHasOpenAiKey || agencyHasOpenAiKey || usingLegacySlotKeys;
    const baseModelOptions = useMemo(
        () => availableModels.map((modelId) => ({
            value: modelId,
            label: modelId
        })),
        [availableModels]
    );
    const modelOptions = useMemo(() => {
        if (!form.model || baseModelOptions.some((option) => option.value === form.model)) {
            return baseModelOptions;
        }
        return [
            {
                value: form.model,
                label: `${form.model} · ${t("workflow_agents.model_option_current")}`
            },
            ...baseModelOptions
        ];
    }, [baseModelOptions, form.model, t]);
    const selectedAgent = agents.find((agent) => agent.id === editingAgentId) || null;
    const selectedDocuments = Array.isArray(selectedAgent?.documents) ? selectedAgent.documents : [];
    const workspacePresetMode = getWorkspacePresetMode(workspace, catalog);
    const filteredAgentPresets = useMemo(
        () => agentPresets.filter((preset) => presetMatchesWorkspace(preset, workspacePresetMode)),
        [agentPresets, workspacePresetMode]
    );
    const isPresetDraft = !editingAgentId && agentDraftMode === "preset";
    const hasGhlEnabled = form.integrations?.ghl?.enabled === true;
    const hasInboxEnabled = form.integrations?.chatwoot?.enabled === true;
    const actionPermissionItems = [
        ["add_tags", t("workflow_agents.permission_add_tags"), t("workflow_agents.permission_add_tags_desc"), "tags"],
        ["remove_tags", t("workflow_agents.permission_remove_tags"), t("workflow_agents.permission_remove_tags_desc"), "tags"],
        ...(hasGhlEnabled || !hasInboxEnabled
            ? [
                ["view_appointments", t("workflow_agents.permission_view_appointments"), t("workflow_agents.permission_view_appointments_desc"), "toggle"],
                ["set_fields", t("workflow_agents.permission_set_fields"), t("workflow_agents.permission_set_fields_desc"), "toggle"],
                ["create_appointment", t("workflow_agents.permission_create_appointment"), t("workflow_agents.permission_create_appointment_desc"), "toggle"],
                ["reschedule_appointment", t("workflow_agents.permission_reschedule_appointment"), t("workflow_agents.permission_reschedule_appointment_desc"), "toggle"],
                ["cancel_appointment", t("workflow_agents.permission_cancel_appointment"), t("workflow_agents.permission_cancel_appointment_desc"), "toggle"]
            ]
            : [])
    ];

    const openActionRuleModal = (permissionKey) => {
        setActionRuleModal(permissionKey);
        setActionRuleDrafts(buildActionRuleDrafts(form.action_rules?.[permissionKey] || []));
    };

    const closeActionRuleModal = () => {
        setActionRuleModal(null);
        setActionRuleDrafts([]);
    };

    const saveActionRuleModal = () => {
        if (!actionRuleModal) return;
        const normalizedRules = normalizeActionRuleDrafts(actionRuleDrafts);
        if (normalizedRules.length === 0) {
            toast.error(t("workflow_agents.action_rules_required") || "Agrega al menos una regla con condición y tags.");
            return;
        }
        setForm((prev) => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [actionRuleModal]: true
            },
            action_rules: {
                ...(prev.action_rules || EMPTY_AGENT_ACTION_RULES),
                [actionRuleModal]: normalizedRules
            }
        }));
        closeActionRuleModal();
    };

    const disableTagAction = (permissionKey) => {
        setForm((prev) => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [permissionKey]: false
            },
            action_rules: {
                ...(prev.action_rules || EMPTY_AGENT_ACTION_RULES),
                [permissionKey]: []
            }
        }));
    };

    const buildMissingCredentialMessage = () => {
        if (locationHasOpenAiKey) {
            return t("workflow_agents.location_key_ready");
        }
        if (usingLegacySlotKeys) {
            return t("workflow_agents.test_error_legacy_slot_key");
        }
        if (agencyHasOpenAiKey) {
            return t("workflow_agents.test_error_agency_key_fallback");
        }
        return t("workflow_agents.test_error_missing_key");
    };

    const filteredAgents = useMemo(() => {
        const safeQuery = String(agentQuery || "").trim().toLowerCase();
        if (!safeQuery) return agents;
        return agents.filter((agent) => {
            const haystack = [
                agent?.name,
                agent?.model,
                ...(Array.isArray(agent?.enabled_integrations) ? agent.enabled_integrations : [])
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return haystack.includes(safeQuery);
        });
    }, [agentQuery, agents]);

    const renderAgentList = (isEditorMode = false) => (
        <section className={`${isEditorMode ? "xl:sticky xl:top-6" : ""} rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{t("workflow_agents.agent_list_title")}</h4>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.agent_list_desc")}</p>
                </div>
                <button
                    type="button"
                    onClick={openAgentCreationDialog}
                    className="rounded-2xl bg-indigo-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-indigo-500"
                >
                    {t("workflow_agents.new_agent")}
                </button>
            </div>

            <div className="relative mt-4">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    value={agentQuery}
                    onChange={(event) => setAgentQuery(event.target.value)}
                    placeholder={t("workflow_agents.search_placeholder")}
                    className={`${inputClassName} pl-11`}
                />
            </div>

            <div className="mt-4 space-y-2">
                {filteredAgents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        <div>{agents.length === 0 ? t("workflow_agents.no_agents") : t("workflow_agents.no_search_results")}</div>
                        {agents.length === 0 ? (
                            <button
                                type="button"
                                onClick={openAgentCreationDialog}
                                className="mt-4 inline-flex items-center rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500"
                            >
                                {t("workflow_agents.new_agent")}
                            </button>
                        ) : null}
                    </div>
                ) : null}

                {filteredAgents.map((agent) => {
                    const isActive = agent.status === "active";
                    return (
                    <div
                        key={agent.id}
                        className={`flex w-full items-start gap-3 rounded-[22px] border px-4 py-3.5 text-left transition ${
                            isEditorMode && editingAgentId === agent.id
                                ? "border-indigo-300 bg-indigo-50/80 shadow-sm dark:border-indigo-700 dark:bg-indigo-900/20"
                                : "border-gray-200 bg-white/80 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950/40 dark:hover:border-gray-600 dark:hover:bg-gray-800/60"
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => applyAgentToForm(agent)}
                            className="min-w-0 flex-1 text-left"
                        >
                            <div className="min-w-0 pr-2">
                                <div className="truncate font-bold text-gray-900 dark:text-white">{agent.name}</div>
                                <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{agent.model || "OpenAI"}</div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                <span className="rounded-full border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                                    {t("workflow_agents.account_scope_badge")}
                                </span>
                                {Number(agent.document_count || 0) > 0 ? (
                                    <span className="rounded-full border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                                        {t("workflow_agents.documents_count").replace("{count}", String(agent.document_count))}
                                    </span>
                                ) : null}
                            </div>
                        </button>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={isActive}
                            disabled={saving}
                            onClick={(event) => handleToggleAgentStatusFromList(agent, event)}
                            className={`mt-0.5 inline-flex h-8 w-14 shrink-0 items-center rounded-full border px-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                isActive
                                    ? "border-emerald-400/60 bg-emerald-500/20"
                                    : "border-gray-300 bg-gray-200 dark:border-gray-700 dark:bg-gray-800"
                            }`}
                            title={t(`workflow_agents.status_${agent.status}`)}
                        >
                            <span
                                className={`h-5 w-5 rounded-full shadow-sm transition ${
                                    isActive ? "translate-x-6 bg-emerald-400" : "translate-x-0 bg-gray-500 dark:bg-gray-400"
                                }`}
                            />
                        </button>
                    </div>
                    );
                })}
            </div>
        </section>
    );

    const renderChatPanel = () => (
        <section className="xl:sticky xl:top-6 overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3.5 dark:border-gray-800">
                <div>
                    <div className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400 dark:text-gray-500">
                        {t("workflow_agents.test_title")}
                    </div>
                    <div className="mt-1.5 text-sm font-bold text-gray-900 dark:text-white">
                        {editingAgentId ? (form.name || t("workflow_agents.edit_agent")) : t("workflow_agents.tab_test")}
                    </div>
                    <div className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-400">
                        {editingAgentId ? t("workflow_agents.test_desc") : t("workflow_agents.test_need_agent")}
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        disabled={!editingAgentId || !hasAnyOpenAiKey || testing}
                        onClick={handleRunTest}
                        className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {testing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        {t("workflow_agents.run_test")}
                    </button>
                    <button
                        type="button"
                        onClick={handleResetTest}
                        disabled={!editingAgentId || resettingMemory}
                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        {resettingMemory ? <Loader2 size={14} className="animate-spin" /> : null}
                        {t("workflow_agents.reset_chat")}
                    </button>
                </div>
            </div>

            <div className="space-y-3 p-4">
                <div className="rounded-[24px] border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-950/40">
                    <div className="mb-2.5 flex flex-wrap items-center gap-2">
                        <StatusPill
                            label={editingAgentId ? t(`workflow_agents.status_${form.status}`) : t("workflow_agents.status_draft")}
                            kind={form.status === "active" ? "good" : form.status === "paused" ? "warn" : "neutral"}
                        />
                        <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                            {t("workflow_agents.account_scope_badge")}
                        </span>
                        {Number(testResult?.memory_messages_used || 0) > 0 ? (
                            <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                                {t("workflow_agents.memory_badge").replace("{count}", String(testResult.memory_messages_used))}
                            </span>
                        ) : null}
                    </div>

                    <div className="wf-soft-scrollbar min-h-[240px] max-h-[42vh] space-y-3.5 overflow-auto pr-1">
                        {testConversation.length > 0 ? (
                            testConversation.map((entry, index) => (
                                <div key={`${entry.role}-${index}`} className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div
                                        className={`max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm ${
                                            entry.role === "user"
                                                ? "bg-indigo-600 text-white"
                                                : "border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                        }`}
                                    >
                                        {entry.text}
                                    </div>
                                </div>
                            ))
                        ) : null}

                        {testResult ? (
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <StatusPill label={getRunStatusLabel(t, testResult.status)} kind={testResult.status === "completed" ? "good" : "warn"} />
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{testResult.intent || "general"}</span>
                                </div>
                                {testResult.summary ? <div className="max-w-[88%] text-xs leading-5 text-gray-500 dark:text-gray-400">{testResult.summary}</div> : null}
                            </div>
                        ) : testConversation.length === 0 ? (
                            <div className="flex h-[200px] items-center justify-center rounded-[22px] border border-dashed border-gray-300 bg-white/70 px-5 text-center text-sm leading-6 text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
                                {t("workflow_agents.test_empty")}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-[24px] border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
                    <textarea
                        rows={3}
                        value={testMessage}
                        onChange={(event) => setTestMessage(event.target.value)}
                        placeholder={t("workflow_agents.test_placeholder")}
                        className={inputClassName}
                    />
                    <div className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">{t("workflow_agents.test_tip")}</div>
                </div>
            </div>
        </section>
    );

    const renderOpenAiKeyFooterCta = () => {
        if (hasAnyOpenAiKey) return null;

        return (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm dark:border-indigo-900/60 dark:bg-indigo-950/20">
                <div className="min-w-0 flex-1">
                    <div className="font-bold text-indigo-950 dark:text-indigo-100">
                        {t("workflow_agents.models_require_key_cta_title")}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-indigo-800/80 dark:text-indigo-200/80">
                        {t("workflow_agents.models_require_key_cta_desc")}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setShowOpenAiKeyModal(true)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-500"
                >
                    {t("workflow_agents.models_require_key_cta_button")}
                </button>
            </div>
        );
    };

    const renderAgentCreationDialog = () => {
        if (!createDialogMode) return null;

        const isPresetMode = createDialogMode === "presets";

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 px-4 py-6 backdrop-blur-sm">
                <div className="w-full max-w-4xl overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
                    <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                        <div className="min-w-0">
                            <div className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-500">
                                {t("workflow_agents.create_modal_kicker")}
                            </div>
                            <h4 className="mt-2 text-xl font-extrabold text-gray-900 dark:text-white">
                                {isPresetMode ? t("workflow_agents.preset_modal_title") : t("workflow_agents.create_modal_title")}
                            </h4>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
                                {isPresetMode ? t("workflow_agents.preset_modal_desc") : t("workflow_agents.create_modal_desc")}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closeAgentCreationDialog}
                            className="rounded-2xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                        >
                            {t("workflow_agents.create_modal_close")}
                        </button>
                    </div>

                    {isPresetMode ? (
                        <div className="p-5">
                            <button
                                type="button"
                                onClick={() => setCreateDialogMode("choice")}
                                className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-3.5 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                            >
                                <ChevronLeft size={16} />
                                {t("workflow_agents.preset_modal_back")}
                            </button>

                            {filteredAgentPresets.length > 0 ? (
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {filteredAgentPresets.map((preset) => (
                                        <button
                                            key={preset.key}
                                            type="button"
                                            onClick={() => startPresetAgent(preset)}
                                            className="group flex min-h-[210px] flex-col rounded-[26px] border border-gray-200 bg-gray-50/80 p-5 text-left transition hover:-translate-y-0.5 hover:border-indigo-400 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/10 dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-indigo-700 dark:hover:bg-gray-900"
                                        >
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950/50 dark:text-indigo-300">
                                                <Sparkles size={20} />
                                            </div>
                                            <div className="mt-5 text-lg font-extrabold text-gray-900 dark:text-white">
                                                {preset.title}
                                            </div>
                                            <p className="mt-2 flex-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                                                {preset.description}
                                            </p>
                                            <div className="mt-5 text-sm font-bold text-indigo-600 dark:text-indigo-300">
                                                {t("workflow_agents.preset_select")}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-3xl border border-dashed border-gray-300 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    {t("workflow_agents.preset_modal_empty")}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-4 p-5 md:grid-cols-2">
                            <button
                                type="button"
                                onClick={startBlankAgent}
                                className="group rounded-[28px] border border-gray-200 bg-gray-50/80 p-6 text-left transition hover:-translate-y-0.5 hover:border-indigo-400 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/10 dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-indigo-700 dark:hover:bg-gray-900"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-gray-800 dark:text-gray-300">
                                    <FileText size={20} />
                                </div>
                                <h5 className="mt-5 text-lg font-extrabold text-gray-900 dark:text-white">
                                    {t("workflow_agents.create_blank_title")}
                                </h5>
                                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                                    {t("workflow_agents.create_blank_desc")}
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setCreateDialogMode("presets")}
                                className="group rounded-[28px] border border-indigo-200 bg-indigo-50/70 p-6 text-left transition hover:-translate-y-0.5 hover:border-indigo-400 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/15 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:hover:border-indigo-700 dark:hover:bg-gray-900"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                                    <Sparkles size={20} />
                                </div>
                                <h5 className="mt-5 text-lg font-extrabold text-gray-900 dark:text-white">
                                    {t("workflow_agents.create_preset_title")}
                                </h5>
                                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                                    {t("workflow_agents.create_preset_desc")}
                                </p>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (!locations.length) {
        return (
            <div className="max-w-5xl mx-auto rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/25 dark:text-indigo-300">
                    <Building2 size={24} />
                </div>
                <h3 className="mt-5 text-xl font-extrabold text-gray-900 dark:text-white">
                    {t("workflow_agents.empty_locations_title")}
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500 dark:text-gray-400">
                    {t("workflow_agents.empty_locations_desc")}
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {renderAgentCreationDialog()}

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">{t("workflow_agents.title")}</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.subtitle")}</p>
                </div>
                <div className="w-full max-w-md">
                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.location_label")}</label>
                    <select
                        value={selectedLocationId}
                        onChange={(event) => {
                            setSelectedLocationId(event.target.value);
                            applyAgentToForm(null, null);
                        }}
                        className={inputClassName}
                    >
                        {locations.map((location) => (
                            <option key={location.location_id} value={location.location_id}>
                                {location.name || location.location_id}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {viewMode === "list" ? (
                renderAgentList(false)
            ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr),340px] xl:items-start">
                    <section className="overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h4 className="truncate text-xl font-bold text-gray-900 dark:text-white">
                                    {editingAgentId ? (form.name || t("workflow_agents.edit_agent")) : t("workflow_agents.new_agent")}
                                </h4>
                                <StatusPill
                                    label={t(`workflow_agents.status_${form.status}`)}
                                    kind={form.status === "active" ? "good" : form.status === "paused" ? "warn" : "neutral"}
                                />
                            </div>
                            <p className="mt-1 max-w-xl text-sm leading-6 text-gray-500 dark:text-gray-400">{t("workflow_agents.form_desc")}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                                    {t("workflow_agents.account_scope_badge")}
                                </span>
                                <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                                    {t("workflow_agents.documents_count").replace("{count}", String(selectedDocuments.length))}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => applyAgentToForm(null)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                <ChevronLeft size={16} />
                                {t("workflow_agents.back_to_list")}
                            </button>
                            <button
                                type="button"
                                onClick={() => loadWorkspace(selectedLocationId)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                                {t("workflow_agents.refresh")}
                            </button>
                            {editingAgentId ? (
                                <button
                                    type="button"
                                    onClick={() => handleDelete(selectedAgent)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
                                >
                                    <Trash2 size={15} />
                                    {t("workflow_agents.delete_button")}
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {!isPresetDraft ? (
                    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                        <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/60">
                            <TabButton active={activeTab === "general"} label={t("workflow_agents.tab_general")} onClick={() => setActiveTab("general")} />
                            <TabButton active={activeTab === "documents"} label={t("workflow_agents.tab_documents")} onClick={() => setActiveTab("documents")} />
                        </div>
                    </div>
                    ) : null}

                    <div className="p-6">
                        {activeTab === "general" && (
                            <form onSubmit={handleSave} className="space-y-5">
                                <>
                                <EditorSection title={t("workflow_agents.section_identity_title")} description={t("workflow_agents.section_identity_desc")}>
                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),220px]">
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_name")}</label>
                                            <input
                                                name="workflow-agent-display-name"
                                                autoComplete="off"
                                                data-form-type="other"
                                                value={form.name}
                                                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                                                className={inputClassName}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_status")}</label>
                                            <div className="flex h-[50px] items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                                {t(`workflow_agents.status_${form.status}`)}
                                            </div>
                                        </div>
                                    </div>
                                </EditorSection>

                                <EditorSection title={t("workflow_agents.section_response_title")} description={t("workflow_agents.section_response_desc")}>
                                    <div className="grid gap-4 lg:grid-cols-3">
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_model")}</label>
                                            <select
                                                value={form.model || ""}
                                                onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                                                className={inputClassName}
                                                disabled={loadingModels || modelOptions.length === 0}
                                            >
                                                {loadingModels ? (
                                                    <option value={form.model || ""}>{t("workflow_agents.models_loading")}</option>
                                                ) : modelOptions.length > 0 ? (
                                                    modelOptions.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))
                                                ) : (
                                                    <option value="">{hasAnyOpenAiKey ? t("workflow_agents.models_empty") : t("workflow_agents.models_require_key")}</option>
                                                )}
                                            </select>
                                            <div className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                {loadingModels
                                                    ? t("workflow_agents.models_loading_help")
                                                    : hasAnyOpenAiKey
                                                        ? t("workflow_agents.field_model_help")
                                                        : t("workflow_agents.models_require_key_help")}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_temperature")}</label>
                                            <input type="number" min="0" max="1" step="0.1" value={form.temperature} onChange={(event) => setForm((prev) => ({ ...prev, temperature: event.target.value }))} className={inputClassName} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_max_chars")}</label>
                                            <input type="number" min="120" max="4000" step="10" value={form.max_output_chars} onChange={(event) => setForm((prev) => ({ ...prev, max_output_chars: event.target.value }))} className={inputClassName} />
                                        </div>
                                    </div>
                                    <label className="mt-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                                        <input type="checkbox" checked={form.use_contact_context} onChange={(event) => setForm((prev) => ({ ...prev, use_contact_context: event.target.checked }))} className="h-4 w-4 rounded text-indigo-600" />
                                        {t("workflow_agents.field_use_contact_context")}
                                    </label>
                                </EditorSection>
                                </>

                                <EditorSection title={t("workflow_agents.section_business_title")} description={t("workflow_agents.section_business_desc")}>
                                    <textarea
                                        rows={9}
                                        value={form.system_prompt}
                                        onChange={(event) => setForm((prev) => ({ ...prev, system_prompt: event.target.value }))}
                                        placeholder={t("workflow_agents.field_business_context_placeholder")}
                                        className={textAreaCardClassName}
                                    />
                                    <div className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                        {t("workflow_agents.field_business_context_help")}
                                    </div>
                                </EditorSection>

                                <>
                                <EditorSection title={t("workflow_agents.section_behavior_title")} description={t("workflow_agents.section_behavior_desc")}>
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_behavior_role")}</label>
                                            <textarea
                                                rows={6}
                                                value={form.behavior.role}
                                                onChange={(event) => setForm((prev) => ({
                                                    ...prev,
                                                    behavior: { ...prev.behavior, role: event.target.value }
                                                }))}
                                                placeholder={t("workflow_agents.field_behavior_role_placeholder")}
                                                className={textAreaCardClassName}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_behavior_tone")}</label>
                                            <textarea
                                                rows={6}
                                                value={form.behavior.tone}
                                                onChange={(event) => setForm((prev) => ({
                                                    ...prev,
                                                    behavior: { ...prev.behavior, tone: event.target.value }
                                                }))}
                                                placeholder={t("workflow_agents.field_behavior_tone_placeholder")}
                                                className={textAreaCardClassName}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_behavior_objective")}</label>
                                        <textarea
                                            rows={5}
                                            value={form.behavior.objective}
                                            onChange={(event) => setForm((prev) => ({
                                                ...prev,
                                                behavior: { ...prev.behavior, objective: event.target.value }
                                            }))}
                                            placeholder={t("workflow_agents.field_behavior_objective_placeholder")}
                                            className={textAreaCardClassName}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_behavior_guardrails")}</label>
                                        <textarea
                                            rows={7}
                                            value={form.behavior.guardrails}
                                            onChange={(event) => setForm((prev) => ({
                                                ...prev,
                                                behavior: { ...prev.behavior, guardrails: event.target.value }
                                            }))}
                                            placeholder={t("workflow_agents.field_behavior_guardrails_placeholder")}
                                            className={textAreaCardClassName}
                                        />
                                    </div>
                                </EditorSection>

                                    <EditorSection title={t("workflow_agents.section_permissions_title")} description={t("workflow_agents.section_permissions_desc")}>
                                        <div className="grid gap-3 lg:grid-cols-2">
                                            {actionPermissionItems.map(([permissionKey, labelText, descText, actionKind]) => {
                                                const enabled = form.permissions[permissionKey] === true;
                                                const isTagAction = actionKind === "tags";
                                                const ruleCount = actionKind === "tags" ? countActionRules(form.action_rules, permissionKey) : 0;
                                                return (
                                                    <div
                                                        key={permissionKey}
                                                        role={isTagAction ? "button" : undefined}
                                                        tabIndex={isTagAction ? 0 : undefined}
                                                        onClick={isTagAction ? () => openActionRuleModal(permissionKey) : undefined}
                                                        onKeyDown={isTagAction ? (event) => {
                                                            if (event.key === "Enter" || event.key === " ") {
                                                                event.preventDefault();
                                                                openActionRuleModal(permissionKey);
                                                            }
                                                        } : undefined}
                                                        className={`${isTagAction ? "cursor-pointer" : ""} rounded-2xl border px-4 py-4 transition ${
                                                            enabled
                                                                ? "border-indigo-400 bg-indigo-50/80 dark:border-indigo-700 dark:bg-indigo-900/20"
                                                                : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800/80"
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-gray-900 dark:text-white">{labelText}</div>
                                                                <div className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{descText}</div>
                                                                {actionKind === "tags" ? (
                                                                    <div className="mt-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                                                        {ruleCount > 0
                                                                            ? (t("workflow_agents.action_rules_count") || "{count} regla(s)").replace("{count}", String(ruleCount))
                                                                            : t("workflow_agents.action_rules_empty") || "Sin reglas configuradas"}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                                                enabled
                                                                    ? "bg-indigo-600 text-white"
                                                                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300"
                                                            }`}>
                                                                {enabled ? t("workflow_agents.action_enabled") : t("workflow_agents.action_disabled")}
                                                            </span>
                                                        </div>
                                                {actionKind === "tags" ? (
                                                    enabled ? (
                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    disableTagAction(permissionKey);
                                                                }}
                                                                className="rounded-2xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                                            >
                                                                {t("workflow_agents.action_rules_disable") || "Desactivar"}
                                                            </button>
                                                        </div>
                                                    ) : null
                                                ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setForm((prev) => ({
                                                                    ...prev,
                                                                    permissions: {
                                                                        ...prev.permissions,
                                                                        [permissionKey]: !enabled
                                                                    }
                                                                }))}
                                                                className="mt-4 rounded-2xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                            >
                                                                {enabled ? t("workflow_agents.action_rules_disable") || "Desactivar" : t("workflow_agents.action_enabled") || "Activar"}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {(hasGhlEnabled || !hasInboxEnabled) ? (
                                        <>
                                        <div className="mt-5">
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_calendar_scope")}</label>
                                            <select
                                                value={form.calendar_scope_mode}
                                                onChange={(event) => setForm((prev) => ({
                                                    ...prev,
                                                    calendar_scope_mode: event.target.value,
                                                    calendar_scope_ids: event.target.value === "selected" ? prev.calendar_scope_ids : []
                                                }))}
                                                className={inputClassName}
                                            >
                                                <option value="all">{t("workflow_agents.calendar_scope_all")}</option>
                                                <option value="selected">{t("workflow_agents.calendar_scope_selected")}</option>
                                            </select>
                                            <div className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                {t("workflow_agents.field_calendar_scope_help")}
                                            </div>
                                        </div>

                                        {form.calendar_scope_mode === "selected" ? (
                                            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                                                {calendarsCatalog.length === 0 ? (
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {t("workflow_agents.no_calendars_available")}
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-3 lg:grid-cols-2">
                                                        {calendarsCatalog.map((calendar) => {
                                                            const calendarValue = String(calendar.id || calendar.name || "");
                                                            if (!calendarValue) return null;
                                                            const isChecked = form.calendar_scope_ids.includes(calendarValue);
                                                            return (
                                                                <label key={calendarValue} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-200">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={(event) => setForm((prev) => ({
                                                                            ...prev,
                                                                            calendar_scope_ids: event.target.checked
                                                                                ? [...prev.calendar_scope_ids, calendarValue]
                                                                                : prev.calendar_scope_ids.filter((value) => value !== calendarValue)
                                                                        }))}
                                                                        className="h-4 w-4 rounded text-indigo-600"
                                                                    />
                                                                    <span className="min-w-0">
                                                                        <span className="block font-semibold text-gray-900 dark:text-white">{calendar.name || calendar.id}</span>
                                                                        {calendar.id ? <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{calendar.id}</span> : null}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                        </>
                                        ) : null}
                                    </EditorSection>
                                    </>

                                <div className="space-y-3 rounded-[26px] border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
                                    {renderOpenAiKeyFooterCta()}
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {editingAgentId ? t("workflow_agents.edit_agent") : t("workflow_agents.new_agent")}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <button type="button" onClick={() => applyAgentToForm(null)} className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                                                {t("workflow_agents.cancel_edit")}
                                            </button>
                                            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70">
                                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                {editingAgentId ? t("workflow_agents.save_update") : t("workflow_agents.save_create")}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        )}

                        {activeTab === "documents" && (
                            <div className="space-y-5">
                                <EditorSection title={t("workflow_agents.documents_title")} description={t("workflow_agents.documents_desc")}>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{t("workflow_agents.documents_formats")}</div>
                                </EditorSection>

                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-gray-200 bg-gray-50/75 px-5 py-4 dark:border-gray-800 dark:bg-gray-950/40">
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {selectedDocuments.length > 0
                                            ? t("workflow_agents.documents_count").replace("{count}", String(selectedDocuments.length))
                                            : t("workflow_agents.documents_empty")}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            ref={documentInputRef}
                                            type="file"
                                            accept=".pdf,.txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.log,application/pdf,text/plain,text/markdown,text/csv,application/json,text/html,text/xml"
                                            multiple
                                            onChange={handleUploadDocuments}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            disabled={!editingAgentId || uploadingDocuments}
                                            onClick={() => documentInputRef.current?.click()}
                                            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {uploadingDocuments ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                                            {uploadingDocuments ? t("workflow_agents.documents_uploading") : t("workflow_agents.documents_upload")}
                                        </button>
                                    </div>
                                </div>

                                {selectedDocuments.length === 0 ? (
                                    <div className="rounded-[26px] border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                        {t("workflow_agents.documents_empty")}
                                    </div>
                                ) : null}

                                <div className="space-y-3">
                                    {selectedDocuments.map((document) => (
                                        <div key={document.id} className="rounded-[26px] border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <FileText size={16} className="text-indigo-500" />
                                                        <div className="truncate font-semibold text-gray-900 dark:text-white">{document.original_name}</div>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                                        <span>{formatFileSize(document.file_size)}</span>
                                                        <span>{t("workflow_agents.documents_chunks").replace("{count}", String(document.chunk_count || 0))}</span>
                                                        <span>{formatRunTimestamp(document.created_at)}</span>
                                                    </div>
                                                    {document.excerpt ? (
                                                        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{document.excerpt}</p>
                                                    ) : null}
                                                </div>
                                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                    <StatusPill label={t("workflow_agents.documents_ready")} kind="good" />
                                                    {document.download_url ? (
                                                        <a
                                                            href={document.download_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                        >
                                                            {t("workflow_agents.documents_open")}
                                                        </a>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteDocument(document.id)}
                                                        className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/20"
                                                    >
                                                        {t("workflow_agents.documents_delete")}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                    </section>
                    {renderChatPanel()}
                </div>
            )}
            {actionRuleModal ? (
                <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
                        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                {actionRuleModal === "add_tags"
                                    ? t("workflow_agents.action_rules_add_title") || "Reglas para agregar tags"
                                    : t("workflow_agents.action_rules_remove_title") || "Reglas para quitar tags"}
                            </h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {t("workflow_agents.action_rules_modal_desc") || "Define cuándo el agente puede ejecutar esta acción. Puedes cargar varios tags separados por coma."}
                            </p>
                        </div>
                        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
                            {actionRuleDrafts.map((rule, index) => (
                                <div key={index} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-950/40">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                                            {(t("workflow_agents.action_rule_item_title") || "Regla {index}").replace("{index}", String(index + 1))}
                                        </div>
                                        {actionRuleDrafts.length > 1 ? (
                                            <button
                                                type="button"
                                                onClick={() => setActionRuleDrafts((prev) => prev.filter((_, ruleIndex) => ruleIndex !== index))}
                                                className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/20"
                                            >
                                                {t("workflow_agents.action_rule_remove") || "Eliminar"}
                                            </button>
                                        ) : null}
                                    </div>
                                    <label className="mb-2 block text-xs font-bold text-gray-600 dark:text-gray-300">
                                        {t("workflow_agents.action_rule_condition") || "Cuando el cliente diga o demuestre"}
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={rule.condition}
                                        onChange={(event) => setActionRuleDrafts((prev) => prev.map((item, ruleIndex) => ruleIndex === index ? { ...item, condition: event.target.value } : item))}
                                        placeholder={t("workflow_agents.action_rule_condition_placeholder") || "Ej. El cliente pide precio, plan o inscripción del curso"}
                                        className={textAreaCardClassName}
                                    />
                                    <label className="mb-2 mt-3 block text-xs font-bold text-gray-600 dark:text-gray-300">
                                        {t("workflow_agents.action_rule_tags") || "Tags a aplicar"}
                                    </label>
                                    <input
                                        value={rule.tagsText}
                                        onChange={(event) => setActionRuleDrafts((prev) => prev.map((item, ruleIndex) => ruleIndex === index ? { ...item, tagsText: event.target.value } : item))}
                                        placeholder={t("workflow_agents.action_rule_tags_placeholder") || "interesado, precio_solicitado"}
                                        className={inputClassName}
                                    />
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => setActionRuleDrafts((prev) => [...prev, { condition: "", tagsText: "" }])}
                                className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                {t("workflow_agents.action_rule_add") || "Agregar regla"}
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
                            <button type="button" onClick={closeActionRuleModal} className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                                {t("common.close") || "Cerrar"}
                            </button>
                            <button type="button" onClick={saveActionRuleModal} className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-500">
                                {t("workflow_agents.action_rules_save") || "Guardar reglas"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {showOpenAiKeyModal ? (
                <OpenAiKeySetupModal
                    accountLabel={openAiAccountLabel}
                    alreadyConfigured={locationHasOpenAiKey}
                    onClose={() => setShowOpenAiKeyModal(false)}
                    onSave={handleSaveOpenAiKey}
                    t={t}
                />
            ) : null}
        </div>
    );
}
