import React, { useState } from 'react';
import { Smartphone, ArrowRight, CheckCircle2, Building2, User, Mail, Lock, Loader2 } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.clicandapp.com").replace(/\/$/, "");

export default function WelcomeAuth({ onLoginSuccess }) {
    const [step, setStep] = useState('PHONE'); // PHONE | OTP | PROFILE
    const [loading, setLoading] = useState(false);
    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    
    // Datos Perfil
    const [email, setEmail] = useState("");
    const [name, setName] = useState(""); // Nombre Agencia/Usuario
    const [tempToken, setTempToken] = useState(null); // Token temporal para completar perfil

    // 1. Enviar Teléfono
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/otp/request`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (data.success) setStep('OTP');
            else alert(data.error || "Error al enviar código");
        } catch (e) { alert("Error de conexión"); }
        setLoading(false);
    };

    // 2. Verificar Código
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/otp/verify`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, code })
            });
            const data = await res.json();
            
            if (data.token) {
                if (data.isNewUser) {
                    // Usuario nuevo: Guardar token temporal y pedir datos
                    setTempToken(data.token);
                    setStep('PROFILE');
                } else {
                    // Usuario existente: Login directo
                    onLoginSuccess({ token: data.token, role: 'agency', agencyId: data.user.agencyId }); // Asegurar formato que espera App.jsx
                }
            } else {
                alert(data.error || "Código inválido");
            }
        } catch (e) { alert("Error de conexión"); }
        setLoading(false);
    };

    // 3. Completar Perfil
    const handleCompleteProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/profile/complete`, {
                method: "POST", 
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${tempToken}`
                },
                body: JSON.stringify({ email, agencyName: name })
            });
            const data = await res.json();
            if (data.success) {
                // Perfil completado, login final
                // Decodificar token para obtener agencyId si es necesario, o volver a pedir info
                // Por simplicidad, usamos el token que ya tenemos
                onLoginSuccess({ token: tempToken, role: 'agency' }); 
            } else {
                alert(data.error);
            }
        } catch (e) { alert("Error guardando perfil"); }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex bg-gray-50 font-sans">
            {/* PANEL IZQUIERDO (Visual) - Igual que antes */}
            <div className="hidden lg:flex w-1/2 bg-indigo-600 items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 opacity-90"></div>
                <div className="relative z-10 text-white p-12 max-w-lg">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 shadow-inner">
                        <Building2 size={32} className="text-white" />
                    </div>
                    <h1 className="text-5xl font-bold mb-6 leading-tight tracking-tight">Acceso Simplificado</h1>
                    <p className="text-indigo-100 text-lg mb-8 leading-relaxed">
                        Ingresa de forma segura utilizando tu número de WhatsApp. Sin contraseñas que recordar.
                    </p>
                </div>
            </div>

            {/* PANEL DERECHO (Formularios) */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 animate-in slide-in-from-right-10 duration-500 fade-in">
                <div className="max-w-md w-full bg-white lg:bg-transparent p-8 lg:p-0 rounded-2xl shadow-xl lg:shadow-none">
                    
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                            {step === 'PHONE' && "Ingresa a Clic&App"}
                            {step === 'OTP' && "Verificar Código"}
                            {step === 'PROFILE' && "Completa tu Cuenta"}
                        </h2>
                        <p className="text-gray-500 mt-2">
                            {step === 'PHONE' && "Te enviaremos un código a tu WhatsApp."}
                            {step === 'OTP' && `Enviado al +${phone}`}
                            {step === 'PROFILE' && "Solo unos datos más para terminar."}
                        </p>
                    </div>

                    {/* PASO 1: TELEFONO */}
                    {step === 'PHONE' && (
                        <form onSubmit={handleRequestOtp} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Número de WhatsApp</label>
                                <div className="relative">
                                    <Smartphone className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input 
                                        type="tel" required placeholder="595981..." 
                                        value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Incluye el código de país sin el símbolo +.</p>
                            </div>
                            <button type="submit" disabled={loading || phone.length < 6} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="animate-spin" /> : <>Continuar <ArrowRight size={18} /></>}
                            </button>
                        </form>
                    )}

                    {/* PASO 2: OTP */}
                    {step === 'OTP' && (
                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Código de 6 dígitos</label>
                                <input 
                                    type="text" required placeholder="123456" maxLength={6}
                                    value={code} onChange={e => setCode(e.target.value)}
                                    className="w-full text-center text-2xl tracking-[0.5em] font-bold py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <button type="submit" disabled={loading || code.length < 6} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="animate-spin" /> : "Verificar e Ingresar"}
                            </button>
                            <button type="button" onClick={() => setStep('PHONE')} className="w-full text-sm text-gray-500 hover:text-indigo-600">Cambiar número</button>
                        </form>
                    )}

                    {/* PASO 3: PERFIL (Solo nuevos) */}
                    {step === 'PROFILE' && (
                        <form onSubmit={handleCompleteProfile} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de tu Agencia</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input 
                                        type="text" required placeholder="Mi Agencia Digital"
                                        value={name} onChange={e => setName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Corporativo</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input 
                                        type="email" required placeholder="contacto@agencia.com"
                                        value={email} onChange={e => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="animate-spin" /> : <>Finalizar Registro <CheckCircle2 size={18} /></>}
                            </button>
                        </form>
                    )}

                </div>
            </div>
        </div>
    );
}