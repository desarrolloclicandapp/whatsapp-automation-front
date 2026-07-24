import React, { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../context/LanguageContext";
import {
    buildInteractiveCommand,
    getBrowserPreviewImageUrl,
    getInteractiveBuilderValidationCode
} from "../utils/interactiveMessageBuilder";

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

export default function InteractiveMessageBuilder() {
    const { t } = useLanguage();
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [footer, setFooter] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [buttons, setButtons] = useState([]);
    const [draft, setDraft] = useState({ type: "reply", label: "", value: "" });
    const [editingId, setEditingId] = useState(null);
    const [previewFailed, setPreviewFailed] = useState(false);

    const isEditing = editingId !== null;

    const commandString = useMemo(
        () => buildInteractiveCommand({ title, body, footer, imageUrl, buttons }),
        [title, body, footer, imageUrl, buttons]
    );

    const previewImage = useMemo(() => {
        if (!imageUrl) return null;
        return getBrowserPreviewImageUrl(imageUrl);
    }, [imageUrl]);
    const validationCode = useMemo(
        () => getInteractiveBuilderValidationCode({ body, buttons }),
        [body, buttons]
    );
    const hasAuthoredText = Boolean(title.trim() || body.trim() || footer.trim());

    useEffect(() => {
        setPreviewFailed(false);
    }, [previewImage]);

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
        if (validationCode === "INTERACTIVE_BODY_REQUIRED") {
            toast.error(t("builder.toast.body_required"));
            return;
        }
        try {
            await navigator.clipboard.writeText(commandString);
            toast.success(t("builder.toast.command_copied"));
        } catch (e) {
            toast.error(t("builder.toast.copy_error"));
        }
    };

    return (
        <div className="interactive-builder-ui mx-auto max-w-6xl space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 gap-4 lg:h-[calc(100dvh-9rem)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] lg:items-start">

                <div className="wf-soft-scrollbar min-w-0 space-y-4 overscroll-contain lg:h-full lg:overflow-y-auto lg:pr-3">
                    <section className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t("builder.field.body_label")}
                                </label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    rows={4}
                                    placeholder={t("builder.field.body_placeholder")}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                    </section>

                    <section className="space-y-4">
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                                <div>
                                    <label className="mb-1 block text-[11px] font-medium text-gray-500">{t("builder.field.type")}</label>
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
                                    <label className="mb-1 block text-[11px] font-medium text-gray-500">{t("builder.field.label")}</label>
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
                                    <label className="mb-1 block text-[11px] font-medium text-gray-500">{t("builder.field.value")}</label>
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
                                <div className="flex gap-2 md:justify-end">
                                <button
                                    type="button"
                                    onClick={handleSaveButton}
                                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 md:flex-none"
                                >
                                    <Plus size={14} />
                                    {isEditing ? t("builder.action.update") : t("builder.action.add")}
                                </button>
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={resetDraft}
                                        aria-label={t("builder.action.cancel")}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:text-indigo-600 dark:border-gray-700 dark:text-gray-300"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            {buttons.length === 0 && (
                                <div className="py-3 text-sm text-gray-400 dark:text-gray-500">
                                    {t("builder.empty.buttons")}
                                </div>
                            )}
                            {buttons.map((btn) => (
                                <div
                                    key={btn.id}
                                    className="flex flex-col justify-between gap-3 border-b border-gray-200 py-3 last:border-b-0 md:flex-row md:items-center dark:border-gray-800"
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
                    </section>
                </div>

                <div className="min-w-0 space-y-4 lg:sticky lg:top-0">

                    <section className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                            {t("builder.preview.title")}
                        </h4>
                        <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-[#e5ddd5] p-3 dark:border-gray-800 dark:bg-[#0b141a]">
                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#ffffff_0,_transparent_60%)]"></div>
                            <div className="relative max-w-sm">
                                <div className="rounded-xl rounded-tl-md bg-white p-3 text-gray-900 shadow dark:bg-[#1f2c34] dark:text-gray-100">
                                    {previewImage && !previewFailed && (
                                        <img
                                            src={previewImage}
                                            alt={t("builder.preview.title")}
                                            className="mb-2 h-32 w-full rounded-lg object-cover"
                                            onError={() => setPreviewFailed(true)}
                                        />
                                    )}
                                    {previewFailed && (
                                        <div className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                                            {t("builder.preview.image_unavailable")}
                                        </div>
                                    )}
                                    {title && (
                                        <div className="mb-1 text-sm font-semibold">{title}</div>
                                    )}
                                    {body && (
                                        <div className="text-sm whitespace-pre-wrap">{body}</div>
                                    )}
                                    {footer && (
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">
                                            {footer}
                                        </div>
                                    )}
                                    {!previewImage && !hasAuthoredText && (
                                        <div className="text-xs text-gray-400">
                                            {t("builder.preview.empty_content")}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2 space-y-1.5">
                                    {buttons.length === 0 ? (
                                        <div className="text-xs text-gray-500">
                                            {t("builder.preview.empty_buttons")}
                                        </div>
                                    ) : (
                                        buttons.map((btn) => (
                                            <button
                                                key={btn.id}
                                                className="w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-semibold text-emerald-600 shadow-sm dark:border-gray-700 dark:bg-[#1f2c34] dark:text-emerald-400"
                                            >
                                                {btn.label || t("builder.preview.empty_label")}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
                        <div className="flex items-center justify-between gap-3">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                {t("builder.generator.title")}
                            </h4>
                            <button
                                type="button"
                                onClick={handleCopy}
                                disabled={Boolean(validationCode)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                                <Copy size={13} /> {t("builder.generator.copy")}
                            </button>
                        </div>
                        <div className="break-all rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            {commandString}
                        </div>
                        {validationCode === "INTERACTIVE_BODY_REQUIRED" && (
                            <p className="text-xs text-red-500">
                                {t("builder.validation.body_required")}
                            </p>
                        )}
                        <p className="text-xs text-gray-400">
                            {t("builder.generator.format")} {" "}
                            <span className="font-mono">#btn|Title|Body|image*URL|footer*Text|quick_reply*Text*ID</span>
                        </p>
                    </section>
                </div>
            </div>


        </div>
    );
}
