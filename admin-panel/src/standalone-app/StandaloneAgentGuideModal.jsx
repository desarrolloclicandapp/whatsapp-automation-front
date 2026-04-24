import React, { useMemo, useState } from 'react';
import { Bot, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { translateOr } from './i18n';

const DEFAULT_FORM = {
  name: '',
  status: 'active',
  model: 'gpt-4o-mini',
  temperature: '0.4',
  max_output_chars: '600',
  use_contact_context: true,
  role: '',
  tone: '',
  objective: '',
  guardrails: '',
};

const API_URL = (import.meta.env.VITE_API_URL || 'https://wa.waflow.com').replace(/\/$/, '');

export default function StandaloneAgentGuideModal({
  open,
  onClose,
  onGoToAgents,
  onCreateAgent,
  token,
  locationId,
  onUnauthorized,
}) {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);

  const steps = useMemo(
    () => [
      {
        title: translateOr(t, 'standalone.agents_guide.step1_title', 'Identidad del agente'),
        description: translateOr(
          t,
          'standalone.agents_guide.step1_desc',
          'Define nombre y estado. Waflow genera el ID interno automaticamente.',
        ),
      },
      {
        title: translateOr(t, 'standalone.agents_guide.step2_title', 'Configuracion de respuesta'),
        description: translateOr(
          t,
          'standalone.agents_guide.step2_desc',
          'Ajusta modelo, creatividad y extension maxima de respuestas.',
        ),
      },
      {
        title: translateOr(t, 'standalone.agents_guide.step3_title', 'Comportamiento del agente'),
        description: translateOr(
          t,
          'standalone.agents_guide.step3_desc',
          'Describe su rol, tono, objetivo y limites para una atencion consistente.',
        ),
      },
      {
        title: translateOr(t, 'standalone.agents_guide.step4_title', 'Resumen y creacion'),
        description: translateOr(
          t,
          'standalone.agents_guide.step4_desc',
          'Revisa los datos y crea el agente ahora.',
        ),
      },
    ],
    [t],
  );
  const baseModelOptions = useMemo(
    () => availableModels.map((modelId) => ({ value: modelId, label: modelId })),
    [availableModels],
  );
  const modelOptions = useMemo(() => {
    if (!form.model || baseModelOptions.some((option) => option.value === form.model)) {
      return baseModelOptions;
    }
    return [
      {
        value: form.model,
        label: `${form.model} · ${t('workflow_agents.model_option_current')}`,
      },
      ...baseModelOptions,
    ];
  }, [baseModelOptions, form.model, t]);

  if (!open) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const canContinueStep1 = String(form.name || '').trim().length >= 2;
  const canContinueStep2 =
    modelOptions.some((option) => option.value === form.model) &&
    Number.parseFloat(form.temperature) >= 0 &&
    Number.parseFloat(form.temperature) <= 1 &&
    Number.parseInt(form.max_output_chars, 10) >= 120;
  const canContinueStep3 =
    String(form.role || '').trim().length >= 5 &&
    String(form.objective || '').trim().length >= 8;

  const canAdvance =
    stepIndex === 0 ? canContinueStep1 : stepIndex === 1 ? canContinueStep2 : stepIndex === 2 ? canContinueStep3 : true;

  const resetAll = () => {
    setStepIndex(0);
    setForm(DEFAULT_FORM);
    setSaving(false);
  };

  const loadAvailableModels = async () => {
    const safeLocationId = String(locationId || '').trim();
    if (!safeLocationId || !token) {
      setAvailableModels([]);
      return;
    }

    setLoadingModels(true);
    try {
      const res = await fetch(
        `${API_URL}/agency/workflow-agents/models?locationId=${encodeURIComponent(safeLocationId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (res.status === 401) {
        onUnauthorized?.();
        throw new Error(t('agency.session_expired'));
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || t('workflow_agents.models_load_error'));

      const nextModels = Array.isArray(data?.models)
        ? data.models.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
      const nextDefaultModel = String(data?.defaultModel || '').trim();

      setAvailableModels(nextModels);
      setForm((prev) => {
        if (prev.model && nextModels.includes(prev.model)) return prev;
        const preferredModel = nextModels.includes(nextDefaultModel)
          ? nextDefaultModel
          : nextModels[0] || prev.model || '';
        return preferredModel ? { ...prev, model: preferredModel } : prev;
      });
    } catch (_) {
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  React.useEffect(() => {
    if (open) {
      loadAvailableModels();
    } else {
      setAvailableModels([]);
      setLoadingModels(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, locationId, token]);

  const handleClose = () => {
    resetAll();
    onClose?.();
  };

  const handleNext = () => {
    if (!canAdvance || isLast) return;
    setStepIndex((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (isFirst) return;
    setStepIndex((prev) => prev - 1);
  };

  const handleCreate = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const created = await onCreateAgent?.(form);
      if (!created) return;
      resetAll();
      onClose?.();
      onGoToAgents?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
              <Sparkles size={14} />
              {translateOr(t, 'standalone.agents_guide.eyebrow', 'Asistente guiado')}
            </p>
            <h3 className="mt-2 text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Bot size={18} className="text-indigo-500" />
              {translateOr(t, 'standalone.agents_guide.title', 'Crear agente IA paso a paso')}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${Math.round(((stepIndex + 1) / steps.length) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            {translateOr(t, 'standalone.agents_guide.progress', 'Paso {step} de {total}')
              .replace('{step}', String(stepIndex + 1))
              .replace('{total}', String(steps.length))}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">{steps[stepIndex].title}</h4>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{steps[stepIndex].description}</p>
          </div>

          {stepIndex === 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {translateOr(t, 'standalone.agents_guide.field_name', 'Nombre del agente')}
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder={translateOr(t, 'standalone.agents_guide.field_name_placeholder', 'Ej: Asistente de Ventas')}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {translateOr(t, 'standalone.agents_guide.field_name_help', 'Usa un nombre claro para identificar su funcion.')}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {translateOr(t, 'standalone.agents_guide.field_status', 'Estado')}
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                >
                  <option value="active">{translateOr(t, 'workflow_agents.status_active', 'Activo')}</option>
                  <option value="draft">{translateOr(t, 'workflow_agents.status_draft', 'Borrador')}</option>
                  <option value="paused">{translateOr(t, 'workflow_agents.status_paused', 'Pausado')}</option>
                </select>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 px-3 py-3">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {translateOr(t, 'standalone.agents_guide.auto_key', 'El ID interno se generara automaticamente.')}
                </p>
              </div>
            </div>
          )}

          {stepIndex === 1 && (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {translateOr(t, 'standalone.agents_guide.field_model', 'Modelo de IA')}
                </label>
                <select
                  value={form.model || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                  disabled={loadingModels || modelOptions.length === 0}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                >
                  {loadingModels ? (
                    <option value={form.model || ''}>{t('workflow_agents.models_loading')}</option>
                  ) : modelOptions.length > 0 ? (
                    modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))
                  ) : (
                    <option value="">{t('workflow_agents.models_empty')}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {translateOr(t, 'standalone.agents_guide.field_temperature', 'Temperatura')}
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={form.temperature}
                  onChange={(e) => setForm((prev) => ({ ...prev, temperature: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {translateOr(t, 'standalone.agents_guide.field_max_chars', 'Max. caracteres')}
                </label>
                <input
                  type="number"
                  min="120"
                  max="4000"
                  step="20"
                  value={form.max_output_chars}
                  onChange={(e) => setForm((prev) => ({ ...prev, max_output_chars: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>
              <label className="md:col-span-3 flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={form.use_contact_context}
                  onChange={(e) => setForm((prev) => ({ ...prev, use_contact_context: e.target.checked }))}
                  className="h-4 w-4 rounded text-indigo-600"
                />
                {translateOr(
                  t,
                  'standalone.agents_guide.field_use_contact_context',
                  'Usar contexto del contacto para personalizar respuestas',
                )}
              </label>
            </div>
          )}

          {stepIndex === 2 && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {translateOr(t, 'standalone.agents_guide.field_role', 'Rol del agente')}
                </label>
                <textarea
                  rows={3}
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder={translateOr(
                    t,
                    'standalone.agents_guide.field_role_placeholder',
                    'Ej: Eres un asesor comercial experto en cierres consultivos.',
                  )}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {translateOr(t, 'standalone.agents_guide.field_tone', 'Tono')}
                </label>
                <textarea
                  rows={2}
                  value={form.tone}
                  onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder={translateOr(t, 'standalone.agents_guide.field_tone_placeholder', 'Ej: Cercano, claro y profesional.')}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {translateOr(t, 'standalone.agents_guide.field_objective', 'Objetivo')}
                </label>
                <textarea
                  rows={3}
                  value={form.objective}
                  onChange={(e) => setForm((prev) => ({ ...prev, objective: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder={translateOr(
                    t,
                    'standalone.agents_guide.field_objective_placeholder',
                    'Ej: Calificar prospectos y agendar reuniones con ventas.',
                  )}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                  {translateOr(t, 'standalone.agents_guide.field_guardrails', 'Limites (guardrails)')}
                </label>
                <textarea
                  rows={3}
                  value={form.guardrails}
                  onChange={(e) => setForm((prev) => ({ ...prev, guardrails: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder={translateOr(
                    t,
                    'standalone.agents_guide.field_guardrails_placeholder',
                    'Ej: No inventar precios. Si falta info, pedir aclaracion.',
                  )}
                />
              </div>
            </div>
          )}

          {stepIndex === 3 && (
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{form.name || '-'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {translateOr(t, 'standalone.agents_guide.summary_status', 'Estado')}: {form.status} · {form.model}
                </p>
              </div>
              <SummaryItem
                title={translateOr(t, 'standalone.agents_guide.summary_role', 'Rol')}
                value={form.role}
              />
              <SummaryItem
                title={translateOr(t, 'standalone.agents_guide.summary_tone', 'Tono')}
                value={form.tone}
              />
              <SummaryItem
                title={translateOr(t, 'standalone.agents_guide.summary_objective', 'Objetivo')}
                value={form.objective}
              />
              <SummaryItem
                title={translateOr(t, 'standalone.agents_guide.summary_guardrails', 'Guardrails')}
                value={form.guardrails}
              />
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex flex-wrap justify-between gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={isFirst || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <ChevronLeft size={16} />
            {translateOr(t, 'standalone.agents_guide.prev', 'Anterior')}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-60"
            >
              {translateOr(t, 'standalone.agents_guide.close', 'Cerrar')}
            </button>

            {isLast ? (
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-bold text-white transition disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {translateOr(t, 'standalone.agents_guide.create', 'Crear agente ahora')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-bold text-white transition disabled:opacity-60"
              >
                {translateOr(t, 'standalone.agents_guide.next', 'Siguiente')}
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ title, value }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        {String(value || '-')}
      </p>
    </div>
  );
}
