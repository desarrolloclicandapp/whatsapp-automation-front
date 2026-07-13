import React, { useEffect, useMemo, useState } from "react";
import { Check, FileText, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

function officialSettings(slot = {}) {
    return slot?.settings?.official_api || {};
}

function isReadyOfficialSlot(slot = {}) {
    const official = officialSettings(slot);
    const mode = String(slot?.settings?.connection_mode || "").toLowerCase();
    return (mode === "official_api" || official.businessAccountId || official.phoneNumberId) &&
        Boolean(official.phoneNumberId && (official.hasAccessToken || official.accessToken || official.accessTokenEncrypted || official.accessTokenMasked));
}

function portfolioKey(slot = {}) {
    return String(slot.metaBusinessId || slot.businessAccountId || `slot:${slot.locationId}:${slot.slotId}`).trim();
}

function templateKey(template = {}) {
    return `${String(template.name || "").trim()}:${String(template.language || "").trim()}`;
}

export default function TemplateVisibilityManager({ locations = [], token, onUnauthorized }) {
    const [slots, setSlots] = useState([]);
    const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
    const [templates, setTemplates] = useState([]);
    const [selectedKeys, setSelectedKeys] = useState(new Set());
    const [configured, setConfigured] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [saving, setSaving] = useState(false);

    const authFetch = async (endpoint, options = {}) => {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) }
        });
        if (response.status === 401 && onUnauthorized) onUnauthorized();
        return response;
    };

    const portfolios = useMemo(() => {
        const grouped = new Map();
        slots.forEach((slot) => {
            const key = portfolioKey(slot);
            if (!grouped.has(key)) grouped.set(key, { id: key, name: slot.metaBusinessName || key, slots: [] });
            grouped.get(key).slots.push(slot);
        });
        return [...grouped.values()];
    }, [slots]);

    const loadSlots = async () => {
        setLoading(true);
        try {
            const loaded = (await Promise.all((locations || []).map(async (location) => {
                const locationId = String(location?.location_id || "").trim();
                if (!locationId) return [];
                const response = await authFetch(`/agency/location-details/${encodeURIComponent(locationId)}`);
                if (!response.ok) return [];
                const data = await response.json();
                return (Array.isArray(data.slots) ? data.slots : [])
                    .filter(isReadyOfficialSlot)
                    .map((slot) => {
                        const official = officialSettings(slot);
                        return {
                            locationId,
                            locationName: data.name || location.name || locationId,
                            slotId: slot.slot_id,
                            slotName: slot.slot_name || `Slot ${slot.slot_id}`,
                            businessAccountId: official.businessAccountId || "",
                            metaBusinessId: official.metaBusinessId || official.embeddedSignupBusinessId || "",
                            metaBusinessName: official.metaBusinessName || ""
                        };
                    });
            }))).flat();

            const resolved = await Promise.all(loaded.map(async (slot) => {
                if (slot.metaBusinessId) return slot;
                const query = new URLSearchParams({ locationId: slot.locationId, slotId: String(slot.slotId) });
                const response = await authFetch(`/agency/whatsapp-official/template-portfolio?${query}`);
                const data = response.ok ? await response.json() : {};
                return { ...slot, metaBusinessId: data.metaBusinessId || "", metaBusinessName: data.metaBusinessName || "" };
            }));
            setSlots(resolved);
            setSelectedPortfolioId((current) => current && resolved.some((slot) => portfolioKey(slot) === current)
                ? current
                : (resolved[0] ? portfolioKey(resolved[0]) : ""));
        } catch (error) {
            toast.error("No se pudieron cargar los portfolios Meta", { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const loadPortfolioTemplates = async (portfolioId) => {
        const portfolio = portfolios.find((item) => item.id === portfolioId);
        if (!portfolio) return;
        setLoadingTemplates(true);
        try {
            const responses = await Promise.all(portfolio.slots.map(async (slot) => {
                const query = new URLSearchParams({ locationId: slot.locationId, slotId: String(slot.slotId) });
                const response = await authFetch(`/agency/whatsapp-official/templates?${query}`);
                const data = response.ok ? await response.json() : {};
                return Array.isArray(data.templates) ? data.templates : [];
            }));
            const unique = new Map();
            responses.flat().forEach((template) => {
                if (String(template?.status || "").toUpperCase() !== "APPROVED") return;
                unique.set(templateKey(template), template);
            });
            setTemplates([...unique.values()].sort((a, b) => templateKey(a).localeCompare(templateKey(b))));

            const locationId = portfolio.slots[0]?.locationId || "";
            const query = new URLSearchParams({ locationId, portfolioId });
            const visibilityResponse = await authFetch(`/agency/whatsapp-official/template-visibility?${query}`);
            const visibility = visibilityResponse.ok ? await visibilityResponse.json() : {};
            const hasConfig = visibility.configured === true;
            setConfigured(hasConfig);
            setSelectedKeys(new Set(hasConfig
                ? (Array.isArray(visibility.templateKeys) ? visibility.templateKeys : [])
                : [...unique.keys()]));
        } catch (error) {
            toast.error("No se pudieron cargar las plantillas", { description: error.message });
            setTemplates([]);
        } finally {
            setLoadingTemplates(false);
        }
    };

    useEffect(() => { loadSlots(); }, [locations]);
    useEffect(() => { if (selectedPortfolioId) loadPortfolioTemplates(selectedPortfolioId); }, [selectedPortfolioId, portfolios.length]);

    const toggleTemplate = (key) => {
        setConfigured(true);
        setSelectedKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const saveVisibility = async () => {
        const portfolio = portfolios.find((item) => item.id === selectedPortfolioId);
        const locationId = portfolio?.slots[0]?.locationId || "";
        if (!selectedPortfolioId || !locationId) return;
        setSaving(true);
        try {
            const response = await authFetch("/agency/whatsapp-official/template-visibility", {
                method: "PUT",
                body: JSON.stringify({ locationId, portfolioId: selectedPortfolioId, templateKeys: [...selectedKeys] })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "No se pudo guardar la configuración.");
            setConfigured(true);
            toast.success("Visibilidad de plantillas guardada");
        } catch (error) {
            toast.error("No se pudo guardar", { description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-500">Templates</p>
                    <h3 className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-white">Visibilidad en el iframe</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Elige por portfolio Meta qué plantillas aprobadas podrá ver el cliente en su panel de WhatsApp.</p>
                </div>
                <button type="button" onClick={loadSlots} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualizar
                </button>
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-2 dark:border-gray-800">
                {portfolios.map((portfolio) => (
                    <button key={portfolio.id} type="button" onClick={() => setSelectedPortfolioId(portfolio.id)} className={`shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-bold transition ${selectedPortfolioId === portfolio.id ? "bg-indigo-600 text-white shadow-md" : "bg-white text-gray-600 hover:bg-indigo-50 dark:bg-gray-900 dark:text-gray-300"}`}>
                        <span className="block">{portfolio.name}</span>
                        <span className={`mt-0.5 block text-[11px] font-medium ${selectedPortfolioId === portfolio.id ? "text-indigo-100" : "text-gray-400"}`}>{portfolio.slots.length} número{portfolio.slots.length === 1 ? "" : "s"}</span>
                    </button>
                ))}
            </div>

            {!loading && !portfolios.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">No hay portfolios Meta con números oficiales listos.</div> : null}
            {selectedPortfolioId ? (
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between dark:border-gray-800">
                        <div><h4 className="font-extrabold text-gray-900 dark:text-white">Plantillas visibles</h4><p className="mt-1 text-xs text-gray-500">Solo se consultan plantillas aprobadas. {configured ? "La selección guardada se aplica al iframe." : "Sin configuración, todas las aprobadas aparecen."}</p></div>
                        <button type="button" onClick={saveVisibility} disabled={saving || loadingTemplates} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"><Save size={16} />{saving ? "Guardando..." : "Guardar selección"}</button>
                    </div>
                    {loadingTemplates ? <div className="flex items-center gap-2 py-8 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" /> Cargando aprobadas...</div> : !templates.length ? <p className="py-8 text-sm text-gray-500">No hay plantillas aprobadas en este portfolio.</p> : <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{templates.map((template) => { const key = templateKey(template); const checked = configured ? selectedKeys.has(key) : true; return <button key={key} type="button" onClick={() => toggleTemplate(key)} className={`rounded-2xl border p-4 text-left transition ${checked ? "border-indigo-300 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/20" : "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-950/30"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-gray-900 dark:text-white">{template.name}</p><p className="mt-1 text-xs text-gray-500">{template.language || "es"}</p></div><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 text-transparent"}`}><Check size={15} /></span></div><div className="mt-3 rounded-xl border border-white bg-white p-3 text-xs leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">{template.components?.find((component) => String(component.type).toUpperCase() === "BODY")?.text || "Sin cuerpo de mensaje"}</div></button>; })}</div>}
                </section>
            ) : null}
        </div>
    );
}
