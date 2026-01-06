import React, { useState } from 'react';
import { Check, LogOut, AlertTriangle, Loader2 } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

const PLANES = [
    {
        id: 'price_1SfJpk7Mhd9qo6A8AmFiKTdk',
        name: 'Plan Regular',
        price: '20€',
        desc: 'Ideal para comenzar.',
        features: ['1 Subcuenta', '99 Slots WhatsApp', 'Soporte Estándar'],
    },
    {
        id: 'price_1SfJqb7Mhd9qo6A8zP0xydlX',
        name: 'Agencia Pro',
        price: '90€',
        desc: 'Para agencias en crecimiento.',
        features: ['5 Subcuentas', '99 Slots WhatsApp', 'Marca Blanca'],
        popular: true
    },
    {
        id: 'price_1SfJrZ7Mhd9qo6A8WOn6BGbJ',
        name: 'Enterprise',
        price: '200€',
        desc: 'Control total a gran escala.',
        features: ['10 Subcuentas', '99 Slots WhatsApp', 'API Prioritaria'],
    }
];

export default function SubscriptionBlocker({ token, onLogout }) {
    const [loadingPlan, setLoadingPlan] = useState(null);

    const handlePurchase = async (priceId) => {
        setLoadingPlan(priceId);
        try {
            const res = await fetch(`${API_URL}/payments/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ priceId })
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else alert("Error al conectar con Stripe");
        } catch (e) { 
            alert("Error de conexión"); 
        } finally { 
            setLoadingPlan(null); 
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-gray-900 flex flex-col items-center justify-center p-4 overflow-y-auto">
            <div className="max-w-6xl w-full space-y-10 py-10">
                
                {/* HEADER BLOQUEO */}
                <div className="text-center space-y-4">
                    <div className="mx-auto w-20 h-20 bg-amber-500/20 text-amber-500 rounded-3xl flex items-center justify-center animate-bounce">
                        <AlertTriangle size={40} />
                    </div>
                    <h2 className="text-4xl font-black text-white">Tu acceso ha expirado</h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Selecciona un plan para reactivar tu cuenta inmediatamente. Todos tus dispositivos y configuraciones se mantendrán intactos.
                    </p>
                    <button 
                        onClick={onLogout}
                        className="flex items-center gap-2 mx-auto px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/10"
                    >
                        <LogOut size={18} /> Cerrar Sesión
                    </button>
                </div>

                {/* GRILLA DE PLANES */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {PLANES.map((plan) => (
                        <div key={plan.id} className={`relative flex flex-col p-8 rounded-[2.5rem] border-2 transition-all ${plan.popular ? 'border-indigo-500 bg-indigo-500/5 shadow-2xl shadow-indigo-500/20' : 'border-white/10 bg-white/5 text-white'}`}>
                            {plan.popular && (
                                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest">
                                    Recomendado
                                </span>
                            )}
                            <div className="mb-8">
                                <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                                <p className="text-gray-400 mt-1">{plan.desc}</p>
                            </div>
                            <div className="mb-8">
                                <span className="text-6xl font-black text-white">{plan.price}</span>
                                <span className="text-gray-400 font-medium ml-2">/mes</span>
                            </div>
                            <ul className="space-y-4 mb-12 flex-1">
                                {plan.features.map((f, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-300">
                                        <Check size={20} className="text-emerald-500 shrink-0" /> {f}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={() => handlePurchase(plan.id)}
                                disabled={loadingPlan !== null}
                                className={`w-full py-5 rounded-2xl font-bold text-xl transition-all flex items-center justify-center gap-2
                                    ${plan.popular ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg' : 'bg-white text-gray-900 hover:bg-gray-200'}
                                `}
                            >
                                {loadingPlan === plan.id ? <Loader2 className="animate-spin" /> : 'Activar Cuenta'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}