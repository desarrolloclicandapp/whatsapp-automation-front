import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, Play, RefreshCw, Save, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../context/LanguageContext";

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");
const inputClassName = "w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
const BASE_AGENT_MODEL_OPTIONS = [
    { value: "gpt-4o-mini", labelKey: "workflow_agents.model_option_gpt4o_mini" },
    { value: "gpt-4o", labelKey: "workflow_agents.model_option_gpt4o" },
    { value: "gpt-4.1-mini", labelKey: "workflow_agents.model_option_gpt41_mini" },
    { value: "gpt-4.1", labelKey: "workflow_agents.model_option_gpt41" }
];

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

function buildEmptyForm(catalog = []) {
    return {
        name: "",
        agent_key: "",
        status: "active",
        credential_mode: "location",
        slot_ids: [],
        manual_api_key: "",
        manual_api_key_configured: false,
        clear_manual_api_key: false,
        model: "gpt-4o-mini",
        temperature: "0.4",
        max_output_chars: "600",
        system_prompt: "",
        fallback_reply: "",
        description: "",
        use_contact_context: true,
        integrations: buildDefaultIntegrations(catalog)
    };
}

function buildFormFromAgent(agent, catalog = []) {
    const integrations = buildDefaultIntegrations(catalog);
    for (const item of catalog) {
        const binding = agent?.integrations?.[item.key];
        if (!binding) continue;
        integrations[item.key] = {
            enabled: binding.enabled === true,
            config: binding.config || {}
        };
    }

    return {
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
        integrations
    };
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
    const [locationKeyDraft, setLocationKeyDraft] = useState("");
    const [savingLocationKey, setSavingLocationKey] = useState(false);

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

    const applyAgentToForm = (agent, workspaceSnapshot = workspace, options = {}) => {
        const catalog = Array.isArray(workspaceSnapshot?.integration_catalog) ? workspaceSnapshot.integration_catalog : [];
        if (!agent) {
            setEditingAgentId(null);
            setForm(buildEmptyForm(catalog));
            setTestMessage("");
            setTestResult(null);
            setTestConversation([]);
            setActiveTab("general");
            setViewMode(options.openEditor === true ? "editor" : "list");
            return;
        }

        setEditingAgentId(agent.id);
        setForm(buildFormFromAgent(agent, catalog));
        setTestMessage("");
        setTestResult(null);
        setTestConversation([]);
        setActiveTab("general");
        setViewMode("editor");
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
            return data;
        } catch (error) {
            toast.error(t("workflow_agents.load_error"), { description: error.message });
            return null;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedLocationId) {
            setViewMode("list");
            setEditingAgentId(null);
            setForm(buildEmptyForm());
            setTestMessage("");
            setTestResult(null);
            setTestConversation([]);
            setActiveTab("general");
            setLocationKeyDraft("");
            loadWorkspace(selectedLocationId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLocationId]);

    const saveLocationOpenAiKey = async (rawValue) => {
        if (!selectedLocationId) return false;
        const safeValue = String(rawValue || "").trim();
        if (!safeValue) {
            toast.error(t("workflow_agents.location_key_invalid"));
            return false;
        }

        setSavingLocationKey(true);
        try {
            const res = await authFetch(`/agency/settings/${encodeURIComponent(selectedLocationId)}`, {
                method: "PUT",
                body: JSON.stringify({
                    openai_api_key: safeValue
                })
            });
            const data = await parseResponse(res);
            if (!res.ok || data?.error) {
                throw new Error(data?.error || t("workflow_agents.location_key_save_error"));
            }

            toast.success(t("workflow_agents.location_key_saved"));
            setLocationKeyDraft("");
            await loadWorkspace(selectedLocationId);
            return true;
        } catch (error) {
            toast.error(t("workflow_agents.location_key_save_error"), { description: error.message });
            return false;
        } finally {
            setSavingLocationKey(false);
        }
    };

    const clearLocationOpenAiKey = async () => {
        if (!selectedLocationId) return false;

        setSavingLocationKey(true);
        try {
            const res = await authFetch(`/agency/settings/${encodeURIComponent(selectedLocationId)}`, {
                method: "PUT",
                body: JSON.stringify({
                    openai_api_key: ""
                })
            });
            const data = await parseResponse(res);
            if (!res.ok || data?.error) {
                throw new Error(data?.error || t("workflow_agents.location_key_remove_error"));
            }

            toast.success(t("workflow_agents.location_key_removed"));
            setLocationKeyDraft("");
            await loadWorkspace(selectedLocationId);
            return true;
        } catch (error) {
            toast.error(t("workflow_agents.location_key_remove_error"), { description: error.message });
            return false;
        } finally {
            setSavingLocationKey(false);
        }
    };

    const handleSave = async (event) => {
        event.preventDefault();
        if (!selectedLocationId) return;

        setSaving(true);
        try {
            const payload = {
                locationId: selectedLocationId,
                name: form.name,
                agent_key: form.agent_key,
                status: form.status,
                credential_mode: "location",
                slot_ids: [],
                model: form.model,
                temperature: Number.parseFloat(form.temperature || "0.4"),
                max_output_chars: Number.parseInt(form.max_output_chars || "600", 10),
                system_prompt: form.system_prompt,
                fallback_reply: form.fallback_reply,
                description: form.description,
                use_contact_context: form.use_contact_context,
                integrations: form.integrations
            };

            const endpoint = editingAgentId ? `/agency/workflow-agents/${editingAgentId}` : "/agency/workflow-agents";
            const method = editingAgentId ? "PUT" : "POST";

            const res = await authFetch(endpoint, { method, body: JSON.stringify(payload) });
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) throw new Error(data?.error || t("workflow_agents.save_error"));
            toast.success(t("workflow_agents.saved_success"));
            await loadWorkspace(selectedLocationId);
            if (data.agent) {
                applyAgentToForm(
                    { ...data.agent, integrations: data.agent.integrations || form.integrations },
                    { ...(workspace || {}), integration_catalog: workspace?.integration_catalog || [] },
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
    const locationHasOpenAiKey = workspace?.credentials?.has_location_openai_key === true;
    const agencyHasOpenAiKey = workspace?.credentials?.has_agency_openai_key === true;
    const legacySlotKeyCount = slots.filter((slot) => slot?.has_openai_api_key === true).length;
    const usingLegacySlotKeys = !locationHasOpenAiKey && legacySlotKeyCount > 0;
    const accountCredentialSource = locationHasOpenAiKey
        ? "location"
        : (usingLegacySlotKeys ? "slot" : (agencyHasOpenAiKey ? "agency" : "missing"));
    const baseModelOptions = useMemo(
        () => BASE_AGENT_MODEL_OPTIONS.map((option) => ({
            ...option,
            label: t(option.labelKey)
        })),
        [t]
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
                agent?.agent_key,
                agent?.description,
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
                    onClick={() => applyAgentToForm(null, workspace, { openEditor: true })}
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
                                onClick={() => applyAgentToForm(null, workspace, { openEditor: true })}
                                className="mt-4 inline-flex items-center rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500"
                            >
                                {t("workflow_agents.new_agent")}
                            </button>
                        ) : null}
                    </div>
                ) : null}

                {filteredAgents.map((agent) => (
                    <button
                        key={agent.id}
                        type="button"
                        onClick={() => applyAgentToForm(agent)}
                        className={`w-full rounded-[22px] border px-4 py-3.5 text-left transition ${
                            isEditorMode && editingAgentId === agent.id
                                ? "border-indigo-300 bg-indigo-50/80 shadow-sm dark:border-indigo-700 dark:bg-indigo-900/20"
                                : "border-gray-200 bg-white/80 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950/40 dark:hover:border-gray-600 dark:hover:bg-gray-800/60"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="truncate font-bold text-gray-900 dark:text-white">{agent.name}</div>
                                <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{agent.agent_key}</div>
                                {agent.description ? (
                                    <p
                                        className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400"
                                        style={{
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden"
                                        }}
                                    >
                                        {agent.description}
                                    </p>
                                ) : (
                                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                                        {t("workflow_agents.no_description")}
                                    </p>
                                )}
                            </div>
                            <StatusPill
                                label={t(`workflow_agents.status_${agent.status}`)}
                                kind={agent.status === "active" ? "good" : agent.status === "paused" ? "warn" : "neutral"}
                            />
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
                ))}
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
                        disabled={!editingAgentId || testing}
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

    if (!locations.length) {
        return (
            <div className="max-w-5xl mx-auto rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                {t("workflow_agents.empty_locations")}
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
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

                    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                        <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/60">
                            <TabButton active={activeTab === "general"} label={t("workflow_agents.tab_general")} onClick={() => setActiveTab("general")} />
                            <TabButton active={activeTab === "documents"} label={t("workflow_agents.tab_documents")} onClick={() => setActiveTab("documents")} />
                        </div>
                    </div>

                    <div className="p-6">
                        {activeTab === "general" && (
                            <form onSubmit={handleSave} className="space-y-5">
                                <EditorSection title={t("workflow_agents.section_identity_title")} description={t("workflow_agents.section_identity_desc")}>
                                    <div className="grid gap-4 lg:grid-cols-[1.15fr,1fr,220px]">
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
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_key")}</label>
                                            <input
                                                name="workflow-agent-internal-key"
                                                autoComplete="off"
                                                data-form-type="other"
                                                data-lpignore="true"
                                                value={form.agent_key}
                                                onChange={(event) => setForm((prev) => ({ ...prev, agent_key: event.target.value }))}
                                                placeholder={t("workflow_agents.field_key_placeholder")}
                                                className={inputClassName}
                                            />
                                            <div className="mt-2 max-w-xl text-xs leading-5 text-gray-500 dark:text-gray-400">{t("workflow_agents.field_key_help")}</div>
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_status")}</label>
                                            <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} className={inputClassName}>
                                                <option value="active">{t("workflow_agents.status_active")}</option>
                                                <option value="draft">{t("workflow_agents.status_draft")}</option>
                                                <option value="paused">{t("workflow_agents.status_paused")}</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_description")}</label>
                                        <textarea rows={4} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} className={inputClassName} />
                                    </div>
                                </EditorSection>

                                <EditorSection title={t("workflow_agents.section_response_title")} description={t("workflow_agents.section_response_desc")}>
                                    <div className="grid gap-4 lg:grid-cols-3">
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_model")}</label>
                                            <select value={form.model} onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))} className={inputClassName}>
                                                {modelOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{t("workflow_agents.field_model_help")}</div>
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_temperature")}</label>
                                            <input type="number" min="0" max="1" step="0.1" value={form.temperature} onChange={(event) => setForm((prev) => ({ ...prev, temperature: event.target.value }))} className={inputClassName} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_max_chars")}</label>
                                            <input type="number" min="120" max="4000" step="20" value={form.max_output_chars} onChange={(event) => setForm((prev) => ({ ...prev, max_output_chars: event.target.value }))} className={inputClassName} />
                                        </div>
                                    </div>
                                    <label className="mt-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                                        <input type="checkbox" checked={form.use_contact_context} onChange={(event) => setForm((prev) => ({ ...prev, use_contact_context: event.target.checked }))} className="h-4 w-4 rounded text-indigo-600" />
                                        {t("workflow_agents.field_use_contact_context")}
                                    </label>
                                </EditorSection>

                                <EditorSection title={t("workflow_agents.section_account_ai_title")} description={t("workflow_agents.section_account_ai_desc")}>
                                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),240px]">
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_location_api_key")}</label>
                                            <input
                                                type="password"
                                                name="workflow-location-openai-key"
                                                autoComplete="new-password"
                                                data-form-type="other"
                                                data-lpignore="true"
                                                value={locationKeyDraft}
                                                onChange={(event) => setLocationKeyDraft(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        saveLocationOpenAiKey(locationKeyDraft);
                                                    }
                                                }}
                                                placeholder={t("workflow_agents.location_key_placeholder")}
                                                className={inputClassName}
                                            />
                                            <div className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{t("workflow_agents.location_key_help")}</div>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-900">
                                                <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                                    {t("workflow_agents.credentials_box_title")}
                                                </div>
                                                <div className="mt-2">
                                                    <StatusPill
                                                        label={t(`workflow_agents.credential_source_${accountCredentialSource}`)}
                                                        kind={accountCredentialSource === "missing" ? "warn" : "good"}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => saveLocationOpenAiKey(locationKeyDraft)}
                                                    disabled={savingLocationKey}
                                                    className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {savingLocationKey ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                                    {savingLocationKey ? t("workflow_agents.location_key_saving") : t("workflow_agents.location_key_save")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={clearLocationOpenAiKey}
                                                    disabled={savingLocationKey || (!locationHasOpenAiKey && !usingLegacySlotKeys)}
                                                    className="rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/20"
                                                >
                                                    {t("workflow_agents.location_key_remove")}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-amber-300">
                                        {locationHasOpenAiKey
                                            ? t("workflow_agents.location_key_ready")
                                            : (usingLegacySlotKeys
                                                ? t("workflow_agents.location_key_legacy_fallback").replace("{count}", String(legacySlotKeyCount))
                                                : (agencyHasOpenAiKey
                                                    ? t("workflow_agents.location_key_agency_fallback")
                                                    : t("workflow_agents.location_key_missing")))}
                                    </div>
                                </EditorSection>

                                <EditorSection title={t("workflow_agents.section_prompt_title")} description={t("workflow_agents.section_prompt_desc")}>
                                    <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_prompt")}</label>
                                            <textarea rows={11} value={form.system_prompt} onChange={(event) => setForm((prev) => ({ ...prev, system_prompt: event.target.value }))} className={inputClassName} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_fallback")}</label>
                                            <textarea rows={11} value={form.fallback_reply} onChange={(event) => setForm((prev) => ({ ...prev, fallback_reply: event.target.value }))} className={inputClassName} />
                                        </div>
                                    </div>
                                </EditorSection>

                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
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
        </div>
    );
}
