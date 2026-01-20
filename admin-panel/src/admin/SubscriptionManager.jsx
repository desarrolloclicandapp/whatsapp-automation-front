import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Check, Zap, Building2, Smartphone,
    CreditCard, FileText, ExternalLink, Crown, AlertCircle,
    ArrowRightLeft, Plus, ChevronRight, Package, Shield, PlusCircle,
    TrendingUp, XCircle, ArrowDown, RefreshCw
} from 'lucide-react';





const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");
import { useLanguage } from '../context/LanguageContext'; // ✅ Import
import PaymentMethodForm from './PaymentMethodForm'; // ✅ NUEVO: Formulario de métodos de pago

// --- CONFIGURACIÓN DE PLANES BASE ---
// Ordenados por precio para calcular upgrades/downgrades
// --- CONFIGURACIÓN DE PLANES ---
// Definimos los grupos de planes para usarlos según el estado del usuario

// 1. PLANES ESTÁNDAR (Usuarios Nuevos / <10 Subs)
const PLANS_STANDARD = [
    {
        id: 'price_1SmumgHSoN0LpQiB9BrDVtoV',
        name: 'Plan Starter',
        priceValue: 29,
        price: '29$',
        annualId: 'price_1SmuvRHSoN0LpQiB3MXFsBqV',
        annualPrice: '290$',
        limits: { subs: 1 },
        features: ['1 Subcuenta', '99 Números vinculables', 'Ahorra 2 meses con Anual'],
        color: 'bg-blue-600',
        badge: 'Start'
    },
    {
        id: 'price_1Smuo8HSoN0LpQiB5z8FHJwp',
        name: 'Plan Growth',
        priceValue: 49,
        price: '49$',
        annualId: 'price_1Smv4cHSoN0LpQiBe5sq49mt',
        annualPrice: '490$',
        limits: { subs: 3 },
        features: ['3 Subcuentas', '99 Números vinculables', 'Ahorra 2 meses con Anual'],
        color: 'bg-indigo-600',
        recommended: true,
        badge: 'Popular'
    },
    {
        id: 'price_1Smup2HSoN0LpQiBOCHw8R0Y',
        name: 'Plan Agency',
        priceValue: 149,
        price: '149$',
        annualId: 'price_1SmusiHSoN0LpQiBBaC65w6e',
        annualPrice: '1490$',
        limits: { subs: 10 },
        features: ['10 Subcuentas', '99 Números vinculables', 'Ahorra 2 meses con Anual'],
        color: 'bg-purple-600',
        badge: 'Agency'
    }
];

// 2. PLANES FOUNDER (Usuarios que compraron el pase de $950)
// Tienen reglas de slot especiales acumulativas
const PLANS_FOUNDER = [
    {
        id: 'price_1SmxK5HSoN0LpQiB4051Ko2I', // Precio Reducido
        name: 'Starter Addon',
        priceValue: 15,
        price: '15$',
        annualId: null, // No provisto aún, solo mensual
        annualPrice: '150$',
        limits: { subs: 1 },
        features: ['1 Subcuenta Extra', '+5 Números', 'Precio Reducido (150$/y)'],
        color: 'bg-emerald-600',
        badge: 'Founder Benefit'
    },
    {
        id: 'price_1Smxb3HSoN0LpQiBBaaGKcOo', // Precio NO Reducido (Standard)
        name: 'Growth Addon',
        priceValue: 49,
        price: '49$',
        annualId: 'price_1Smv4cHSoN0LpQiBe5sq49mt',
        annualPrice: '490$',
        limits: { subs: 3 },
        features: ['3 Subcuentas Extra', '+15 Números', 'Ahorra 2 meses con Anual'],
        color: 'bg-indigo-600',
    },
    {
        id: 'price_1SmxcGHSoN0LpQiB2boUJAkF', // Precio NO Reducido (Standard)
        name: 'Agency Addon',
        priceValue: 149,
        price: '149$',
        annualId: 'price_1SmusiHSoN0LpQiBBaC65w6e',
        annualPrice: '1490$',
        limits: { subs: 10 },
        features: ['10 Subcuentas Extra', '+50 Números', 'Ahorra 2 meses con Anual'],
        color: 'bg-purple-600',
    }
];

