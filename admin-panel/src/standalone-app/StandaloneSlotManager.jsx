import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  AlertTriangle,
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
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';
import { useSocket } from '../hooks/useSocket';
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
  maxSlots = 1,
  slots,
  healthSummary,
  onRefresh,
  onSlotsChange,
  onConnectionStateChange,
  onUpgradeRequest,
  onUnauthorized,
}) {
  const { t } = useLanguage();
  const socket = useSocket();
  const [localSlots, setLocalSlots] = useState(() => (Array.isArray(slots) ? slots : []));
  const [expandedSlotId, setExpandedSlotId] = useState(null);
  const [activeTabBySlot, setActiveTabBySlot] = useState({});
  const [qrDataBySlot, setQrDataBySlot] = useState({});
  const [qrLoadingBySlot, setQrLoadingBySlot] = useState({});
  const [officialDraftBySlot, setOfficialDraftBySlot] = useState({});
  const [officialLoadingBySlot, setOfficialLoadingBySlot] = useState({});
  const [twilioConfigBySlot, setTwilioConfigBySlot] = useState({});
  const [loadingTwilioBySlot, setLoadingTwilioBySlot] = useState({});
  const [savingTwilioBySlot, setSavingTwilioBySlot] = useState({});
  const [actionLoadingBySlot, setActionLoadingBySlot] = useState({});
  const [groupsBySlot, setGroupsBySlot] = useState({});
  const [groupsLoadingBySlot, setGroupsLoadingBySlot] = useState({});
  const [showCreateSlotModal, setShowCreateSlotModal] = useState(false);
  const [createSlotName, setCreateSlotName] = useState('');
  const [createSlotLoading, setCreateSlotLoading] = useState(false);
  const [pendingQrAfterCreate, setPendingQrAfterCreate] = useState(false);
  const [showRenameSlotModal, setShowRenameSlotModal] = useState(false);
  const [renameSlotId, setRenameSlotId] = useState(null);
  const [renameSlotName, setRenameSlotName] = useState('');
  const [renameSlotLoading, setRenameSlotLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const safeCrmType = String(crmType || 'chatwoot').trim().toLowerCase();
  const supportsSmsTab = safeCrmType === 'ghl' || safeCrmType === 'chatwoot';
  const normalizedMaxSlots = Number.parseInt(String(maxSlots || 1), 10) || 1;

  useEffect(() => {
    const safeSlots = Array.isArray(slots) ? slots : [];
    setLocalSlots(safeSlots);
    setExpandedSlotId((current) => current || safeSlots[0]?.slot_id || null);
    onConnectionStateChange?.(safeSlots.some((slot) => slot.is_connected === true));
  }, [slots]);

  useEffect(() => {
    if (!socket || !locationId) return undefined;

    socket.emit('join_room', locationId);

    const handleEvent = (payload) => {
      if (payload?.locationId !== locationId) return;
      if (payload?.type === 'connection' && payload?.status === 'open') {
        refreshAndKeepExpanded();
      }
    };

    socket.on('wa_event', handleEvent);
    return () => {
      socket.off('wa_event', handleEvent);
    };
  }, [locationId, socket]);

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

  const updateSettingsBackend = async (slotId, newSettings) => {
    patchLocalSlot(slotId, { settings: newSettings });
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/settings`,
        {
          method: 'PUT',
          body: JSON.stringify({ settings: newSettings }),
        },
      );
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo guardar la configuración');
      }
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar la configuración');
      await refreshAndKeepExpanded();
    }
  };

  const toggleSlotSetting = (slotId, key, currentSettings = {}) => {
    const nextSettings = {
      ...currentSettings,
      [key]: !currentSettings[key],
    };
    updateSettingsBackend(slotId, nextSettings);
  };

  const changeSlotSetting = (slotId, key, value, currentSettings = {}) => {
    const nextSettings = {
      ...currentSettings,
      [key]: value,
    };
    updateSettingsBackend(slotId, nextSettings);
  };

  const changePriority = async (slotId, newPriority) => {
    try {
      const response = await authFetch('/agency/update-slot-config', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          slotId,
          priority: Number.parseInt(String(newPriority), 10),
        }),
      });
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo actualizar el orden de envío');
      }

      patchLocalSlot(slotId, { priority: Number.parseInt(String(newPriority), 10) });
      toast.success('Orden de envío actualizado');
      await refreshAndKeepExpanded();
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el orden de envío');
    }
  };

  const loadGroups = async (slotId) => {
    if (!locationId || !slotId) return;
    setGroupsLoadingBySlot((prev) => ({ ...prev, [slotId]: true }));
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/groups`,
      );
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudieron cargar los grupos');
      }

      setGroupsBySlot((prev) => ({ ...prev, [slotId]: Array.isArray(body) ? body : [] }));
    } catch (error) {
      toast.error(error.message || 'No se pudieron cargar los grupos');
    } finally {
      setGroupsLoadingBySlot((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const toggleGroupActive = (slotId, groupJid, groupName, currentSettings = {}) => {
    const groupsConfig = currentSettings.groups || {};
    const isActive = !(groupsConfig[groupJid]?.active);
    const nextSettings = {
      ...currentSettings,
      groups: {
        ...groupsConfig,
        [groupJid]: {
          active: isActive,
          name: groupName,
        },
      },
    };

    updateSettingsBackend(slotId, nextSettings);
    toast.success(isActive ? `Grupo "${groupName}" activado` : `Grupo "${groupName}" desactivado`);
  };

  const handleSyncMembers = async (slotId, groupJid) => {
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slotId)}/groups/sync-members`,
        {
          method: 'POST',
          body: JSON.stringify({ groupJid }),
        },
      );
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudieron sincronizar los miembros');
      }

      toast.success('Miembros sincronizados');
    } catch (error) {
      toast.error(error.message || 'No se pudieron sincronizar los miembros');
    }
  };

  const openCreateModal = (connectAfterCreate = false) => {
    if (localSlots.length >= normalizedMaxSlots) {
      setShowUpgradeModal(true);
      return;
    }
    setCreateSlotName('');
    setPendingQrAfterCreate(connectAfterCreate);
    setShowCreateSlotModal(true);
  };

  const openRenameModal = (slotId) => {
    const currentSlot = localSlots.find((slot) => slot.slot_id === slotId);
    setRenameSlotId(slotId);
    setRenameSlotName(currentSlot?.slot_name || `WhatsApp ${slotId}`);
    setShowRenameSlotModal(true);
  };

  const connectedCount = useMemo(
    () => localSlots.filter((slot) => slot.is_connected === true).length,
    [localSlots],
  );

  const updateActionLoading = (slotId, value) => {
    setActionLoadingBySlot((prev) => ({ ...prev, [slotId]: value }));
  };

  const applyLocalSlots = (updater) => {
    setLocalSlots((prev) => {
      const nextSlots = typeof updater === 'function' ? updater(prev) : updater;
      onSlotsChange?.(nextSlots);
      onConnectionStateChange?.(nextSlots.some((slot) => slot.is_connected === true));
      return nextSlots;
    });
  };

  const patchLocalSlot = (slotId, patch) => {
    applyLocalSlots((prev) =>
      prev.map((slot) => (slot.slot_id === slotId ? { ...slot, ...patch } : slot)),
    );
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
        throw new Error(body?.error || 'No se pudo cargar la configuración oficial');
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
      toast.error(error.message || 'No se pudo cargar la configuración oficial');
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

    const expandedTab = activeTabBySlot[expandedSlot.slot_id] || 'general';
    if (getConnectionMode(expandedSlot) === 'official_api') {
      loadOfficialConfig(expandedSlot.slot_id);
    }
    if (supportsSmsTab && expandedTab === 'sms') {
      loadTwilioConfig(expandedSlot.slot_id);
    }

    return undefined;
  }, [expandedSlotId, locationId, localSlots, activeTabBySlot, supportsSmsTab]);

  useEffect(() => {
    const handleCreate = () => openCreateModal(false);
    const handleConnectQr = () => {
      if (localSlots.length === 0) {
        openCreateModal(true);
        return;
      }
      const targetSlot =
        localSlots.find((slot) => slot.is_connected !== true) || localSlots[0];
      if (!targetSlot) return;

      setExpandedSlotId(targetSlot.slot_id);
      setActiveTabBySlot((prev) => ({
        ...prev,
        [targetSlot.slot_id]: 'connection',
      }));

      const mode = getConnectionMode(targetSlot);
      if (!mode) {
        handleSelectConnectionMode(targetSlot, 'qr')
          .then(() => handleStartQr(targetSlot.slot_id))
          .catch(() => {});
      } else if (mode === 'official_api') {
        handleSelectConnectionMode(targetSlot, 'qr')
          .then(() => handleStartQr(targetSlot.slot_id))
          .catch(() => {});
      } else {
        handleStartQr(targetSlot.slot_id);
      }
    };

    window.addEventListener('standalone:create-whatsapp', handleCreate);
    window.addEventListener('standalone:connect-whatsapp-qr', handleConnectQr);
    return () => {
      window.removeEventListener('standalone:create-whatsapp', handleCreate);
      window.removeEventListener('standalone:connect-whatsapp-qr', handleConnectQr);
    };
  }, [localSlots]);

  const handleAddSlot = async (preferredName = '') => {
    try {
      const response = await authFetch('/agency/add-slot', {
        method: 'POST',
        body: JSON.stringify({ locationId }),
      });
      const body = await parseResponseBody(response);

      if (body?.requiresUpgrade) {
        setShowUpgradeModal(true);
        throw new Error(body?.error || 'Tu plan actual no permite más conexiones.');
      }

      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || 'No se pudo crear el WhatsApp');
      }

      const createdSlotId = body?.slot_id || null;
      const safeName = String(preferredName || '').trim();
      if (createdSlotId && safeName) {
        const renameResponse = await authFetch('/config-slot', {
          method: 'POST',
          body: JSON.stringify({
            locationId,
            slot: createdSlotId,
            slotName: safeName,
          }),
        });
        const renameBody = await parseResponseBody(renameResponse);
        if (!renameResponse.ok) {
          throw new Error(renameBody?.error || 'Se creó el WhatsApp pero no se pudo guardar el nombre');
        }
      }

      toast.success(translateOr(t, 'standalone.slots.toast_created', 'Nuevo WhatsApp creado'));
      if (createdSlotId) {
        applyLocalSlots((prev) => [
          ...prev,
          {
            slot_id: createdSlotId,
            slot_name: safeName || body.slot_name || `WhatsApp ${createdSlotId}`,
            is_connected: false,
            phone_number: '',
            suspended_by: null,
            settings: { connection_mode: 'qr' },
          },
        ]);
      }
      await refreshAndKeepExpanded();
      setExpandedSlotId(createdSlotId || expandedSlotId);

      if (pendingQrAfterCreate && createdSlotId) {
        const newSlot = {
          slot_id: createdSlotId,
          settings: { connection_mode: 'qr' },
        };
        setPendingQrAfterCreate(false);
        setActiveTabBySlot((prev) => ({ ...prev, [createdSlotId]: 'connection' }));
        await handleSelectConnectionMode(newSlot, 'qr').catch(() => {});
        await handleStartQr(createdSlotId).catch(() => {});
      }

      return createdSlotId;
    } catch (error) {
      toast.error(error.message || 'No se pudo crear el WhatsApp');
      return null;
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
      applyLocalSlots((prev) => prev.filter((slot) => slot.slot_id !== slotId));
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

  const handleRenameSlot = async (slotId, nextName) => {
    if (!nextName || !String(nextName).trim()) return;
    updateActionLoading(slotId, true);
    try {
      const response = await authFetch('/config-slot', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          slot: slotId,
          slotName: String(nextName).trim(),
        }),
      });
      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo actualizar el nombre');
      }

      toast.success(translateOr(t, 'standalone.slots.toast_renamed', 'Nombre actualizado'));
      patchLocalSlot(slotId, { slot_name: String(nextName).trim() });
      await refreshAndKeepExpanded();
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el nombre');
    } finally {
      updateActionLoading(slotId, false);
    }
  };

  const confirmCreateSlot = async () => {
    const safeName = String(createSlotName || '').trim();
    if (!safeName) {
      toast.error('Escribe un nombre para tu WhatsApp.');
      return;
    }
    setCreateSlotLoading(true);
    try {
      const createdId = await handleAddSlot(safeName);
      if (createdId) {
        setShowCreateSlotModal(false);
        setCreateSlotName('');
      }
    } finally {
      setCreateSlotLoading(false);
    }
  };

  const confirmRenameSlot = async () => {
    const safeName = String(renameSlotName || '').trim();
    if (!renameSlotId || !safeName) {
      toast.error('Escribe un nombre válido.');
      return;
    }
    setRenameSlotLoading(true);
    try {
      await handleRenameSlot(renameSlotId, safeName);
      setShowRenameSlotModal(false);
      setRenameSlotId(null);
      setRenameSlotName('');
    } finally {
      setRenameSlotLoading(false);
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
        throw new Error(saveBody?.error || 'No se pudo guardar la configuración oficial');
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
      toast.error(error.message || 'No se pudo guardar la configuración oficial');
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
        throw new Error(body?.error || 'No se pudo limpiar la configuración oficial');
      }

      toast.success(t('slots.official.cleared') || 'Configuración oficial eliminada');
      await refreshAndKeepExpanded();
      await loadOfficialConfig(slotId);
    } catch (error) {
      toast.error(error.message || 'No se pudo limpiar la configuración oficial');
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

  const loadTwilioConfig = async (slotId, forceRefresh = false) => {
    if (!slotId || !locationId) return;
    if (!forceRefresh && twilioConfigBySlot[slotId]) return;

    setLoadingTwilioBySlot((prev) => ({ ...prev, [slotId]: true }));
    try {
      const response = await authFetch(
        `/agency/twilio/config?locationId=${encodeURIComponent(locationId)}&slotId=${encodeURIComponent(slotId)}`,
      );
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'No se pudo cargar Twilio');
      }
      const body = await response.json();
      setTwilioConfigBySlot((prev) => ({
        ...prev,
        [slotId]: {
          accountSid: '',
          authToken: '',
          phoneNumber: body.phoneNumber || '',
          accountSidMasked: body.accountSidMasked || '',
          authTokenMasked: body.authTokenMasked || '',
          hasAuthToken: !!body.hasAuthToken,
          configured: !!body.configured,
        },
      }));
    } catch (error) {
      toast.error('Error cargando Twilio', { description: error.message });
    } finally {
      setLoadingTwilioBySlot((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const updateTwilioField = (slotId, key, value) => {
    setTwilioConfigBySlot((prev) => {
      const current = prev[slotId] || {
        accountSid: '',
        authToken: '',
        phoneNumber: '',
        accountSidMasked: '',
        authTokenMasked: '',
        hasAuthToken: false,
        configured: false,
      };
      return {
        ...prev,
        [slotId]: {
          ...current,
          [key]: value,
        },
      };
    });
  };

  const validateTwilioConfigSlot = async (slotId) => {
    const current = twilioConfigBySlot[slotId] || {};
    const payload = { locationId, slotId };

    if ((current.accountSid || '').trim()) payload.accountSid = current.accountSid.trim();
    if ((current.authToken || '').trim()) payload.authToken = current.authToken.trim();
    if ((current.phoneNumber || '').trim()) payload.fromNumber = current.phoneNumber.trim();

    const loadingId = toast.loading('Validando Twilio...');
    try {
      const response = await authFetch('/agency/twilio/validate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Credenciales inválidas');
      }
      toast.success('Twilio validado correctamente');
      return true;
    } catch (error) {
      toast.error('Validación de Twilio falló', { description: error.message });
      return false;
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const saveTwilioConfig = async (slotId) => {
    const current = twilioConfigBySlot[slotId] || {};
    const sidInput = (current.accountSid || '').trim();
    const tokenInput = (current.authToken || '').trim();
    const fromNumber = (current.phoneNumber || '').trim();

    const sidReady = sidInput || current.accountSidMasked;
    const tokenReady = tokenInput || current.authTokenMasked || current.hasAuthToken;

    if (!sidReady || !tokenReady || !fromNumber) {
      toast.error('Completa SID, Auth Token y número Twilio');
      return;
    }

    const payload = {
      locationId,
      slotId,
      fromNumber,
    };
    if (sidInput) payload.accountSid = sidInput;
    if (tokenInput) payload.authToken = tokenInput;

    setSavingTwilioBySlot((prev) => ({ ...prev, [slotId]: true }));
    try {
      const response = await authFetch('/agency/twilio/config', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'No se pudo guardar');
      }
      toast.success('Configuración de Twilio guardada');
      await loadTwilioConfig(slotId, true);
    } catch (error) {
      toast.error('Error guardando Twilio', { description: error.message });
    } finally {
      setSavingTwilioBySlot((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const clearTwilioConfig = async (slotId) => {
    const loadingId = toast.loading('Limpiando Twilio...');
    try {
      const response = await authFetch('/agency/twilio/config', {
        method: 'PUT',
        body: JSON.stringify({
          locationId,
          slotId,
          clear: true,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'No se pudo limpiar');
      }
      setTwilioConfigBySlot((prev) => ({
        ...prev,
        [slotId]: {
          accountSid: '',
          authToken: '',
          phoneNumber: '',
          accountSidMasked: '',
          authTokenMasked: '',
          hasAuthToken: false,
          configured: false,
        },
      }));
      toast.success('Twilio limpiado');
    } catch (error) {
      toast.error('Error limpiando Twilio', { description: error.message });
    } finally {
      toast.dismiss(loadingId);
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
                  'Gestiona directamente tus conexiones y números de WhatsApp desde esta vista, sin modales intermedios.',
                )}`
              : translateOr(
                  t,
                  'standalone.slots.desc',
                  'Gestiona directamente tus conexiones y números de WhatsApp desde esta vista, sin modales intermedios.',
                )}
          </p>
        </div>
        <button
          onClick={() => openCreateModal(false)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition"
        >
          <Plus size={18} /> {translateOr(t, 'standalone.slots.new', 'Nuevo WhatsApp')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard
          label={translateOr(t, 'agency.reliability.online_slots', 'Slots en línea')}
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
            {translateOr(t, 'standalone.slots.empty', 'Todavía no tienes WhatsApp conectados')}
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
                            openRenameModal(slotId);
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
                                : translateOr(t, 'slots.tab.connection', 'Conexión')
                            }
                          />
                          {supportsSmsTab && (
                            <TabButton
                              active={activeTab === 'sms'}
                              onClick={() => setActiveTabBySlot((prev) => ({ ...prev, [slotId]: 'sms' }))}
                              icon={<Smartphone size={16} />}
                              label={translateOr(t, 'slots.tab.sms', 'SMS')}
                            />
                          )}
                          <TabButton
                            active={activeTab === 'groups'}
                            onClick={() => {
                              if (!slot.is_connected) {
                                toast.warning('Conecta WhatsApp primero.');
                                return;
                              }
                              setActiveTabBySlot((prev) => ({ ...prev, [slotId]: 'groups' }));
                              loadGroups(slotId);
                            }}
                            icon={<Users size={16} />}
                            label={translateOr(t, 'slots.tab.groups', 'Grupos')}
                          />
                        </div>

                        <div className="p-8">
                          {activeTab === 'general' && (
                            <GeneralPanel
                              slot={slot}
                              slots={localSlots}
                              crmType={safeCrmType}
                              connectionMode={connectionMode}
                              onSwitchMode={(mode) => handleSelectConnectionMode(slot, mode)}
                              onChangePriority={(value) => changePriority(slotId, value)}
                              onToggleSetting={(key) => toggleSlotSetting(slotId, key, slot.settings || {})}
                            />
                          )}

                          {activeTab === 'connection' && connectionMode === 'qr' && (
                            <StandaloneSlotConnectionManager
                              slot={slot}
                              locationId={locationId}
                              token={token}
                              onUpdate={refreshAndKeepExpanded}
                              onRealtimeStateChange={(nextState) => patchLocalSlot(slotId, nextState)}
                              onUnauthorized={onUnauthorized}
                            />
                          )}

                          {activeTab === 'sms' && supportsSmsTab && (
                            <SmsPanel
                              twilio={twilioConfigBySlot[slotId] || {
                                accountSid: '',
                                authToken: '',
                                phoneNumber: '',
                                accountSidMasked: '',
                                authTokenMasked: '',
                                hasAuthToken: false,
                                configured: false,
                              }}
                              loading={!!loadingTwilioBySlot[slotId]}
                              saving={!!savingTwilioBySlot[slotId]}
                              onFieldChange={(field, value) => updateTwilioField(slotId, field, value)}
                              onValidate={() => validateTwilioConfigSlot(slotId)}
                              onSave={() => saveTwilioConfig(slotId)}
                              onClear={() => clearTwilioConfig(slotId)}
                              onReload={() => loadTwilioConfig(slotId, true)}
                              t={t}
                            />
                          )}

                          {activeTab === 'groups' && (
                            <GroupsPanel
                              groups={groupsBySlot[slotId] || []}
                              loading={!!groupsLoadingBySlot[slotId]}
                              settings={slot.settings || {}}
                              onReload={() => loadGroups(slotId)}
                              onToggleGroup={(groupJid, groupName) =>
                                toggleGroupActive(slotId, groupJid, groupName, slot.settings || {})
                              }
                              onSyncMembers={(groupJid) => handleSyncMembers(slotId, groupJid)}
                              t={t}
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

      {showCreateSlotModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
          onClick={() => {
            setShowCreateSlotModal(false);
            setPendingQrAfterCreate(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo WhatsApp</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Escribe un nombre para identificar esta conexión.
            </p>
            <div className="mt-4">
              <input
                type="text"
                value={createSlotName}
                onChange={(event) => setCreateSlotName(event.target.value)}
                placeholder="Ej: Ventas principal"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateSlotModal(false);
                  setPendingQrAfterCreate(false);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmCreateSlot}
                disabled={createSlotLoading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-60 inline-flex items-center gap-2"
              >
                {createSlotLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {showRenameSlotModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
          onClick={() => setShowRenameSlotModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Editar nombre</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Actualiza el nombre de este WhatsApp.
            </p>
            <div className="mt-4">
              <input
                type="text"
                value={renameSlotName}
                onChange={(event) => setRenameSlotName(event.target.value)}
                placeholder="Ej: Soporte 1"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRenameSlotModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRenameSlot}
                disabled={renameSlotLoading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-60 inline-flex items-center gap-2"
              >
                {renameSlotLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
          onClick={() => setShowUpgradeModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sube de plan para conectar más WhatsApp</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Llegaste al límite de conexiones de tu plan actual. Mejora tu plan para agregar más números.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUpgradeModal(false);
                  onUpgradeRequest?.();
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
              >
                Ver planes
              </button>
            </div>
          </div>
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
        className="relative rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
      >
        <span className="absolute right-3 top-3 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-1 text-[10px] font-bold">
          Inmediata, fácil y gratis
        </span>
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
          <QrCode size={20} />
        </div>
        <h4 className="text-base font-bold text-gray-900 dark:text-white">Conexión QR</h4>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Escanea un QR para conectar tu número de WhatsApp en pocos pasos.
        </p>
      </button>

      <button
        type="button"
        onClick={() => onSelect('official_api')}
        className="relative rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
      >
        <span className="absolute right-3 top-3 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-1 text-[10px] font-bold">
          Tiempo de aprobación, avanzado y costes de meta
        </span>
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

function SettingRow({ label, desc, checked, onChange }) {
  return (
    <div
      className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer"
      onClick={onChange}
    >
      <div>
        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
      </div>
      <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    </div>
  );
}

function GeneralPanel({
  slot,
  slots,
  crmType,
  connectionMode,
  onSwitchMode,
  onChangePriority,
  onToggleSetting,
}) {
  const settings = slot.settings || {};
  const isGhlMode = crmType === 'ghl';
  const currentPrio = Number.parseInt(String(slot.priority || 1), 10) || 1;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard label="Nombre" value={slot.slot_name || `WhatsApp ${slot.slot_id}`} />
        <MetricCard label="Tipo de conexión" value={connectionMode === 'official_api' ? 'API Oficial' : 'QR'} />
      </div>

      {isGhlMode && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Orden de envío</h4>
          <div className="flex items-center gap-4">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Prioridad:</label>
            <select
              className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
              value={currentPrio}
              onChange={(event) => onChangePriority(event.target.value)}
            >
              {Array.from({ length: slots.length }, (_, index) => index + 1).map((priority) => (
                <option key={priority} value={priority}>
                  {priority} {priority === 1 ? '(Alta)' : ''}
                </option>
              ))}
              {currentPrio > slots.length && <option value={currentPrio}>{currentPrio}</option>}
            </select>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <h4 className="px-3 pt-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Comportamiento</h4>
        <div className="space-y-1">
          <SettingRow
            label="Etiqueta de origen"
            desc="Muestra desde qué canal llegó la conversación."
            checked={settings.show_source_label ?? true}
            onChange={() => onToggleSetting('show_source_label')}
          />
          <SettingRow
            label="Transcribir audios"
            desc="Convierte audios a texto para procesos automáticos."
            checked={settings.transcribe_audio ?? true}
            onChange={() => onToggleSetting('transcribe_audio')}
          />
          <SettingRow
            label="Crear contactos nuevos"
            desc="Crea contactos automáticamente cuando el número no existe todavía."
            checked={settings.create_unknown_contacts ?? true}
            onChange={() => onToggleSetting('create_unknown_contacts')}
          />
          <SettingRow
            label="Avisar si se desconecta"
            desc="Envía una alerta cuando este WhatsApp se desconecta."
            checked={settings.send_disconnect_message ?? true}
            onChange={() => onToggleSetting('send_disconnect_message')}
          />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => onSwitchMode(connectionMode === 'official_api' ? 'qr' : 'official_api')}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
        >
          Cambiar a {connectionMode === 'official_api' ? 'Conexión QR' : 'API Oficial'}
        </button>
      </div>
    </div>
  );
}

function GroupsPanel({ groups, loading, settings, onReload, onToggleGroup, onSyncMembers, t }) {
  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-bold text-gray-700 dark:text-gray-300">
          {translateOr(t, 'slots.groups.detected', 'Grupos detectados')}
        </h4>
        <button
          onClick={onReload}
          className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-2 rounded-lg transition"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <RefreshCw className="animate-spin mx-auto text-indigo-500" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-8 text-center">
          <p className="font-semibold text-gray-700 dark:text-gray-200">
            {translateOr(t, 'slots.groups.empty', 'No hay grupos detectados')}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {translateOr(t, 'slots.groups.empty_help', 'Conecta WhatsApp y vuelve a sincronizar para verlos aquí.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isActive = settings.groups?.[group.id]?.active;
            return (
              <div
                key={group.id}
                className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
              >
                <div>
                  <h5 className="font-bold text-gray-800 dark:text-white">{group.subject}</h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {group.participants} {translateOr(t, 'slots.groups.participants', 'participantes')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!!isActive}
                      onChange={() => onToggleGroup(group.id, group.subject)}
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:ring-4 peer-focus:ring-indigo-100 dark:peer-focus:ring-indigo-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                  <button
                    onClick={() => onSyncMembers(group.id)}
                    className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 rounded-lg"
                    title={translateOr(t, 'slots.groups.sync', 'Sincronizar miembros')}
                  >
                    <Users size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StandaloneSlotConnectionManager({
  slot,
  locationId,
  token,
  onUpdate,
  onRealtimeStateChange,
  onUnauthorized,
}) {
  const { t } = useLanguage();
  const socket = useSocket();
  const [status, setStatus] = useState({
    connected: slot?.is_connected === true,
    myNumber: slot?.phone_number || null,
  });
  const [qr, setQr] = useState(null);
  const [qrUpdatedAt, setQrUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accountSuspensionState, setAccountSuspensionState] = useState(null);
  const [slotSuspendedBy, setSlotSuspendedBy] = useState(slot?.suspended_by || null);
  const [slotLockMessage, setSlotLockMessage] = useState(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isGeneratingShareUrl, setIsGeneratingShareUrl] = useState(false);
  const [tutorialConfirmed, setTutorialConfirmed] = useState(false);
  const pollInterval = useRef(null);
  const connectAttemptRef = useRef(0);
  const socketConnectedRef = useRef(false);

  const authFetch = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      onUnauthorized?.();
      throw new Error(t('agency.session_expired'));
    }

    return response;
  };

  const readAccessError = async (response) => {
    if (!response || response.status !== 403) return null;
    const body = await response.clone().json().catch(() => null);
    if (!body?.error) return null;

    if (body.error === 'account_suspended') {
      return {
        kind: 'account',
        status: body.suspension_status || 'suspended',
        message:
          body.message ||
          'Tu cuenta está suspendida. No puedes vincular números en este momento.',
      };
    }

    if (body.error === 'slot_suspended') {
      return {
        kind: 'slot',
        status: body.suspended_by || 'system',
        message: body.message || 'Este slot esta temporalmente suspendido.',
      };
    }

    if (body.error === 'admin_lock') {
      return {
        kind: 'admin_lock',
        status: 'admin',
        message:
          body.message ||
          'Este slot fue suspendido por administración y no puede reconectarse.',
      };
    }

    return null;
  };

  const stopPolling = () => {
    if (pollInterval.current) {
      window.clearTimeout(pollInterval.current);
      pollInterval.current = null;
    }
  };

  const applyAccessError = (accessError) => {
    if (!accessError) return false;

    if (accessError.kind === 'account') {
      setAccountSuspensionState(accessError);
    }

    if (accessError.kind === 'slot' || accessError.kind === 'admin_lock') {
      setSlotSuspendedBy(accessError.status || 'system');
      setSlotLockMessage(accessError.message || null);
    }

    setLoading(false);
    setQr(null);
    setQrUpdatedAt(null);
    setQrExpired(false);
    connectAttemptRef.current = 0;
    stopPolling();
    return true;
  };

  const checkStatus = async () => {
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slot.slot_id)}/status`,
      );
      const accessError = await readAccessError(response);
      if (applyAccessError(accessError)) return;

      if (response.ok) {
        const body = await response.json();
        setAccountSuspensionState(null);
        setStatus({ connected: body.connected, myNumber: body.myNumber });
        setSlotSuspendedBy(body.suspended_by || null);
        onRealtimeStateChange?.({
          is_connected: body.connected === true,
          phone_number: body.myNumber || slot?.phone_number || '',
          suspended_by: body.suspended_by || null,
        });
        if (!body.suspended_by) setSlotLockMessage(null);

        if (body.connected) {
          socketConnectedRef.current = true;
          connectAttemptRef.current = 0;
          setQr(null);
          setQrUpdatedAt(null);
          setLoading(false);
          stopPolling();
          await Promise.resolve(onUpdate?.());
        }
      }
    } catch {
      // Silent on purpose: original behavior keeps polling lightweight.
    }
  };

  useEffect(() => {
    checkStatus();
    return () => stopPolling();
  }, [locationId, slot?.slot_id]);

  useEffect(() => {
    setShareUrl('');
    setIsGeneratingShareUrl(false);
    setQrExpired(false);
    setTutorialConfirmed(false);
  }, [locationId, slot?.slot_id]);

  useEffect(() => {
    const nextConnected = slot?.is_connected === true;
    const nextNumber = slot?.phone_number || null;

    setStatus((current) => {
      const resolvedNumber = nextNumber || current.myNumber || null;
      if (current.connected === nextConnected && current.myNumber === resolvedNumber) {
        return current;
      }
      return {
        connected: nextConnected,
        myNumber: resolvedNumber,
      };
    });

    setSlotSuspendedBy(slot?.suspended_by || null);

    if (nextConnected) {
      socketConnectedRef.current = true;
      connectAttemptRef.current = 0;
      setQr(null);
      setQrUpdatedAt(null);
      setQrExpired(false);
      setTutorialConfirmed(true);
      setLoading(false);
      stopPolling();
    }
  }, [slot?.slot_id, slot?.is_connected, slot?.phone_number, slot?.suspended_by]);

  useEffect(() => {
    if (!socket || !locationId || !slot?.slot_id) return undefined;

    socket.emit('join_room', locationId);

    const handleEvent = (payload) => {
      if (payload?.locationId !== locationId) return;
      if (Number(payload?.slotId) !== Number(slot.slot_id)) return;

      if (payload?.type === 'qr' && payload?.data) {
        if (socketConnectedRef.current) return;
        setQr(payload.data);
        setQrExpired(false);
        setLoading(false);
      }

      if (payload?.type === 'connection' && payload?.status === 'open') {
        socketConnectedRef.current = true;
        connectAttemptRef.current = 0;
        setQr(null);
        setQrUpdatedAt(null);
        setQrExpired(false);
        setLoading(false);
        stopPolling();
        checkStatus();
      }

      if (payload?.type === 'connection' && payload?.status === 'close') {
        socketConnectedRef.current = false;
        checkStatus();
      }
    };

    socket.on('wa_event', handleEvent);
    return () => {
      socket.off('wa_event', handleEvent);
    };
  }, [socket, locationId, slot?.slot_id]);

  const handleConnect = async () => {
    if (slotSuspendedBy === 'admin' || slotSuspendedBy === 'system') {
      toast.error('Este WhatsApp esta bloqueado temporalmente');
      return;
    }

    setLoading(true);
    setQrExpired(false);
    setQr(null);
    setQrUpdatedAt(null);
    socketConnectedRef.current = false;

    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slot.slot_id)}/start`,
        { method: 'POST' },
      );
      const accessError = await readAccessError(response);
      if (applyAccessError(accessError)) return;

      if (!response.ok) throw new Error('Fallo al iniciar');

      setAccountSuspensionState(null);
      stopPolling();
      let sawFreshQr = false;
      const attemptId = Date.now();
      connectAttemptRef.current = attemptId;

      const pollStep = async () => {
        if (connectAttemptRef.current !== attemptId || socketConnectedRef.current) {
          stopPolling();
          return;
        }
        try {
          const qrResponse = await authFetch(
            `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slot.slot_id)}/qr`,
          );
          const qrError = await readAccessError(qrResponse);
          if (applyAccessError(qrError)) return;

          if (qrResponse.ok) {
            const data = await qrResponse.json();
            if (connectAttemptRef.current !== attemptId || socketConnectedRef.current) {
              stopPolling();
              return;
            }
            const nextQrUpdatedAt = data.qrUpdatedAt || null;
            const nextQr = data.qr || null;
            const stillWaitingForQr = data.waitingForQr === true;
            setQrUpdatedAt(nextQrUpdatedAt);
            setQr(nextQr);

            if (nextQr) {
              sawFreshQr = true;
            } else if (!data.connected && sawFreshQr && !stillWaitingForQr) {
              setLoading(false);
              setQrExpired(true);
              stopPolling();
              return;
            }

            if (data.connected) {
              await checkStatus();
              return;
            }
          }
        } catch {
          // Silent on purpose: polling will retry.
        }

        pollInterval.current = window.setTimeout(pollStep, 3000);
      };

      pollStep();
    } catch {
      toast.error('Error iniciando conexion');
      setLoading(false);
    }
  };

  const handleSoftDisconnect = async () => {
    if (!window.confirm('¿Pausar este dispositivo sin borrar la sesión?')) return;
    setLoading(true);
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slot.slot_id)}/soft-disconnect`,
        { method: 'POST' },
      );
      const accessError = await readAccessError(response);
      if (applyAccessError(accessError)) return;

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'No se pudo pausar');
      }

      const body = await response.json().catch(() => ({}));
      const newLock = body.suspended_by || 'agency';

      setStatus({ connected: false, myNumber: status.myNumber || slot.phone_number || null });
      setSlotSuspendedBy(newLock);
      onRealtimeStateChange?.({
        is_connected: false,
        phone_number: status.myNumber || slot.phone_number || '',
        suspended_by: newLock,
      });
      setSlotLockMessage(
        newLock === 'admin'
          ? 'Pausado por administración. Solo admin puede reactivar.'
          : 'Pausado por ti. Puedes reconectar sin escanear QR.',
      );
      setQrExpired(false);
      setQr(null);
      setQrUpdatedAt(null);
      stopPolling();
      await Promise.resolve(onUpdate?.());
      toast.success('WhatsApp pausado');
    } catch (error) {
      toast.error(error.message || 'Error pausando el WhatsApp');
    }
    setLoading(false);
  };

  const handleReconnect = async () => {
    if (slotSuspendedBy === 'admin' || slotSuspendedBy === 'system') {
      toast.error('Este WhatsApp esta bloqueado temporalmente');
      return;
    }

    if (accountSuspensionState) {
      toast.error('No puedes reconectar mientras tu cuenta este en gracia o suspendida');
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slot.slot_id)}/reconnect`,
        { method: 'POST' },
      );
      const accessError = await readAccessError(response);
      if (applyAccessError(accessError)) return;

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'No se pudo reconectar');
      }

      setSlotSuspendedBy(null);
      setSlotLockMessage(null);
      setAccountSuspensionState(null);
      setQrExpired(false);
      setQr(null);
      setQrUpdatedAt(null);
      toast.success('Reconectando...');

      stopPolling();

      const reconnectPollStep = async () => {
        await checkStatus();
        if (pollInterval.current) {
          pollInterval.current = window.setTimeout(reconnectPollStep, 4000);
        }
      };

      pollInterval.current = window.setTimeout(reconnectPollStep, 4000);
      setLoading(false);
    } catch (error) {
      toast.error(error.message || 'Error reconectando el WhatsApp');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Desconectar este dispositivo?')) return;
    setLoading(true);
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slot.slot_id)}/disconnect`,
        { method: 'DELETE' },
      );
      const accessError = await readAccessError(response);
      if (applyAccessError(accessError)) return;

      if (!response.ok) throw new Error('Error desconectando');

      setStatus({ connected: false, myNumber: null });
      setSlotSuspendedBy(null);
      onRealtimeStateChange?.({
        is_connected: false,
        phone_number: '',
        suspended_by: null,
      });
      setSlotLockMessage(null);
      setQrExpired(false);
      setQr(null);
      setQrUpdatedAt(null);
      stopPolling();
      await Promise.resolve(onUpdate?.());
      toast.success('WhatsApp desconectado');
    } catch {
      toast.error('Error desconectando el WhatsApp');
    }
    setLoading(false);
  };

  const handleGenerateShareUrl = async () => {
    setIsGeneratingShareUrl(true);
    try {
      const response = await authFetch(
        `/agency/slots/${encodeURIComponent(locationId)}/${encodeURIComponent(slot.slot_id)}/qr-share-link`,
        { method: 'POST' },
      );
      const accessError = await readAccessError(response);
      if (applyAccessError(accessError)) return;

      if (!response?.ok) {
        const errorBody = await response?.json().catch(() => ({}));
        throw new Error(errorBody?.error || 'No se pudo generar la URL QR');
      }

      const body = await response.json().catch(() => ({}));
      if (!body?.shareUrl) throw new Error('No se pudo generar la URL QR');

      setShareUrl(body.shareUrl);
      try {
        await navigator.clipboard.writeText(body.shareUrl);
        toast.success(t('slots.share.link_ready') || 'URL QR generada', {
          description:
            t('slots.share.link_ready_slot_desc') ||
            'Tu cliente podra abrirla y generar manualmente el QR de este slot cuando lo necesite.',
        });
      } catch {
        toast.success(t('slots.share.link_ready') || 'URL QR generada', {
          description:
            t('slots.share.copy_hint') ||
            'Copia la URL desde el campo para compartirla con tu cliente.',
        });
      }
    } catch (error) {
      toast.error(t('slots.share.error') || 'No se pudo generar el enlace QR', {
        description: error.message || undefined,
      });
    } finally {
      setIsGeneratingShareUrl(false);
    }
  };

  const headerTitle =
    slotSuspendedBy === 'admin'
      ? 'Suspendido por Admin'
      : slotSuspendedBy === 'system'
        ? 'Suspendido por Sistema'
        : slotSuspendedBy === 'agency'
          ? 'WhatsApp pausado'
          : status.connected
            ? 'WhatsApp conectado'
            : 'Vincular WhatsApp';

  const headerDescription =
    slotSuspendedBy === 'admin'
      ? 'Este WhatsApp está bloqueado por administración.'
      : slotSuspendedBy === 'system'
        ? 'Este WhatsApp esta bloqueado temporalmente por el sistema.'
        : slotSuspendedBy === 'agency'
          ? `Numero: +${status.myNumber || slot.phone_number || 'N/A'}`
          : status.connected
            ? `Numero: +${status.myNumber}`
            : 'Ve a WhatsApp, Configuración, Dispositivos vinculados y luego genera el QR.';

  return (
    <div className="max-w-2xl bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center">
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`p-4 rounded-full ${
            status.connected
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
          }`}
        >
          {status.connected ? <Smartphone size={32} /> : <QrCode size={32} />}
        </div>
        <div className="text-center md:text-left">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{headerTitle}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{headerDescription}</p>
        </div>
      </div>

      {accountSuspensionState && (
        <div className="w-full mb-5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Cuenta en suspension ({accountSuspensionState.status})
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                {accountSuspensionState.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {slotSuspendedBy === 'admin' && (
        <div className="w-full mb-5 rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 p-4">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            Bloqueado por administración
          </p>
          <p className="text-xs text-red-700 dark:text-red-400 mt-1">
            {slotLockMessage || 'Contacta soporte para habilitar este WhatsApp.'}
          </p>
        </div>
      )}

      {slotSuspendedBy === 'agency' && (
        <div className="w-full mb-5 rounded-xl border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 p-4">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Pausado por ti</p>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            {slotLockMessage || 'Puedes reconectar sin QR.'}
          </p>
        </div>
      )}

      {slotSuspendedBy === 'system' && (
        <div className="w-full mb-5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Bloqueado por sistema
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            {slotLockMessage || 'Debes regularizar el estado de la cuenta para reactivar este WhatsApp.'}
          </p>
        </div>
      )}

      {accountSuspensionState ? (
        <div className="w-full flex justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Reconexion bloqueada mientras la cuenta este en gracia o suspendida.
          </p>
        </div>
      ) : status.connected ? (
        <div className="w-full flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleSoftDisconnect}
            disabled={loading}
            className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Power size={18} /> Pausar
          </button>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20 px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Power size={18} /> Desconectar
          </button>
        </div>
      ) : slotSuspendedBy === 'agency' ? (
        <div className="w-full flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleReconnect}
            disabled={loading}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Play size={18} /> Reconectar
          </button>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20 px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Power size={18} /> Desconectar
          </button>
        </div>
      ) : slotSuspendedBy === 'admin' || slotSuspendedBy === 'system' ? (
        <div className="w-full flex justify-center">
          <p className="text-sm text-red-600 dark:text-red-400 font-semibold">
            {slotSuspendedBy === 'admin'
              ? 'Reconectar bloqueado por Admin'
              : 'Reconectar bloqueado por Sistema'}
          </p>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center">
          {!qr && !loading && !accountSuspensionState && (
            <div className="flex flex-col items-center gap-3">
              {!tutorialConfirmed && (
              <div className="w-full max-w-xl rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800 p-4">
                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Tutorial rápido</p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                  Ve a WhatsApp, Configuración, Dispositivos vinculados. ¿Lo lograste?
                </p>
                <button
                  type="button"
                  onClick={() => setTutorialConfirmed(true)}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
                >
                  Sí, continuar
                </button>
              </div>
              )}
              {qrExpired && (
                <p className="text-sm text-amber-700 dark:text-amber-300 text-center">
                  El QR expiro. Pulsa de nuevo para generar uno nuevo.
                </p>
              )}
              <div className={`flex flex-col sm:flex-row gap-3 justify-center ${tutorialConfirmed ? '' : 'hidden'}`}>
                <button
                  onClick={handleConnect}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <QrCode size={20} /> Generar Codigo QR
                </button>
                <button
                  onClick={handleGenerateShareUrl}
                  disabled={isGeneratingShareUrl}
                  className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:bg-gray-900 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-900/20 px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 disabled:opacity-60"
                >
                  {isGeneratingShareUrl ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Link2 size={18} />
                  )}
                  {t('slots.share.generate_link') || 'Generar URL QR'}
                </button>
              </div>
            </div>
          )}

          {!accountSuspensionState && (qr || loading) && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 dark:border-gray-600 mb-4">
                {qr ? (
                  <QRCode value={qr} size={220} />
                ) : (
                  <RefreshCw className="animate-spin text-indigo-500 w-12 h-12" />
                )}
              </div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-4">
                {qr
                  ? 'Escanea con WhatsApp (Expira pronto)'
                  : slotSuspendedBy
                    ? 'Reconectando automáticamente...'
                    : 'Consiguiendo QR seguro...'}
              </p>
              <button
                onClick={() => {
                  setQr(null);
                  setQrUpdatedAt(null);
                  setLoading(false);
                  stopPolling();
                }}
                className="text-gray-400 hover:text-red-500 underline text-sm transition"
              >
                Cancelar
              </button>
            </div>
          )}

          {!qr && shareUrl && (
            <div className="w-full mt-5 max-w-xl">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 dark:text-white outline-none text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(shareUrl)
                      .then(() => toast.success(t('slots.share.copied') || 'URL QR copiada'))
                      .catch(() =>
                        toast.error(t('slots.chatwoot.copy_error') || 'No se pudo copiar'),
                      )
                  }
                  className="px-4 py-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 transition font-semibold flex items-center justify-center gap-2"
                >
                  <Copy size={16} />
                  {t('slots.share.copy_link') || 'Copiar URL'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
            {loading ? 'Generando QR...' : 'Todavía no hay un QR activo'}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-bold text-gray-900 dark:text-white">Conexión QR</h4>
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

function SmsPanel({
  twilio,
  loading,
  saving,
  onFieldChange,
  onValidate,
  onSave,
  onClear,
  onReload,
  t,
}) {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
              {t('slots.sms.title')}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('slots.sms.desc')}
            </p>
          </div>
          <div
            className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
              twilio.configured
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {twilio.configured ? t('slots.sms.configured') : t('slots.sms.not_configured')}
          </div>
        </div>

        <InputField
          label={t('slots.sms.account_sid')}
          value={twilio.accountSid || ''}
          onChange={(value) => onFieldChange('accountSid', value)}
        />

        <InputField
          label={t('slots.sms.auth_token')}
          value={twilio.authToken || ''}
          onChange={(value) => onFieldChange('authToken', value)}
          type="password"
        />

        <InputField
          label={t('slots.sms.phone_number')}
          value={twilio.phoneNumber || ''}
          onChange={(value) => onFieldChange('phoneNumber', value)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onValidate}
            disabled={loading || saving}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 transition flex items-center gap-2"
          >
            <Save size={16} />
            {t('slots.sms.validate')}
          </button>
          <button
            onClick={onSave}
            disabled={loading || saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {t('slots.sms.save')}
          </button>
          <button
            onClick={onClear}
            disabled={loading || saving}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:opacity-60 transition"
          >
            {t('slots.sms.clear')}
          </button>
          <button
            onClick={onReload}
            disabled={loading || saving}
            className="px-3 py-2 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition"
            title={t('slots.sms.reload')}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
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
