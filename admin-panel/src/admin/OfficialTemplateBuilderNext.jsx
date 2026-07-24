import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Copy, FileText, Loader2, Pencil, RefreshCw, Search, Send, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../context/LanguageContext";

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");
const TEMPLATE_VARIABLE_MAPPINGS_STORAGE_KEY = "waflow:official-template-variable-mappings";
const MANUAL_GHL_MAPPING_PREFIX = "__manual__:";
const LITERAL_TEMPLATE_VALUE_PREFIX = "__literal__:";

const emptyForm = {
    locationId: "",
    slotId: "",
    name: "",
    language: "es",
    category: "UTILITY",
    bodyText: "",
    bodyExamples: {},
    headerFormat: "NONE",
    headerText: "",
    headerExamples: {},
    headerMediaHandle: "",
    footerText: "",
    buttons: [],
    authentication: {
        addSecurityRecommendation: true,
        codeExpirationMinutes: "10",
        otpType: "COPY_CODE",
        buttonText: "Copiar código",
        autofillText: "Autocompletar",
        packageName: "",
        signatureHash: ""
    }
};

const GHL_VARIABLE_OPTIONS = [
    { value: "{{contact.first_name}}", label: "Nombre", group: "Contacto" },
    { value: "{{contact.last_name}}", label: "Apellido", group: "Contacto" },
    { value: "{{contact.name}}", label: "Nombre completo", group: "Contacto" },
    { value: "{{contact.email}}", label: "Email", group: "Contacto" },
    { value: "{{contact.phone}}", label: "Teléfono", group: "Contacto" },
    { value: "{{contact.phone_raw}}", label: "Teléfono sin formato", group: "Contacto" },
    { value: "{{contact.id}}", label: "ID del contacto", group: "Contacto" },
    { value: "{{contact.company_name}}", label: "Empresa", group: "Contacto" },
    { value: "{{contact.source}}", label: "Origen", group: "Contacto" },
    { value: "{{contact.tags}}", label: "Etiquetas", group: "Contacto" },
    { value: "{{contact.website}}", label: "Sitio web", group: "Contacto" },
    { value: "{{contact.full_address}}", label: "Dirección completa", group: "Contacto" },
    { value: "{{contact.address1}}", label: "Dirección", group: "Contacto" },
    { value: "{{contact.city}}", label: "Ciudad", group: "Contacto" },
    { value: "{{contact.state}}", label: "Estado / provincia", group: "Contacto" },
    { value: "{{contact.country}}", label: "País", group: "Contacto" },
    { value: "{{contact.postal_code}}", label: "Código postal", group: "Contacto" },
    { value: "{{contact.date_of_birth}}", label: "Fecha de nacimiento", group: "Contacto" },
    { value: "{{contact.timezone}}", label: "Zona horaria", group: "Contacto" },

    { value: "{{user.name}}", label: "Nombre completo", group: "Usuario asignado" },
    { value: "{{user.first_name}}", label: "Nombre", group: "Usuario asignado" },
    { value: "{{user.last_name}}", label: "Apellido", group: "Usuario asignado" },
    { value: "{{user.email}}", label: "Email", group: "Usuario asignado" },
    { value: "{{user.phone}}", label: "Teléfono", group: "Usuario asignado" },
    { value: "{{user.phone_raw}}", label: "Teléfono sin formato", group: "Usuario asignado" },
    { value: "{{user.email_signature}}", label: "Firma de email", group: "Usuario asignado" },
    { value: "{{user.calendar_link}}", label: "Enlace de calendario", group: "Usuario asignado" },
    { value: "{{user.call_provider_phone_number}}", label: "Teléfono del proveedor de llamadas", group: "Usuario asignado" },
    { value: "{{user.call_provider_phone_number_raw}}", label: "Teléfono del proveedor sin formato", group: "Usuario asignado" },

    { value: "{{appointment.title}}", label: "Título", group: "Cita" },
    { value: "{{appointment.start_time}}", label: "Inicio (fecha y hora)", group: "Cita" },
    { value: "{{appointment.only_start_date}}", label: "Fecha de inicio", group: "Cita" },
    { value: "{{appointment.only_start_time}}", label: "Hora de inicio", group: "Cita" },
    { value: "{{appointment.end_time}}", label: "Fin (fecha y hora)", group: "Cita" },
    { value: "{{appointment.only_end_date}}", label: "Fecha de fin", group: "Cita" },
    { value: "{{appointment.only_end_time}}", label: "Hora de fin", group: "Cita" },
    { value: "{{appointment.day_of_week}}", label: "Día de la semana", group: "Cita" },
    { value: "{{appointment.calendar_name}}", label: "Nombre del calendario", group: "Cita" },
    { value: "{{appointment.user.phone_raw}}", label: "Teléfono del usuario de la cita", group: "Cita" },

    { value: "{{opportunity.name}}", label: "Nombre", group: "Oportunidad" },
    { value: "{{opportunity.status}}", label: "Estado", group: "Oportunidad" },
    { value: "{{opportunity.monetary_value}}", label: "Valor monetario", group: "Oportunidad" },
    { value: "{{opportunity.pipeline}}", label: "Pipeline", group: "Oportunidad" },
    { value: "{{opportunity.pipeline_stage}}", label: "Etapa del pipeline", group: "Oportunidad" },
    { value: "{{opportunity.id}}", label: "ID de oportunidad", group: "Oportunidad" },

    { value: "{{location.name}}", label: "Nombre", group: "Cuenta / ubicación" },
    { value: "{{location.email}}", label: "Email", group: "Cuenta / ubicación" },
    { value: "{{location.phone}}", label: "Teléfono", group: "Cuenta / ubicación" },
    { value: "{{location.website}}", label: "Sitio web", group: "Cuenta / ubicación" },
    { value: "{{location.address}}", label: "Dirección", group: "Cuenta / ubicación" },
    { value: "{{location.city}}", label: "Ciudad", group: "Cuenta / ubicación" },
    { value: "{{location.state}}", label: "Estado / provincia", group: "Cuenta / ubicación" },
    { value: "{{location.country}}", label: "País", group: "Cuenta / ubicación" },
    { value: "{{location.postal_code}}", label: "Código postal", group: "Cuenta / ubicación" },
    { value: "{{location.timezone}}", label: "Zona horaria", group: "Cuenta / ubicación" },

    { value: "{{calendar.name}}", label: "Nombre", group: "Calendario" },
    { value: "{{calendar.description}}", label: "Descripción", group: "Calendario" },
    { value: "{{calendar.url}}", label: "Enlace", group: "Calendario" },
    { value: "{{campaign.name}}", label: "Nombre", group: "Campaña" },
    { value: "{{invoice.number}}", label: "Número", group: "Factura" },
    { value: "{{invoice.amount_due}}", label: "Importe pendiente", group: "Factura" },
    { value: "{{invoice.due_date}}", label: "Fecha de vencimiento", group: "Factura" }
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

function analyzeTemplateVariables(text = "") {
    const source = String(text || "");
    const matches = [...source.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)];
    if (!matches.length) return { metaText: source, variables: [] };

    const tokens = matches.map((match) => String(match[1] || "").trim()).filter(Boolean);
    const numericOnly = tokens.length === matches.length && tokens.every((token) => /^\d+$/.test(token));
    if (numericOnly) {
        const indexes = [...new Set(tokens.map((token) => Number.parseInt(token, 10)))].sort((a, b) => a - b);
        return {
            metaText: source,
            variables: indexes.map((index) => ({ index, key: String(index), label: `{{${index}}}` }))
        };
    }

    const indexByKey = new Map();
    const variables = [];
    let nextIndex = 1;
    const metaText = source.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, token) => {
        const label = String(token || "").trim();
        const key = label.toLocaleLowerCase();
        if (!indexByKey.has(key)) {
            indexByKey.set(key, nextIndex);
            variables.push({ index: nextIndex, key, label: `{{${label}}}` });
            nextIndex += 1;
        }
        return `{{${indexByKey.get(key)}}}`;
    });
    return { metaText, variables };
}

