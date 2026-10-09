import type { DomesticSnapshot, Row } from "@/hooks/use-domestic-probes";
import type { MetricDataPoint, NezhaServer } from "@/types/nezha-api";
import { nodeIsOnline } from "./server-location";

export function nodeState(server: NezhaServer, now: number, fresh: boolean) {
	if (!fresh) return "updating";
	const last = Date.parse(server.last_active);
	if (!Number.isFinite(last) || last <= 0) return "pending";
	return nodeIsOnline(now, server) ? "online" : "offline";
}

export function usagePercent(used: number, total: number): number | null {
	return Number.isFinite(used) &&
		used >= 0 &&
		Number.isFinite(total) &&
		total > 0
		? Math.min(100, (used / total) * 100)
		: null;
}

export function currentCarrierRows(
	snapshot: DomesticSnapshot | undefined,
	id: number,
	now: number,
): Row[] {
	const maxAge = (snapshot?.interval_seconds || 900) * 1000 + 120000;
	const recent = (time?: number) =>
		!!time && time <= now + 30000 && now - time <= maxAge;
	const node = snapshot?.servers.find((server) => server.server_id === id);
	if (
		snapshot?.schema_version !== 2 ||
		!recent(snapshot.updated_at) ||
		node?.status !== "ok"
	)
		return [];
	return node.rows.filter(
		(row) =>
			row.status === "ok" &&
			recent(row.measured_at) &&
			Number.isInteger(row.sent) &&
			(row.sent ?? 0) > 0 &&
			(row.sent ?? 0) <= 16 &&
			Number.isInteger(row.received) &&
			(row.received ?? -1) >= 0 &&
			(row.received ?? -1) <= (row.sent ?? 0) &&
			(row.received === 0 ||
				(Number.isFinite(row.latency_ms) && (row.latency_ms ?? -1) >= 0)),
	);
}

export function chartSamples(
	points: MetricDataPoint[],
	now: number,
	hours: number,
) {
	const sorted = points
		.filter(
			(point) =>
				Number.isFinite(point.ts) &&
				Number.isFinite(point.value) &&
				point.value >= 0 &&
				point.ts >= now - hours * 3600000 &&
				point.ts <= now,
		)
		.sort((a, b) => a.ts - b.ts);
	// Insert missing buckets so charts never imply measurements through an outage.
	const typical = hours > 168 ? 2 * 3600000 : hours > 24 ? 30 * 60000 : 30000;
	const result: { ts: number; value: number | null }[] = [];
	for (const point of sorted) {
		const previous = result[result.length - 1];
		if (previous && typical > 0 && point.ts - previous.ts > typical * 1.5)
			result.push({ ts: previous.ts + typical, value: null });
		result.push(point);
	}
	return result;
}