// 3. PLANES VOLUMEN (Usuarios Standard con >= 10 Subs)
// Solo el Starter reducido, según requerimiento.
const PLANS_VOLUME = [
    {
        id: 'price_1Smv3OHSoN0LpQiBZnKxPhQ3',
        name: 'Starter Volumen',
        priceValue: 15,
        price: '15$',
        annualId: null, // No provisto aún
        annualPrice: '150$',
        limits: { subs: 1 },
        features: ['1 Subcuenta Extra', 'Números Infinitos (99)', 'Precio Volumen (150$/y)'],
        color: 'bg-orange-600',
        badge: 'Volumen'
    }
    // Podríamos añadir los otros a precio full si el cliente quiere crecer rápido
];

// PLAN FOUNDER LIFETIME
const PLAN_LIFETIME = {
    id: 'price_1SmuqPHSoN0LpQiBoPVJaaRY',
    name: 'Founder\'s Pass',
    priceValue: 997,
    price: '997$',
    limits: { subs: 10, slots: 50 },
    features: ['PAGO ÚNICO (Lifetime)', '10 Subcuentas', '50 Números INICIALES', 'Acceso a Addons Especiales'],
    color: 'bg-black border-2 border-yellow-400',
    isOneTime: true,
    badge: 'LIMITED'
};

// --- ADD-ONS ---
const ADDONS = {
    // Definir si usaremos addons específicos o reutilizamos planes
    // Por ahora dejamos placeholder
    SUB_UNIT_STD: 'price_STARTER_29_TEMP',
    SUB_UNIT_VIP: 'price_DISC_REGULAR_15_TEMP',
    SLOT_UNIT_STD: 'price_1SfK787Mhd9qo6A8WmPRs9Zy',
    SLOT_UNIT_VIP: 'price_1SfK827Mhd9qo6A89iZ68SRi'
};

// --- MAPEO DE DETALLES ---
const PLAN_DETAILS = {
    // New IDs
    'price_STARTER_29_TEMP': { label: 'Starter: 1 Sub / 99 Num' },
    'price_GROWTH_49_TEMP': { label: 'Growth: 3 Sub / 99 Num' },
    'price_AGENCY_149_TEMP': { label: 'Agency: 10 Sub / 99 Num' },

    'price_ONETIME_950_TEMP': { label: 'LIFETIME: 10 Sub / 50 Num' },

    'price_DISC_REGULAR_15_TEMP': { label: 'Regular Addon' },
    'price_DISC_PRO_35_TEMP': { label: 'Pro Addon' },
    'price_DISC_ENTERPRISE_125_TEMP': { label: 'Enterprise Addon' },

    // Old IDs (Backwards compat)
    'price_1SfJpk7Mhd9qo6A8AmFiKTdk': { label: 'Legacy Regular' },
    'price_1SfJqb7Mhd9qo6A8zP0xydlX': { label: 'Legacy Pro' },
    'price_1SfJrZ7Mhd9qo6A8WOn6BGbJ': { label: 'Legacy Enterprise' },
};

