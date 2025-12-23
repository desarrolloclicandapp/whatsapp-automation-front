import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Check, Zap, Building2, Smartphone,
    CreditCard, FileText, ExternalLink, Crown, AlertCircle,
    ArrowRightLeft, Plus, ChevronRight, Package, Shield, PlusCircle,
    TrendingUp, XCircle, ArrowDown
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.clicandapp.com").replace(/\/$/, "");

// --- CONFIGURACIÓN DE PLANES BASE ---
// Ordenados por precio para calcular upgrades/downgrades
const BASE_PLANS = [
    {
        id: 'price_1SfJpk7Mhd9qo6A8AmFiKTdk',
        name: 'Plan Regular',
        priceValue: 20, // Para lógica de comparación
        price: '20€',
        limits: { subs: 1, slots: 5 },
        features: ['1 Subcuenta', '5 Números incluidos'],
        color: 'bg-blue-600',
        badge: 'Start'
    },
    {
        id: 'price_1SfJqb7Mhd9qo6A8zP0xydlX',
        name: 'Agencia Pro',
        priceValue: 90,
        price: '90€',
        limits: { subs: 5, slots: 25 },
        features: ['5 Subcuentas', '25 Números incluidos', 'Marca Blanca'],
        color: 'bg-indigo-600',
        recommended: true,
        badge: 'Popular'
    },
    {
        id: 'price_1SfJrZ7Mhd9qo6A8WOn6BGbJ',
        name: 'Enterprise',
        priceValue: 200,
        price: '200€',
        limits: { subs: 10, slots: 50 },
        features: ['10 Subcuentas', '50 Números incluidos', 'API', 'Descuento VIP'],
        color: 'bg-purple-600',
        badge: 'VIP'
    }
];

// --- ADD-ONS ---
const ADDONS = {
    // ID del Plan Regular (20€) para usuarios normales
    SUB_UNIT_STD: 'price_1SfJpk7Mhd9qo6A8AmFiKTdk',
    // ID del Pack VIP (10€) para usuarios con >10 agencias
    // ¡Asegúrate de que este ID exista en tu STRIPE_CONFIG del backend!
    SUB_UNIT_VIP: 'price_1SfK547Mhd9qo6A8SfvT8GF4',

    SLOT_UNIT_STD: 'price_1SfK787Mhd9qo6A8WmPRs9Zy', // 5€
    SLOT_UNIT_VIP: 'price_1SfK827Mhd9qo6A89iZ68SRi'  // 3€
};

// --- MAPEO DE DETALLES ---
const PLAN_DETAILS = {
    'price_1SfJpk7Mhd9qo6A8AmFiKTdk': { label: '1 Subcuenta / 5 Slots' },
    'price_1SfJqb7Mhd9qo6A8zP0xydlX': { label: '5 Subcuentas / 25 Slots' },
    'price_1SfJrZ7Mhd9qo6A8WOn6BGbJ': { label: '10 Subcuentas / 50 Slots' },

    // VIP IDs - Asegúrate de que estos IDs coincidan con los de tu backend
    'price_1SfK547Mhd9qo6A8SfvT8GF4': { label: '+1 Subcuenta (VIP)' },

    // Slot IDs
    'price_1SfK787Mhd9qo6A8WmPRs9Zy': { label: '+1 Slot Extra' },
    'price_1SfK827Mhd9qo6A89iZ68SRi': { label: '+1 Slot Extra (VIP)' }
};

