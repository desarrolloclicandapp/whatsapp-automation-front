import React, { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Pencil, Play, RefreshCw, Save, Search, Trash2 } from "lucide-react";
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
        slot_id: "",
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
        slot_id: agent?.slot_id ? String(agent.slot_id) : "",
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

function MetricCard({ label, value, detail }) {
    return (
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{label}</div>
            <div className="mt-3 text-3xl font-black text-gray-900 dark:text-white">{value}</div>
            {detail ? <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{detail}</div> : null}
        </div>
    );
}

export default function WorkflowAgentsPanel({ locations = [], onUnauthorized, token }) {
    const { t } = useLanguage();
    const [selectedLocationId, setSelectedLocationId] = useState("");
    const [workspace, setWorkspace] = useState(null);
    const [editingAgentId, setEditingAgentId] = useState(null);
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
            return;
        }

        setEditingAgentId(agent.id);
        setForm(buildFormFromAgent(agent, catalog));
        setTestResult(null);
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
            const endpoint = editingAgentId ? `/agency/workflow-agents/${editingAgentId}` : "/agency/workflow-agents";
            const method = editingAgentId ? "PUT" : "POST";
            const payload = {
                ...form,
                locationId: selectedLocationId,
                slot_id: form.slot_id ? Number.parseInt(form.slot_id, 10) : null,
                temperature: Number.parseFloat(form.temperature || "0.4"),
                max_output_chars: Number.parseInt(form.max_output_chars || "600", 10),
                integrations: form.integrations
            };

            const res = await authFetch(endpoint, {
                method,
                body: JSON.stringify(payload)
            });
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) throw new Error(data?.error || t("workflow_agents.save_error"));

            toast.success(t("workflow_agents.saved_success"));
            await loadWorkspace(selectedLocationId, false);
            if (data.agent) {
                const refreshed = {
                    ...data.agent,
                    integrations: data.agent.integrations || form.integrations
                };
                applyAgentToForm(refreshed, {
                    ...(workspace || {}),
                    integration_catalog: workspace?.integration_catalog || []
                });
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
            const res = await authFetch(`/agency/workflow-agents/${agent.id}?locationId=${encodeURIComponent(selectedLocationId)}`, {
                method: "DELETE"
            });
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
            toast.error(t("workflow_agents.test_error"), { description: error.message });
        } finally {
            setTesting(false);
        }
    };

    const catalog = Array.isArray(workspace?.integration_catalog) ? workspace.integration_catalog : [];
    const agents = Array.isArray(workspace?.agents) ? workspace.agents : [];
    const recentRuns = Array.isArray(workspace?.recent_runs) ? workspace.recent_runs : [];
    const slots = Array.isArray(workspace?.slots) ? workspace.slots : [];
    const credentials = workspace?.credentials || null;
    const summary = workspace?.integration_summary || {};
    const activeCount = agents.filter((agent) => agent.status === "active").length;

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
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">{t("workflow_agents.title")}</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.subtitle")}</p>
                </div>
                <div className="w-full max-w-md">
                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                        {t("workflow_agents.location_label")}
                    </label>
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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label={t("workflow_agents.total_agents")} value={agents.length} />
                <MetricCard label={t("workflow_agents.active_agents")} value={activeCount} />
                <MetricCard
                    label={t("workflow_agents.live_integrations")}
                    value={summary.enabled_bindings || 0}
                    detail={`${summary?.by_integration?.ghl || 0} GHL | ${summary?.by_integration?.chatwoot || 0} Chatwoot`}
                />
                <MetricCard label={t("workflow_agents.recent_runs")} value={recentRuns.length} />
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{t("workflow_agents.credentials_label")}</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                            {credentials?.has_agency_openai_key
                                ? t("workflow_agents.credentials_agency")
                                : credentials?.has_any_slot_openai_key
                                    ? t("workflow_agents.credentials_slot")
                                    : t("workflow_agents.credentials_missing")}
                        </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.credentials_desc")}</div>
                </div>
            </div>

            <div className="grid gap-8 xl:grid-cols-[1.05fr,0.95fr]">
                <div className="space-y-6">
                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{t("workflow_agents.integrations_title")}</h4>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.integrations_desc")}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => loadWorkspace(selectedLocationId, false)}
                                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                {t("workflow_agents.refresh")}
                            </button>
                        </div>
                        <div className="space-y-3">
                            {catalog.map((item) => (
                                <div key={item.key} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="text-base font-bold text-gray-900 dark:text-white">{getIntegrationTitle(t, item.key)}</div>
                                                <StatusPill label={getIntegrationStatusLabel(t, item.status)} kind={getIntegrationStatusKind(item.status)} />
                                                <StatusPill
                                                    label={item.supports_execution ? t("workflow_agents.integration_live_badge") : t("workflow_agents.integration_planned_badge")}
                                                    kind={item.supports_execution ? "good" : "neutral"}
                                                />
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{getIntegrationDescription(t, item.key)}</p>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {t("workflow_agents.integration_bound_agents")}: {item.enabled_agents || 0}
                                            </div>
                                        </div>
                                        {item.key === "ghl" && item.setup ? (
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(item.setup.execute_url || "")}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                                >
                                                    <Copy size={14} />
                                                    {t("workflow_agents.setup_copy_endpoint")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(item.setup.action_key || "")}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                                >
                                                    <Copy size={14} />
                                                    {t("workflow_agents.setup_copy_action")}
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                        {item.key === "ghl"
                                            ? (item.connected ? t("workflow_agents.integration_ghl_ready_hint") : t("workflow_agents.integration_ghl_setup_hint"))
                                            : (item.connected ? t("workflow_agents.integration_chatwoot_ready_hint") : t("workflow_agents.integration_chatwoot_setup_hint"))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{t("workflow_agents.agent_list_title")}</h4>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.agent_list_desc")}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => applyAgentToForm(null)}
                                className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500"
                            >
                                {t("workflow_agents.new_agent")}
                            </button>
                        </div>

                        <div className="mb-4 relative">
                            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={agentQuery}
                                onChange={(event) => setAgentQuery(event.target.value)}
                                placeholder={t("workflow_agents.search_placeholder")}
                                className={`${inputClassName} pl-11`}
                            />
                        </div>

                        <div className="space-y-3">
                            {filteredAgents.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    {agents.length === 0 ? t("workflow_agents.no_agents") : t("workflow_agents.no_search_results")}
                                </div>
                            ) : null}

                            {filteredAgents.map((agent) => (
                                <div
                                    key={agent.id}
                                    className={`rounded-2xl border px-4 py-4 transition ${
                                        editingAgentId === agent.id
                                            ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-900/20"
                                            : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                                    }`}
                                >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="text-base font-bold text-gray-900 dark:text-white">{agent.name}</div>
                                                <StatusPill
                                                    label={t(`workflow_agents.status_${agent.status}`)}
                                                    kind={agent.status === "active" ? "good" : agent.status === "paused" ? "warn" : "neutral"}
                                                />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="rounded-full border border-gray-200 px-2.5 py-1 dark:border-gray-700">{agent.agent_key}</span>
                                                <span>{agent.model}</span>
                                                <span>-</span>
                                                <span>{agent.slot_id ? `${t("workflow_agents.slot_prefix")} ${agent.slot_id}` : t("workflow_agents.slot_any")}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {Array.isArray(agent.enabled_integrations) && agent.enabled_integrations.length > 0 ? (
                                                    agent.enabled_integrations.map((integrationKey) => (
                                                        <StatusPill key={`${agent.id}-${integrationKey}`} label={getIntegrationTitle(t, integrationKey)} kind="neutral" />
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{t("workflow_agents.no_integrations_bound")}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(agent.agent_key)}
                                                className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                            >
                                                <Copy size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyAgentToForm(agent)}
                                                className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(agent)}
                                                className="rounded-xl border border-red-200 p-2 text-red-500 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">{t("workflow_agents.recent_history")}</h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.recent_history_desc")}</p>
                        </div>
                        <div className="space-y-3">
                            {recentRuns.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    {t("workflow_agents.no_runs")}
                                </div>
                            ) : null}
                            {recentRuns.map((run) => (
                                <div key={run.id} className="rounded-2xl border border-gray-200 px-4 py-4 dark:border-gray-700">
                                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                {run.agent_name || run.agent_key || t("workflow_agents.unknown_agent")}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatRunTimestamp(run.executed_at)}</div>
                                        </div>
                                        <StatusPill
                                            label={getRunStatusLabel(t, run.status)}
                                            kind={run.status === "completed" ? "good" : run.status === "error" ? "warn" : "neutral"}
                                        />
                                    </div>
                                    <div className="mt-3 grid gap-2 text-xs text-gray-500 dark:text-gray-400 md:grid-cols-3">
                                        <span>{t("workflow_agents.run_source")}: {getRunSourceLabel(t, run.source)}</span>
                                        <span>{t("workflow_agents.run_duration")}: {formatDuration(run.duration_ms)}</span>
                                        <span>{t("workflow_agents.run_status")}: {getRunStatusLabel(t, run.status)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-5">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingAgentId ? t("workflow_agents.edit_agent") : t("workflow_agents.new_agent")}
                            </h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.form_desc")}</p>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_name")}</label>
                                <input
                                    value={form.name}
                                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                                    className={inputClassName}
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_key")}</label>
                                    <input
                                        value={form.agent_key}
                                        onChange={(event) => setForm((prev) => ({ ...prev, agent_key: event.target.value }))}
                                        className={inputClassName}
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_status")}</label>
                                    <select
                                        value={form.status}
                                        onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                                        className={inputClassName}
                                    >
                                        <option value="active">{t("workflow_agents.status_active")}</option>
                                        <option value="draft">{t("workflow_agents.status_draft")}</option>
                                        <option value="paused">{t("workflow_agents.status_paused")}</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_slot")}</label>
                                    <select
                                        value={form.slot_id}
                                        onChange={(event) => setForm((prev) => ({ ...prev, slot_id: event.target.value }))}
                                        className={inputClassName}
                                    >
                                        <option value="">{t("workflow_agents.slot_any")}</option>
                                        {slots.map((slot) => (
                                            <option key={slot.slot_id} value={slot.slot_id}>
                                                {slot.slot_name} ({t("workflow_agents.slot_prefix")} {slot.slot_id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_model")}</label>
                                    <input
                                        value={form.model}
                                        onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                                        className={inputClassName}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_temperature")}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={form.temperature}
                                        onChange={(event) => setForm((prev) => ({ ...prev, temperature: event.target.value }))}
                                        className={inputClassName}
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_max_chars")}</label>
                                    <input
                                        type="number"
                                        min="120"
                                        max="4000"
                                        step="20"
                                        value={form.max_output_chars}
                                        onChange={(event) => setForm((prev) => ({ ...prev, max_output_chars: event.target.value }))}
                                        className={inputClassName}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_prompt")}</label>
                                <textarea
                                    rows={7}
                                    value={form.system_prompt}
                                    onChange={(event) => setForm((prev) => ({ ...prev, system_prompt: event.target.value }))}
                                    className={inputClassName}
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_fallback")}</label>
                                <textarea
                                    rows={3}
                                    value={form.fallback_reply}
                                    onChange={(event) => setForm((prev) => ({ ...prev, fallback_reply: event.target.value }))}
                                    className={inputClassName}
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_description")}</label>
                                <textarea
                                    rows={3}
                                    value={form.description}
                                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                                    className={inputClassName}
                                />
                            </div>
                            <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                <input
                                    type="checkbox"
                                    checked={form.use_contact_context}
                                    onChange={(event) => setForm((prev) => ({ ...prev, use_contact_context: event.target.checked }))}
                                    className="h-4 w-4 rounded text-indigo-600"
                                />
                                {t("workflow_agents.field_use_contact_context")}
                            </label>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    {editingAgentId ? t("workflow_agents.save_update") : t("workflow_agents.save_create")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyAgentToForm(null)}
                                    className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    {t("workflow_agents.cancel_edit")}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">{t("workflow_agents.integration_config_title")}</h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("workflow_agents.integration_config_desc")}</p>
                        </div>
                        <div className="space-y-4">
                            {catalog.map((item) => {
                                const binding = form.integrations?.[item.key] || { enabled: false, config: {} };
                                return (
                                    <div key={item.key} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="text-sm font-bold text-gray-900 dark:text-white">{getIntegrationTitle(t, item.key)}</div>
                                                    <StatusPill label={getIntegrationStatusLabel(t, item.status)} kind={getIntegrationStatusKind(item.status)} />
                                                    <StatusPill
                                                        label={binding.enabled ? t("workflow_agents.integration_bound_badge") : t("workflow_agents.integration_not_bound_badge")}
                                                        kind={binding.enabled ? "good" : "neutral"}
                                                    />
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
                                                            [item.key]: {
                                                                enabled: event.target.checked,
                                                                config: prev.integrations?.[item.key]?.config || {}
                                                            }
                                                        }
                                                    }))}
                                                    className="h-4 w-4 rounded text-indigo-600"
                                                />
                                                {t("workflow_agents.integration_enable_toggle")}
                                            </label>
                                        </div>

                                        {item.key === "ghl" && item.setup && binding.enabled ? (
                                            <div className="mt-4 space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-900/10">
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(item.setup.execute_url || "")}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-800 dark:bg-gray-900 dark:text-indigo-200"
                                                    >
                                                        <Copy size={14} />
                                                        {t("workflow_agents.setup_copy_endpoint")}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(item.setup.action_key || "")}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-800 dark:bg-gray-900 dark:text-indigo-200"
                                                    >
                                                        <Copy size={14} />
                                                        {t("workflow_agents.setup_copy_action")}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(item.setup.secret_header_name || "")}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-800 dark:bg-gray-900 dark:text-indigo-200"
                                                    >
                                                        <Copy size={14} />
                                                        {t("workflow_agents.setup_copy_header")}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-indigo-700 dark:text-indigo-200">{t("workflow_agents.integration_ghl_binding_note")}</p>
                                            </div>
                                        ) : null}

                                        {item.key === "chatwoot" ? (
                                            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                                {binding.enabled
                                                    ? t("workflow_agents.integration_chatwoot_binding_note")
                                                    : t("workflow_agents.integration_chatwoot_idle_note")}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">{t("workflow_agents.test_title")}</h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {editingAgentId ? t("workflow_agents.test_desc") : t("workflow_agents.test_need_agent")}
                            </p>
                        </div>
                        <textarea
                            rows={4}
                            value={testMessage}
                            onChange={(event) => setTestMessage(event.target.value)}
                            placeholder={t("workflow_agents.test_placeholder")}
                            className={inputClassName}
                        />
                        <button
                            type="button"
                            disabled={!editingAgentId || testing}
                            onClick={handleRunTest}
                            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900"
                        >
                            {testing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                            {t("workflow_agents.run_test")}
                        </button>
                        {testResult ? (
                            <div className="mt-5 space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusPill label={getRunStatusLabel(t, testResult.status)} kind={testResult.status === "completed" ? "good" : "warn"} />
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{testResult.intent || "general"}</span>
                                </div>
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{t("workflow_agents.test_result")}</div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{testResult.reply_text || "-"}</p>
                                </div>
                                {testResult.summary ? <div className="text-xs text-gray-500 dark:text-gray-400">{testResult.summary}</div> : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