function resolveVariableExamples(values = {}, variables = []) {
    return variables.map((variable) => String(values?.[variable.key] || "").trim());
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

function getOfficialPortfolioKey(slot = {}) {
    return String(slot?.metaBusinessId || slot?.businessAccountId || `slot:${slot?.locationId || ""}:${slot?.slotId || ""}`).trim();
}

function getDefaultTemplateValue(placeholder = "", index = 0) {
    const safePlaceholder = String(placeholder || "").trim();
    return /^\d+$/.test(safePlaceholder) ? `valor_${index + 1}` : `valor_${safePlaceholder}`;
}

function getTemplateKey(template = {}) {
    return [
        String(template?.name || "").trim(),
        String(template?.language || "").trim()
    ].join(":");
}

function getTemplateContentPreview(template = {}) {
    const components = Array.isArray(template?.components) ? template.components : [];
    const body = components.find((component) => String(component?.type || "").toUpperCase() === "BODY");
    const header = components.find((component) => String(component?.type || "").toUpperCase() === "HEADER");
    const footer = components.find((component) => String(component?.type || "").toUpperCase() === "FOOTER");
    const buttonsComponent = components.find((component) => String(component?.type || "").toUpperCase() === "BUTTONS");
    const buttons = Array.isArray(buttonsComponent?.buttons)
        ? buttonsComponent.buttons.map((button) => String(button?.text || button?.url || "").trim()).filter(Boolean)
        : [];

    return {
        header: String(header?.text || "").trim(),
        body: String(body?.text || "").trim(),
        footer: String(footer?.text || "").trim(),
        buttons
    };
}

function renderTemplatePreviewWithMappings(text = "", variableMappings = {}) {
    let fallbackIndex = 0;
    return String(text || "").replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, placeholder) => {
        const safePlaceholder = String(placeholder || "").trim();
        const numericIndex = /^\d+$/.test(safePlaceholder)
            ? Math.max(0, Number.parseInt(safePlaceholder, 10) - 1)
            : fallbackIndex;
        fallbackIndex += 1;
        return resolveTemplateMappingValue(variableMappings[safePlaceholder]) || getDefaultTemplateValue(safePlaceholder, numericIndex);
    });
}

function groupGhlVariableOptions(options = []) {
    return options.reduce((groups, option) => {
        const group = String(option?.group || "GHL").trim() || "GHL";
        if (!groups[group]) groups[group] = [];
        groups[group].push(option);
        return groups;
    }, {});
}

function normalizeManualGhlVariable(value = "") {
    const raw = String(value || "").trim()
        .replace(/^\{\{\s*/, "")
        .replace(/\s*\}\}$/, "")
        .trim();
    return raw ? `{{${raw}}}` : "";
}

function resolveTemplateMappingValue(value = "") {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith(LITERAL_TEMPLATE_VALUE_PREFIX)) return raw.slice(LITERAL_TEMPLATE_VALUE_PREFIX.length).trim();
    if (!raw.startsWith(MANUAL_GHL_MAPPING_PREFIX)) return raw;
    return normalizeManualGhlVariable(raw.slice(MANUAL_GHL_MAPPING_PREFIX.length));
}

function getManualMappingInput(value = "") {
    const raw = String(value || "").trim();
    return raw.startsWith(MANUAL_GHL_MAPPING_PREFIX)
        ? raw.slice(MANUAL_GHL_MAPPING_PREFIX.length)
        : "";
}

function getLiteralTemplateValue(value = "") {
    const raw = String(value || "").trim();
    return raw.startsWith(LITERAL_TEMPLATE_VALUE_PREFIX)
        ? raw.slice(LITERAL_TEMPLATE_VALUE_PREFIX.length)
        : "";
}

function buildTemplateCommand(template = {}, fallbackLanguage = "es", variableMappings = {}) {
    const name = String(template?.name || "").trim();
    const language = String(template?.language || fallbackLanguage || "es").trim();
    if (!name || !language) return "";
    const placeholders = getTemplateCommandPlaceholders(template);
    const values = placeholders.map((placeholder, index) => {
        const safePlaceholder = String(placeholder || "").trim();
        return resolveTemplateMappingValue(variableMappings[safePlaceholder]) || getDefaultTemplateValue(safePlaceholder, index);
    });
    return `![TPL:${name}:${language}${values.length ? `|${values.join("|")}` : ""}]!`;
}

function friendlyTemplateError(payload = {}, t) {
    const code = String(payload?.code || "").trim();
    if (code === "OFFICIAL_WABA_ACCESS_LOST") {
        return {
            title: payload.title || (t("templates.builder.access_lost_title") || "La conexión con Meta perdió permisos"),
            message: payload.error || (t("templates.builder.access_lost_message") || "Ya no tenemos acceso a la cuenta de WhatsApp Business vinculada a este número."),
            reason: payload.reason || (t("templates.builder.access_lost_reason") || "Esto suele pasar cuando se elimina a WaFloW como socio/partner del portfolio comercial del cliente o se revocan permisos en Meta."),
            actions: Array.isArray(payload.actions) && payload.actions.length > 0 ? payload.actions : [
                t("templates.builder.access_lost_action_clear") || "Pulsa Limpiar en la configuración del número para quitar la vinculación anterior.",
                t("templates.builder.access_lost_action_reconnect") || "Vuelve a conectar el número con el botón de Meta oficial y acepta nuevamente los permisos.",
                t("templates.builder.access_lost_action_partner") || "Confirma en Meta Business que WaFloW/Clic&App figure como socio con acceso al WABA y al número."
            ]
        };
    }
    return {
        title: t("templates.builder.load_templates_error") || "No se pudieron cargar templates",
        message: payload?.error || payload?.message || (t("templates.builder.generic_templates_error") || "No pudimos consultar las plantillas de este número."),
        reason: payload?.reason || "",
        actions: []
    };
}

