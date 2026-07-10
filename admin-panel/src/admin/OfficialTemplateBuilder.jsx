import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, FileText, Loader2, Pencil, RefreshCw, Search, Send, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../context/LanguageContext";

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");
const TEMPLATE_VARIABLE_MAPPINGS_STORAGE_KEY = "waflow:official-template-variable-mappings";

const emptyForm = {
    locationId: "",
    slotId: "",
    name: "",
    language: "es",
    category: "UTILITY",
    bodyText: "",
    bodyExamples: "",
    footerText: "",
    buttons: ""
};

const GHL_VARIABLE_OPTIONS = [
    { value: "{{contact.first_name}}", label: "name", group: "Contacto" },
    { value: "{{contact.last_name}}", label: "last_name", group: "Contacto" },
    { value: "{{contact.name}}", label: "full_name", group: "Contacto" },
    { value: "{{contact.email}}", label: "email", group: "Contacto" },
    { value: "{{contact.phone}}", label: "phone", group: "Contacto" },
    { value: "{{contact.id}}", label: "contact_id", group: "Contacto" },
    { value: "{{contact.source}}", label: "source", group: "Contacto" },
    { value: "{{contact.tags}}", label: "tags", group: "Contacto" },
    { value: "{{contact.address1}}", label: "address", group: "Contacto" },
    { value: "{{contact.city}}", label: "city", group: "Contacto" },
    { value: "{{contact.state}}", label: "state", group: "Contacto" },
    { value: "{{contact.country}}", label: "country", group: "Contacto" },
    { value: "{{contact.postal_code}}", label: "postal_code", group: "Contacto" },
    { value: "{{contact.date_of_birth}}", label: "date_of_birth", group: "Contacto" },
    { value: "{{contact.timezone}}", label: "timezone", group: "Contacto" },
    { value: "{{user.first_name}}", label: "assigned_user_name", group: "Usuario" },
    { value: "{{user.last_name}}", label: "assigned_user_last_name", group: "Usuario" },
    { value: "{{user.email}}", label: "assigned_user_email", group: "Usuario" },
    { value: "{{user.phone}}", label: "assigned_user_phone", group: "Usuario" },
    { value: "{{location.name}}", label: "location_name", group: "Cuenta" },
    { value: "{{location.phone}}", label: "location_phone", group: "Cuenta" },
    { value: "{{location.email}}", label: "location_email", group: "Cuenta" },
    { value: "{{appointment.start_time}}", label: "appointment_start_time", group: "Citas" },
    { value: "{{appointment.end_time}}", label: "appointment_end_time", group: "Citas" },
    { value: "{{appointment.title}}", label: "appointment_title", group: "Citas" },
    { value: "{{appointment.calendar_name}}", label: "appointment_calendar", group: "Citas" },
    { value: "{{opportunity.name}}", label: "opportunity_name", group: "Oportunidad" },
    { value: "{{opportunity.status}}", label: "opportunity_status", group: "Oportunidad" },
    { value: "{{opportunity.monetary_value}}", label: "opportunity_value", group: "Oportunidad" }
];

