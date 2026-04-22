import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const API_URL = (import.meta.env.VITE_API_URL || 'https://wa.waflow.com').replace(/\/$/, '');

async function parseJsonResponse(response) {
  const rawText = await response.text();
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function derivePlanType(accountInfo) {
  const explicit = String(accountInfo?.plan_type || '').trim().toLowerCase();
  if (explicit) return explicit;

  const safePlan = String(accountInfo?.plan || '').trim().toLowerCase();
  if (safePlan === 'trial') return 'trial';

  const maxSlots = Number(accountInfo?.limits?.max_slots || 0);
  if (maxSlots <= 1) return 'starter';
  if (maxSlots <= 5) return 'professional';
  return 'business';
}

export default function useStandaloneWorkspace({ token, onUnauthorized }) {
  const [accountInfo, setAccountInfo] = useState(null);
  const [locations, setLocations] = useState([]);
  const [primaryLocationId, setPrimaryLocationId] = useState(null);
  const [locationDetails, setLocationDetails] = useState(null);
  const [chatwootAccessInfo, setChatwootAccessInfo] = useState(null);
  const [ghlAccessInfo, setGhlAccessInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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
      throw new Error('Sesion expirada');
    }

    return response;
  };

  const refreshWorkspace = () => setRefreshKey((value) => value + 1);

  useEffect(() => {
    let isCancelled = false;

    const loadWorkspace = async () => {
      if (!token) return;
      setLoading(true);

      try {
        const infoResponse = await authFetch('/agency/info');
        if (!infoResponse.ok) {
          const infoBody = await parseJsonResponse(infoResponse);
          throw new Error(infoBody?.error || 'No se pudo cargar la cuenta');
        }
        const infoData = await parseJsonResponse(infoResponse);
        if (isCancelled) return;
        setAccountInfo(infoData);

        const locationsResponse = await authFetch('/agency/locations');
        if (!locationsResponse.ok) {
          const locationsBody = await parseJsonResponse(locationsResponse);
          throw new Error(locationsBody?.error || 'No se pudieron cargar las cuentas');
        }
        const locationsData = (await parseJsonResponse(locationsResponse)) || [];
        if (isCancelled) return;
        setLocations(Array.isArray(locationsData) ? locationsData : []);

        const resolvedPrimaryLocationId =
          String(infoData?.primary_location_id || '').trim() ||
          String(locationsData?.[0]?.location_id || '').trim() ||
          null;
        setPrimaryLocationId(resolvedPrimaryLocationId);

        if (!resolvedPrimaryLocationId) {
          setLocationDetails(null);
          setChatwootAccessInfo(null);
          return;
        }

        const [detailsResponse, chatwootAccessResponse, ghlAccessResponse] = await Promise.all([
          authFetch(`/agency/location-details/${encodeURIComponent(resolvedPrimaryLocationId)}`),
          authFetch(`/agency/chatwoot/access-info?locationId=${encodeURIComponent(resolvedPrimaryLocationId)}`),
          authFetch(`/agency/ghl/access-info?locationId=${encodeURIComponent(resolvedPrimaryLocationId)}`),
        ]);

        if (!detailsResponse.ok) {
          const detailsBody = await parseJsonResponse(detailsResponse);
          throw new Error(detailsBody?.error || 'No se pudo cargar el detalle de la cuenta');
        }

        const detailsData = await parseJsonResponse(detailsResponse);
        const chatwootAccessData = chatwootAccessResponse.ok
          ? await parseJsonResponse(chatwootAccessResponse)
          : null;
        const ghlAccessData = ghlAccessResponse.ok
          ? await parseJsonResponse(ghlAccessResponse)
          : null;

        if (isCancelled) return;
        setLocationDetails(detailsData);
        setChatwootAccessInfo(chatwootAccessData);
        setGhlAccessInfo(ghlAccessData);
      } catch (error) {
        if (!isCancelled) {
          toast.error(error.message || 'No se pudo cargar tu panel principal');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [token, onUnauthorized, refreshKey]);

  const isWhatsAppConnected = useMemo(
    () => Number(locationDetails?.healthSummary?.connected_slots || 0) > 0,
    [locationDetails],
  );

  const planType = useMemo(() => derivePlanType(accountInfo), [accountInfo]);

  const primaryLocation = useMemo(
    () =>
      locations.find((location) => String(location?.location_id || '') === String(primaryLocationId || '')) || null,
    [locations, primaryLocationId],
  );

  return {
    accountInfo,
    locations,
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
  };
}