export default function SubscriptionManager({ token, accountInfo, onDataChange }) {
    const [activeTab, setActiveTab] = useState('services');
    const [loading, setLoading] = useState(false);
    const [subscriptions, setSubscriptions] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [showPlans, setShowPlans] = useState(false);
    const [editingSubId, setEditingSubId] = useState(null);

    // 1. Calcular Volumen
    const totalSubs = accountInfo?.limits?.max_subagencies || 0;
    const hasVolumeDiscount = totalSubs >= 10;

    // 2. Seleccionar Precios Dinámicos
    // Si es VIP, usa el precio reducido. Si no, usa el precio estándar.
    const subPriceId = hasVolumeDiscount ? ADDONS.SUB_UNIT_VIP : ADDONS.SUB_UNIT_STD;
    const subDisplayPrice = hasVolumeDiscount ? "10€ (VIP)" : "20€";

    const slotPriceId = hasVolumeDiscount ? ADDONS.SLOT_UNIT_VIP : ADDONS.SLOT_UNIT_STD;
    const slotDisplayPrice = hasVolumeDiscount ? "3€ (VIP)" : "5€";

    useEffect(() => { fetchSubscriptions(); }, []);

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

    const handlePurchase = async (priceId) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/payments/subscribe`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ priceId })
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else alert("Error: " + (data.error || "Desconocido"));
        } catch (e) { alert("Error conexión"); } finally { setLoading(false); }
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
            if (data.url) window.location.href = data.url;
        } catch (e) { alert("Error"); } finally { setLoading(false); }
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
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header y Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
                <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Suscripción</h2><p className="text-sm text-gray-500 dark:text-gray-400">Administra tus recursos.</p></div>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                    {['services', 'payments', 'invoices'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{tab === 'services' ? 'Mis Servicios' : tab === 'payments' ? 'Métodos de Pago' : 'Facturas'}</button>
                    ))}
                </div>
            </div>

            {activeTab === 'services' && (
                <div className="space-y-8">
                    {/* LISTA DE SERVICIOS */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Package size={20} className="text-indigo-500" /> Servicios Activos</h3>
                            {subscriptions.length > 0 && (
                                <button onClick={() => setShowPlans(!showPlans)} className={`text-xs font-bold px-4 py-2 rounded-lg transition border flex items-center gap-2 ${showPlans ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-sm'}`}>
                                    {showPlans ? <>Cerrar Catálogo <ChevronRight size={14} className="rotate-90" /></> : <><Plus size={14} /> Contratar Nuevo Plan</>}
                                </button>
                            )}
                        </div>

                        {fetching ? <div className="p-10 text-center text-gray-400 animate-pulse">Cargando...</div> : subscriptions.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <AlertCircle size={32} className="text-gray-400 mb-4" />
                                <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No hay servicios</h4>
                                <p className="text-gray-500 mb-8">Contrata un plan para comenzar.</p>
                                {!showPlans && <button onClick={() => setShowPlans(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"><Plus size={20} /> Ver Planes</button>}
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {subscriptions.map(sub => {
                                    const details = PLAN_DETAILS[sub.stripe_price_id];
                                    const isEditing = editingSubId === sub.stripe_subscription_id;
                                    const isBase = sub.type === 'base';

                                    // Buscar el plan actual para comparar precios
                                    const currentPlan = BASE_PLANS.find(p => p.id === sub.stripe_price_id);
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
                                                            {isEditing ? <><XCircle size={14} /> Cerrar</> : <><ArrowRightLeft size={14} /> Modificar</>}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleCancelClick(sub.stripe_subscription_id)} // 🔥 USAR LA NUEVA FUNCIÓN
                                                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-600 ..."
                                                    >
                                                        <XCircle size={14} /> Cancelar
                                                    </button>
                                                </div>
                                            </div>

                                            {/* PANEL DE EDICIÓN IN-APP */}
                                            {isEditing && (
                                                <div className="px-6 pb-6 animate-in slide-in-from-top-2 fade-in">
                                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-indigo-200 dark:border-indigo-900 shadow-inner">
                                                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                                                            <TrendingUp size={16} className="text-indigo-600" /> Cambiar nivel de suscripción:
                                                        </p>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            {BASE_PLANS.map(plan => {
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
                                                                            {isCurrent && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">ACTUAL</span>}
                                                                        </div>
                                                                        <div className={`text-2xl font-extrabold mb-1 ${isDowngrade ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>{plan.price}</div>
                                                                        <div className="text-xs text-gray-500 dark:text-gray-400">{plan.limits.subs} Agencias / {plan.limits.slots} Slots</div>

                                                                        {!isCurrent && (
                                                                            <div className={`mt-3 text-xs font-bold transition-opacity flex items-center gap-1
                                                                                ${isDowngrade ? 'text-gray-400 group-hover:text-gray-600' : 'text-indigo-600 opacity-0 group-hover:opacity-100'}
                                                                            `}>
                                                                                {isDowngrade ? <><ArrowDown size={12} /> Reducir Plan</> : <><TrendingUp size={12} /> Mejorar Plan</>}
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

                    {/* 2. CATÁLOGO PARA NUEVOS PLANES */}
                    {(showPlans || subscriptions.length === 0) && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Shield size={18} className="text-indigo-500" /> Catálogo de Planes</h3>
                                {subscriptions.length > 0 && <span className="text-sm text-gray-500">Estos planes se sumarán a tu suscripción actual.</span>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {BASE_PLANS.map((plan) => (
                                    <div key={plan.id} className={`bg-white dark:bg-gray-900 border rounded-2xl p-6 flex flex-col transition-all hover:shadow-xl ${plan.recommended ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-800'}`}>
                                        <div className="mb-4"><h4 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h4><div className="flex items-baseline gap-1 mt-2"><span className="text-3xl font-extrabold text-gray-900 dark:text-white">{plan.price}</span><span className="text-sm text-gray-500">/mes</span></div></div>
                                        <ul className="space-y-3 mb-8 flex-1">{plan.features.map((feat, i) => <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-300"><Check size={16} className="text-emerald-500 shrink-0" /> {feat}</li>)}</ul>
                                        <button onClick={() => handlePurchase(plan.id)} className={`w-full py-3 rounded-xl font-bold text-white transition shadow-lg ${plan.color} hover:opacity-90`}>{loading ? 'Procesando...' : 'Contratar Plan'}</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3. SECCIÓN EXTRAS (Con descuento VIP) */}
                    {subscriptions.length > 0 && (
                        <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-800">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><PlusCircle size={18} className="text-emerald-500" /> Extras</h3>
                                {hasVolumeDiscount && (
                                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase rounded border border-yellow-200 tracking-wide animate-pulse">
                                        ⚡ Precios VIP Activos
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* SUBAGENCIA EXTRA */}
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl flex items-center justify-between hover:border-indigo-300 transition group">
                                    <div className="flex items-center gap-4"><div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl"><Building2 size={24} /></div><div><h4 className="font-bold text-gray-900 dark:text-white">Subagencia Extra</h4><p className="text-xs text-gray-500">+1 Agencia / 5 Slots {hasVolumeDiscount ? '(VIP Pack)' : '(Regular)'}</p></div></div>
                                    <div className="text-right">
                                        {/* Precio tachado si hay descuento */}
                                        {hasVolumeDiscount && <span className="block text-xs text-gray-400 line-through">20€</span>}
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">{subDisplayPrice}</p>
                                        <button onClick={() => handlePurchase(subPriceId)} className="text-sm font-bold text-indigo-600 hover:underline">Añadir</button>
                                    </div>
                                </div>

                                {/* SLOT EXTRA */}
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl flex items-center justify-between hover:border-emerald-300 transition group">
                                    <div className="flex items-center gap-4"><div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl"><Smartphone size={24} /></div><div><h4 className="font-bold text-gray-900 dark:text-white">Slot Extra</h4><p className="text-xs text-gray-500">+1 Número WhatsApp</p></div></div>
                                    <div className="text-right">
                                        {hasVolumeDiscount && <span className="block text-xs text-gray-400 line-through">5€</span>}
                                        <p className="text-xl font-bold text-gray-900 dark:text-white">{slotDisplayPrice}</p>
                                        <button onClick={() => handlePurchase(slotPriceId)} className="text-sm font-bold text-emerald-600 hover:underline">Añadir</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB PAGOS/FACTURAS (Solo Portal) */}
            {(activeTab === 'payments' || activeTab === 'invoices') && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full mx-auto mb-6 flex items-center justify-center text-gray-400"><CreditCard size={40} /></div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Gestión de Facturación</h3>
                    <p className="text-gray-500 mb-8">Gestiona tarjetas y facturas de forma segura.</p>
                    <button onClick={handlePortal} className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold mx-auto flex items-center gap-2">Ir al Portal Seguro <ExternalLink size={18} /></button>
                </div>
            )}
        </div>
    );
}