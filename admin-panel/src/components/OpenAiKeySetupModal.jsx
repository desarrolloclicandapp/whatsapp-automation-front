import React, { useState } from 'react';
import { ExternalLink, KeyRound, Loader2, X } from 'lucide-react';
import { buildOpenAiKeyPayload } from '../utils/openAiKeySetup';
import tutorialPaso1 from '../img-tutorial-openaiapi/paso1.png';
import tutorialPaso2 from '../img-tutorial-openaiapi/paso2.png';
import tutorialPaso3 from '../img-tutorial-openaiapi/paso3.png';
import tutorialPaso4 from '../img-tutorial-openaiapi/paso4.png';

const TUTORIAL_STEPS = [
  { image: tutorialPaso1, textKey: 'workflow_agents.apikey_tutorial_step1' },
  { image: tutorialPaso2, textKey: 'workflow_agents.apikey_tutorial_step2' },
  { image: tutorialPaso3, textKey: 'workflow_agents.apikey_tutorial_step3' },
  { image: tutorialPaso4, textKey: 'workflow_agents.apikey_tutorial_step4' },
];

export default function OpenAiKeySetupModal({
  accountLabel = '',
  alreadyConfigured = false,
  onClose,
  onSave,
  t,
}) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const translate = typeof t === 'function' ? t : (key) => key;
  const text = (key, fallback) => {
    const value = translate(key);
    return !value || value === key ? fallback : value;
  };
  const safeAccountLabel = String(accountLabel || '').trim();

  const handleSave = async () => {
    setError('');
    let payload;
    try {
      payload = buildOpenAiKeyPayload(apiKey);
    } catch (validationError) {
      setError(text('agency.integrations.openai_key_empty_error', validationError.message));
      return;
    }

    setSaving(true);
    try {
      await onSave?.(payload.openai_api_key);
      setApiKey('');
      onClose?.();
    } catch (saveError) {
      setError(saveError?.message || text('agency.integrations.openai_key_error', 'No se pudo guardar la OpenAI key.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-indigo-500">
              <KeyRound size={14} />
              OpenAI
            </div>
            <h4 className="mt-2 text-xl font-extrabold text-gray-900 dark:text-white">
              {text('workflow_agents.apikey_tutorial_title', 'Cómo crear tu OpenAI API key')}
            </h4>
            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {safeAccountLabel
                ? `La key se guardará en la cuenta "${safeAccountLabel}" sin salir del agente.`
                : 'La key se guardará en esta cuenta sin salir del agente.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr),360px]">
          <div className="min-h-0 overflow-y-auto px-6 py-5">
            <p className="mb-5 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {text('workflow_agents.apikey_tutorial_desc', 'Necesitas una API key para activar el agente. Sigue estos pasos y luego vuelve para pegarla.')}
            </p>
            <div className="space-y-5">
              {TUTORIAL_STEPS.map((step, index) => (
                <div key={step.image} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="mb-3 text-sm font-bold text-gray-800 dark:text-gray-200">
                    {text('workflow_agents.apikey_tutorial_step_label', 'Paso {step}').replace('{step}', String(index + 1))}
                  </div>
                  <img
                    src={step.image}
                    alt={text('workflow_agents.apikey_tutorial_step_alt', 'Paso {step} para crear API key').replace('{step}', String(index + 1))}
                    className="w-full rounded-xl border border-gray-200 object-contain dark:border-gray-700"
                  />
                  <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{text(step.textKey, '')}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="border-t border-gray-200 bg-gray-50/80 p-5 dark:border-gray-800 dark:bg-gray-950/40 lg:border-l lg:border-t-0">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {text('agency.integrations.openai_key_panel_title', 'Carga la OpenAI API key')}
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                {alreadyConfigured
                  ? 'Esta cuenta ya tiene una key. Si pegas una nueva, reemplazará la anterior.'
                  : 'Pega la key para habilitar modelos, pruebas y agentes en esta cuenta.'}
              </p>
              {safeAccountLabel ? (
                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200">
                  Cuenta: {safeAccountLabel}
                </div>
              ) : null}

              <label className="mb-2 mt-4 block text-xs font-bold text-gray-600 dark:text-gray-300">
                {text('agency.integrations.openai_key_label', 'OpenAI API key')}
              </label>
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setError('');
                }}
                placeholder={text('agency.integrations.openai_key_placeholder', 'sk-...')}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              {error ? <p className="mt-2 text-xs font-semibold text-red-500">{error}</p> : null}

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {text('agency.integrations.openai_key_save', 'Guardar key')}
                </button>
                <button
                  type="button"
                  onClick={() => window.open('https://platform.openai.com/api-keys', '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <ExternalLink size={15} />
                  {text('standalone.settings.openai_tutorial_openai_cta', 'Ir a OpenAI')}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
