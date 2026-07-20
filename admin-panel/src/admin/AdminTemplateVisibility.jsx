import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

function bodyPreview(template = {}) {
    return (template.components || []).find((component) => String(component?.type || "").toUpperCase() === "BODY")?.text || "Sin cuerpo de mensaje";
}

function portfolioStatusLabel(portfolio = {}) {
    if (portfolio.loadState === "error") return "Sin acceso a Meta";
    if (portfolio.loadState === "partial") return "Carga parcial";
    if (portfolio.loadState === "empty") return "Sin aprobadas";
    return "Disponible";
}

export default function AdminTemplateVisibility({ token, agencies = [], onUnauthorized }) {
    const [agencyId, setAgencyId] = useState("");
    const [portfolios, setPortfolios] = useState([]);
    const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
    const [selectedKeys, setSelectedKeys] = useState(new Set());
    const [configured, setConfigured] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const authFetch = async (endpoint, options = {}) => {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) }
        });
        if (response.status === 401 && onUnauthorized) onUnauthorized();
        return response;
    };

    const selectedPortfolio = useMemo(
        () => portfolios.find((item) => item.portfolioId === selectedPortfolioId) || null,
        [portfolios, selectedPortfolioId]
    );

    const load = async () => {
        setLoading(true);
        try {
            const query = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
            const response = await authFetch(`/admin/template-visibility${query}`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "No se pudieron cargar los portfolios.");
            const nextPortfolios = Array.isArray(data.portfolios) ? data.portfolios : [];
            setPortfolios(nextPortfolios);
            setSelectedPortfolioId((current) => nextPortfolios.some((item) => item.portfolioId === current)
                ? current
                : (nextPortfolios[0]?.portfolioId || ""));
            if (data.partial && Array.isArray(data.warnings) && data.warnings.length > 0) {
                toast.warning("Algunos portfolios no pudieron consultarse", {
                    description: "Los portfolios disponibles siguen cargados. Revisa los que aparecen sin acceso a Meta."
                });
            }
        } catch (error) {
            toast.error("No se pudo cargar visibilidad", { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [agencyId]);

    useEffect(() => {
        if (!selectedPortfolio) {
            setConfigured(false);
            setSelectedKeys(new Set());
            return;
        }
        const hasConfig = selectedPortfolio.configured === true;
        setConfigured(hasConfig);
        setSelectedKeys(new Set(
            selectedPortfolio.loadState === "error"
                ? []
                : (hasConfig ? selectedPortfolio.templateKeys || [] : (selectedPortfolio.templates || []).map((item) => item.key))
        ));
    }, [selectedPortfolioId, portfolios]);

    const toggle = (key) => {
        if (selectedPortfolio?.loadState === "error") return;
        setConfigured(true);
        setSelectedKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const save = async () => {
        if (!selectedPortfolio || saving || selectedPortfolio.loadState === "error") return;
        setSaving(true);
        try {
            const response = await authFetch("/admin/template-visibility", {
                method: "PUT",
                body: JSON.stringify({
                    portfolioId: selectedPortfolio.portfolioId,
                    locationId: selectedPortfolio.locations[0]?.locationId,
                    templateKeys: [...selectedKeys]
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "No se pudo guardar.");
            setPortfolios((current) => current.map((item) => item.portfolioId === selectedPortfolio.portfolioId
                ? { ...item, configured: true, templateKeys: data.templateKeys || [...selectedKeys] }
                : item));
            toast.success("Visibilidad guardada para el portfolio Meta");
        } catch (error) {
            toast.error("No se pudo guardar", { description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-500">Templates</p>
                    <h2 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">Visibilidad de plantillas</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Selecciona por portfolio Meta qué plantillas aprobadas aparecerán en el iframe del cliente.</p>
                </div>
                <div className="flex gap-2">
                    <select value={agencyId} onChange={(event) => setAgencyId(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
                        <option value="">Todas las agencias</option>
                        {agencies.map((agency) => <option key={agency.agency_id} value={agency.agency_id}>{agency.agency_name || agency.agency_id}</option>)}
                    </select>
                    <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />Actualizar
                    </button>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-2 dark:border-gray-800">
                {portfolios.map((portfolio) => <button key={portfolio.portfolioId} type="button" onClick={() => setSelectedPortfolioId(portfolio.portfolioId)} className={`shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-bold ${selectedPortfolioId === portfolio.portfolioId ? "bg-indigo-600 text-white shadow" : "bg-white text-gray-600 hover:bg-indigo-50 dark:bg-gray-900 dark:text-gray-300"}`}>
                    <span className="block">{portfolio.portfolioName}</span>
                    <span className={`text-[11px] font-medium ${selectedPortfolioId === portfolio.portfolioId ? "text-indigo-100" : "text-gray-400"}`}>{portfolio.locations?.length || 0} números · {portfolioStatusLabel(portfolio)}</span>
                </button>)}
            </div>

            {!loading && !portfolios.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">No hay portfolios con números Meta oficiales conectados.</div> : null}

            {selectedPortfolio ? <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between dark:border-gray-800">
                    <div>
                        <h3 className="font-extrabold text-gray-900 dark:text-white">Plantillas visibles para este portfolio</h3>
                        <p className="mt-1 text-xs text-gray-500">{configured ? "La selección guardada se aplicará a todos sus clientes." : "Todas las aprobadas están visibles hasta guardar una selección."}</p>
                    </div>
                    <button type="button" onClick={save} disabled={saving || selectedPortfolio.loadState === "error"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                        <Save size={16} />{saving ? "Guardando..." : "Guardar selección"}
                    </button>
                </div>

                {selectedPortfolio.loadState === "error" ? <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    <div>
                        <p className="font-extrabold">No se pudo consultar este portfolio en Meta</p>
                        <p className="mt-1">El resto de portfolios continúa disponible. Revisa la vinculación del WABA antes de guardar cambios.</p>
                        {selectedPortfolio.wabas?.filter((waba) => waba.status === "error").map((waba) => <p key={`${waba.businessAccountId}-${waba.slotId}`} className="mt-2 text-xs">WABA {waba.businessAccountId}: {waba.message || waba.errorCode}</p>)}
                    </div>
                </div> : null}

                {selectedPortfolio.loadState !== "error" && selectedPortfolio.templates.length > 0 ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {selectedPortfolio.templates.map((template) => {
                        const checked = selectedKeys.has(template.key);
                        return <button key={template.key} type="button" onClick={() => toggle(template.key)} className={`rounded-2xl border p-4 text-left transition ${checked ? "border-indigo-300 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/20" : "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-950/30"}`}>
                            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-gray-900 dark:text-white">{template.name}</p><p className="mt-1 text-xs text-gray-500">{template.language || "es"}</p></div><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 text-transparent"}`}><Check size={15} /></span></div>
                            <div className="mt-3 rounded-xl border border-white bg-white p-3 text-xs leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">{bodyPreview(template)}</div>
                        </button>;
                    })}
                </div> : null}

                {selectedPortfolio.loadState === "empty" ? <p className="mt-4 text-sm text-gray-500">Meta respondió correctamente, pero este portfolio no tiene plantillas aprobadas visibles.</p> : null}
                {selectedPortfolio.loadState === "partial" ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300"><p className="font-bold">Algunos WABA del portfolio no pudieron consultarse.</p><p className="mt-1">Se muestran las plantillas disponibles de los demás.</p>{selectedPortfolio.wabas?.filter((waba) => waba.status === "error").map((waba) => <p key={`${waba.businessAccountId}-${waba.slotId}`} className="mt-2">WABA {waba.businessAccountId}: {waba.message || waba.errorCode}</p>)}</div> : null}
            </section> : null}
        </div>
    );
}
