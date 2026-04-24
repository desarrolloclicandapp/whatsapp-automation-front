import React, { useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../context/LanguageContext";

const BUTTON_TYPES = [
    { value: "reply", labelKey: "builder.type.reply" },
    { value: "url", labelKey: "builder.type.url" },
    { value: "call", labelKey: "builder.type.call" },
    { value: "copy", labelKey: "builder.type.copy" }
];

const PLACEHOLDER_KEY_BY_TYPE = {
    reply: "builder.placeholder.reply",
    url: "builder.placeholder.url",
    call: "builder.placeholder.call",
    copy: "builder.placeholder.copy"
};

const TYPE_MAP = {
    reply: "quick_reply",
    url: "cta_url",
    call: "cta_call",
    copy: "cta_copy"
};

const sanitizePart = (value) =>
    (value || "")
        .replace(/[|*]/g, " ")
        .trim();

export default function StandaloneMessageBuilder() {
    const { t } = useLanguage();
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [footer, setFooter] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [buttons, setButtons] = useState([]);
    const [draft, setDraft] = useState({ type: "reply", label: "", value: "" });
    const [editingId, setEditingId] = useState(null);

    const isEditing = editingId !== null;

    const commandString = useMemo(() => {
        const segments = [
            "#btn",
            sanitizePart(title),
            sanitizePart(body)
        ];

        if (imageUrl) {
            segments.push(`image*${sanitizePart(imageUrl)}`);
        }

        if (footer) {
            segments.push(`footer*${sanitizePart(footer)}`);
        }

        buttons.forEach((btn) => {
            const mappedType = TYPE_MAP[btn.type] || btn.type;
            segments.push(
                `${mappedType}*${sanitizePart(btn.label)}*${sanitizePart(btn.value)}`
            );
        });

        return segments.join("|");
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
        setDraft({ type: "reply", label: "", value: "" });
        setEditingId(null);
    };

    const handleSaveButton = () => {
        const label = draft.label.trim();
        const value = draft.value.trim();
        const needsValue = draft.type !== "reply";

        if (!label) {
            toast.error(t("builder.toast.label_required"));
            return;
        }
        if (needsValue && !value) {
            toast.error(t("builder.toast.value_required"));
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
            toast.success(t("builder.toast.command_copied"));
        } catch (e) {
            toast.error(t("builder.toast.copy_error"));
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        {t("builder.page.title")}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t("builder.page.subtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/40">
                        {t("builder.badge.no_code")}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/40">
                        {t("builder.badge.whatsapp_style")}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                            {t("builder.section.content")}
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    {t("builder.field.title_label")}
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={t("builder.field.title_placeholder")}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    {t("builder.field.body_label")}
                                </label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    rows={5}
                                    placeholder={t("builder.field.body_placeholder")}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    {t("builder.field.footer_label")}
                                </label>
                                <input
                                    type="text"
                                    value={footer}
                                    onChange={(e) => setFooter(e.target.value)}
                                    placeholder={t("builder.field.footer_placeholder")}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    {t("builder.field.media_label")}
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
                                        {t("builder.field.media_invalid")}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                                {t("builder.section.buttons")}
                            </h4>
                            <span className="text-xs text-gray-400">
                                {buttons.length} {t("builder.buttons.active")}
                            </span>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">{t("builder.field.type")}</label>
                                    <select
                                        value={draft.type}
                                        onChange={(e) =>
                                            setDraft((prev) => ({ ...prev, type: e.target.value }))
                                        }
                                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {BUTTON_TYPES.map((type) => (
                                            <option key={type.value} value={type.value}>
                                                {t(type.labelKey)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">{t("builder.field.label")}</label>
                                    <input
                                        type="text"
                                        value={draft.label}
                                        onChange={(e) =>
                                            setDraft((prev) => ({ ...prev, label: e.target.value }))
                                        }
                                        placeholder={t("builder.field.label_placeholder")}
                                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">{t("builder.field.value")}</label>
                                    <input
                                        type="text"
                                        value={draft.value}
                                        onChange={(e) =>
                                            setDraft((prev) => ({ ...prev, value: e.target.value }))
                                        }
                                        placeholder={t(PLACEHOLDER_KEY_BY_TYPE[draft.type])}
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
                                    {isEditing ? t("builder.action.update") : t("builder.action.add")}
                                </button>
                                {isEditing && (
                                    <button
                                        onClick={resetDraft}
                                        className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 dark:text-gray-200 rounded-xl font-bold text-sm flex items-center gap-2"
                                    >
                                        <X size={16} />
                                        {t("builder.action.cancel")}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 space-y-3">
                            {buttons.length === 0 && (
                                <div className="text-sm text-gray-400 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                    {t("builder.empty.buttons")}
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
                                            {t(BUTTON_TYPES.find((type) => type.value === btn.type)?.labelKey || "builder.type.reply")}
                                            {" - "}
                                            {btn.value || t("builder.value.empty")}
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
                            {t("builder.preview.title")}
                        </h4>
                        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-[#e5ddd5] dark:bg-[#0b141a] p-6 relative overflow-hidden">
                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#ffffff_0,_transparent_60%)]"></div>
                            <div className="relative max-w-sm">
                                <div className="bg-white dark:bg-[#1f2c34] text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-md p-4 shadow">
                                    {previewImage && (
                                        <img
                                            src={previewImage}
                                            alt={t("builder.preview.title")}
                                            className="w-full h-40 object-cover rounded-xl mb-3"
                                        />
                                    )}
                                    <div className="text-sm font-bold mb-1">
                                        {title || t("builder.preview.default_title")}
                                    </div>
                                    <div className="text-sm whitespace-pre-wrap">
                                        {body || t("builder.preview.default_body")}
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
                                            {t("builder.preview.empty_buttons")}
                                        </div>
                                    ) : (
                                        buttons.map((btn) => (
                                            <button
                                                key={btn.id}
                                                className="w-full bg-white dark:bg-[#1f2c34] text-sm text-emerald-600 dark:text-emerald-400 font-bold py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
                                            >
                                                {btn.label || t("builder.preview.empty_label")}
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
                                {t("builder.generator.title")}
                            </h4>
                            <button
                                onClick={handleCopy}
                                className="px-3 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2"
                            >
                                <Copy size={14} /> {t("builder.generator.copy")}
                            </button>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 font-mono text-xs text-gray-700 dark:text-gray-200 break-all">
                            {commandString}
                        </div>
                        <p className="text-xs text-gray-400 mt-3">
                            {t("builder.generator.format")}{" "}
                            <span className="font-mono">#btn|Title|Body|image*URL|footer*Text|quick_reply*Text*ID</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
