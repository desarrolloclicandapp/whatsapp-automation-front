import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Key,
  Link,
  Loader2,
  Mail,
  MessageSquareText,
  Moon,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sun,
  Terminal,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const API_URL = (import.meta.env.VITE_API_URL || 'https://wa.waflow.com').replace(/\/$/, '');

const maskEmail = (email) => {
  const safeEmail = String(email || '').trim();
  if (!safeEmail.includes('@')) return safeEmail;

  const [user, domain] = safeEmail.split('@');
  if (!user) return safeEmail;

  const visible = user.length <= 2 ? user.charAt(0) : user.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(user.length - visible.length, 2))}@${domain}`;
};

export default function StandaloneSettings({
  token,
  accountInfo,
  locationId,
  capabilities,
  onGoToBilling,
  onUnauthorized,
  onDataChange,
}) {
  const { t, language } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const canUseDevTools = capabilities?.can_use_dev_tools === true;

  const [settingsSection, setSettingsSection] = useState('general');
  const [accountNameDraft, setAccountNameDraft] = useState(String(accountInfo?.name || ''));
  const [accountEmail, setAccountEmail] = useState(String(accountInfo?.email || ''));
  const [emailChangeDraft, setEmailChangeDraft] = useState('');
  const [emailChangeCode, setEmailChangeCode] = useState('');
  const [emailChangeRequested, setEmailChangeRequested] = useState(false);
  const [pendingEmailReview, setPendingEmailReview] = useState(null);
  const [showEmailReviewPrompt, setShowEmailReviewPrompt] = useState(false);
  const [savingAccountName, setSavingAccountName] = useState(false);
  const [requestingEmailChange, setRequestingEmailChange] = useState(false);
  const [confirmingEmailChange, setConfirmingEmailChange] = useState(false);
  const [deactivatingAccount, setDeactivatingAccount] = useState(false);

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
  const [locationDetails, setLocationDetails] = useState(null);
  const [standaloneGlobal, setStandaloneGlobal] = useState({
    general: {
      alert_phone_number: '',
      crm_contact_tag: '',
    },
    integrations: {
      elevenlabs_api_key: '',
      elevenlabs_voice_id: '',
      proxy: null,
    },
  });
  const [globalKeywords, setGlobalKeywords] = useState([]);
  const [savingGlobalGeneral, setSavingGlobalGeneral] = useState(false);
  const [savingGlobalIntegrations, setSavingGlobalIntegrations] = useState(false);
  const [loadingGlobalVoices, setLoadingGlobalVoices] = useState(false);
  const [globalVoices, setGlobalVoices] = useState([]);
  const [globalProxyDraft, setGlobalProxyDraft] = useState({
    host: '',
    port: '',
    username: '',
    password: '',
    protocol: 'http',
  });
  const [proxyConfigBySlot, setProxyConfigBySlot] = useState({});
  const [loadingProxyBySlot, setLoadingProxyBySlot] = useState({});
  const [savingProxyBySlot, setSavingProxyBySlot] = useState({});
  const [elevenVoicesBySlot, setElevenVoicesBySlot] = useState({});
  const [loadingElevenVoicesBySlot, setLoadingElevenVoicesBySlot] = useState({});
  const [elevenKeyDraftBySlot, setElevenKeyDraftBySlot] = useState({});

  const authFetch = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      onUnauthorized?.();
      throw new Error(t('agency.session_expired'));
    }

    return response;
  };

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
            id: 'general',
            label: t('agency.settings_nav.general') || 'General',
            icon: Save,
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

  useEffect(() => {
    let isCancelled = false;

    const loadSettingsData = async () => {
      try {
        setIsLoadingInbox(true);
        const requests = canUseDevTools
          ? [
            authFetch('/agency/api-keys'),
            authFetch('/agency/webhooks'),
          ]
          : [Promise.resolve({ ok: true, json: async () => ({ keys: [] }) }), Promise.resolve({ ok: true, json: async () => ({ hooks: [] }) })];
        if (locationId) {
          requests.push(authFetch(`/agency/location-details/${encodeURIComponent(locationId)}`));
          requests.push(authFetch(`/agency/standalone/global-settings?locationId=${encodeURIComponent(locationId)}`));
        }

        const [keysResponse, webhooksResponse, locationDetailsResponse, globalSettingsResponse] = await Promise.all(requests);
        const keysData = keysResponse.ok ? await keysResponse.json().catch(() => ({})) : {};
        const webhooksData = webhooksResponse.ok ? await webhooksResponse.json().catch(() => ({})) : {};
        const locationData = locationDetailsResponse?.ok
          ? await locationDetailsResponse.json().catch(() => ({}))
          : null;
        const globalSettingsData = globalSettingsResponse?.ok
          ? await globalSettingsResponse.json().catch(() => ({}))
          : null;

        if (isCancelled) return;

        setOpenAiKeyConfigured(accountInfo?.openai_key_configured === true);
        setApiKeys(Array.isArray(keysData?.keys) ? keysData.keys : []);
        setWebhooks(Array.isArray(webhooksData?.hooks) ? webhooksData.hooks : []);
        setLocationDetails(locationData);
        setStandaloneGlobal((globalSettingsData?.global && typeof globalSettingsData.global === 'object')
          ? globalSettingsData.global
          : {
            general: {
              alert_phone_number: '',
              crm_contact_tag: '',
            },
            integrations: {
              elevenlabs_api_key: '',
              elevenlabs_voice_id: '',
              proxy: null,
            },
          });
        setGlobalKeywords(Array.isArray(globalSettingsData?.keywords) ? globalSettingsData.keywords : []);
        const safeProxy = globalSettingsData?.global?.integrations?.proxy || null;
        setGlobalProxyDraft({
          host: safeProxy?.host || '',
          port: safeProxy?.port ? String(safeProxy.port) : '',
          username: safeProxy?.username || '',
          password: '',
          protocol: safeProxy?.protocol || 'http',
        });
      } catch (error) {
        if (!isCancelled) {
          toast.error(error?.message || 'No se pudieron cargar los ajustes de la cuenta');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingInbox(false);
        }
      }
    };

    if (token) {
      loadSettingsData();
    }

    return () => {
      isCancelled = true;
    };
  }, [accountInfo?.email, accountInfo?.openai_key_configured, token, locationId, canUseDevTools]);

  useEffect(() => {
    setAccountNameDraft(String(accountInfo?.name || ''));
    setAccountEmail(String(accountInfo?.email || ''));
  }, [accountInfo?.name, accountInfo?.email]);

  useEffect(() => {
    const rawPending = sessionStorage.getItem('pendingEmailReview');
    if (!rawPending) return;
    try {
      const parsed = JSON.parse(rawPending);
      const requestedEmail = String(parsed?.requestedEmail || '').trim().toLowerCase();
      if (requestedEmail) {
        setPendingEmailReview({
          requestedEmail,
          maskedCurrentEmail: String(parsed?.maskedCurrentEmail || ''),
        });
        setEmailChangeDraft(requestedEmail);
        setShowEmailReviewPrompt(true);
      }
    } catch {
      sessionStorage.removeItem('pendingEmailReview');
    }
  }, []);


  useEffect(() => {
    if (settingsSection !== 'integrations') return;
    const safeSlots = Array.isArray(locationDetails?.slots) ? locationDetails.slots : [];
    safeSlots.forEach((slot) => {
      loadProxyConfig(slot.slot_id);
      if (slot.elevenlabs_api_key) {
        loadElevenVoices(slot.slot_id);
      }
    });
  }, [settingsSection, locationDetails?.slots]);

  const allSettingsSectionIds = settingsMenuGroups.flatMap((group) => group.items.map((item) => item.id));
  const currentSettingsSectionId = allSettingsSectionIds.includes(settingsSection)
    ? settingsSection
    : (allSettingsSectionIds[0] || 'general');
  const settingsSectionTitleMap = settingsMenuGroups.reduce((acc, group) => {
    group.items.forEach((item) => {
      acc[item.id] = item.label;
    });
    return acc;
  }, {});
  const activeSettingsSectionTitle =
    settingsSectionTitleMap[currentSettingsSectionId] || (t('dash.header.settings') || 'Configuración');

  const locationSlots = Array.isArray(locationDetails?.slots) ? locationDetails.slots : [];
  const isGhlMode = String(locationDetails?.crmType || accountInfo?.crm_type || '').trim().toLowerCase() === 'ghl';
  const keywordsBySlotId = useMemo(() => {
    const map = new Map();
    const rows = Array.isArray(locationDetails?.keywords) ? locationDetails.keywords : [];
    rows.forEach((keyword) => {
      const slotId = Number.parseInt(String(keyword?.slot_id || 0), 10);
      if (!map.has(slotId)) map.set(slotId, []);
      map.get(slotId).push(keyword);
    });
    return map;
  }, [locationDetails?.keywords]);

  const accountIdValue = String(accountInfo?.agencyId || accountInfo?.id || 'demo-account-123');
  const developerTitle = t('dash.settings.dev_title') || 'Desarrolladores';
  const developerDescription = replaceAgencyTerms(
    t('dash.settings.dev_desc') || 'Gestiona claves API y webhooks para integraciones.',
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
      toast.error(t('dash.chatwoot_master.required') || 'Completa nombre, email y contraseña del usuario maestro.');
      return;
    }

    setIsSavingInbox(true);

    try {
      const response = await authFetch('/agency/chatwoot/master-user', {
        method: 'PUT',
        body: JSON.stringify({
          masterName: safeName,
          masterEmail: safeEmail,
          masterPassword: safePassword,
          verificationPassword: inboxVerificationPassword,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar el usuario maestro');
      }

      setInboxConfigured(true);
      setInboxEmailMasked(maskEmail(safeEmail));
      setInboxVerificationPassword('');
      setInboxPassword('');
      setInboxTestStatus({
        ok: true,
        message: t('dash.chatwoot_master.test_success') || 'Conexion validada correctamente.',
      });
      toast.success(t('standalone.settings.master_user_saved') || 'Usuario maestro de Waflow WhatsApp guardado');
      onDataChange?.();
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
      const response = await authFetch('/agency/chatwoot/master-user/test', {
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || (t('dash.chatwoot_master.test_error') || 'No se pudo validar el Usuario Maestro.'));
      }
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
      const response = await authFetch('/agency/chatwoot/master-user');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo recargar el usuario maestro');
      }
      setInboxConfigured(body?.configured === true);
      setInboxName(body?.masterName || '');
      setInboxEmail(body?.masterEmail || String(accountInfo?.email || ''));
      setInboxEmailMasked(body?.masterEmailMasked || '');
      setInboxTestStatus(null);
      toast.success(t('common.reload') || 'Recargar');
    } catch (error) {
      toast.error(error?.message || 'No se pudo recargar el usuario maestro');
    } finally {
      setIsLoadingInbox(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    handleReloadInboxUser();
  }, [token]);

  const handleSaveOpenAi = async () => {
    const safeKey = String(openAiKeyDraft || '').trim();

    if (!safeKey) {
      toast.error(t('agency.integrations.openai_key_empty_error') || 'Pega una OpenAI API key antes de guardar.');
      return;
    }

    setIsSavingOpenAi(true);

    try {
      const response = await authFetch('/agency/settings', {
        method: 'POST',
        body: JSON.stringify({ openai_api_key: safeKey }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || (t('agency.integrations.openai_key_error') || 'No se pudo guardar la OpenAI key.'));
      }

      setOpenAiKeyConfigured(true);
      toast.success(t('agency.integrations.openai_key_saved') || 'OpenAI API key guardada correctamente.');
      onDataChange?.();
    } catch (error) {
      toast.error(error?.message || (t('agency.integrations.openai_key_error') || 'No se pudo guardar la OpenAI key.'));
    } finally {
      setIsSavingOpenAi(false);
    }
  };

  const handleRemoveOpenAi = async () => {
    setIsSavingOpenAi(true);

    try {
      const response = await authFetch('/agency/settings', {
        method: 'POST',
        body: JSON.stringify({ openai_api_key: '' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || (t('agency.integrations.openai_key_error') || 'No se pudo guardar la OpenAI key.'));
      }

      setOpenAiKeyDraft('');
      setOpenAiKeyConfigured(false);
      toast.success(t('agency.integrations.openai_key_removed') || 'OpenAI API key eliminada.');
      onDataChange?.();
    } catch (error) {
      toast.error(error?.message || (t('agency.integrations.openai_key_error') || 'No se pudo guardar la OpenAI key.'));
    } finally {
      setIsSavingOpenAi(false);
    }
  };

  const refreshStandaloneGlobalSettings = async () => {
    if (!locationId) return null;
    const response = await authFetch(`/agency/standalone/global-settings?locationId=${encodeURIComponent(locationId)}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error || 'No se pudo recargar la configuración global');
    }

    setStandaloneGlobal((body?.global && typeof body.global === 'object')
      ? body.global
      : {
        general: { alert_phone_number: '', crm_contact_tag: '' },
        integrations: { elevenlabs_api_key: '', elevenlabs_voice_id: '', proxy: null },
      });
    setGlobalKeywords(Array.isArray(body?.keywords) ? body.keywords : []);
    const safeProxy = body?.global?.integrations?.proxy || null;
    setGlobalProxyDraft({
      host: safeProxy?.host || '',
      port: safeProxy?.port ? String(safeProxy.port) : '',
      username: safeProxy?.username || '',
      password: '',
      protocol: safeProxy?.protocol || 'http',
    });
    return body;
  };

  const saveStandaloneGlobalGeneral = async () => {
    if (!locationId) return;
    setSavingGlobalGeneral(true);
    try {
      const payload = {
        locationId,
        global: {
          general: {
            alert_phone_number: standaloneGlobal?.general?.alert_phone_number || '',
            crm_contact_tag: standaloneGlobal?.general?.crm_contact_tag || '',
          },
        },
      };
      const response = await authFetch('/agency/standalone/global-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar la configuración general');
      }
      toast.success(t('standalone.settings.general_saved') || 'Configuración general guardada para toda la cuenta');
      await Promise.all([
        refreshStandaloneGlobalSettings().catch(() => null),
        refreshLocationDetails().catch(() => null),
      ]);
      onDataChange?.();
    } catch (error) {
      toast.error(error?.message || (t('standalone.settings.general_save_error') || 'No se pudo guardar la configuración general'));
    } finally {
      setSavingGlobalGeneral(false);
    }
  };

  const saveStandaloneGlobalIntegrations = async () => {
    if (!locationId) return;
    setSavingGlobalIntegrations(true);
    try {
      const proxyHost = String(globalProxyDraft?.host || '').trim();
      const proxyPort = Number.parseInt(String(globalProxyDraft?.port || '').trim(), 10);
      const proxyPayload = proxyHost && Number.isFinite(proxyPort) && proxyPort > 0
        ? {
          host: proxyHost,
          port: proxyPort,
          username: String(globalProxyDraft?.username || '').trim(),
          password: String(globalProxyDraft?.password || '').trim(),
          protocol: String(globalProxyDraft?.protocol || 'http').trim() || 'http',
        }
        : null;

      const payload = {
        locationId,
        global: {
          integrations: {
            elevenlabs_api_key: standaloneGlobal?.integrations?.elevenlabs_api_key || '',
            elevenlabs_voice_id: standaloneGlobal?.integrations?.elevenlabs_voice_id || '',
            proxy: proxyPayload,
          },
        },
      };
      const response = await authFetch('/agency/standalone/global-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar la configuración de integraciones');
      }
      toast.success(t('standalone.settings.integrations_saved') || 'Integraciones globales guardadas para toda la cuenta');
      await Promise.all([
        refreshStandaloneGlobalSettings().catch(() => null),
        refreshLocationDetails().catch(() => null),
      ]);
      onDataChange?.();
    } catch (error) {
      toast.error(error?.message || (t('standalone.settings.integrations_save_error') || 'No se pudo guardar la configuración de integraciones'));
    } finally {
      setSavingGlobalIntegrations(false);
    }
  };

  const loadGlobalElevenVoices = async (forceRefresh = false) => {
    const key = String(standaloneGlobal?.integrations?.elevenlabs_api_key || '').trim();
    if (!key) {
      setGlobalVoices([]);
      return;
    }
    setLoadingGlobalVoices(true);
    try {
      const response = await authFetch('/agency/elevenlabs/validate', {
        method: 'POST',
        body: JSON.stringify({ apiKey: key, refresh: forceRefresh }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudieron cargar las voces de ElevenLabs');
      }
      setGlobalVoices(Array.isArray(body?.voices) ? body.voices : []);
      toast.success('Voces de ElevenLabs actualizadas');
    } catch (error) {
      toast.error(error?.message || 'No se pudieron cargar las voces de ElevenLabs');
    } finally {
      setLoadingGlobalVoices(false);
    }
  };

  const handleAddGlobalKeyword = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const keyword = String(formData.get('keyword') || '').trim();
    const tag = String(formData.get('tag') || '').trim();
    if (!keyword || !tag || !locationId) return;

    try {
      const response = await authFetch('/agency/keywords', {
        method: 'POST',
        body: JSON.stringify({ locationId, slotId: null, keyword, tag }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar la keyword global');
      }
      event.currentTarget.reset();
      await refreshStandaloneGlobalSettings();
      toast.success('Keyword global guardada');
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la keyword global');
    }
  };

  const handleDeleteGlobalKeyword = async (keywordId) => {
    try {
      const response = await authFetch(`/agency/keywords/${keywordId}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo eliminar la keyword global');
      }
      await refreshStandaloneGlobalSettings();
      toast.success('Keyword global eliminada');
    } catch (error) {
      toast.error(error?.message || 'No se pudo eliminar la keyword global');
    }
  };

  const refreshLocationDetails = async () => {
    if (!locationId) return;
    const response = await authFetch(`/agency/location-details/${encodeURIComponent(locationId)}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error || 'No se pudo recargar la configuración');
    }
    setLocationDetails(body);
    return body;
  };

  const patchLocationSlot = (slotId, patch) => {
    setLocationDetails((current) => {
      if (!current) return current;
      return {
        ...current,
        slots: Array.isArray(current.slots)
          ? current.slots.map((slot) => (slot.slot_id === slotId ? { ...slot, ...patch } : slot))
          : current.slots,
      };
    });
  };

  const patchLocationSlotSettings = (slotId, nextSettings) => {
    patchLocationSlot(slotId, { settings: nextSettings });
  };

  const updateSlotSettings = async (slotId, nextSettings) => {
    patchLocationSlotSettings(slotId, nextSettings);
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/settings`,
        {
          method: 'PUT',
          body: JSON.stringify({ settings: nextSettings }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar la configuración del WhatsApp');
      }
      onDataChange?.();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar la configuración del WhatsApp');
      await refreshLocationDetails().catch(() => { });
    }
  };

  const toggleSlotSetting = (slotId, key, currentSettings = {}) => {
    updateSlotSettings(slotId, {
      ...currentSettings,
      [key]: !currentSettings[key],
    });
  };

  const changeSlotSetting = (slotId, key, value, currentSettings = {}) => {
    updateSlotSettings(slotId, {
      ...currentSettings,
      [key]: value,
    });
  };

  const changeSlotPriority = async (slotId, priority) => {
    try {
      const response = await authFetch('/agency/update-slot-config', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          slotId,
          priority: Number.parseInt(String(priority), 10),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar la prioridad');
      }

      patchLocationSlot(slotId, { priority: Number.parseInt(String(priority), 10) });
      toast.success('Orden de envío actualizado');
      onDataChange?.();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar la prioridad');
      await refreshLocationDetails().catch(() => { });
    }
  };

  const handleAddKeyword = async (event, slotId) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const keyword = String(formData.get('keyword') || '').trim();
    const tag = String(formData.get('tag') || '').trim();
    if (!keyword || !tag) return;

    try {
      const response = await authFetch('/agency/keywords', {
        method: 'POST',
        body: JSON.stringify({ locationId, slotId, keyword, tag }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar la regla');
      }

      event.currentTarget.reset();
      await refreshLocationDetails();
      toast.success('Regla guardada');
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar la regla');
    }
  };

  const handleDeleteKeyword = async (keywordId) => {
    try {
      const response = await authFetch(`/agency/keywords/${keywordId}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo eliminar la regla');
      }

      await refreshLocationDetails();
      toast.success('Regla eliminada');
    } catch (error) {
      toast.error(error.message || 'No se pudo eliminar la regla');
    }
  };

  const loadProxyConfig = async (slotId, forceRefresh = false) => {
    if (!slotId || !locationId) return;
    if (!forceRefresh && proxyConfigBySlot[slotId]) return;

    setLoadingProxyBySlot((prev) => ({ ...prev, [slotId]: true }));
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/proxy`,
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo cargar el proxy');
      }

      const proxy = body?.proxy || null;
      setProxyConfigBySlot((prev) => ({
        ...prev,
        [slotId]: {
          configured: !!body?.configured,
          host: proxy?.host || '',
          port: proxy?.port ? String(proxy.port) : '',
          username: proxy?.username || '',
          password: '',
          passwordMasked: proxy?.passwordMasked || '',
          hasPassword: !!proxy?.hasPassword,
          protocol: proxy?.protocol || 'http',
        },
      }));
    } catch (error) {
      toast.error(error.message || 'No se pudo cargar el proxy');
    } finally {
      setLoadingProxyBySlot((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const updateProxyField = (slotId, key, value) => {
    setProxyConfigBySlot((prev) => ({
      ...prev,
      [slotId]: {
        ...(prev[slotId] || {
          configured: false,
          host: '',
          port: '',
          username: '',
          password: '',
          passwordMasked: '',
          hasPassword: false,
          protocol: 'http',
        }),
        [key]: value,
      },
    }));
  };

  const saveProxyConfig = async (slotId) => {
    const current = proxyConfigBySlot[slotId] || {};
    setSavingProxyBySlot((prev) => ({ ...prev, [slotId]: true }));
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/proxy`,
        {
          method: 'PUT',
          body: JSON.stringify({
            protocol: current.protocol || 'http',
            host: String(current.host || '').trim(),
            port: current.port ? Number.parseInt(String(current.port), 10) : null,
            username: String(current.username || '').trim(),
            password: String(current.password || '').trim() || undefined,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar el proxy');
      }

      toast.success('Proxy guardado');
      await loadProxyConfig(slotId, true);
      await refreshLocationDetails();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar el proxy');
    } finally {
      setSavingProxyBySlot((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const clearProxyConfig = async (slotId) => {
    setSavingProxyBySlot((prev) => ({ ...prev, [slotId]: true }));
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/proxy`,
        { method: 'DELETE' },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo limpiar el proxy');
      }

      setProxyConfigBySlot((prev) => ({
        ...prev,
        [slotId]: {
          configured: false,
          host: '',
          port: '',
          username: '',
          password: '',
          passwordMasked: '',
          hasPassword: false,
          protocol: 'http',
        },
      }));
      await refreshLocationDetails();
      toast.success('Proxy eliminado');
    } catch (error) {
      toast.error(error.message || 'No se pudo limpiar el proxy');
    } finally {
      setSavingProxyBySlot((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const loadElevenVoices = async (slotId, forceRefresh = false) => {
    if (!slotId) return;
    if (!forceRefresh && elevenVoicesBySlot[slotId]) return;
    setLoadingElevenVoicesBySlot((prev) => ({ ...prev, [slotId]: true }));
    try {
      const response = await authFetch(
        `/agency/elevenlabs/voices?locationId=${encodeURIComponent(locationId)}&slotId=${encodeURIComponent(slotId)}${forceRefresh ? '&refresh=1' : ''}`,
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudieron cargar las voces');
      }
      setElevenVoicesBySlot((prev) => ({ ...prev, [slotId]: Array.isArray(body?.voices) ? body.voices : [] }));
    } catch (error) {
      toast.error(error.message || 'No se pudieron cargar las voces');
    } finally {
      setLoadingElevenVoicesBySlot((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const saveElevenApiKey = async (slotId, apiKey) => {
    try {
      const response = await authFetch('/agency/update-slot-config', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          slotId,
          elevenlabs_api_key: String(apiKey || '').trim(),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar la API key');
      }
      await refreshLocationDetails();
      if (String(apiKey || '').trim()) {
        await loadElevenVoices(slotId, true);
      } else {
        setElevenVoicesBySlot((prev) => ({ ...prev, [slotId]: [] }));
      }
      toast.success('API key de ElevenLabs guardada');
      return true;
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar la API key');
      return false;
    }
  };

  const saveElevenVoice = async (slotId, voiceId) => {
    try {
      const response = await authFetch('/agency/update-slot-config', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          slotId,
          elevenlabs_voice_id: String(voiceId || '').trim(),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar la voz por defecto');
      }
      await refreshLocationDetails();
      toast.success('Voz por defecto guardada');
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar la voz por defecto');
    }
  };

  const handleGenerateKey = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const keyName = String(formData.get('keyName') || '').trim();

    if (!keyName) return;

    try {
      const result =
        await authFetch('/agency/api-keys', {
          method: 'POST',
          body: JSON.stringify({ keyName }),
        }).then(async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(body?.error || (t('dash.settings.key_generate_error') || 'No se pudo generar la clave.'));
          }
          return body;
        });
      const rawKey = String(
        result?.apiKey || `waflow_live_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
      );
      const keyPrefix = String(result?.keyPrefix || rawKey.slice(0, 12));

      setApiKeys((prev) => [
        {
          id: result?.keyInfo?.id || makeId(),
          key_name: keyName,
          key_prefix: result?.keyInfo?.prefix || keyPrefix,
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
      const response = await authFetch(`/agency/api-keys/${id}`, {
        method: 'DELETE',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || (t('dash.settings.key_revoke_error') || 'No se pudo eliminar la clave.'));
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
      const response = await authFetch('/agency/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          targetUrl: payload.target_url,
          events: payload.events,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || (t('agency.webhook.create_error') || 'No se pudo crear el webhook.'));
      }

      setWebhooks((prev) => [body?.webhook || payload, ...prev]);
      setShowNewWebhookModal(false);
      toast.success(t('agency.webhook.created') || 'Webhook creado.');
    } catch (error) {
      toast.error(error?.message || (t('agency.webhook.create_error') || 'No se pudo crear el webhook.'));
    }
  };

  const handleDeleteWebhook = async (id) => {
    try {
      const response = await authFetch(`/agency/webhooks/${id}`, {
        method: 'DELETE',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || (t('agency.webhook.delete_error') || 'No se pudo eliminar el webhook.'));
      }

      setWebhooks((prev) => prev.filter((item) => item.id !== id));
      toast.success(t('agency.webhook.deleted') || 'Webhook eliminado.');
    } catch (error) {
      toast.error(error?.message || (t('agency.webhook.delete_error') || 'No se pudo eliminar el webhook.'));
    }
  };

  const saveAccountName = async () => {
    const safeName = String(accountNameDraft || '').trim();
    if (!safeName) {
      toast.error('Escribe un nombre valido.');
      return;
    }

    setSavingAccountName(true);
    try {
      const response = await authFetch('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: safeName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo actualizar el nombre.');
      }

      localStorage.setItem('userName', body?.user?.name || safeName);
      onDataChange?.();
      toast.success('Nombre actualizado.');
    } catch (error) {
      toast.error(error?.message || 'No se pudo actualizar el nombre.');
    } finally {
      setSavingAccountName(false);
    }
  };

  const requestEmailChange = async () => {
    const safeEmail = String(emailChangeDraft || '').trim().toLowerCase();
    if (!safeEmail) {
      toast.error('Escribe el nuevo email.');
      return;
    }

    setRequestingEmailChange(true);
    try {
      const response = await authFetch('/account/email-change/request', {
        method: 'POST',
        body: JSON.stringify({ email: safeEmail }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo enviar el codigo.');
      }

      setEmailChangeRequested(true);
      toast.success('Codigo enviado al nuevo email.');
    } catch (error) {
      toast.error(error?.message || 'No se pudo enviar el codigo.');
    } finally {
      setRequestingEmailChange(false);
    }
  };

  const confirmEmailChange = async () => {
    const safeEmail = String(emailChangeDraft || '').trim().toLowerCase();
    const safeCode = String(emailChangeCode || '').trim();
    if (!safeEmail || !safeCode) {
      toast.error('Escribe el email y el codigo.');
      return;
    }

    setConfirmingEmailChange(true);
    try {
      const response = await authFetch('/account/email-change/confirm', {
        method: 'POST',
        body: JSON.stringify({ email: safeEmail, code: safeCode }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo confirmar el cambio.');
      }

      if (body?.token) localStorage.setItem('authToken', body.token);
      localStorage.setItem('userEmail', body?.email || safeEmail);
      setAccountEmail(body?.email || safeEmail);
      setEmailChangeDraft('');
      setEmailChangeCode('');
      setEmailChangeRequested(false);
      setPendingEmailReview(null);
      sessionStorage.removeItem('pendingEmailReview');
      onDataChange?.();
      toast.success('Email actualizado.');
    } catch (error) {
      toast.error(error?.message || 'No se pudo confirmar el cambio.');
    } finally {
      setConfirmingEmailChange(false);
    }
  };

  const deactivateOwnAccount = async () => {
    const confirmed = window.confirm(
      'Quieres desactivar tu cuenta? Se cerraran las sesiones y tendras que volver a vincular tus numeros si ingresas otra vez.',
    );
    if (!confirmed) return;

    setDeactivatingAccount(true);
    try {
      const response = await authFetch('/account/deactivate', {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo desactivar la cuenta.');
      }

      toast.success('Cuenta desactivada. Se cerrara la sesion.');
      onUnauthorized?.();
    } catch (error) {
      toast.error(error?.message || 'No se pudo desactivar la cuenta.');
    } finally {
      setDeactivatingAccount(false);
    }
  };

  const continueWithCurrentEmail = () => {
    sessionStorage.removeItem('pendingEmailReview');
    setPendingEmailReview(null);
    setShowEmailReviewPrompt(false);
    setEmailChangeDraft('');
    setEmailChangeCode('');
    setEmailChangeRequested(false);
  };

  return (
    <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-right-4">
      {pendingEmailReview && showEmailReviewPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Este numero ya tenia una cuenta
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  El numero esta asociado a {pendingEmailReview.maskedCurrentEmail || 'otro email'}.
                  Puedes seguir usando esa cuenta o cambiar el email a {pendingEmailReview.requestedEmail}.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={continueWithCurrentEmail}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Seguir con cuenta actual
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsSection('general');
                  setShowEmailReviewPrompt(false);
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Cambiar email
              </button>
            </div>
          </div>
        </div>
      )}

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
                        className={`w-full text-left rounded-xl border px-3.5 py-3 transition-all duration-150 flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${isActive
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
          {currentSettingsSectionId === '__legacy_general__' && (
            <div className="space-y-5">
              <div className="bg-white dark:bg-gray-900/90 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('standalone.settings.general_whatsapp_title') || 'General por WhatsApp'}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('standalone.settings.general_whatsapp_desc') || 'Configura comportamiento, alertas, tags y keywords de cada WhatsApp conectado.'}
                </p>
              </div>

              {locationSlots.length === 0 && (
                <div className="bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t('standalone.settings.no_whatsapp_available') || 'No hay WhatsApp disponibles para configurar en esta cuenta.'}
                </div>
              )}

              {locationSlots.map((slot) => {
                const slotId = slot.slot_id;
                const settings = slot.settings || {};
                const slotKeywords = keywordsBySlotId.get(slotId) || [];
                const currentPrio = Number.parseInt(String(slot.priority || 1), 10) || 1;

                return (
                  <div
                    key={`general-slot-${slotId}`}
                    className="bg-white dark:bg-gray-900/90 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">
                        {slot.slot_name || `WhatsApp ${slotId}`}
                      </h4>
                      <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                        {slot.is_connected ? 'Conectado' : 'Desconectado'}
                      </span>
                    </div>

                    {isGhlMode && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                          Orden de envío
                        </label>
                        <select
                          value={currentPrio}
                          onChange={(event) => changeSlotPriority(slotId, event.target.value)}
                          className="w-full max-w-[220px] p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {Array.from({ length: Math.max(locationSlots.length, currentPrio) }, (_, index) => index + 1).map((priority) => (
                            <option key={priority} value={priority}>
                              {priority} {priority === 1 ? '(Alta)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="rounded-xl border border-gray-200 dark:border-gray-800">
                      <SettingsSwitchRow
                        label={t('slots.settings.source_label') || 'Etiqueta de origen'}
                        description={t('slots.settings.source_desc') || 'Muestra desde qué canal llegó la conversación.'}
                        checked={settings.show_source_label ?? true}
                        onChange={() => toggleSlotSetting(slotId, 'show_source_label', settings)}
                      />
                      <SettingsSwitchRow
                        label={t('slots.settings.transcribe') || 'Transcribir audios'}
                        description={t('slots.settings.transcribe_desc') || 'Convierte audios en texto para automatizaciones.'}
                        checked={settings.transcribe_audio ?? true}
                        onChange={() => toggleSlotSetting(slotId, 'transcribe_audio', settings)}
                      />
                      <SettingsSwitchRow
                        label={t('slots.settings.create_contacts') || 'Crear contactos nuevos'}
                        description={t('slots.settings.create_contacts_desc') || 'Crea contactos automáticamente cuando no existen.'}
                        checked={settings.create_unknown_contacts ?? true}
                        onChange={() => toggleSlotSetting(slotId, 'create_unknown_contacts', settings)}
                      />
                      <SettingsSwitchRow
                        label={t('slots.settings.alert_disconnect') || 'Avisar si se desconecta'}
                        description={t('slots.settings.alert_disconnect_desc') || 'Envía una alerta cuando este WhatsApp se desconecta.'}
                        checked={settings.send_disconnect_message ?? true}
                        onChange={() => toggleSlotSetting(slotId, 'send_disconnect_message', settings)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                          Número de alerta
                        </label>
                        <input
                          type="text"
                          defaultValue={String(settings.alert_phone_number || '')}
                          placeholder="+1 555 000 0000"
                          onBlur={(event) => changeSlotSetting(slotId, 'alert_phone_number', event.target.value, settings)}
                          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                          Tag automático
                        </label>
                        <input
                          type="text"
                          defaultValue={String(settings.crm_contact_tag || settings.ghl_contact_tag || '')}
                          placeholder="lead_whatsapp"
                          onBlur={(event) => changeSlotSetting(slotId, 'crm_contact_tag', event.target.value, settings)}
                          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-sm font-bold text-gray-900 dark:text-white">{t('standalone.settings.keywords_title') || 'Keywords'}</h5>
                      <form onSubmit={(event) => handleAddKeyword(event, slotId)} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input
                          name="keyword"
                          placeholder={t('agency.keyword_name') || 'Keyword'}
                          required
                          className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                          name="tag"
                          placeholder={t('agency.keyword_tag') || 'Tag'}
                          required
                          className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
                        >
                          <Plus size={14} /> Guardar regla
                        </button>
                      </form>
                      <div className="space-y-2">
                        {slotKeywords.map((keyword) => (
                          <div
                            key={keyword.id}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800"
                          >
                            <div className="text-sm">
                              <span className="font-semibold text-gray-900 dark:text-white">{keyword.keyword}</span>
                              <span className="text-gray-500 dark:text-gray-400"> → {keyword.tag}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteKeyword(keyword.id)}
                              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                        {slotKeywords.length === 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Sin reglas para este WhatsApp.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {false && currentSettingsSectionId === '__legacy_integrations__' && (
            <div className="bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-5">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <MessageSquareText size={22} className="text-indigo-500" />
                      {t('standalone.settings.whatsapp_title') || 'Waflow WhatsApp'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {t('standalone.settings.whatsapp_desc') ||
                        'Define el Usuario Maestro para aprovisionar cuentas Waflow WhatsApp automáticamente.'}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${inboxConfigured
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                      }`}
                  >
                    {inboxConfigured
                      ? (t('standalone.settings.master_user_ready') || 'Usuario maestro configurado')
                      : (t('standalone.settings.master_user_pending') || 'Pendiente de configuración')}
                  </span>
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
                        {t('dash.chatwoot_master.verify_password') || 'Contraseña actual para verificar cambios'}
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
                          'Antes de guardar cambios, verifica con la contraseña actual del Usuario Maestro.'}
                      </p>
                    </div>
                  )}

                  <div className="xl:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                      {inboxConfigured
                        ? (t('dash.chatwoot_master.new_password') || 'Nueva contraseña del Usuario Maestro')
                        : (t('dash.chatwoot_master.password') || 'Contraseña del Usuario Maestro')}
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
                      {t('dash.chatwoot_master.test_button') || 'Probar conexión'}
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
                      className={`xl:col-span-2 text-[11px] ${inboxTestStatus.ok
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                        }`}
                    >
                      {inboxTestStatus.message}
                    </p>
                  )}
                </form>
              </div>

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
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${openAiKeyConfigured
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

              {locationSlots.map((slot) => {
                const slotId = slot.slot_id;
                const slotName = slot.slot_name || `WhatsApp ${slotId}`;
                const proxyConfig = proxyConfigBySlot[slotId] || {
                  configured: false,
                  host: '',
                  port: '',
                  username: '',
                  password: '',
                  passwordMasked: '',
                  hasPassword: false,
                  protocol: 'http',
                };
                const loadingProxy = !!loadingProxyBySlot[slotId];
                const savingProxy = !!savingProxyBySlot[slotId];
                const loadingVoices = !!loadingElevenVoicesBySlot[slotId];
                const draftEleven = elevenKeyDraftBySlot[slotId] ?? '';
                const voices = elevenVoicesBySlot[slotId] || [];

                return (
                  <div
                    key={`integrations-slot-${slotId}`}
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-5"
                  >
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">{slotName}</h4>

                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5 className="text-sm font-bold text-gray-900 dark:text-white">{t('standalone.settings.elevenlabs_title') || 'ElevenLabs'}</h5>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Configura API key y voz por defecto para este WhatsApp.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                        <input
                          type="password"
                          value={draftEleven}
                          onChange={(event) =>
                            setElevenKeyDraftBySlot((prev) => ({ ...prev, [slotId]: event.target.value }))
                          }
                          placeholder={slot.elevenlabs_api_key ? '••••••••••••••••' : 'sk_...'}
                          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await saveElevenApiKey(slotId, draftEleven);
                            if (ok) {
                              setElevenKeyDraftBySlot((prev) => ({ ...prev, [slotId]: '' }));
                            }
                          }}
                          className="px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
                        >
                          Guardar key
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await saveElevenApiKey(slotId, '');
                            setElevenKeyDraftBySlot((prev) => ({ ...prev, [slotId]: '' }));
                          }}
                          className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                        >
                          Limpiar
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                        <select
                          value={slot.elevenlabs_voice_id || ''}
                          disabled={!slot.elevenlabs_api_key}
                          onChange={(event) => saveElevenVoice(slotId, event.target.value)}
                          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                        >
                          <option value="">
                            {slot.elevenlabs_api_key ? 'Sin voz por defecto' : 'Configura primero la API key'}
                          </option>
                          {slot.elevenlabs_voice_id && !voices.some((voice) => voice.id === slot.elevenlabs_voice_id) && (
                            <option value={slot.elevenlabs_voice_id}>Voz actual ({slot.elevenlabs_voice_id})</option>
                          )}
                          {voices.map((voice) => (
                            <option key={voice.id} value={voice.id}>
                              {voice.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={loadingVoices || !slot.elevenlabs_api_key}
                          onClick={() => loadElevenVoices(slotId, true)}
                          className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-60 inline-flex items-center gap-2 justify-center"
                        >
                          <RefreshCw size={14} className={loadingVoices ? 'animate-spin' : ''} />
                          Actualizar voces
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                            Proxy personalizado
                          </h5>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Define proxy por WhatsApp para enrutar conexiones salientes.
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${proxyConfig.configured ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                          {proxyConfig.configured ? 'Configurado' : 'Sin configurar'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={proxyConfig.host || ''}
                          onChange={(event) => updateProxyField(slotId, 'host', event.target.value)}
                          placeholder="Host"
                          className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                          type="number"
                          value={proxyConfig.port || ''}
                          onChange={(event) => updateProxyField(slotId, 'port', event.target.value)}
                          placeholder="Port"
                          className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          value={proxyConfig.username || ''}
                          onChange={(event) => updateProxyField(slotId, 'username', event.target.value)}
                          placeholder="Username"
                          className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                          type="password"
                          value={proxyConfig.password || ''}
                          onChange={(event) => updateProxyField(slotId, 'password', event.target.value)}
                          placeholder={proxyConfig.passwordMasked || 'Password'}
                          className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <select
                        value={proxyConfig.protocol || 'http'}
                        onChange={(event) => updateProxyField(slotId, 'protocol', event.target.value)}
                        className="w-full max-w-[180px] px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="http">http</option>
                        <option value="socks5">socks5</option>
                      </select>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={loadingProxy || savingProxy}
                          onClick={() => saveProxyConfig(slotId)}
                          className="px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-60"
                        >
                          Guardar proxy
                        </button>
                        <button
                          type="button"
                          disabled={loadingProxy || savingProxy || !proxyConfig.configured}
                          onClick={() => clearProxyConfig(slotId)}
                          className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-60"
                        >
                          Limpiar proxy
                        </button>
                        <button
                          type="button"
                          disabled={loadingProxy || savingProxy}
                          onClick={() => loadProxyConfig(slotId, true)}
                          className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-60 inline-flex items-center gap-2"
                        >
                          <RefreshCw size={14} className={loadingProxy ? 'animate-spin' : ''} />
                          Recargar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {currentSettingsSectionId === 'general' && (
            <div className="space-y-5">
              <div className="bg-white dark:bg-gray-900/90 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('standalone.settings.general_account_title') || 'Configuración general de la cuenta'}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('standalone.settings.general_account_desc') || 'Estos ajustes se aplican a toda la cuenta y a todos los números conectados.'}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900/90 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-5">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">Informacion de cuenta</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Administra el nombre visible, el email de acceso y la desactivacion de la cuenta.
                  </p>
                </div>

                {pendingEmailReview && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold">Este numero ya tenia una cuenta.</p>
                        <p className="mt-1 leading-6">
                          La cuenta actual esta asociada a {pendingEmailReview.maskedCurrentEmail || 'otro email'}.
                          Para cambiarla a {pendingEmailReview.requestedEmail}, solicita el codigo y confirma el cambio.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-4">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                      <User size={16} /> Nombre
                    </label>
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={accountNameDraft}
                        onChange={(event) => setAccountNameDraft(event.target.value)}
                        className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 text-sm text-gray-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <button
                        type="button"
                        onClick={saveAccountName}
                        disabled={savingAccountName}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {savingAccountName ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Guardar
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-4">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                      <Mail size={16} /> Email
                    </label>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Actual: <span className="font-semibold text-gray-700 dark:text-gray-200">{accountEmail || 'Sin email'}</span>
                    </p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <input
                        type="email"
                        value={emailChangeDraft}
                        onChange={(event) => setEmailChangeDraft(event.target.value)}
                        placeholder="nuevo@email.com"
                        className="h-11 min-w-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 text-sm text-gray-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <button
                        type="button"
                        onClick={requestEmailChange}
                        disabled={requestingEmailChange}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {requestingEmailChange ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        Enviar codigo
                      </button>
                    </div>
                    {(emailChangeRequested || pendingEmailReview) && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-[160px_auto] gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={emailChangeCode}
                          onChange={(event) => setEmailChangeCode(event.target.value)}
                          placeholder="Codigo"
                          className="h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 text-sm text-gray-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button
                          type="button"
                          onClick={confirmEmailChange}
                          disabled={confirmingEmailChange}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {confirmingEmailChange ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                          Confirmar cambio
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white/60 p-3 dark:border-gray-800 dark:bg-gray-900/40">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Desactivar cuenta</h5>
                      <p className="mt-0.5 max-w-2xl text-xs leading-5 text-gray-500 dark:text-gray-500">
                        Se cerraran las sesiones, se desvincularan los numeros y la cuenta quedara reservada para evitar trials duplicados.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={deactivateOwnAccount}
                      disabled={deactivatingAccount}
                      className="inline-flex items-center justify-center gap-1.5 self-start rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-60 dark:border-gray-700 dark:text-red-300 dark:hover:border-red-900/70 dark:hover:bg-red-950/20 sm:self-center"
                    >
                      {deactivatingAccount ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Desactivar
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900/90 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-4">
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-900 dark:text-white">
                        {t('standalone.settings.alert_phone_label') || 'Número de alerta'}
                      </label>

                      <p className="mt-1 max-w-sm text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        {t('standalone.settings.alert_phone_desc') || 'Define el número al que se enviarán las notificaciones del sistema.'}
                      </p>
                    </div>

                    <input
                      type="text"
                      value={String(standaloneGlobal?.general?.alert_phone_number || '')}
                      onChange={(event) =>
                        setStandaloneGlobal((prev) => ({
                          ...(prev || {}),
                          general: {
                            ...(prev?.general || {}),
                            alert_phone_number: event.target.value,
                          },
                        }))
                      }
                      placeholder="+1 555 000 0000"
                      className="h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 text-sm text-gray-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-4">
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-900 dark:text-white">
                        {t('standalone.settings.auto_tag_label') || 'Tag automático'}
                      </label>

                      <p className="mt-1 max-w-sm text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        {t('standalone.settings.auto_tag_desc') || 'Se asignará automáticamente a los nuevos contactos que ingresen por WhatsApp.'}
                      </p>
                    </div>

                    <input
                      type="text"
                      value={String(standaloneGlobal?.general?.crm_contact_tag || '')}
                      onChange={(event) =>
                        setStandaloneGlobal((prev) => ({
                          ...(prev || {}),
                          general: {
                            ...(prev?.general || {}),
                            crm_contact_tag: event.target.value,
                          },
                        }))
                      }
                      placeholder="lead_whatsapp"
                      className="h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 text-sm text-gray-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveStandaloneGlobalGeneral}
                    disabled={savingGlobalGeneral}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition disabled:opacity-60"
                  >
                    {savingGlobalGeneral ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {t('standalone.settings.general_save_button') || 'Guardar configuración general'}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900/90 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">{t('standalone.settings.global_tags_title') || 'Etiquetas globales'}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('standalone.settings.global_tags_desc') || 'Estas reglas se aplican a todos los números de la cuenta.'}
                  </p>
                </div>

                <form onSubmit={handleAddGlobalKeyword} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    name="keyword"
                    placeholder={t('agency.keyword_name') || 'Keyword'}
                    required
                    className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    name="tag"
                    placeholder={t('agency.keyword_tag') || 'Tag'}
                    required
                    className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
                  >
                    <Plus size={14} /> Guardar regla
                  </button>
                </form>

                <div className="space-y-2">
                  {globalKeywords.map((keyword) => (
                    <div
                      key={keyword.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800"
                    >
                      <div className="text-sm">
                        <span className="font-semibold text-gray-900 dark:text-white">{keyword.keyword}</span>
                        <span className="text-gray-500 dark:text-gray-400"> {'->'} {keyword.tag}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteGlobalKeyword(keyword.id)}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {globalKeywords.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Sin reglas globales cargadas todavía.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentSettingsSectionId === 'integrations' && (
            <div className="bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-5">
              {false && (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <MessageSquareText size={22} className="text-indigo-500" />
                        {t('standalone.settings.whatsapp_title') || 'Waflow WhatsApp'}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t('standalone.settings.whatsapp_desc') ||
                          'Define el Usuario Maestro para aprovisionar cuentas Waflow WhatsApp automáticamente.'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${inboxConfigured
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                        }`}
                    >
                      {inboxConfigured
                        ? (t('standalone.settings.master_user_ready') || 'Usuario maestro configurado')
                        : (t('standalone.settings.master_user_pending') || 'Pendiente de configuración')}
                    </span>
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
                          {t('dash.chatwoot_master.verify_password') || 'Contraseña actual para verificar cambios'}
                        </label>
                        <input
                          type="password"
                          value={inboxVerificationPassword}
                          onChange={(event) => setInboxVerificationPassword(event.target.value)}
                          placeholder="********"
                          autoComplete="current-password"
                          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    <div className="xl:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                        {inboxConfigured
                          ? (t('dash.chatwoot_master.new_password') || 'Nueva contraseña del Usuario Maestro')
                          : (t('dash.chatwoot_master.password') || 'Contraseña del Usuario Maestro')}
                      </label>
                      <input
                        type="password"
                        value={inboxPassword}
                        onChange={(event) => setInboxPassword(event.target.value)}
                        placeholder="********"
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
                        {t('dash.chatwoot_master.test_button') || 'Probar conexión'}
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
                        className={`xl:col-span-2 text-[11px] ${inboxTestStatus.ok
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

              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-5">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">{t('standalone.settings.openai_title') || 'OpenAI'}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    API key global de la cuenta para automatizaciones y agentes.
                  </p>
                </div>
                <div className="space-y-2">
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

              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-5">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">{t('standalone.settings.elevenlabs_title') || 'ElevenLabs'}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Configuración global para toda la cuenta.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                  <input
                    type="password"
                    value={String(standaloneGlobal?.integrations?.elevenlabs_api_key || '')}
                    onChange={(event) =>
                      setStandaloneGlobal((prev) => ({
                        ...(prev || {}),
                        integrations: {
                          ...(prev?.integrations || {}),
                          elevenlabs_api_key: event.target.value,
                        },
                      }))
                    }
                    placeholder="sk_..."
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={saveStandaloneGlobalIntegrations}
                    disabled={savingGlobalIntegrations}
                    className="px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-60"
                  >
                    Guardar key
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setStandaloneGlobal((prev) => ({
                        ...(prev || {}),
                        integrations: {
                          ...(prev?.integrations || {}),
                          elevenlabs_api_key: '',
                          elevenlabs_voice_id: '',
                        },
                      }))
                    }
                    className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    Limpiar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                  <select
                    value={String(standaloneGlobal?.integrations?.elevenlabs_voice_id || '')}
                    disabled={!standaloneGlobal?.integrations?.elevenlabs_api_key}
                    onChange={(event) =>
                      setStandaloneGlobal((prev) => ({
                        ...(prev || {}),
                        integrations: {
                          ...(prev?.integrations || {}),
                          elevenlabs_voice_id: event.target.value,
                        },
                      }))
                    }
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  >
                    <option value="">
                      {standaloneGlobal?.integrations?.elevenlabs_api_key
                        ? 'Sin voz por defecto'
                        : 'Configura primero la API key'}
                    </option>
                    {globalVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={loadingGlobalVoices || !standaloneGlobal?.integrations?.elevenlabs_api_key}
                    onClick={() => loadGlobalElevenVoices(true)}
                    className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-60 inline-flex items-center gap-2 justify-center"
                  >
                    <RefreshCw size={14} className={loadingGlobalVoices ? 'animate-spin' : ''} />
                    Actualizar voces
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">{t('standalone.settings.proxy_title') || 'Proxy personalizado'}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Configuración global de proxy para toda la cuenta.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={globalProxyDraft.host || ''}
                    onChange={(event) => setGlobalProxyDraft((prev) => ({ ...prev, host: event.target.value }))}
                    placeholder="Host"
                    className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="number"
                    value={globalProxyDraft.port || ''}
                    onChange={(event) => setGlobalProxyDraft((prev) => ({ ...prev, port: event.target.value }))}
                    placeholder="Port"
                    className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    value={globalProxyDraft.username || ''}
                    onChange={(event) => setGlobalProxyDraft((prev) => ({ ...prev, username: event.target.value }))}
                    placeholder="Username"
                    className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="password"
                    value={globalProxyDraft.password || ''}
                    onChange={(event) => setGlobalProxyDraft((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Password"
                    className="px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={globalProxyDraft.protocol || 'http'}
                  onChange={(event) => setGlobalProxyDraft((prev) => ({ ...prev, protocol: event.target.value }))}
                  className="w-full max-w-[180px] px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="http">http</option>
                  <option value="socks5">socks5</option>
                </select>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveStandaloneGlobalIntegrations}
                    disabled={savingGlobalIntegrations}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition disabled:opacity-60"
                  >
                    {savingGlobalIntegrations ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {t('standalone.settings.integrations_save_button') || 'Guardar integraciones globales'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentSettingsSectionId === 'developer' && (
            <div className="bg-white dark:bg-gray-900/90 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-right-4">
              {!canUseDevTools ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-900/20 p-5">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                    {t('standalone.layout.upgrade_modal.title') || 'Sube de nivel'}
                  </h4>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {t('standalone.settings.dev_locked') || 'Las herramientas de desarrollador están disponibles desde el plan Flow.'}
                  </p>
                  <button
                    type="button"
                    onClick={onGoToBilling}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition"
                  >
                    {t('standalone.layout.upgrade_modal.cta') || 'Mejorar mi plan ahora'}
                  </button>
                </div>
              ) : (
                <>
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
                          <th className="pb-3 text-right">{t('common.action') || 'Acción'}</th>
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
                          <th className="pb-3">{t('standalone.settings.url') || 'URL'}</th>
                          <th className="pb-3 text-right">{t('common.action') || 'Acción'}</th>
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
                </>
              )}
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
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('standalone.settings.url') || 'URL'}</label>
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
                          <div className="text-sm font-bold dark:text-white">{t('standalone.settings.webhook_inbound') || 'Inbound Message'}</div>
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
                          <div className="text-sm font-bold dark:text-white">{t('standalone.settings.webhook_outbound') || 'Outbound Message'}</div>
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

function SettingsSwitchRow({ label, description, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="w-full flex items-center justify-between gap-4 px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition border-b border-gray-200 dark:border-gray-800 last:border-b-0"
    >
      <span className="text-left">
        <span className="block text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</span>
      </span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-6' : 'translate-x-1'
            }`}
        />
      </span>
    </button>
  );
}