export default function OfficialTemplateBuilder({ locations = [], token, onUnauthorized, view = "builder" }) {
    const { t } = useLanguage();
    const mountedRef = useRef(true);
    const slotsLoadRequestRef = useRef(0);
    const templatesLoadRequestRef = useRef(0);
    const [officialSlots, setOfficialSlots] = useState([]);
    const [templatesBySlot, setTemplatesBySlot] = useState({});
    const prevLegacyMappings = useRef({});
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [savingMapping, setSavingMapping] = useState(false);
    const [templateLoadError, setTemplateLoadError] = useState(null);
    const [creating, setCreating] = useState(false);
    const [creationResults, setCreationResults] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [selectedSlotKeys, setSelectedSlotKeys] = useState([]);
    const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
    const [builderStatusTab, setBuilderStatusTab] = useState("pending");
    const [expandedTemplateSections, setExpandedTemplateSections] = useState({ pending: false, rejected: false });
    const [templateVariableMappings, setTemplateVariableMappings] = useState(() => {
        try {
            const stored = localStorage.getItem(TEMPLATE_VARIABLE_MAPPINGS_STORAGE_KEY);
            const parsed = stored ? JSON.parse(stored) : {};
            const isScoped = parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.values(parsed).some((scope) => (
                scope && typeof scope === "object" && !Array.isArray(scope) && Object.values(scope).some((mapping) => (
                    mapping && typeof mapping === "object" && !Array.isArray(mapping)
                ))
            ));
            prevLegacyMappings.current = !isScoped && parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
            return isScoped ? parsed : (parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { __legacy__: parsed } : {});
        } catch {
            return {};
        }
    });
    const [mappingModal, setMappingModal] = useState({
        open: false,
        template: null,
        openSelector: "",
        manualPlaceholder: "",
        searchByPlaceholder: {},
        draftMapping: {}
    });

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
            throw new Error(t("agency.session_expired") || "Sesión expirada");
        }
        return res;
    };

    const getMappingScope = (template = {}) => String(
        selectedSlot?.metaBusinessId ||
        template?.metaBusinessId ||
        selectedSlot?.businessAccountId ||
        template?.businessAccountId ||
        selectedSlot?.locationId ||
        template?.locationId ||
        form.locationId ||
        ""
    ).trim();

    const getMappingForTemplate = (template = {}) => {
        const scope = getMappingScope(template);
        const key = getTemplateKey(template);
        const scoped = scope ? templateVariableMappings[scope] : null;
        if (scoped && typeof scoped === "object" && scoped[key]) return scoped[key];
        const legacy = templateVariableMappings.__legacy__ || templateVariableMappings;
        const legacyStatusKey = `${key}:${String(template?.status || "").trim()}`;
        return legacy?.[key] || legacy?.[legacyStatusKey] || {};
    };

    const persistMappings = async (portfolioId, locationId, mappings) => {
        const safePortfolioId = String(portfolioId || "").trim();
        const safeLocationId = String(locationId || "").trim();
        if (!safePortfolioId || !safeLocationId) {
            toast.error("No se pudieron identificar el portfolio de Meta y la subcuenta.");
            return false;
        }
        try {
            const response = await authFetch("/agency/whatsapp-official/template-mappings", {
                method: "PUT",
                body: JSON.stringify({ locationId: safeLocationId, portfolioId: safePortfolioId, mappings })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || "La API no aceptó las variables GHL.");
            return true;
        } catch (error) {
            toast.error("No se pudieron guardar las variables GHL", { description: error.message });
            return false;
        }
    };

    const loadMappings = async (portfolioId, locationId) => {
        const safePortfolioId = String(portfolioId || "").trim();
        const safeLocationId = String(locationId || "").trim();
        if (!safePortfolioId || !safeLocationId) return;
        try {
            const res = await authFetch(`/agency/whatsapp-official/template-mappings?locationId=${encodeURIComponent(safeLocationId)}&portfolioId=${encodeURIComponent(safePortfolioId)}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return;
            const mappings = data?.mappings && typeof data.mappings === "object" ? data.mappings : {};
            const hasBackendMappings = Object.keys(mappings).length > 0;
            setTemplateVariableMappings((prev) => ({ ...prev, [safePortfolioId]: mappings }));
            if (!hasBackendMappings && Object.keys(prevLegacyMappings.current || {}).length > 0) {
                await persistMappings(safePortfolioId, safeLocationId, prevLegacyMappings.current);
                setTemplateVariableMappings((prev) => ({ ...prev, [safePortfolioId]: prevLegacyMappings.current }));
            }
        } catch {
            // The local fallback remains available if the backend is temporarily unavailable.
        }
    };

    const portfolioOptions = useMemo(() => {
        const portfolios = new Map();
        officialSlots.forEach((slot) => {
            const portfolioId = getOfficialPortfolioKey(slot);
            if (!portfolios.has(portfolioId)) {
                portfolios.set(portfolioId, {
                    portfolioId,
                    metaBusinessId: slot.metaBusinessId || "",
                    metaBusinessName: slot.metaBusinessName || "",
                    businessAccountIds: new Set(),
                    locationNames: new Set(),
                    slots: []
                });
            }
            const portfolio = portfolios.get(portfolioId);
            if (!portfolio.metaBusinessName && slot.metaBusinessName) portfolio.metaBusinessName = slot.metaBusinessName;
            if (slot.businessAccountId) portfolio.businessAccountIds.add(slot.businessAccountId);
            portfolio.locationNames.add(slot.locationName || slot.locationId);
            portfolio.slots.push(slot);
        });
        return [...portfolios.values()]
            .map((portfolio) => ({
                ...portfolio,
                locationLabel: [...portfolio.locationNames].sort().join(" · "),
                locationCount: portfolio.locationNames.size,
                count: portfolio.slots.length,
                wabaCount: portfolio.businessAccountIds.size
            }))
            .sort((a, b) => a.locationLabel.localeCompare(b.locationLabel));
    }, [officialSlots]);

    const availableSlotsForPortfolio = useMemo(
        () => officialSlots.filter((slot) => getOfficialPortfolioKey(slot) === selectedPortfolioId),
        [officialSlots, selectedPortfolioId]
    );

    const selectedSlots = useMemo(() => {
        const selected = new Set(selectedSlotKeys);
        return officialSlots.filter((slot) => selected.has(`${slot.locationId}:${slot.slotId}`));
    }, [officialSlots, selectedSlotKeys]);

    const selectedSlot = useMemo(
        () => selectedSlots[0] || officialSlots.find((slot) => slot.locationId === form.locationId && String(slot.slotId) === String(form.slotId)) || null,
        [officialSlots, form.locationId, form.slotId, selectedSlots]
    );

    const selectedWabaGroups = useMemo(() => {
        const groups = new Map();
        selectedSlots.forEach((slot) => {
            const key = slot.businessAccountId || `slot:${slot.locationId}:${slot.slotId}`;
            if (!groups.has(key)) groups.set(key, { businessAccountId: slot.businessAccountId, slots: [] });
            groups.get(key).slots.push(slot);
        });
        return [...groups.values()];
    }, [selectedSlots]);

    const currentTemplates = useMemo(() => {
        if (!selectedSlot) return [];
        return templatesBySlot[`${selectedSlot.locationId}:${selectedSlot.slotId}`]?.templates || [];
    }, [selectedSlot, templatesBySlot]);
    const groupedTemplates = useMemo(() => groupTemplates(currentTemplates), [currentTemplates]);
    const bodyVariableAnalysis = useMemo(() => analyzeTemplateVariables(form.bodyText), [form.bodyText]);
    const headerVariableAnalysis = useMemo(() => analyzeTemplateVariables(form.headerText), [form.headerText]);
    const variableIndexes = useMemo(
        () => bodyVariableAnalysis.variables.map((variable) => variable.index),
        [bodyVariableAnalysis]
    );
    const bodyExamples = useMemo(
        () => resolveVariableExamples(form.bodyExamples, bodyVariableAnalysis.variables),
        [bodyVariableAnalysis, form.bodyExamples]
    );
    const headerExamples = useMemo(
        () => resolveVariableExamples(form.headerExamples, headerVariableAnalysis.variables),
        [form.headerExamples, headerVariableAnalysis]
    );
    const buttons = useMemo(
        () => (Array.isArray(form.buttons) ? form.buttons.filter((button) => String(button?.text || "").trim()) : []),
        [form.buttons]
    );
    const isAuthenticationTemplate = form.category === "AUTHENTICATION";
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
        return bodyVariableAnalysis.metaText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, index) => bodyExamples[Number(index) - 1] || `{{${index}}}`);
    }, [bodyExamples, bodyVariableAnalysis.metaText, t]);

    const previewHeaderText = useMemo(() => {
        if (form.headerFormat !== "TEXT") return "";
        return headerVariableAnalysis.metaText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, index) => headerExamples[Number(index) - 1] || `{{${index}}}`);
    }, [form.headerFormat, headerExamples, headerVariableAnalysis.metaText]);

    const setFormField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: key === "name" ? normalizeTemplateName(value) : value }));
    };

    const setVariableExample = (field, key, value) => {
        setForm((prev) => ({
            ...prev,
            [field]: {
                ...(prev[field] && typeof prev[field] === "object" ? prev[field] : {}),
                [key]: value
            }
        }));
    };

    const addButton = () => {
        setForm((prev) => ({
            ...prev,
            buttons: [...(Array.isArray(prev.buttons) ? prev.buttons : []), { type: "QUICK_REPLY", text: "", url: "", urlExample: "", phoneNumber: "", flowId: "", navigateScreen: "" }]
        }));
    };

    const updateButton = (index, key, value) => {
        setForm((prev) => ({
            ...prev,
            buttons: (Array.isArray(prev.buttons) ? prev.buttons : []).map((button, buttonIndex) => (
                buttonIndex === index ? { ...button, [key]: value } : button
            ))
        }));
    };

    const removeButton = (index) => {
        setForm((prev) => ({
            ...prev,
            buttons: (Array.isArray(prev.buttons) ? prev.buttons : []).filter((_, buttonIndex) => buttonIndex !== index)
        }));
    };

    const setAuthenticationField = (key, value) => {
        setForm((prev) => ({
            ...prev,
            authentication: {
                ...(prev.authentication || {}),
                [key]: value
            }
        }));
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
                                metaBusinessId: official.metaBusinessId || official.embeddedSignupBusinessId || "",
                                metaBusinessName: official.metaBusinessName || "",
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
            const rawSlots = details.flat();
            const portfolioRequests = new Map();
            const nextSlots = await Promise.all(rawSlots.map(async (slot) => {
                if (slot.metaBusinessId) return slot;
                const requestKey = slot.businessAccountId || `${slot.locationId}:${slot.slotId}`;
                if (!portfolioRequests.has(requestKey)) {
                    const query = new URLSearchParams({
                        locationId: slot.locationId,
                        slotId: String(slot.slotId)
                    });
                    portfolioRequests.set(requestKey, authFetch(`/agency/whatsapp-official/template-portfolio?${query.toString()}`)
                        .then((res) => res.ok ? res.json() : null)
                        .catch(() => null));
                }
                const portfolio = await portfolioRequests.get(requestKey);
                return {
                    ...slot,
                    metaBusinessId: String(portfolio?.metaBusinessId || "").trim(),
                    metaBusinessName: String(portfolio?.metaBusinessName || "").trim()
                };
            }));
            if (!mountedRef.current || slotsLoadRequestRef.current !== requestId) return;
            setOfficialSlots(nextSlots);
            setForm((prev) => {
                if (nextSlots.some((slot) => slot.locationId === prev.locationId && String(slot.slotId) === String(prev.slotId))) {
                    return prev;
                }
                const first = nextSlots[0];
                return first ? { ...prev, locationId: first.locationId, slotId: String(first.slotId) } : prev;
            });
            setSelectedSlotKeys((prev) => {
                const validKeys = new Set(nextSlots.map((slot) => `${slot.locationId}:${slot.slotId}`));
                const retained = prev.filter((key) => validKeys.has(key));
                if (retained.length > 0) return retained;
                const first = nextSlots[0];
                return first ? [`${first.locationId}:${first.slotId}`] : [];
            });
            setSelectedPortfolioId((prev) => {
                const availablePortfolioIds = new Set(nextSlots.map(getOfficialPortfolioKey));
                if (prev && availablePortfolioIds.has(prev)) return prev;
                return nextSlots[0] ? getOfficialPortfolioKey(nextSlots[0]) : "";
            });
        } catch (error) {
            if (!mountedRef.current || slotsLoadRequestRef.current !== requestId) return;
            toast.error(t("templates.builder.load_slots_error") || "No se pudieron cargar números oficiales de Meta", {
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
        const scopes = new Map();
        officialSlots.forEach((slot) => {
            const portfolioId = getOfficialPortfolioKey(slot);
            if (portfolioId && !scopes.has(portfolioId)) scopes.set(portfolioId, slot.locationId);
        });
        scopes.forEach((locationId, portfolioId) => loadMappings(portfolioId, locationId));
    }, [officialSlots]);

    useEffect(() => {
        if (selectedSlot?.hasAccessToken) loadTemplates(selectedSlot);
    }, [selectedSlot?.locationId, selectedSlot?.slotId]);

    const applyExample = () => {
        setForm((prev) => ({
            ...prev,
            name: "recordatorio_cita",
            language: "es",
            category: "UTILITY",
            headerFormat: "TEXT",
            headerText: "Recordatorio para {{cliente}}",
            headerExamples: { cliente: "Luis" },
            bodyText: "Hola {{cliente}}, recuerda tu cita para el {{fecha}}.",
            bodyExamples: { cliente: "Luis", fecha: "viernes 10:00" },
            footerText: "Responde para confirmar.",
            buttons: [
                { type: "QUICK_REPLY", text: "Confirmar" },
                { type: "QUICK_REPLY", text: "Reprogramar" }
            ]
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
        setMappingModal({
            open: true,
            template,
            openSelector: "",
            manualPlaceholder: "",
            searchByPlaceholder: {},
            draftMapping: { ...getTemplateMapping(template) }
        });
    };

    const closeMappingModal = () => {
        setMappingModal({ open: false, template: null, openSelector: "", manualPlaceholder: "", searchByPlaceholder: {}, draftMapping: {} });
    };

    const updateTemplateMapping = (_template, placeholder, value) => {
        const safePlaceholder = String(placeholder || "").trim();
        setMappingModal((prev) => ({
            ...prev,
            draftMapping: {
                ...(prev.draftMapping || {}),
                [safePlaceholder]: value
            }
        }));
    };

    const saveTemplateMapping = async () => {
        const template = mappingModal.template;
        if (!template) return;
        if (savingMapping) return;
        const key = getTemplateKey(template);
        const portfolioId = getMappingScope(template);
        const locationId = String(selectedSlot?.locationId || template?.locationId || form.locationId || "").trim();
        const currentScope = templateVariableMappings[portfolioId] && typeof templateVariableMappings[portfolioId] === "object"
            ? templateVariableMappings[portfolioId]
            : {};
        const nextScope = {
            ...currentScope,
            [key]: {
                ...(mappingModal.draftMapping || {})
            }
        };
        setSavingMapping(true);
        try {
            const saved = await persistMappings(portfolioId, locationId, nextScope);
            if (!saved) return;
            setTemplateVariableMappings((prev) => ({ ...prev, [portfolioId]: nextScope }));
            toast.success("Variables GHL guardadas");
            closeMappingModal();
        } finally {
            setSavingMapping(false);
        }
    };

    const getTemplateMapping = (template) => {
        return getMappingForTemplate(template);
    };

    const selectPortfolio = (portfolioId) => {
        const portfolio = portfolioOptions.find((item) => item.portfolioId === portfolioId);
        const firstSlot = portfolio?.slots?.[0] || null;
        const portfolioSlotKeys = (portfolio?.slots || []).map((slot) => `${slot.locationId}:${slot.slotId}`);
        setSelectedPortfolioId(portfolioId);
        setForm((prev) => ({
            ...prev,
            locationId: firstSlot?.locationId || "",
            slotId: firstSlot ? String(firstSlot.slotId) : ""
        }));
        setSelectedSlotKeys(portfolioSlotKeys);
        setCreationResults(null);
    };

    const selectReferenceSlot = (slot) => {
        if (!slot) return;
        setSelectedPortfolioId(getOfficialPortfolioKey(slot));
        setSelectedSlotKeys([`${slot.locationId}:${slot.slotId}`]);
        setForm((prev) => ({
            ...prev,
            locationId: slot.locationId,
            slotId: String(slot.slotId)
        }));
        setCreationResults(null);
    };

    const toggleSlotSelection = (slot) => {
        const key = `${slot.locationId}:${slot.slotId}`;
        setSelectedSlotKeys((prev) => {
            if (prev.includes(key)) {
                const next = prev.filter((item) => item !== key);
                const nextPrimary = officialSlots.find((item) => `${item.locationId}:${item.slotId}` === next[0]);
                setForm((current) => ({
                    ...current,
                    locationId: nextPrimary?.locationId || current.locationId,
                    slotId: nextPrimary ? String(nextPrimary.slotId) : ""
                }));
                return next;
            }
            setForm((current) => ({
                ...current,
                locationId: current.locationId || slot.locationId,
                slotId: current.slotId || String(slot.slotId)
            }));
            return [...prev, key];
        });
        setCreationResults(null);
    };

    const createTemplate = async (event) => {
        event.preventDefault();
        if (!selectedSlot || selectedSlots.length === 0) {
            toast.error(t("templates.builder.no_official_slots") || "No hay números oficiales de Meta conectados");
            return;
        }
        if (!normalizedName || (!isAuthenticationTemplate && !form.bodyText.trim())) {
            toast.error(t("templates.builder.required_error") || "Nombre y mensaje son requeridos");
            return;
        }
        const missingExample = !isAuthenticationTemplate && variableIndexes.some((index) => !bodyExamples[index - 1]);
        if (missingExample) {
            toast.error(t("templates.builder.examples_error") || "Agrega un ejemplo por cada variable detectada");
            return;
        }
        if (!isAuthenticationTemplate && form.headerFormat === "TEXT" && headerVariableAnalysis.variables.length > 1) {
            toast.error("El encabezado de texto de Meta admite una sola variable.");
            return;
        }
        if (!isAuthenticationTemplate && form.headerFormat === "TEXT" && headerVariableAnalysis.variables.length && !headerExamples[0]) {
            toast.error("Agrega el ejemplo de la variable del encabezado.");
            return;
        }

        setCreating(true);
        try {
            const res = await authFetch("/agency/whatsapp-official/templates", {
                method: "POST",
                body: JSON.stringify({
                    locationId: selectedSlot.locationId,
                    slotId: selectedSlot.slotId,
                    targets: selectedSlots.map((slot) => ({
                        locationId: slot.locationId,
                        slotId: slot.slotId
                    })),
                    name: normalizedName,
                    language: form.language,
                    category: form.category,
                    bodyText: form.bodyText,
                    bodyExamples,
                    headerFormat: form.headerFormat,
                    headerText: form.headerText,
                    headerExamples,
                    headerMediaHandle: form.headerMediaHandle,
                    footerText: form.footerText,
                    buttons,
                    authentication: form.authentication
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const firstFailure = Array.isArray(data?.results)
                    ? data.results.find((result) => result?.status === "failed")
                    : null;
                const metaDetails = firstFailure?.meta || data?.meta || {};
                const diagnostic = [
                    data?.reason,
                    firstFailure?.businessAccountId ? `WABA ${firstFailure.businessAccountId}` : "",
                    Number.isFinite(Number(metaDetails?.code)) ? `Meta ${metaDetails.code}${metaDetails.subcode ? `/${metaDetails.subcode}` : ""}` : ""
                ].filter(Boolean).join(" · ");
                throw new Error([data.error || (t("templates.builder.create_error") || "No se pudo crear la plantilla"), diagnostic].filter(Boolean).join(" — "));
            }
            setCreationResults(data);
            const createdCount = Number(data?.summary?.created || 0);
            const duplicateCount = Number(data?.summary?.duplicates || 0);
            const failedCount = Number(data?.summary?.failed || 0);
            toast.success(
                failedCount > 0
                    ? `Template procesado en ${createdCount + duplicateCount} WABA; ${failedCount} operación(es) requieren revisión.`
                    : duplicateCount > 0 && createdCount === 0
                        ? `El template ya existía en ${duplicateCount} WABA.`
                        : t("templates.builder.created") || "Plantilla enviada a revision de Meta"
            );
            await loadTemplates(selectedSlot);
        } catch (error) {
            toast.error(t("templates.builder.create_error") || "No se pudo crear la plantilla", {
                description: error.message
            });
        } finally {
            setCreating(false);
        }
    };

    const renderTemplateList = (title, items, tone, icon, {
        containerClassName = "",
        listClassName = "",
        collapsible = false,
        expanded = true,
        onToggle = null,
        bare = false,
        flat = false
    } = {}) => {
        const StatusIcon = icon;
        const canToggle = collapsible && items.length > 0;
        const showContent = !collapsible || expanded;
        return (
            <section className={bare || flat ? containerClassName : `rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 ${containerClassName}`}>
                {(!bare || flat) ? <div className={`flex items-center justify-between gap-3 ${showContent ? "mb-3" : ""}`}>
                    {canToggle ? (
                        <button type="button" onClick={onToggle} className="flex items-center gap-2 text-left">
                            <StatusIcon size={16} className={tone} />
                            <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">{title}</h4>
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <StatusIcon size={16} className={tone} />
                            <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">{title}</h4>
                        </div>
                    )}
                    {canToggle ? (
                        <button
                            type="button"
                            onClick={onToggle}
                            aria-expanded={expanded}
                            className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500 dark:bg-gray-800">{items.length}</span>
                            <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </button>
                    ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500 dark:bg-gray-800">{items.length}</span>
                    )}
                </div> : null}
                {showContent ? <div className={`space-y-2 ${listClassName}`}>
                    {items.length === 0 ? (
                        <p className="text-sm text-gray-500">{t("templates.builder.empty_status") || "Sin plantillas en este estado."}</p>
                    ) : items.map((template) => {
                        const mapping = getTemplateMapping(template);
                        const command = buildTemplateCommand(template, form.language, mapping);
                        const placeholders = getTemplateCommandPlaceholders(template);
                        const contentPreview = getTemplateContentPreview(template);
                        return (
                            <div key={`${template.name}-${template.language}-${template.status}`} className={flat ? "border-b border-gray-200 py-4 last:border-b-0 dark:border-gray-800" : "rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40"}>
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
                                {contentPreview.body || contentPreview.header || contentPreview.footer || contentPreview.buttons.length ? (
                                    <div className={flat ? "mt-3 border-l-2 border-gray-200 pl-3 dark:border-gray-700" : "mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900"}>
                                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Mensaje</p>
                                        {contentPreview.header ? <p className="mt-1 text-xs font-bold text-gray-700 dark:text-gray-200">{contentPreview.header}</p> : null}
                                        {contentPreview.body ? <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-sm font-semibold leading-relaxed text-gray-800 dark:text-gray-100">{contentPreview.body}</p> : null}
                                        {contentPreview.footer ? <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{contentPreview.footer}</p> : null}
                                        {contentPreview.buttons.length ? (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {contentPreview.buttons.map((button, index) => <span key={`${button}-${index}`} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">{button}</span>)}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                                {command ? <code className={flat ? "mt-2 block break-all bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300" : "mt-2 block break-all rounded-lg bg-white px-2 py-1.5 text-xs text-emerald-700 dark:bg-gray-900 dark:text-emerald-300"}>{command}</code> : null}
                            </div>
                        );
                    })}
                </div> : null}
            </section>
        );
    };

    const renderBuilderReviewPanel = () => {
        const activeItems = builderStatusTab === "rejected"
            ? groupedTemplates.rejected
            : groupedTemplates.pending;
        const activeTitle = builderStatusTab === "rejected"
            ? (t("templates.builder.rejected") || "Rechazadas")
            : (t("templates.builder.pending") || "Pendientes");
        const activeTone = builderStatusTab === "rejected" ? "text-red-500" : "text-amber-500";
        const ActiveIcon = builderStatusTab === "rejected" ? XCircle : FileText;

        return (
            <section className="min-h-[20rem] flex-1 border-t border-gray-200 pt-5 dark:border-gray-800 xl:min-h-0 xl:flex xl:flex-col">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                            {t("templates.builder.review_status") || "Revisión de Meta"}
                        </h4>
                        <p className="mt-1 text-xs text-gray-500">
                            {t("templates.builder.review_status_help") || "Consulta las solicitudes pendientes o rechazadas de este WABA."}
                        </p>
                    </div>
                </div>
                <div className="mb-4 grid grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-950/60">
                    <button
                        type="button"
                        onClick={() => setBuilderStatusTab("pending")}
                        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold transition ${builderStatusTab === "pending" ? "bg-white text-amber-600 shadow-sm dark:bg-gray-800 dark:text-amber-300" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}
                    >
                        <FileText size={14} />
                        {t("templates.builder.pending") || "Pendientes"}
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">{groupedTemplates.pending.length}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setBuilderStatusTab("rejected")}
                        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold transition ${builderStatusTab === "rejected" ? "bg-white text-red-600 shadow-sm dark:bg-gray-800 dark:text-red-300" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}
                    >
                        <XCircle size={14} />
                        {t("templates.builder.rejected") || "Rechazadas"}
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700 dark:bg-red-950/50 dark:text-red-300">{groupedTemplates.rejected.length}</span>
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    {renderTemplateList(activeTitle, activeItems, activeTone, ActiveIcon, {
                        bare: true,
                        containerClassName: "",
                        listClassName: "space-y-2"
                    })}
                </div>
            </section>
        );
    };

    const renderVariableMappingModal = () => {
        if (!mappingModal.open || !mappingModal.template) return null;

        const template = mappingModal.template;
        const placeholders = getTemplateCommandPlaceholders(template);
        const mapping = mappingModal.draftMapping || {};
        const mappedCommand = buildTemplateCommand(template, form.language, mapping);
        const contentPreview = getTemplateContentPreview(template);

        return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-gray-800">
                        <div>
                            <p className="text-xs font-extrabold uppercase tracking-widest text-indigo-500">
                                {t("templates.builder.variable_mapper") || "Mapeador de variables"}
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

                        {contentPreview.header || contentPreview.body || contentPreview.footer || contentPreview.buttons.length ? (
                            <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950/40">
                                <p className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">Vista previa del mensaje</p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Las variables se muestran con la equivalencia GHL seleccionada abajo.</p>
                                <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                                    {contentPreview.header ? <p className="whitespace-pre-wrap text-sm font-extrabold text-gray-900 dark:text-white">{renderTemplatePreviewWithMappings(contentPreview.header, mapping)}</p> : null}
                                    {contentPreview.body ? <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-gray-800 dark:text-gray-100">{renderTemplatePreviewWithMappings(contentPreview.body, mapping)}</p> : null}
                                    {contentPreview.footer ? <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">{renderTemplatePreviewWithMappings(contentPreview.footer, mapping)}</p> : null}
                                    {contentPreview.buttons.length ? (
                                        <div className="mt-3 grid gap-2">
                                            {contentPreview.buttons.map((button, index) => <div key={`${button}-${index}`} className="rounded-lg border border-sky-200 px-3 py-2 text-center text-xs font-bold text-sky-700 dark:border-sky-900/60 dark:text-sky-300">{renderTemplatePreviewWithMappings(button, mapping)}</div>)}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}

                        <div className="space-y-3">
                            <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-200">
                                Incluye campos estándar de contacto, usuario, cita, oportunidad, cuenta, calendario, campaña y factura. Para campos personalizados, objetos o valores propios de tu cuenta, usa la opción manual: las llaves se agregan automáticamente.
                            </p>
                            {placeholders.map((placeholder, index) => {
                                const selectedValue = String(mapping[placeholder] || "").trim();
                                const search = String(mappingModal.searchByPlaceholder?.[placeholder] || "").trim().toLowerCase();
                                const filteredOptions = GHL_VARIABLE_OPTIONS.filter((option) => {
                                    if (!search) return true;
                                    return `${option.label} ${option.value} ${option.group}`.toLowerCase().includes(search);
                                });
                                const isLiteralValue = selectedValue.startsWith(LITERAL_TEMPLATE_VALUE_PREFIX);
                                const mappingMode = isLiteralValue ? "literal" : "ghl";
                                const selectedInFilter = selectedValue.startsWith(MANUAL_GHL_MAPPING_PREFIX) || isLiteralValue || !selectedValue || filteredOptions.some((option) => option.value === selectedValue);
                                const selectedOption = GHL_VARIABLE_OPTIONS.find((option) => option.value === selectedValue);
                                const groupedSelectOptions = selectedInFilter
                                    ? groupGhlVariableOptions(filteredOptions)
                                    : groupGhlVariableOptions([
                                        selectedOption || { value: selectedValue, label: selectedValue, group: t("templates.builder.selected_variable") || "Seleccionada" },
                                        ...filteredOptions
                                    ]);
                                const isSelectorOpen = mappingModal.openSelector === placeholder;
                                const isManualMode = mappingModal.manualPlaceholder === placeholder;
                                const manualValue = getManualMappingInput(selectedValue);
                                const literalValue = getLiteralTemplateValue(selectedValue);
                                const selectedLabel = isLiteralValue
                                    ? `Valor: ${literalValue || "sin valor"}`
                                    : selectedValue.startsWith(MANUAL_GHL_MAPPING_PREFIX)
                                    ? `Manual: ${normalizeManualGhlVariable(manualValue) || "sin valor"}`
                                    : (selectedOption?.label || getDefaultTemplateValue(placeholder, index));

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
                                                {t("templates.builder.ghl_equivalence") || "Equivalencia"}
                                            </p>
                                            <select
                                                value={mappingMode}
                                                onChange={(event) => {
                                                    const nextMode = event.target.value;
                                                    updateTemplateMapping(template, placeholder, nextMode === "literal" ? LITERAL_TEMPLATE_VALUE_PREFIX : "");
                                                    setMappingModal((prev) => ({ ...prev, openSelector: "", manualPlaceholder: "" }));
                                                }}
                                                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            >
                                                <option value="ghl">Elegir variable de GHL</option>
                                                <option value="literal">Escribir el valor</option>
                                            </select>
                                            {mappingMode === "literal" ? (
                                                <div className="mt-2">
                                                    <input
                                                        autoFocus
                                                        value={literalValue}
                                                        onChange={(event) => updateTemplateMapping(template, placeholder, `${LITERAL_TEMPLATE_VALUE_PREFIX}${event.target.value}`)}
                                                        placeholder="Escribe el valor que irá en el comando"
                                                        className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-800 dark:bg-gray-950 dark:text-white"
                                                    />
                                                    <p className="mt-1.5 text-xs text-gray-500">Se copiará como texto real, sin llaves de variable.</p>
                                                </div>
                                            ) : (
                                            <div className="relative mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setMappingModal((prev) => ({
                                                        ...prev,
                                                        openSelector: isSelectorOpen ? "" : placeholder,
                                                        manualPlaceholder: ""
                                                    }))}
                                                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                                >
                                                    <span className="truncate">{selectedLabel}</span>
                                                    <span className="text-gray-400">⌄</span>
                                                </button>
                                                {isSelectorOpen ? (
                                                    <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                                                        <div className="border-b border-gray-100 p-2 dark:border-gray-800">
                                                            <div className="relative">
                                                                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                                                                <input
                                                                    autoFocus
                                                                    value={search}
                                                                    onChange={(event) => setMappingModal((prev) => ({
                                                                        ...prev,
                                                                        searchByPlaceholder: { ...(prev.searchByPlaceholder || {}), [placeholder]: event.target.value }
                                                                    }))}
                                                                    placeholder="Buscar variable GHL..."
                                                                    className="wf-input-with-icon w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setMappingModal((prev) => ({ ...prev, manualPlaceholder: placeholder }))}
                                                                className="mt-2 w-full rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-left text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                                                            >
                                                                + Escribir variable manualmente
                                                            </button>
                                                            {isManualMode ? (
                                                                <input
                                                                    value={manualValue}
                                                                    onChange={(event) => updateTemplateMapping(template, placeholder, `${MANUAL_GHL_MAPPING_PREFIX}${event.target.value}`)}
                                                                    placeholder="ej.: contact.custom_field"
                                                                    className="mt-2 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-800 dark:bg-gray-950 dark:text-white"
                                                                />
                                                            ) : null}
                                                        </div>
                                                        <div className="max-h-56 overflow-y-auto p-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    updateTemplateMapping(template, placeholder, "");
                                                                    setMappingModal((prev) => ({ ...prev, openSelector: "", manualPlaceholder: "" }));
                                                                }}
                                                                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                                                            >
                                                                {getDefaultTemplateValue(placeholder, index)}
                                                            </button>
                                                            {Object.entries(groupedSelectOptions).map(([group, options]) => (
                                                                <div key={`${placeholder}-${group}`} className="mt-2">
                                                                    <p className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-400">{group}</p>
                                                                    {options.map((option) => (
                                                                        <button
                                                                            key={`${placeholder}-${option.value}`}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                updateTemplateMapping(template, placeholder, option.value);
                                                                                setMappingModal((prev) => ({ ...prev, openSelector: "", manualPlaceholder: "" }));
                                                                            }}
                                                                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-indigo-50 dark:text-gray-200 dark:hover:bg-indigo-950/30"
                                                                        >
                                                                            {option.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                            {!filteredOptions.length ? <p className="px-3 py-2 text-xs text-gray-500">Sin coincidencias. Puedes usar la opción manual.</p> : null}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                            )}
                                            {selectedValue ? (
                                                <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                                                        {isLiteralValue ? "Valor que se copiará" : (t("templates.builder.selected_ghl_variable") || "Variable GHL seleccionada")}
                                                    </p>
                                                    <code className="mt-1 block break-all text-xs font-bold text-indigo-700 dark:text-indigo-200">
                                                        {resolveTemplateMappingValue(selectedValue)}
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
                            {t("common.cancel") || "Cancelar"}
                        </button>
                        <button
                            type="button"
                            onClick={saveTemplateMapping}
                            disabled={savingMapping}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                        >
                            {savingMapping ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            {savingMapping ? "Guardando..." : (t("common.save") || "Guardar")}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderTemplateButtonsSection = () => (
        <section className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Botones</p>
                    <p className="text-xs text-gray-500">Respuestas rapidas, URL, llamada telefonica o Flow.</p>
                </div>
                <button type="button" onClick={addButton} disabled={(form.buttons || []).length >= 10} className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 disabled:opacity-50 dark:border-indigo-900 dark:text-indigo-300">Agregar boton</button>
            </div>
            <div className="space-y-3">
                {(form.buttons || []).map((button, index) => (
                    <div key={`button-${index}`} className="border-b border-gray-100 pb-3 last:border-b-0 dark:border-gray-800">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                            <select value={button.type || "QUICK_REPLY"} onChange={(event) => updateButton(index, "type", event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                                <option value="QUICK_REPLY">Respuesta rápida</option>
                                <option value="URL">Visitar sitio web</option>
                                <option value="PHONE_NUMBER">Llamar por telefono</option>
                                <option value="FLOW">Abrir Flow</option>
                            </select>
                            <input value={button.text || ""} onChange={(event) => updateButton(index, "text", event.target.value)} placeholder="Texto del boton" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                            <button type="button" onClick={() => removeButton(index)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 dark:border-red-900">Eliminar</button>
                        </div>
                        {button.type === "URL" ? <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2"><input value={button.url || ""} onChange={(event) => updateButton(index, "url", event.target.value)} placeholder="https://ejemplo.com/promo/{{codigo}}" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" /><input value={button.urlExample || ""} onChange={(event) => updateButton(index, "urlExample", event.target.value)} placeholder="Ejemplo si la URL tiene variable" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></div> : null}
                        {button.type === "PHONE_NUMBER" ? <input value={button.phoneNumber || ""} onChange={(event) => updateButton(index, "phoneNumber", event.target.value)} placeholder="Número con código de país" className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" /> : null}
                        {button.type === "FLOW" ? <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2"><input value={button.flowId || ""} onChange={(event) => updateButton(index, "flowId", event.target.value)} placeholder="Flow ID" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" /><input value={button.navigateScreen || ""} onChange={(event) => updateButton(index, "navigateScreen", event.target.value)} placeholder="ID de pantalla inicial" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></div> : null}
                    </div>
                ))}
            </div>
        </section>
    );

    if (view === "library") {
        const selectedReferenceKey = selectedSlot ? `${selectedSlot.locationId}:${selectedSlot.slotId}` : "";
        return (
            <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4" translate="no">
                {renderVariableMappingModal()}

                {loadingSlots ? (
                    <div className="border-l-2 border-indigo-400 pl-4 text-indigo-900 dark:border-indigo-500 dark:text-indigo-100">
                        <div className="flex items-center gap-3"><Loader2 size={20} className="animate-spin" /> {t("templates.builder.loading_slots") || "Buscando números oficiales de Meta..."}</div>
                    </div>
                ) : officialSlots.length === 0 ? (
                    <div className="text-sm text-gray-500">
                        {t("templates.builder.no_ready_slots_short") || "Sin números listos para plantillas"}
                    </div>
                ) : (
                    <>
                        <section className="space-y-4">
                            <div className="grid gap-5 lg:grid-cols-2">
                                <label className="block text-sm font-extrabold text-gray-800 dark:text-gray-100">
                                    {t("templates.library.portfolio") || "Portafolio Meta"}
                                    <select
                                        value={selectedPortfolioId}
                                        onChange={(event) => {
                                            const portfolio = portfolioOptions.find((item) => item.portfolioId === event.target.value);
                                            selectReferenceSlot(portfolio?.slots?.[0]);
                                        }}
                                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                    >
                                        {portfolioOptions.map((portfolio) => (
                                            <option key={portfolio.portfolioId} value={portfolio.portfolioId}>
                                                {(portfolio.metaBusinessName || portfolio.locationLabel || "Portafolio Meta")} · {portfolio.count} {portfolio.count === 1 ? "número" : "números"}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block text-sm font-extrabold text-gray-800 dark:text-gray-100">
                                    {t("templates.library.reference_number") || "Número de referencia"}
                                    <select
                                        value={selectedReferenceKey}
                                        onChange={(event) => selectReferenceSlot(officialSlots.find((slot) => `${slot.locationId}:${slot.slotId}` === event.target.value))}
                                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                    >
                                        {availableSlotsForPortfolio.map((slot) => (
                                            <option key={`${slot.locationId}:${slot.slotId}`} value={`${slot.locationId}:${slot.slotId}`}>
                                                {slot.locationName} · {slot.slotName}{slot.phone ? ` · ${slot.phone}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            {selectedSlot ? <p className="mt-3 text-xs text-gray-500">{selectedSlot.locationName} / {selectedSlot.slotName}{selectedSlot.phone ? ` - ${selectedSlot.phone}` : ""}. Las plantillas se consultan para este WABA.</p> : null}
                        </section>

                        {templateLoadError ? (
                            <div className="border-l-2 border-amber-400 pl-4 text-amber-950 dark:border-amber-500 dark:text-amber-100">
                                <div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" /><div><p className="font-extrabold">{templateLoadError.title}</p><p className="mt-1 text-sm font-semibold">{templateLoadError.message}</p></div></div>
                            </div>
                        ) : null}

                        {selectedSlot ? (
                            <>
                                {renderTemplateList(t("templates.builder.approved") || "Aprobadas", groupedTemplates.approved, "text-emerald-500", CheckCircle2, {
                                    containerClassName: "min-h-[32rem] flex flex-col",
                                    listClassName: "min-h-0 flex-1 overflow-y-auto pr-1",
                                    flat: true
                                })}
                                <div className="space-y-6">
                                    {renderTemplateList(t("templates.builder.pending") || "Pendientes", groupedTemplates.pending, "text-amber-500", FileText, {
                                        collapsible: true,
                                        expanded: expandedTemplateSections.pending,
                                        onToggle: () => setExpandedTemplateSections((prev) => ({ ...prev, pending: !prev.pending })),
                                        listClassName: "max-h-80 overflow-y-auto pr-1",
                                        flat: true
                                    })}
                                    {renderTemplateList(t("templates.builder.rejected") || "Rechazadas", groupedTemplates.rejected, "text-red-500", XCircle, {
                                        collapsible: true,
                                        expanded: expandedTemplateSections.rejected,
                                        onToggle: () => setExpandedTemplateSections((prev) => ({ ...prev, rejected: !prev.rejected })),
                                        listClassName: "max-h-80 overflow-y-auto pr-1",
                                        flat: true
                                    })}
                                </div>
                            </>
                        ) : null}
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="official-template-builder-ui mx-auto max-w-7xl space-y-5 animate-in fade-in slide-in-from-bottom-4" translate="no">
            {renderVariableMappingModal()}

            {loadingSlots ? (
                <div className="border-l-2 border-indigo-400 pl-4 text-indigo-900 dark:border-indigo-500 dark:text-indigo-100">
                    <div className="flex items-start gap-3">
                        <Loader2 size={20} className="mt-0.5 shrink-0 animate-spin" />
                        <div>
                            <p className="font-bold">{t("templates.builder.loading_slots") || "Buscando números oficiales de Meta..."}</p>
                            <p className="mt-1 text-sm">{t("templates.builder.loading_slots_desc") || "Estamos revisando las cuentas conectadas. Esto puede tardar unos segundos si tienes varias cuentas."}</p>
                        </div>
                    </div>
                </div>
            ) : null}

            {officialSlots.length === 0 && !loadingSlots ? (
                <div className="border-l-2 border-amber-400 pl-4 text-amber-900 dark:border-amber-500 dark:text-amber-100">
                    <p className="font-bold">{t("templates.builder.no_official_slots") || "No hay números oficiales de Meta conectados."}</p>
                    <p className="mt-1 text-sm">{t("templates.builder.no_official_slots_desc") || "Este apartado se habilita cuando una cuenta tiene al menos un número vinculado con WhatsApp oficial de Meta."}</p>
                </div>
            ) : null}

            {templateLoadError ? (
                <div className="border-l-2 border-amber-400 pl-4 text-amber-950 dark:border-amber-500 dark:text-amber-100">
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

            {creationResults?.results?.length > 0 ? (
                <div className="border-l-2 border-indigo-400 pl-4 text-indigo-950 dark:border-indigo-500 dark:text-indigo-100">
                    <p className="font-extrabold">Resultado de creación por WABA</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {creationResults.results.map((result, index) => (
                            <div key={`${result.businessAccountId || "waba"}-${index}`} className="border-b border-indigo-100 py-2 text-sm last:border-b-0 dark:border-indigo-900/50">
                                <div className="flex items-center gap-2 font-bold">
                                    {result.status === "created" || result.status === "duplicate" ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-amber-600" />}
                                    <span>{result.status === "created" ? "Creado" : result.status === "duplicate" ? "Ya existía" : "Revisar"}</span>
                                </div>
                                <p className="mt-1 text-xs">WABA: {result.businessAccountId || "no disponible"} · Números: {(result.slotIds || []).join(", ") || "-"}</p>
                                {result.error ? <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-300">{result.error}</p> : null}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:items-start">
                <form onSubmit={createTemplate} className="contents">
                    <div className="min-w-0 space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                Portafolio de Meta y números oficiales
                            </label>
                            <select
                                value={selectedPortfolioId}
                                onChange={(event) => selectPortfolio(event.target.value)}
                                disabled={loadingSlots || portfolioOptions.length === 0}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            >
                                {loadingSlots ? (
                                    <option value="">Cargando portafolios...</option>
                                ) : null}
                                {!loadingSlots && portfolioOptions.length === 0 ? (
                                    <option value="">{t("templates.builder.no_ready_slots_short") || "Sin números listos para plantillas"}</option>
                                ) : null}
                                {portfolioOptions.map((portfolio) => (
                                    <option key={portfolio.portfolioId} value={portfolio.portfolioId}>
                                        {portfolio.metaBusinessName || `Meta Business ${portfolio.portfolioId}`} · {portfolio.locationLabel} · {portfolio.count} número{portfolio.count === 1 ? "" : "s"} · {portfolio.wabaCount} WABA{portfolio.wabaCount === 1 ? "" : "s"}
                                    </option>
                                ))}
                            </select>
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {availableSlotsForPortfolio.map((slot) => {
                                    const key = `${slot.locationId}:${slot.slotId}`;
                                    const checked = selectedSlotKeys.includes(key);
                                    return (
                                <label key={key} className={`flex cursor-pointer items-center gap-3 border-b px-1 py-3 transition last:border-b-0 ${checked ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/60 dark:bg-indigo-950/20" : "border-gray-100 dark:border-gray-800"}`}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleSlotSelection(slot)}
                                                className="h-4 w-4 accent-indigo-600"
                                            />
                                            <span className="min-w-0 text-sm">
                                                <span className="block truncate font-bold text-gray-900 dark:text-white">{slot.locationName} · {slot.slotName}</span>
                                                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{slot.phone || slot.phoneNumberId}{slot.businessAccountId ? ` · WABA ${slot.businessAccountId}` : ""}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            {selectedSlots.length > 0 ? (
                                <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                    {selectedSlots.length} número{selectedSlots.length === 1 ? "" : "s"} seleccionado{selectedSlots.length === 1 ? "" : "s"} · {selectedWabaGroups.length} WABA{selectedWabaGroups.length === 1 ? "" : "s"} a procesar en {new Set(selectedSlots.map((slot) => slot.locationId)).size} cuenta{new Set(selectedSlots.map((slot) => slot.locationId)).size === 1 ? "" : "s"}
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                {t("templates.builder.language") || "Idioma"}
                            </label>
                            <input
                                list="official-template-languages"
                                value={form.language}
                                onChange={(event) => setFormField("language", event.target.value)}
                                placeholder="es"
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                            <datalist id="official-template-languages">
                                <option value="es" />
                                <option value="es_ES" />
                                <option value="es_MX" />
                                <option value="en" />
                                <option value="en_US" />
                                <option value="pt_BR" />
                                <option value="fr" />
                                <option value="it" />
                                <option value="de" />
                            </datalist>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                                {t("templates.builder.name") || "Nombre técnico"}
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
                                {t("templates.builder.category") || "Categoría"}
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

                    {isAuthenticationTemplate ? (
                        <div className="space-y-4 border-t border-amber-200 pt-5 dark:border-amber-900/60">
                            <div>
                                <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">Plantilla de autenticacion</p>
                                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">Meta genera el cuerpo del código OTP. Esta categoría no admite el mensaje, encabezado ni botones normales.</p>
                            </div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                                <input type="checkbox" checked={form.authentication?.addSecurityRecommendation !== false} onChange={(event) => setAuthenticationField("addSecurityRecommendation", event.target.checked)} className="h-4 w-4 accent-indigo-600" />
                                Incluir recomendación de seguridad
                            </label>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Expiración del código (minutos)
                                    <input type="number" min="1" value={form.authentication?.codeExpirationMinutes || ""} onChange={(event) => setAuthenticationField("codeExpirationMinutes", event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
                                </label>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Tipo de boton OTP
                                    <select value={form.authentication?.otpType || "COPY_CODE"} onChange={(event) => setAuthenticationField("otpType", event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
                                        <option value="COPY_CODE">Copiar código</option>
                                        <option value="ONE_TAP">Autocompletar en Android</option>
                                    </select>
                                </label>
                            </div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Texto del boton
                                <input value={form.authentication?.buttonText || ""} onChange={(event) => setAuthenticationField("buttonText", event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
                            </label>
                            {form.authentication?.otpType === "ONE_TAP" ? (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Texto autocompletar
                                        <input value={form.authentication?.autofillText || ""} onChange={(event) => setAuthenticationField("autofillText", event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
                                    </label>
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Paquete Android
                                        <input value={form.authentication?.packageName || ""} onChange={(event) => setAuthenticationField("packageName", event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
                                    </label>
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Signature hash
                                        <input value={form.authentication?.signatureHash || ""} onChange={(event) => setAuthenticationField("signatureHash", event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
                                    </label>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Encabezado
                                    <select value={form.headerFormat} onChange={(event) => setFormField("headerFormat", event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                                        <option value="NONE">Sin encabezado</option>
                                        <option value="TEXT">Texto</option>
                                        <option value="IMAGE">Imagen</option>
                                        <option value="VIDEO">Video</option>
                                        <option value="DOCUMENT">Documento</option>
                                        <option value="LOCATION">Ubicacion</option>
                                    </select>
                                </label>
                                {form.headerFormat === "TEXT" ? (
                                    <label className="md:col-span-2 text-sm font-bold text-gray-700 dark:text-gray-300">Texto del encabezado
                                        <input value={form.headerText} onChange={(event) => setFormField("headerText", event.target.value)} placeholder="Tu cita, {{cliente}}" className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                    </label>
                                ) : null}
                                {["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerFormat) ? (
                                    <label className="md:col-span-2 text-sm font-bold text-gray-700 dark:text-gray-300">Handle de muestra de Meta
                                        <input value={form.headerMediaHandle} onChange={(event) => setFormField("headerMediaHandle", event.target.value)} placeholder="4::..." className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                        <span className="mt-1 block text-xs font-normal text-gray-500">Meta requiere un header_handle cargado previamente; una URL publica no sirve como muestra de plantilla.</span>
                                    </label>
                                ) : null}
                            </div>

                            {form.headerFormat === "TEXT" && headerVariableAnalysis.variables.length ? (
                                <div className="border-t border-indigo-100 pt-3 dark:border-indigo-900/50">
                                    <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200">Variable del encabezado (Meta admite una)</p>
                                    {headerVariableAnalysis.variables.map((variable) => (
                                        <label key={`header-${variable.key}`} className="mt-2 block text-xs font-semibold text-gray-700 dark:text-gray-300">{variable.label} se enviará a Meta como {`{{${variable.index}}}`}
                                            <input value={form.headerExamples?.[variable.key] || ""} onChange={(event) => setVariableExample("headerExamples", variable.key, event.target.value)} placeholder="Ejemplo para revision" className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm dark:border-indigo-900 dark:bg-gray-900" />
                                        </label>
                                    ))}
                                </div>
                            ) : null}

                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">{t("templates.builder.body") || "Mensaje"}</label>
                                    <button type="button" onClick={applyExample} className="text-xs font-bold text-indigo-600 hover:text-indigo-500">{t("templates.builder.use_example") || "Usar ejemplo"}</button>
                                </div>
                                <textarea value={form.bodyText} onChange={(event) => setFormField("bodyText", event.target.value)} rows={5} placeholder="Hola {{nombre}}, recuerda tu cita para {{servicio}}." className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                <p className="mt-2 text-xs text-gray-500">Puedes escribir variables legibles, por ejemplo <code>{"{{nombre}}"}</code>. Antes de enviar, se convierten en marcadores consecutivos que Meta exige.</p>
                            </div>

                            {bodyVariableAnalysis.variables.length ? (
                                <div className="border-t border-indigo-100 pt-3 dark:border-indigo-900/50">
                                    <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200">Variables y ejemplos requeridos por Meta</p>
                                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                        {bodyVariableAnalysis.variables.map((variable) => (
                                            <label key={`body-${variable.key}`} className="text-xs font-semibold text-gray-700 dark:text-gray-300">{variable.label} se enviará como {`{{${variable.index}}}`}
                                                <input value={form.bodyExamples?.[variable.key] || ""} onChange={(event) => setVariableExample("bodyExamples", variable.key, event.target.value)} placeholder="Ejemplo para revision de Meta" className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm dark:border-indigo-900 dark:bg-gray-900" />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{t("templates.builder.footer") || "Pie opcional"}
                                    <input value={form.footerText} onChange={(event) => setFormField("footerText", event.target.value)} placeholder="Responde para confirmar." className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                </label>
                            </div>

                        </>
                    )}

                    {!isAuthenticationTemplate ? renderTemplateButtonsSection() : null}
                    </div>

                <aside className="min-w-0 space-y-5 lg:sticky lg:top-0">
                    <div>
                        <h4 className="text-sm font-extrabold uppercase tracking-widest text-gray-400">
                            {t("templates.builder.preview") || "Vista previa"}
                        </h4>
                        <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-950/40">
                            {isAuthenticationTemplate ? (
                                <>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Tu código de verificación es: 123456</p>
                                    {form.authentication?.addSecurityRecommendation !== false ? <p className="mt-3 text-xs text-gray-500">No compartas este código con nadie.</p> : null}
                                    <div className="mt-3 rounded-lg border border-sky-200 bg-white px-3 py-2 text-center text-xs font-bold text-sky-700 dark:bg-gray-900">{form.authentication?.buttonText || "Copiar código"}</div>
                                </>
                            ) : (
                                <>
                                    {previewHeaderText ? <p className="mb-3 text-sm font-extrabold text-gray-900 dark:text-white">{previewHeaderText}</p> : null}
                                    {["IMAGE", "VIDEO", "DOCUMENT", "LOCATION"].includes(form.headerFormat) ? <p className="mb-3 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-500">Encabezado {form.headerFormat.toLocaleLowerCase()} de Meta</p> : null}
                                    <p className="whitespace-pre-wrap text-sm font-semibold text-gray-900 dark:text-white">{previewText}</p>
                                    {form.footerText ? <p className="mt-3 border-t border-gray-200 pt-2 text-xs text-gray-500">{form.footerText}</p> : null}
                                    {buttons.length ? (
                                        <div className="mt-3 grid gap-2">
                                            {buttons.map((button, index) => (
                                                <div key={`${button.text}-${index}`} className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-center text-xs font-bold text-sky-700 dark:bg-gray-900">{button.text}</div>
                                            ))}
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                        <div className="hidden">
                            {bodyVariableAnalysis.variables.length ? <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">{bodyVariableAnalysis.variables.map((variable) => `valor_${variable.index} = ${variable.label}`).join(" · ")}</p> : null}
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

                    {!selectedSlot || loadingSlots ? null : renderBuilderReviewPanel()}
                </aside>
                </form>
            </div>
        </div>
    );
}
