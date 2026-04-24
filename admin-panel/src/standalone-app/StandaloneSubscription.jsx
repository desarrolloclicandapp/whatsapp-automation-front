import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  Check,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Shield,
  XCircle,
} from 'lucide-react';
import PaymentMethodForm from '../admin/PaymentMethodForm';
import {
  STANDALONE_PLANS_STANDARD,
  STANDALONE_PRICE_TO_PLAN,
} from '../admin/constants/plans';
import { useLanguage } from '../context/LanguageContext';
import { translateOr } from './i18n';

const API_URL = (import.meta.env.VITE_API_URL || 'https://wa.waflow.com').replace(/\/$/, '');

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'incomplete', 'unpaid']);

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isActiveSubscription(subscription) {
  return ACTIVE_STATUSES.has(normalizeStatus(subscription?.status));
}

function resolvePlanByPriceId(priceId) {
  const planId = STANDALONE_PRICE_TO_PLAN[String(priceId || '').trim()];
  return STANDALONE_PLANS_STANDARD.find((plan) => plan.id === planId) || null;
}

export default function StandaloneSubscription({ token, accountInfo, onDataChange }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('services');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [subscriptions, setSubscriptions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => isActiveSubscription(subscription)),
    [subscriptions],
  );

  const primarySubscription = useMemo(() => {
    const primary = activeSubscriptions.find((subscription) => resolvePlanByPriceId(subscription?.stripe_price_id));
    return primary || activeSubscriptions[0] || null;
  }, [activeSubscriptions]);

  const currentPlan = useMemo(
    () => resolvePlanByPriceId(primarySubscription?.stripe_price_id),
    [primarySubscription],
  );

  const canManageStripe = Boolean(primarySubscription?.stripe_subscription_id);

  const fetchSubscriptions = async () => {
    setFetching(true);
    try {
      const response = await fetch(`${API_URL}/payments/my-subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const payload = await response.json();
        setSubscriptions(Array.isArray(payload) ? payload : []);
      }
    } catch {
      toast.error(translateOr(t, 'sub.toast.error_connection', 'Error de conexión'));
    } finally {
      setFetching(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch(`${API_URL}/payments/payment-methods`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const payload = await response.json();
        setPaymentMethods(Array.isArray(payload) ? payload : []);
      }
    } catch {
      // Non-blocking for billing screen.
    }
  };

  useEffect(() => {
    fetchSubscriptions();
    fetchPaymentMethods();
  }, []);

  const trackInitiateCheckout = (planName = 'Plan') => {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'InitiateCheckout', { content_name: planName, currency: 'USD' });
    }
  };

  const handlePurchase = async ({ priceId, planName, planPrice }) => {
    if (!priceId) return;

    if (paymentMethods.length > 0) {
      setSelectedPlan({ priceId, name: planName, price: planPrice });
      setShowConfirmModal(true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/payments/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priceId }),
      });
      const payload = await response.json();
      if (payload?.url) {
        trackInitiateCheckout(planName);
        window.location.href = payload.url;
        return;
      }
      toast.error(payload?.error || translateOr(t, 'sub.toast.error_unknown', 'Error desconocido'));
    } catch {
      toast.error(translateOr(t, 'sub.toast.error_connection', 'Error de conexión'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDirectPayment = async () => {
    if (!selectedPlan || paymentMethods.length === 0) return;
    setLoading(true);
    const toastId = toast.loading(translateOr(t, 'sub.toast.processing_payment', 'Procesando pago...'));

    try {
      const response = await fetch(`${API_URL}/payments/subscribe-direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceId: selectedPlan.priceId,
          paymentMethodId: paymentMethods[0].id,
        }),
      });
      const payload = await response.json();
      if (payload?.success) {
        toast.success(translateOr(t, 'sub.toast.payment_success', 'Pago realizado con éxito'), { id: toastId });
        setShowConfirmModal(false);
        setSelectedPlan(null);
        await fetchSubscriptions();
        onDataChange?.();
        return;
      }

      if (payload?.requiresAction) {
        const checkoutResponse = await fetch(`${API_URL}/payments/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ priceId: selectedPlan.priceId }),
        });
        const checkoutPayload = await checkoutResponse.json();
        if (checkoutPayload?.url) {
          trackInitiateCheckout(selectedPlan?.name || 'Plan');
          window.location.href = checkoutPayload.url;
          return;
        }
      }

      toast.error(payload?.error || translateOr(t, 'sub.toast.error_unknown', 'Error desconocido'), { id: toastId });
      setShowConfirmModal(false);
      setSelectedPlan(null);
    } catch {
      toast.error(translateOr(t, 'sub.toast.error_connection', 'Error de conexión'), { id: toastId });
      setShowConfirmModal(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlan = async (newPriceId) => {
    if (!primarySubscription?.stripe_subscription_id || !newPriceId) return;
    const confirmed = window.confirm(
      translateOr(t, 'sub.toast.confirm_plan_change', '¿Quieres confirmar el cambio de plan?'),
    );
    if (!confirmed) return;

    setLoading(true);
    const toastId = toast.loading(translateOr(t, 'sub.toast.updating', 'Actualizando...'));
    try {
      const response = await fetch(`${API_URL}/payments/update-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscriptionId: primarySubscription.stripe_subscription_id,
          newPriceId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo actualizar el plan');
      }
      toast.success(translateOr(t, 'sub.toast.plan_updated', 'Plan actualizado'), { id: toastId });
      await fetchSubscriptions();
      onDataChange?.();
    } catch (error) {
      toast.error(error?.message || translateOr(t, 'sub.toast.error_connection', 'Error de conexión'), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!primarySubscription?.stripe_subscription_id) return;
    const confirmed = window.confirm(
      translateOr(t, 'sub.confirm.cancel', '¿Quieres cancelar tu plan actual al final del periodo?'),
    );
    if (!confirmed) return;

    setLoading(true);
    const toastId = toast.loading(translateOr(t, 'sub.toast.cancelling', 'Cancelando...'));
    try {
      const response = await fetch(`${API_URL}/payments/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscriptionId: primarySubscription.stripe_subscription_id,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo cancelar la suscripción');
      }
      toast.success(translateOr(t, 'sub.toast.cancel_success', 'Suscripción cancelada'), { id: toastId });
      await fetchSubscriptions();
      onDataChange?.();
    } catch (error) {
      toast.error(error?.message || translateOr(t, 'sub.toast.error_connection', 'Error de conexión'), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    if (!primarySubscription?.stripe_subscription_id) return;
    setLoading(true);
    const toastId = toast.loading(translateOr(t, 'sub.toast.resuming', 'Reactivando...'));
    try {
      const response = await fetch(`${API_URL}/payments/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscriptionId: primarySubscription.stripe_subscription_id,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo reactivar la suscripción');
      }
      toast.success(translateOr(t, 'sub.toast.resume_success', 'Suscripción reactivada'), { id: toastId });
      await fetchSubscriptions();
      onDataChange?.();
    } catch (error) {
      toast.error(error?.message || translateOr(t, 'sub.toast.error_connection', 'Error de conexión'), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/payments/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json();
      if (payload?.url) {
        window.location.href = payload.url;
        return;
      }
      toast.error(payload?.error || translateOr(t, 'sub.toast.error_portal', 'No se pudo abrir Stripe'));
    } catch {
      toast.error(translateOr(t, 'sub.toast.error_connection', 'Error de conexión'));
    } finally {
      setLoading(false);
    }
  };

  const currentPeriodEnd = primarySubscription?.current_period_end
    ? new Date(primarySubscription.current_period_end).toLocaleDateString()
    : null;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'services'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <Shield size={16} className="inline mr-2" />
            {translateOr(t, 'sub.tab.services', 'Mis planes')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('methods')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'methods'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <CreditCard size={16} className="inline mr-2" />
            {translateOr(t, 'sub.tab.methods', 'Métodos de pago')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'invoices'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <FileText size={16} className="inline mr-2" />
            {translateOr(t, 'sub.tab.invoices', 'Facturación')}
          </button>
        </div>
      </div>

      {activeTab === 'services' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {translateOr(t, 'standalone.subscription.title', 'Planes WaFloW')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {translateOr(
                  t,
                  'standalone.subscription.subtitle',
                  'Elige tu plan para WhatsApp y WaFloW CRM. Sin addons adicionales en esta versión.',
                )}
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-gray-900">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  billingCycle === 'monthly'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                {translateOr(t, 'sub.cycle.monthly', 'Mensual')}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  billingCycle === 'annual'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                {translateOr(t, 'sub.cycle.annual', 'Anual')}
              </button>
            </div>
          </div>

          {fetching ? (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" />
              {translateOr(t, 'common.loading', 'Cargando...')}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {STANDALONE_PLANS_STANDARD.map((plan) => {
                const selectedPriceId = billingCycle === 'annual' ? plan.annualId : plan.id;
                const currentPlanMatch = currentPlan?.id === plan.id;
                const priceLabel = billingCycle === 'annual' ? plan.annualPrice : plan.price;

                const actionLabel = currentPlanMatch
                  ? translateOr(t, 'standalone.subscription.current_plan', 'Plan actual')
                  : primarySubscription
                    ? translateOr(t, 'standalone.subscription.change_plan', 'Cambiar plan')
                    : translateOr(t, 'standalone.subscription.start_plan', 'Contratar plan');

                const action = () => {
                  if (currentPlanMatch || loading) return;
                  if (primarySubscription?.stripe_subscription_id) {
                    handleUpdatePlan(selectedPriceId);
                  } else {
                    handlePurchase({
                      priceId: selectedPriceId,
                      planName: t(plan.nameKey),
                      planPrice: priceLabel,
                    });
                  }
                };

                return (
                  <article
                    key={plan.id}
                    className={`rounded-2xl border p-6 bg-white dark:bg-gray-900 dark:border-gray-800 ${
                      plan.recommended ? 'border-indigo-300 shadow-md shadow-indigo-100/60 dark:shadow-none' : 'border-gray-200'
                    }`}
                  >
                    {plan.recommended && (
                      <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1 mb-3 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {translateOr(t, 'standalone.subscription.recommended', 'Recomendado')}
                      </span>
                    )}
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white">{t(plan.nameKey)}</h4>
                    <p className="text-3xl font-black text-gray-900 dark:text-white mt-3">
                      {priceLabel}
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-1">
                        / {billingCycle === 'annual' ? translateOr(t, 'sub.cycle.year', 'año') : translateOr(t, 'sub.cycle.month', 'mes')}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {translateOr(t, 'standalone.subscription.limit_whatsapp', 'WhatsApp incluidos')}: {plan.limits.slots}
                    </p>

                    <ul className="space-y-2 mt-5">
                      {plan.featureKeys.map((featureKey) => (
                        <li key={featureKey} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <Check size={15} className="mt-0.5 text-emerald-500 shrink-0" />
                          <span>{t(featureKey)}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      disabled={currentPlanMatch || loading}
                      onClick={action}
                      className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${
                        currentPlanMatch
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {actionLabel}
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {translateOr(
                  t,
                  'standalone.subscription.notice',
                  'Los cambios de plan se procesan con Stripe y actualizan tus límites automáticamente.',
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {canManageStripe && (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={loading}
                    className="rounded-xl px-4 py-2 text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20"
                  >
                    <XCircle size={15} className="inline mr-1" />
                    {translateOr(t, 'sub.cancel', 'Cancelar')}
                  </button>
                  <button
                    type="button"
                    onClick={handleResume}
                    disabled={loading}
                    className="rounded-xl px-4 py-2 text-sm font-semibold border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                  >
                    <RefreshCw size={15} className="inline mr-1" />
                    {translateOr(t, 'sub.resume', 'Reactivar')}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handlePortal}
                disabled={loading}
                className="rounded-xl px-4 py-2 text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <ExternalLink size={15} className="inline mr-1" />
                {translateOr(t, 'sub.open_portal', 'Abrir portal Stripe')}
              </button>
            </div>

            {(currentPlan || currentPeriodEnd) && (
              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                {currentPlan ? `${translateOr(t, 'standalone.subscription.current_plan_label', 'Plan actual')}: ${currentPlan.name}` : null}
                {currentPlan && currentPeriodEnd ? ' • ' : ''}
                {currentPeriodEnd
                  ? `${translateOr(t, 'standalone.subscription.renews_at', 'Próxima renovación')}: ${currentPeriodEnd}`
                  : null}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'methods' && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <PaymentMethodForm token={token} onMethodAdded={fetchPaymentMethods} />
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white">
            {translateOr(t, 'standalone.subscription.invoices_title', 'Facturación y comprobantes')}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {translateOr(
              t,
              'standalone.subscription.invoices_desc',
              'Para descargar facturas, actualizar datos fiscales o revisar pagos, usa el portal de Stripe.',
            )}
          </p>
          <button
            type="button"
            onClick={handlePortal}
            disabled={loading}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 text-sm font-bold"
          >
            <ExternalLink size={15} className="inline mr-2" />
            {translateOr(t, 'sub.open_portal', 'Abrir portal Stripe')}
          </button>
        </div>
      )}

      {showConfirmModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6">
            <h5 className="text-lg font-bold text-gray-900 dark:text-white">
              {translateOr(t, 'sub.confirm.title', 'Confirmar compra')}
            </h5>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {selectedPlan.name} • {selectedPlan.price}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {translateOr(t, 'sub.confirm.saved_card', 'Se usará tu tarjeta guardada para completar el pago.')}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedPlan(null);
                }}
                className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300"
              >
                {translateOr(t, 'common.cancel', 'Cancelar')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDirectPayment}
                disabled={loading}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-bold"
              >
                {translateOr(t, 'sub.confirm.pay_now', 'Pagar ahora')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
