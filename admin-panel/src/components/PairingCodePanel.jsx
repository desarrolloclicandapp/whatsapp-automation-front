import React from 'react';
import { Copy, Hash, Loader2, X } from 'lucide-react';

function formatRemaining(expiresAt) {
    const remainingMs = new Date(expiresAt || 0).getTime() - Date.now();
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'El código expiró';
    return `Válido durante aproximadamente ${Math.max(1, Math.ceil(remainingMs / 60000))} min.`;
}

export default function PairingCodePanel({
    open = false,
    code = '',
    expiresAt = null,
    phone = '',
    onPhoneChange,
    onOpen,
    onClose,
    onGenerate,
    loading = false,
    error = '',
    compact = false
}) {
    if (!open && !code) {
        return (
            <button
                type="button"
                onClick={onOpen}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-800 dark:bg-gray-900 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
            >
                <Hash size={18} />
                Conectar por número telefónico
            </button>
        );
    }

    return (
        <div className={`w-full rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/70 dark:bg-indigo-950/20 ${compact ? '' : 'max-w-xl'}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Conectar por número telefónico</p>
                    <p className="mt-1 text-xs text-indigo-800/80 dark:text-indigo-300/80">
                        Escribe el número completo con código de país, sin espacios ni guiones.
                    </p>
                </div>
                {onClose && (
                    <button type="button" onClick={onClose} className="text-indigo-500 transition hover:text-red-500" aria-label="Cerrar">
                        <X size={18} />
                    </button>
                )}
            </div>

            {code ? (
                <div className="mt-4 space-y-3">
                    <div className="rounded-lg border border-indigo-200 bg-white px-4 py-3 text-center dark:border-indigo-800 dark:bg-gray-950">
                        <p className="font-mono text-2xl font-extrabold tracking-[0.24em] text-gray-900 dark:text-white">{code}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(code)}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700"
                    >
                        <Copy size={15} /> Copiar código
                    </button>
                    <p className="text-xs text-indigo-900/80 dark:text-indigo-200/80">
                        En WhatsApp: Dispositivos vinculados → Vincular con número de teléfono. {formatRemaining(expiresAt)}
                    </p>
                </div>
            ) : (
                <form
                    className="mt-4 space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onGenerate?.();
                    }}
                >
                    <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => onPhoneChange?.(event.target.value)}
                        placeholder="595981234567"
                        className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-indigo-500 focus:ring-2 dark:border-indigo-800 dark:bg-gray-950 dark:text-white"
                    />
                    {error && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading || !phone.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="animate-spin" size={17} /> : <Hash size={17} />}
                        {loading ? 'Generando código...' : 'Generar código'}
                    </button>
                </form>
            )}
        </div>
    );
}
