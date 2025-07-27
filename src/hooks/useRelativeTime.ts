/**
 * @file useRelativeTime.ts
 * @description
 * Custom React hook that returns a localized, dynamically updating relative time string
 * (e.g., "3 minutes ago", "hace 3 minutos") based on a given reference date.
 *
 * The hook leverages the `getRelativeTime` utility to compute a human-readable time difference
 * and updates the result at a specified interval (default: 60 seconds).
 *
 * It also integrates with `react-i18next` to provide internationalized output,
 * ensuring compatibility with the extension's multilingual interface.
 *
 * This is particularly useful for timestamp displays like "last analyzed at" that stay up to date
 * while the user keeps the extension open.
 *
 * @author Raúl García Balongo
 * @date 2025
 */

import {useEffect, useState} from "react";
import {getRelativeTime} from "../services/dataProcessor";
import {useTranslation} from "react-i18next";

export function useRelativeTime(date: Date | null, intervalMs = 60_000): string | null {
    const {t} = useTranslation();

    const [relative, setRelative] = useState<string | null>(() =>
        date ? getRelativeTime(date, t) : null
    );

    useEffect(() => {
        if (!date) return;

        const update = () => setRelative(getRelativeTime(date, t));
        update(); // Run immediately

        const interval = setInterval(update, intervalMs);
        return () => clearInterval(interval);
    }, [date, intervalMs, t]);

    return relative;
}

