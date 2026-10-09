import { describe, expect, it } from "vitest";
import type { DomesticSnapshot } from "@/hooks/use-domestic-probes";
import {
	chartSamples,
	currentCarrierRows,
	usagePercent,
} from "@/lib/monitoring";

const now = 1770000000000;
const snapshot: DomesticSnapshot = {
	schema_version: 2,
	updated_at: now,
	interval_seconds: 900,
	servers: [
		{
			server_id: 7,
			status: "ok",
			rows: [
				{
					city: "桂林",
					carrier: "电信",
					asn: 4134,
					status: "ok",
					measured_at: now,
					latency_ms: 100,
					loss_pct: 0,
					sent: 16,
					received: 16,
				},
			],
		},
	],
};
describe("monitoring data", () => {
	it("isolates probes by node and hides failed, stale or impossible samples", () => {
		expect(currentCarrierRows(snapshot, 7, now)).toHaveLength(1);
		expect(currentCarrierRows(snapshot, 8, now)).toHaveLength(0);
		expect(currentCarrierRows(snapshot, 7, now + 1020001)).toHaveLength(0);
		expect(
			currentCarrierRows(
				{ ...snapshot, servers: [{ ...snapshot.servers[0], status: "error" }] },
				7,
				now,
			),
		).toHaveLength(0);
		expect(
			currentCarrierRows(
				{
					...snapshot,
					servers: [
						{
							...snapshot.servers[0],
							rows: [{ ...snapshot.servers[0].rows[0], received: 17 }],
						},
					],
				},
				7,
				now,
			),
		).toHaveLength(0);
	});
	it("retains a real total-loss result without inventing a latency", () => {
		const value = {
			...snapshot,
			servers: [
				{
					...snapshot.servers[0],
					rows: [
						{
							...snapshot.servers[0].rows[0],
							received: 0,
							latency_ms: null,
							loss_pct: 100,
						},
					],
				},
			],
		};
		expect(currentCarrierRows(value, 7, now)[0].latency_ms).toBeNull();
	});
	it("keeps empty history gaps and filters future, invalid and out-of-range samples", () => {
		const result = chartSamples(
			[
				{ ts: now - 300000, value: 10 },
				{ ts: now - 270000, value: 20 },
				{ ts: now, value: 30 },
				{ ts: now + 1, value: 90 },
				{ ts: now - 7200000, value: 40 },
				{ ts: now - 1, value: NaN },
			],
			now,
			1,
		);
		expect(result).toEqual([
			{ ts: now - 300000, value: 10 },
			{ ts: now - 270000, value: 20 },
			{ ts: now - 240000, value: null },
			{ ts: now, value: 30 },
		]);
		expect(
			chartSamples(
				[
					{ ts: now - 14400000, value: 2 },
					{ ts: now, value: 3 },
				],
				now,
				720,
			).some((p) => p.value === null),
		).toBe(true);
	});
	it("does not report unknown resource capacity as zero usage", () => {
		expect(usagePercent(0, 0)).toBeNull();
		expect(usagePercent(50, 200)).toBe(25);
		expect(usagePercent(NaN, 200)).toBeNull();
	});
});
