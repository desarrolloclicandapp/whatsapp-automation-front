import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { toast } from 'sonner';
import { CreditCard, Plus, Trash2, Loader2, CheckCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

// 🔥 Cargar Stripe con tu clave pública
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_live_your_key_here');

// Estilos para CardElement
const cardStyle = {
    style: {
        base: {
            color: '#1f2937',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '16px',
            '::placeholder': { color: '#9ca3af' },
        },
        invalid: { color: '#ef4444' },
    },
};

// Componente interno del formulario (requiere estar dentro de Elements)
function CardForm({ token, onSuccess, t }) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [clientSecret, setClientSecret] = useState(null);

    // Obtener SetupIntent al montar
    useEffect(() => {
        async function fetchSetupIntent() {
            try {
                const res = await fetch(`${API_URL}/payments/setup-intent`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                if (data.clientSecret) {
                    setClientSecret(data.clientSecret);
                } else {
                    toast.error(data.error || t('sub.payment.form_error'));
                }
            } catch (e) {
                toast.error(t('sub.toast.error_connection'));
            }
        }
        fetchSetupIntent();
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements || !clientSecret) return;

        setLoading(true);
        const toastId = toast.loading(t('sub.payment.saving_card'));

        try {
            const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
                payment_method: {
                    card: elements.getElement(CardElement),
                }
            });

            if (error) {
                toast.error(error.message, { id: toastId });
            } else if (setupIntent.status === 'succeeded') {
                toast.success(t('sub.payment.card_saved'), { id: toastId });
                if (onSuccess) onSuccess();
            }
        } catch (e) {
            toast.error(t('sub.payment.save_error'), { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    if (!clientSecret) {
        return (
            <div className="flex items-center justify-center p-8 text-gray-400">
                <Loader2 className="animate-spin mr-2" size={20} />
                {t('sub.payment.preparing')}
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <CardElement options={cardStyle} />
            </div>
            <button
                type="submit"
                disabled={!stripe || loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition"
            >
                {loading ? (
                    <><Loader2 className="animate-spin" size={18} /> {t('sub.payment.saving')}</>
                ) : (
                    <><Plus size={18} /> {t('sub.payment.save_card')}</>
                )}
            </button>
        </form>
    );
}

// Componente principal exportado
export default function PaymentMethodForm({ token, onMethodAdded }) {
    const { t } = useLanguage();
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Cargar métodos de pago
    const fetchMethods = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/payments/payment-methods`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPaymentMethods(data);
            }
        } catch (e) {
            console.error("Error cargando métodos de pago:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchMethods(); }, [token]);

    // Eliminar método de pago
    const handleDelete = async (paymentMethodId) => {
        if (!confirm(t('sub.payment.confirm_delete'))) return;
        
        const toastId = toast.loading(t('sub.payment.deleting'));
        try {
            const res = await fetch(`${API_URL}/payments/payment-methods/${paymentMethodId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success(t('sub.payment.deleted'), { id: toastId });
                fetchMethods();
            } else {
                const data = await res.json();
                toast.error(data.error || t('sub.payment.delete_error'), { id: toastId });
            }
        } catch (e) {
            toast.error(t('sub.toast.error_connection'), { id: toastId });
        }
    };

    // Callback cuando se agrega tarjeta exitosamente
    const handleSuccess = () => {
        setShowForm(false);
        fetchMethods();
        if (onMethodAdded) onMethodAdded();
    };

    // Mapeo de marcas de tarjeta a colores/iconos
    const brandColors = {
        visa: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        mastercard: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        amex: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
        default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    };

    return (
        <div className="space-y-6">
            {/* Lista de métodos de pago */}
            <div className="space-y-3">
                {loading ? (
                    <div className="text-center py-8 text-gray-400 animate-pulse">
                        {t('sub.payment.loading')}
                    </div>
                ) : paymentMethods.length > 0 ? (
                    paymentMethods.map(pm => (
                        <div 
                            key={pm.id} 
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between hover:border-indigo-300 transition"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-lg ${brandColors[pm.brand] || brandColors.default}`}>
                                    <CreditCard size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900 dark:text-white capitalize">{pm.brand}</span>
                                        <span className="text-gray-500 dark:text-gray-400 font-mono">•••• {pm.last4}</span>
                                    </div>
                                    <span className="text-xs text-gray-400">{t('sub.payment.expires')} {pm.expMonth.toString().padStart(2, '0')}/{pm.expYear}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleDelete(pm.id)}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                title={t('sub.payment.delete_btn')}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 text-gray-400">
                        <CreditCard size={32} className="mx-auto mb-2 opacity-50" />
                        <p>{t('sub.payment.no_methods')}</p>
                    </div>
                )}
            </div>

            {/* Formulario para agregar tarjeta */}
            {showForm ? (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Plus size={18} className="text-indigo-500" />
                            {t('sub.payment.add_new_card')}
                        </h4>
                        <button 
                            onClick={() => setShowForm(false)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            {t('sub.payment.cancel')}
                        </button>
                    </div>
                    <Elements stripe={stripePromise}>
                        <CardForm token={token} onSuccess={handleSuccess} t={t} />
                    </Elements>
                </div>
            ) : (
                <button
                    onClick={() => setShowForm(true)}
                    className="w-full py-4 border-2 border-dashed border-indigo-200 dark:border-indigo-900 hover:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                >
                    <Plus size={20} />
                    {t('sub.payment.add_method')}
                </button>
            )}
        </div>
    );
}
