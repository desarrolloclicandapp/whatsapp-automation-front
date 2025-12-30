import React, { useState } from 'react';
import { Smartphone, ArrowRight, CheckCircle2, Building2, User, Mail, Lock, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner'; // ✅ IMPORTAMOS SONNER

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

export default function WelcomeAuth({ onLoginSuccess }) {
    const [authMode, setAuthMode] = useState('OTP'); 
    
    const [step, setStep] = useState('PHONE'); 
    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState(""); 
    const [name, setName] = useState(""); 
    
    const [loading, setLoading] = useState(false);
    const [tempToken, setTempToken] = useState(null);

    // --- LÓGICA OTP (USUARIOS) ---
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        
        // Validación básica de número (Paraguay: 595...)
        if (phone.length < 10) {
            toast.error("El número parece incompleto", { description: "Asegúrate de incluir el código de país (Ej: 595...)" });
            return;
        }

        setLoading(true);
        const toastId = toast.loading("Enviando código...");

        try {
            const res = await fetch(`${API_URL}/auth/otp/request`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone })
            });
            
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || "Error al solicitar OTP");

            toast.success("Código enviado", { id: toastId, description: `Revisa tu WhatsApp ${phone}` });
            setStep('CODE');

        } catch (err) {
            console.error(err);
            toast.error("Error de conexión", { id: toastId, description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading("Verificando...");

        try {
            const res = await fetch(`${API_URL}/auth/otp/verify`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, code })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || "Código inválido");

            if (data.token) {
                toast.dismiss(toastId);
                if (data.isNewUser) {
                    setTempToken(data.token);
                    setStep('PROFILE');
                    toast.info("¡Bienvenido!", { description: "Completa tus datos para terminar." });
                } else {
                    toast.success("¡Bienvenido de nuevo!");
                    onLoginSuccess({ token: data.token, role: 'agency', agencyId: data.user.agencyId });
                }
            }
        } catch (err) {
            toast.error("Error de verificación", { id: toastId, description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading("Creando cuenta...");

        try {
            const res = await fetch(`${API_URL}/auth/profile/complete`, {
                method: "POST", 
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tempToken}` },
                body: JSON.stringify({ email, agencyName: name })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || "Error al completar perfil");

            toast.success("Cuenta creada exitosamente", { id: toastId });
            onLoginSuccess({ token: tempToken, role: 'agency' });

        } catch (err) {
            toast.error("Error", { id: toastId, description: err.message });
        } finally {
            setLoading(false);
        }
    };

    // --- LÓGICA ADMIN (EMAIL/PASS) ---
    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading("Iniciando sesión...");

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (res.ok) {
                toast.success("Acceso concedido", { id: toastId });
                onLoginSuccess(data);
            } else {
                throw new Error(data.error || "Credenciales incorrectas");
            }
        } catch (err) {
            toast.error("Error de acceso", { id: toastId, description: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950 font-sans transition-colors">
            {/* PANEL IZQUIERDO */}
            <div className={`hidden lg:flex w-1/2 items-center justify-center relative overflow-hidden transition-all duration-700 ${authMode === 'ADMIN' ? 'bg-gray-900' : 'bg-indigo-600'}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${authMode === 'ADMIN' ? 'from-gray-800 to-black' : 'from-indigo-600 to-purple-700'} opacity-90`}></div>
                <div className="relative z-10 text-white p-12 max-w-lg">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-8 shadow-2xl border border-white/10">
                        {authMode === 'ADMIN' ? <ShieldCheck size={40} /> : <Building2 size={40} />}
                    </div>
                    <h1 className="text-5xl font-extrabold mb-6 leading-tight tracking-tight">
                        {authMode === 'ADMIN' ? "Panel Maestro" : "Acceso Simplificado"}
                    </h1>
                    <p className="text-indigo-100 text-xl mb-8 leading-relaxed font-light">
                        {authMode === 'ADMIN' 
                            ? "Gestión centralizada para administradores del sistema." 
                            : "Ingresa de forma segura utilizando tu número de WhatsApp. Sin contraseñas."}
                    </p>
                </div>
            </div>

            {/* PANEL DERECHO */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 animate-in slide-in-from-right-8 duration-500 fade-in relative bg-white dark:bg-gray-900">
                
                {/* BOTÓN TOGGLE ADMIN */}
                <button 
                    onClick={() => {
                        setAuthMode(authMode === 'OTP' ? 'ADMIN' : 'OTP');
                        setStep('PHONE'); setEmail(""); setPassword(""); 
                    }}
                    className="absolute top-8 right-8 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                    {authMode === 'OTP' ? <><Lock size={16} /> Soy Admin</> : <><Smartphone size={16} /> Volver a WhatsApp</>}
                </button>

                <div className="max-w-md w-full">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {authMode === 'ADMIN' ? "Administrador" : (
                                step === 'PHONE' ? "Ingresa a Clic&App" :
                                step === 'CODE' ? "Verificar Código" : "Completa tu Cuenta"
                            )}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-3 text-lg">
                            {authMode === 'ADMIN' ? "Ingresa con tus credenciales maestras." : (
                                step === 'PHONE' ? "Te enviaremos un código a tu WhatsApp." :
                                step === 'CODE' ? `Enviado al +${phone}` : "Solo unos datos más."
                            )}
                        </p>
                    </div>

                    {/* --- FORMULARIO ADMIN --- */}
                    {authMode === 'ADMIN' && (
                        <form onSubmit={handleAdminLogin} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email Admin</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-gray-500 outline-none transition text-gray-900 dark:text-white" placeholder="admin@clicandapp.com" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-gray-500 outline-none transition text-gray-900 dark:text-white" placeholder="••••••" />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition shadow-lg flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="animate-spin" /> : "Entrar al Panel"}
                            </button>
                        </form>
                    )}

                    {/* --- FORMULARIO OTP (USUARIOS) --- */}
                    {authMode === 'OTP' && (
                        <>
                            {step === 'PHONE' && (
                                <form onSubmit={handleRequestOtp} className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Número de WhatsApp</label>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input 
                                                type="tel" required placeholder="595981..." 
                                                value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))} 
                                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-gray-900 dark:text-white text-lg tracking-wide placeholder:text-gray-400" 
                                            />
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2 ml-1">Incluye el código de país (Ej: 595 para PY, 54 para AR) sin el +.</p>
                                    </div>
                                    <button type="submit" disabled={loading || phone.length < 8} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                                        {loading ? <Loader2 className="animate-spin" /> : <>Continuar <ArrowRight size={20} /></>}
                                    </button>
                                </form>
                            )}

                            {step === 'CODE' && (
                                <form onSubmit={handleVerifyOtp} className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Código de Verificación</label>
                                        <input 
                                            type="text" required placeholder="000000" maxLength={6} 
                                            value={code} onChange={e => setCode(e.target.value)} 
                                            className="w-full text-center text-3xl tracking-[0.5em] font-bold py-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-gray-900 dark:text-white placeholder:text-gray-300" 
                                        />
                                    </div>
                                    <button type="submit" disabled={loading || code.length < 6} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2">
                                        {loading ? <Loader2 className="animate-spin" /> : "Verificar e Ingresar"}
                                    </button>
                                    <button type="button" onClick={() => setStep('PHONE')} className="w-full text-sm font-medium text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                                        ¿Número incorrecto? Cambiar
                                    </button>
                                </form>
                            )}

                            {step === 'PROFILE' && (
                                <form onSubmit={handleCompleteProfile} className="space-y-5 animate-in fade-in slide-in-from-right-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nombre de tu Agencia</label>
                                        <input type="text" required placeholder="Mi Agencia Digital" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-gray-900 dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email Corporativo</label>
                                        <input type="email" required placeholder="contacto@agencia.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-gray-900 dark:text-white" />
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2 hover:-translate-y-0.5">
                                        {loading ? <Loader2 className="animate-spin" /> : <>Finalizar Registro <CheckCircle2 size={20} /></>}
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