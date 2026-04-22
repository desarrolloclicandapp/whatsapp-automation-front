import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  Copy,
  Edit2,
  Link2,
  Loader2,
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
import { translateOr } from './i18n';

const API_URL = (import.meta.env.VITE_API_URL || 'https://wa.waflow.com').replace(/\/$/, '');
const OFFICIAL_EMPTY_STATE = {
  businessAccountId: '',
  phoneNumberId: '',
  accessToken: '',
  status: 'draft',
};

function parseResponseBody(response) {
  return response.text().then((rawText) => {
    if (!rawText) return null;
    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  });
}

function getConnectionMode(slot = {}) {
  return (
    String(slot?.connection_mode || '').trim().toLowerCase() ||
    String(slot?.settings?.connection_mode || '').trim().toLowerCase() ||
    null
  );
}

export default function StandaloneSlotManager({
  token,
  locationId,
  locationName,
  crmType,
  slots,
  healthSummary,
  onRefresh,
  onUnauthorized,
}) {
  const { t } = useLanguage();
  const [localSlots, setLocalSlots] = useState(() => (Array.isArray(slots) ? slots : []));
  const [expandedSlotId, setExpandedSlotId] = useState(null);
  const [activeTabBySlot, setActiveTabBySlot] = useState({});
  const [qrDataBySlot, setQrDataBySlot] = useState({});
  const [qrLoadingBySlot, setQrLoadingBySlot] = useState({});
  const [officialDraftBySlot, setOfficialDraftBySlot] = useState({});
  const [officialLoadingBySlot, setOfficialLoadingBySlot] = useState({});
  const [actionLoadingBySlot, setActionLoadingBySlot] = useState({});

  useEffect(() => {
    const safeSlots = Array.isArray(slots) ? slots : [];
    setLocalSlots(safeSlots);
    setExpandedSlotId((current) => current || safeSlots[0]?.slot_id || null);
  }, [slots]);

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

  const connectedCount = useMemo(
    () => localSlots.filter((slot) => slot.is_connected === true).length,
    [localSlots],
  );

  const updateActionLoading = (slotId, value) => {
    setActionLoadingBySlot((prev) => ({ ...prev, [slotId]: value }));
  };

  const refreshAndKeepExpanded = async () => {
    await Promise.resolve(onRefresh?.());
  };

  const runSlotRealtimePolling = (slotId, attempts = 8, delayMs = 2500) => {
    if (!slotId || attempts <= 0) return;

    window.setTimeout(async () => {
      await fetchSlotRealtime(slotId);
      runSlotRealtimePolling(slotId, attempts - 1, delayMs);
    }, delayMs);
  };

  const loadOfficialConfig = async (slotId) => {
    if (!locationId || !slotId) return;
    setOfficialLoadingBySlot((prev) => ({ ...prev, [slotId]: true }));

    try {
      const response = await authFetch(
        `/agency/whatsapp-official/config?locationId=${encodeURIComponent(locationId)}&slotId=${encodeURIComponent(slotId)}`,
      );
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo cargar la configuracion oficial');
      }

      setOfficialDraftBySlot((prev) => ({
        ...prev,
        [slotId]: {
          businessAccountId: body?.businessAccountId || '',
          phoneNumberId: body?.phoneNumberId || '',
          accessToken: '',
          status: body?.status || 'draft',
        },
      }));
    } catch (error) {
      toast.error(error.message || 'No se pudo cargar la configuracion oficial');
    } finally {
      setOfficialLoadingBySlot((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const fetchSlotRealtime = async (slotId) => {
    if (!locationId || !slotId) return;
    setQrLoadingBySlot((prev) => ({ ...prev, [slotId]: true }));

    try {
      const [statusResponse, qrResponse] = await Promise.all([
        authFetch(`/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/status`),
        authFetch(`/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/qr`),
      ]);
      const statusBody = await parseResponseBody(statusResponse);
      const qrBody = await parseResponseBody(qrResponse);

      if (!statusResponse.ok) {
        throw new Error(statusBody?.error || 'No se pudo obtener el estado del WhatsApp');
      }

      setQrDataBySlot((prev) => ({
        ...prev,
        [slotId]: {
          qr: qrBody?.qr || '',
          waitingForQr: qrBody?.waitingForQr === true,
          qrUpdatedAt: qrBody?.qrUpdatedAt || null,
          connected: statusBody?.connected === true,
          myNumber: statusBody?.myNumber || '',
        },
      }));
    } catch (error) {
      toast.error(error.message || 'No se pudo consultar el estado del WhatsApp');
    } finally {
      setQrLoadingBySlot((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  useEffect(() => {
    const expandedSlot = localSlots.find((slot) => slot.slot_id === expandedSlotId);
    if (!expandedSlot || !locationId) return undefined;

    if (getConnectionMode(expandedSlot) === 'official_api') {
      loadOfficialConfig(expandedSlot.slot_id);
      return undefined;
    }

    fetchSlotRealtime(expandedSlot.slot_id);
    const interval = window.setInterval(() => {
      fetchSlotRealtime(expandedSlot.slot_id);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [expandedSlotId, locationId, localSlots]);

  const handleAddSlot = async () => {
    try {
      const response = await authFetch('/agency/add-slot', {
        method: 'POST',
        body: JSON.stringify({ locationId }),
      });
      const body = await parseResponseBody(response);

      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || 'No se pudo crear el WhatsApp');
      }

      toast.success(translateOr(t, 'standalone.slots.toast_created', 'Nuevo WhatsApp creado'));
      await refreshAndKeepExpanded();
      setExpandedSlotId(body?.slot_id || expandedSlotId);
    } catch (error) {
      toast.error(error.message || 'No se pudo crear el WhatsApp');
    }
  };

  const handleDeleteSlot = async (slotId) => {
    updateActionLoading(slotId, true);
    try {
      const response = await authFetch(`/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}`, {
        method: 'DELETE',
      });
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo eliminar el WhatsApp');
      }

      toast.success(translateOr(t, 'standalone.slots.toast_deleted', 'WhatsApp eliminado'));
      await refreshAndKeepExpanded();
      if (expandedSlotId === slotId) {
        setExpandedSlotId(null);
      }
    } catch (error) {
      toast.error(error.message || 'No se pudo eliminar el WhatsApp');
    } finally {
      updateActionLoading(slotId, false);
    }
  };

  const handleRenameSlot = async (slotId) => {
    const currentSlot = localSlots.find((slot) => slot.slot_id === slotId);
    const nextName = window.prompt(
      translateOr(t, 'standalone.slots.prompt_name', 'Nombre del WhatsApp'),
      currentSlot?.slot_name || `WhatsApp ${slotId}`,
    );
    if (!nextName || !nextName.trim()) return;

    updateActionLoading(slotId, true);
    try {
      const response = await authFetch('/config-slot', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          slot: slotId,
          slotName: nextName.trim(),
        }),
      });
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo actualizar el nombre');
      }

      toast.success(translateOr(t, 'standalone.slots.toast_renamed', 'Nombre actualizado'));
      await refreshAndKeepExpanded();
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el nombre');
    } finally {
      updateActionLoading(slotId, false);
    }
  };

  const persistConnectionMode = async (slot, mode) => {
    const nextSettings = {
      ...(slot?.settings || {}),
      connection_mode: mode,
    };

    const response = await authFetch(`/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slot.slot_id)}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ settings: nextSettings }),
    });
    const body = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(body?.error || 'No se pudo actualizar el tipo de conexion');
    }
  };

  const handleSelectConnectionMode = async (slot, mode) => {
    updateActionLoading(slot.slot_id, true);
    try {
      await persistConnectionMode(slot, mode);
      setActiveTabBySlot((prev) => ({
        ...prev,
        [slot.slot_id]: mode === 'official_api' ? 'official' : 'connection',
      }));
      await refreshAndKeepExpanded();
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el tipo de conexion');
    } finally {
      updateActionLoading(slot.slot_id, false);
    }
  };

  const handleStartQr = async (slotId) => {
    updateActionLoading(slotId, true);
    try {
      const response = await authFetch(`/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/start`, {
        method: 'POST',
      });
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo iniciar la vinculacion QR');
      }

      await fetchSlotRealtime(slotId);
      await refreshAndKeepExpanded();
      runSlotRealtimePolling(slotId);
      toast.success(translateOr(t, 'standalone.slots.qr_started', 'Proceso QR iniciado'));
    } catch (error) {
      toast.error(error.message || 'No se pudo iniciar la vinculacion QR');
    } finally {
      updateActionLoading(slotId, false);
    }
  };

  const handleSoftDisconnect = async (slotId) => {
    updateActionLoading(slotId, true);
    try {
      const response = await authFetch(`/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/soft-disconnect`, {
        method: 'POST',
      });
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo pausar el WhatsApp');
      }

      toast.success(translateOr(t, 'standalone.slots.toast_paused', 'WhatsApp pausado'));
      await refreshAndKeepExpanded();
    } catch (error) {
      toast.error(error.message || 'No se pudo pausar el WhatsApp');
    } finally {
      updateActionLoading(slotId, false);
    }
  };

  const handleReconnect = async (slotId) => {
    updateActionLoading(slotId, true);
    try {
      const response = await authFetch(`/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/reconnect`, {
        method: 'POST',
      });
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo reconectar el WhatsApp');
      }

      await fetchSlotRealtime(slotId);
      await refreshAndKeepExpanded();
      runSlotRealtimePolling(slotId);
      toast.success(translateOr(t, 'standalone.slots.toast_reconnected', 'WhatsApp reconectado'));
    } catch (error) {
      toast.error(error.message || 'No se pudo reconectar el WhatsApp');
    } finally {
      updateActionLoading(slotId, false);
    }
  };

  const handleDisconnect = async (slotId) => {
    updateActionLoading(slotId, true);
    try {
      const response = await authFetch(`/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/disconnect`, {
        method: 'DELETE',
      });
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo desconectar el WhatsApp');
      }

      toast.success(translateOr(t, 'standalone.slots.toast_disconnected', 'WhatsApp desconectado'));
      await refreshAndKeepExpanded();
    } catch (error) {
      toast.error(error.message || 'No se pudo desconectar el WhatsApp');
    } finally {
      updateActionLoading(slotId, false);
    }
  };

  const updateOfficialField = (slotId, field, value) => {
    setOfficialDraftBySlot((prev) => ({
      ...prev,
      [slotId]: {
        ...(prev[slotId] || OFFICIAL_EMPTY_STATE),
        [field]: value,
      },
    }));
  };

  const handleSaveOfficial = async (slotId) => {
    const official = officialDraftBySlot[slotId] || OFFICIAL_EMPTY_STATE;
    if (!official.businessAccountId || !official.phoneNumberId || !official.accessToken) {
      toast.error(
        translateOr(
          t,
          'standalone.slots.official_required_fields',
          'Completa Business Account ID, Phone Number ID y Access Token',
        ),
      );
      return;
    }

    updateActionLoading(slotId, true);
    try {
      const saveResponse = await authFetch('/agency/whatsapp-official/config', {
        method: 'PUT',
        body: JSON.stringify({
          locationId,
          slotId,
          businessAccountId: official.businessAccountId.trim(),
          phoneNumberId: official.phoneNumberId.trim(),
          accessToken: official.accessToken.trim(),
        }),
      });
      const saveBody = await parseResponseBody(saveResponse);
      if (!saveResponse.ok) {
        throw new Error(saveBody?.error || 'No se pudo guardar la configuracion oficial');
      }

      const validateResponse = await authFetch('/agency/whatsapp-official/validate', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          slotId,
          businessAccountId: official.businessAccountId.trim(),
          phoneNumberId: official.phoneNumberId.trim(),
          accessToken: official.accessToken.trim(),
        }),
      });
      const validateBody = await parseResponseBody(validateResponse);
      if (!validateResponse.ok) {
        throw new Error(validateBody?.error || 'No se pudo validar la API oficial');
      }

      toast.success(t('slots.official.valid') || 'WhatsApp API oficial validada');
      await refreshAndKeepExpanded();
      await loadOfficialConfig(slotId);
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar la configuracion oficial');
    } finally {
      updateActionLoading(slotId, false);
    }
  };

  const handleClearOfficial = async (slotId) => {
    updateActionLoading(slotId, true);
    try {
      const response = await authFetch('/agency/whatsapp-official/config', {
        method: 'PUT',
        body: JSON.stringify({
          locationId,
          slotId,
          clear: true,
          preserveConnectionMode: true,
        }),
      });
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo limpiar la configuracion oficial');
      }

      toast.success(t('slots.official.cleared') || 'Configuracion oficial eliminada');
      await refreshAndKeepExpanded();
      await loadOfficialConfig(slotId);
    } catch (error) {
      toast.error(error.message || 'No se pudo limpiar la configuracion oficial');
    } finally {
      updateActionLoading(slotId, false);
    }
  };

  const handleCopyShareUrl = async (slotId) => {
    try {
      const response = await authFetch(`/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/qr-share-link`, {
        method: 'POST',
      });
      const body = await parseResponseBody(response);
      if (!response.ok || !body?.shareUrl) {
        throw new Error(body?.error || 'No se pudo generar el enlace compartido');
      }

      await navigator.clipboard.writeText(body.shareUrl);
      toast.success(translateOr(t, 'common.copied', 'Copiado'));
    } catch (error) {
      toast.error(error.message || (t('slots.chatwoot.copy_error') || 'No se pudo copiar'));
    }
  };

  return (
    <div id="standalone-whatsapp-manager" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {translateOr(t, 'standalone.slots.title', 'WhatsApp activos')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {locationName
              ? `${translateOr(
                  t,
                  'standalone.slots.desc',
                  'Gestiona directamente tus conexiones y numeros de WhatsApp desde esta vista, sin modales intermedios.',
                )}`
              : translateOr(
                  t,
                  'standalone.slots.desc',
                  'Gestiona directamente tus conexiones y numeros de WhatsApp desde esta vista, sin modales intermedios.',
                )}
          </p>
        </div>
        <button
          onClick={handleAddSlot}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition"
        >
          <Plus size={18} /> {translateOr(t, 'standalone.slots.new', 'Nuevo WhatsApp')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard
          label={translateOr(t, 'agency.reliability.online_slots', 'Slots en linea')}
          value={`${connectedCount}/${localSlots.length || 0}`}
        />
        <MetricCard
          label={translateOr(t, 'agency.reliability.sent_24h', 'Enviados 24h')}
          value={String(Number(healthSummary?.sent_24h || 0))}
        />
      </div>

      {localSlots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900/50">
          <Smartphone className="text-gray-300 dark:text-gray-600 w-16 h-16 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">
            {translateOr(t, 'standalone.slots.empty', 'Todavia no tienes WhatsApp conectados')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {localSlots.map((slot) => {
            const slotId = slot.slot_id;
            const isExpanded = expandedSlotId === slotId;
            const connectionMode = getConnectionMode(slot);
            const activeTab = activeTabBySlot[slotId] || 'general';
            const qrData = qrDataBySlot[slotId] || {};
            const officialDraft = officialDraftBySlot[slotId] || OFFICIAL_EMPTY_STATE;
            const isBusy = actionLoadingBySlot[slotId] === true;

            return (
              <div
                id={`slot-card-${slotId}`}
                key={slotId}
                className={`bg-white dark:bg-gray-900 border rounded-2xl transition-all duration-300 overflow-hidden ${
                  isExpanded
                    ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-xl'
                    : 'border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md'
                }`}
              >
                <div
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => setExpandedSlotId(isExpanded ? null : slotId)}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-3 h-3 rounded-full ${slot.is_connected ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900 dark:text-white text-xl">
                          {slot.slot_name || `WhatsApp ${slotId}`}
                        </h3>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRenameSlot(slotId);
                          }}
                          className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">
                        {slot.is_connected && slot.phone_number
                          ? `+${slot.phone_number}`
                          : translateOr(t, 'slots.card.disconnected', 'Desconectado')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide transition-colors ${
                      isExpanded
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {connectionMode === 'official_api' ? 'Meta API' : connectionMode === 'qr' ? 'QR' : 'Configurar'}
                    </span>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteSlot(slotId);
                      }}
                      disabled={isBusy}
                      className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-black/20">
                    {!connectionMode ? (
                      <div className="p-8">
                        <ConnectionModeSelector onSelect={(mode) => handleSelectConnectionMode(slot, mode)} />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800 px-6 pt-3 bg-slate-50/90 dark:bg-gray-950/50">
                          <TabButton
                            active={activeTab === 'general'}
                            onClick={() => setActiveTabBySlot((prev) => ({ ...prev, [slotId]: 'general' }))}
                            icon={<Settings size={16} />}
                            label={translateOr(t, 'slots.tab.general', 'General')}
                          />
                          <TabButton
                            active={activeTab === (connectionMode === 'official_api' ? 'official' : 'connection')}
                            onClick={() =>
                              setActiveTabBySlot((prev) => ({
                                ...prev,
                                [slotId]: connectionMode === 'official_api' ? 'official' : 'connection',
                              }))
                            }
                            icon={connectionMode === 'official_api' ? <Link2 size={16} /> : <QrCode size={16} />}
                            label={
                              connectionMode === 'official_api'
                                ? translateOr(t, 'standalone.slots.official_title', 'API Oficial')
                                : translateOr(t, 'slots.tab.connection', 'Conexion')
                            }
                          />
                        </div>

                        <div className="p-8">
                          {activeTab === 'general' && (
                            <GeneralPanel
                              slot={slot}
                              connectionMode={connectionMode}
                              onSwitchMode={(mode) => handleSelectConnectionMode(slot, mode)}
                            />
                          )}

                          {activeTab === 'connection' && connectionMode === 'qr' && (
                            <QrPanel
                              slot={slot}
                              qrData={qrData}
                              loading={qrLoadingBySlot[slotId] || isBusy}
                              onStartQr={() => handleStartQr(slotId)}
                              onSoftDisconnect={() => handleSoftDisconnect(slotId)}
                              onReconnect={() => handleReconnect(slotId)}
                              onDisconnect={() => handleDisconnect(slotId)}
                              onCopyShareUrl={() => handleCopyShareUrl(slotId)}
                            />
                          )}

                          {activeTab === 'official' && connectionMode === 'official_api' && (
                            <OfficialPanel
                              official={officialDraft}
                              loading={officialLoadingBySlot[slotId] || isBusy}
                              onFieldChange={(field, value) => updateOfficialField(slotId, field, value)}
                              onSave={() => handleSaveOfficial(slotId)}
                              onClear={() => handleClearOfficial(slotId)}
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

function MetricCard({ label, value }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-semibold ${
        active
          ? 'bg-white text-indigo-700 border border-b-0 border-gray-200 dark:bg-gray-900 dark:text-indigo-300 dark:border-gray-700'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ConnectionModeSelector({ onSelect }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <button
        type="button"
        onClick={() => onSelect('qr')}
        className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
          <QrCode size={20} />
        </div>
        <h4 className="text-base font-bold text-gray-900 dark:text-white">Conexion QR</h4>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Escanea un QR para conectar tu numero de WhatsApp en pocos pasos.
        </p>
      </button>

      <button
        type="button"
        onClick={() => onSelect('official_api')}
        className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
          <Link2 size={20} />
        </div>
        <h4 className="text-base font-bold text-gray-900 dark:text-white">API Oficial</h4>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Vincula este WhatsApp con Meta para operar mediante la API oficial.
        </p>
      </button>
    </div>
  );
}

function GeneralPanel({ slot, connectionMode, onSwitchMode }) {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard label="Nombre" value={slot.slot_name || `WhatsApp ${slot.slot_id}`} />
        <MetricCard label="Tipo de conexion" value={connectionMode === 'official_api' ? 'API Oficial' : 'QR'} />
      </div>
      <div>
        <button
          type="button"
          onClick={() => onSwitchMode(connectionMode === 'official_api' ? 'qr' : 'official_api')}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
        >
          Cambiar a {connectionMode === 'official_api' ? 'Conexion QR' : 'API Oficial'}
        </button>
      </div>
    </div>
  );
}

function QrPanel({
  slot,
  qrData,
  loading,
  onStartQr,
  onSoftDisconnect,
  onReconnect,
  onDisconnect,
  onCopyShareUrl,
}) {
  const isConnected = slot.is_connected === true || qrData.connected === true;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Estado del QR</h4>
        {qrData.qr ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white inline-flex">
            <QRCode value={qrData.qr} size={240} />
          </div>
        ) : (
          <div className="h-[272px] rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            {loading ? 'Generando QR...' : 'Todavia no hay un QR activo'}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-bold text-gray-900 dark:text-white">Conexion QR</h4>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {isConnected
                  ? `Conectado${qrData.myNumber ? ` como +${qrData.myNumber}` : ''}`
                  : qrData.waitingForQr
                    ? 'Esperando que el QR este listo...'
                    : 'Inicia el proceso para generar un nuevo QR'}
              </p>
            </div>
            {loading && <Loader2 size={18} className="animate-spin text-indigo-500" />}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={onStartQr} icon={<QrCode size={16} />} label="Generar QR" disabled={loading} />
          <ActionButton onClick={onReconnect} icon={<RefreshCw size={16} />} label="Reconectar" disabled={loading} />
          <ActionButton onClick={onSoftDisconnect} icon={<Power size={16} />} label="Pausar" disabled={loading} />
          <ActionButton onClick={onDisconnect} icon={<Smartphone size={16} />} label="Desconectar" disabled={loading} />
          <ActionButton onClick={onCopyShareUrl} icon={<Copy size={16} />} label="Copiar enlace" disabled={loading} />
        </div>
      </div>
    </div>
  );
}

function OfficialPanel({ official, loading, onFieldChange, onSave, onClear }) {
  return (
    <div className="max-w-3xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField
          label="Business Account ID"
          value={official.businessAccountId || ''}
          onChange={(value) => onFieldChange('businessAccountId', value)}
        />
        <InputField
          label="Phone Number ID"
          value={official.phoneNumberId || ''}
          onChange={(value) => onFieldChange('phoneNumberId', value)}
        />
      </div>
      <InputField
        label="Access Token"
        value={official.accessToken || ''}
        onChange={(value) => onFieldChange('accessToken', value)}
        type="password"
      />
      <div className="flex flex-wrap gap-3">
        <ActionButton onClick={onSave} icon={<Save size={16} />} label="Guardar y validar" disabled={loading} />
        <ActionButton onClick={onClear} icon={<Trash2 size={16} />} label="Limpiar" disabled={loading} tone="secondary" />
      </div>
    </div>
  );
}

function ActionButton({ onClick, icon, label, disabled, tone = 'primary' }) {
  const toneClass =
    tone === 'secondary'
      ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
      : 'bg-indigo-600 text-white hover:bg-indigo-700';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  );
}

function InputField({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
      />
    </div>
  );
}
