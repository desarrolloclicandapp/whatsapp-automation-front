import assert from "node:assert/strict";
import {
    buildInteractiveCommand,
    getBrowserPreviewImageUrl,
    getInteractiveBuilderValidationCode
} from "../src/utils/interactiveMessageBuilder.js";

const imageOnly = buildInteractiveCommand({
    imageUrl: "https://drive.google.com/file/d/file-123/view?usp=sharing"
});
assert.equal(
    imageOnly,
    "#btn|||image*https://drive.google.com/file/d/file-123/view?usp=sharing"
);

const replyWithoutAuthoredId = buildInteractiveCommand({
    body: "Mensaje",
    imageUrl: "https://example.com/image.png",
    buttons: [{ id: "stable-button", type: "reply", label: "Si", value: "" }]
});
assert.equal(
    replyWithoutAuthoredId,
    "#btn||Mensaje|image*https://example.com/image.png|quick_reply*Si*reply_stable-button"
);
assert.equal(
    buildInteractiveCommand({
        body: "Mensaje",
        buttons: [{ id: "stable-button", type: "reply", label: "Si", value: "" }]
    }),
    "#btn||Mensaje|quick_reply*Si*reply_stable-button",
    "generated reply IDs must stay stable"
);

assert.equal(
    getInteractiveBuilderValidationCode({
        body: "",
        buttons: [{ id: "1", type: "reply", label: "Si", value: "" }]
    }),
    "INTERACTIVE_BODY_REQUIRED"
);
assert.equal(
    getInteractiveBuilderValidationCode({
        body: "Mensaje",
        buttons: [{ id: "1", type: "reply", label: "Si", value: "" }]
    }),
    null
);
assert.equal(
    getInteractiveBuilderValidationCode({
        body: "",
        buttons: []
    }),
    null,
    "image-only and authored text messages do not require a body"
);

const drivePreview = new URL(
    getBrowserPreviewImageUrl("https://drive.google.com/file/d/file-123/view?usp=sharing")
);
assert.equal(drivePreview.hostname, "drive.google.com");
assert.equal(drivePreview.pathname, "/thumbnail");
assert.equal(drivePreview.searchParams.get("id"), "file-123");
assert.equal(getBrowserPreviewImageUrl("not-a-url"), null);

console.log("testInteractiveMessageBuilder passed");
