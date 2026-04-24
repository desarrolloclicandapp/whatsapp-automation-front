import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CreditCard,
  Hammer,
  LayoutGrid,
  LifeBuoy,
  Loader2,
  LogOut,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage } from '../context/LanguageContext';
import { useBranding } from '../context/BrandingContext';
import StandaloneDashboard from './StandaloneDashboard';
import StandaloneSubscription from './StandaloneSubscription';
import StandaloneAgents from './StandaloneAgents';
import StandaloneSettings from './StandaloneSettings';
import StandaloneMessageBuilder from './StandaloneMessageBuilder';
import useStandaloneWorkspace from './useStandaloneWorkspace';
import { translateOr } from './i18n';

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '34611770270';

export default function StandaloneLayout({
  onLogout,
  onUnauthorized,
  token,
  onDataChange,
}) {
  const { t } = useLanguage();
  const { branding } = useBranding();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = String(params.get('tab') || '').trim().toLowerCase();
    return ['overview', 'billing', 'agents', 'settings', 'builder'].includes(requestedTab)
      ? requestedTab
      : 'overview';
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCrmRequestModal, setShowCrmRequestModal] = useState(false);
  const [liveIsWhatsAppConnected, setLiveIsWhatsAppConnected] = useState(false);
  const [crmRequestName, setCrmRequestName] = useState('');
  const [crmRequestEmail, setCrmRequestEmail] = useState('');
  const [crmRequestPhone, setCrmRequestPhone] = useState('');
  const [crmRequestNotes, setCrmRequestNotes] = useState('');
  const [crmRequestLoading, setCrmRequestLoading] = useState(false);

  const {
    accountInfo,
    primaryLocation,
    primaryLocationId,
    locationDetails,
    chatwootAccessInfo,
    ghlAccessInfo,
    isWhatsAppConnected,
    loading,
    planType,
    refreshWorkspace,
    authFetch,
  } = useStandaloneWorkspace({
    token,
    onUnauthorized: onUnauthorized || onLogout,
  });

  const showsMessagingProduct = planType === 'trial' || planType === 'starter';
  const effectiveIsWhatsAppConnected = liveIsWhatsAppConnected || isWhatsAppConnected;

  const effectiveCrmType = useMemo(
    () =>
      String(
        locationDetails?.crmType || primaryLocation?.settings?.crm_type || accountInfo?.crm_type || 'chatwoot',
      )
        .trim()
        .toLowerCase(),
    [locationDetails, primaryLocation, accountInfo],
  );

  useEffect(() => {
    setLiveIsWhatsAppConnected(isWhatsAppConnected);
  }, [isWhatsAppConnected]);

  useEffect(() => {
    setCrmRequestName(String(accountInfo?.name || '').trim());
    setCrmRequestEmail(String(accountInfo?.email || '').trim());
  }, [accountInfo]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeTab === 'overview') params.delete('tab');
    else params.set('tab', activeTab);

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState({}, document.title, nextUrl);
  }, [activeTab]);

  const handleLogout = () => {
    onLogout?.();
  };

  const handleWorkspaceRefresh = () => {
    refreshWorkspace();
    onDataChange?.();
  };

  const resolvePreferredSlotId = (requestedSlotId = null) => {
    const safeRequested = Number.parseInt(String(requestedSlotId || ''), 10);
    if (Number.isFinite(safeRequested) && safeRequested > 0) return safeRequested;

    const slots = Array.isArray(locationDetails?.slots) ? locationDetails.slots : [];
    if (!slots.length) return null;

    const sortedSlots = [...slots].sort((a, b) => {
      const aPriority = Number.parseInt(String(a?.priority || 9999), 10);
      const bPriority = Number.parseInt(String(b?.priority || 9999), 10);
      if (aPriority !== bPriority) return aPriority - bPriority;
      return Number.parseInt(String(a?.slot_id || 0), 10) - Number.parseInt(String(b?.slot_id || 0), 10);
    });

    const connected = sortedSlots.find((slot) => slot?.is_connected === true);
    return Number.parseInt(String((connected || sortedSlots[0])?.slot_id || ''), 10) || null;
  };

  const openInbox = async (requestedSlotId = null) => {
    const preferredSlotId = resolvePreferredSlotId(requestedSlotId);
    if (effectiveCrmType !== 'ghl' && primaryLocationId && preferredSlotId) {
      try {
        await authFetch('/agency/chatwoot/seed-welcome', {
          method: 'POST',
          body: JSON.stringify({
            locationId: primaryLocationId,
            slotId: preferredSlotId,
          }),
        });
      } catch (_) {
        // Se continúa con apertura directa aunque falle el contexto previo.
      }
    }

    let directUrl = null;
    if (effectiveCrmType === 'ghl') {
      try {
        const res = await authFetch(`/agency/ghl/access-info?locationId=${encodeURIComponent(primaryLocationId || '')}`);
        const live = res.ok ? await res.json().catch(() => null) : null;
        directUrl =
          live?.ghl?.dashboardUrl ||
          live?.ghl?.loginUrl ||
          ghlAccessInfo?.ghl?.dashboardUrl ||
          ghlAccessInfo?.ghl?.loginUrl ||
          'https://app.gohighlevel.com';
      } catch {
        directUrl = ghlAccessInfo?.ghl?.dashboardUrl || ghlAccessInfo?.ghl?.loginUrl || 'https://app.gohighlevel.com';
      }
    } else {
      try {
        const res = await authFetch(
          `/agency/chatwoot/access-info?locationId=${encodeURIComponent(primaryLocationId || '')}`,
        );
        const live = res.ok ? await res.json().catch(() => null) : null;
        directUrl =
          live?.chatwoot?.directLoginUrl ||
          live?.chatwoot?.loginUrl ||
          live?.chatwoot?.dashboardUrl ||
          chatwootAccessInfo?.chatwoot?.directLoginUrl ||
          chatwootAccessInfo?.chatwoot?.loginUrl ||
          chatwootAccessInfo?.chatwoot?.dashboardUrl ||
          null;
      } catch {
        directUrl =
          chatwootAccessInfo?.chatwoot?.directLoginUrl ||
          chatwootAccessInfo?.chatwoot?.loginUrl ||
          chatwootAccessInfo?.chatwoot?.dashboardUrl ||
          null;
      }
    }

    if (!directUrl && effectiveCrmType !== 'ghl' && primaryLocationId) {
      try {
        const fallbackRes = await authFetch(
          `/agency/locations/${encodeURIComponent(primaryLocationId)}/chatwoot-access-link`,
        );
        const fallbackBody = fallbackRes.ok ? await fallbackRes.json().catch(() => null) : null;
        directUrl =
          fallbackBody?.directLoginUrl ||
          fallbackBody?.loginUrl ||
          fallbackBody?.chatwoot?.directLoginUrl ||
          fallbackBody?.chatwoot?.loginUrl ||
          null;
      } catch {
        // Se mantiene el flujo normal si no existe fallback disponible.
      }
    }

    if (!directUrl) {
      toast.error(
        translateOr(
          t,
          'standalone.layout.messaging_unavailable',
          'Todavía no hay acceso disponible para Waflow WhatsApp en esta cuenta.',
        ),
      );
      return;
    }

    window.open(directUrl, '_blank', 'noopener,noreferrer');
  };

  const openCrmAccount = () => {
    const directCrmUrl = ghlAccessInfo?.ghl?.dashboardUrl || ghlAccessInfo?.ghl?.loginUrl || null;
    if (!directCrmUrl) {
      setShowCrmRequestModal(true);
      return;
    }
    window.open(directCrmUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSubmitCrmRequest = async (event) => {
    event.preventDefault();
    if (!crmRequestName.trim() || !crmRequestEmail.trim() || !crmRequestPhone.trim()) {
      toast.error(
        translateOr(
          t,
          'standalone.layout.crm_request.required',
          'Completa nombre, email y teléfono para continuar.',
        ),
      );
      return;
    }

    setCrmRequestLoading(true);
    try {
      const response = await authFetch('/agency/ghl/subaccount-request', {
        method: 'POST',
        body: JSON.stringify({
          name: crmRequestName.trim(),
          email: crmRequestEmail.trim(),
          phone: crmRequestPhone.trim(),
          notes: crmRequestNotes.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo enviar la solicitud');
      }
      toast.success(
        payload?.message ||
          translateOr(
            t,
            'standalone.layout.crm_request.success',
            'Solicitud enviada. Te contactaremos para activar tu WaFloW CRM.',
          ),
      );
      setShowCrmRequestModal(false);
      setCrmRequestNotes('');
    } catch (error) {
      toast.error(error?.message || translateOr(t, 'common.error', 'Error inesperado'));
    } finally {
      setCrmRequestLoading(false);
    }
  };

  const handleMessagingShortcut = () => {
    openInbox(null);
  };

  const handleCrmShortcut = () => {
    if (showsMessagingProduct) {
      setShowUpgradeModal(true);
      return;
    }
    openCrmAccount();
  };

  const handleUpgradeRedirect = () => {
    setActiveTab('billing');
    setShowUpgradeModal(false);
  };

  const currentPlan = String(accountInfo?.plan || '').trim().toLowerCase();
  const trialEndsAt = accountInfo?.trial_ends ? new Date(accountInfo.trial_ends) : null;
  const isTrialExpired = currentPlan === 'trial' && trialEndsAt && trialEndsAt < new Date();
  const isPlanBlocked = ['suspended', 'cancelled', 'past_due', 'blocked'].includes(currentPlan) || isTrialExpired;

  const headerTitle =
    activeTab === 'overview'
      ? translateOr(t, 'standalone.layout.header_overview', 'Panel principal')
      : activeTab === 'billing'
        ? translateOr(t, 'standalone.layout.header_billing', 'Suscripción')
        : activeTab === 'agents'
          ? translateOr(t, 'standalone.layout.header_agents', 'Agentes')
          : activeTab === 'builder'
            ? translateOr(t, 'standalone.layout.header_builder', 'Constructor de botones')
            : translateOr(t, 'standalone.layout.header_settings', 'Configuración');

  const renderContent = () => {
    if (loading && !accountInfo) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="animate-spin" />
            <span>{translateOr(t, 'common.loading', 'Cargando...')}</span>
          </div>
        </div>
      );
    }

    if (activeTab === 'overview') {
      return (
        <StandaloneDashboard
          accountInfo={accountInfo}
          primaryLocation={primaryLocation}
          primaryLocationId={primaryLocationId}
          locationDetails={locationDetails}
          onRefresh={handleWorkspaceRefresh}
          onOpenMessagingInbox={openInbox}
          onGoToBilling={() => setActiveTab('billing')}
          onGoToAgents={() => setActiveTab('agents')}
          onRealtimeConnectionChange={setLiveIsWhatsAppConnected}
          token={token}
          onUnauthorized={onUnauthorized || onLogout}
        />
      );
    }

    if (activeTab === 'billing') {
      return (
        <StandaloneSubscription
          token={token}
          accountInfo={accountInfo}
          onDataChange={handleWorkspaceRefresh}
        />
      );
    }

    if (activeTab === 'agents') {
      return (
        <StandaloneAgents
          token={token}
          locationId={primaryLocationId}
          onUnauthorized={onUnauthorized || onLogout}
        />
      );
    }

    if (activeTab === 'settings') {
      return (
        <StandaloneSettings
          token={token}
          accountInfo={accountInfo}
          locationId={primaryLocationId}
          onUnauthorized={onUnauthorized || onLogout}
          onDataChange={handleWorkspaceRefresh}
        />
      );
    }

    if (activeTab === 'builder') return <StandaloneMessageBuilder />;
    return null;
  };

  if (isPlanBlocked) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex items-center justify-end gap-3">
            <LanguageSelector />
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 transition"
            >
              <LogOut size={16} />
              {translateOr(t, 'standalone.layout.logout', 'Cerrar sesión')}
            </button>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-black">
              {translateOr(t, 'sub.blocker.title', 'Tu acceso ha expirado')}
            </h1>
            <p className="text-sm md:text-base text-gray-300">
              {translateOr(
                t,
                'sub.blocker.desc',
                'Selecciona un plan para reactivar tu cuenta. Tus números y ajustes seguirán intactos.',
              )}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-3 md:p-5">
            <StandaloneSubscription
              token={token}
              accountInfo={accountInfo}
              onDataChange={handleWorkspaceRefresh}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex overflow-hidden">
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col z-30`}
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shrink-0 overflow-hidden"
            style={{ backgroundColor: branding?.logoUrl ? 'transparent' : branding?.primaryColor || '#4F46E5' }}
          >
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding?.name || 'Brand'}
                className="w-full h-full object-contain"
                onError={(event) => {
                  event.target.style.display = 'none';
                }}
              />
            ) : (
              <span>{(branding?.name || 'W').charAt(0).toUpperCase()}</span>
            )}
          </div>
          {sidebarOpen && (
            <span className="ml-3 font-bold text-gray-900 dark:text-white tracking-tight truncate">
              {branding?.name || translateOr(t, 'standalone.layout.brand_name', 'Waflow')}
            </span>
          )}
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <p className={`text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2 ${!sidebarOpen && 'hidden'}`}>
            {translateOr(t, 'standalone.layout.management', 'Gestión')}
          </p>

          <SidebarItem
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            id="overview"
            icon={LayoutGrid}
            label={translateOr(t, 'standalone.layout.nav_overview', 'Panel principal')}
            branding={branding}
            sidebarOpen={sidebarOpen}
          />

          {sidebarOpen && (
            <div className="mb-3 mt-1 space-y-2 px-2">
              <button
                type="button"
                onClick={handleMessagingShortcut}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-semibold text-sm bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/40 dark:hover:bg-green-900/30"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${effectiveIsWhatsAppConnected ? 'bg-green-500' : 'bg-amber-400'}`} />
                <span>{translateOr(t, 'standalone.layout.product_messaging', 'Waflow WhatsApp')}</span>
              </button>

              <button
                type="button"
                onClick={handleCrmShortcut}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-semibold text-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40 dark:hover:bg-blue-900/30"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>{translateOr(t, 'standalone.layout.product_crm', 'Waflow CRM')}</span>
              </button>
            </div>
          )}

          <SidebarItem
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            id="billing"
            icon={CreditCard}
            label={translateOr(t, 'standalone.layout.nav_billing', 'Suscripción')}
            branding={branding}
            sidebarOpen={sidebarOpen}
          />
          <SidebarItem
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            id="agents"
            icon={Bot}
            label={translateOr(t, 'standalone.layout.nav_agents', 'Agentes')}
            branding={branding}
            sidebarOpen={sidebarOpen}
          />
          <SidebarItem
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            id="settings"
            icon={Settings}
            label={translateOr(t, 'standalone.layout.nav_settings', 'Configuración')}
            branding={branding}
            sidebarOpen={sidebarOpen}
          />
          <SidebarItem
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            id="builder"
            icon={Hammer}
            label={translateOr(t, 'standalone.layout.nav_builder', 'Constructor de botones')}
            branding={branding}
            sidebarOpen={sidebarOpen}
          />

          <div className="my-6 border-t border-gray-100 dark:border-gray-800" />

          <a
            href={`https://wa.me/${SUPPORT_PHONE}`}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-indigo-900/10"
          >
            <LifeBuoy size={20} />
            {sidebarOpen && <span>{translateOr(t, 'standalone.layout.support', 'Soporte')}</span>}
          </a>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all font-medium text-sm"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>{translateOr(t, 'standalone.layout.logout', 'Cerrar sesión')}</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[#F8FAFC] dark:bg-[#0f1117]">
        <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white capitalize">{headerTitle}</h2>
              {primaryLocation?.name && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {primaryLocation.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector />
            <ThemeToggle />
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs border border-white/20 shadow-sm"
              style={{ backgroundColor: branding?.primaryColor || '#4F46E5' }}
            >
              {String(accountInfo?.name || accountInfo?.email || 'WA')
                .split(/\s+/)
                .map((chunk) => chunk.charAt(0))
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">{renderContent()}</main>
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800">
            <button
              type="button"
              onClick={() => setShowUpgradeModal(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              aria-label={translateOr(t, 'standalone.layout.upgrade_modal.close', 'Cerrar')}
            >
              <X size={18} />
            </button>

            <div className="mb-5">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                <CreditCard size={22} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {translateOr(t, 'standalone.layout.upgrade_modal.title', 'Sube de nivel')}
              </h3>
              <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
                {translateOr(
                  t,
                  'standalone.layout.upgrade_modal.description',
                  'Accede a funciones avanzadas de CRM, automatizaciones de ventas y gestión profesional de leads con Waflow CRM.',
                )}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {translateOr(t, 'standalone.layout.upgrade_modal.close', 'Cerrar')}
              </button>
              <button
                type="button"
                onClick={handleUpgradeRedirect}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-700"
              >
                {translateOr(t, 'standalone.layout.upgrade_modal.cta', 'Mejorar mi plan ahora')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCrmRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSubmitCrmRequest}
            className="relative w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
          >
            <button
              type="button"
              onClick={() => setShowCrmRequestModal(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              aria-label={translateOr(t, 'standalone.layout.crm_request.close', 'Cerrar')}
            >
              <X size={18} />
            </button>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {translateOr(t, 'standalone.layout.crm_request.title', 'Solicitar WaFloW CRM')}
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {translateOr(
                t,
                'standalone.layout.crm_request.description',
                'Completa estos datos y nuestro equipo activará tu cuenta de WaFloW CRM.',
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
              <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300 md:col-span-2">
                <span>{translateOr(t, 'standalone.layout.crm_request.name', 'Nombre del negocio')}</span>
                <input
                  value={crmRequestName}
                  onChange={(event) => setCrmRequestName(event.target.value)}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-950"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                <span>{translateOr(t, 'standalone.layout.crm_request.email', 'Email')}</span>
                <input
                  value={crmRequestEmail}
                  onChange={(event) => setCrmRequestEmail(event.target.value)}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-950"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                <span>{translateOr(t, 'standalone.layout.crm_request.phone', 'Teléfono')}</span>
                <input
                  value={crmRequestPhone}
                  onChange={(event) => setCrmRequestPhone(event.target.value)}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-950"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300 md:col-span-2">
                <span>{translateOr(t, 'standalone.layout.crm_request.notes', 'Notas')}</span>
                <textarea
                  rows={3}
                  value={crmRequestNotes}
                  onChange={(event) => setCrmRequestNotes(event.target.value)}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-950"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowCrmRequestModal(false)}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {translateOr(t, 'common.cancel', 'Cancelar')}
              </button>
              <button
                type="submit"
                disabled={crmRequestLoading}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-700 disabled:opacity-60"
              >
                {crmRequestLoading
                  ? translateOr(t, 'common.saving', 'Guardando...')
                  : translateOr(t, 'standalone.layout.crm_request.submit', 'Enviar solicitud')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const SidebarItem = ({ id, icon: Icon, label, activeTab, setActiveTab, branding, sidebarOpen }) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm mb-1 ${
      activeTab === id
        ? 'font-bold'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`}
    style={
      activeTab === id
        ? {
            color: branding?.primaryColor || '#4F46E5',
            backgroundColor: `${branding?.primaryColor || '#4F46E5'}15`,
          }
        : {}
    }
  >
    <Icon size={20} />
    {sidebarOpen && <span>{label}</span>}
  </button>
);
