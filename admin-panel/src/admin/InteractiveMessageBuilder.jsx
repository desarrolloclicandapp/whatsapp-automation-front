import React, { useMemo, useState } from 'react';
import { Copy, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

const BUTTON_TYPES = [
    { value: 'reply', label: 'Reply' },
    { value: 'url', label: 'URL' },
    { value: 'call', label: 'Call' },
    { value: 'copy', label: 'Copy' }
];

const PLACEHOLDER_BY_TYPE = {
    reply: 'ID opcional',
    url: 'https://tu-enlace.com',
    call: '+34 600 000 000',
    copy: 'Texto a copiar'
};

const TYPE_MAP = {
    reply: 'quick_reply',
    url: 'cta_url',
    call: 'cta_call',
    copy: 'cta_copy'
};

const sanitizePart = (value) =>
    (value || '')
        .replace(/[|*]/g, ' ')
        .trim();

export default function InteractiveMessageBuilder() {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [footer, setFooter] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [buttons, setButtons] = useState([]);
    const [draft, setDraft] = useState({ type: 'reply', label: '', value: '' });
    const [editingId, setEditingId] = useState(null);

    const isEditing = editingId !== null;

    const commandString = useMemo(() => {
        const bodyWithFooter = [body, footer].filter(Boolean).join('\n\n');
        const segments = [
            '#btn',
            sanitizePart(title),
            sanitizePart(bodyWithFooter)
        ];

        if (imageUrl) {
            segments.push(`image*${sanitizePart(imageUrl)}`);
        }

        buttons.forEach((btn) => {
            const mappedType = TYPE_MAP[btn.type] || btn.type;
            segments.push(
                `${mappedType}*${sanitizePart(btn.label)}*${sanitizePart(btn.value)}`
            );
        });

        return segments.join('|');
    }, [title, body, footer, imageUrl, buttons]);

    const previewImage = useMemo(() => {
        if (!imageUrl) return null;
        try {
            return new URL(imageUrl).toString();
        } catch (e) {
            return null;
        }
    }, [imageUrl]);

    const resetDraft = () => {
        setDraft({ type: 'reply', label: '', value: '' });
        setEditingId(null);
    };

    const handleSaveButton = () => {
        const label = draft.label.trim();
        const value = draft.value.trim();
        const needsValue = draft.type !== 'reply';

        if (!label) {
            toast.error('El label es obligatorio');
            return;
        }
        if (needsValue && !value) {
            toast.error('El valor es obligatorio para este tipo');
            return;
        }

        if (isEditing) {
            setButtons((prev) =>
                prev.map((btn) =>
                    btn.id === editingId
                        ? { ...btn, type: draft.type, label, value }
                        : btn
                )
            );
        } else {
            setButtons((prev) => [
                ...prev,
                { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type: draft.type, label, value }
            ]);
        }

        resetDraft();
    };

    const handleEdit = (btn) => {
        setDraft({ type: btn.type, label: btn.label, value: btn.value });
        setEditingId(btn.id);
    };

    const handleDelete = (id) => {
        setButtons((prev) => prev.filter((btn) => btn.id !== id));
        if (editingId === id) resetDraft();
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(commandString);
            toast.success('Comando copiado');
        } catch (e) {
            toast.error('No se pudo copiar');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        Constructor Visual de Mensajes
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Crea mensajes interactivos sin codigo y genera el comando listo para usar.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/40">
                        No-Code
                    </span>
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/40">
                        WhatsApp Style
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                            Contenido
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Title (Header)
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Promocion especial"
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Mensaje principal
                                </label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    rows={5}
                                    placeholder="Escribe tu mensaje..."
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Pie de pagina (se agrega al cuerpo)
                                </label>
                                <input
                                    type="text"
                                    value={footer}
                                    onChange={(e) => setFooter(e.target.value)}
                                    placeholder="Ej: Responde para continuar"
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Media (Image URL)
                                </label>
                                <input
                                    type="url"
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                {imageUrl && !previewImage && (
                                    <p className="text-xs text-amber-500 mt-2">
                                        URL no valida para previsualizacion.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                                Botones
                            </h4>
                            <span className="text-xs text-gray-400">{buttons.length} activos</span>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">Tipo</label>
                                    <select
                                        value={draft.type}
                                        onChange={(e) =>
                                            setDraft((prev) => ({ ...prev, type: e.target.value }))
                                        }
                                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {BUTTON_TYPES.map((type) => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">Label</label>
                                    <input
                                        type="text"
                                        value={draft.label}
                                        onChange={(e) =>
                                            setDraft((prev) => ({ ...prev, label: e.target.value }))
                                        }
                                        placeholder="Ej: Ver menu"
                                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">Valor</label>
                                    <input
                                        type="text"
                                        value={draft.value}
                                        onChange={(e) =>
                                            setDraft((prev) => ({ ...prev, value: e.target.value }))
                                        }
                                        placeholder={PLACEHOLDER_BY_TYPE[draft.type]}
                                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={handleSaveButton}
                                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    {isEditing ? 'Actualizar' : 'Agregar'}
                                </button>
                                {isEditing && (
                                    <button
                                        onClick={resetDraft}
                                        className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:text-gray-200 rounded-xl font-bold text-sm flex items-center gap-2"
                                    >
                                        <X size={16} />
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 space-y-3">
                            {buttons.length === 0 && (
                                <div className="text-sm text-gray-400 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                    No hay botones aun. Agrega tu primer boton usando el formulario.
                                </div>
                            )}
                            {buttons.map((btn) => (
                                <div
                                    key={btn.id}
                                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700 rounded-xl p-4"
                                >
                                    <div>
                                        <div className="text-sm font-bold text-gray-800 dark:text-gray-100">
                                            {btn.label}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {btn.type} · {btn.value || 'sin valor'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEdit(btn)}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200 hover:text-indigo-600"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(btn.id)}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                            Preview
                        </h4>
                        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-[#e5ddd5] dark:bg-[#0b141a] p-6 relative overflow-hidden">
                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#ffffff_0,_transparent_60%)]"></div>
                            <div className="relative max-w-sm">
                                <div className="bg-white dark:bg-[#1f2c34] text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-md p-4 shadow">
                                    {previewImage && (
                                        <img
                                            src={previewImage}
                                            alt="Preview"
                                            className="w-full h-40 object-cover rounded-xl mb-3"
                                        />
                                    )}
                                    <div className="text-sm font-bold mb-1">
                                        {title || 'Titulo del mensaje'}
                                    </div>
                                    <div className="text-sm whitespace-pre-wrap">
                                        {body || 'Escribe aqui el mensaje principal que veran tus usuarios.'}
                                    </div>
                                    {footer && (
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">
                                            {footer}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-3 space-y-2">
                                    {buttons.length === 0 ? (
                                        <div className="text-xs text-gray-500">
                                            Los botones apareceran aqui.
                                        </div>
                                    ) : (
                                        buttons.map((btn) => (
                                            <button
                                                key={btn.id}
                                                className="w-full bg-white dark:bg-[#1f2c34] text-sm text-emerald-600 dark:text-emerald-400 font-bold py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
                                            >
                                                {btn.label || 'Sin label'}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                                Generador
                            </h4>
                            <button
                                onClick={handleCopy}
                                className="px-3 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2"
                            >
                                <Copy size={14} /> Copiar
                            </button>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 font-mono text-xs text-gray-700 dark:text-gray-200 break-all">
                            {commandString}
                        </div>
                        <p className="text-xs text-gray-400 mt-3">
                            Formato: <span className="font-mono">#btn|Titulo|Cuerpo|image*URL|quick_reply*Texto*ID</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
