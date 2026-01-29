import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/+$/, "");

const BrandingContext = createContext();

const DEFAULT_BRANDING = {
    name: "WaFloW.ai",
    logoUrl: `${API_URL}/storage/WaFlowLogoColor192x192_1767643449031.png`, 
    faviconUrl: `${API_URL}/storage/WaFlowLogoColor192x192_1767643449031.png`,
    primaryColor: "#0055FF", 
    accentColor: "#00FFCC",  
    slogan: "Automatiza. Conecta. Fluye.",
    loginImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop",
    description: "Tecnología humana para flujos inteligentes. Estabilidad, velocidad y escalabilidad para tu WhatsApp.",
    loginTitle: "Empieza Ahora",
    loginSubtitle: "Ingresa a la nueva era de la automatización.",
    ctaButton: { show: false, text: "Ver Oferta", url: "https://waflow.ai/pricing", backgroundColor: "" }
};

export function BrandingProvider({ children }) {
    const [agencyBranding, setAgencyBranding] = useState(() => {
        const saved = localStorage.getItem('agencyBranding');
        return saved ? JSON.parse(saved) : {};
    });

    const [systemBranding, setSystemBranding] = useState(DEFAULT_BRANDING);

    // ✅ PETICIÓN AL SERVIDOR AL CARGAR (Soluciona el F5)
    useEffect(() => {
        const fetchSystemBranding = async () => {
            try {
                const res = await fetch(`${API_URL}/public/branding`);
                if (res.ok) {
                    const data = await res.json();
                    if (Object.keys(data).length > 0) {
                        setSystemBranding({ ...DEFAULT_BRANDING, ...data });
                    }
                }
            } catch (e) { console.error("Error cargando branding desde el servidor"); }
        };
        fetchSystemBranding();
    }, []);

    const updateSystemBranding = async (newSettings, token) => {
        const merged = { ...systemBranding, ...newSettings };
        setSystemBranding(merged);
        
        // ✅ PERSISTENCIA REAL EN BASE DE DATOS
        try {
            await fetch(`${API_URL}/admin/global-branding`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(merged)
            });
        } catch(e) { console.error("Error guardando en el servidor"); }
    };

    // ✅ CARGAR BRANDING DE AGENCIA (Privado)
    const loadAgencyBranding = async (token) => {
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/agency/branding`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (Object.keys(data).length > 0) {
                    setAgencyBranding(data);
                    localStorage.setItem('agencyBranding', JSON.stringify(data));
                }
            }
        } catch (e) {
            console.error("Error loading agency branding", e);
        }
    };

    const updateAgencyBranding = async (newSettings, token) => {
        const merged = { ...agencyBranding, ...newSettings };
        setAgencyBranding(merged);
        localStorage.setItem('agencyBranding', JSON.stringify(merged));

        // ✅ PERSISTIR EN SERVIDOR
        if (token) {
            try {
                await fetch(`${API_URL}/agency/branding`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify(merged)
                });
            } catch (e) { console.error("Error saving agency branding", e); }
        }
    };

    const resetAgencyBranding = async (token) => {
        setAgencyBranding({});
        localStorage.removeItem('agencyBranding');
        
        if (token) {
            try {
                await fetch(`${API_URL}/agency/branding`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({})
                });
            } catch (e) { console.error("Error resetting agency branding", e); }
        }
    };

    const activeBranding = { ...systemBranding, ...agencyBranding };

    useEffect(() => {
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = activeBranding.faviconUrl || DEFAULT_BRANDING.faviconUrl;
        document.getElementsByTagName('head')[0].appendChild(link);
        document.title = activeBranding.name || DEFAULT_BRANDING.name;
    }, [activeBranding]);

    return (
        <BrandingContext.Provider value={{ 
            branding: activeBranding, 
            systemBranding, 
            updateBranding: updateAgencyBranding, 
            updateSystemBranding,
            loadAgencyBranding, // ✅ EXPOSED
            resetBranding: resetAgencyBranding,
            DEFAULT_BRANDING 
        }}>
            {children}
        </BrandingContext.Provider>
    );
}

export const useBranding = () => useContext(BrandingContext);