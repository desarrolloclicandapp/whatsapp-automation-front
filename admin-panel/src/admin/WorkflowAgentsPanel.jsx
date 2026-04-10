import React, { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Play, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../context/LanguageContext";

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");
const inputClassName = "w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

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
        credential_mode: "slot",
        slot_id: "",
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
        credential_mode: agent?.credential_mode || "slot",
        slot_id: agent?.slot_id ? String(agent.slot_id) : "",
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
            className={`border-b-2 px-1 py-2 text-sm font-semibold transition ${
                active
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-300"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
        >
            {label}
        </button>
    );
}

export default function WorkflowAgentsPanel({ locations = [], onUnauthorized, token }) {
    const { t } = useLanguage();
    const [selectedLocationId, setSelectedLocationId] = useState("");
    const [workspace, setWorkspace] = useState(null);
    const [editingAgentId, setEditingAgentId] = useState(null);
    const [activeTab, setActiveTab] = useState("general");
    const [form, setForm] = useState(buildEmptyForm());
    const [agentQuery, setAgentQuery] = useState("");
    const [testMessage, setTestMessage] = useState("");
    const [testResult, setTestResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

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

    const applyAgentToForm = (agent, workspaceSnapshot = workspace) => {
        const catalog = Array.isArray(workspaceSnapshot?.integration_catalog) ? workspaceSnapshot.integration_catalog : [];
        if (!agent) {
            setEditingAgentId(null);
            setForm(buildEmptyForm(catalog));
            setTestResult(null);
            setActiveTab("general");
            return;
        }

        setEditingAgentId(agent.id);
        setForm(buildFormFromAgent(agent, catalog));
        setTestResult(null);
        setActiveTab("general");
    };

    const loadWorkspace = async (locationId, reset = false) => {
        const safeLocationId = String(locationId || "").trim();
        if (!safeLocationId) return;

        setLoading(true);
        try {
            const res = await authFetch(`/agency/workflow-agents?locationId=${encodeURIComponent(safeLocationId)}`);
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) throw new Error(data?.error || t("workflow_agents.load_error"));
            setWorkspace(data);
            if (reset) applyAgentToForm(data.agents?.[0] || null, data);
        } catch (error) {
            toast.error(t("workflow_agents.load_error"), { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedLocationId) loadWorkspace(selectedLocationId, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLocationId]);

    const handleCopy = async (value) => {
        try {
            await navigator.clipboard.writeText(String(value || ""));
            toast.success(t("workflow_agents.copy_success"));
        } catch (_) {
            toast.error(t("workflow_agents.copy_error"));
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
                credential_mode: form.credential_mode,
                slot_id: form.credential_mode === "slot" && form.slot_id ? Number.parseInt(form.slot_id, 10) : null,
                model: form.model,
                temperature: Number.parseFloat(form.temperature || "0.4"),
                max_output_chars: Number.parseInt(form.max_output_chars || "600", 10),
                system_prompt: form.system_prompt,
                fallback_reply: form.fallback_reply,
                description: form.description,
                use_contact_context: form.use_contact_context,
                integrations: form.integrations
            };
            if (form.credential_mode === "manual") {
                if (String(form.manual_api_key || "").trim()) {
                    payload.manual_api_key = String(form.manual_api_key || "").trim();
                }
                if (form.clear_manual_api_key === true) {
                    payload.clear_manual_api_key = true;
                }
            }

            const endpoint = editingAgentId ? `/agency/workflow-agents/${editingAgentId}` : "/agency/workflow-agents";
            const method = editingAgentId ? "PUT" : "POST";

            const res = await authFetch(endpoint, { method, body: JSON.stringify(payload) });
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) throw new Error(data?.error || t("workflow_agents.save_error"));
            toast.success(t("workflow_agents.saved_success"));
            await loadWorkspace(selectedLocationId, false);
            if (data.agent) {
                applyAgentToForm(
                    { ...data.agent, integrations: data.agent.integrations || form.integrations },
                    { ...(workspace || {}), integration_catalog: workspace?.integration_catalog || [] }
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
            await loadWorkspace(selectedLocationId, true);
        } catch (error) {
            toast.error(t("workflow_agents.delete_error"), { description: error.message });
        }
    };

    const handleRunTest = async () => {
        if (!editingAgentId || !selectedLocationId) return;
        setTesting(true);
        try {
            const res = await authFetch(`/agency/workflow-agents/${editingAgentId}/test`, {
                method: "POST",
                body: JSON.stringify({
                    locationId: selectedLocationId,
                    message: testMessage || t("workflow_agents.test_placeholder"),
                    extraContext: form.description || ""
                })
            });
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) {
                setTestResult(data?.result || null);
                throw new Error(data?.error || t("workflow_agents.test_error"));
            }
            setTestResult(data.result || null);
            toast.success(t("workflow_agents.test_success"));
            await loadWorkspace(selectedLocationId, false);
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

    const handleResetTest = () => {
        setTestMessage("");
        setTestResult(null);
    };

    const catalog = Array.isArray(workspace?.integration_catalog) ? workspace.integration_catalog : [];
    const agents = Array.isArray(workspace?.agents) ? workspace.agents : [];
    const recentRuns = Array.isArray(workspace?.recent_runs) ? workspace.recent_runs : [];
    const slots = Array.isArray(workspace?.slots) ? workspace.slots : [];
    const credentials = workspace?.credentials || null;
    const summary = workspace?.integration_summary || {};
    const activeCount = agents.filter((agent) => agent.status === "active").length;
    const selectedAgent = agents.find((agent) => agent.id === editingAgentId) || null;
    const ghlIntegration = catalog.find((item) => item.key === "ghl") || null;
    const slotsWithOpenAiKey = slots.filter((slot) => slot?.has_openai_api_key);
    const hasAgencyOpenAiKey = credentials?.has_agency_openai_key === true;
    const hasAnySlotOpenAiKey = slotsWithOpenAiKey.length > 0;
    const isManualCredentialMode = form.credential_mode === "manual";
    const manualKeyReady = isManualCredentialMode && (
        String(form.manual_api_key || "").trim().length > 0 ||
        (form.manual_api_key_configured === true && form.clear_manual_api_key !== true)
    );
    const selectedSlot = slots.find((slot) => String(slot.slot_id) === String(form.slot_id || ""));
    const selectedSlotHasOpenAiKey = !!selectedSlot?.has_openai_api_key;
    const slotsWithOpenAiKeyLabel = slotsWithOpenAiKey
        .map((slot) => slot?.slot_name || `${t("workflow_agents.slot_prefix")} ${slot?.slot_id}`)
        .filter(Boolean)
        .join(", ");

    const buildMissingCredentialMessage = () => {
        if (isManualCredentialMode) {
            return manualKeyReady
                ? t("workflow_agents.test_error_missing_key_fallback")
                : t("workflow_agents.test_error_missing_manual_key");
        }
        if (hasAgencyOpenAiKey) {
            return t("workflow_agents.test_error_missing_key_fallback");
        }
        if (form.slot_id && !selectedSlotHasOpenAiKey) {
            return t("workflow_agents.test_error_missing_key_selected_slot");
        }
        if (!form.slot_id && hasAnySlotOpenAiKey) {
            return t("workflow_agents.test_error_missing_key_slot");
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
                agent?.model,
                ...(Array.isArray(agent?.enabled_integrations) ? agent.enabled_integrations : [])
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return haystack.includes(safeQuery);
        });
    }, [agentQuery, agents]);

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

            <div className="rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-3">
                        <StatusPill label={`${t("workflow_agents.total_agents")}: ${agents.length}`} kind="neutral" />
                        <StatusPill label={`${t("workflow_agents.active_agents")}: ${activeCount}`} kind="good" />
                        <StatusPill label={`${t("workflow_agents.live_integrations")}: ${summary.enabled_bindings || 0}`} kind="neutral" />
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        {credentials?.has_agency_openai_key
                            ? t("workflow_agents.credentials_agency")
                            : credentials?.has_any_slot_openai_key
                                ? t("workflow_agents.credentials_slot")
                                : t("workflow_agents.credentials_missing")}
                    </div>
                </div>
            </div>

            {(isManualCredentialMode ? !manualKeyReady : (!hasAgencyOpenAiKey || hasAnySlotOpenAiKey)) ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                    <div className="font-semibold">
                        {isManualCredentialMode
                            ? t("workflow_agents.credentials_help_manual_title")
                            : (!hasAgencyOpenAiKey && !hasAnySlotOpenAiKey
                            ? t("workflow_agents.credentials_help_missing_title")
                            : t("workflow_agents.credentials_help_slot_title"))}
                    </div>
                    <div className="mt-1 leading-6">
                        {isManualCredentialMode
                            ? t("workflow_agents.credentials_help_manual_body")
                            : (!hasAgencyOpenAiKey && !hasAnySlotOpenAiKey
                            ? t("workflow_agents.credentials_help_missing_body")
                            : t("workflow_agents.credentials_help_slot_body"))}
                    </div>
                    {!isManualCredentialMode && hasAnySlotOpenAiKey ? (
                        <div className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                            {t("workflow_agents.credentials_help_available_slots")} {slotsWithOpenAiKeyLabel || "-"}
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
                <aside className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">{t("workflow_agents.agent_list_title")}</h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.agent_list_desc")}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => applyAgentToForm(null)}
                            className="rounded-2xl bg-indigo-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-indigo-500"
                        >
                            {t("workflow_agents.new_agent")}
                        </button>
                    </div>

                    <div className="mt-4 relative">
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
                            <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                {agents.length === 0 ? t("workflow_agents.no_agents") : t("workflow_agents.no_search_results")}
                            </div>
                        ) : null}

                        {filteredAgents.map((agent) => (
                            <button
                                key={agent.id}
                                type="button"
                                onClick={() => applyAgentToForm(agent)}
                                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                    editingAgentId === agent.id
                                        ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-900/20"
                                        : "border-gray-200 bg-gray-50/70 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:bg-gray-800"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="truncate font-bold text-gray-900 dark:text-white">{agent.name}</div>
                                        <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{agent.agent_key}</div>
                                    </div>
                                    <StatusPill
                                        label={t(`workflow_agents.status_${agent.status}`)}
                                        kind={agent.status === "active" ? "good" : agent.status === "paused" ? "warn" : "neutral"}
                                    />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {Array.isArray(agent.enabled_integrations) && agent.enabled_integrations.length > 0 ? (
                                        agent.enabled_integrations.map((integrationKey) => (
                                            <span
                                                key={`${agent.id}-${integrationKey}`}
                                                className="rounded-full border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300"
                                            >
                                                {getIntegrationTitle(t, integrationKey)}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-[11px] text-gray-500 dark:text-gray-400">{t("workflow_agents.no_integrations_bound")}</span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                </aside>

                <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 dark:border-gray-800 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingAgentId ? (form.name || t("workflow_agents.edit_agent")) : t("workflow_agents.new_agent")}
                            </h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.form_desc")}</p>
                            {editingAgentId ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span className="rounded-full border border-gray-200 px-2.5 py-1 dark:border-gray-700">{form.agent_key || "-"}</span>
                                    <span>{form.model || "-"}</span>
                                    <span>
                                        {isManualCredentialMode
                                            ? t("workflow_agents.credentials_mode_manual")
                                            : (form.slot_id ? `${t("workflow_agents.slot_prefix")} ${form.slot_id}` : t("workflow_agents.slot_not_selected"))}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => loadWorkspace(selectedLocationId, false)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                                {t("workflow_agents.refresh")}
                            </button>
                            {editingAgentId ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(form.agent_key)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        <Copy size={15} />
                                        {t("workflow_agents.copy_agent_id")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(selectedAgent)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
                                    >
                                        <Trash2 size={15} />
                                        {t("workflow_agents.delete_button")}
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                        <TabButton active={activeTab === "general"} label={t("workflow_agents.tab_general")} onClick={() => setActiveTab("general")} />
                        <TabButton active={activeTab === "integrations"} label={t("workflow_agents.tab_integrations")} onClick={() => setActiveTab("integrations")} />
                        <TabButton active={activeTab === "test"} label={t("workflow_agents.tab_test")} onClick={() => setActiveTab("test")} />
                        <TabButton active={activeTab === "history"} label={t("workflow_agents.tab_history")} onClick={() => setActiveTab("history")} />
                    </div>

                    <div className="mt-6">
                        {activeTab === "general" && (
                            <form onSubmit={handleSave} className="space-y-4">
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_name")}</label>
                                        <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className={inputClassName} />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_key")}</label>
                                        <input
                                            value={form.agent_key}
                                            onChange={(event) => setForm((prev) => ({ ...prev, agent_key: event.target.value }))}
                                            placeholder={t("workflow_agents.field_key_placeholder")}
                                            className={inputClassName}
                                        />
                                        <div className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                            {t("workflow_agents.field_key_help")}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-4">
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_status")}</label>
                                        <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} className={inputClassName}>
                                            <option value="active">{t("workflow_agents.status_active")}</option>
                                            <option value="draft">{t("workflow_agents.status_draft")}</option>
                                            <option value="paused">{t("workflow_agents.status_paused")}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_credentials_mode")}</label>
                                        <select
                                            value={form.credential_mode}
                                            onChange={(event) => setForm((prev) => ({
                                                ...prev,
                                                credential_mode: event.target.value,
                                                clear_manual_api_key: false
                                            }))}
                                            className={inputClassName}
                                        >
                                            <option value="slot">{t("workflow_agents.credentials_mode_slot")}</option>
                                            <option value="manual">{t("workflow_agents.credentials_mode_manual")}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_model")}</label>
                                        <input value={form.model} onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))} className={inputClassName} />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_max_chars")}</label>
                                        <input type="number" min="120" max="4000" step="20" value={form.max_output_chars} onChange={(event) => setForm((prev) => ({ ...prev, max_output_chars: event.target.value }))} className={inputClassName} />
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-[1fr,220px]">
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                            {isManualCredentialMode ? t("workflow_agents.field_manual_api_key") : t("workflow_agents.field_slot")}
                                        </label>
                                        {isManualCredentialMode ? (
                                            <>
                                                <input
                                                    type="password"
                                                    value={form.manual_api_key}
                                                    onChange={(event) => setForm((prev) => ({
                                                        ...prev,
                                                        manual_api_key: event.target.value,
                                                        clear_manual_api_key: false
                                                    }))}
                                                    placeholder={form.manual_api_key_configured && !form.clear_manual_api_key ? t("workflow_agents.manual_api_key_placeholder_masked") : "sk-..."}
                                                    className={inputClassName}
                                                />
                                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                                    <span>
                                                        {form.manual_api_key_configured && !form.clear_manual_api_key
                                                            ? t("workflow_agents.manual_api_key_configured")
                                                            : t("workflow_agents.manual_api_key_help")}
                                                    </span>
                                                    {form.manual_api_key_configured && !form.clear_manual_api_key ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setForm((prev) => ({
                                                                ...prev,
                                                                manual_api_key: "",
                                                                manual_api_key_configured: false,
                                                                clear_manual_api_key: true
                                                            }))}
                                                            className="font-semibold text-red-500 transition hover:text-red-400"
                                                        >
                                                            {t("workflow_agents.manual_api_key_clear")}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <select value={form.slot_id} onChange={(event) => setForm((prev) => ({ ...prev, slot_id: event.target.value }))} className={inputClassName}>
                                                    <option value="">{t("workflow_agents.slot_not_selected")}</option>
                                                    {slots.map((slot) => (
                                                        <option key={slot.slot_id} value={slot.slot_id}>
                                                            {slot.slot_name} ({t("workflow_agents.slot_prefix")} {slot.slot_id}) - {slot.has_openai_api_key ? t("workflow_agents.slot_has_key") : t("workflow_agents.slot_missing_key")}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                                                    {form.slot_id
                                                        ? (selectedSlotHasOpenAiKey
                                                            ? t("workflow_agents.credentials_help_slot_selected")
                                                            : t("workflow_agents.credentials_help_slot_missing_for_selected"))
                                                        : t("workflow_agents.credentials_help_slot_pick")}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                                        <div className="font-semibold text-gray-900 dark:text-white">{t("workflow_agents.credentials_box_title")}</div>
                                        <div className="mt-2 leading-6">
                                            {isManualCredentialMode
                                                ? t("workflow_agents.credentials_box_manual")
                                                : t("workflow_agents.credentials_box_slot")}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-[1fr,220px]">
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_prompt")}</label>
                                        <textarea rows={10} value={form.system_prompt} onChange={(event) => setForm((prev) => ({ ...prev, system_prompt: event.target.value }))} className={inputClassName} />
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_temperature")}</label>
                                            <input type="number" min="0" max="1" step="0.1" value={form.temperature} onChange={(event) => setForm((prev) => ({ ...prev, temperature: event.target.value }))} className={inputClassName} />
                                        </div>
                                        <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                            <input type="checkbox" checked={form.use_contact_context} onChange={(event) => setForm((prev) => ({ ...prev, use_contact_context: event.target.checked }))} className="h-4 w-4 rounded text-indigo-600" />
                                            {t("workflow_agents.field_use_contact_context")}
                                        </label>
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_fallback")}</label>
                                        <textarea rows={4} value={form.fallback_reply} onChange={(event) => setForm((prev) => ({ ...prev, fallback_reply: event.target.value }))} className={inputClassName} />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_description")}</label>
                                        <textarea rows={4} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} className={inputClassName} />
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70">
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        {editingAgentId ? t("workflow_agents.save_update") : t("workflow_agents.save_create")}
                                    </button>
                                    <button type="button" onClick={() => applyAgentToForm(null)} className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                                        {t("workflow_agents.cancel_edit")}
                                    </button>
                                </div>
                            </form>
                        )}

                        {activeTab === "integrations" && (
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">{t("workflow_agents.integration_config_desc")}</div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    {catalog.map((item) => (
                                        <div key={`summary-${item.key}`} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold text-gray-900 dark:text-white">{getIntegrationTitle(t, item.key)}</div>
                                                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                        {item.enabled_agents || 0} {t("workflow_agents.integration_bound_agents").toLowerCase()}
                                                    </div>
                                                </div>
                                                <StatusPill label={getIntegrationStatusLabel(t, item.status)} kind={getIntegrationStatusKind(item.status)} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {catalog.map((item) => {
                                    const binding = form.integrations?.[item.key] || { enabled: false, config: {} };
                                    return (
                                        <div key={item.key} className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="text-lg font-bold text-gray-900 dark:text-white">{getIntegrationTitle(t, item.key)}</div>
                                                        <StatusPill label={getIntegrationStatusLabel(t, item.status)} kind={getIntegrationStatusKind(item.status)} />
                                                        <StatusPill label={binding.enabled ? t("workflow_agents.integration_bound_badge") : t("workflow_agents.integration_not_bound_badge")} kind={binding.enabled ? "good" : "neutral"} />
                                                    </div>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{getIntegrationDescription(t, item.key)}</p>
                                                </div>
                                                <label className="inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={binding.enabled === true}
                                                        onChange={(event) => setForm((prev) => ({
                                                            ...prev,
                                                            integrations: {
                                                                ...(prev.integrations || {}),
                                                                [item.key]: { enabled: event.target.checked, config: prev.integrations?.[item.key]?.config || {} }
                                                            }
                                                        }))}
                                                        className="h-4 w-4 rounded text-indigo-600"
                                                    />
                                                    {t("workflow_agents.integration_enable_toggle")}
                                                </label>
                                            </div>

                                            {item.key === "ghl" && ghlIntegration?.setup && binding.enabled ? (
                                                <div className="mt-4 grid gap-3 md:grid-cols-[1fr,auto]">
                                                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-900/10 dark:text-indigo-100">
                                                        <div className="font-semibold">{t("workflow_agents.integration_ghl_binding_note")}</div>
                                                        <div className="mt-3 space-y-2 text-xs">
                                                            <div><span className="font-semibold">{t("workflow_agents.setup_copy_endpoint")}:</span> {ghlIntegration.setup.execute_url}</div>
                                                            <div><span className="font-semibold">{t("workflow_agents.setup_copy_action")}:</span> {ghlIntegration.setup.action_key}</div>
                                                            <div><span className="font-semibold">{t("workflow_agents.setup_copy_header")}:</span> {ghlIntegration.setup.secret_header_name}</div>
                                                        </div>
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <button type="button" onClick={() => handleCopy(ghlIntegration.setup.execute_url || "")} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"><Copy size={15} />{t("workflow_agents.setup_copy_endpoint")}</button>
                                                        <button type="button" onClick={() => handleCopy(ghlIntegration.setup.action_key || "")} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"><Copy size={15} />{t("workflow_agents.setup_copy_action")}</button>
                                                        <button type="button" onClick={() => handleCopy(ghlIntegration.setup.secret_header_name || "")} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"><Copy size={15} />{t("workflow_agents.setup_copy_header")}</button>
                                                    </div>
                                                </div>
                                            ) : null}

                                            {item.key === "chatwoot" ? (
                                                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
                                                    {binding.enabled ? t("workflow_agents.integration_chatwoot_binding_note") : t("workflow_agents.integration_chatwoot_idle_note")}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {activeTab === "test" && (
                            <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-5 dark:border-gray-700 dark:bg-gray-800/30">
                                <div className="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-700 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">{t("workflow_agents.tab_test")}</div>
                                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            {editingAgentId ? t("workflow_agents.test_desc") : t("workflow_agents.test_need_agent")}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleResetTest}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        {t("workflow_agents.reset_chat")}
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="min-h-[320px] space-y-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                                        {testMessage ? (
                                            <div className="flex justify-end">
                                                <div className="max-w-[75%] rounded-2xl bg-indigo-600 px-4 py-3 text-sm text-white shadow-sm">
                                                    {testMessage}
                                                </div>
                                            </div>
                                        ) : null}

                                        {testResult ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <StatusPill label={getRunStatusLabel(t, testResult.status)} kind={testResult.status === "completed" ? "good" : "warn"} />
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{testResult.intent || "general"}</span>
                                                </div>
                                                <div className="max-w-[75%] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                                    {testResult.reply_text || "-"}
                                                </div>
                                                {testResult.summary ? <div className="max-w-[75%] text-xs text-gray-500 dark:text-gray-400">{testResult.summary}</div> : null}
                                            </div>
                                        ) : (
                                            <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-gray-300 px-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                                {t("workflow_agents.test_empty")}
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                                        <textarea
                                            rows={4}
                                            value={testMessage}
                                            onChange={(event) => setTestMessage(event.target.value)}
                                            placeholder={t("workflow_agents.test_placeholder")}
                                            className={inputClassName}
                                        />
                                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{t("workflow_agents.test_tip")}</div>
                                            <button
                                                type="button"
                                                disabled={!editingAgentId || testing}
                                                onClick={handleRunTest}
                                                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {testing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                                {t("workflow_agents.run_test")}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "history" && (
                            <div className="space-y-3">
                                <div className="rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">{t("workflow_agents.recent_history_desc")}</div>
                                {recentRuns.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">{t("workflow_agents.no_runs")}</div> : null}
                                {recentRuns.map((run) => (
                                    <div key={run.id} className="rounded-2xl border border-gray-200 px-4 py-4 dark:border-gray-700">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">{run.agent_name || run.agent_key || t("workflow_agents.unknown_agent")}</div>
                                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatRunTimestamp(run.executed_at)}</div>
                                            </div>
                                            <StatusPill label={getRunStatusLabel(t, run.status)} kind={run.status === "completed" ? "good" : run.status === "error" ? "warn" : "neutral"} />
                                        </div>
                                        <div className="mt-3 grid gap-2 text-xs text-gray-500 dark:text-gray-400 md:grid-cols-3">
                                            <span>{t("workflow_agents.run_source")}: {getRunSourceLabel(t, run.source)}</span>
                                            <span>{t("workflow_agents.run_duration")}: {formatDuration(run.duration_ms)}</span>
                                            <span>{t("workflow_agents.run_status")}: {getRunStatusLabel(t, run.status)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
