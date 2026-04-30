import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Loader2,
  ShieldCheck,
  ArrowLeft,
  LifeBuoy,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBranding } from '../context/BrandingContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import { buildRewardfulAuthBody } from '../utils/rewardfulReferral';
import { translateOr } from './i18n';

const API_URL = (import.meta.env.VITE_API_URL || 'https://wa.waflow.com').replace(/\/$/, '');
const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '34611770270';
const SIGNUP_SOURCE = 'standalone_crm';

export default function StandaloneLogin({ onLoginSuccess }) {
  const { standaloneBranding } = useBranding();
  const { t } = useLanguage();
  const branding = standaloneBranding;
  const supportPrefill = encodeURIComponent(t('auth.support_prefill'));

  const [authMode, setAuthMode] = useState('USER');
  const [step, setStep] = useState('EMAIL');

  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const [loading, setLoading] = useState(false);
  const [ghlExists, setGhlExists] = useState(false);

  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [emailCooldown, setEmailCooldown] = useState(0);

  useEffect(() => {
    let interval;
    if (phoneCooldown > 0) interval = setInterval(() => setPhoneCooldown((c) => c - 1), 1000);
    return () => clearInterval(interval);
  }, [phoneCooldown]);

  useEffect(() => {
    let interval;
    if (emailCooldown > 0) interval = setInterval(() => setEmailCooldown((c) => c - 1), 1000);
    return () => clearInterval(interval);
  }, [emailCooldown]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('secure_entry') === '7xR9y2Pz4Wq1Lk3Mn5Jv8B6Dc') {
      setAuthMode('ADMIN');
      toast.success(t('auth.admin_mode_detected'));
    }

    const checkExistingGHL = async () => {
      const locId = sessionStorage.getItem('crm_location_id') || sessionStorage.getItem('ghl_location_id');
      if (!locId) return;

      try {
        const res = await fetch(`${API_URL}/agency/location-details/${locId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        });
        if (res.ok) setGhlExists(true);
      } catch (e) {
        console.error('Error verificando GHL:', e);
      }
    };

    checkExistingGHL();
  }, [t]);

  const [tempToken, setTempToken] = useState(null);
  const [tempAgencyId, setTempAgencyId] = useState(null);

  const requestPhoneOtp = async (e) => {
    if (e) e.preventDefault();
    if (phone.length < 8) return toast.error(t('auth.phone_too_short'));
    if (phoneCooldown > 0) {
      return toast.warning(t('auth.wait_to_resend').replace('{seconds}', phoneCooldown));
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, source: SIGNUP_SOURCE, interface: 'standalone' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('auth.otp_request_error'));

      toast.success(data.message || t('auth.code_sent'));
      setStep('PHONE_CODE');
      setPhoneCooldown(60);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const verifyPhoneOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRewardfulAuthBody({ phone, code: phoneCode, email, source: SIGNUP_SOURCE, interface: 'standalone' })),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('auth.invalid_code'));

      if (data.token) {
        if (data.requiresEmailReview && data.requestedEmail) {
          toast.warning('Este numero ya tenia una cuenta. Revisa las opciones para el email.');
          onLoginSuccess(data);
          return;
        }

        setTempToken(data.token);
        setTempAgencyId(data.agencyId || data.user?.agencyId);
        setStep('NAME');
      }
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const requestEmailOtp = async (e) => {
    if (e) e.preventDefault();
    if (!email.includes('@') || !email.includes('.')) return toast.error(t('auth.invalid_email'));
    if (emailCooldown > 0) {
      return toast.warning(t('auth.wait_to_resend').replace('{seconds}', emailCooldown));
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/otp/email/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, source: SIGNUP_SOURCE, interface: 'standalone' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('auth.email_send_error'));

      toast.success(t('auth.code_sent_to_email').replace('{email}', email));
      setStep('EMAIL_CODE');
      setEmailCooldown(60);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const verifyEmailOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/otp/email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: emailCode, source: SIGNUP_SOURCE, interface: 'standalone' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('auth.invalid_code'));

      if (data.token) {
        toast.success(t('auth.welcome_back'));
        onLoginSuccess({
          token: data.token,
          role: 'agency',
          agencyId: data.agencyId || data.user?.agencyId,
          interface: data.interface || data.user?.interface || 'standalone',
        });
      } else {
        toast.info(t('auth.verification_success_whatsapp'));
        setStep('PHONE');
      }
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const finishRegistration = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error(t('auth.name_too_short'));

    setLoading(true);
    try {
      const updateRes = await fetch(`${API_URL}/auth/profile/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tempToken}`,
        },
        body: JSON.stringify(buildRewardfulAuthBody({ email, agencyName: name, source: SIGNUP_SOURCE, interface: 'standalone' })),
      });

      if (!updateRes.ok) {
        const errorData = await updateRes.json().catch(() => null);
        if (errorData?.requiresEmailReview && errorData?.requestedEmail) {
          toast.warning('Este numero ya tenia una cuenta. Revisa las opciones para el email.');
          onLoginSuccess({
            token: tempToken,
            role: 'agency',
            agencyId: tempAgencyId,
            interface: 'standalone',
            requiresEmailReview: true,
            requestedEmail: errorData.requestedEmail,
            maskedCurrentEmail: errorData.maskedCurrentEmail || '',
          });
          return;
        }
        throw new Error(errorData?.error || t('auth.save_profile_error'));
      }

      const savedFbclid = localStorage.getItem('waflow_fbclid') || '';
      const savedGclid = localStorage.getItem('waflow_gclid') || '';
      const savedUtmSource = localStorage.getItem('waflow_utm_source') || '';
      const savedUtmMedium = localStorage.getItem('waflow_utm_medium') || '';
      const savedUtmCampaign = localStorage.getItem('waflow_utm_campaign') || '';

      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Lead');
      }

      try {
        await fetch('https://paneln8n.clicandapp.com/webhook/metads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            phone,
            name,
            interface: 'standalone',
            source: SIGNUP_SOURCE,
            surface: 'standalone_signup',
            fbclid: savedFbclid,
            gclid: savedGclid,
            utm_source: savedUtmSource,
            utm_medium: savedUtmMedium,
            utm_campaign: savedUtmCampaign,
          }),
        });
      } catch (webhookErr) {
        console.error('Error enviando datos a n8n:', webhookErr);
      }

      toast.success(t('auth.account_ready'));
      onLoginSuccess({
        token: tempToken,
        role: 'agency',
        agencyId: tempAgencyId,
        interface: 'standalone',
      });
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPass }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('auth.admin_mode_enabled'));
        onLoginSuccess(data);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex font-sans transition-colors relative"
      style={{ backgroundColor: branding.backgroundColor || '#001F3F' }}
    >
      <div className="hidden lg:flex w-1/2 relative overflow-hidden transition-all duration-1000">
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-105"
          style={{ backgroundImage: `url(${branding.loginImage})` }}
        />

        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${branding.primaryColor}CC 0%, ${branding.backgroundColor || '#001F3F'}E6 50%, ${branding.accentColor}40 100%)`,
            mixBlendMode: 'multiply',
          }}
        />

        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-16 text-white text-center">
          <div className="mb-8 p-4 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl animate-in zoom-in duration-500">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="w-16 h-16 object-contain filter drop-shadow-lg"
                onError={(e) => {
                  console.error('Error cargando logo:', branding.logoUrl);
                  e.target.style.display = 'none';
                  e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                }}
              />
            ) : null}
            <div className="w-16 h-16 hidden items-center justify-center text-2xl font-bold text-white">
              {(branding.name || 'W').charAt(0).toUpperCase()}
            </div>
          </div>

          <h1 className="text-5xl font-extrabold mb-6 tracking-tight leading-tight drop-shadow-xl font-sans">
            {authMode === 'ADMIN'
              ? t('auth.command_center')
              : branding.slogan || t('auth.default_slogan')}
          </h1>

          <p className="text-lg text-white/90 max-w-lg leading-relaxed font-light">
            {authMode === 'ADMIN'
              ? t('auth.admin_description')
              : (branding.description || t('auth.default_description'))}
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-[#0B0D12] relative transition-colors duration-300">
        <div className="absolute top-6 right-6 z-20">
          <LanguageSelector />
        </div>

        <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          {authMode === 'ADMIN' && (
            <div className="space-y-8">
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
                  style={{ backgroundColor: branding.backgroundColor || '#001F3F' }}
                >
                  <ShieldCheck size={32} style={{ color: branding.accentColor }} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{t('auth.admin_panel')}</h2>
                <p className="text-gray-500 mt-2">
                  {t('auth.admin_credentials_of').replace('{name}', branding.name || 'Waflow')}
                </p>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-5">
                <div className="space-y-4">
                  <input
                    type="email"
                    placeholder="admin@..."
                    className="w-full p-4 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white outline-none focus:ring-2 transition-all"
                    style={{ '--tw-ring-color': branding.primaryColor }}
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder="******"
                    className="w-full p-4 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white outline-none focus:ring-2 transition-all"
                    style={{ '--tw-ring-color': branding.primaryColor }}
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    required
                  />
                </div>
                <button
                  disabled={loading}
                  className="w-full text-white p-4 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg hover:shadow-xl active:scale-95"
                  style={{ backgroundColor: branding.backgroundColor || '#001F3F' }}
                >
                  {loading ? <Loader2 className="animate-spin mx-auto" /> : t('auth.sign_in')}
                </button>
              </form>
            </div>
          )}

          {authMode === 'USER' && (
            <>
              {step === 'PHONE' && (
                <div className="space-y-8">
                  <div className="text-center">
                    <div
                      className="inline-block p-3 rounded-2xl mb-6 shadow-md"
                      style={{ backgroundColor: `${branding.primaryColor || '#0055FF'}15` }}
                    >
                      {branding.logoUrl ? (
                        <img
                          src={branding.logoUrl}
                          alt="Logo"
                          className="h-10 object-contain"
                          onError={(e) => {
                            console.error('Error cargando logo:', branding.logoUrl);
                            e.target.style.display = 'none';
                            e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                          }}
                        />
                      ) : null}
                      <div
                        className="h-10 hidden items-center justify-center text-xl font-bold"
                        style={{ color: branding.primaryColor }}
                      >
                        {(branding.name || 'W').charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {branding.loginTitle || t('auth.start_now')}
                    </h2>
                    <p className="text-gray-500 mt-2">
                      {branding.loginSubtitle || t('auth.enter_new_era')}
                    </p>
                  </div>
                  <form onSubmit={requestPhoneOtp} className="space-y-6">
                    <div className="relative group">
                      <span className="absolute left-4 top-4 text-gray-400 font-mono text-lg">+</span>
                      <input
                        type="tel"
                        placeholder="595981..."
                        className="w-full pl-10 p-4 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white text-lg tracking-wide outline-none focus:ring-2 transition-all"
                        style={{ '--tw-ring-color': branding.accentColor }}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                    </div>
                    <button
                      disabled={loading || phone.length < 8}
                      className="w-full text-white p-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 flex justify-center items-center gap-2"
                      style={{
                        background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.accentColor})`,
                        textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <>{t('auth.send_code')} <ArrowRight size={20} /></>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('EMAIL')}
                      className="w-full text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-2"
                    >
                      <ArrowLeft size={14} /> {t('auth.use_other_email')}
                    </button>
                  </form>
                </div>
              )}

              {step === 'PHONE_CODE' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('auth.security_code')}</h2>
                    <p className="text-gray-500 mt-2">
                      {t('auth.code_sent_to_phone').replace('{phone}', `+${phone}`)}
                    </p>
                  </div>
                  <form onSubmit={verifyPhoneOtp} className="space-y-6">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      className="w-full text-center text-4xl font-bold tracking-[0.5em] p-4 rounded-xl border-2 dark:bg-gray-800 dark:text-white outline-none focus:ring-4 transition-all"
                      style={{ borderColor: branding.primaryColor }}
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      required
                    />
                    <button
                      disabled={loading}
                      className="w-full text-white p-4 rounded-xl font-bold transition-all shadow-lg"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      {loading ? <Loader2 className="animate-spin mx-auto" /> : t('auth.verify')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('PHONE')}
                      className="w-full text-sm text-gray-400 hover:text-opacity-80 transition"
                      style={{ color: branding.primaryColor }}
                    >
                      {t('auth.wrong_phone')}
                    </button>

                    <div className="text-center pt-2">
                      {phoneCooldown > 0 ? (
                        <p className="text-sm text-gray-400">
                          {t('auth.resend_in').replace('{seconds}', phoneCooldown)}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => requestPhoneOtp(null)}
                          className="text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition hover:underline"
                        >
                          {t('auth.not_received_message')} <span className="font-bold">{t('auth.resend_here')}</span>
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {step === 'NAME' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                  <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{t('auth.hello')}</h2>
                    <p className="text-gray-500 mt-2">
                      {translateOr(t, 'standalone.login.account_name_question', '¿Cuál es el nombre de tu cuenta?')}
                    </p>
                  </div>
                  <form onSubmit={finishRegistration} className="space-y-6">
                    <input
                      type="text"
                      placeholder={translateOr(t, 'standalone.login.account_name_placeholder', 'Ej: Cuenta principal')}
                      autoFocus
                      className="w-full p-4 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white text-lg outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': branding.primaryColor }}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <button
                      disabled={loading}
                      className="w-full text-white p-4 rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin" />
                          <span>{t('auth.validating_account')}</span>
                        </>
                      ) : <>{t('auth.finish')} <CheckCircle2 size={20} /></>}
                    </button>
                    {loading && (
                      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                        {translateOr(
                          t,
                          'auth.validating_account_hint',
                          'Estamos validando tu cuenta. Esto puede tardar unos segundos.',
                        )}
                      </p>
                    )}
                  </form>
                </div>
              )}

              {step === 'EMAIL' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {ghlExists
                        ? translateOr(t, 'standalone.login.join_account', 'Unete a tu cuenta')
                        : t('auth.welcome')}
                    </h2>
                    <p className="text-gray-500 mt-2">
                      {ghlExists
                        ? translateOr(
                            t,
                            'standalone.login.account_exists_link',
                            'Tu cuenta ya existe. Vincula tu acceso con este correo.',
                          )
                        : t('auth.validate_corporate_email')}
                    </p>
                  </div>
                  <form onSubmit={requestEmailOtp} className="space-y-6">
                    <div className="relative">
                      <Mail className="absolute left-4 top-4 text-gray-400" />
                      <input
                        type="email"
                        placeholder="nombre@empresa.com"
                        className="w-full pl-12 p-4 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white text-lg outline-none focus:ring-2 transition-all"
                        style={{ '--tw-ring-color': branding.primaryColor }}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      disabled={loading}
                      className="w-full text-white p-4 rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <>{t('auth.send_code')} <Mail size={18} /></>}
                    </button>
                  </form>
                </div>
              )}

              {step === 'EMAIL_CODE' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('auth.check_email')}</h2>
                    <p className="text-gray-500 mt-2">
                      {t('auth.code_sent_to_email_plain').replace('{email}', email)}
                    </p>
                  </div>
                  <form onSubmit={verifyEmailOtp} className="space-y-6">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      className="w-full text-center text-4xl font-bold tracking-[0.5em] p-4 rounded-xl border-2 dark:bg-gray-800 dark:text-white outline-none focus:ring-4 transition-all"
                      style={{ borderColor: branding.primaryColor }}
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                      required
                    />
                    <button
                      disabled={loading}
                      className="w-full text-white p-4 rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <>{t('auth.verify')} <ArrowRight size={18} /></>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('EMAIL')}
                      className="w-full text-sm text-gray-400 hover:text-opacity-80 transition"
                      style={{ color: branding.primaryColor }}
                    >
                      {t('auth.wrong_email')}
                    </button>

                    <div className="text-center pt-2">
                      {emailCooldown > 0 ? (
                        <p className="text-sm text-gray-400">
                          {t('auth.resend_in').replace('{seconds}', emailCooldown)}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => requestEmailOtp(null)}
                          className="text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition hover:underline"
                        >
                          {t('auth.not_received_message')} <span className="font-bold">{t('auth.resend_here')}</span>
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </>
          )}

          {authMode === 'USER' && (
            <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800 text-center animate-in fade-in">
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-2">{t('auth.registration_problem')}</p>
              <a
                href={`https://wa.me/${SUPPORT_PHONE}?text=${supportPrefill}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium transition-all hover:gap-3"
                style={{ color: branding.primaryColor }}
              >
                <LifeBuoy size={16} />
                {t('auth.contact_support')}
                <ArrowRight size={14} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
