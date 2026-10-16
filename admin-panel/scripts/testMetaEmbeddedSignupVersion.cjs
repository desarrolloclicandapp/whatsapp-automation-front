const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
function section(file, start, end, offset = 0) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    const first = source.indexOf(start, offset);
    const last = source.indexOf(end, first + start.length);
    assert(first >= 0 && last > first, `Missing actual OAuth builder: ${file}`);
    return source.slice(first, last);
}
const entries = ["src/admin/LocationDetailsModal.jsx", "src/admin/LocationDetailsModalNext.jsx"].map((file) => {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    const start = source.indexOf("const startOfficialEmbeddedSignup = async (slotId) => {");
    assert(start >= 0);
    // Execute the real URL-building statements without mounting React, opening
    // a popup, or running the callback/code-exchange logic.
    const body = section(file, "const extras = {", 'logEmbeddedSignupDebug("starting manual oauth"', start);
    return { file, source: `function build(official, slotId) { ${body}\nreturn { oauthUrl, oauthState, oauthRedirectUri: redirectUri }; }` };
});
entries.push({
    file: "src/standalone-app/StandaloneSlotManager.jsx",
    source: section("src/standalone-app/StandaloneSlotManager.jsx", "function buildStandaloneMetaOauthUrl(", "export default function StandaloneSlotManager("),
    standalone: true
});

let cases = 0;
for (const entry of entries) {
    const flow = { current: {} };
    const builder = vm.runInNewContext(`${entry.source}\n${entry.standalone ? "buildStandaloneMetaOauthUrl" : "build"}`, { URL, embeddedSignupFlowRef: flow });
    for (const sessionInfoVersion of [undefined, 1, 2, 3, "2", "invalid", 0]) {
        for (const coexistenceEnabled of [undefined, true, false]) {
            for (const solutionId of ["", "synthetic-solution"]) {
                for (const versions of [{ graphVersion: "v23.0", sdkVersion: "v22.0" }, { sdkVersion: "v22.0" }, {}]) {
                    const official = {
                        embeddedSignupEnabled: true, embeddedSignupAppId: "synthetic-app",
                        embeddedSignupConfigurationId: "synthetic-config",
                        embeddedSignupRedirectUri: "https://test.invalid/meta/embedded-signup/callback",
                        embeddedSignupSessionInfoVersion: sessionInfoVersion,
                        embeddedSignupCoexistenceEnabled: coexistenceEnabled,
                        embeddedSignupSolutionId: solutionId,
                        embeddedSignupGraphVersion: versions.graphVersion,
                        embeddedSignupSdkVersion: versions.sdkVersion
                    };
                    const result = builder(official, 2, "synthetic-location");
                    const url = new URL(result.oauthUrl);
                    const extras = JSON.parse(url.searchParams.get("extras"));
                    assert.strictEqual(Object.hasOwn(extras, "version"), false, `${entry.file}: extras must omit version entirely`);
                    const expectedExtras = { sessionInfoVersion: Number(sessionInfoVersion) || 3 };
                    if (coexistenceEnabled !== false) expectedExtras.featureType = "whatsapp_business_app_onboarding";
                    if (solutionId) expectedExtras.setup = { solutionID: solutionId };
                    assert.deepStrictEqual(extras, expectedExtras, `${entry.file}: preserve every other extras key`);
                    assert.strictEqual(url.origin, "https://www.facebook.com");
                    assert.strictEqual(url.pathname, `/${versions.graphVersion || versions.sdkVersion || "v21.0"}/dialog/oauth`);
                    assert.deepStrictEqual(Object.fromEntries(url.searchParams), {
                        client_id: official.embeddedSignupAppId, app_id: official.embeddedSignupAppId,
                        config_id: official.embeddedSignupConfigurationId, redirect_uri: official.embeddedSignupRedirectUri,
                        response_type: "code", override_default_response_type: "true", display: "popup",
                        state: result.oauthState, extras: JSON.stringify(expectedExtras)
                    });
                    assert.strictEqual(result.oauthRedirectUri, official.embeddedSignupRedirectUri);
                    assert(result.oauthState, "OAuth state must still be generated");
                    if (!entry.standalone) {
                        assert.strictEqual(flow.current.slotId, 2);
                        assert.strictEqual(flow.current.oauthState, result.oauthState);
                        assert.strictEqual(flow.current.oauthRedirectUri, result.oauthRedirectUri);
                    }
                    cases += 1;
                }
            }
        }
    }
    if (entry.standalone) {
        assert.throws(() => builder({ embeddedSignupEnabled: false }, 2));
        assert.throws(() => builder({ embeddedSignupEnabled: true }, 2));
    }
}
console.log(`testMetaEmbeddedSignupVersion passed: ${entries.length} real entry points, ${cases} OAuth combinations, no network`);
