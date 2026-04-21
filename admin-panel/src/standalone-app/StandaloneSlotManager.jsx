import React, { useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Edit2,
  Link2,
  Loader2,
  Play,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Save,
  Settings,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';

const OFFICIAL_EMPTY_STATE = {
  businessAccountId: '',
  phoneNumberId: '',
  accessToken: '',
  status: 'draft',
};

const createMockQr = (slotId) =>
  `https://wa.waflow.com/sandbox/qr/${slotId}/${Date.now().toString(36)}`;

export default function StandaloneSlotManager({
  location,
  initialSlots,
  onSlotsChange,
}) {
  const { t } = useLanguage();
  const [slots, setSlots] = useState(() => initialSlots || []);
  const [expandedSlotId, setExpandedSlotId] = useState(initialSlots?.[0]?.slot_id || null);
  const [activeTabBySlot, setActiveTabBySlot] = useState({});
  const [qrLoadingBySlot, setQrLoadingBySlot] = useState({});
  const [officialLoadingBySlot, setOfficialLoadingBySlot] = useState({});

  const connectedCount = useMemo(
    () => slots.filter((slot) => slot.is_connected === true).length,
    [slots],
  );

  const updateSlots = (updater) => {
    setSlots((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (typeof onSlotsChange === 'function') {
        onSlotsChange(next);
      }
      return next;
    });
  };

  const updateSlot = (slotId, changes) => {
    updateSlots((prev) =>
      prev.map((slot) => (slot.slot_id === slotId ? { ...slot, ...changes } : slot)),
    );
  };

  const updateOfficialField = (slotId, field, value) => {
    updateSlots((prev) =>
      prev.map((slot) =>
        slot.slot_id === slotId
          ? {
              ...slot,
              settings: {
                ...slot.settings,
                official_api: {
                  ...(slot.settings?.official_api || OFFICIAL_EMPTY_STATE),
                  [field]: value,
                },
              },
            }
          : slot,
      ),
    );
  };

  const handleAddSlot = () => {
    const nextId = slots.reduce((max, slot) => Math.max(max, Number(slot.slot_id) || 0), 0) + 1;
    const nextSlot = {
      slot_id: nextId,
      slot_name: `Inbox ${nextId}`,
      is_connected: false,
      phone_number: '',
      settings: {
        connection_mode: null,
        official_api: { ...OFFICIAL_EMPTY_STATE },
      },
      health: {
        sent_24h: 0,
        number_quality_level: 'unknown',
      },
    };

    updateSlots((prev) => [...prev, nextSlot]);
    setExpandedSlotId(nextId);
    setActiveTabBySlot((prev) => ({ ...prev, [nextId]: 'general' }));
    toast.info('Accion simulada en Sandbox: nuevo inbox creado');
  };

  const handleDeleteSlot = (slotId) => {
    updateSlots((prev) => prev.filter((slot) => slot.slot_id !== slotId));
    if (expandedSlotId === slotId) {
      setExpandedSlotId(null);
    }
    toast.info('Accion simulada en Sandbox: inbox eliminado');
  };

  const handleRenameSlot = (slotId) => {
    const currentSlot = slots.find((slot) => slot.slot_id === slotId);
    const nextName = window.prompt('Nombre del inbox', currentSlot?.slot_name || `Inbox ${slotId}`);
    if (!nextName) return;
    updateSlot(slotId, { slot_name: nextName });
    toast.info('Accion simulada en Sandbox: nombre actualizado');
  };

  const handleSelectConnectionMode = (slotId, mode) => {
    updateSlots((prev) =>
      prev.map((slot) =>
        slot.slot_id === slotId
          ? {
              ...slot,
              is_connected: false,
              phone_number: '',
              qr: '',
              share_url: '',
              settings: {
                ...slot.settings,
                connection_mode: mode,
                official_api:
                  mode === 'official_api'
                    ? { ...(slot.settings?.official_api || OFFICIAL_EMPTY_STATE) }
                    : { ...OFFICIAL_EMPTY_STATE },
              },
            }
          : slot,
      ),
    );
    setActiveTabBySlot((prev) => ({
      ...prev,
      [slotId]: mode === 'official_api' ? 'official' : 'connection',
    }));
    toast.info(`Accion simulada en Sandbox: tipo de conexion ${mode === 'official_api' ? 'API Oficial' : 'QR'}`);
  };

  const handleStartQr = (slotId) => {
    toast.info('Accion simulada en Sandbox: generando QR');
    setQrLoadingBySlot((prev) => ({ ...prev, [slotId]: true }));

    window.setTimeout(() => {
      const simulatedNumber = `59597${String(slotId).padStart(6, '0')}`;
      updateSlot(slotId, {
        qr: createMockQr(slotId),
        share_url: `https://wa.waflow.com/sandbox/share/${location.location_id}/${slotId}`,
        is_connected: true,
        phone_number: simulatedNumber,
        health: {
          sent_24h: 12 + slotId,
          number_quality_level: 'good',
        },
      });
      setQrLoadingBySlot((prev) => ({ ...prev, [slotId]: false }));
      toast.success('Accion simulada en Sandbox: inbox marcado en linea');
    }, 1200);
  };

  const handleSoftDisconnect = (slotId) => {
    updateSlot(slotId, {
      is_connected: false,
      qr: '',
      suspended_by: 'agency',
    });
    toast.info('Accion simulada en Sandbox: inbox pausado');
  };

  const handleReconnect = (slotId) => {
    updateSlot(slotId, {
      is_connected: true,
      suspended_by: null,
      phone_number:
        slots.find((slot) => slot.slot_id === slotId)?.phone_number || `59597${String(slotId).padStart(6, '0')}`,
    });
    toast.info('Accion simulada en Sandbox: inbox reconectado');
  };

  const handleDisconnect = (slotId) => {
    updateSlot(slotId, {
      is_connected: false,
      qr: '',
      share_url: '',
      phone_number: '',
      suspended_by: null,
      settings: {
        ...(slots.find((slot) => slot.slot_id === slotId)?.settings || {}),
        official_api: { ...OFFICIAL_EMPTY_STATE },
      },
    });
    toast.info('Accion simulada en Sandbox: inbox desconectado');
  };

  const handleSaveOfficial = (slotId) => {
    const slot = slots.find((entry) => entry.slot_id === slotId);
    const official = slot?.settings?.official_api || OFFICIAL_EMPTY_STATE;
    if (!official.businessAccountId || !official.phoneNumberId || !official.accessToken) {
      toast.error('Completa Business Account ID, Phone Number ID y Access Token');
      return;
    }

    setOfficialLoadingBySlot((prev) => ({ ...prev, [slotId]: true }));
    toast.info('Accion simulada en Sandbox: guardando API Oficial');

    window.setTimeout(() => {
      updateSlots((prev) =>
        prev.map((entry) =>
          entry.slot_id === slotId
            ? {
                ...entry,
                is_connected: true,
                phone_number: official.phoneNumberId.slice(-8) || entry.phone_number,
                settings: {
                  ...entry.settings,
                  official_api: {
                    ...official,
                    status: 'verified',
                  },
                },
                health: {
                  sent_24h: 24,
                  number_quality_level: 'good',
                },
              }
            : entry,
        ),
      );
      setOfficialLoadingBySlot((prev) => ({ ...prev, [slotId]: false }));
      toast.success('Accion simulada en Sandbox: API Oficial validada');
    }, 900);
  };

  const handleClearOfficial = (slotId) => {
    updateSlots((prev) =>
      prev.map((slot) =>
        slot.slot_id === slotId
          ? {
              ...slot,
              is_connected: false,
              phone_number: '',
              settings: {
                ...slot.settings,
                official_api: { ...OFFICIAL_EMPTY_STATE },
              },
            }
          : slot,
      ),
    );
    toast.info('Accion simulada en Sandbox: configuracion oficial limpiada');
  };

  const handleCopyShareUrl = async (shareUrl) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('common.copied') || 'Copiado');
    } catch {
      toast.error(t('slots.chatwoot.copy_error') || 'No se pudo copiar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Inbox Activos
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestiona directamente tus conexiones e inboxes desde esta vista, sin modales intermedios.
          </p>
        </div>
        <button
          onClick={handleAddSlot}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition transform hover:-translate-y-0.5 active:scale-95"
        >
          <Plus size={18} /> {t('slots.chatwoot_inbox.new') || 'Nuevo Inbox'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            {t('agency.reliability.online_slots') || 'Slots en linea'}
          </p>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
            {connectedCount}/{slots.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            {t('agency.reliability.sent_24h') || 'Enviados 24h'}
          </p>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
            {slots.reduce((sum, slot) => sum + Number(slot?.health?.sent_24h || 0), 0)}
          </p>
        </div>
      </div>

      {slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900/50">
          <Smartphone className="text-gray-300 dark:text-gray-600 w-16 h-16 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">
            {t('slots.empty') || 'Todavia no tienes inboxes'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {slots.map((slot) => {
            const isExpanded = expandedSlotId === slot.slot_id;
            const connectionMode = slot?.settings?.connection_mode || null;
            const official = slot?.settings?.official_api || OFFICIAL_EMPTY_STATE;
            const isOfficialConnected =
              connectionMode === 'official_api' &&
              ['verified', 'verified_warning', 'active', 'connected'].includes(
                String(official.status || '').toLowerCase(),
              );
            const isConnected = connectionMode === 'official_api' ? isOfficialConnected : slot.is_connected === true;
            const connectedPhone =
              connectionMode === 'official_api'
                ? String(official.phoneNumberId || slot.phone_number || '').trim()
                : String(slot.phone_number || '').trim();
            const activeTab = activeTabBySlot[slot.slot_id] || 'general';

            return (
              <div
                id={`slot-card-${slot.slot_id}`}
                key={slot.slot_id}
                className={`bg-white dark:bg-gray-900 border rounded-2xl transition-all duration-300 overflow-hidden ${
                  isExpanded
                    ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-xl'
                    : 'border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md'
                }`}
              >
                <div
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => setExpandedSlotId(isExpanded ? null : slot.slot_id)}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900 dark:text-white text-xl">
                          {slot.slot_name || `Inbox ${slot.slot_id}`}
                        </h3>
                        <div className="flex gap-1">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRenameSlot(slot.slot_id);
                            }}
                            className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1 flex items-center gap-2">
                        {isConnected && connectedPhone ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            +{connectedPhone}
                          </span>
                        ) : connectionMode === 'official_api' && official.status && official.status !== 'draft' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            Meta API validada
                          </span>
                        ) : (
                          t('slots.card.disconnected') || 'Desconectado'
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                          {(t('agency.reliability.sent_24h') || 'Enviados 24h')}: {Number(slot?.health?.sent_24h || 0)}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          isConnected
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                        }`}>
                          {isConnected ? 'En linea' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide transition-colors ${
                      isExpanded
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {connectionMode === 'official_api'
                        ? 'Meta API'
                        : connectionMode === 'qr'
                          ? 'QR'
                          : 'Configurar'}
                    </span>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteSlot(slot.slot_id);
                      }}
                      className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-black/20 animate-in slide-in-from-top-2">
                    {connectionMode === null ? (
                      <div className="p-8">
                        <ConnectionModeSelector onSelect={(mode) => handleSelectConnectionMode(slot.slot_id, mode)} />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800 px-6 pt-3 bg-slate-50/90 dark:bg-gray-950/50">
                          <TabButton
                            active={activeTab === 'general'}
                            onClick={() => setActiveTabBySlot((prev) => ({ ...prev, [slot.slot_id]: 'general' }))}
                            icon={<Settings size={16} />}
                            label={t('slots.tab.general') || 'General'}
                          />
                          <TabButton
                            active={activeTab === (connectionMode === 'official_api' ? 'official' : 'connection')}
                            onClick={() =>
                              setActiveTabBySlot((prev) => ({
                                ...prev,
                                [slot.slot_id]: connectionMode === 'official_api' ? 'official' : 'connection',
                              }))
                            }
                            icon={connectionMode === 'official_api' ? <Link2 size={16} /> : <QrCode size={16} />}
                            label={connectionMode === 'official_api' ? 'API Oficial' : (t('slots.tab.connection') || 'Conexion')}
                          />
                        </div>

                        <div className="p-8">
                          {activeTab === 'general' && (
                            <div className="max-w-2xl space-y-4">
                              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">
                                  Nombre del inbox
                                </label>
                                <input
                                  type="text"
                                  value={slot.slot_name || ''}
                                  onChange={(event) => updateSlot(slot.slot_id, { slot_name: event.target.value })}
                                  className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                                    Tipo de conexion
                                  </p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {connectionMode === 'official_api' ? 'API Oficial de WhatsApp' : 'Conexion QR'}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                                    Estado
                                  </p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {isConnected ? 'En linea' : 'Pendiente de configuracion'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {activeTab === 'connection' && connectionMode === 'qr' && (
                            <MockQrConnectionPanel
                              slot={slot}
                              loading={!!qrLoadingBySlot[slot.slot_id]}
                              onStartQr={() => handleStartQr(slot.slot_id)}
                              onSoftDisconnect={() => handleSoftDisconnect(slot.slot_id)}
                              onReconnect={() => handleReconnect(slot.slot_id)}
                              onDisconnect={() => handleDisconnect(slot.slot_id)}
                              onCopyShareUrl={handleCopyShareUrl}
                            />
                          )}

                          {activeTab === 'official' && connectionMode === 'official_api' && (
                            <MockOfficialApiPanel
                              slot={slot}
                              official={official}
                              loading={!!officialLoadingBySlot[slot.slot_id]}
                              onFieldChange={(field, value) => updateOfficialField(slot.slot_id, field, value)}
                              onSave={() => handleSaveOfficial(slot.slot_id)}
                              onClear={() => handleClearOfficial(slot.slot_id)}
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TabButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`-mb-px flex items-center gap-2 rounded-t-xl border px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all ${
      active
        ? 'border-gray-200 border-b-indigo-600 bg-white text-indigo-600 shadow-sm dark:border-gray-800 dark:border-b-indigo-400 dark:bg-gray-900 dark:text-indigo-300'
        : 'border-transparent bg-transparent text-gray-500 hover:border-gray-200 hover:bg-white/80 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-800 dark:hover:bg-gray-900/60 dark:hover:text-gray-200'
    }`}
  >
    {icon} {label}
  </button>
);

const ConnectionModeSelector = ({ onSelect }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <button
      type="button"
      onClick={() => onSelect('qr')}
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 text-left hover:border-indigo-300 hover:shadow-md transition"
    >
      <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
        <QrCode size={22} className="text-indigo-600 dark:text-indigo-300" />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
        Selecciona el tipo de conexion
      </p>
      <h4 className="mt-2 text-lg font-bold text-gray-900 dark:text-white">Conexion QR</h4>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Vincula el numero escaneando un QR y administra su estado directamente desde el panel.
      </p>
    </button>

    <button
      type="button"
      onClick={() => onSelect('official_api')}
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 text-left hover:border-indigo-300 hover:shadow-md transition"
    >
      <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
        <Link2 size={22} className="text-emerald-600 dark:text-emerald-300" />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
        Beta
      </p>
      <h4 className="mt-2 text-lg font-bold text-gray-900 dark:text-white">API Oficial de WhatsApp</h4>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Configura WABA, Phone Number ID, token y webhook de Meta para operar este inbox por API oficial.
      </p>
    </button>
  </div>
);

const MockQrConnectionPanel = ({
  slot,
  loading,
  onStartQr,
  onSoftDisconnect,
  onReconnect,
  onDisconnect,
  onCopyShareUrl,
}) => {
  const isPaused = slot.suspended_by === 'agency';
  const isConnected = slot.is_connected === true;

  return (
    <div className="max-w-2xl bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center">
      <div className="flex items-center gap-4 mb-6">
        <div className={`p-4 rounded-full ${isConnected ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-gray-100 text-gray-400 dark:bg-gray-700'}`}>
          {isConnected ? <Smartphone size={32} /> : <QrCode size={32} />}
        </div>
        <div className="text-center md:text-left">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {isConnected ? 'Dispositivo Conectado' : isPaused ? 'Inbox Pausado' : 'Vincular WhatsApp'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isConnected
              ? `Numero: +${slot.phone_number || 'N/A'}`
              : isPaused
                ? 'Puedes reconectar sin escanear QR.'
                : 'Escanea el codigo QR para conectar.'}
          </p>
        </div>
      </div>

      {isPaused && (
        <div className="w-full mb-5 rounded-xl border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 p-4">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Pausado por ti</p>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Puedes reconectar sin QR.</p>
        </div>
      )}

      {isConnected ? (
        <div className="w-full flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onSoftDisconnect}
            disabled={loading}
            className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Power size={18} /> Pausar
          </button>
          <button
            onClick={onDisconnect}
            disabled={loading}
            className="border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20 px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Power size={18} /> Desconectar
          </button>
        </div>
      ) : isPaused ? (
        <div className="w-full flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onReconnect}
            disabled={loading}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Play size={18} /> Reconectar
          </button>
          <button
            onClick={onDisconnect}
            disabled={loading}
            className="border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20 px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Power size={18} /> Desconectar
          </button>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center">
          {!slot.qr && !loading && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={onStartQr}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <QrCode size={20} /> Generar Codigo QR
                </button>
                {slot.share_url && (
                  <button
                    onClick={() => onCopyShareUrl(slot.share_url)}
                    className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:bg-gray-900 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-900/20 px-6 py-3 rounded-xl font-bold transition flex items-center gap-2"
                  >
                    <Copy size={18} />
                    Copiar URL QR
                  </button>
                )}
              </div>
            </div>
          )}

          {(slot.qr || loading) && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 dark:border-gray-600 mb-4">
                {slot.qr ? <QRCode value={slot.qr} size={220} /> : <RefreshCw className="animate-spin text-indigo-500 w-12 h-12" />}
              </div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4">
                {slot.qr ? 'Escanea con WhatsApp' : 'Consiguiendo QR seguro...'}
              </p>
            </div>
          )}

          {!slot.qr && slot.share_url && (
            <div className="w-full mt-5 max-w-xl">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  readOnly
                  value={slot.share_url}
                  className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 dark:text-white outline-none text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => onCopyShareUrl(slot.share_url)}
                  className="px-4 py-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 transition font-semibold flex items-center justify-center gap-2"
                >
                  <Copy size={16} />
                  Copiar URL
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MockOfficialApiPanel = ({ slot, official, loading, onFieldChange, onSave, onClear }) => {
  const isVerified = ['verified', 'verified_warning', 'active', 'connected'].includes(
    String(official.status || '').toLowerCase(),
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
              API Oficial de WhatsApp
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configura este inbox con Meta API y deja la conexion lista sin QR.
            </p>
          </div>
          <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${
            isVerified
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700'
          }`}>
            {isVerified ? 'Meta API validada' : 'Borrador'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            Business Account ID
          </label>
          <input
            type="text"
            value={official.businessAccountId || ''}
            onChange={(event) => onFieldChange('businessAccountId', event.target.value)}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
            placeholder="123456789"
          />
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            Phone Number ID
          </label>
          <input
            type="text"
            value={official.phoneNumberId || ''}
            onChange={(event) => onFieldChange('phoneNumberId', event.target.value)}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
            placeholder="10987654321"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          Access Token
        </label>
        <input
          type="password"
          value={official.accessToken || ''}
          onChange={(event) => onFieldChange('accessToken', event.target.value)}
          className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
          placeholder="EAAB..."
        />
      </div>

      {isVerified && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20 flex items-start gap-3">
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-300 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Conexion simulada validada
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
              Este inbox ya figura como conectado dentro del sandbox.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onSave}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 font-bold transition disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar y validar
        </button>
        <button
          onClick={onClear}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20 px-4 py-3 font-bold transition disabled:opacity-60"
        >
          <Trash2 size={16} />
          Limpiar configuracion
        </button>
        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle size={15} />
          Acciones simuladas en Sandbox
        </div>
      </div>
    </div>
  );
};
