import React from 'react';
import { ExternalLink, Settings, X } from 'lucide-react';
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

export default function OpenAiKeySetupModal({ onClose, onOpenSettings, t }) {
  const translate = typeof t === 'function' ? t : (key) => key;
  const text = (key, fallback) => {
    const value = translate(key);
    return !value || value === key ? fallback : value;
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 px-6 py-5">
          <div className="min-w-0">
            <h4 className="text-xl font-bold text-gray-900 dark:text-white">
              {text('workflow_agents.apikey_tutorial_title', 'Cómo crear tu OpenAI API key')}
            </h4>
            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {text('workflow_agents.apikey_tutorial_subtitle', 'Crea la clave en OpenAI y configúrala después desde Configuraciones.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label={text('common.close', 'Cerrar')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr),360px]">
          <div className="wf-soft-scrollbar min-h-0 overflow-y-auto bg-white px-6 py-5 dark:bg-gray-900">
            <p className="mb-5 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {text('workflow_agents.apikey_tutorial_desc_clean', 'Sigue estos pasos para crear tu clave. Después podrás configurarla desde Configuraciones.')}
            </p>
            <div className="space-y-5">
              {TUTORIAL_STEPS.map((step, index) => (
                <div key={step.image} className="px-0 py-2">
                  <div className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {text('workflow_agents.apikey_tutorial_step_label', 'Paso {step}').replace('{step}', String(index + 1))}
                  </div>
                  <img
                    src={step.image}
                    alt={text('workflow_agents.apikey_tutorial_step_alt', 'Paso {step} para crear API key').replace('{step}', String(index + 1))}
                    className="w-full rounded-xl object-contain"
                  />
                  <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{text(step.textKey, '')}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="flex flex-col justify-end gap-3 bg-white p-5 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => window.open('https://platform.openai.com/api-keys', '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500"
            >
              <ExternalLink size={15} />
              {text('standalone.settings.openai_tutorial_openai_cta', 'Ir a OpenAI')}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onOpenSettings?.();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Settings size={15} />
              {text('workflow_agents.apikey_tutorial_settings_cta', 'Ir a Configuraciones')}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
