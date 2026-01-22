import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, QrCode, Power } from 'lucide-react';
import QRCode from "react-qr-code";
import { useSocket } from '../hooks/useSocket';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.waflow.com").replace(/\/$/, "");

export default function SupportManager({ 
    token, 
    apiPrefix = "/admin/support", 
    socketRoom = "__SYSTEM_SUPPORT__",
    title = "Bot de Alertas y Soporte",
    showDisconnectWarning = true,
    demoMode = false // ✅ Modo Demo para vista restringida
}) {
    const [status, setStatus] = useState({ connected: false, myNumber: null });
    const [qr, setQr] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Referencia para manejar el intervalo de polling
    const pollInterval = useRef(null);

    const socket = useSocket();

    const authFetch = async (endpoint, options = {}) => {
        return fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
    };

    // Consultar estado inicial
    const checkStatus = async () => {
        try {
            const res = await authFetch(`${apiPrefix}/status`);
            if (res.ok) {
                const data = await res.json();
                setStatus({ connected: data.connected, myNumber: data.myNumber });

                if (data.connected) {
                    setQr(null);
                    setLoading(false);
                    stopPolling(); // Si ya conectó, detenemos búsquedas
                }
            }
        } catch (e) { console.error("Error checking status:", e); }
    };

    // Función auxiliar para detener el polling
    const stopPolling = () => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
        }
    };

    // ✅ EFECTO: Sockets + Polling de Seguridad
    useEffect(() => {
        if (demoMode) return; // 🚫 No hacer nada en modo demo
        
        checkStatus();

        if (socket) {
            socket.emit('join_room', socketRoom);
        }

        const handleEvent = (payload) => {
            if (payload.locationId === socketRoom) {
                if (payload.type === 'qr') {
                    setQr(payload.data);
                    setLoading(false);
                }
                if (payload.type === 'connection') {
                    checkStatus();
                    if (payload.status === 'open') {
                        setQr(null);
                        setLoading(false);
                        stopPolling();
                    }
                }
            }
        };

        if (socket) socket.on('wa_event', handleEvent);

        return () => {
            if (socket) socket.off('wa_event', handleEvent);
            stopPolling();
        };
    }, [socket, socketRoom, apiPrefix]);

    const handleConnect = async () => {
        setLoading(true);
        setQr(null);
        
        try {
            // 1. Iniciar proceso en backend
            const res = await authFetch(`${apiPrefix}/start`, { method: 'POST' });
            if (!res.ok) throw new Error("Fallo al iniciar");

            // 2. Activar Polling de Respaldo (Por si el socket falla)
            // Preguntamos cada 2 segundos si ya hay QR
            stopPolling(); // Limpiar anteriores por si acaso
            pollInterval.current = setInterval(async () => {
                try {
                    const qrRes = await authFetch(`${apiPrefix}/qr`);
                    if (qrRes.ok) {
                        const data = await qrRes.json();
                        if (data.qr) {
                            setQr(data.qr);
                            setLoading(false);
                            // No detenemos el polling aún, por si el QR cambia, 
                            // pero el socket debería tomar el relevo.
                        }
                    }
                    // También verificamos si ya se conectó
                    const statusRes = await authFetch(`${apiPrefix}/status`);
                    const statusData = await statusRes.json();
                    if (statusData.connected) {
                        setStatus(statusData);
                        setQr(null);
                        setLoading(false);
                        stopPolling();
                    }
                } catch (e) { console.error("Polling error", e); }
            }, 2000);

        } catch (e) {
            alert("Error iniciando conexión");
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm("¿Desconectar soporte?")) return;
        setLoading(true);
        try {
            await authFetch(`${apiPrefix}/disconnect`, { method: 'DELETE' });
            setStatus({ connected: false, myNumber: null });
            setQr(null);
            stopPolling();
        } catch (e) { alert("Error desconectando"); }
        setLoading(false);
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm mb-6 transition-colors">
            <div className="flex items-center justify-between gap-4">
                {/* Info */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${status.connected ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        {status.connected ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">{title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {status.connected ? `+${status.myNumber}` : showDisconnectWarning ? "No conectado" : "Sin vincular"}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {!status.connected && !qr && (
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={16} /> : <QrCode size={16} />}
                            <span className="hidden sm:inline">{loading ? "Iniciando..." : "Vincular"}</span>
                        </button>
                    )}

                    {status.connected && (
                        <button
                            onClick={handleDisconnect}
                            disabled={loading}
                            className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition disabled:opacity-50"
                            title="Desconectar"
                        >
                            <Power size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* QR Panel - Inline */}
            {!status.connected && (qr || loading) && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center gap-4">
                    <div className="bg-white p-2 rounded-lg shadow border border-gray-100 dark:border-gray-700 shrink-0">
                        {qr ? (
                            <QRCode value={qr} size={200} />
                        ) : (
                            <div className="w-[200px] h-[200px] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 rounded text-gray-400">
                                <RefreshCw className="animate-spin mb-1 text-indigo-500" size={20} />
                                <span className="text-[10px]">Generando...</span>
                            </div>
                        )}
                    </div>
                    <div className="text-center sm:text-left">
                        <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                            {loading && !qr ? "Solicitando QR..." : "Escanea con WhatsApp"}
                        </p>
                        <button
                            onClick={() => { setQr(null); setLoading(false); stopPolling(); }}
                            className="mt-2 text-xs text-gray-400 hover:text-red-500 transition"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}