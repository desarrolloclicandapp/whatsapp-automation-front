import React, { useState } from 'react';
import {
  LayoutGrid,
  CreditCard,
  LifeBuoy,
  LogOut,
  Menu,
  Settings,
  Hammer,
  Bot,
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

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '34611770270';

export default function StandaloneLayout({
  onLogout,
  onUnauthorized,
  token,
  accountInfo,
  onDataChange,
  initialPlanType = 'starter',
  initialIsWhatsAppConnected = false,
}) {
  const { t } = useLanguage();
  const { branding } = useBranding();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [planType] = useState(initialPlanType);
  const [isWhatsAppConnected] = useState(initialIsWhatsAppConnected);

  const showsMessagingProduct = planType === 'trial' || planType === 'starter';

  const handleLogout = () => {
    if (typeof onLogout === 'function') {
      onLogout();
    }
  };

  const handleMessagingShortcut = () => {
    if (isWhatsAppConnected) {
      window.open('https://sandbox-inbox.waflow.local', '_blank', 'noopener,noreferrer');
      return;
    }

    toast.info(
      t('standalone.layout.messaging_connect_simulation') ||
        'Simulacion: Abriendo modal de conexion QR...',
    );
  };

  const handleCrmShortcut = () => {
    if (showsMessagingProduct) {
      setShowUpgradeModal(true);
    }
  };

  const handleUpgradeRedirect = () => {
    setActiveTab('billing');
    setShowUpgradeModal(false);
  };

  const headerTitle =
    activeTab === 'overview'
      ? t('standalone.layout.header_overview') || 'Panel Principal'
      : activeTab === 'billing'
        ? t('standalone.layout.header_billing') || 'Suscripcion'
        : activeTab === 'agents'
          ? t('standalone.layout.header_agents') || 'Agentes'
          : activeTab === 'builder'
            ? t('standalone.layout.header_builder') || 'Constructor de botones'
            : t('standalone.layout.header_settings') || 'Configuracion';

  const renderContent = () => {
    if (activeTab === 'overview') {
      return <StandaloneDashboard accountInfo={accountInfo} />;
    }

    if (activeTab === 'billing') {
      return (
        <StandaloneSubscription
          token={token}
          accountInfo={accountInfo}
          onDataChange={onDataChange}
          isChatwootAgency={String(accountInfo?.crm_type || '').toLowerCase() === 'chatwoot'}
        />
      );
    }

    if (activeTab === 'agents') {
      return <StandaloneAgents token={token} onUnauthorized={onUnauthorized || onLogout} />;
    }

    if (activeTab === 'settings') {
      return <StandaloneSettings accountInfo={accountInfo} />;
    }

    if (activeTab === 'builder') {
      return <StandaloneMessageBuilder />;
    }

    return (
      <div className="p-8 text-gray-500 dark:text-gray-400">
        {t('standalone.layout.current_view') || 'Contenido de la vista'}: {activeTab}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex overflow-hidden">
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col z-30`}
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shrink-0 overflow-hidden"
            style={{ backgroundColor: branding?.logoUrl ? 'transparent' : (branding?.primaryColor || '#4F46E5') }}
          >
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding?.name || 'Brand'}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <span>{(branding?.name || 'W').charAt(0).toUpperCase()}</span>
            )}
          </div>
          {sidebarOpen && (
            <span className="ml-3 font-bold text-gray-900 dark:text-white tracking-tight truncate">
              {branding?.name || (t('standalone.layout.brand_name') || 'Waflow')}
            </span>
          )}
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <p className={`text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2 ${!sidebarOpen && 'hidden'}`}>
            {t('standalone.layout.management') || 'Gestion'}
          </p>

          <SidebarItem
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            id="overview"
            icon={LayoutGrid}
            label={t('standalone.layout.nav_overview') || 'Panel Principal'}
            branding={branding}
            sidebarOpen={sidebarOpen}
          />

          {sidebarOpen && (
            <div className="mb-3 mt-1 space-y-2 px-2">
              {showsMessagingProduct && (
                <button
                  type="button"
                  onClick={handleMessagingShortcut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-semibold text-sm bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/40 dark:hover:bg-green-900/30"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                  <span>{t('standalone.layout.product_messaging') || 'WaFloW Mensajeria'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCrmShortcut}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-semibold text-sm bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                <span>{t('standalone.layout.product_crm') || 'WaFloW CRM'}</span>
              </button>
            </div>
          )}

          <SidebarItem
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            id="billing"
            icon={CreditCard}
            label={t('standalone.layout.nav_billing') || 'Suscripcion'}
            branding={branding}
            sidebarOpen={sidebarOpen}
          />
          <SidebarItem
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            id="agents"
            icon={Bot}
            label={t('standalone.layout.nav_agents') || 'Agentes'}
            branding={branding}
            sidebarOpen={sidebarOpen}
          />
          <SidebarItem
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            id="settings"
            icon={Settings}
            label={t('standalone.layout.nav_settings') || 'Configuracion'}
            branding={branding}
            sidebarOpen={sidebarOpen}
          />
          <SidebarItem
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            id="builder"
            icon={Hammer}
            label={t('standalone.layout.nav_builder') || 'Constructor de botones'}
            branding={branding}
            sidebarOpen={sidebarOpen}
          />

          <div className="my-6 border-t border-gray-100 dark:border-gray-800"></div>

          <div className="space-y-1">
            <a
              href={`https://wa.me/${SUPPORT_PHONE}`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-indigo-900/10"
            >
              <LifeBuoy size={20} />
              {sidebarOpen && <span>{t('standalone.layout.support') || 'Soporte'}</span>}
            </a>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all font-medium text-sm"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>{t('standalone.layout.logout') || 'Cerrar sesion'}</span>}
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
            <h2 className="text-lg font-bold text-gray-900 dark:text-white capitalize">{headerTitle}</h2>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector />
            <ThemeToggle />
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs border border-white/20 shadow-sm"
              style={{ backgroundColor: branding?.primaryColor || '#4F46E5' }}
            >
              {t('standalone.layout.profile_initials') || 'AG'}
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
              aria-label={t('standalone.layout.upgrade_modal.close') || 'Cerrar'}
            >
              <X size={18} />
            </button>

            <div className="mb-5">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                <CreditCard size={22} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('standalone.layout.upgrade_modal.title') || 'Sube de nivel'}
              </h3>
              <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
                {t('standalone.layout.upgrade_modal.description') ||
                  'Accede a funciones avanzadas de CRM, automatizaciones de ventas y gestion de leads profesional con WaFloW CRM.'}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {t('standalone.layout.upgrade_modal.close') || 'Cerrar'}
              </button>
              <button
                type="button"
                onClick={handleUpgradeRedirect}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-700"
              >
                {t('standalone.layout.upgrade_modal.cta') || 'Mejorar mi plan ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SidebarItem = ({ id, icon: Icon, label, activeTab, setActiveTab, branding, sidebarOpen }) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm mb-1
            ${activeTab === id ? 'font-bold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}
        `}
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
