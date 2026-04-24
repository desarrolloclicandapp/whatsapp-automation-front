import React, { useMemo, useState } from 'react';
import { Bot, CheckCircle2, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { translateOr } from './i18n';

export default function StandaloneAgentGuideModal({ open, onClose, onGoToAgents }) {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(
    () => [
      {
        title: translateOr(t, 'standalone.agents_guide.step1_title', 'Identidad del agente'),
        description: translateOr(
          t,
          'standalone.agents_guide.step1_desc',
          'Aqui defines como se llamara el agente y si estara activo, en borrador o pausado.',
        ),
        items: [
          translateOr(t, 'standalone.agents_guide.step1_item1', 'Nombre del agente: nombre visible para tu equipo.'),
          translateOr(t, 'standalone.agents_guide.step1_item2', 'Estado: activo para responder, borrador para preparar, pausado para detener.'),
          translateOr(t, 'standalone.agents_guide.step1_item3', 'El ID interno se genera automaticamente por Waflow.'),
        ],
      },
      {
        title: translateOr(t, 'standalone.agents_guide.step2_title', 'Respuesta del modelo'),
        description: translateOr(
          t,
          'standalone.agents_guide.step2_desc',
          'Ajusta como responde la IA: modelo, creatividad y extension maxima.',
        ),
        items: [
          translateOr(t, 'standalone.agents_guide.step2_item1', 'Modelo: selecciona el motor de IA que usara el agente.'),
          translateOr(t, 'standalone.agents_guide.step2_item2', 'Temperatura: menor valor = respuestas mas precisas.'),
          translateOr(t, 'standalone.agents_guide.step2_item3', 'Maximo de caracteres: controla respuestas largas o cortas.'),
          translateOr(
            t,
            'standalone.agents_guide.step2_item4',
            'Usar contexto del contacto: mejora respuestas con datos del contacto.',
          ),
        ],
      },
      {
        title: translateOr(t, 'standalone.agents_guide.step3_title', 'Comportamiento'),
        description: translateOr(
          t,
          'standalone.agents_guide.step3_desc',
          'Define personalidad, tono, objetivo y reglas de seguridad del agente.',
        ),
        items: [
          translateOr(t, 'standalone.agents_guide.step3_item1', 'Rol: quien es el agente y que representa.'),
          translateOr(t, 'standalone.agents_guide.step3_item2', 'Tono: formal, cercano, consultivo, etc.'),
          translateOr(t, 'standalone.agents_guide.step3_item3', 'Objetivo: resultado esperado en cada conversacion.'),
          translateOr(
            t,
            'standalone.agents_guide.step3_item4',
            'Guardrails: limites y reglas que nunca debe romper.',
          ),
        ],
      },
      {
        title: translateOr(t, 'standalone.agents_guide.step4_title', 'Permisos e integraciones'),
        description: translateOr(
          t,
          'standalone.agents_guide.step4_desc',
          'Controla que acciones puede ejecutar el agente y con que servicios se conecta.',
        ),
        items: [
          translateOr(
            t,
            'standalone.agents_guide.step4_item1',
            'Permisos: habilita solo las acciones que tu negocio necesita.',
          ),
          translateOr(
            t,
            'standalone.agents_guide.step4_item2',
            'Calendarios: elige si puede usar todos o solo algunos calendarios.',
          ),
          translateOr(
            t,
            'standalone.agents_guide.step4_item3',
            'Integraciones: conecta herramientas externas cuando aplique.',
          ),
        ],
      },
      {
        title: translateOr(t, 'standalone.agents_guide.step5_title', 'Documentos y pruebas'),
        description: translateOr(
          t,
          'standalone.agents_guide.step5_desc',
          'Antes de publicar, carga documentos de contexto y prueba conversaciones.',
        ),
        items: [
          translateOr(
            t,
            'standalone.agents_guide.step5_item1',
            'Documentos: sube material para respuestas mas precisas.',
          ),
          translateOr(
            t,
            'standalone.agents_guide.step5_item2',
            'Probar agente: simula mensajes y valida calidad de respuesta.',
          ),
          translateOr(
            t,
            'standalone.agents_guide.step5_item3',
            'Guardar agente: deja todo listo para usarlo en produccion.',
          ),
        ],
      },
    ],
    [t],
  );

  if (!open) return null;

  const currentStep = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const handleClose = () => {
    setStepIndex(0);
    onClose?.();
  };

  const handlePrev = () => {
    if (!isFirst) setStepIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    if (!isLast) setStepIndex((prev) => prev + 1);
  };

  const handleGoToAgents = () => {
    setStepIndex(0);
    onGoToAgents?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
              <Sparkles size={14} />
              {translateOr(t, 'standalone.agents_guide.eyebrow', 'Guia de creacion')}
            </p>
            <h3 className="mt-2 text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Bot size={18} className="text-indigo-500" />
              {translateOr(t, 'standalone.agents_guide.title', 'Recorrido para crear tu agente IA')}
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
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">{currentStep.title}</h4>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{currentStep.description}</p>
          </div>

          <div className="space-y-3">
            {currentStep.items.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 px-4 py-3 flex items-start gap-2"
              >
                <CheckCircle2 size={16} className="mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-gray-700 dark:text-gray-200">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex flex-wrap justify-between gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={isFirst}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <ChevronLeft size={16} />
            {translateOr(t, 'standalone.agents_guide.prev', 'Anterior')}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              {translateOr(t, 'standalone.agents_guide.close', 'Cerrar')}
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={handleGoToAgents}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-bold text-white transition"
              >
                {translateOr(t, 'standalone.agents_guide.go_agents', 'Ir a Agentes')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-bold text-white transition"
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
