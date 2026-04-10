import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Play, RefreshCw, Save, Search, Trash2 } from "lucide-react";
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
        credential_mode: "slot",
        slot_ids: Array.isArray(agent?.slot_ids)
            ? agent.slot_ids.map((slotId) => String(slotId))
            : (agent?.slot_id ? [String(agent.slot_id)] : []),
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
    const [viewMode, setViewMode] = useState("list");
    const [editingAgentId, setEditingAgentId] = useState(null);
    const [activeTab, setActiveTab] = useState("general");
    const [form, setForm] = useState(buildEmptyForm());
    const [agentQuery, setAgentQuery] = useState("");
    const [testMessage, setTestMessage] = useState("");
    const [testResult, setTestResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [slotKeyDrafts, setSlotKeyDrafts] = useState({});
    const [openSlotKeyEditorId, setOpenSlotKeyEditorId] = useState(null);
    const [savingSlotKeyId, setSavingSlotKeyId] = useState(null);

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

    const applyAgentToForm = (agent, workspaceSnapshot = workspace, options = {}) => {
        const catalog = Array.isArray(workspaceSnapshot?.integration_catalog) ? workspaceSnapshot.integration_catalog : [];
        if (!agent) {
            setEditingAgentId(null);
            setForm(buildEmptyForm(catalog));
            setTestMessage("");
            setTestResult(null);
            setActiveTab("general");
            setViewMode(options.openEditor === true ? "editor" : "list");
            return;
        }

        setEditingAgentId(agent.id);
        setForm(buildFormFromAgent(agent, catalog));
        setTestMessage("");
        setTestResult(null);
        setActiveTab("general");
        setViewMode("editor");
    };

    const loadWorkspace = async (locationId) => {
        const safeLocationId = String(locationId || "").trim();
        if (!safeLocationId) return;

        setLoading(true);
        try {
            const res = await authFetch(`/agency/workflow-agents?locationId=${encodeURIComponent(safeLocationId)}`);
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) throw new Error(data?.error || t("workflow_agents.load_error"));
            setWorkspace(data);
        } catch (error) {
            toast.error(t("workflow_agents.load_error"), { description: error.message });
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
            setActiveTab("general");
            setOpenSlotKeyEditorId(null);
            setSlotKeyDrafts({});
            loadWorkspace(selectedLocationId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLocationId]);

    const saveSlotOpenAiKey = async (slotId, rawValue) => {
        if (!selectedLocationId || !slotId) return false;
        const safeValue = String(rawValue || "").trim();
        if (!safeValue) {
            toast.error(t("workflow_agents.slot_key_invalid"));
            return false;
        }

        setSavingSlotKeyId(slotId);
        try {
            const res = await authFetch("/agency/update-slot-config", {
                method: "POST",
                body: JSON.stringify({
                    locationId: selectedLocationId,
                    slotId,
                    openai_api_key: safeValue
                })
            });
            const data = await parseResponse(res);
            if (!res.ok || data?.error) {
                throw new Error(data?.error || t("workflow_agents.slot_key_save_error"));
            }

            toast.success(t("workflow_agents.slot_key_saved"));
            setSlotKeyDrafts((prev) => ({ ...prev, [slotId]: "" }));
            setOpenSlotKeyEditorId(slotId);
            await loadWorkspace(selectedLocationId);
            return true;
        } catch (error) {
            toast.error(t("workflow_agents.slot_key_save_error"), { description: error.message });
            return false;
        } finally {
            setSavingSlotKeyId(null);
        }
    };

    const clearSlotOpenAiKey = async (slotId) => {
        if (!selectedLocationId || !slotId) return false;

        setSavingSlotKeyId(slotId);
        try {
            const res = await authFetch("/agency/update-slot-config", {
                method: "POST",
                body: JSON.stringify({
                    locationId: selectedLocationId,
                    slotId,
                    openai_api_key: ""
                })
            });
            const data = await parseResponse(res);
            if (!res.ok || data?.error) {
                throw new Error(data?.error || t("workflow_agents.slot_key_remove_error"));
            }

            toast.success(t("workflow_agents.slot_key_removed"));
            setSlotKeyDrafts((prev) => ({ ...prev, [slotId]: "" }));
            await loadWorkspace(selectedLocationId);
            return true;
        } catch (error) {
            toast.error(t("workflow_agents.slot_key_remove_error"), { description: error.message });
            return false;
        } finally {
            setSavingSlotKeyId(null);
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
                credential_mode: "slot",
                slot_ids: Array.isArray(form.slot_ids)
                    ? form.slot_ids.map((slotId) => Number.parseInt(String(slotId), 10)).filter((slotId) => Number.isFinite(slotId) && slotId > 0)
                    : [],
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
        if (selectedSlotCount === 0) {
            toast.error(t("workflow_agents.test_error"), { description: t("workflow_agents.test_error_missing_slots") });
            return;
        }

        setTesting(true);
        try {
            const res = await authFetch(`/agency/workflow-agents/${editingAgentId}/test`, {
                method: "POST",
                body: JSON.stringify({
                    locationId: selectedLocationId,
                    slotId: preferredTestSlot?.slot_id || null,
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

    const handleResetTest = () => {
        setTestMessage("");
        setTestResult(null);
    };

    const catalog = Array.isArray(workspace?.integration_catalog) ? workspace.integration_catalog : [];
    const agents = Array.isArray(workspace?.agents) ? workspace.agents : [];
    const recentRuns = Array.isArray(workspace?.recent_runs) ? workspace.recent_runs : [];
    const slots = Array.isArray(workspace?.slots) ? workspace.slots : [];
    const selectedLocation = locations.find((location) => String(location?.location_id || "") === selectedLocationId) || null;
    const selectedLocationName = selectedLocation?.name || selectedLocationId || "-";
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
    const selectedSlotIds = Array.isArray(form.slot_ids) ? form.slot_ids : [];
    const selectedSlots = slots.filter((slot) => selectedSlotIds.includes(String(slot.slot_id)));
    const selectedSlotCount = selectedSlots.length;
    const selectedSlotsWithKeys = selectedSlots.filter((slot) => slot?.has_openai_api_key === true);
    const selectedSlotsWithoutKeys = selectedSlots.filter((slot) => slot?.has_openai_api_key !== true);
    const selectedSlotsWithKeysCount = selectedSlotsWithKeys.length;
    const preferredTestSlot = selectedSlotsWithKeys[0] || selectedSlots[0] || null;

    const buildMissingCredentialMessage = () => {
        if (selectedSlotCount === 0) {
            return t("workflow_agents.test_error_missing_slots");
        }
        if (selectedSlotsWithKeysCount === 0) {
            return t("workflow_agents.test_error_missing_key_selected_slot");
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
                            {Array.isArray(agent.slot_ids) && agent.slot_ids.length > 0 ? (
                                <span className="rounded-full border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                                    {t("workflow_agents.slots_selected_count").replace("{count}", String(agent.slot_ids.length))}
                                </span>
                            ) : (
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">{t("workflow_agents.slot_not_selected")}</span>
                            )}
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
                <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
                    {renderAgentList(true)}
                    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 dark:border-gray-800 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingAgentId ? (form.name || t("workflow_agents.edit_agent")) : t("workflow_agents.new_agent")}
                            </h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.form_desc")}</p>
                            {editingAgentId ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <StatusPill
                                        label={t(`workflow_agents.status_${form.status}`)}
                                        kind={form.status === "active" ? "good" : form.status === "paused" ? "warn" : "neutral"}
                                    />
                                    <span>{selectedSlotCount > 0 ? t("workflow_agents.slots_selected_count").replace("{count}", String(selectedSlotCount)) : t("workflow_agents.slot_not_selected")}</span>
                                </div>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => applyAgentToForm(null)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                {t("workflow_agents.back_to_list")}
                            </button>
                            <button
                                type="button"
                                onClick={() => loadWorkspace(selectedLocationId)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                                {t("workflow_agents.refresh")}
                            </button>
                            {editingAgentId ? (
                                <button
                                    type="button"
                                    onClick={() => handleDelete(selectedAgent)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
                                >
                                    <Trash2 size={15} />
                                    {t("workflow_agents.delete_button")}
                                </button>
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
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_slots")}</label>
                                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                                            {selectedSlotCount > 0
                                                ? t("workflow_agents.slots_selected_count").replace("{count}", String(selectedSlotCount))
                                                : t("workflow_agents.slot_not_selected")}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_model")}</label>
                                        <select value={form.model} onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))} className={inputClassName}>
                                            {modelOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                            {t("workflow_agents.field_model_help")}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_max_chars")}</label>
                                        <input type="number" min="120" max="4000" step="20" value={form.max_output_chars} onChange={(event) => setForm((prev) => ({ ...prev, max_output_chars: event.target.value }))} className={inputClassName} />
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-[1fr,220px]">
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/40">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-white">{t("workflow_agents.field_slots")}</div>
                                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("workflow_agents.field_slots_help")}</div>
                                            </div>
                                            <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                                                {selectedSlotCount > 0
                                                    ? t("workflow_agents.slots_selected_count").replace("{count}", String(selectedSlotCount))
                                                    : t("workflow_agents.slot_not_selected")}
                                            </span>
                                        </div>
                                        <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                            <span className="font-semibold text-gray-700 dark:text-gray-200">{t("workflow_agents.slot_scope_label")}</span>{" "}
                                            {t("workflow_agents.slot_scope_desc").replace("{account}", selectedLocationName)}
                                        </div>
                                        <div className="wf-soft-scrollbar mt-4 max-h-72 space-y-2 overflow-auto pr-1">
                                            {slots.length === 0 ? (
                                                <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                                    {t("workflow_agents.slots_empty")}
                                                </div>
                                            ) : slots.map((slot) => {
                                                const slotId = String(slot.slot_id);
                                                const checked = selectedSlotIds.includes(slotId);
                                                const isKeyEditorOpen = openSlotKeyEditorId === slot.slot_id;
                                                const isSavingThisSlotKey = savingSlotKeyId === slot.slot_id;
                                                const slotKeyDraft = slotKeyDrafts[slot.slot_id] || "";
                                                return (
                                                    <div
                                                        key={slotId}
                                                        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                                                            checked
                                                                ? "border-indigo-300 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-900/20"
                                                                : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                setForm((prev) => {
                                                                    const prevSlotIds = Array.isArray(prev.slot_ids) ? prev.slot_ids : [];
                                                                    const nextSlotIds = prevSlotIds.includes(slotId)
                                                                        ? prevSlotIds.filter((value) => value !== slotId)
                                                                        : [...prevSlotIds, slotId];
                                                                    return {
                                                                        ...prev,
                                                                        slot_ids: nextSlotIds,
                                                                        credential_mode: "slot"
                                                                    };
                                                                });
                                                            }}
                                                            className="mt-1 h-4 w-4 rounded text-indigo-600"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-semibold text-gray-900 dark:text-white">
                                                                {slot.slot_name} ({t("workflow_agents.slot_prefix")} {slot.slot_id})
                                                            </div>
                                                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                                {slot.phone_number || t("workflow_agents.slot_phone_missing")}
                                                            </div>
                                                            <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                                                                {t("workflow_agents.slot_account_label")}: {selectedLocationName}
                                                            </div>
                                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setOpenSlotKeyEditorId((prev) => (prev === slot.slot_id ? null : slot.slot_id))}
                                                                    className="rounded-xl border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                                >
                                                                    {slot.has_openai_api_key ? t("workflow_agents.slot_key_replace") : t("workflow_agents.slot_key_add")}
                                                                </button>
                                                                {slot.has_openai_api_key ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => clearSlotOpenAiKey(slot.slot_id)}
                                                                        disabled={isSavingThisSlotKey}
                                                                        className="rounded-xl border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/20"
                                                                    >
                                                                        {isSavingThisSlotKey ? t("workflow_agents.slot_key_saving") : t("workflow_agents.slot_key_remove")}
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                            {isKeyEditorOpen ? (
                                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                                    <input
                                                                        type="password"
                                                                        value={slotKeyDraft}
                                                                        onChange={(event) => {
                                                                            const nextValue = event.target.value;
                                                                            setSlotKeyDrafts((prev) => ({ ...prev, [slot.slot_id]: nextValue }));
                                                                        }}
                                                                        onKeyDown={(event) => {
                                                                            if (event.key === "Enter") {
                                                                                event.preventDefault();
                                                                                saveSlotOpenAiKey(slot.slot_id, slotKeyDraft);
                                                                            }
                                                                        }}
                                                                        placeholder={t("workflow_agents.slot_key_placeholder")}
                                                                        className="min-w-[220px] flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => saveSlotOpenAiKey(slot.slot_id, slotKeyDraft)}
                                                                        disabled={isSavingThisSlotKey}
                                                                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        {isSavingThisSlotKey ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                                                        {isSavingThisSlotKey ? t("workflow_agents.slot_key_saving") : t("workflow_agents.slot_key_save")}
                                                                    </button>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                            slot.has_openai_api_key
                                                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300"
                                                                : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                                                        }`}>
                                                            {slot.has_openai_api_key ? t("workflow_agents.slot_has_key") : t("workflow_agents.slot_missing_key")}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                                            {selectedSlotCount === 0
                                                ? t("workflow_agents.credentials_help_slot_pick")
                                                : (selectedSlotsWithKeysCount === 0
                                                    ? t("workflow_agents.credentials_help_slot_missing_for_selected")
                                                    : (selectedSlotsWithKeysCount < selectedSlotCount
                                                        ? t("workflow_agents.credentials_help_slot_partial")
                                                            .replace("{ready}", String(selectedSlotsWithKeysCount))
                                                            .replace("{total}", String(selectedSlotCount))
                                                        : t("workflow_agents.credentials_help_slot_selected")))}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                                        <div className="font-semibold text-gray-900 dark:text-white">{t("workflow_agents.integration_slot_title")}</div>
                                        <div className="mt-2 leading-6">
                                            {t("workflow_agents.integration_slot_desc")}
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

                                            {item.key === "ghl" && binding.enabled ? (
                                                <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-900/10 dark:text-indigo-100">
                                                    <div className="font-semibold">{t("workflow_agents.integration_ghl_binding_note")}</div>
                                                    {selectedSlotCount > 0 ? (
                                                        <>
                                                            <div className="mt-2 text-xs leading-6">
                                                                {t("workflow_agents.integration_ghl_slot_bound")
                                                                    .replace("{count}", String(selectedSlotCount))}
                                                            </div>
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {selectedSlots.map((slot) => (
                                                                    <span
                                                                        key={`ghl-slot-${slot.slot_id}`}
                                                                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                                                            slot.has_openai_api_key
                                                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-200"
                                                                                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200"
                                                                        }`}
                                                                    >
                                                                        {slot.slot_name} ({t("workflow_agents.slot_prefix")} {slot.slot_id})
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            {selectedSlotsWithoutKeys.length > 0 ? (
                                                                <div className="mt-3 text-xs leading-6 text-amber-800 dark:text-amber-200">
                                                                    {t("workflow_agents.integration_ghl_slot_partial")
                                                                        .replace("{ready}", String(selectedSlotsWithKeysCount))
                                                                        .replace("{total}", String(selectedSlotCount))}
                                                                </div>
                                                            ) : null}
                                                        </>
                                                    ) : (
                                                        <div className="mt-2 text-xs leading-6">
                                                            {t("workflow_agents.integration_ghl_slot_missing")}
                                                        </div>
                                                    )}
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
            )}
        </div>
    );
}
