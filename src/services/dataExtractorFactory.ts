/**
 * @file dataExtractorFactory.ts
 * @description Factory module responsible for selecting the appropriate
 * IDataExtractor implementation (production vs. local) based on the current
 * environment. Environment detection is primarily performed by matching
 * window.location.origin against known Moodle base URLs, with a safe fallback
 * to production to avoid breaking official usage.
 *
 * This ensures that the rest of the codebase can remain decoupled from the
 * specific DOM differences between environments, relying only on the common
 * IDataExtractor interface.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {IDataExtractor} from "./IDataExtractor";
import {LocalDataExtractor} from "./dataExtractorLocal";
import {ProdDataExtractor} from "./dataExtractorProd";
import {devlog} from "../utils/devlog";

export type Env = "prod" | "local";

export const MOODLE_BASE_URL_PROD = "https://informatica.cv.uma.es";
export const MOODLE_BASE_URL_LOCAL = "http://localhost:8080";

/**
 * Detect environment using the current window (valid in content scripts).
 */
export function detectEnvironment(win: Window = window): Env {
    const origin = win.location.origin;
    if (origin.startsWith(MOODLE_BASE_URL_PROD)) return "prod";
    if (origin.startsWith(MOODLE_BASE_URL_LOCAL)) return "local";
    return "prod";
}

/**
 * Detect environment from an absolute URL (useful in popup/side panel).
 */
export function detectEnvironmentFromUrl(url: string): Env {
    try {
        const origin = new URL(url).origin;
        if (origin.startsWith(MOODLE_BASE_URL_PROD)) return "prod";
        if (origin.startsWith(MOODLE_BASE_URL_LOCAL)) return "local";
    } catch (e) {
        devlog.warn("factory", "detectEnvironmentFromUrl: invalid URL", {url, error: String(e)});
    }
    return "prod";
}

/**
 * Factory that builds an IDataExtractor. If a tab URL is provided, it uses it
 * to detect the environment (needed when running from popup/side panel).
 *
 * @param tabUrl Optional absolute URL of the active tab.
 */
export function createDataExtractor(tabUrl?: string): IDataExtractor {
    const env = tabUrl ? detectEnvironmentFromUrl(tabUrl) : detectEnvironment();
    const extractor = env === "local" ? new LocalDataExtractor() : new ProdDataExtractor();

    devlog.info("factory", "Environment detected", {
        env,
        extractor: extractor.constructor.name,
        tabUrl,
    });

    return extractor;
}
