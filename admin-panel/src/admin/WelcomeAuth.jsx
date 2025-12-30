import React, { useState } from 'react';
import { Smartphone, ArrowRight, CheckCircle2, Building2, User, Mail, Lock, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.clicandapp.com").replace(/\/$/, "");

export default function WelcomeAuth({ onLoginSuccess }) {
    const [authMode, setAuthMode] = useState('USER'); // 'USER' | 'ADMIN'
    
    // Pasos del flujo: PHONE -> PHONE_CODE -> NAME -> EMAIL -> EMAIL_CODE
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
    const [tempToken, setTempToken] = useState(null); // Token temporal para usuarios nuevos

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
                    setStep('NAME'); // 🟢 Usuario nuevo: Vamos al flujo de perfil
                } else {
                    // Usuario existente: Entra directo
                    toast.success("¡Bienvenido de nuevo! 👋");
                    onLoginSuccess({ token: data.token, role: 'agency', agencyId: data.user.agencyId });
                }
            }
        } catch (err) { toast.error(err.message); }
        setLoading(false);
    };

    // --- 2. NOMBRE (Solo nuevos) ---
    const submitName = (e) => {
        e.preventDefault();
        if (name.trim().length < 3) return toast.error("Escribe un nombre válido");
        setStep('EMAIL'); // Pasamos a pedir email
    };

    // --- 3. EMAIL (Solicitar OTP) ---
    const requestEmailOtp = async (e) => {
        e.preventDefault();
        // Validación simple de email
        if (!email.includes('@') || !email.includes('.')) return toast.error("Email inválido");

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/otp/email/request`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, name }) // Enviamos nombre para el correo bonito
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error enviando email");

            toast.success(`Código enviado a ${email} 📧`);
            setStep('EMAIL_CODE');
        } catch (err) { toast.error(err.message); }
        setLoading(false);
    };

    // --- 4. VERIFICAR EMAIL Y FINALIZAR ---
    const verifyEmailOtpAndFinish = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // A. Verificar Código del Email
            const verifyRes = await fetch(`${API_URL}/auth/otp/email/verify`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: emailCode })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Código de email incorrecto");

            // B. Guardar Datos Finales (Update Profile) usando el token temporal
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
            // Login final
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

    return (
        <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950 font-sans transition-colors">
            
            {/* Panel Izquierdo (Visual) */}
            <div className={`hidden lg:flex w-1/2 items-center justify-center relative overflow-hidden transition-all duration-700 ${authMode === 'ADMIN' ? 'bg-gray-900' : 'bg-indigo-600'}`}>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="relative z-10 text-white p-12 max-w-lg">
                    <h1 className="text-5xl font-extrabold mb-6 leading-tight">
                        {authMode === 'ADMIN' ? "Control Maestro" : "Automatiza tu Negocio"}
                    </h1>
                    <p className="text-indigo-100 text-xl font-light">
                        {authMode === 'ADMIN' 
                            ? "Panel de administración del sistema SaaS." 
                            : "Gestiona WhatsApp, Facturación y Clientes en un solo lugar."}
                    </p>
                </div>
            </div>

            {/* Panel Derecho (Formulario) */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-gray-900 relative">
                
                {/* Switch Admin/User */}
                <button onClick={() => { setAuthMode(authMode === 'USER' ? 'ADMIN' : 'USER'); setStep('PHONE'); }} className="absolute top-8 right-8 text-gray-400 hover:text-indigo-600 text-sm font-medium flex gap-2 transition-colors">
                    {authMode === 'USER' ? <><Lock size={16}/> Soy Admin</> : <><Smartphone size={16}/> Volver</>}
                </button>

                <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* --- ADMIN LOGIN FORM --- */}
                    {authMode === 'ADMIN' && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <ShieldCheck size={48} className="mx-auto text-gray-900 dark:text-white mb-4" />
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Administrador</h2>
                            </div>
                            <form onSubmit={handleAdminLogin} className="space-y-4">
                                <input type="email" placeholder="admin@clicandapp.com" className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-gray-500" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required />
                                <input type="password" placeholder="••••••" className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-gray-500" value={adminPass} onChange={e => setAdminPass(e.target.value)} required />
                                <button disabled={loading} className="w-full bg-gray-900 text-white p-4 rounded-xl font-bold hover:bg-black transition">
                                    {loading ? <Loader2 className="animate-spin mx-auto"/> : "Entrar"}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* --- USER REGISTRATION FLOW --- */}
                    {authMode === 'USER' && (
                        <>
                            {/* PASO 1: TELEFONO */}
                            {step === 'PHONE' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Bienvenido 👋</h2>
                                        <p className="text-gray-500 mt-2">Ingresa tu WhatsApp para continuar.</p>
                                    </div>
                                    <form onSubmit={requestPhoneOtp} className="space-y-4">
                                        <div className="relative">
                                            <Smartphone className="absolute left-4 top-4 text-gray-400" />
                                            <input type="tel" placeholder="595981..." className="w-full pl-12 p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-lg tracking-wide outline-none focus:ring-2 focus:ring-indigo-500" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))} required />
                                        </div>
                                        <button disabled={loading || phone.length < 8} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition flex justify-center items-center gap-2">
                                            {loading ? <Loader2 className="animate-spin"/> : <>Continuar <ArrowRight size={20}/></>}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* PASO 2: OTP TELEFONO */}
                            {step === 'PHONE_CODE' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verifica tu número</h2>
                                        <p className="text-gray-500 mt-2">Enviamos un código a +{phone}</p>
                                    </div>
                                    <form onSubmit={verifyPhoneOtp} className="space-y-4">
                                        <input type="text" maxLength={6} placeholder="000000" className="w-full text-center text-3xl font-bold tracking-[0.5em] p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={phoneCode} onChange={e => setPhoneCode(e.target.value)} required />
                                        <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition">
                                            {loading ? <Loader2 className="animate-spin mx-auto"/> : "Verificar"}
                                        </button>
                                        <button type="button" onClick={() => setStep('PHONE')} className="w-full text-sm text-gray-400 hover:text-indigo-600">Cambiar número</button>
                                    </form>
                                </div>
                            )}

                            {/* PASO 3: NOMBRE (Solo nuevos) */}
                            {step === 'NAME' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="text-center">
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">¡Hola! 😊</h2>
                                        <p className="text-gray-500 mt-2">¿Cómo te llamas o cómo se llama tu agencia?</p>
                                    </div>
                                    <form onSubmit={submitName} className="space-y-4">
                                        <div className="relative">
                                            <User className="absolute left-4 top-4 text-gray-400" />
                                            <input type="text" placeholder="Tu Nombre / Agencia" className="w-full pl-12 p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-lg outline-none focus:ring-2 focus:ring-indigo-500" value={name} onChange={e => setName(e.target.value)} required />
                                        </div>
                                        <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition flex justify-center items-center gap-2">
                                            Siguiente <ArrowRight size={20}/>
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* PASO 4: EMAIL (Solicitar OTP) */}
                            {step === 'EMAIL' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Un gusto, {name} ✨</h2>
                                        <p className="text-gray-500 mt-2">Necesitamos validar tu email corporativo.</p>
                                    </div>
                                    <form onSubmit={requestEmailOtp} className="space-y-4">
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-4 text-gray-400" />
                                            <input type="email" placeholder="nombre@empresa.com" className="w-full pl-12 p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-lg outline-none focus:ring-2 focus:ring-indigo-500" value={email} onChange={e => setEmail(e.target.value)} required />
                                        </div>
                                        <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition flex justify-center items-center gap-2">
                                            {loading ? <Loader2 className="animate-spin"/> : <>Enviar Código <ArrowRight size={20}/></>}
                                        </button>
                                        <button type="button" onClick={() => setStep('NAME')} className="w-full text-sm text-gray-400 flex items-center justify-center gap-1 hover:text-gray-600"><ArrowLeft size={14}/> Volver</button>
                                    </form>
                                </div>
                            )}

                            {/* PASO 5: OTP EMAIL */}
                            {step === 'EMAIL_CODE' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Revisa tu correo 📧</h2>
                                        <p className="text-gray-500 mt-2">Enviamos un código de 6 dígitos a <br/><b>{email}</b></p>
                                    </div>
                                    <form onSubmit={verifyEmailOtpAndFinish} className="space-y-4">
                                        <input type="text" maxLength={6} placeholder="000000" className="w-full text-center text-3xl font-bold tracking-[0.5em] p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" value={emailCode} onChange={e => setEmailCode(e.target.value)} required />
                                        <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-bold transition flex justify-center items-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none">
                                            {loading ? <Loader2 className="animate-spin"/> : <>Finalizar y Entrar <CheckCircle2 size={20}/></>}
                                        </button>
                                        <button type="button" onClick={() => setStep('EMAIL')} className="w-full text-sm text-gray-400 hover:text-indigo-600">Corregir email</button>
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