export default function SubscriptionManager({ token, accountInfo, onDataChange }) {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('services');
    const [loading, setLoading] = useState(false);
    const [subscriptions, setSubscriptions] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [showPlans, setShowPlans] = useState(false);
    const [editingSubId, setEditingSubId] = useState(null);
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'

    // ✅ NUEVO: Estados para pago directo con tarjeta guardada
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null); // { priceId, name, price }

    // 1. Calcular Volumen
    const totalSubs = accountInfo?.limits?.max_subagencies || 0;

    // Check si tiene plan LIFETIME entre sus suscripciones activas
    const hasLifetime = subscriptions.some(s => s.stripe_price_id === PLAN_LIFETIME.id);

    // Regla de Volumen: >= 10 subcuentas
    // (Ojo: Si tiene Lifetime, ya tiene 10, pero Lifetime tiene PRECEDENCIA para mostrar
    // los planes limitados en números. Si NO tiene Lifetime pero tiene 10+, muestra ilimitados)
    const isVolumeUser = totalSubs >= 10 && !hasLifetime;

    // Define hasVolumeDiscount for styling and pricing purposes
    // Applies if Logic Volume User (>=10) OR Lifetime User (Founder)
    const hasVolumeDiscount = totalSubs >= 10 || hasLifetime;

    // DETERMINAR QUÉ PLANES MOSTRAR EL EN CATÁLOGO
    let availablePlans = [];
    let showLifetimeOption = !hasLifetime; // Si ya lo tiene, no mostrarlo para comprar otra vez

    if (hasLifetime) {
        // Usuario Lifetime -> Planes con Descuento pero LIMITADOS en Slots
        // ERROR: This variable is undefined in original file too? No, it was likely defined or I am missing it. Wait.
        // Checking previous file... Step 404 uses PLANS_DISC_LIMITED. But where is it defined?
        // Ah, in Step 396 I might not have seen it.
        // Wait, looking at Step 396 result... I saw PLANS_STANDARD, PLANS_FOUNDER, PLANS_VOLUME. 
        // I did NOT see PLANS_DISC_LIMITED or PLANS_DISC_INFINITE. 
        // Let me check if PLANS_FOUNDER is what was used. 
        // Step 404 line 176: availablePlans = PLANS_DISC_LIMITED;
        // Step 396 shows PLANS_FOUNDER (id: ...Starter Addon...). 
        // Logic suggests PLANS_DISC_LIMITED should be PLANS_FOUNDER.
        availablePlans = PLANS_FOUNDER;
    } else if (isVolumeUser) {
        // Usuario Volumen -> Planes con Descuento e INFINITOS Slots
        availablePlans = PLANS_VOLUME;
    } else {
        // Usuario Normal -> Planes Estándar
        availablePlans = PLANS_STANDARD;
    }

    const subPriceId = hasVolumeDiscount ? ADDONS.SUB_UNIT_VIP : ADDONS.SUB_UNIT_STD;
    const subDisplayPrice = hasVolumeDiscount ? "15$" : "29$";
    const slotDisplayPrice = hasVolumeDiscount ? "3$" : "5$"; // Mantener logic de slots sueltos igual
    const slotPriceId = hasVolumeDiscount ? ADDONS.SLOT_UNIT_VIP : ADDONS.SLOT_UNIT_STD;

    useEffect(() => { 
        fetchSubscriptions(); 
        fetchPaymentMethods(); // ✅ NUEVO: Cargar métodos de pago
    }, []);

    const fetchSubscriptions = async () => {
        setFetching(true);
        try {
            const res = await fetch(`${API_URL}/payments/my-subscriptions`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setSubscriptions(data);
                if (data.length === 0) setShowPlans(true);
            }
        } catch (e) { } finally { setFetching(false); }
    };

    // ✅ NUEVO: Cargar métodos de pago guardados
    const fetchPaymentMethods = async () => {
        try {
            const res = await fetch(`${API_URL}/payments/payment-methods`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setPaymentMethods(data);
            }
        } catch (e) { console.error("Error cargando métodos de pago:", e); }
    };

    // ✅ MODIFICADO: Detectar si hay tarjeta y mostrar modal
    const handlePurchase = async (priceId, planName = 'Plan', planPrice = '') => {
        // Si hay métodos de pago guardados, mostrar modal de confirmación
        if (paymentMethods.length > 0) {
            setSelectedPlan({ priceId, name: planName, price: planPrice });
            setShowConfirmModal(true);
            return;
        }

        // Si no hay tarjeta, redirigir a Checkout (flujo original)
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/payments/subscribe`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ priceId })
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else toast.error("Error: " + (data.error || "Desconocido"));
        } catch (e) { toast.error("Error conexión"); } finally { setLoading(false); }
    };

    // ✅ NUEVO: Confirmar pago directo con tarjeta guardada
    const handleConfirmDirectPayment = async () => {
        if (!selectedPlan || paymentMethods.length === 0) return;
        
        setLoading(true);
        const toastId = toast.loading("Procesando pago...");
        
        try {
            const res = await fetch(`${API_URL}/payments/subscribe-direct`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    priceId: selectedPlan.priceId, 
                    paymentMethodId: paymentMethods[0].id // Usar primera tarjeta
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                toast.success("¡Pago exitoso! Tu plan ha sido activado.", { id: toastId, duration: 5000 });
                setShowConfirmModal(false);
                setSelectedPlan(null);
                fetchSubscriptions();
                if (onDataChange) onDataChange();
            } else if (data.requiresAction) {
                // Si requiere 3DS, manejarlo (por ahora redirigir a checkout)
                toast.info("Se requiere verificación adicional de tu banco. Redirigiendo...", { id: toastId });
                // Fallback a checkout normal
                const checkoutRes = await fetch(`${API_URL}/payments/subscribe`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                    body: JSON.stringify({ priceId: selectedPlan.priceId })
                });
                const checkoutData = await checkoutRes.json();
                if (checkoutData.url) window.location.href = checkoutData.url;
            } else {
                // ⚠️ Mejorado: Mensajes de error más específicos
                const errorMessage = data.error || "Error desconocido";
                let userFriendlyMessage = "Error procesando el pago";
                
                if (errorMessage.includes("card_declined") || errorMessage.includes("declined")) {
                    userFriendlyMessage = "Tu tarjeta fue rechazada. Por favor, verifica los fondos o intenta con otra tarjeta.";
                } else if (errorMessage.includes("insufficient_funds")) {
                    userFriendlyMessage = "Fondos insuficientes en tu tarjeta.";
                } else if (errorMessage.includes("expired")) {
                    userFriendlyMessage = "Tu tarjeta ha expirado. Por favor, actualiza tu método de pago.";
                } else if (errorMessage.includes("authentication")) {
                    userFriendlyMessage = "Se requiere autenticación adicional. Por favor, intenta nuevamente.";
                } else if (errorMessage.includes("processing")) {
                    userFriendlyMessage = "Error procesando con el banco. Intenta en unos minutos.";
                } else {
                    userFriendlyMessage = `Error: ${errorMessage}`;
                }
                
                toast.error(userFriendlyMessage, { id: toastId, duration: 8000 });
                setShowConfirmModal(false);
                setSelectedPlan(null);
            }
        } catch (e) {
            toast.error("Error de conexión. Por favor, verifica tu internet e intenta de nuevo.", { id: toastId, duration: 6000 });
            setShowConfirmModal(false);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePlan = async (subscriptionId, newPriceId) => {
        if (!confirm("¿Confirmar cambio de plan? Se ajustará el cobro inmediatamente.")) return;
        setLoading(true);
        const tId = toast.loading("Actualizando...");
        try {
            const res = await fetch(`${API_URL}/payments/update-plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ subscriptionId, newPriceId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Plan actualizado", { id: tId });
                setEditingSubId(null);
                fetchSubscriptions(); // Recarga la lista local
                if (onDataChange) onDataChange(); // Recarga los límites del dashboard
            } else {
                toast.error("Error: " + data.error, { id: tId });
            }
        } catch (e) { toast.error("Error conexión", { id: tId }); } finally { setLoading(false); }
    };

    const handlePortal = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/payments/portal`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                // 🔥 FIX: Mostrar error con Sonner
                toast.error(data.error || "Error al abrir portal de facturación");
            }
        } catch (e) { 
            toast.error("Error de conexión"); 
        } finally { 
            setLoading(false); 
        }
    };

    const handleCancelClick = async (subId) => {
        const tId = toast.loading("Verificando vinculaciones...");
        try {
            // 1. Verificar qué se va a borrar
            const res = await fetch(`${API_URL}/payments/preview-cancel?subscriptionId=${subId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            toast.dismiss(tId);

            let confirmMsg = "¿Estás seguro de cancelar este plan?";

            if (data.affected && data.affected.length > 0) {
                confirmMsg += "\n\n⚠️ ALERTA: Al cancelar, se desconectarán las siguientes subcuentas y sus números:\n";
                data.affected.forEach(aff => {
                    confirmMsg += `\n• ${aff.name}`;
                    if (aff.numbers.length > 0) {
                        confirmMsg += ` (Nums: ${aff.numbers.join(", ")})`;
                    } else {
                        confirmMsg += ` (Sin números activos)`;
                    }
                });
            } else {
                confirmMsg += "\n\n(No hay subcuentas vinculadas directamente a este plan específico)";
            }

            // 2. Pedir confirmación
            if (!confirm(confirmMsg)) return;

            // 3. Ejecutar Cancelación
            const cancelId = toast.loading("Procesando baja...");
            const cancelRes = await fetch(`${API_URL}/payments/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ subscriptionId: subId })
            });

            if (cancelRes.ok) {
                toast.success("Suscripción cancelada correctamente", { id: cancelId });
                fetchSubscriptions();
                if (onDataChange) onDataChange();
            } else {
                throw new Error("Error al cancelar");
            }

        } catch (e) {
            toast.error("Error: " + e.message);
        }
    };

    return (
        <>
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header y Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
                <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('sub.title')}</h2><p className="text-sm text-gray-500 dark:text-gray-400">{t('sub.subtitle')}</p></div>

                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                    {['services', 'payments', 'invoices'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{tab === 'services' ? t('sub.tab.services') : tab === 'payments' ? t('sub.tab.payments') : t('sub.tab.invoices')}</button>
                    ))}
                </div>
            </div>

            {activeTab === 'services' && (
                <div className="space-y-8">
                    {/* 2. CATÁLOGO PARA NUEVOS PLANES (MOVIDO AL INICIO) */}
                    {(showPlans || (subscriptions.length === 0 && !fetching)) && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Shield size={18} className="text-indigo-500" /> {t('sub.catalog.title')}</h3>
                                {subscriptions.length > 0 && <button onClick={() => setShowPlans(false)} className="text-sm text-gray-500 hover:text-gray-900 underline">{t('sub.catalog.hide')}</button>}
                            </div>

                            {/* TOGGLE MENSUAL / ANUAL */}
                            <div className="flex justify-center mb-8">
                                <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex items-center relative">
                                    <button
                                        onClick={() => setBillingCycle('monthly')}
                                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all z-10 ${billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-md transform scale-105' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {t('sub.billing.monthly')}
                                    </button>
                                    <button
                                        onClick={() => setBillingCycle('annual')}
                                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all z-10 flex items-center gap-2 ${billingCycle === 'annual' ? 'bg-indigo-600 text-white shadow-md transform scale-105' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {t('sub.billing.annual')} <span className="bg-green-100 text-green-700 text-[10px] px-1.5 rounded-full border border-green-200">{t('sub.billing.savings')}</span>
                                    </button>
                                </div>
                            </div>

                            {/* 1. PLANES REGULARES (Grid) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                {availablePlans.map((plan) => {
                                    const isAnnual = billingCycle === 'annual';
                                    // Si no hay plan anual (ej: addons discount), forzamos mensual visualmente o deshabilitamos
                                    const effectivePrice = isAnnual ? (plan.annualPrice || plan.price) : plan.price;
                                    const effectiveId = isAnnual ? (plan.annualId || plan.id) : plan.id;
                                    const savings = isAnnual && plan.annualId ? "Ahorras ~20%" : null;

                                    return (
                                        <div key={plan.id} className={`bg-white dark:bg-gray-900 border rounded-2xl p-6 flex flex-col transition-all hover:shadow-xl ${plan.recommended ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-800'}`}>
                                            <div className="mb-4">
                                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h4>
                                                <div className="flex items-baseline gap-1 mt-2">
                                                    <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{effectivePrice}</span>
                                                    <span className="text-sm text-gray-500">{isAnnual ? t('sub.plan.year') : t('sub.plan.month')}</span>
                                                </div>
                                                {savings && <p className="text-xs font-bold text-green-600 mt-1">{t('sub.billing.save_text')}</p>}
                                            </div>
                                            <ul className="space-y-3 mb-8 flex-1">{plan.features.map((feat, i) => <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-300"><Check size={16} className="text-emerald-500 shrink-0" /> {feat}</li>)}</ul>
                                            <button onClick={() => handlePurchase(effectiveId, plan.name, effectivePrice)} className={`w-full py-3 rounded-xl font-bold text-white transition shadow-lg ${plan.color} hover:opacity-90`}>{loading ? t('sub.plan.processing') : t('sub.plan.contract')}</button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 2. CARD ESPECIAL: LIFETIME (Banner Abajo) */}
                            {showLifetimeOption && (
                                <div className="mt-4">
                                    <div className={`bg-gray-900 border-2 border-yellow-400 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between shadow-2xl relative overflow-hidden group`}>
                                        <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[10px] font-extrabold px-3 py-1 rounded-bl-lg z-10">{t('sub.lifetime.badge')}</div>
                                        <div className="flex-1 mb-6 md:mb-0 z-10">
                                            <h4 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">{t('sub.lifetime.title')} <Crown size={24} className="text-yellow-400" /></h4>
                                            <p className="text-gray-300 mb-4 max-w-xl">{t('sub.lifetime.desc')}</p>
                                            <div className="flex flex-wrap gap-3">
                                                {PLAN_LIFETIME.features.map((feat, i) => (
                                                    <span key={i} className="flex items-center gap-2 text-sm text-gray-300 bg-white/10 px-3 py-1 rounded-full">
                                                        <Check size={14} className="text-yellow-400 shrink-0" /> {feat}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center md:items-end gap-3 z-10 min-w-[200px]">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-extrabold text-white">{PLAN_LIFETIME.price}</span>
                                            </div>
                                            <button onClick={() => handlePurchase(PLAN_LIFETIME.id)} className={`w-full py-3 px-6 rounded-xl font-bold text-black transition shadow-lg bg-yellow-400 hover:bg-yellow-300 hover:scale-105 active:scale-95`}>
                                                {loading ? '...' : t('sub.lifetime.button')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* LISTA DE SERVICIOS */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Package size={20} className="text-indigo-500" /> {t('sub.services.active')}</h3>
                            {subscriptions.length > 0 && (
                                <button onClick={() => setShowPlans(!showPlans)} className={`text-xs font-bold px-4 py-2 rounded-lg transition border flex items-center gap-2 ${showPlans ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-sm'}`}>
                                    {showPlans ? <>{t('sub.catalog.hide')} <ChevronRight size={14} className="rotate-90" /></> : <><Plus size={14} /> {t('sub.catalog.show')}</>}
                                </button>
                            )}
                        </div>

                        {fetching ? <div className="p-10 text-center text-gray-400 animate-pulse">Cargando...</div> : subscriptions.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <AlertCircle size={32} className="text-gray-400 mb-4" />
                                <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('sub.services.empty')}</h4>
                                <p className="text-gray-500 mb-8">{t('sub.services.empty_desc')}</p>
                                {!showPlans && <button onClick={() => setShowPlans(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"><Plus size={20} /> {t('sub.services.view_plans')}</button>}
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {subscriptions.map(sub => {
                                    const details = PLAN_DETAILS[sub.stripe_price_id];
                                    const isEditing = editingSubId === sub.stripe_subscription_id;
                                    const isBase = true; // Todos son base o addon

                                    // Buscar plan en cualquiera de las listas para info
                                    const allPlans = [...PLANS_STANDARD, ...PLANS_FOUNDER, ...PLANS_VOLUME, PLAN_LIFETIME];
                                    const currentPlan = allPlans.find(p => p.id === sub.stripe_price_id);
                                    const currentPriceVal = currentPlan ? currentPlan.priceValue : 0;

                                    return (
                                        <div key={sub.id} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                            <div className="p-6 flex flex-col lg:flex-row items-center justify-between gap-6">
                                                <div className="flex items-center gap-4 w-full lg:w-auto">
                                                    <div className={`p-3 rounded-xl ${isBase ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {isBase ? <Crown size={24} /> : <Zap size={24} />}
                                                    </div>
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="font-bold text-gray-900 dark:text-white text-lg">{sub.product_name}</h4>
                                                            {details && <span className="text-[10px] uppercase font-extrabold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded tracking-wide">{details.label}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                            <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 rounded text-xs">ID: {sub.stripe_subscription_id?.slice(-8)}</span>
                                                            {sub.quantity > 1 && <span className="font-bold text-indigo-600">x{sub.quantity}</span>}
                                                            <span className={`inline-flex items-center gap-1 ml-2 text-xs font-bold capitalize ${sub.status === 'active' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${sub.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></span> {sub.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex gap-3 w-full lg:w-auto justify-end">
                                                    {isBase && (
                                                        <button
                                                            onClick={() => setEditingSubId(isEditing ? null : sub.stripe_subscription_id)}
                                                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition border 
                                                            ${isEditing ? 'bg-gray-900 text-white border-gray-900' : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800'}`}
                                                        >
                                                            {isEditing ? <><XCircle size={14} /> {t('sub.action.close')}</> : <><ArrowRightLeft size={14} /> {t('sub.action.modify')}</>}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleCancelClick(sub.stripe_subscription_id)} // 🔥 USAR LA NUEVA FUNCIÓN
                                                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-600 outline-none hover:bg-red-50 rounded-lg transition"
                                                    >
                                                        <XCircle size={14} /> {t('sub.action.cancel')}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* PANEL DE EDICIÓN IN-APP */}
                                            {isEditing && (
                                                <div className="px-6 pb-6 animate-in slide-in-from-top-2 fade-in">
                                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-indigo-200 dark:border-indigo-900 shadow-inner">
                                                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                                                            <TrendingUp size={16} className="text-indigo-600" /> {t('sub.edit.title')}
                                                        </p>
                                                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                                                            <TrendingUp size={16} className="text-indigo-600" /> Cambiar nivel de suscripción:
                                                        </p>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            {availablePlans.map(plan => {
                                                                const isCurrent = plan.id === sub.stripe_price_id;
                                                                // Si el precio es menor al actual, es Downgrade
                                                                const isDowngrade = plan.priceValue < currentPriceVal;

                                                                return (
                                                                    <button
                                                                        key={plan.id}
                                                                        disabled={isCurrent || loading}
                                                                        onClick={() => handleUpdatePlan(sub.stripe_subscription_id, plan.id)}
                                                                        className={`relative p-4 rounded-xl border text-left transition-all group
                                                                        ${isCurrent
                                                                                ? 'bg-white dark:bg-gray-800 border-indigo-500 ring-2 ring-indigo-500 opacity-80 cursor-default'
                                                                                : isDowngrade
                                                                                    // 🔽 ESTILO DOWNGRADE: Muy sutil, casi invisible si no pasas el mouse
                                                                                    ? 'bg-transparent border-transparent text-gray-400 opacity-50 hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 scale-90'
                                                                                    // 🔼 ESTILO UPGRADE: Normal y destacado
                                                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-md cursor-pointer'
                                                                            }`}
                                                                    >
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <span className={`font-bold text-sm ${isDowngrade ? 'text-gray-500' : 'text-gray-900 dark:text-white'}`}>{plan.name}</span>
                                                                            {isCurrent && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{t('sub.status.current')}</span>}
                                                                        </div>
                                                                        <div className={`text-2xl font-extrabold mb-1 ${isDowngrade ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>{plan.price}</div>
                                                                        <div className="text-xs text-gray-500 dark:text-gray-400">{plan.limits.subs} Agencias / {plan.limits.slots} Slots</div>

                                                                        {!isCurrent && (
                                                                            <div className={`mt-3 text-xs font-bold transition-opacity flex items-center gap-1
                                                                                ${isDowngrade ? 'text-gray-400 group-hover:text-gray-600' : 'text-indigo-600 opacity-0 group-hover:opacity-100'}
                                                                            `}>
                                                                                {isDowngrade ? <><ArrowDown size={12} /> {t('sub.edit.downgrade')}</> : <><TrendingUp size={12} /> {t('sub.edit.upgrade')}</>}
                                                                            </div>
                                                                        )}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>





                    {/* 3. SECCIÓN EXTRAS (Con descuento VIP) */}
                    {
                        subscriptions.length > 0 && (
                            <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><PlusCircle size={18} className="text-emerald-500" /> {t('sub.extras.title')}</h3>
                                    {hasVolumeDiscount && (
                                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase rounded border border-yellow-200 tracking-wide animate-pulse">
                                            {t('sub.extras.vip')}
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* SUBAGENCIA EXTRA */}
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl flex items-center justify-between hover:border-indigo-300 transition group">
                                        <div className="flex items-center gap-4"><div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl"><Building2 size={24} /></div><div><h4 className="font-bold text-gray-900 dark:text-white">{t('sub.extras.subagency')}</h4><p className="text-xs text-gray-500">{t('sub.extras.subagency_desc')} {hasVolumeDiscount ? '(VIP Pack)' : '(Regular)'}</p></div></div>
                                        <div className="text-right">
                                            {/* Precio tachado si hay descuento */}
                                            {hasVolumeDiscount && <span className="block text-xs text-gray-400 line-through">20€</span>}
                                            <p className="text-xl font-bold text-gray-900 dark:text-white">{subDisplayPrice}</p>
                                            <button onClick={() => handlePurchase(subPriceId)} className="text-sm font-bold text-indigo-600 hover:underline">{t('sub.extras.add')}</button>
                                        </div>
                                    </div>

                                    {/* SLOT EXTRA */}
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl flex items-center justify-between hover:border-emerald-300 transition group">
                                        <div className="flex items-center gap-4"><div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl"><Smartphone size={24} /></div><div><h4 className="font-bold text-gray-900 dark:text-white">{t('sub.extras.slot')}</h4><p className="text-xs text-gray-500">{t('sub.extras.slot_desc')}</p></div></div>
                                        <div className="text-right">
                                            {hasVolumeDiscount && <span className="block text-xs text-gray-400 line-through">5€</span>}
                                            <p className="text-xl font-bold text-gray-900 dark:text-white">{slotDisplayPrice}</p>
                                            <button onClick={() => handlePurchase(slotPriceId)} className="text-sm font-bold text-emerald-600 hover:underline">{t('sub.extras.add')}</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div >
            )}

            {/* TAB PAGOS - Formulario Embebido con Stripe Elements */}
            {
                activeTab === 'payments' && (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
                        <div className="max-w-2xl mx-auto">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                                    <CreditCard size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('sub.portal.title')}</h3>
                                    <p className="text-sm text-gray-500">{t('sub.portal.desc')}</p>
                                </div>
                            </div>
                            
                            {/* Formulario de Stripe Elements */}
                            <PaymentMethodForm token={token} />
                            
                            {/* Enlace al portal de Stripe para más opciones */}
                            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
                                <p className="text-sm text-gray-500 mb-3">¿Necesitas más opciones?</p>
                                <button onClick={handlePortal} className="text-indigo-600 hover:text-indigo-700 font-bold text-sm flex items-center gap-2 mx-auto">
                                    Abrir Portal Completo <ExternalLink size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* TAB FACTURAS (Solo Portal) */}
            {
                activeTab === 'invoices' && (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                        <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full mx-auto mb-6 flex items-center justify-center text-gray-400"><CreditCard size={40} /></div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Historial de Facturas</h3>
                        <p className="text-gray-500 mb-8">Consulta y descarga tus facturas desde el portal seguro.</p>
                        <button onClick={handlePortal} className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold mx-auto flex items-center gap-2">{t('sub.portal.button')} <ExternalLink size={18} /></button>
                    </div>
                )
            }
        </div>

        {/* ✅ MODAL DE CONFIRMACIÓN DE PAGO DIRECTO */}
        {showConfirmModal && selectedPlan && paymentMethods.length > 0 && (
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                            <CreditCard size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">¿Confirmar compra?</h3>
                        <p className="text-sm text-gray-500 mt-2">
                            Se realizará un cargo a tu tarjeta
                        </p>
                    </div>
                    
                    {/* Resumen del plan */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-gray-500 text-sm">Plan seleccionado</span>
                            <span className="font-bold text-gray-900 dark:text-white">{selectedPlan.name}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-3">
                            <span className="text-gray-500 text-sm">Total a cobrar</span>
                            <span className="text-2xl font-extrabold text-indigo-600">{selectedPlan.price}</span>
                        </div>
                    </div>

                    {/* ⚠️ Advertencia con tarjeta */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-600">
                                <CreditCard size={20} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                                    Se debitará de tu tarjeta <span className="uppercase">{paymentMethods[0].brand}</span> terminada en <span className="font-mono">{paymentMethods[0].last4}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setShowConfirmModal(false); setSelectedPlan(null); }}
                            disabled={loading}
                            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleConfirmDirectPayment}
                            disabled={loading}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <><RefreshCw size={18} className="animate-spin" /> Procesando...</>
                            ) : (
                                <>Sí, confirmar pago</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}