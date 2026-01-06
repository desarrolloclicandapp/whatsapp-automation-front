import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

const BrandingContext = createContext();

// 🎨 CONFIGURACIÓN POR DEFECTO ACTUALIZADA
const DEFAULT_BRANDING = {
    name: "WaFloW.ai",
    logoUrl: `${API_URL}/storage/WaFlowLogoColor192x192_1767643449031.png`, 
    primaryColor: "#0055FF", 
    accentColor: "#00FFCC",  
    slogan: "Automatiza. Conecta. Fluye.",
    loginImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop",
    
    // CAMPOS PARAMETRIZABLES
    description: "Tecnología humana para flujos inteligentes. Estabilidad, velocidad y escalabilidad para tu WhatsApp.",
    loginTitle: "Empieza Ahora",
    loginSubtitle: "Ingresa a la nueva era de la automatización.",
    
    // ✅ Configuración del Botón CTA (Actualizada con backgroundColor)
    ctaButton: {
        show: false,
        text: "Ver Oferta",
        url: "https://waflow.ai/pricing",
        backgroundColor: "" // Si está vacío, usa el estilo por defecto (Glass)
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
                            // Aseguramos que ctaButton tenga todas las props nuevas
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

    const activeBranding = { ...systemBranding, ...agencyBranding };

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