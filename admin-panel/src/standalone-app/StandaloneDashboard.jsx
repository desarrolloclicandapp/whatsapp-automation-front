import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';
import StandaloneSlotManager from './StandaloneSlotManager';
import StandaloneAgentGuideModal from './StandaloneAgentGuideModal';
import { translateOr } from './i18n';

const API_URL = (import.meta.env.VITE_API_URL || 'https://wa.waflow.com').replace(/\/$/, '');

export default function StandaloneDashboard({
  accountInfo,
  primaryLocation,
  primaryLocationId,
  locationDetails,
  onRefresh,
  onOpenMessagingInbox,
  onGoToBilling,
  onGoToAgents,
  onRealtimeConnectionChange,
  token,
  onUnauthorized,
}) {
  const { t } = useLanguage();

  const slots = Array.isArray(locationDetails?.slots) ? locationDetails.slots : [];
  const [liveSlots, setLiveSlots] = useState(slots);
  const [showAgentGuide, setShowAgentGuide] = useState(false);

  useEffect(() => {
    setLiveSlots(slots);
  }, [slots]);

  const healthSummary = locationDetails?.healthSummary || {};
  const connectedSlots = liveSlots.filter((slot) => slot.is_connected === true).length;
  const usedSlots = liveSlots.length || Number(accountInfo?.limits?.used_slots || 0);
  const maxSlots = Number(accountInfo?.limits?.max_slots || 1);
  const isWhatsAppConnected = connectedSlots > 0;

  useEffect(() => {
    onRealtimeConnectionChange?.(isWhatsAppConnected);
  }, [isWhatsAppConnected, onRealtimeConnectionChange]);

  const chatStep = useMemo(
    () => ({
      id: 'chat',
      title: translateOr(t, 'standalone.dashboard.step3_title', 'Empieza a chatear'),
      desc: translateOr(
        t,
        'standalone.dashboard.step3_desc',
        'Abre tu panel de WhatsApp para responder a tus clientes en tiempo real.',
      ),
      actionLabel: translateOr(t, 'standalone.dashboard.step3_cta', 'Abrir Waflow WhatsApp'),
      doneLabel: translateOr(t, 'standalone.dashboard.step3_done', 'WhatsApp abierto'),
      done: isWhatsAppConnected,
      disabled: false,
      icon: <MessageSquare size={14} />,
      onClick: onOpenMessagingInbox,
    }),
    [isWhatsAppConnected, onOpenMessagingInbox, t],
  );

  const quickStartSteps = useMemo(() => {
    if (isWhatsAppConnected) {
      return [
        chatStep,
        {
          id: 'agent',
          title: translateOr(t, 'standalone.dashboard.step4_title', 'Crear un agente IA'),
          desc: translateOr(
            t,
            'standalone.dashboard.step4_desc',
            'Crea tu primer agente para automatizar respuestas y mejorar tu atencion.',
          ),
          actionLabel: translateOr(t, 'standalone.dashboard.step4_cta', 'Crear agente IA'),
          doneLabel: translateOr(t, 'standalone.dashboard.step4_done', 'Agente listo'),
          done: false,
          disabled: false,
          icon: <Bot size={14} />,
          onClick: () => setShowAgentGuide(true),
        },
      ];
    }

    return [
      {
        id: 'whatsapp',
        title: translateOr(t, 'standalone.dashboard.quick_start_step_whatsapp_title', 'Añade tu WhatsApp'),
        desc: translateOr(
          t,
          'standalone.dashboard.quick_start_step_whatsapp_desc',
          'Crea tu primer WhatsApp o agrega un nuevo número para esta cuenta.',
        ),
        actionLabel: translateOr(t, 'standalone.dashboard.quick_start_step_whatsapp_cta', 'Gestionar'),
        doneLabel: translateOr(t, 'standalone.dashboard.quick_start_step_whatsapp_done', 'WhatsApp listo'),
        done: liveSlots.length > 0,
        onClick: () => {
          document.getElementById('standalone-whatsapp-manager')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
          window.dispatchEvent(new CustomEvent('standalone:create-whatsapp'));
        },
      },
      {
        id: 'online',
        title: translateOr(t, 'standalone.dashboard.quick_start_step_online_title', 'Ponlo en línea'),
        desc: translateOr(
          t,
          'standalone.dashboard.quick_start_step_online_desc',
          'Escanea el QR o configura la API oficial para dejar el WhatsApp operativo.',
        ),
        actionLabel: translateOr(t, 'standalone.dashboard.quick_start_step_online_cta', 'Conectar WhatsApp'),
        doneLabel: translateOr(t, 'standalone.dashboard.quick_start_step_online_done', 'En línea'),
        done: connectedSlots > 0,
        onClick: () => {
          document.getElementById('standalone-whatsapp-manager')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
          window.dispatchEvent(new CustomEvent('standalone:connect-whatsapp-qr'));
        },
      },
    ];
  }, [chatStep, connectedSlots, isWhatsAppConnected, liveSlots.length, t]);

  const quickStartDoneCount = quickStartSteps.filter((step) => step.done).length;
  const needsQuickStartGuide = quickStartSteps.length > 0;

  const handleCreateGuidedAgent = async (guideForm) => {
    if (!primaryLocationId || !token) {
      toast.error(translateOr(t, 'workflow_agents.save_error', 'No se pudo crear el agente'));
      return false;
    }

    const payload = {
      locationId: primaryLocationId,
      name: String(guideForm?.name || '').trim(),
      status: String(guideForm?.status || 'active'),
      credential_mode: 'location',
      slot_ids: [],
      model: String(guideForm?.model || 'gpt-4o-mini'),
      temperature: Number.parseFloat(String(guideForm?.temperature || '0.4')),
      max_output_chars: Number.parseInt(String(guideForm?.max_output_chars || '600'), 10),
      use_contact_context: guideForm?.use_contact_context !== false,
      config: {
        behavior: {
          role: String(guideForm?.role || '').trim(),
          tone: String(guideForm?.tone || '').trim(),
          objective: String(guideForm?.objective || '').trim(),
          guardrails: String(guideForm?.guardrails || '').trim(),
        },
        permissions: {
          view_appointments: true,
          add_tags: true,
          remove_tags: true,
          assign_owner: true,
          set_fields: true,
          create_appointment: true,
          reschedule_appointment: true,
        },
        calendar_scope: { mode: 'all', calendar_ids: [] },
      },
      integrations: {
        ghl: { enabled: true, config: {} },
        chatwoot: { enabled: false, config: {} },
      },
    };

    try {
      const res = await fetch(`${API_URL}/agency/workflow-agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        onUnauthorized?.();
        throw new Error(translateOr(t, 'agency.session_expired', 'Sesion expirada'));
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || translateOr(t, 'workflow_agents.save_error', 'No se pudo crear el agente'));
      }
      toast.success(translateOr(t, 'workflow_agents.saved_success', 'Agente guardado'));
      return true;
    } catch (error) {
      toast.error(error?.message || translateOr(t, 'workflow_agents.save_error', 'No se pudo crear el agente'));
      return false;
    }
  };

  if (!accountInfo) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-3">
              <Loader2 size={20} className="animate-spin" />
              <span>{translateOr(t, 'common.loading', 'Cargando...')}</span>
            </div>
          </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-right-4 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Smartphone size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              CONEXIONES WHATSAPP
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {usedSlots}
            <span className="text-gray-400 font-normal text-lg">/{maxSlots}</span>
          </div>
        </div>

        <div
          className={`rounded-2xl p-5 border shadow-sm hover:shadow-md transition-shadow ${
            accountInfo?.plan === 'active'
              ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-transparent'
              : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                accountInfo?.plan === 'active' ? 'bg-white/20' : 'bg-amber-100 dark:bg-amber-900/30'
              }`}
            >
              <ShieldCheck
                size={20}
                className={accountInfo?.plan === 'active' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}
              />
            </div>
            <span
              className={`text-xs font-medium uppercase tracking-wide ${
                accountInfo?.plan === 'active' ? 'text-blue-200' : 'text-gray-400'
              }`}
            >
              {translateOr(t, 'dash.stats.plan', 'Plan Actual')}
            </span>
          </div>
          <div
            className={`text-xl font-bold ${
              accountInfo?.plan === 'active' ? 'text-white' : 'text-gray-900 dark:text-white'
            }`}
          >
            {accountInfo?.plan === 'active'
              ? translateOr(t, 'dash.stats.active', 'Activo')
              : translateOr(t, 'dash.stats.trial', 'Trial')}
          </div>
          {accountInfo?.trial_ends && (
            <div
              className={`text-xs mt-1 ${
                accountInfo?.plan === 'active' ? 'text-blue-200' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              Fin: {new Date(accountInfo.trial_ends).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {accountInfo?.plan === 'trial' && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-4 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center">
              <Zap size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                {translateOr(t, 'standalone.dashboard.trial_title', 'Periodo de prueba')}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Expira: {accountInfo?.trial_ends ? new Date(accountInfo.trial_ends).toLocaleDateString() : 'Sin fecha'}
              </p>
            </div>
          </div>
          <button
            onClick={onGoToBilling}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-sm transition"
          >
            {translateOr(t, 'standalone.dashboard.choose_plan', 'Elegir plan')}
          </button>
        </div>
      )}

      {needsQuickStartGuide && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50 via-white to-white dark:from-indigo-950/30 dark:via-gray-900 dark:to-gray-900 shadow-sm">
          <div className="flex flex-col gap-4 p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-500" />
                  {translateOr(t, 'standalone.dashboard.quick_start_title', 'Empieza aquí')}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {translateOr(
                    t,
                    'standalone.dashboard.quick_start_desc',
                    'Tres pasos para dejar lista tu cuenta y empezar a responder mensajes.',
                  )}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-bold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
                {translateOr(t, 'standalone.dashboard.quick_start_progress', '{done}/{total} listos')
                  .replace('{done}', String(quickStartDoneCount))
                  .replace('{total}', String(quickStartSteps.length))}
              </span>
            </div>

            <div
              className={`grid grid-cols-1 gap-6 ${
                quickStartSteps.length >= 3
                  ? 'md:grid-cols-3'
                  : quickStartSteps.length === 2
                    ? 'md:grid-cols-2'
                    : 'md:grid-cols-1'
              }`}
            >
              {quickStartSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`rounded-xl border p-4 transition ${
                    step.done
                      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-900/20'
                      : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        step.done
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                      }`}
                    >
                      {step.done ? <CheckCircle2 size={16} /> : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{step.title}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{step.desc}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={step.onClick}
                      disabled={step.disabled === true}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        step.disabled
                          ? 'cursor-not-allowed bg-gray-200 text-gray-500 opacity-50 dark:bg-gray-800 dark:text-gray-400'
                          : step.done
                            ? 'border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-700 dark:bg-gray-900 dark:text-emerald-300 dark:hover:bg-emerald-900/30'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {step.icon || (step.done ? <CheckCircle2 size={14} /> : <ArrowRight size={14} />)}
                      {step.done ? step.doneLabel : step.actionLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <StandaloneSlotManager
        token={token}
        locationId={primaryLocationId}
        locationName={primaryLocation?.name || locationDetails?.name || ''}
        crmType={locationDetails?.crmType || primaryLocation?.settings?.crm_type || accountInfo?.crm_type || 'chatwoot'}
        maxSlots={maxSlots}
        slots={liveSlots}
        healthSummary={healthSummary}
        onRefresh={onRefresh}
        onSlotsChange={setLiveSlots}
        onConnectionStateChange={onRealtimeConnectionChange}
        onUpgradeRequest={onGoToBilling}
        onUnauthorized={onUnauthorized}
      />

      <StandaloneAgentGuideModal
        open={showAgentGuide}
        onClose={() => setShowAgentGuide(false)}
        onGoToAgents={onGoToAgents}
        onCreateAgent={handleCreateGuidedAgent}
      />
    </div>
  );
}
