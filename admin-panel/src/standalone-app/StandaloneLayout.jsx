import React, { useState } from 'react';
import {
  LayoutGrid,
  CreditCard,
  LifeBuoy,
  LogOut,
  Menu,
  Settings,
  BookOpen,
  Hammer,
  Bot,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage } from '../context/LanguageContext';
import { useBranding } from '../context/BrandingContext';

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '34611770270';

export default function StandaloneLayout({ onLogout }) {
  const { t } = useLanguage();
  const { branding } = useBranding();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    if (typeof onLogout === 'function') {
      onLogout();
    }
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex overflow-hidden">
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col z-30`}
      >
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-center lg:justify-start">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={branding?.name || 'Brand'} className="h-10 w-10 rounded-xl object-cover shadow-sm" />
            ) : (
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: branding?.primaryColor || '#4F46E5' }}
              >
                {(branding?.name || 'W').charAt(0).toUpperCase()}
              </div>
            )}
            {sidebarOpen && (
              <span className="ml-3 font-bold text-gray-900 dark:text-white tracking-tight truncate">
                {branding?.name || (t('standalone.layout.brand_name') || 'Waflow')}
              </span>
            )}
          </div>
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

          <div className="mt-6 space-y-1">
            <a
              href="https://docs.waflow.ai"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-indigo-900/10"
            >
              <BookOpen size={20} />
              {sidebarOpen && <span>{t('standalone.layout.docs') || 'Documentacion'}</span>}
            </a>
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 py-5 flex items-center justify-between shadow-sm">
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
              {t('standalone.layout.profile_initials') || 'ST'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-8 text-gray-500 dark:text-gray-400">
            {t('standalone.layout.current_view') || 'Contenido de la vista'}: {activeTab}
          </div>
        </main>
      </div>
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
