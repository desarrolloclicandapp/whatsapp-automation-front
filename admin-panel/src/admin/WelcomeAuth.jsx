import React, { useState } from 'react';
import { Smartphone, ArrowRight, CheckCircle2, Building2, User, Mail, Lock, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.clicandapp.com").replace(/\/$/, "");

export default function WelcomeAuth({ onLoginSuccess }) {
    const [authMode, setAuthMode] = useState('USER'); // 'USER' | 'ADMIN'
    
    // Pasos: PHONE -> PHONE_CODE -> NAME -> EMAIL -> EMAIL_CODE
    const [step, setStep] = useState('PHONE'); 
    
    const [phone, setPhone] = useState("");
    const [phoneCode, setPhoneCode] = useState("");
    const [name, setName] = useState(""); 
    const [email, setEmail] = useState("");
    const [emailCode, setEmailCode] = useState("");
    const [adminPass, setAdminPass] = useState("");

    const [loading, setLoading] = useState(false);
    const [tempToken, setTempToken] = useState(null); // Token temporal del usuario nuevo

    // --- 1. TELÉFONO ---
    const requestPhoneOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/otp/request`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            toast.success("Código enviado por WhatsApp 📱");
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
            if (!res.ok) throw new Error(data.error);

            if (data.isNewUser) {
                setTempToken(data.token);
                setStep('NAME'); // Vamos a pedir el nombre primero para ser amigables
            } else {
                toast.success("¡Bienvenido de nuevo! 👋");
                onLoginSuccess({ token: data.token, role: 'agency', agencyId: data.user.agencyId });
            }
        } catch (err) { toast.error(err.message); }
        setLoading(false);
    };

    // --- 2. NOMBRE (Solo nuevos) ---
    const submitName = (e) => {
        e.preventDefault();
        if (name.trim().length < 3) return toast.error("Escribe un nombre válido");
        setStep('EMAIL');
    };

    // --- 3. EMAIL (Solo nuevos) ---
    const requestEmailOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/otp/email/request`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, name }) // Enviamos el nombre para el correo
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast.success(`Código enviado a ${email} 📧`);
            setStep('EMAIL_CODE');
        } catch (err) { toast.error(err.message); }
        setLoading(false);
    };

    const verifyEmailOtpAndFinish = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Verificar OTP Email
            const verifyRes = await fetch(`${API_URL}/auth/otp/email/verify`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: emailCode })
            });
            if (!verifyRes.ok) throw new Error("Código de email incorrecto");

            // 2. Guardar Datos Finales (Update Profile)
            const updateRes = await fetch(`${API_URL}/auth/profile/complete`, {
                method: "POST", 
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tempToken}` },
                body: JSON.stringify({ email, agencyName: name }) // Guardamos el nombre como agencia o nombre de usuario
            });
            if (!updateRes.ok) throw new Error("Error guardando perfil");

            toast.success("¡Cuenta verificada y creada! 🚀");
            onLoginSuccess({ token: tempToken, role: 'agency' });

        } catch (err) { toast.error(err.message); }
        setLoading(false);
    };

    // --- ADMIN ---
    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password: adminPass })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Modo Dios Activado ⚡");
                onLoginSuccess(data);
            } else throw new Error(data.error);
        } catch (err) { toast.error(err.message); }
        setLoading(false);
    };

    // --- RENDER ---
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
                
                {/* Switch Admin */}
                <button onClick={() => { setAuthMode(authMode === 'USER' ? 'ADMIN' : 'USER'); setStep('PHONE'); }} className="absolute top-8 right-8 text-gray-400 hover:text-indigo-600 text-sm font-medium flex gap-2">
                    {authMode === 'USER' ? <><Lock size={16}/> Soy Admin</> : <><Smartphone size={16}/> Volver</>}
                </button>

                <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* --- ADMIN LOGIN --- */}
                    {authMode === 'ADMIN' && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <ShieldCheck size={48} className="mx-auto text-gray-900 dark:text-white mb-4" />
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Administrador</h2>
                            </div>
                            <form onSubmit={handleAdminLogin} className="space-y-4">
                                <input type="email" placeholder="admin@clicandapp.com" className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white" value={email} onChange={e => setEmail(e.target.value)} required />
                                <input type="password" placeholder="••••••" className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white" value={adminPass} onChange={e => setAdminPass(e.target.value)} required />
                                <button disabled={loading} className="w-full bg-gray-900 text-white p-4 rounded-xl font-bold hover:bg-black transition">
                                    {loading ? <Loader2 className="animate-spin mx-auto"/> : "Entrar"}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* --- USER FLOW --- */}
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
                                            <input type="tel" placeholder="595981..." className="w-full pl-12 p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-lg tracking-wide" value={phone} onChange={e => setPhone(e.target.value)} required />
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
                                        <input type="text" maxLength={6} placeholder="000000" className="w-full text-center text-3xl font-bold tracking-[0.5em] p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white" value={phoneCode} onChange={e => setPhoneCode(e.target.value)} required />
                                        <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition">
                                            {loading ? <Loader2 className="animate-spin mx-auto"/> : "Verificar"}
                                        </button>
                                        <button type="button" onClick={() => setStep('PHONE')} className="w-full text-sm text-gray-400 hover:text-indigo-600">Cambiar número</button>
                                    </form>
                                </div>
                            )}

                            {/* PASO 3: NOMBRE (Friendly) */}
                            {step === 'NAME' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">¡Hola! 😊</h2>
                                        <p className="text-gray-500 mt-2">¿Cómo te llamas o cómo se llama tu agencia?</p>
                                    </div>
                                    <form onSubmit={submitName} className="space-y-4">
                                        <div className="relative">
                                            <User className="absolute left-4 top-4 text-gray-400" />
                                            <input type="text" placeholder="Tu Nombre / Agencia" className="w-full pl-12 p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-lg" value={name} onChange={e => setName(e.target.value)} required />
                                        </div>
                                        <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition flex justify-center items-center gap-2">
                                            Siguiente <ArrowRight size={20}/>
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* PASO 4: EMAIL */}
                            {step === 'EMAIL' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Un gusto, {name} ✨</h2>
                                        <p className="text-gray-500 mt-2">Por último, necesitamos tu email corporativo.</p>
                                    </div>
                                    <form onSubmit={requestEmailOtp} className="space-y-4">
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-4 text-gray-400" />
                                            <input type="email" placeholder="nombre@empresa.com" className="w-full pl-12 p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-lg" value={email} onChange={e => setEmail(e.target.value)} required />
                                        </div>
                                        <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition flex justify-center items-center gap-2">
                                            {loading ? <Loader2 className="animate-spin"/> : <>Enviar Código <ArrowRight size={20}/></>}
                                        </button>
                                        <button type="button" onClick={() => setStep('NAME')} className="w-full text-sm text-gray-400"><ArrowLeft size={14} className="inline"/> Volver</button>
                                    </form>
                                </div>
                            )}

                            {/* PASO 5: OTP EMAIL */}
                            {step === 'EMAIL_CODE' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Revisa tu correo 📧</h2>
                                        <p className="text-gray-500 mt-2">Enviamos un código a {email}</p>
                                    </div>
                                    <form onSubmit={verifyEmailOtpAndFinish} className="space-y-4">
                                        <input type="text" maxLength={6} placeholder="000000" className="w-full text-center text-3xl font-bold tracking-[0.5em] p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white" value={emailCode} onChange={e => setEmailCode(e.target.value)} required />
                                        <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-bold transition flex justify-center items-center gap-2">
                                            {loading ? <Loader2 className="animate-spin"/> : <>Finalizar y Entrar <CheckCircle2 size={20}/></>}
                                        </button>
                                        <button type="button" onClick={() => setStep('EMAIL')} className="w-full text-sm text-gray-400">Corregir email</button>
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