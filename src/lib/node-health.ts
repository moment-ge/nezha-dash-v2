import type { DomesticSnapshot, Row } from "@/hooks/use-domestic-probes";
import type { NezhaServer } from "@/types/nezha-api";
import { nodeIsOnline } from "./server-location";

export type HealthIssue = {
	label: string;
	detail: string;
	level: "warning" | "danger" | "unknown";
};
export function nodeHealth(
	server: NezhaServer,
	now: number,
	fresh: boolean,
	snapshot?: DomesticSnapshot,
	failed = false,
): HealthIssue[] {
	if (!fresh || !nodeIsOnline(now, server)) return [];
	const issues: HealthIssue[] = [];
	const age = Math.floor((now - Date.parse(server.last_active)) / 1000);
	if (age > 20)
		issues.push({
			label: "上报延迟",
			detail: `${age} 秒未收到上报`,
			level: "warning",
		});
	for (const [name, value] of [
		["CPU", server.state.cpu],
		[
			"内存",
			server.host.mem_total > 0
				? (server.state.mem_used / server.host.mem_total) * 100
				: 0,
		],
		[
			"磁盘",
			server.host.disk_total > 0
				? (server.state.disk_used / server.host.disk_total) * 100
				: 0,
		],
	] as const) {
		if (value >= 90)
			issues.push({
				label: `${name} 高占用`,
				detail: `${name} 使用率 ${value.toFixed(1)}%`,
				level: "warning",
			});
	}
	if (!snapshot && !failed) return issues;
	const interval = (snapshot?.interval_seconds || 900) * 1000;
	const recent = (time?: number) =>
		!!time && now - time <= interval + 120000 && time <= now + 30000;
	const probe = snapshot?.servers.find((s) => s.server_id === server.id);
	if (
		failed ||
		!recent(snapshot?.updated_at) ||
		!probe ||
		probe.status !== "ok"
	) {
		issues.push({
			label: "探测异常",
			detail: "国内探测暂不可用或数据过期，不能据此判断节点故障",
			level: "unknown",
		});
		return issues;
	}
	for (const carrier of ["电信", "联通", "移动"]) {
		const row = probe.rows.find((r) => r.carrier === carrier);
		if (!row || row.status !== "ok" || !recent(row.measured_at)) {
			issues.push({
				label: `${carrier}探测异常`,
				detail: "探针暂不可用，等待下一轮采集",
				level: "unknown",
			});
			continue;
		}
		if (row.loss_pct != null && row.loss_pct > 0)
			issues.push({
				label:
					row.loss_pct === 100 ? `${carrier}线路无响应` : `${carrier}线路丢包`,
				detail: `最近一次 ICMP 实测丢包 ${row.loss_pct.toFixed(2)}%（${row.received}/${row.sent} 包回复）`,
				level: row.loss_pct >= 20 ? "danger" : "warning",
			});
		// Compare only a continuous run from the same probe, never across a switch or missing round.
		const run: Row[] = [];
		let nextTime = now;
		for (const sample of [...(probe.history || [])].sort(
			(a, b) => b.timestamp - a.timestamp,
		)) {
			const value = sample.rows.find((r) => r.carrier === carrier);
			if (sample.timestamp > now + 30000) continue;
			if (
				nextTime - sample.timestamp > interval + 120000 ||
				!row.route_id ||
				value?.route_id !== row.route_id ||
				value.status !== "ok" ||
				value.latency_ms == null
			)
				break;
			run.push(value);
			nextTime = sample.timestamp;
		}
		if (run.length >= 6 && run[0].measured_at === row.measured_at) {
			const baseline = run
				.slice(2)
				.map((r) => r.latency_ms as number)
				.sort((a, b) => a - b);
			const median = baseline[Math.floor(baseline.length / 2)];
			if (
				run
					.slice(0, 2)
					.every(
						(r) =>
							(r.latency_ms as number) > Math.max(median * 1.5, median + 30),
					)
			) {
				issues.push({
					label: `${carrier}疑似拥堵`,
					detail: `连续两轮延迟明显高于同一探针历史基线 ${median.toFixed(1)} ms；ICMP 无法确认业务拥堵`,
					level: "warning",
				});
			}
		}
	}
	return issues;
}
