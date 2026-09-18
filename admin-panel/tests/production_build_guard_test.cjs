const assert = require("assert");
const fs = require("fs");
const path = require("path");

// On 2026-09-14 the panel was built without its production variables and a
// dist/ from older builds rode along into the image. Installs went to the
// "waflow development" app and the card form used a placeholder Stripe key.
// These guards make that build impossible to ship again.

const ROOT = path.join(__dirname, "..");

const PRODUCTION_ENV = {
    VITE_API_URL: "https://wa.waflow.ai",
    VITE_INSTALL_APP_URL: "https://app.gohighlevel.com/integration/691623d58a49cdcb2c56ce9c",
    VITE_STRIPE_PUBLIC_KEY: "pk_live_51SmfjvHSoN0LpQiB",
    VITE_SUPPORT_PHONE: "34611770270"
};

(async () => {
    const { findProductionEnvProblems } = await import("../vite.config.js");

    assert.deepStrictEqual(findProductionEnvProblems(PRODUCTION_ENV), [], "the real production values must pass");

    // Exactly the 2026-09-14 build: only the variable with a Dockerfile default.
    const september14 = findProductionEnvProblems({ VITE_API_URL: "https://wa.waflow.ai" });
    for (const name of ["VITE_INSTALL_APP_URL", "VITE_STRIPE_PUBLIC_KEY", "VITE_SUPPORT_PHONE"]) {
        assert.ok(september14.some((problem) => problem.startsWith(`${name} is missing`)), `${name} must be required`);
    }

    assert.ok(
        findProductionEnvProblems({ ...PRODUCTION_ENV, VITE_INSTALL_APP_URL: "https://app.gohighlevel.com/integration/6968d10f1f0b9e6b537024cd" })
            .some((problem) => /waflow development/.test(problem)),
        "the development app must be refused"
    );
    assert.ok(
        findProductionEnvProblems({ ...PRODUCTION_ENV, VITE_STRIPE_PUBLIC_KEY: "pk_test_abc" }).length > 0,
        "a test Stripe key must be refused"
    );
    assert.ok(
        findProductionEnvProblems({ ...PRODUCTION_ENV, VITE_API_URL: "https://test-development-whatsapp-back-service-v1.lrkqbo.easypanel.host" })
            .some((problem) => /test environment/.test(problem)),
        "a test API must be refused"
    );

    // No development, test or placeholder value may live in the source either.
    const forbidden = [
        [/6968d10f1f0b9e6b537024cd/, "the waflow development app"],
        [/wa\.waflow\.com/, "wa.waflow.com, a domain that does not resolve"],
        [/pk_live_your_key_here/, "a placeholder Stripe key"],
        [/lrkqbo|test-development-|187\.77\.38\.216/, "the test environment"]
    ];
    const violations = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(jsx?|html)$/.test(entry.name)) {
                fs.readFileSync(full, "utf8").split(/\r?\n/).forEach((line, index) => {
                    for (const [pattern, why] of forbidden) {
                        if (pattern.test(line)) violations.push(`${path.relative(ROOT, full)}:${index + 1} — ${why}`);
                    }
                });
            }
        }
    };
    walk(path.join(ROOT, "src"));
    assert.deepStrictEqual(violations, [], `the panel source references forbidden values:\n${violations.join("\n")}`);

    // The image is built from source only.
    const dockerignore = fs.readFileSync(path.join(ROOT, ".dockerignore"), "utf8").split(/\r?\n/).map((line) => line.trim());
    assert.ok(dockerignore.includes("dist"), "a local dist/ must never reach the image");
    assert.ok(dockerignore.includes("node_modules"), "host node_modules must never reach the image");

    console.log("production_build_guard_test passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
