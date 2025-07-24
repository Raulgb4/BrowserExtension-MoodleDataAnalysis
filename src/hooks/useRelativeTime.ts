import {useEffect, useState} from "react";
import {getRelativeTime} from "../services/dataProcessor";

/**
 * Hook that returns a localized relative time string (e.g., "hace 3 minutos")
 * and updates it automatically every N milliseconds.
 *
 * @param date - The reference date from which to calculate the relative time.
 * @param intervalMs - Update interval in milliseconds (default: 1 minute).
 */
export function useRelativeTime(date: Date | null, intervalMs = 60_000): string | null {
    const [relative, setRelative] = useState<string | null>(() =>
        date ? getRelativeTime(date) : null
    );

    useEffect(() => {
        if (!date) return;

        const update = () => setRelative(getRelativeTime(date));
        update(); // Run immediately on mount

        const interval = setInterval(update, intervalMs);
        return () => clearInterval(interval);
    }, [date, intervalMs]);

    return relative;
}
