import React, { useState } from 'react';
import { Smartphone, ArrowRight, CheckCircle2, Building2, User, Mail, Lock, Loader2, ShieldCheck } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.clicandapp.com").replace(/\/$/, "");

export default function WelcomeAuth({ onLoginSuccess }) {
    // MODOS: 'OTP' (Usuarios) | 'ADMIN' (Email/Pass)
    const [authMode, setAuthMode] = useState('OTP'); 
    
    // Estados OTP
    const [step, setStep] = useState('PHONE'); // PHONE | CODE | PROFILE
    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    
    // Estados Perfil / Admin
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState(""); // Para login admin
    const [name, setName] = useState(""); 
    
    const [loading, setLoading] = useState(false);
    const [tempToken, setTempToken] = useState(null);

    // --- LÓGICA OTP (USUARIOS) ---
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/otp/request`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (data.success) setStep('CODE');
            else alert(data.error || "Error al enviar código");
        } catch (e) { alert("Error de conexión"); }
        setLoading(false);
    };

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
                    setTempToken(data.token);
                    setStep('PROFILE');
                } else {
                    onLoginSuccess({ token: data.token, role: 'agency', agencyId: data.user.agencyId });
                }
            } else {
                alert(data.error || "Código inválido");
            }
        } catch (e) { alert("Error de conexión"); }
        setLoading(false);
    };

    const handleCompleteProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/profile/complete`, {
                method: "POST", 
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tempToken}` },
                body: JSON.stringify({ email, agencyName: name })
            });
            const data = await res.json();
            if (data.success) onLoginSuccess({ token: tempToken, role: 'agency' });
            else alert(data.error);
        } catch (e) { alert("Error guardando perfil"); }
        setLoading(false);
    };

    // --- LÓGICA ADMIN (EMAIL/PASS) ---
    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                onLoginSuccess(data); // data trae token, role, etc.
            } else {
                alert(data.error || "Credenciales incorrectas");
            }
        } catch (e) { alert("Error de conexión"); }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex bg-gray-50 font-sans">
            {/* PANEL IZQUIERDO */}
            <div className={`hidden lg:flex w-1/2 items-center justify-center relative overflow-hidden transition-colors duration-500 ${authMode === 'ADMIN' ? 'bg-gray-900' : 'bg-indigo-600'}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${authMode === 'ADMIN' ? 'from-gray-800 to-black' : 'from-indigo-600 to-purple-700'} opacity-90`}></div>
                <div className="relative z-10 text-white p-12 max-w-lg">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 shadow-inner">
                        {authMode === 'ADMIN' ? <ShieldCheck size={32} /> : <Building2 size={32} />}
                    </div>
                    <h1 className="text-5xl font-bold mb-6 leading-tight tracking-tight">
                        {authMode === 'ADMIN' ? "Panel Maestro" : "Acceso Simplificado"}
                    </h1>
                    <p className="text-indigo-100 text-lg mb-8 leading-relaxed">
                        {authMode === 'ADMIN' 
                            ? "Gestión centralizada para administradores del sistema." 
                            : "Ingresa de forma segura utilizando tu número de WhatsApp. Sin contraseñas."}
                    </p>
                </div>
            </div>

            {/* PANEL DERECHO */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 animate-in slide-in-from-right-10 duration-500 fade-in relative">
                
                {/* BOTÓN TOGGLE ADMIN (Esquina superior derecha) */}
                <button 
                    onClick={() => {
                        setAuthMode(authMode === 'OTP' ? 'ADMIN' : 'OTP');
                        setStep('PHONE'); // Resetear pasos
                        setEmail(""); setPassword(""); // Limpiar inputs
                    }}
                    className="absolute top-8 right-8 text-gray-400 hover:text-indigo-600 transition flex items-center gap-2 text-sm font-medium"
                >
                    {authMode === 'OTP' ? (
                        <><Lock size={16} /> Soy Admin</>
                    ) : (
                        <><Smartphone size={16} /> Volver a WhatsApp</>
                    )}
                </button>

                <div className="max-w-md w-full bg-white lg:bg-transparent p-8 lg:p-0 rounded-2xl shadow-xl lg:shadow-none">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                            {authMode === 'ADMIN' ? "Administrador" : (
                                step === 'PHONE' ? "Ingresa a Clic&App" :
                                step === 'CODE' ? "Verificar Código" : "Completa tu Cuenta"
                            )}
                        </h2>
                        <p className="text-gray-500 mt-2">
                            {authMode === 'ADMIN' ? "Ingresa con tus credenciales maestras." : (
                                step === 'PHONE' ? "Te enviaremos un código a tu WhatsApp." :
                                step === 'CODE' ? `Enviado al +${phone}` : "Solo unos datos más."
                            )}
                        </p>
                    </div>

                    {/* --- FORMULARIO ADMIN --- */}
                    {authMode === 'ADMIN' && (
                        <form onSubmit={handleAdminLogin} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Admin</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 outline-none" placeholder="admin@clicandapp.com" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 outline-none" placeholder="••••••" />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="animate-spin" /> : "Entrar al Panel"}
                            </button>
                        </form>
                    )}

                    {/* --- FORMULARIO OTP (USUARIOS) --- */}
                    {authMode === 'OTP' && (
                        <>
                            {step === 'PHONE' && (
                                <form onSubmit={handleRequestOtp} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Número de WhatsApp</label>
                                        <div className="relative">
                                            <Smartphone className="absolute left-3 top-3 text-gray-400" size={18} />
                                            <input type="tel" required placeholder="595981..." value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={loading || phone.length < 6} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
                                        {loading ? <Loader2 className="animate-spin" /> : <>Continuar <ArrowRight size={18} /></>}
                                    </button>
                                </form>
                            )}

                            {step === 'CODE' && (
                                <form onSubmit={handleVerifyOtp} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Código de 6 dígitos</label>
                                        <input type="text" required placeholder="123456" maxLength={6} value={code} onChange={e => setCode(e.target.value)} className="w-full text-center text-2xl tracking-[0.5em] font-bold py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                    <button type="submit" disabled={loading || code.length < 6} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
                                        {loading ? <Loader2 className="animate-spin" /> : "Verificar e Ingresar"}
                                    </button>
                                    <button type="button" onClick={() => setStep('PHONE')} className="w-full text-sm text-gray-500 hover:text-indigo-600">Cambiar número</button>
                                </form>
                            )}

                            {step === 'PROFILE' && (
                                <form onSubmit={handleCompleteProfile} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de tu Agencia</label>
                                        <input type="text" required placeholder="Mi Agencia" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input type="email" required placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
                                        {loading ? <Loader2 className="animate-spin" /> : "Finalizar Registro"}
                                    </button>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}