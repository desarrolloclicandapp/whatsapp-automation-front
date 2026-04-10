import React, { useEffect, useState } from "react";
import { Bot, Copy, Loader2, Pencil, Play, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "../context/LanguageContext";

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

const EMPTY_FORM = {
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
    use_contact_context: true
};

function formatRunTimestamp(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString();
}

function formatDuration(value) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return "0 ms";
    if (parsed < 1000) return `${parsed} ms`;
    return `${(parsed / 1000).toFixed(1)} s`;
}

function WorkflowAgentsPanel({ locations = [], onUnauthorized, token }) {
    const { t } = useLanguage();
    const [selectedLocationId, setSelectedLocationId] = useState("");
    const [workspace, setWorkspace] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [editingAgentId, setEditingAgentId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [testMessage, setTestMessage] = useState("");
    const [testResult, setTestResult] = useState(null);

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

    const applyAgentToForm = (agent) => {
        if (!agent) {
            setEditingAgentId(null);
            setForm(EMPTY_FORM);
            setTestResult(null);
            return;
        }

        setEditingAgentId(agent.id);
        setForm({
            name: agent.name || "",
            agent_key: agent.agent_key || "",
            status: agent.status || "active",
            slot_id: agent.slot_id ? String(agent.slot_id) : "",
            model: agent.model || "gpt-4o-mini",
            temperature: String(agent.temperature ?? "0.4"),
            max_output_chars: String(agent.max_output_chars ?? "600"),
            system_prompt: agent.system_prompt || "",
            fallback_reply: agent.fallback_reply || "",
            description: agent.description || "",
            use_contact_context: agent.use_contact_context !== false
        });
        setTestResult(null);
    };

    const loadWorkspace = async (locationId, { preserveSelection = true } = {}) => {
        const safeLocationId = String(locationId || "").trim();
        if (!safeLocationId) return;

        setLoading(true);
        try {
            const res = await authFetch(`/agency/workflow-agents?locationId=${encodeURIComponent(safeLocationId)}`);
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || t("workflow_agents.load_error"));
            }

            setWorkspace(data);

            if (!preserveSelection) {
                applyAgentToForm(data.agents?.[0] || null);
            } else if (editingAgentId) {
                const refreshed = (data.agents || []).find((agent) => agent.id === editingAgentId);
                if (refreshed) {
                    applyAgentToForm(refreshed);
                }
            }
        } catch (error) {
            toast.error(t("workflow_agents.load_error"), {
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedLocationId) return;
        loadWorkspace(selectedLocationId, { preserveSelection: false });
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
            const endpoint = editingAgentId
                ? `/agency/workflow-agents/${editingAgentId}`
                : "/agency/workflow-agents";
            const method = editingAgentId ? "PUT" : "POST";
            const payload = {
                ...form,
                locationId: selectedLocationId,
                slot_id: form.slot_id ? Number.parseInt(form.slot_id, 10) : null,
                temperature: Number.parseFloat(form.temperature || "0.4"),
                max_output_chars: Number.parseInt(form.max_output_chars || "600", 10)
            };

            const res = await authFetch(endpoint, {
                method,
                body: JSON.stringify(payload)
            });
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || t("workflow_agents.save_error"));
            }

            toast.success(t("workflow_agents.saved_success"));
            await loadWorkspace(selectedLocationId, { preserveSelection: false });
            if (data.agent) {
                applyAgentToForm(data.agent);
            }
        } catch (error) {
            toast.error(t("workflow_agents.save_error"), {
                description: error.message
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (agent) => {
        if (!agent?.id || !selectedLocationId) return;

        const confirmed = window.confirm(t("workflow_agents.delete_confirm"));
        if (!confirmed) return;

        try {
            const res = await authFetch(
                `/agency/workflow-agents/${agent.id}?locationId=${encodeURIComponent(selectedLocationId)}`,
                { method: "DELETE" }
            );
            const data = await parseResponse(res);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || t("workflow_agents.delete_error"));
            }

            toast.success(t("workflow_agents.deleted_success"));
            setEditingAgentId(null);
            setForm(EMPTY_FORM);
            setTestResult(null);
            await loadWorkspace(selectedLocationId, { preserveSelection: false });
        } catch (error) {
            toast.error(t("workflow_agents.delete_error"), {
                description: error.message
            });
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
            await loadWorkspace(selectedLocationId);
        } catch (error) {
            toast.error(t("workflow_agents.test_error"), {
                description: error.message
            });
        } finally {
            setTesting(false);
        }
    };

    const selectedLocation = locations.find((location) => String(location.location_id) === String(selectedLocationId)) || null;
    const agents = Array.isArray(workspace?.agents) ? workspace.agents : [];
    const slots = Array.isArray(workspace?.slots) ? workspace.slots : [];
    const recentRuns = Array.isArray(workspace?.recent_runs) ? workspace.recent_runs : [];
    const setup = workspace?.setup || null;
    const credentials = workspace?.credentials || null;
    const activeAgentCount = agents.filter((agent) => agent.status === "active").length;
    const translateRunSource = (source) => {
        const safeSource = String(source || "").trim().toLowerCase();
        if (!safeSource) return t("workflow_agents.run_source_unknown");
        return t(`workflow_agents.run_source_${safeSource}`) || safeSource;
    };
    const translateRunStatus = (status) => {
        const safeStatus = String(status || "").trim().toLowerCase();
        if (!safeStatus) return t("workflow_agents.run_status_unknown");
        return t(`workflow_agents.run_status_${safeStatus}`) || safeStatus;
    };

    if (!locations.length) {
        return (
            <div className="max-w-5xl mx-auto">
                <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <Bot className="mx-auto mb-4 text-indigo-500" size={40} />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {t("workflow_agents.empty_locations")}
                    </h3>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        {t("workflow_agents.title")}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {t("workflow_agents.subtitle")}
                    </p>
                </div>

                <div className="w-full max-w-md">
                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                        {t("workflow_agents.location_label")}
                    </label>
                    <select
                        value={selectedLocationId}
                        onChange={(event) => {
                            setSelectedLocationId(event.target.value);
                            setEditingAgentId(null);
                            setForm(EMPTY_FORM);
                            setTestResult(null);
                        }}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
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
                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                        {t("workflow_agents.total_agents")}
                    </div>
                    <div className="mt-3 text-3xl font-black text-gray-900 dark:text-white">
                        {agents.length}
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {selectedLocation?.name || selectedLocationId}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                        {t("workflow_agents.active_agents")}
                    </div>
                    <div className="mt-3 text-3xl font-black text-gray-900 dark:text-white">
                        {activeAgentCount}
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {t("workflow_agents.status_active")}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                        {t("workflow_agents.recent_runs")}
                    </div>
                    <div className="mt-3 text-3xl font-black text-gray-900 dark:text-white">
                        {recentRuns.length}
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {t("workflow_agents.recent_runs_desc")}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                        {t("workflow_agents.credentials_label")}
                    </div>
                    <div className="mt-3 text-base font-bold text-gray-900 dark:text-white">
                        {credentials?.has_agency_openai_key
                            ? t("workflow_agents.credentials_agency")
                            : credentials?.has_any_slot_openai_key
                                ? t("workflow_agents.credentials_slot")
                                : t("workflow_agents.credentials_missing")}
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {workspace?.location?.has_ghl_token
                            ? t("workflow_agents.location_linked")
                            : t("workflow_agents.location_not_linked")}
                    </p>
                </div>
            </div>

            <div className="grid gap-8 xl:grid-cols-[1.15fr,0.85fr]">
                <div className="space-y-6">
                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {t("workflow_agents.setup_title")}
                                </h4>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {t("workflow_agents.setup_desc")}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => loadWorkspace(selectedLocationId)}
                                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                {t("workflow_agents.refresh")}
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                                    {t("workflow_agents.setup_endpoint")}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={setup?.execute_url || ""}
                                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(setup?.execute_url || "")}
                                        className="rounded-2xl border border-gray-200 px-4 py-3 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                                        {t("workflow_agents.setup_header")}
                                    </div>
                                    <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                                        {setup?.secret_header_name || "x-waflow-action-secret"}
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {setup?.secret_configured
                                            ? t("workflow_agents.setup_secret_ready")
                                            : t("workflow_agents.setup_secret_missing")}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                                        {t("workflow_agents.setup_action_key")}
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                        <span>{setup?.action_key || "waflow_ai_agent"}</span>
                                        <button type="button" onClick={() => handleCopy(setup?.action_key || "waflow_ai_agent")} className="text-gray-400 hover:text-indigo-500">
                                            <Copy size={15} />
                                        </button>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {t("workflow_agents.setup_action_key_desc")}
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                                        {t("workflow_agents.setup_fields")}
                                    </div>
                                    <div className="space-y-2">
                                        {(setup?.suggested_fields || []).map((field) => (
                                            <div key={field.key} className="rounded-2xl border border-gray-200 px-4 py-3 dark:border-gray-700">
                                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    {field.key}
                                                </div>
                                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                    {field.description}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                                        {t("workflow_agents.setup_outputs")}
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {(setup?.output_fields || []).map((field) => (
                                            <div key={field} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                                                {field}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                {t("workflow_agents.recent_history")}
                            </h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {t("workflow_agents.recent_history_desc")}
                            </p>
                        </div>

                        <div className="space-y-3">
                            {recentRuns.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    {t("workflow_agents.no_runs")}
                                </div>
                            )}

                            {recentRuns.map((run) => (
                                <div key={run.id} className="rounded-2xl border border-gray-200 px-4 py-4 dark:border-gray-700">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                {run.agent_name || run.agent_key || t("workflow_agents.unknown_agent")}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                {formatRunTimestamp(run.executed_at)}
                                            </div>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                            run.status === "completed"
                                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300"
                                                : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                                        }`}>
                                            {translateRunStatus(run.status)}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid gap-2 text-xs text-gray-500 dark:text-gray-400 md:grid-cols-3">
                                        <span>{t("workflow_agents.run_source")}: {translateRunSource(run.source)}</span>
                                        <span>{t("workflow_agents.run_duration")}: {formatDuration(run.duration_ms)}</span>
                                        <span>{t("workflow_agents.run_status")}: {translateRunStatus(run.status)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <form onSubmit={handleSave} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-5">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingAgentId ? t("workflow_agents.edit_agent") : t("workflow_agents.new_agent")}
                            </h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {t("workflow_agents.form_desc")}
                            </p>
                        </div>

                        <div className="grid gap-4">
                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_name")}</label>
                                <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_key")}</label>
                                    <input value={form.agent_key} onChange={(event) => setForm((prev) => ({ ...prev, agent_key: event.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_status")}</label>
                                    <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                                        <option value="active">{t("workflow_agents.status_active")}</option>
                                        <option value="draft">{t("workflow_agents.status_draft")}</option>
                                        <option value="paused">{t("workflow_agents.status_paused")}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_slot")}</label>
                                    <select value={form.slot_id} onChange={(event) => setForm((prev) => ({ ...prev, slot_id: event.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
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
                                    <input value={form.model} onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_temperature")}</label>
                                    <input type="number" min="0" max="1" step="0.1" value={form.temperature} onChange={(event) => setForm((prev) => ({ ...prev, temperature: event.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_max_chars")}</label>
                                    <input type="number" min="120" max="4000" step="20" value={form.max_output_chars} onChange={(event) => setForm((prev) => ({ ...prev, max_output_chars: event.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_prompt")}</label>
                                <textarea rows={7} value={form.system_prompt} onChange={(event) => setForm((prev) => ({ ...prev, system_prompt: event.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_fallback")}</label>
                                <textarea rows={3} value={form.fallback_reply} onChange={(event) => setForm((prev) => ({ ...prev, fallback_reply: event.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">{t("workflow_agents.field_description")}</label>
                                <textarea rows={3} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                            </div>

                            <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                <input type="checkbox" checked={form.use_contact_context} onChange={(event) => setForm((prev) => ({ ...prev, use_contact_context: event.target.checked }))} className="h-4 w-4 rounded text-indigo-600" />
                                {t("workflow_agents.field_use_contact_context")}
                            </label>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center gap-3">
                            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {editingAgentId ? t("workflow_agents.save_update") : t("workflow_agents.save_create")}
                            </button>
                            <button type="button" onClick={() => applyAgentToForm(null)} className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                                {t("workflow_agents.cancel_edit")}
                            </button>
                        </div>
                    </form>

                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                {t("workflow_agents.test_title")}
                            </h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {editingAgentId ? t("workflow_agents.test_desc") : t("workflow_agents.test_need_agent")}
                            </p>
                        </div>

                        <textarea
                            rows={4}
                            value={testMessage}
                            onChange={(event) => setTestMessage(event.target.value)}
                            placeholder={t("workflow_agents.test_placeholder")}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
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

                        {testResult && (
                            <div className="mt-5 space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                        testResult.status === "completed"
                                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300"
                                            : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                                    }`}>
                                        {translateRunStatus(testResult.status)}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {testResult.intent || "general"}
                                    </span>
                                </div>
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                                        {t("workflow_agents.test_result")}
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                                        {testResult.reply_text || "—"}
                                    </p>
                                </div>
                                {testResult.summary && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {testResult.summary}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WorkflowAgentsPanel;

                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {t("workflow_agents.agent_list_title")}
                                </h4>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {t("workflow_agents.agent_list_desc")}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => applyAgentToForm(null)}
                                className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500"
                            >
                                {t("workflow_agents.new_agent")}
                            </button>
                        </div>

                        <div className="space-y-3">
                            {agents.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    {t("workflow_agents.no_agents")}
                                </div>
                            )}

                            {agents.map((agent) => (
                                <div
                                    key={agent.id}
                                    className={`rounded-2xl border px-4 py-4 transition ${
                                        editingAgentId === agent.id
                                            ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-900/20"
                                            : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                                    }`}
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="text-base font-bold text-gray-900 dark:text-white">
                                                    {agent.name}
                                                </div>
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                                    agent.status === "active"
                                                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300"
                                                        : agent.status === "paused"
                                                            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                                                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                                }`}>
                                                    {t(`workflow_agents.status_${agent.status}`)}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="rounded-full border border-gray-200 px-2.5 py-1 dark:border-gray-700">
                                                    {agent.agent_key}
                                                </span>
                                                <span>{agent.model}</span>
                                                <span>•</span>
                                                <span>{agent.slot_id ? `${t("workflow_agents.slot_prefix")} ${agent.slot_id}` : t("workflow_agents.slot_any")}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => handleCopy(agent.agent_key)} className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                                                <Copy size={16} />
                                            </button>
                                            <button type="button" onClick={() => applyAgentToForm(agent)} className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                                                <Pencil size={16} />
                                            </button>
                                            <button type="button" onClick={() => handleDelete(agent)} className="rounded-xl border border-red-200 p-2 text-red-500 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
