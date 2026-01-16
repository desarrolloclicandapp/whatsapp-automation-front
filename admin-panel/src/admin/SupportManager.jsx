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
    showDisconnectWarning = true
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
        <div className="bg-white dark:bg-gray-900 border border-indigo-100 dark:border-gray-800 rounded-xl p-6 shadow-sm mb-8 transition-colors">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${status.connected ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        {status.connected ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {status.connected
                                ? `Conectado: +${status.myNumber}`
                                : showDisconnectWarning 
                                    ? "Desconectado. No se enviarán alertas de desconexión."
                                    : "Conecta tu propio número para enviar alertas."}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {!status.connected && !qr && (
                        <button
                            onClick={handleConnect}
                            disabled={loading}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 shadow-md shadow-indigo-200 dark:shadow-none"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={18} /> : <QrCode size={18} />}
                            {loading ? "Iniciando..." : "Vincular Bot"}
                        </button>
                    )}

                    {status.connected && (
                        <button
                            onClick={handleDisconnect}
                            disabled={loading}
                            className="group relative p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-500 dark:text-red-400 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/40 hover:border-red-300 dark:hover:border-red-700 transition-all disabled:opacity-50 shadow-sm"
                            title="Desconectar número"
                        >
                            <Power size={20} />
                            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                Desconectar
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Panel de QR Desplegable */}
            {!status.connected && (qr || loading) && (
                <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-6 flex flex-col items-center animate-in fade-in slide-in-from-top-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 font-medium">
                        {loading && !qr ? "Solicitando código QR al servidor..." : "Escanea este código con el WhatsApp que enviará las alertas:"}
                    </p>

                    <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                        {qr ? (
                            <QRCode value={qr} size={200} />
                        ) : (
                            <div className="w-[200px] h-[200px] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-400">
                                <RefreshCw className="animate-spin mb-2 text-indigo-500" />
                                <span className="text-xs">Generando QR...</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => { setQr(null); setLoading(false); stopPolling(); }}
                        className="mt-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
                    >
                        Cancelar
                    </button>
                </div>
            )}
        </div>
    );
}