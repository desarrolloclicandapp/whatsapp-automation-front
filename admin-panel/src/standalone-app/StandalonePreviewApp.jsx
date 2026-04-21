import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, LogIn, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import StandaloneLayout from './StandaloneLayout';
import StandaloneLogin from './StandaloneLogin';

const PREVIEW_PRESETS = {
  trial: {
    name: 'Cuenta Trial',
    email: 'trial@waflow.local',
    crm_type: 'chatwoot',
    plan: 'trial',
    trial_ends: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
    limits: {
      used_slots: 1,
      max_slots: 3,
    },
  },
  starter: {
    name: 'Cuenta Starter',
    email: 'starter@waflow.local',
    crm_type: 'chatwoot',
    plan: 'starter',
    trial_ends: null,
    limits: {
      used_slots: 2,
      max_slots: 5,
    },
  },
  professional: {
    name: 'Cuenta Professional',
    email: 'professional@waflow.local',
    crm_type: 'chatwoot',
    plan: 'professional',
    trial_ends: null,
    limits: {
      used_slots: 4,
      max_slots: 10,
    },
  },
};

const INITIAL_PRESET_KEY = 'starter';
const INITIAL_SHOW_LOGIN = false;
const INITIAL_WHATSAPP_CONNECTED = false;

export default function StandalonePreviewApp() {
  const [presetKey, setPresetKey] = useState(INITIAL_PRESET_KEY);
  const [showLoginScreen, setShowLoginScreen] = useState(INITIAL_SHOW_LOGIN);
  const [isLoggedIn, setIsLoggedIn] = useState(!INITIAL_SHOW_LOGIN);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(INITIAL_WHATSAPP_CONNECTED);

  const accountInfo = useMemo(() => {
    const preset = PREVIEW_PRESETS[presetKey] || PREVIEW_PRESETS.starter;
    return {
      ...preset,
      agencyId: `preview-${presetKey}-001`,
      id: `preview-${presetKey}-001`,
    };
  }, [presetKey]);

  const resetPreview = () => {
    setPresetKey(INITIAL_PRESET_KEY);
    setShowLoginScreen(INITIAL_SHOW_LOGIN);
    setIsLoggedIn(!INITIAL_SHOW_LOGIN);
    setIsWhatsAppConnected(INITIAL_WHATSAPP_CONNECTED);
    toast.info('Preview standalone reiniciado');
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setShowLoginScreen(false);
    toast.success('Login mock completado en preview local');
  };

  const handlePreviewLogout = () => {
    setIsLoggedIn(!INITIAL_SHOW_LOGIN);
    setShowLoginScreen(INITIAL_SHOW_LOGIN);
    setIsWhatsAppConnected(INITIAL_WHATSAPP_CONNECTED);
    toast.info('Logout mock: preview restaurado al estado inicial');
  };

  const handleQuickEnter = () => {
    setIsLoggedIn(true);
    setShowLoginScreen(false);
    toast.info('Entrada directa al preview activada');
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <div className="fixed bottom-4 right-4 z-[80] w-[320px] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur shadow-2xl p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Standalone Preview</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Ruta local temporal para revisar la nueva interfaz sin tocar el flujo real.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Preset de cuenta
          </label>
          <div className="grid grid-cols-3 gap-2">
            {Object.keys(PREVIEW_PRESETS).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPresetKey(key)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  presetKey === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Estado visual
          </label>
          <button
            type="button"
            onClick={() => setIsWhatsAppConnected((prev) => !prev)}
            className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
              isWhatsAppConnected
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30'
                : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30'
            }`}
          >
            WhatsApp conectado: {isWhatsAppConnected ? 'si' : 'no'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setShowLoginScreen((prev) => !prev);
              setIsLoggedIn(false);
            }}
            className="rounded-xl px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
          >
            {showLoginScreen ? <Eye size={14} /> : <EyeOff size={14} />}
            {showLoginScreen ? 'Ver layout' : 'Ver login'}
          </button>
          <button
            type="button"
            onClick={handleQuickEnter}
            className="rounded-xl px-3 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center gap-2"
          >
            <LogIn size={14} />
            Entrar
          </button>
        </div>

        <button
          type="button"
          onClick={resetPreview}
          className="w-full rounded-xl px-3 py-2 text-xs font-semibold bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} />
          Reset preview
        </button>
      </div>

      {showLoginScreen && !isLoggedIn ? (
        <StandaloneLogin onLoginSuccess={handleLoginSuccess} />
      ) : (
        <StandaloneLayout
          token="preview-token"
          accountInfo={accountInfo}
          onLogout={handlePreviewLogout}
          onUnauthorized={handlePreviewLogout}
          onDataChange={() => {}}
          initialPlanType={String(accountInfo?.plan || 'starter').toLowerCase()}
          initialIsWhatsAppConnected={isWhatsAppConnected}
        />
      )}
    </div>
  );
}
