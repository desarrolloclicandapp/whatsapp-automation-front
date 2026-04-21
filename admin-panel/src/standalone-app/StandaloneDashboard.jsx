import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';
import StandaloneSlotManager from './StandaloneSlotManager';

const createInitialSlots = () => [
  {
    slot_id: 1,
    slot_name: 'Inbox Principal',
    is_connected: false,
    phone_number: '',
    settings: {
      connection_mode: 'qr',
      official_api: {
        businessAccountId: '',
        phoneNumberId: '',
        accessToken: '',
        status: 'draft',
      },
    },
    health: {
      sent_24h: 0,
      number_quality_level: 'unknown',
    },
  },
  {
    slot_id: 2,
    slot_name: 'Inbox Ventas',
    is_connected: true,
    phone_number: '595971234567',
    settings: {
      connection_mode: 'official_api',
      official_api: {
        businessAccountId: '1234567890',
        phoneNumberId: '10987654321',
        accessToken: 'EAAB-demo-token',
        status: 'verified',
      },
    },
    health: {
      sent_24h: 37,
      number_quality_level: 'good',
    },
  },
];

export default function StandaloneDashboard({ accountInfo }) {
  const { t } = useLanguage();
  const [mockLocation, setMockLocation] = useState(() => ({
    location_id: 'demo-location-123',
    name: String(accountInfo?.name || accountInfo?.email || 'Cuenta Principal'),
    crm_type: String(accountInfo?.crm_type || 'chatwoot').toLowerCase(),
    settings: {
      crm_type: String(accountInfo?.crm_type || 'chatwoot').toLowerCase(),
    },
    slots: createInitialSlots(),
  }));

  const slots = Array.isArray(mockLocation.slots) ? mockLocation.slots : [];
  const connectedSlots = slots.filter((slot) => slot.is_connected === true).length;
  const usedSlots = slots.length;
  const maxSlots = Number(accountInfo?.limits?.max_slots || Math.max(slots.length, 3));
  const quickStartSteps = useMemo(
    () => [
      {
        id: 'inbox',
        title: t('agency.quick_start.step_inbox_title') || 'Anade tu inbox',
        desc: 'Crea tu primer inbox o agrega un nuevo dispositivo para esta cuenta.',
        actionLabel: t('agency.quick_start.step_inbox_cta') || 'Gestionar',
        doneLabel: t('agency.quick_start.step_inbox_done') || 'Inbox listo',
        done: slots.length > 0,
        onClick: () => {
          document.getElementById('slot-card-1')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          toast.info('Accion simulada en Sandbox: revisa la seccion de inboxes');
        },
      },
      {
        id: 'online',
        title: t('agency.quick_start.step_online_title') || 'Ponla en linea',
        desc: 'Escanea el QR o configura la API oficial para dejar el inbox operativo.',
        actionLabel: t('agency.quick_start.step_online_cta') || 'Conectar',
        doneLabel: t('agency.quick_start.step_online_done') || 'En linea',
        done: connectedSlots > 0,
        onClick: () => {
          document.getElementById('slot-card-1')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          toast.info('Accion simulada en Sandbox: conecta un inbox desde el panel inferior');
        },
      },
    ],
    [connectedSlots, slots.length, t],
  );

  const quickStartDoneCount = quickStartSteps.filter((step) => step.done).length;
  const needsQuickStartGuide = quickStartDoneCount < quickStartSteps.length;

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

        <div className={`rounded-2xl p-5 border shadow-sm hover:shadow-md transition-shadow ${
          accountInfo?.plan === 'active'
            ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-transparent'
            : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              accountInfo?.plan === 'active' ? 'bg-white/20' : 'bg-amber-100 dark:bg-amber-900/30'
            }`}>
              <ShieldCheck
                size={20}
                className={accountInfo?.plan === 'active' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}
              />
            </div>
            <span className={`text-xs font-medium uppercase tracking-wide ${
              accountInfo?.plan === 'active' ? 'text-blue-200' : 'text-gray-400'
            }`}>
              {t('dash.stats.plan') || 'Plan Actual'}
            </span>
          </div>
          <div className={`text-xl font-bold ${
            accountInfo?.plan === 'active' ? 'text-white' : 'text-gray-900 dark:text-white'
          }`}>
            {accountInfo?.plan === 'active' ? (t('dash.stats.active') || 'Activo') : (t('dash.stats.trial') || 'Trial')}
          </div>
          {accountInfo?.trial_ends && (
            <div className={`text-xs mt-1 ${
              accountInfo?.plan === 'active' ? 'text-blue-200' : 'text-amber-600 dark:text-amber-400'
            }`}>
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
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{t('agency.trial.title') || 'Periodo de prueba'}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Expira: {accountInfo?.trial_ends ? new Date(accountInfo.trial_ends).toLocaleDateString() : 'Sin fecha'}
              </p>
            </div>
          </div>
          <button
            onClick={() => toast.info('Accion simulada en Sandbox: revisa la pestana de suscripcion')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-sm transition"
          >
            {t('agency.trial.choose_plan') || 'Elegir plan'}
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
                  {t('agency.quick_start.title') || 'Empieza aqui'}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Dos pasos para dejar listo tu primer inbox en esta cuenta.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-bold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
                  {(t('agency.quick_start.progress') || '{done}/{total} listos')
                    .replace('{done}', String(quickStartDoneCount))
                    .replace('{total}', String(quickStartSteps.length))}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
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
                    <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      step.done
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    }`}>
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
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        step.done
                          ? 'border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-700 dark:bg-gray-900 dark:text-emerald-300 dark:hover:bg-emerald-900/30'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {step.done ? <CheckCircle2 size={14} /> : <ArrowRight size={14} />}
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
        location={mockLocation}
        initialSlots={slots}
        onSlotsChange={(nextSlots) => setMockLocation((prev) => ({ ...prev, slots: nextSlots }))}
      />
    </div>
  );
}
