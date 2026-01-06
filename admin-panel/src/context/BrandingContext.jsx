import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

const BrandingContext = createContext();

// 🎨 BRANDING "HARDCODED" (Respaldo final)
const FALLBACK_BRANDING = {
    name: "WaFloW.ai",
    logoUrl: `${API_URL}/storage/WaFlowLogoColor192x192_1767643449031.png`, 
    primaryColor: "#0055FF", 
    accentColor: "#00FFCC",  
    slogan: "Automatiza. Conecta. Fluye.",
    loginImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop" 
};

export function BrandingProvider({ children }) {
    // 1. Branding de la Agencia (Usuario logueado)
    const [agencyBranding, setAgencyBranding] = useState(() => {
        const saved = localStorage.getItem('agencyBranding');
        return saved ? JSON.parse(saved) : {};
    });

    // 2. Branding del Sistema (Configurado por el Admin para el Login)
    const [systemBranding, setSystemBranding] = useState(FALLBACK_BRANDING);

    // Cargar Branding del Sistema desde Backend al iniciar
    useEffect(() => {
        const fetchSystemBranding = async () => {
            try {
                // Nota: Necesitarás crear este endpoint GET /admin/global-branding en tu backend
                // Si falla, usa el fallback
                const res = await fetch(`${API_URL}/public/branding`);
                if (res.ok) {
                    const data = await res.json();
                    if (Object.keys(data).length > 0) {
                        setSystemBranding({ ...FALLBACK_BRANDING, ...data });
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
        
        // Guardar en Backend (Endpoint sugerido)
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

    // Resetear solo agencia
    const resetAgencyBranding = () => {
        setAgencyBranding({});
        localStorage.removeItem('agencyBranding');
    };

    // Lógica de mezcla: Si hay branding de agencia, gana. Si no, usa sistema.
    const activeBranding = { ...systemBranding, ...agencyBranding };

    return (
        <BrandingContext.Provider value={{ 
            branding: activeBranding, // Lo que ve el usuario dentro del panel
            systemBranding: systemBranding, // Lo que se ve en el Login (Puro)
            agencyBranding: agencyBranding, // La capa de personalización
            updateBranding: updateAgencyBranding, 
            updateSystemBranding,
            resetBranding: resetAgencyBranding,
            DEFAULT_BRANDING: FALLBACK_BRANDING 
        }}>
            {children}
        </BrandingContext.Provider>
    );
}

export const useBranding = () => useContext(BrandingContext);