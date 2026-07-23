export const sanitizeInteractivePart = (value) =>
    String(value || "")
        .replace(/[|*]/g, " ")
        .trim();

const stableReplyId = (button, index) => {
    const source = String(button?.id || index + 1)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 48);
    return `reply_${source || index + 1}`;
};

export const buildInteractiveCommand = ({
    title = "",
    body = "",
    footer = "",
    imageUrl = "",
    buttons = []
} = {}) => {
    const segments = [
        "#btn",
        sanitizeInteractivePart(title),
        sanitizeInteractivePart(body)
    ];

    if (imageUrl) {
        segments.push(`image*${sanitizeInteractivePart(imageUrl)}`);
    }
    if (footer) {
        segments.push(`footer*${sanitizeInteractivePart(footer)}`);
    }

    buttons.forEach((button, index) => {
        const typeMap = {
            reply: "quick_reply",
            url: "cta_url",
            call: "cta_call",
            copy: "cta_copy"
        };
        const mappedType = typeMap[button.type] || button.type;
        const value = button.type === "reply" && !sanitizeInteractivePart(button.value)
            ? stableReplyId(button, index)
            : sanitizeInteractivePart(button.value);
        segments.push(
            `${mappedType}*${sanitizeInteractivePart(button.label)}*${value}`
        );
    });

    return segments.join("|");
};

export const getInteractiveBuilderValidationCode = ({ body = "", buttons = [] } = {}) => {
    if (buttons.length > 0 && !String(body || "").trim()) {
        return "INTERACTIVE_BODY_REQUIRED";
    }
    return null;
};

export const getBrowserPreviewImageUrl = (rawUrl) => {
    let url;
    try {
        url = new URL(String(rawUrl || "").trim());
    } catch {
        return null;
    }

    const host = url.hostname.toLowerCase();
    if (host === "drive.google.com" || host === "docs.google.com") {
        const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/i);
        const fileId = fileMatch?.[1] || url.searchParams.get("id");
        if (fileId) {
            const preview = new URL("https://drive.google.com/thumbnail");
            preview.searchParams.set("id", fileId);
            preview.searchParams.set("sz", "w1200");
            return preview.toString();
        }
    }

    return url.toString();
};
