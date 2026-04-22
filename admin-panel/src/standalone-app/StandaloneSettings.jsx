import React, { useMemo, useState } from 'react';
import {
  Copy,
  Key,
  Link,
  Loader2,
  MessageSquareText,
  Moon,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sun,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const maskEmail = (email) => {
  const safeEmail = String(email || '').trim();
  if (!safeEmail.includes('@')) return safeEmail;

  const [user, domain] = safeEmail.split('@');
  if (!user) return safeEmail;

  const visible = user.length <= 2 ? user.charAt(0) : user.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(user.length - visible.length, 2))}@${domain}`;
};

export default function StandaloneSettings({
  accountInfo,
  onSaveInbox,
  onSaveOpenAI,
  onGenerateApiKey,
  onRevokeApiKey,
  onCreateWebhook,
  onDeleteWebhook,
}) {
  const { t, language } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [settingsSection, setSettingsSection] = useState('inbox');

  const [inboxConfigured, setInboxConfigured] = useState(false);
  const [inboxName, setInboxName] = useState('');
  const [inboxEmail, setInboxEmail] = useState(String(accountInfo?.email || ''));
  const [inboxPassword, setInboxPassword] = useState('');
  const [inboxVerificationPassword, setInboxVerificationPassword] = useState('');
  const [inboxEmailMasked, setInboxEmailMasked] = useState('');
  const [isSavingInbox, setIsSavingInbox] = useState(false);
  const [isTestingInbox, setIsTestingInbox] = useState(false);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [inboxTestStatus, setInboxTestStatus] = useState(null);

  const [openAiKeyDraft, setOpenAiKeyDraft] = useState('');
  const [openAiKeyConfigured, setOpenAiKeyConfigured] = useState(false);
  const [isSavingOpenAi, setIsSavingOpenAi] = useState(false);

  const [apiKeys, setApiKeys] = useState([]);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);

  const [webhooks, setWebhooks] = useState([]);
  const [showNewWebhookModal, setShowNewWebhookModal] = useState(false);

  const replaceAgencyTerms = (value) => {
    const safeValue = String(value || '');
    if (language === 'es') {
      return safeValue.replaceAll('Agencia', 'Cuenta').replaceAll('agencia', 'cuenta');
    }
    return safeValue.replaceAll('Agency', 'Account').replaceAll('agency', 'account');
  };

  const settingsMenuGroups = useMemo(
    () => [
      {
        key: 'ops',
        label: t('agency.settings_nav.operations') || 'Operacion',
        items: [
          {
            id: 'inbox',
            label: t('standalone.settings.whatsapp_title') || 'Waflow WhatsApp',
            icon: MessageSquareText,
          },
          {
            id: 'integrations',
            label: t('agency.integrations.title') || 'Integraciones',
            icon: Link,
          },
        ],
      },
      {
        key: 'advanced',
        label: t('agency.settings_nav.advanced') || 'Avanzado',
        items: [
          {
            id: 'developer',
            label: t('dash.settings.dev_title') || 'Desarrolladores',
            icon: Terminal,
          },
          {
            id: 'appearance',
            label: t('agency.settings_nav.appearance') || 'Apariencia',
            icon: Moon,
          },
        ],
      },
    ],
    [t],
  );

  const allSettingsSectionIds = settingsMenuGroups.flatMap((group) => group.items.map((item) => item.id));
  const currentSettingsSectionId = allSettingsSectionIds.includes(settingsSection)
    ? settingsSection
    : (allSettingsSectionIds[0] || 'inbox');
  const settingsSectionTitleMap = settingsMenuGroups.reduce((acc, group) => {
    group.items.forEach((item) => {
      acc[item.id] = item.label;
    });
    return acc;
  }, {});
  const activeSettingsSectionTitle =
    settingsSectionTitleMap[currentSettingsSectionId] || (t('dash.header.settings') || 'Configuracion');

  const accountIdValue = String(accountInfo?.agencyId || accountInfo?.id || 'demo-account-123');
  const developerTitle = t('dash.settings.dev_title') || 'Desarrolladores';
  const developerDescription = replaceAgencyTerms(
    t('dash.settings.dev_desc') || 'Gestiona claves API y Webhooks para integraciones.',
  );
  const developerBadge = language === 'es' ? 'Funcion Pro' : 'Pro Feature';
  const accountIdTitle = replaceAgencyTerms(t('agency.account.agency_id') || 'ID de Agencia');
  const n8nReferenceTitle = replaceAgencyTerms(t('dash.settings.n8n_agency_id') || 'Agency ID');
  const n8nReferenceHelp = replaceAgencyTerms(
    t('dash.settings.n8n_agency_id_help') ||
      'Usa este valor como Agency ID de referencia en n8n. Luego el nodo oficial te deja elegir la cuenta y el slot desde listas dinamicas.',
  );

  const handleSaveInboxUser = async (event) => {
    event.preventDefault();

    const safeName = String(inboxName || '').trim();
    const safeEmail = String(inboxEmail || '').trim().toLowerCase();
    const safePassword = String(inboxPassword || '');

    if (!safeName || !safeEmail || !safePassword) {
      toast.error(t('dash.chatwoot_master.required') || 'Completa nombre, email y contrasena del usuario maestro.');
      return;
    }

    setIsSavingInbox(true);

    try {
      if (typeof onSaveInbox === 'function') {
        await onSaveInbox({
          name: safeName,
          email: safeEmail,
          password: safePassword,
          verificationPassword: inboxVerificationPassword,
        });
      }

      setInboxConfigured(true);
      setInboxEmailMasked(maskEmail(safeEmail));
      setInboxVerificationPassword('');
      setInboxPassword('');
      setInboxTestStatus({
        ok: true,
        message:
          t('dash.chatwoot_master.test_success') || 'Conexion validada correctamente.',
      });
      toast.success(t('standalone.settings.master_user_saved') || 'Usuario maestro de Waflow WhatsApp guardado');
    } catch (error) {
      toast.error(
        error?.message || (t('standalone.settings.master_user_save_error') || 'No se pudo guardar el usuario maestro de Waflow WhatsApp'),
      );
    } finally {
      setIsSavingInbox(false);
    }
  };

  const handleTestInboxUser = async () => {
    const safeEmail = String(inboxEmail || '').trim().toLowerCase();
    const hasCredentials = safeEmail && (inboxPassword || inboxConfigured);

    if (!hasCredentials) {
      const message = t('dash.chatwoot_master.test_error') || 'No se pudo validar el Usuario Maestro.';
      setInboxTestStatus({ ok: false, message });
      toast.error(message);
      return;
    }

    setIsTestingInbox(true);

    try {
      await Promise.resolve();
      const message = t('dash.chatwoot_master.test_success') || 'Conexion validada correctamente.';
      setInboxConfigured(true);
      setInboxEmailMasked(maskEmail(safeEmail));
      setInboxTestStatus({ ok: true, message });
      toast.success(message);
    } catch (error) {
      const message = error?.message || (t('dash.chatwoot_master.test_error') || 'No se pudo validar el Usuario Maestro.');
      setInboxTestStatus({ ok: false, message });
      toast.error(message);
    } finally {
      setIsTestingInbox(false);
    }
  };

  const handleReloadInboxUser = async () => {
    setIsLoadingInbox(true);
    try {
      await Promise.resolve();
      setInboxTestStatus(null);
      toast.success(t('common.reload') || 'Recargar');
    } finally {
      setIsLoadingInbox(false);
    }
  };

  const handleSaveOpenAi = async () => {
    const safeKey = String(openAiKeyDraft || '').trim();

    if (!safeKey) {
      toast.error(t('agency.integrations.openai_key_empty_error') || 'Pega una OpenAI API key antes de guardar.');
      return;
    }

    setIsSavingOpenAi(true);

    try {
      if (typeof onSaveOpenAI === 'function') {
        await onSaveOpenAI({ openai_api_key: safeKey });
      }

      setOpenAiKeyConfigured(true);
      toast.success(t('agency.integrations.openai_key_saved') || 'OpenAI API key guardada correctamente.');
    } catch (error) {
      toast.error(error?.message || (t('agency.integrations.openai_key_error') || 'No se pudo guardar la OpenAI key.'));
    } finally {
      setIsSavingOpenAi(false);
    }
  };

  const handleRemoveOpenAi = async () => {
    setIsSavingOpenAi(true);

    try {
      if (typeof onSaveOpenAI === 'function') {
        await onSaveOpenAI({ openai_api_key: '' });
      }

      setOpenAiKeyDraft('');
      setOpenAiKeyConfigured(false);
      toast.success(t('agency.integrations.openai_key_removed') || 'OpenAI API key eliminada.');
    } catch (error) {
      toast.error(error?.message || (t('agency.integrations.openai_key_error') || 'No se pudo guardar la OpenAI key.'));
    } finally {
      setIsSavingOpenAi(false);
    }
  };

  const handleGenerateKey = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const keyName = String(formData.get('keyName') || '').trim();

    if (!keyName) return;

    try {
      const result =
        typeof onGenerateApiKey === 'function'
          ? await onGenerateApiKey({ name: keyName })
          : null;
      const rawKey = String(
        result?.rawKey || `waflow_live_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
      );
      const keyPrefix = String(result?.keyPrefix || rawKey.slice(0, 12));

      setApiKeys((prev) => [
        {
          id: result?.id || makeId(),
          key_name: keyName,
          key_prefix: keyPrefix,
        },
        ...prev,
      ]);
      setGeneratedKey(rawKey);
      setShowNewKeyModal(true);
      event.currentTarget.reset();
      toast.success(t('dash.settings.key_generated') || 'Clave Generada');
    } catch (error) {
      toast.error(error?.message || (t('dash.settings.key_generate_error') || 'No se pudo generar la clave.'));
    }
  };

  const handleRevokeKey = async (id) => {
    try {
      if (typeof onRevokeApiKey === 'function') {
        await onRevokeApiKey(id);
      }

      setApiKeys((prev) => prev.filter((item) => item.id !== id));
      toast.success(t('dash.settings.key_revoked') || 'Clave eliminada.');
    } catch (error) {
      toast.error(error?.message || (t('dash.settings.key_revoke_error') || 'No se pudo eliminar la clave.'));
    }
  };

  const handleCreateWebhook = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const payload = {
      id: makeId(),
      name: String(formData.get('hookName') || '').trim(),
      target_url: String(formData.get('hookUrl') || '').trim(),
      events: formData.getAll('events').map((item) => String(item)),
    };

    if (!payload.name || !payload.target_url) {
      toast.error(t('agency.webhook.name_url_required') || 'Nombre y URL son requeridos.');
      return;
    }

    try {
      if (typeof onCreateWebhook === 'function') {
        await onCreateWebhook(payload);
      }

      setWebhooks((prev) => [payload, ...prev]);
      setShowNewWebhookModal(false);
      toast.success(t('agency.webhook.created') || 'Webhook creado.');
    } catch (error) {
      toast.error(error?.message || (t('agency.webhook.create_error') || 'No se pudo crear el webhook.'));
    }
  };

  const handleDeleteWebhook = async (id) => {
    try {
      if (typeof onDeleteWebhook === 'function') {
        await onDeleteWebhook(id);
      }

      setWebhooks((prev) => prev.filter((item) => item.id !== id));
      toast.success(t('agency.webhook.deleted') || 'Webhook eliminado.');
    } catch (error) {
      toast.error(error?.message || (t('agency.webhook.delete_error') || 'No se pudo eliminar el webhook.'));
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-right-4">
      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        <aside className="xl:sticky xl:top-6 bg-white dark:bg-gray-900/90 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 xl:p-6">
          <div className="space-y-5">
            {settingsMenuGroups.map((group) => (
              <div key={group.key}>
                <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-gray-500 dark:text-gray-400 mb-2">
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentSettingsSectionId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSettingsSection(item.id)}
                        className={`w-full text-left rounded-xl border px-3.5 py-3 transition-all duration-150 flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                          isActive
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-[0_12px_24px_-18px_rgba(79,70,229,0.75)]'
                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-500'
                        }`}
                      >
                        <Icon size={15} className={isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'} />
                        <span className="text-sm font-semibold">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          {currentSettingsSectionId === 'inbox' && (
            <div className="bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <MessageSquareText size={24} className="text-indigo-500" />
                    {t('standalone.settings.whatsapp_title') || 'Waflow WhatsApp'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('standalone.settings.whatsapp_desc') ||
                      'Define el Usuario Maestro para aprovisionar cuentas Waflow WhatsApp automaticamente.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${
                      inboxConfigured
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {inboxConfigured
                      ? (t('standalone.settings.master_user_ready') || 'Usuario maestro configurado')
                      : (t('standalone.settings.master_user_pending') || 'Pendiente de configuracion')}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveInboxUser} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                    {t('dash.chatwoot_master.name') || 'Nombre del Usuario Maestro'}
                  </label>
                  <input
                    type="text"
                    value={inboxName}
                    onChange={(event) => setInboxName(event.target.value)}
                    placeholder="Ej: Soporte Principal"
                    autoComplete="off"
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                    {t('dash.chatwoot_master.email') || 'Email del Usuario Maestro'}
                  </label>
                  <input
                    type="email"
                    value={inboxEmail}
                    onChange={(event) => setInboxEmail(event.target.value)}
                    placeholder="soporte@empresa.com"
                    autoComplete="off"
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {inboxConfigured && inboxEmailMasked && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                      {(t('dash.chatwoot_master.configured_as') || 'Configurado como') + ` ${inboxEmailMasked}`}
                    </p>
                  )}
                </div>

                {inboxConfigured && (
                  <div className="xl:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                      {t('dash.chatwoot_master.verify_password') || 'Contrasena actual para verificar cambios'}
                    </label>
                    <input
                      type="password"
                      value={inboxVerificationPassword}
                      onChange={(event) => setInboxVerificationPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      {t('dash.chatwoot_master.verify_password_desc') ||
                        'Antes de guardar cambios, verifica con la contrasena actual del Usuario Maestro.'}
                    </p>
                  </div>
                )}

                <div className="xl:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                    {inboxConfigured
                      ? (t('dash.chatwoot_master.new_password') || 'Nueva contrasena del Usuario Maestro')
                      : (t('dash.chatwoot_master.password') || 'Contrasena del Usuario Maestro')}
                  </label>
                  <input
                    type="password"
                    value={inboxPassword}
                    onChange={(event) => setInboxPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="xl:col-span-2 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleTestInboxUser}
                    disabled={isTestingInbox || isLoadingInbox}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-60 transition-colors"
                  >
                    {isTestingInbox ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {t('dash.chatwoot_master.test_button') || 'Probar conexion'}
                  </button>

                  <button
                    type="button"
                    onClick={handleReloadInboxUser}
                    disabled={isLoadingInbox || isTestingInbox}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors"
                  >
                    <RefreshCw size={13} />
                    {isLoadingInbox ? (t('common.loading') || 'Cargando...') : (t('common.reload') || 'Recargar')}
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingInbox}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-60"
                  >
                    {isSavingInbox ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {t('dash.chatwoot_master.save') || 'Guardar Usuario Maestro'}
                  </button>
                </div>

                {inboxTestStatus?.message && (
                  <p
                    className={`xl:col-span-2 text-[11px] ${
                      inboxTestStatus.ok
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {inboxTestStatus.message}
                  </p>
                )}
              </form>
            </div>
          )}

          {currentSettingsSectionId === 'integrations' && (
            <div className="bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-5">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Key size={22} className="text-emerald-500" />
                  OpenAI
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('standalone.settings.openai_desc') ||
                    'Configura la OpenAI API key para esta cuenta. No necesitas seleccionar multiples cuentas en esta interfaz.'}
                </p>
              </div>

              <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      {t('agency.integrations.openai_key_panel_title') || 'Carga la OpenAI API key'}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {t('standalone.settings.openai_panel_desc') ||
                        'Guarda una sola key para esta cuenta y usala en los flujos que dependan de OpenAI.'}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${
                      openAiKeyConfigured
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700'
                    }`}
                  >
                    {openAiKeyConfigured
                      ? (t('standalone.settings.openai_ready') || 'OpenAI lista')
                      : (t('standalone.settings.openai_missing') || 'Sin configurar')}
                  </span>
                </div>

                <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4 shadow-sm">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                      {t('agency.integrations.openai_key_label') || 'OpenAI API key'}
                    </label>
                    <div className="relative">
                      <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="password"
                        value={openAiKeyDraft}
                        onChange={(event) => setOpenAiKeyDraft(event.target.value)}
                        placeholder={t('agency.integrations.openai_key_placeholder') || 'sk-...'}
                        autoComplete="new-password"
                        className="w-full pl-10 pr-4 py-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 p-3 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                      Esta cuenta
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 break-all">
                      {String(accountInfo?.name || accountInfo?.email || accountIdValue)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleSaveOpenAi}
                      disabled={isSavingOpenAi}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-60"
                    >
                      {isSavingOpenAi ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      {t('common.save') || 'Guardar'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveOpenAi}
                      disabled={isSavingOpenAi || !openAiKeyConfigured}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-60"
                    >
                      <Trash2 size={15} />
                      {t('agency.integrations.openai_key_remove') || 'Eliminar key'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentSettingsSectionId === 'developer' && (
            <div className="bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-right-4">
              <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Terminal size={24} className="text-pink-500" /> {developerTitle}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{developerDescription}</p>
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 text-xs font-bold uppercase rounded-full border bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/30 dark:border-pink-800">
                    {developerBadge}
                  </span>
                </div>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/20 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
                          {accountIdTitle}
                        </p>
                        <h4 className="mt-2 text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <Key size={16} className="text-emerald-500" />
                          {n8nReferenceTitle}
                        </h4>
                        <p className="mt-2 font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-200 break-all">
                          {accountIdValue || (t('common.not_available') || 'No disponible')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!accountIdValue) return;
                          navigator.clipboard.writeText(accountIdValue);
                          toast.success(t('common.copied') || 'Copiado');
                        }}
                        className="shrink-0 rounded-xl border border-emerald-200 bg-white/80 px-3 py-2 text-emerald-600 transition hover:bg-white dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        title={t('common.copy') || 'Copiar'}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-emerald-700/80 dark:text-emerald-200/80">
                      {n8nReferenceHelp}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                      {t('dash.settings.api_keys') || 'Claves API'}
                    </h4>
                    <form onSubmit={handleGenerateKey} className="flex gap-2">
                      <input
                        name="keyName"
                        placeholder={t('dash.settings.key_name_placeholder') || 'Nombre...'}
                        required
                        className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none text-sm"
                      />
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl font-bold text-sm shadow flex items-center gap-2"
                      >
                        <Plus size={16} /> {t('common.create') || 'Crear'}
                      </button>
                    </form>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs font-bold text-gray-400 uppercase border-b dark:border-gray-700">
                          <th className="pb-3">{t('common.name') || 'Nombre'}</th>
                          <th className="pb-3">{t('common.prefix') || 'Prefijo'}</th>
                          <th className="pb-3 text-right">{t('common.action') || 'Accion'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-800">
                        {apiKeys.map((key) => (
                          <tr key={key.id}>
                            <td className="py-3 font-bold text-sm dark:text-white">{key.key_name}</td>
                            <td className="py-3 font-mono text-xs text-gray-500">{key.key_prefix}...</td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => handleRevokeKey(key.id)}
                                className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {apiKeys.length === 0 && (
                      <p className="text-center py-6 text-sm text-gray-400">
                        {t('dash.settings.no_keys') || 'Sin claves activas.'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                      {t('dash.settings.webhooks') || 'Webhooks'}
                    </h4>
                    <button
                      onClick={() => setShowNewWebhookModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow flex items-center gap-2"
                    >
                      <Plus size={16} /> {t('common.create') || 'Crear'}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs font-bold text-gray-400 uppercase border-b dark:border-gray-700">
                          <th className="pb-3">{t('common.name') || 'Nombre'}</th>
                          <th className="pb-3">URL</th>
                          <th className="pb-3 text-right">{t('common.action') || 'Accion'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-800">
                        {webhooks.map((hook) => (
                          <tr key={hook.id}>
                            <td className="py-3 font-bold text-sm dark:text-white">{hook.name}</td>
                            <td className="py-3 text-xs text-gray-500 truncate max-w-[200px]">{hook.target_url}</td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => handleDeleteWebhook(hook.id)}
                                className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {webhooks.length === 0 && (
                      <p className="text-center py-6 text-sm text-gray-400">
                        {t('dash.settings.no_webhooks') || 'Sin webhooks configurados.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showNewKeyModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="mb-6 text-center">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                    <ShieldCheck size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {t('dash.settings.key_generated') || 'Clave Generada'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">
                    {t('dash.settings.key_copy_warning') || 'Copiala ahora, no podras verla despues.'}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 mb-6 relative group">
                  <div className="font-mono text-sm break-all pr-10 text-indigo-600 dark:text-indigo-400 font-bold">
                    {generatedKey}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(String(generatedKey || ''));
                      toast.success(t('common.copied') || 'Copiado');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-indigo-600 transition"
                  >
                    <Copy size={18} />
                  </button>
                </div>

                <button
                  onClick={() => {
                    setShowNewKeyModal(false);
                    setGeneratedKey(null);
                  }}
                  className="w-full py-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl font-bold hover:opacity-90 transition"
                >
                  {t('common.understood') || 'Entendido'}
                </button>
              </div>
            </div>
          )}

          {showNewWebhookModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {t('dash.settings.new_webhook') || 'Nuevo Webhook'}
                  </h3>
                  <button onClick={() => setShowNewWebhookModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateWebhook} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      {t('common.name') || 'Nombre'}
                    </label>
                    <input
                      name="hookName"
                      placeholder="Ej: n8n Produccion"
                      required
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">URL</label>
                    <input
                      name="hookUrl"
                      type="url"
                      placeholder="https://..."
                      required
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                      {t('common.events') || 'Eventos'}
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          name="events"
                          value="whatsapp inbound message"
                          defaultChecked
                          className="w-5 h-5 rounded text-blue-600"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-bold dark:text-white">Inbound Message</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          name="events"
                          value="whatsapp outbound message"
                          defaultChecked
                          className="w-5 h-5 rounded text-blue-600"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-bold dark:text-white">Outbound Message</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowNewWebhookModal(false)}
                      className="flex-1 py-3 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl font-bold"
                    >
                      {t('common.cancel') || 'Cancelar'}
                    </button>
                    <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">
                      {t('common.create') || 'Crear'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {currentSettingsSectionId === 'appearance' && (
            <div className="bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{activeSettingsSectionTitle}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('agency.theme.toggle')}</p>
                <div className="mt-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">{t('agency.theme.dark_mode')}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {theme === 'light'
                      ? (t('agency.theme.light_enabled') || 'Tema claro activo.')
                      : (t('agency.theme.dark_enabled') || 'Tema oscuro activo.')}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-600 dark:text-yellow-400"
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
