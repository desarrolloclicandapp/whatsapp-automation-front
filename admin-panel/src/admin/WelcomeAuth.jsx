import React, { useState } from 'react';
import { Smartphone, ArrowRight, CheckCircle2, User, Mail, Lock, Loader2, ShieldCheck, ArrowLeft, Globe, Zap } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.clicandapp.com").replace(/\/$/, "");

export default function WelcomeAuth({ onLoginSuccess }) {
    const [authMode, setAuthMode] = useState('USER'); // 'USER' | 'ADMIN'
    const [step, setStep] = useState('PHONE'); 
    
    // Estados del formulario
    const [phone, setPhone] = useState("");
    const [phoneCode, setPhoneCode] = useState("");
    const [name, setName] = useState(""); 
    const [email, setEmail] = useState("");
    const [emailCode, setEmailCode] = useState("");
    
    // Admin login
    const [adminEmail, setAdminEmail] = useState("");
    const [adminPass, setAdminPass] = useState("");

    const [loading, setLoading] = useState(false);
    const [tempToken, setTempToken] = useState(null);

    // --- 1. TELÉFONO ---
    const requestPhoneOtp = async (e) => {
        e.preventDefault();
        if (phone.length < 8) return toast.error("Número muy corto");
        
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/otp/request`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error solicitando OTP");
            
            toast.success("Código enviado a WhatsApp 📱");
            setStep('PHONE_CODE');
        } catch (err) { toast.error(err.message); }
        setLoading(false);
    };

    const verifyPhoneOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/otp/verify`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, code: phoneCode })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Código incorrecto");

            if (data.token) {
                if (data.isNewUser) {
                    setTempToken(data.token);
                    setStep('NAME');
                } else {
                    toast.success("¡Bienvenido de nuevo! 👋");
                    onLoginSuccess({ token: data.token, role: 'agency', agencyId: data.user.agencyId });
                }
            }
        } catch (err) { toast.error(err.message); }
        setLoading(false);
    };

    // --- 2. NOMBRE ---
    const submitName = (e) => {
        e.preventDefault();
        if (name.trim().length < 3) return toast.error("Escribe un nombre válido");
        setStep('EMAIL');
    };

    // --- 3. EMAIL ---
    const requestEmailOtp = async (e) => {
        e.preventDefault();
        if (!email.includes('@') || !email.includes('.')) return toast.error("Email inválido");

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/otp/email/request`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, name })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error enviando email");

            toast.success(`Código enviado a ${email} 📧`);
            setStep('EMAIL_CODE');
        } catch (err) { toast.error(err.message); }
        setLoading(false);
    };

    // --- 4. VERIFICAR EMAIL ---
    const verifyEmailOtpAndFinish = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const verifyRes = await fetch(`${API_URL}/auth/otp/email/verify`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: emailCode })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Código de email incorrecto");

            const updateRes = await fetch(`${API_URL}/auth/profile/complete`, {
                method: "POST", 
                headers: { 
                    "Content-Type": "application/json", 
                    "Authorization": `Bearer ${tempToken}` 
                },
                body: JSON.stringify({ email, agencyName: name })
            });
            
            if (!updateRes.ok) throw new Error("Error guardando perfil");

            toast.success("¡Cuenta verificada y creada! 🚀");
            onLoginSuccess({ token: tempToken, role: 'agency' });

        } catch (err) { toast.error(err.message); }
        setLoading(false);
    };

    // --- ADMIN LOGIN ---
    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: adminEmail, password: adminPass })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Modo Admin Activado ⚡");
                onLoginSuccess(data);
            } else throw new Error(data.error);
        } catch (err) { toast.error(err.message); }
        setLoading(false);
    };

    // --- BACKGROUND IMAGES ---
    // User: Tecnología abstracta / conexión
    const bgUser = "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1974&auto=format&fit=crop"; 
    // Admin: Arquitectura moderna / control / oscuro
    const bgAdmin = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop";

    return (
        <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950 font-sans transition-colors">
            
            {/* --- PANEL IZQUIERDO (VISUAL PRO) --- */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden transition-all duration-1000">
                
                {/* Imagen de Fondo con Transición */}
                <div 
                    className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-105"
                    style={{ backgroundImage: `url(${authMode === 'ADMIN' ? bgAdmin : bgUser})` }}
                ></div>

                {/* Overlay Degradado (Oscurece la imagen para leer texto) */}
                <div className={`absolute inset-0 transition-colors duration-700 
                    ${authMode === 'ADMIN' 
                        ? 'bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-black/90' 
                        : 'bg-gradient-to-br from-indigo-900/80 via-purple-900/80 to-blue-900/80'}`
                }></div>

                {/* Contenido Flotante */}
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-16 text-white text-center">
                    
                    {/* Icono Principal con efecto Glass */}
                    <div className="w-24 h-24 mb-8 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl animate-in zoom-in duration-500">
                        {authMode === 'ADMIN' 
                            ? <ShieldCheck size={48} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" /> 
                            : <Zap size={48} className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                        }
                    </div>

                    <h1 className="text-5xl font-bold mb-6 tracking-tight leading-tight drop-shadow-lg">
                        {authMode === 'ADMIN' ? "Centro de Comando" : "Automatiza tu Negocio"}
                    </h1>
                    
                    <p className="text-lg text-white/80 max-w-md leading-relaxed font-light mb-10">
                        {authMode === 'ADMIN' 
                            ? "Acceso restringido para la gestión global de infraestructura y clientes." 
                            : "Centraliza WhatsApp, CRM y Facturación en una plataforma inteligente diseñada para crecer."}
                    </p>

                    {/* Badges / Características */}
                    <div className="flex gap-4 text-sm font-medium text-white/90">
                        <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-2">
                            <Globe size={16} /> Global
                        </div>
                        <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-2">
                            <Lock size={16} /> Seguro
                        </div>
                    </div>
                </div>

                {/* Decoración Sutil (Círculos) */}
                <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/50 to-transparent"></div>
            </div>

            {/* --- PANEL DERECHO (FORMULARIO) --- */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-gray-900 relative">
                
                {/* Switch Admin/User */}
                <button 
                    onClick={() => { setAuthMode(authMode === 'USER' ? 'ADMIN' : 'USER'); setStep('PHONE'); setAdminEmail(""); setAdminPass(""); }} 
                    className="absolute top-8 right-8 px-4 py-2 text-sm font-medium text-gray-500 hover:text-indigo-600 dark:hover:text-white transition-all flex items-center gap-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                    {authMode === 'USER' 
                        ? <><Lock size={16}/> Acceso Admin</> 
                        : <><Smartphone size={16}/> Soy Usuario</>
                    }
                </button>

                <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* --- ADMIN LOGIN FORM --- */}
                    {authMode === 'ADMIN' && (
                        <div className="space-y-8">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                    <ShieldCheck size={32} className="text-gray-900 dark:text-white" />
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Bienvenido, Admin</h2>
                                <p className="text-gray-500 mt-2">Ingresa tus credenciales maestras.</p>
                            </div>
                            <form onSubmit={handleAdminLogin} className="space-y-5">
                                <div className="space-y-4">
                                    <input type="email" placeholder="admin@clicandapp.com" className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 transition-all" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required />
                                    <input type="password" placeholder="Contraseña" className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 transition-all" value={adminPass} onChange={e => setAdminPass(e.target.value)} required />
                                </div>
                                <button disabled={loading} className="w-full bg-gray-900 text-white p-4 rounded-xl font-bold hover:bg-black hover:scale-[1.02] active:scale-95 transition-all shadow-lg">
                                    {loading ? <Loader2 className="animate-spin mx-auto"/> : "Iniciar Sesión"}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* --- USER REGISTRATION FLOW --- */}
                    {authMode === 'USER' && (
                        <>
                            {/* PASO 1: TELEFONO */}
                            {step === 'PHONE' && (
                                <div className="space-y-8">
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-indigo-600 dark:text-indigo-400">
                                            <Smartphone size={32} />
                                        </div>
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Empieza Ahora</h2>
                                        <p className="text-gray-500 mt-2">Ingresa tu WhatsApp para acceder o crear tu cuenta.</p>
                                    </div>
                                    <form onSubmit={requestPhoneOtp} className="space-y-6">
                                        <div className="relative group">
                                            <span className="absolute left-4 top-4 text-gray-400 font-mono text-lg">+</span>
                                            <input type="tel" placeholder="595981..." className="w-full pl-10 p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-lg tracking-wide outline-none focus:ring-2 focus:ring-indigo-600 transition-all group-hover:border-indigo-300" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))} required />
                                        </div>
                                        <button disabled={loading || phone.length < 8} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 dark:shadow-none hover:shadow-indigo-300 hover:-translate-y-0.5 flex justify-center items-center gap-2">
                                            {loading ? <Loader2 className="animate-spin"/> : <>Continuar <ArrowRight size={20}/></>}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* PASO 2: OTP TELEFONO */}
                            {step === 'PHONE_CODE' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verifica tu número</h2>
                                        <p className="text-gray-500 mt-2">Enviamos un código a <span className="font-mono font-bold text-gray-800 dark:text-gray-200">+{phone}</span></p>
                                    </div>
                                    <form onSubmit={verifyPhoneOtp} className="space-y-6">
                                        <input type="text" maxLength={6} placeholder="000000" className="w-full text-center text-4xl font-bold tracking-[0.5em] p-4 rounded-xl border-2 border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all" value={phoneCode} onChange={e => setPhoneCode(e.target.value)} required />
                                        <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition-all shadow-lg">
                                            {loading ? <Loader2 className="animate-spin mx-auto"/> : "Verificar Código"}
                                        </button>
                                        <button type="button" onClick={() => setStep('PHONE')} className="w-full text-sm text-gray-400 hover:text-indigo-600 transition">¿Número incorrecto? Cambiar</button>
                                    </form>
                                </div>
                            )}

                            {/* PASO 3: NOMBRE */}
                            {step === 'NAME' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500">
                                            <span className="text-2xl">👋</span>
                                        </div>
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">¡Hola!</h2>
                                        <p className="text-gray-500 mt-2">¿Cómo te llamas o cómo se llama tu agencia?</p>
                                    </div>
                                    <form onSubmit={submitName} className="space-y-6">
                                        <input type="text" placeholder="Ej: Agencia Digital Pro" autoFocus className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={name} onChange={e => setName(e.target.value)} required />
                                        <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-bold transition-all shadow-lg hover:-translate-y-0.5 flex justify-center items-center gap-2">
                                            Siguiente <ArrowRight size={20}/>
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* PASO 4: EMAIL */}
                            {step === 'EMAIL' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Un gusto, {name} ✨</h2>
                                        <p className="text-gray-500 mt-2">Para terminar, necesitamos validar tu email corporativo.</p>
                                    </div>
                                    <form onSubmit={requestEmailOtp} className="space-y-6">
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-4 text-gray-400" />
                                            <input type="email" placeholder="nombre@empresa.com" className="w-full pl-12 p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={email} onChange={e => setEmail(e.target.value)} required />
                                        </div>
                                        <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition-all shadow-lg hover:-translate-y-0.5 flex justify-center items-center gap-2">
                                            {loading ? <Loader2 className="animate-spin"/> : <>Enviar Código de Verificación <Mail size={18}/></>}
                                        </button>
                                        <button type="button" onClick={() => setStep('NAME')} className="w-full text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-2"><ArrowLeft size={14}/> Volver atrás</button>
                                    </form>
                                </div>
                            )}

                            {/* PASO 5: OTP EMAIL */}
                            {step === 'EMAIL_CODE' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
                                            <Mail size={32} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Revisa tu bandeja 📧</h2>
                                        <p className="text-gray-500 mt-2">Hemos enviado un código a <span className="font-bold">{email}</span></p>
                                    </div>
                                    <form onSubmit={verifyEmailOtpAndFinish} className="space-y-6">
                                        <input type="text" maxLength={6} placeholder="000000" className="w-full text-center text-4xl font-bold tracking-[0.5em] p-4 rounded-xl border-2 border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all" value={emailCode} onChange={e => setEmailCode(e.target.value)} required />
                                        <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-emerald-300/30 hover:-translate-y-0.5 flex justify-center items-center gap-2">
                                            {loading ? <Loader2 className="animate-spin"/> : <>Finalizar Registro <CheckCircle2 size={20}/></>}
                                        </button>
                                        <button type="button" onClick={() => setStep('EMAIL')} className="w-full text-sm text-gray-400 hover:text-indigo-600">¿Email incorrecto? Corregir</button>
                                    </form>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}