import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

const BrandingContext = createContext();

// 🎨 CONFIGURACIÓN POR DEFECTO ACTUALIZADA (Con Favicon)
const DEFAULT_BRANDING = {
    name: "WaFloW.ai",
    logoUrl: `${API_URL}/storage/WaFlowLogoColor192x192_1767643449031.png`,
    // ✅ Nuevo campo Favicon (Por defecto usamos el mismo logo o uno específico)
    faviconUrl: `${API_URL}/storage/WaFlowLogoColor192x192_1767643449031.png`, 
    
    primaryColor: "#0055FF", 
    accentColor: "#00FFCC",  
    slogan: "Automatiza. Conecta. Fluye.",
    loginImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop",
    
    description: "Tecnología humana para flujos inteligentes. Estabilidad, velocidad y escalabilidad para tu WhatsApp.",
    loginTitle: "Empieza Ahora",
    loginSubtitle: "Ingresa a la nueva era de la automatización.",
    
    ctaButton: {
        show: false,
        text: "Ver Oferta",
        url: "https://waflow.ai/pricing",
        backgroundColor: "" 
    }
};

export function BrandingProvider({ children }) {
    // 1. Branding de la Agencia (Usuario logueado)
    const [agencyBranding, setAgencyBranding] = useState(() => {
        const saved = localStorage.getItem('agencyBranding');
        return saved ? JSON.parse(saved) : {};
    });

    // 2. Branding del Sistema (Login Global)
    const [systemBranding, setSystemBranding] = useState(DEFAULT_BRANDING);

    // Cargar Branding del Sistema
    useEffect(() => {
        const fetchSystemBranding = async () => {
            try {
                const res = await fetch(`${API_URL}/public/branding`);
                if (res.ok) {
                    const data = await res.json();
                    if (Object.keys(data).length > 0) {
                        setSystemBranding({ 
                            ...DEFAULT_BRANDING, 
                            ...data,
                            ctaButton: { ...DEFAULT_BRANDING.ctaButton, ...(data.ctaButton || {}) } 
                        });
                    }
                }
            } catch (e) { console.error("Usando branding por defecto"); }
        };
        fetchSystemBranding();
    }, []);

    const updateAgencyBranding = (newSettings) => {
        const merged = { ...agencyBranding, ...newSettings };
        setAgencyBranding(merged);
        localStorage.setItem('agencyBranding', JSON.stringify(merged));
    };

    const updateSystemBranding = async (newSettings, token) => {
        const merged = { ...systemBranding, ...newSettings };
        setSystemBranding(merged);
        
        try {
            await fetch(`${API_URL}/admin/global-branding`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(merged)
            });
        } catch(e) { console.error("Error guardando branding global", e); }
    };

    const resetBranding = () => {
        setAgencyBranding({});
        localStorage.removeItem('agencyBranding');
    };

    // Marca activa final (mezcla sistema + agencia)
    const activeBranding = { ...systemBranding, ...agencyBranding };

    // 🔥 EFECTO MÁGICO: Actualizar Favicon y Título del navegador
    useEffect(() => {
        // 1. Actualizar Favicon
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = activeBranding.faviconUrl || DEFAULT_BRANDING.faviconUrl;
        document.getElementsByTagName('head')[0].appendChild(link);

        // 2. Actualizar Título de la Pestaña
        if (activeBranding.name) {
            document.title = activeBranding.name;
        }
    }, [activeBranding]);

    return (
        <BrandingContext.Provider value={{ 
            branding: activeBranding, 
            systemBranding: systemBranding, 
            agencyBranding: agencyBranding, 
            updateBranding: updateAgencyBranding, 
            updateSystemBranding,
            resetBranding: resetBranding,
            DEFAULT_BRANDING: DEFAULT_BRANDING 
        }}>
            {children}
        </BrandingContext.Provider>
    );
}

export const useBranding = () => useContext(BrandingContext);