function normalizeTemplateName(value = "") {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function parseExamples(value = "") {
    return String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseButtons(value = "") {
    return String(value || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((text) => ({ type: "QUICK_REPLY", text }));
}

function extractVariableIndexes(text = "") {
    const indexes = new Set();
    const matcher = /\{\{\s*(\d+)\s*\}\}/g;
    let match;
    while ((match = matcher.exec(String(text || ""))) !== null) {
        const index = Number.parseInt(match[1], 10);
        if (Number.isFinite(index) && index > 0) indexes.add(index);
    }
    return [...indexes].sort((a, b) => a - b);
}

function extractTemplatePlaceholders(text = "") {
    const placeholders = [];
    const seen = new Set();
    const matcher = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    let match;

    while ((match = matcher.exec(String(text || ""))) !== null) {
        const key = String(match[1] || "").trim();
        if (!key) continue;
        const seenKey = key.toLowerCase();
        if (seen.has(seenKey)) continue;
        seen.add(seenKey);
        placeholders.push(key);
    }

    return placeholders;
}

function getTemplateCommandPlaceholders(template = {}) {
    const components = Array.isArray(template.components) ? template.components : [];
    const placeholders = [];
    const seen = new Set();
    const addPlaceholders = (items = []) => {
        items.forEach((key) => {
            const safeKey = String(key || "").trim();
            if (!safeKey) return;
            const seenKey = safeKey.toLowerCase();
            if (seen.has(seenKey)) return;
            seen.add(seenKey);
            placeholders.push(safeKey);
        });
    };

    components.forEach((component) => {
        const type = String(component?.type || "").toUpperCase();
        if (type === "BODY" || type === "HEADER") {
            addPlaceholders(extractTemplatePlaceholders(component?.text || ""));
            return;
        }

        if (type === "BUTTONS") {
            const buttons = Array.isArray(component?.buttons) ? component.buttons : [];
            buttons.forEach((button = {}) => {
                addPlaceholders(extractTemplatePlaceholders(button?.url || ""));
            });
        }
    });

    return placeholders;
}

function groupTemplates(templates = []) {
    return templates.reduce((groups, template) => {
        const status = String(template?.status || "").toUpperCase();
        if (status === "APPROVED" || status === "ACTIVE") groups.approved.push(template);
        else if (["PENDING", "IN_APPEAL", "PENDING_DELETION"].includes(status)) groups.pending.push(template);
        else if (["REJECTED", "PAUSED", "DISABLED"].includes(status)) groups.rejected.push(template);
        else groups.other.push(template);
        return groups;
    }, { approved: [], pending: [], rejected: [], other: [] });
}

function getSlotOfficialSettings(slot = {}) {
    return slot?.settings?.official_api || {};
}

function isOfficialSlot(slot = {}) {
    const mode = String(slot?.settings?.connection_mode || "").trim().toLowerCase();
    const official = getSlotOfficialSettings(slot);
    return mode === "official_api" || Boolean(
        official.businessAccountId ||
        official.phoneNumberId ||
        official.accessToken ||
        official.accessTokenEncrypted ||
        official.status
    );
}

function isTemplateReadyOfficialSlot(slot = {}) {
    const official = getSlotOfficialSettings(slot);
    const hasAccessToken = Boolean(
        official.hasAccessToken ||
        official.accessToken ||
        official.accessTokenEncrypted ||
        official.accessTokenMasked
    );
    return isOfficialSlot(slot) && Boolean(
        official.phoneNumberId &&
        hasAccessToken
    );
}

function getDefaultTemplateValue(placeholder = "", index = 0) {
    const safePlaceholder = String(placeholder || "").trim();
    return /^\d+$/.test(safePlaceholder) ? `valor_${index + 1}` : `valor_${safePlaceholder}`;
}

function getTemplateKey(template = {}) {
    return [
        String(template?.name || "").trim(),
        String(template?.language || "").trim(),
        String(template?.status || "").trim()
    ].join(":");
}

function groupGhlVariableOptions(options = []) {
    return options.reduce((groups, option) => {
        const group = String(option?.group || "GHL").trim() || "GHL";
        if (!groups[group]) groups[group] = [];
        groups[group].push(option);
        return groups;
    }, {});
}

function buildTemplateCommand(template = {}, fallbackLanguage = "es", variableMappings = {}) {
    const name = String(template?.name || "").trim();
    const language = String(template?.language || fallbackLanguage || "es").trim();
    if (!name || !language) return "";
    const placeholders = getTemplateCommandPlaceholders(template);
    const values = placeholders.map((placeholder, index) => {
        const safePlaceholder = String(placeholder || "").trim();
        return String(variableMappings[safePlaceholder] || "").trim() || getDefaultTemplateValue(safePlaceholder, index);
    });
    return `![TPL:${name}:${language}${values.length ? `|${values.join("|")}` : ""}]!`;
}

function friendlyTemplateError(payload = {}, t) {
    const code = String(payload?.code || "").trim();
    if (code === "OFFICIAL_WABA_ACCESS_LOST") {
        return {
            title: payload.title || (t("templates.builder.access_lost_title") || "La conexion con Meta perdio permisos"),
            message: payload.error || (t("templates.builder.access_lost_message") || "Ya no tenemos acceso a la cuenta de WhatsApp Business vinculada a este numero."),
            reason: payload.reason || (t("templates.builder.access_lost_reason") || "Esto suele pasar cuando se elimina a WaFloW como socio/partner del portfolio comercial del cliente o se revocan permisos en Meta."),
            actions: Array.isArray(payload.actions) && payload.actions.length > 0 ? payload.actions : [
                t("templates.builder.access_lost_action_clear") || "Pulsa Limpiar en la configuracion del numero para quitar la vinculacion anterior.",
                t("templates.builder.access_lost_action_reconnect") || "Vuelve a conectar el numero con el boton de Meta oficial y acepta nuevamente los permisos.",
                t("templates.builder.access_lost_action_partner") || "Confirma en Meta Business que WaFloW/Clic&App figure como socio con acceso al WABA y al numero."
            ]
        };
    }
    return {
        title: t("templates.builder.load_templates_error") || "No se pudieron cargar templates",
        message: payload?.error || payload?.message || (t("templates.builder.generic_templates_error") || "No pudimos consultar las plantillas de este numero."),
        reason: payload?.reason || "",
        actions: []
    };
}

export default function OfficialTemplateBuilder({ locations = [], token, onUnauthorized }) {
    const { t } = useLanguage();
    const mountedRef = useRef(true);
    const slotsLoadRequestRef = useRef(0);
    const templatesLoadRequestRef = useRef(0);
    const [officialSlots, setOfficialSlots] = useState([]);
    const [templatesBySlot, setTemplatesBySlot] = useState({});
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [templateLoadError, setTemplateLoadError] = useState(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [templateVariableMappings, setTemplateVariableMappings] = useState(() => {
        try {
            const stored = localStorage.getItem(TEMPLATE_VARIABLE_MAPPINGS_STORAGE_KEY);
            const parsed = stored ? JSON.parse(stored) : {};
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    });
    const [mappingModal, setMappingModal] = useState({ open: false, template: null, search: "" });

    const authFetch = async (endpoint, options = {}) => {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            }
        });
        if (res.status === 401) {
            if (typeof onUnauthorized === "function") onUnauthorized();
            throw new Error(t("agency.session_expired") || "Sesion expirada");
        }
        return res;
    };

    const selectedSlot = useMemo(
        () => officialSlots.find((slot) => slot.locationId === form.locationId && String(slot.slotId) === String(form.slotId)) || null,
        [officialSlots, form.locationId, form.slotId]
    );

    const currentTemplates = useMemo(() => {
        if (!selectedSlot) return [];
        return templatesBySlot[`${selectedSlot.locationId}:${selectedSlot.slotId}`]?.templates || [];
    }, [selectedSlot, templatesBySlot]);
    const groupedTemplates = useMemo(() => groupTemplates(currentTemplates), [currentTemplates]);
    const variableIndexes = useMemo(() => extractVariableIndexes(form.bodyText), [form.bodyText]);
    const bodyExamples = useMemo(() => parseExamples(form.bodyExamples), [form.bodyExamples]);
    const buttons = useMemo(() => parseButtons(form.buttons), [form.buttons]);
    const normalizedName = normalizeTemplateName(form.name);
    const locationsSignature = useMemo(() => {
        return (Array.isArray(locations) ? locations : [])
            .map((location) => String(location?.location_id || "").trim())
            .filter(Boolean)
            .sort()
            .join("|");
    }, [locations]);

    const previewText = useMemo(() => {
        const raw = String(form.bodyText || "").trim();
        if (!raw) return t("templates.builder.preview_empty") || "Escribe el mensaje para ver la vista previa.";
        return raw.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, index) => bodyExamples[Number(index) - 1] || `{{${index}}}`);
    }, [bodyExamples, form.bodyText, t]);

    const draftCommand = useMemo(() => {
        const name = normalizedName || "recordatorio_cita";
        const values = variableIndexes.map((_, index) => `valor_${index + 1}`);
        return `![TPL:${name}:${form.language || "es"}${values.length ? `|${values.join("|")}` : ""}]!`;
    }, [form.language, normalizedName, variableIndexes]);

    const setFormField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: key === "name" ? normalizeTemplateName(value) : value }));
    };

    const loadOfficialSlots = async () => {
        const requestId = slotsLoadRequestRef.current + 1;
        slotsLoadRequestRef.current = requestId;
        setTemplateLoadError(null);
        setLoadingSlots(true);
        try {
            const details = await Promise.all(
                (locations || []).map(async (location) => {
                    const locationId = String(location?.location_id || "").trim();
                    if (!locationId) return [];
                    const res = await authFetch(`/agency/location-details/${encodeURIComponent(locationId)}`);
                    if (!res.ok) return [];
                    const data = await res.json();
                    return (Array.isArray(data.slots) ? data.slots : [])
                        .filter(isTemplateReadyOfficialSlot)
                        .map((slot) => {
                            const official = getSlotOfficialSettings(slot);
                            return {
                                locationId,
                                locationName: data.name || location.name || locationId,
                                slotId: slot.slot_id,
                                slotName: slot.slot_name || `Slot ${slot.slot_id}`,
                                phone: official.displayPhoneNumber || slot.phone_number || official.phoneNumberId || "",
                                verifiedName: official.verifiedName || "",
                                businessAccountId: official.businessAccountId || "",
                                phoneNumberId: official.phoneNumberId || "",
                                hasAccessToken: Boolean(
                                    official.hasAccessToken ||
                                    official.accessToken ||
                                    official.accessTokenEncrypted ||
                                    official.accessTokenMasked
                                )
                            };
                        });
                })
            );
            const nextSlots = details.flat();
            if (!mountedRef.current || slotsLoadRequestRef.current !== requestId) return;
            setOfficialSlots(nextSlots);
            setForm((prev) => {
                if (nextSlots.some((slot) => slot.locationId === prev.locationId && String(slot.slotId) === String(prev.slotId))) {
                    return prev;
                }
                const first = nextSlots[0];
                return first ? { ...prev, locationId: first.locationId, slotId: String(first.slotId) } : prev;
            });
        } catch (error) {
            if (!mountedRef.current || slotsLoadRequestRef.current !== requestId) return;
            toast.error(t("templates.builder.load_slots_error") || "No se pudieron cargar numeros Meta oficiales", {
                description: error.message
            });
        } finally {
            if (mountedRef.current && slotsLoadRequestRef.current === requestId) {
                setLoadingSlots(false);
            }
        }
    };

    const loadTemplates = async (slot = selectedSlot) => {
        const requestId = templatesLoadRequestRef.current + 1;
        templatesLoadRequestRef.current = requestId;
        setTemplateLoadError(null);
        if (!slot) return;
        if (!slot.hasAccessToken) return;
        const key = `${slot.locationId}:${slot.slotId}`;
        setLoadingTemplates(true);
        try {
            const query = new URLSearchParams({
                locationId: slot.locationId,
                slotId: String(slot.slotId)
            });
            const res = await authFetch(`/agency/whatsapp-official/templates?${query.toString()}`);
            const data = await res.json().catch(() => ({}));
            if (!mountedRef.current || templatesLoadRequestRef.current !== requestId) return;
            if (!res.ok) {
                setTemplateLoadError(friendlyTemplateError(data, t));
                return;
            }
            setTemplatesBySlot((prev) => ({
                ...prev,
                [key]: {
                    templates: Array.isArray(data.templates) ? data.templates : [],
                    fetchedAt: data.fetchedAt || new Date().toISOString()
                }
            }));
        } catch (error) {
            if (!mountedRef.current || templatesLoadRequestRef.current !== requestId) return;
            setTemplateLoadError(friendlyTemplateError(error, t));
        } finally {
            if (mountedRef.current && templatesLoadRequestRef.current === requestId) {
                setLoadingTemplates(false);
            }
        }
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            slotsLoadRequestRef.current += 1;
            templatesLoadRequestRef.current += 1;
        };
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(TEMPLATE_VARIABLE_MAPPINGS_STORAGE_KEY, JSON.stringify(templateVariableMappings));
        } catch {
            // Mapping persistence is best-effort; the UI still works in memory.
        }
    }, [templateVariableMappings]);

    useEffect(() => {
        loadOfficialSlots();
    }, [locationsSignature]);

    useEffect(() => {
        if (selectedSlot?.hasAccessToken) loadTemplates(selectedSlot);
    }, [selectedSlot?.locationId, selectedSlot?.slotId]);

    const applyExample = () => {
        setForm((prev) => ({
            ...prev,
            name: "recordatorio_cita",
            language: "es",
            category: "UTILITY",
            bodyText: "Hola {{1}}, recuerda tu cita para el {{2}}.",
            bodyExamples: "Luis, viernes 10:00",
            footerText: "Responde para confirmar.",
            buttons: "Confirmar\nReprogramar"
        }));
    };

    const copyText = async (value) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(t("common.copied") || "Copiado");
        } catch {
            toast.error(t("builder.toast.copy_error") || "No se pudo copiar");
        }
    };

    const openMappingModal = (template) => {
        setMappingModal({ open: true, template, search: "" });
    };

    const closeMappingModal = () => {
        setMappingModal({ open: false, template: null, search: "" });
    };

    const updateTemplateMapping = (template, placeholder, value) => {
        const key = getTemplateKey(template);
        const safePlaceholder = String(placeholder || "").trim();
        setTemplateVariableMappings((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                [safePlaceholder]: value
            }
        }));
    };

    const getTemplateMapping = (template) => {
        return templateVariableMappings[getTemplateKey(template)] || {};
    };

    const createTemplate = async (event) => {
        event.preventDefault();
        if (!selectedSlot) {
            toast.error(t("templates.builder.no_official_slots") || "No hay numeros Meta oficiales conectados");
            return;
        }
        if (!normalizedName || !form.bodyText.trim()) {
            toast.error(t("templates.builder.required_error") || "Nombre y mensaje son requeridos");
            return;
        }
        const missingExample = variableIndexes.some((index) => !bodyExamples[index - 1]);
        if (missingExample) {
            toast.error(t("templates.builder.examples_error") || "Agrega un ejemplo por cada variable");
            return;
        }

        setCreating(true);
        try {
            const res = await authFetch("/agency/whatsapp-official/templates", {
                method: "POST",
                body: JSON.stringify({
                    locationId: selectedSlot.locationId,
                    slotId: selectedSlot.slotId,
                    name: normalizedName,
                    language: form.language,
                    category: form.category,
                    bodyText: form.bodyText,
                    bodyExamples,
                    footerText: form.footerText,
                    buttons
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || (t("templates.builder.create_error") || "No se pudo crear la plantilla"));
            toast.success(t("templates.builder.created") || "Plantilla enviada a revision de Meta");
            await loadTemplates(selectedSlot);
        } catch (error) {
            toast.error(t("templates.builder.create_error") || "No se pudo crear la plantilla", {
                description: error.message
            });
        } finally {
            setCreating(false);
        }
    };

    const renderTemplateList = (title, items, tone, icon) => {
        const StatusIcon = icon;
        return (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <StatusIcon size={16} className={tone} />
                        <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">{title}</h4>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500 dark:bg-gray-800">
                        {items.length}
                    </span>
                </div>
                <div className="space-y-2">
                    {items.length === 0 ? (
                        <p className="text-sm text-gray-500">{t("templates.builder.empty_status") || "Sin plantillas en este estado."}</p>
                    ) : items.map((template) => {
                        const mapping = getTemplateMapping(template);
                        const command = buildTemplateCommand(template, form.language, mapping);
                        const placeholders = getTemplateCommandPlaceholders(template);
                        return (
                            <div key={`${template.name}-${template.language}-${template.status}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{template.name}</p>
                                        <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                                            {template.language || "es"} / {template.category || "-"} / {template.status || "-"}
                                        </p>
                                        {placeholders.length ? (
                                            <p className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                                                Variables: {placeholders.map((key) => `{{${key}}}`).join(", ")}
                                            </p>
                                        ) : null}
                                        {template.rejectedReason ? <p className="mt-1 text-xs text-red-500">{template.rejectedReason}</p> : null}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        {placeholders.length ? (
                                            <button
                                                type="button"
                                                onClick={() => openMappingModal(template)}
                                                className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900"
                                                title={t("templates.builder.map_variables") || "Mapear variables GHL"}
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        ) : null}
                                        {command ? (
                                            <button
                                                type="button"
                                                onClick={() => copyText(command)}
                                                className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900"
                                                title={t("common.copy") || "Copiar"}
                                            >
                                                <Copy size={14} />
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                                {command ? <code className="mt-2 block break-all rounded-lg bg-white px-2 py-1.5 text-xs text-emerald-700 dark:bg-gray-900 dark:text-emerald-300">{command}</code> : null}
                            </div>
                        );
                    })}
                </div>
            </section>
        );
    };

    const renderVariableMappingModal = () => {
        if (!mappingModal.open || !mappingModal.template) return null;

        const template = mappingModal.template;
        const placeholders = getTemplateCommandPlaceholders(template);
        const mapping = getTemplateMapping(template);
        const search = String(mappingModal.search || "").trim().toLowerCase();
        const filteredOptions = GHL_VARIABLE_OPTIONS.filter((option) => {
            if (!search) return true;
            return `${option.label} ${option.value} ${option.group}`.toLowerCase().includes(search);
        });
        const groupedFilteredOptions = groupGhlVariableOptions(filteredOptions);
        const mappedCommand = buildTemplateCommand(template, form.language, mapping);

        return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-gray-800">
                        <div>
                            <p className="text-xs font-extrabold uppercase tracking-widest text-indigo-500">
                                {t("templates.builder.variable_mapper") || "Mapeador de variables GHL"}
                            </p>
                            <h3 className="mt-1 text-xl font-extrabold text-gray-900 dark:text-white">{template.name}</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {template.language || "es"} / {template.category || "-"} / {template.status || "-"}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closeMappingModal}
                            className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:hover:text-white"
                            title={t("common.close") || "Cerrar"}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto p-5">
                        <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                                    {t("templates.builder.mapped_command") || "Comando con variables GHL"}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => copyText(mappedCommand)}
                                    className="text-emerald-700 hover:text-emerald-600 dark:text-emerald-300"
                                    title={t("common.copy") || "Copiar"}
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                            <code className="block break-all rounded-lg bg-white px-3 py-2 text-xs text-emerald-900 dark:bg-gray-900 dark:text-emerald-200">
                                {mappedCommand}
                            </code>
                        </div>

                        <div className="mb-4">
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                {t("templates.builder.search_ghl_variable") || "Buscar variable GHL"}
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    value={mappingModal.search}
                                    onChange={(event) => setMappingModal((prev) => ({ ...prev, search: event.target.value }))}
                                    placeholder="name, email, appointment..."
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {placeholders.map((placeholder, index) => {
                                const selectedValue = String(mapping[placeholder] || "").trim();
                                const selectedInFilter = !selectedValue || filteredOptions.some((option) => option.value === selectedValue);
                                const selectedOption = GHL_VARIABLE_OPTIONS.find((option) => option.value === selectedValue);
                                const groupedSelectOptions = selectedInFilter
                                    ? groupedFilteredOptions
                                    : groupGhlVariableOptions([
                                        selectedOption || { value: selectedValue, label: selectedValue, group: t("templates.builder.selected_variable") || "Seleccionada" },
                                        ...filteredOptions
                                    ]);

                                return (
                                    <div key={placeholder} className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40 md:grid-cols-[0.8fr_1.2fr]">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                                {t("templates.builder.template_variable") || "Variable template"}
                                            </p>
                                            <code className="mt-2 block rounded-lg bg-white px-3 py-2 text-sm font-bold text-indigo-700 dark:bg-gray-900 dark:text-indigo-300">
                                                {`{{${placeholder}}}`}
                                            </code>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                                {t("templates.builder.ghl_equivalence") || "Equivalencia GHL"}
                                            </p>
                                            <select
                                                value={selectedValue}
                                                onChange={(event) => updateTemplateMapping(template, placeholder, event.target.value)}
                                                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            >
                                                <option value="">{getDefaultTemplateValue(placeholder, index)}</option>
                                                {Object.entries(groupedSelectOptions).map(([group, options]) => (
                                                    <optgroup key={`${placeholder}-${group}`} label={group}>
                                                        {options.map((option) => (
                                                            <option key={`${placeholder}-${option.value}`} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                            {selectedValue ? (
                                                <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                                                        {t("templates.builder.selected_ghl_variable") || "Variable GHL seleccionada"}
                                                    </p>
                                                    <code className="mt-1 block break-all text-xs font-bold text-indigo-700 dark:text-indigo-200">
                                                        {selectedValue}
                                                    </code>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-gray-100 p-4 dark:border-gray-800">
                        <button
                            type="button"
                            onClick={closeMappingModal}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                        >
                            {t("common.close") || "Cerrar"}
                        </button>
                        <button
                            type="button"
                            onClick={() => copyText(mappedCommand)}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                        >
                            <Copy size={16} />
                            {t("templates.builder.copy_mapped_command") || "Copiar comando"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6 animate-in fade-in slide-in-from-bottom-4" translate="no">
            {renderVariableMappingModal()}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        {t("templates.builder.title") || "Constructor de templates"}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {t("templates.builder.subtitle") || "Crea plantillas oficiales de WhatsApp Meta y copia el formato listo para GoHighLevel."}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={loadOfficialSlots}
                    disabled={loadingSlots}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
                >
                    <RefreshCw size={16} className={loadingSlots ? "animate-spin" : ""} />
                    {t("common.reload") || "Recargar"}
                </button>
            </div>

            {loadingSlots ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-100">
                    <div className="flex items-start gap-3">
                        <Loader2 size={20} className="mt-0.5 shrink-0 animate-spin" />
                        <div>
                            <p className="font-bold">{t("templates.builder.loading_slots") || "Buscando numeros Meta oficiales..."}</p>
                            <p className="mt-1 text-sm">{t("templates.builder.loading_slots_desc") || "Estamos revisando las cuentas conectadas. Esto puede tardar unos segundos si tienes varias cuentas."}</p>
                        </div>
                    </div>
                </div>
            ) : null}

            {officialSlots.length === 0 && !loadingSlots ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                    <p className="font-bold">{t("templates.builder.no_official_slots") || "No hay numeros Meta oficiales conectados."}</p>
                    <p className="mt-1 text-sm">{t("templates.builder.no_official_slots_desc") || "Este apartado se habilita cuando una cuenta tiene al menos un numero vinculado con WhatsApp Meta oficial."}</p>
                </div>
            ) : null}

            {templateLoadError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
                        <div className="min-w-0 space-y-3">
                            <div>
                                <p className="font-extrabold">{templateLoadError.title}</p>
                                <p className="mt-1 text-sm font-semibold">{templateLoadError.message}</p>
                                {templateLoadError.reason ? (
                                    <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{templateLoadError.reason}</p>
                                ) : null}
                            </div>
                            {templateLoadError.actions.length > 0 ? (
                                <ol className="list-decimal space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
                                    {templateLoadError.actions.map((action, index) => (
                                        <li key={`${index}-${action}`}>{action}</li>
                                    ))}
                                </ol>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <form onSubmit={createTemplate} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                {t("templates.builder.number") || "Numero Meta oficial"}
                            </label>
                            <select
                                value={`${form.locationId}:${form.slotId}`}
                                onChange={(event) => {
                                    const [locationId, slotId] = event.target.value.split(":");
                                    setForm((prev) => ({ ...prev, locationId, slotId }));
                                }}
                                disabled={loadingSlots || officialSlots.length === 0}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            >
                                {loadingSlots ? (
                                    <option value="">{t("templates.builder.loading_slots_short") || "Cargando numeros..."}</option>
                                ) : null}
                                {!loadingSlots && officialSlots.length === 0 ? (
                                    <option value="">{t("templates.builder.no_ready_slots_short") || "Sin numeros listos para templates"}</option>
                                ) : null}
                                {officialSlots.map((slot) => (
                                    <option key={`${slot.locationId}:${slot.slotId}`} value={`${slot.locationId}:${slot.slotId}`}>
                                        {slot.locationName} - {slot.slotName} {slot.phone ? `(${slot.phone})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                {t("templates.builder.language") || "Idioma"}
                            </label>
                            <select
                                value={form.language}
                                onChange={(event) => setFormField("language", event.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            >
                                <option value="es">es</option>
                                <option value="en">en</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                {t("templates.builder.name") || "Nombre tecnico"}
                            </label>
                            <input
                                value={form.name}
                                onChange={(event) => setFormField("name", event.target.value)}
                                placeholder="recordatorio_cita"
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                {t("templates.builder.category") || "Categoria"}
                            </label>
                            <select
                                value={form.category}
                                onChange={(event) => setFormField("category", event.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            >
                                <option value="UTILITY">UTILITY</option>
                                <option value="MARKETING">MARKETING</option>
                                <option value="AUTHENTICATION">AUTHENTICATION</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                {t("templates.builder.body") || "Mensaje"}
                            </label>
                            <button type="button" onClick={applyExample} className="text-xs font-bold text-indigo-600 hover:text-indigo-500">
                                {t("templates.builder.use_example") || "Usar ejemplo"}
                            </button>
                        </div>
                        <textarea
                            value={form.bodyText}
                            onChange={(event) => setFormField("bodyText", event.target.value)}
                            rows={5}
                            placeholder="Hola {{1}}, recuerda tu cita para el {{2}}."
                            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                            {t("templates.builder.examples") || "Ejemplos de variables, separados por coma"}
                        </label>
                        <input
                            value={form.bodyExamples}
                            onChange={(event) => setFormField("bodyExamples", event.target.value)}
                            placeholder="Luis, viernes 10:00"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                {t("templates.builder.footer") || "Pie opcional"}
                            </label>
                            <input
                                value={form.footerText}
                                onChange={(event) => setFormField("footerText", event.target.value)}
                                placeholder="Responde para confirmar."
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                {t("templates.builder.buttons") || "Botones rapidos, uno por linea"}
                            </label>
                            <textarea
                                value={form.buttons}
                                onChange={(event) => setFormField("buttons", event.target.value)}
                                rows={3}
                                placeholder={"Confirmar\nReprogramar"}
                                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={creating || loadingSlots || !selectedSlot}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                        {creating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        {t("templates.builder.submit") || "Enviar a revision de Meta"}
                    </button>
                </form>

                <aside className="space-y-5">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h4 className="text-sm font-extrabold uppercase tracking-widest text-gray-400">
                            {t("templates.builder.preview") || "Vista previa"}
                        </h4>
                        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                            <p className="whitespace-pre-wrap text-sm font-semibold text-gray-900 dark:text-white">{previewText}</p>
                            {form.footerText ? <p className="mt-3 border-t border-gray-200 pt-2 text-xs text-gray-500">{form.footerText}</p> : null}
                            {buttons.length ? (
                                <div className="mt-3 grid gap-2">
                                    {buttons.map((button) => (
                                        <div key={button.text} className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-center text-xs font-bold text-sky-700 dark:bg-gray-900">
                                            {button.text}
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                                    {t("templates.builder.ghl_command") || "Comando GoHighLevel"}
                                </p>
                                <button type="button" onClick={() => copyText(draftCommand)} className="text-emerald-700 hover:text-emerald-600 dark:text-emerald-300">
                                    <Copy size={15} />
                                </button>
                            </div>
                            <code className="block break-all rounded-lg bg-white px-3 py-2 text-xs text-emerald-900 dark:bg-gray-900 dark:text-emerald-200">
                                {draftCommand}
                            </code>
                            <p className="mt-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                                {t("templates.builder.ghl_help") || "Cuando Meta apruebe la plantilla, envia solo este comando en GoHighLevel. Reemplaza valor_1, valor_2 por datos reales."}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                                {t("templates.builder.current_number_templates") || "Plantillas del numero seleccionado"}
                            </h4>
                            <button
                                type="button"
                                onClick={() => loadTemplates(selectedSlot)}
                                disabled={!selectedSlot || loadingTemplates || loadingSlots}
                                className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:text-indigo-600 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900"
                            >
                                <RefreshCw size={15} className={loadingTemplates ? "animate-spin" : ""} />
                            </button>
                        </div>
                        {loadingSlots ? (
                            <p className="text-xs text-gray-500">
                                {t("templates.builder.loading_slots_short") || "Cargando numeros..."}
                            </p>
                        ) : selectedSlot ? (
                            <p className="text-xs text-gray-500">
                                {selectedSlot.locationName} / {selectedSlot.slotName} {selectedSlot.phone ? `- ${selectedSlot.phone}` : ""}
                            </p>
                        ) : (
                            <p className="text-xs text-gray-500">
                                {t("templates.builder.no_ready_slots_short") || "Sin numeros listos para templates"}
                            </p>
                        )}
                    </div>
                </aside>
            </div>

            {!selectedSlot || loadingSlots ? null : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    {renderTemplateList(t("templates.builder.approved") || "Aprobadas", groupedTemplates.approved, "text-emerald-500", CheckCircle2)}
                    {renderTemplateList(t("templates.builder.pending") || "Pendientes", groupedTemplates.pending, "text-amber-500", FileText)}
                    {renderTemplateList(t("templates.builder.rejected") || "Rechazadas", groupedTemplates.rejected, "text-red-500", XCircle)}
                </div>
            )}
        </div>
    );
}
