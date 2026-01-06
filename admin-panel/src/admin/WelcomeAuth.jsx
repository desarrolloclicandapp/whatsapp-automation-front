import React, { useState } from 'react';
import { Smartphone, ArrowRight, CheckCircle2, User, Mail, Lock, Loader2, ShieldCheck, ArrowLeft, Globe, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useBranding } from '../context/BrandingContext'; 

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

export default function WelcomeAuth({ onLoginSuccess }) {
    // ✅ CAMBIO: Usamos systemBranding del contexto.
    // Esto mostrará lo que el Admin configure globalmente.
    const { systemBranding } = useBranding(); 
    const branding = systemBranding;

    const [authMode, setAuthMode] = useState('USER'); 
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

    // --- LÓGICA DE AUTH ---

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

    const submitName = (e) => {
        e.preventDefault();
        if (name.trim().length < 3) return toast.error("Escribe un nombre válido");
        setStep('EMAIL');
    };

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

    return (
        <div className="min-h-screen flex font-sans transition-colors relative" style={{backgroundColor: branding.backgroundColor}}>
            
            {/* --- PANEL IZQUIERDO (VISUAL IDENTITY WaFloW.ai) --- */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden transition-all duration-1000">
                
                {/* Imagen de Fondo */}
                <div 
                    className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-105"
                    style={{ backgroundImage: `url(${branding.loginImage})` }}
                ></div>

                {/* Overlay con Gradiente de Marca */}
                <div className="absolute inset-0" style={{
                    background: `linear-gradient(135deg, ${branding.primaryColor}CC 0%, ${branding.backgroundColor}E6 50%, ${branding.accentColor}40 100%)`,
                    mixBlendMode: 'multiply'
                }}></div>

                {/* Contenido Flotante */}
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-16 text-white text-center">
                    
                    {/* Logo con Efecto Glass */}
                    <div className="mb-8 p-4 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl animate-in zoom-in duration-500">
                        <img src={branding.logoUrl} alt="Logo" className="w-16 h-16 object-contain filter drop-shadow-lg" onError={(e) => e.target.style.display = 'none'} />
                    </div>

                    {/* Slogan */}
                    <h1 className="text-5xl font-extrabold mb-6 tracking-tight leading-tight drop-shadow-xl font-sans">
                        {authMode === 'ADMIN' ? "Centro de Comando" : branding.slogan}
                    </h1>
                    
                    {/* Voz de Marca */}
                    <p className="text-lg text-white/90 max-w-lg leading-relaxed font-light mb-10">
                        {authMode === 'ADMIN' 
                            ? "Gestión global de infraestructura y clientes." 
                            : "Tecnología humana para flujos inteligentes. Estabilidad, velocidad y escalabilidad para tu WhatsApp."}
                    </p>

                    {/* Core Values */}
                    <div className="flex gap-3 text-xs font-bold uppercase tracking-widest text-white">
                        <span className="px-4 py-2 rounded-full text-[#001F3F] shadow-[0_0_15px_rgba(255,255,255,0.3)]" style={{backgroundColor: branding.accentColor}}>Speed</span>
                        <span className="px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/20">Scalability</span>
                        <span className="px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/20">Trust</span>
                    </div>
                </div>
            </div>

            {/* --- PANEL DERECHO (FORMULARIO) --- */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-[#0B0D12] relative transition-colors duration-300">
                
                {/* Botón Switch Modo (User/Admin) */}
                <button 
                    onClick={() => { setAuthMode(authMode === 'USER' ? 'ADMIN' : 'USER'); setStep('PHONE'); setAdminEmail(""); setAdminPass(""); }} 
                    className="absolute top-8 right-8 px-5 py-2 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-opacity-80 transition-all bg-gray-100 dark:bg-white/5 rounded-full flex items-center gap-2"
                    style={{color: authMode === 'USER' ? branding.primaryColor : undefined}}
                >
                    {authMode === 'USER' ? <><Lock size={12}/> Acceso Admin</> : <><Smartphone size={12}/> Soy Usuario</>}
                </button>

                <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* --- ADMIN LOGIN FORM --- */}
                    {authMode === 'ADMIN' && (
                        <div className="space-y-8">
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg" style={{backgroundColor: branding.backgroundColor}}>
                                    <ShieldCheck size={32} style={{color: branding.accentColor}} />
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Panel</h2>
                                <p className="text-gray-500 mt-2">Credenciales maestras de {branding.name}.</p>
                            </div>
                            <form onSubmit={handleAdminLogin} className="space-y-5">
                                <div className="space-y-4">
                                    <input type="email" placeholder="admin@..." className="w-full p-4 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white outline-none focus:ring-2 transition-all" style={{'--tw-ring-color': branding.primaryColor}} value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required />
                                    <input type="password" placeholder="••••••" className="w-full p-4 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white outline-none focus:ring-2 transition-all" style={{'--tw-ring-color': branding.primaryColor}} value={adminPass} onChange={e => setAdminPass(e.target.value)} required />
                                </div>
                                <button disabled={loading} className="w-full text-white p-4 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg hover:shadow-xl active:scale-95" style={{backgroundColor: branding.backgroundColor}}>
                                    {loading ? <Loader2 className="animate-spin mx-auto"/> : "Iniciar Sesión"}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* --- USER REGISTRATION FLOW --- */}
                    {authMode === 'USER' && (
                        <>
                            {step === 'PHONE' && (
                                <div className="space-y-8">
                                    <div className="text-center">
                                        <div className="inline-block p-3 rounded-2xl mb-6 shadow-md" style={{backgroundColor: branding.primaryColor + '15'}}>
                                            <img src={branding.logoUrl} alt="Logo" className="h-10 object-contain" onError={(e) => e.target.style.display='none'} />
                                        </div>
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Empieza Ahora</h2>
                                        <p className="text-gray-500 mt-2">Ingresa a la nueva era de la automatización.</p>
                                    </div>
                                    <form onSubmit={requestPhoneOtp} className="space-y-6">
                                        <div className="relative group">
                                            <span className="absolute left-4 top-4 text-gray-400 font-mono text-lg">+</span>
                                            <input type="tel" placeholder="595981..." className="w-full pl-10 p-4 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white text-lg tracking-wide outline-none focus:ring-2 transition-all" style={{'--tw-ring-color': branding.accentColor}} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))} required />
                                        </div>
                                        <button disabled={loading || phone.length < 8} className="w-full text-white p-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 flex justify-center items-center gap-2" 
                                            style={{
                                                background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.accentColor})`,
                                                textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }}>
                                            {loading ? <Loader2 className="animate-spin"/> : <>Continuar <ArrowRight size={20}/></>}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {step === 'PHONE_CODE' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Código de Seguridad</h2>
                                        <p className="text-gray-500 mt-2">Enviado a <span className="font-mono font-bold">+{phone}</span></p>
                                    </div>
                                    <form onSubmit={verifyPhoneOtp} className="space-y-6">
                                        <input type="text" maxLength={6} placeholder="000000" className="w-full text-center text-4xl font-bold tracking-[0.5em] p-4 rounded-xl border-2 dark:bg-gray-800 dark:text-white outline-none focus:ring-4 transition-all" style={{borderColor: branding.primaryColor}} value={phoneCode} onChange={e => setPhoneCode(e.target.value)} required />
                                        <button disabled={loading} className="w-full text-white p-4 rounded-xl font-bold transition-all shadow-lg" style={{backgroundColor: branding.primaryColor}}>
                                            {loading ? <Loader2 className="animate-spin mx-auto"/> : "Verificar"}
                                        </button>
                                        <button type="button" onClick={() => setStep('PHONE')} className="w-full text-sm text-gray-400 hover:text-opacity-80 transition" style={{color: branding.primaryColor}}>
                                            ¿Número incorrecto? Cambiar
                                        </button>
                                    </form>
                                </div>
                            )}

                            {step === 'NAME' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                                    <div className="text-center">
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">¡Hola!</h2>
                                        <p className="text-gray-500 mt-2">¿Cómo se llama tu agencia?</p>
                                    </div>
                                    <form onSubmit={submitName} className="space-y-6">
                                        <input type="text" placeholder="Agencia Pro..." autoFocus className="w-full p-4 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white text-lg outline-none focus:ring-2 transition-all" style={{'--tw-ring-color': branding.primaryColor}} value={name} onChange={e => setName(e.target.value)} required />
                                        <button className="w-full text-white p-4 rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2" style={{backgroundColor: branding.primaryColor}}>
                                            Siguiente <ArrowRight size={20}/>
                                        </button>
                                    </form>
                                </div>
                            )}

                            {step === 'EMAIL' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Un gusto, {name} ✨</h2>
                                        <p className="text-gray-500 mt-2">Validemos tu email corporativo.</p>
                                    </div>
                                    <form onSubmit={requestEmailOtp} className="space-y-6">
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-4 text-gray-400" />
                                            <input type="email" placeholder="nombre@empresa.com" className="w-full pl-12 p-4 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white text-lg outline-none focus:ring-2 transition-all" style={{'--tw-ring-color': branding.primaryColor}} value={email} onChange={e => setEmail(e.target.value)} required />
                                        </div>
                                        <button disabled={loading} className="w-full text-white p-4 rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2" style={{backgroundColor: branding.primaryColor}}>
                                            {loading ? <Loader2 className="animate-spin"/> : <>Enviar Código <Mail size={18}/></>}
                                        </button>
                                        <button type="button" onClick={() => setStep('NAME')} className="w-full text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-2">
                                            <ArrowLeft size={14}/> Volver atrás
                                        </button>
                                    </form>
                                </div>
                            )}

                            {step === 'EMAIL_CODE' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Revisa tu Email 📧</h2>
                                        <p className="text-gray-500 mt-2">Código enviado a <span className="font-bold">{email}</span></p>
                                    </div>
                                    <form onSubmit={verifyEmailOtpAndFinish} className="space-y-6">
                                        <input type="text" maxLength={6} placeholder="000000" className="w-full text-center text-4xl font-bold tracking-[0.5em] p-4 rounded-xl border-2 dark:bg-gray-800 dark:text-white outline-none focus:ring-4 transition-all" style={{borderColor: branding.primaryColor}} value={emailCode} onChange={e => setEmailCode(e.target.value)} required />
                                        <button disabled={loading} className="w-full text-white p-4 rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2" style={{backgroundColor: branding.accentColor, color: branding.backgroundColor}}>
                                            {loading ? <Loader2 className="animate-spin"/> : <>Finalizar <CheckCircle2 size={20}/></>}
                                        </button>
                                        <button type="button" onClick={() => setStep('EMAIL')} className="w-full text-sm text-gray-400 hover:text-opacity-80 transition" style={{color: branding.primaryColor}}>
                                            ¿Email incorrecto? Corregir
                                        </button>
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