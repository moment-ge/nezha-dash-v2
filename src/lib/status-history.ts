import type { MetricDataPoint } from "@/types/nezha-api";
export const HISTORY_SLOT = 15 * 60 * 1000;
export function reportingHistory(points: MetricDataPoint[], now: number) {
	const end = Math.ceil(now / HISTORY_SLOT) * HISTORY_SLOT;
	const start = end - 96 * HISTORY_SLOT;
	const bins = Array.from({ length: 96 }, (_, i) => ({
		start: start + i * HISTORY_SLOT,
		count: 0,
	}));
	for (const point of points) {
		if (
			!Number.isFinite(point.ts) ||
			!Number.isFinite(point.value) ||
			point.ts > now
		)
			continue;
		const i = Math.floor((point.ts - start) / HISTORY_SLOT);
		if (i >= 0 && i < 96) bins[i].count++;
	}
	return bins;
}
