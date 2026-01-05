import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

const BrandingContext = createContext();

// 🎨 CONFIGURACIÓN POR DEFECTO (WaFloW.ai Identity del PDF)
const DEFAULT_BRANDING = {
    name: "WaFloW.ai",
    // Usamos un placeholder generado que coincide con el estilo "W" del PDF
    logoUrl: `${API_URL}/storage/WaFlowLogoColor256x256_1767643459561.png`, 
    primaryColor: "#0055FF", // Sapphire Blue (Brand Color)
    accentColor: "#00FFCC",  // Cyan Green (Innovation Accent)
    slogan: "Automatiza. Conecta. Fluye.",
    loginImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop" // Network Nodes (PDF Page 6)
};

export function BrandingProvider({ children }) {
    // Intentamos leer configuración guardada (Marca Blanca), si no, usamos WaFloW
    const [branding, setBranding] = useState(() => {
        const saved = localStorage.getItem('agencyBranding');
        return saved ? JSON.parse(saved) : DEFAULT_BRANDING;
    });

    const updateBranding = (newSettings) => {
        const merged = { ...branding, ...newSettings };
        setBranding(merged);
        localStorage.setItem('agencyBranding', JSON.stringify(merged));
    };

    const resetBranding = () => {
        setBranding(DEFAULT_BRANDING);
        localStorage.removeItem('agencyBranding');
    };

    return (
        <BrandingContext.Provider value={{ branding, updateBranding, resetBranding, DEFAULT_BRANDING }}>
            {children}
        </BrandingContext.Provider>
    );
}

export const useBranding = () => useContext(BrandingContext);