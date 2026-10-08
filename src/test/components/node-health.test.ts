import { describe, it, expect } from "vitest";
import { nodeHealth } from "@/lib/node-health";
import { createServer } from "@/test/fixtures";
import type { DomesticSnapshot, Row } from "@/hooks/use-domestic-probes";
const now = Date.parse("2025-01-01T00:00:20Z");
const server = createServer();
function snapshot(): DomesticSnapshot {
	const rows: Row[] = ["电信", "联通", "移动"].map((carrier) => ({
		city: "Guilin",
		carrier,
		asn: 4134,
		status: "ok",
		latency_ms: 50,
		loss_pct: 0,
		sent: 16,
		received: 16,
		measured_at: now,
		route_id: carrier,
	}));
	return {
		updated_at: now,
		interval_seconds: 900,
		servers: [
			{
				server_id: 1,
				status: "ok",
				rows,
				history: Array.from({ length: 6 }, (_, i) => ({
					timestamp: now - i * 900000,
					rows: rows.map((r) => ({
						...r,
						measured_at: now - i * 900000,
						latency_ms: i < 2 ? 100 : 50,
					})),
				})),
			},
		],
	};
}
describe("node health evidence", () => {
	it("requires two continuous elevated samples from one route", () => {
		const data = snapshot();
		data.servers[0].rows.forEach((r) => {
			r.latency_ms = 100;
		});
		expect(
			nodeHealth(server, now, true, data).filter((i) =>
				i.label.includes("拥堵"),
			),
		).toHaveLength(3);
		data.servers[0].history![1].rows = [];
		expect(
			nodeHealth(server, now, true, data).filter((i) =>
				i.label.includes("拥堵"),
			),
		).toHaveLength(0);
	});
	it("does not compare latency across changed probes", () => {
		const data = snapshot();
		data.servers[0].history![2].rows.forEach((r) => {
			r.route_id = "old";
		});
		expect(
			nodeHealth(server, now, true, data).filter((i) =>
				i.label.includes("拥堵"),
			),
		).toHaveLength(0);
	});
	it("distinguishes missing measurements from actual complete loss", () => {
		const data = snapshot();
		data.servers[0].history = [];
		Object.assign(data.servers[0].rows[0], {
			loss_pct: 100,
			received: 0,
			latency_ms: null,
		});
		Object.assign(data.servers[0].rows[1], {
			status: "unavailable",
			loss_pct: null,
		});
		expect(nodeHealth(server, now, true, data).map((i) => i.label)).toEqual([
			"电信线路无响应",
			"联通探测异常",
		]);
	});
	it("does not turn stale snapshots into node failures", () => {
		const data = snapshot();
		data.updated_at = now - 1200000;
		expect(nodeHealth(server, now, true, data)).toEqual([
			expect.objectContaining({ label: "探测异常", level: "unknown" }),
		]);
		expect(nodeHealth(server, now, false, data)).toEqual([]);
	});
	it("reports delayed updates and high utilization independently", () => {
		expect(
			nodeHealth(createServer({ state: { cpu: 95 } }), now + 5000, true).map(
				(i) => i.label,
			),
		).toEqual(["上报延迟", "CPU 高占用"]);
		expect(nodeHealth(server, now, true)).toEqual([]);
	});
});
