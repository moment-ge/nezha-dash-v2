import StatusHistory, { type ReportingFeed } from "./StatusHistory";
import "./node-status.css";
import { Link } from "react-router-dom";
import { nodeIsOnline, serverLocation } from "@/lib/server-location";
import { formatBytes } from "@/lib/format";
import type { NezhaServer } from "@/types/nezha-api";
import { regionName } from "./RegionSummary";

export function nodeState(server: NezhaServer, now: number, fresh: boolean) {
	if (!fresh) return "updating";
	if (
		!Number.isFinite(Date.parse(server.last_active)) ||
		Date.parse(server.last_active) <= 0
	)
		return "pending";
	return nodeIsOnline(now, server) ? "online" : "offline";
}
const labels = {
	online: "在线",
	offline: "离线",
	pending: "等待上报",
	updating: "更新中",
};
function StatusSymbol({ state }: { state: keyof typeof labels }) {
	return (
		<span aria-hidden="true" className={`status-symbol status-symbol-${state}`}>
			{state === "online" ? "✓" : state === "offline" ? "−" : "!"}
		</span>
	);
}
function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="status-metric">
			<dt>{label}</dt>
			<dd>{value}</dd>
		</div>
	);
}
export default function NodeStatusView({
	servers,
	now,
	fresh,
	selectedId,
	histories = {},
}: {
	servers: NezhaServer[];
	now: number;
	fresh: boolean;
	selectedId?: number;
	histories?: Record<number, ReportingFeed>;
}) {
	const selected = servers.find((s) => s.id === selectedId);
	const visible =
		selectedId === undefined ? servers : selected ? [selected] : [];
	const online = visible.filter(
		(s) => nodeState(s, now, fresh) === "online",
	).length;
	const offline = visible.filter(
		(s) => nodeState(s, now, fresh) === "offline",
	).length;
	const healthy = fresh && visible.length > 0 && online === visible.length;
	const title = !fresh
		? "正在更新节点状态"
		: !visible.length
			? selectedId === undefined
				? "暂无公开节点"
				: "未找到这个节点"
			: healthy
				? selected
					? `${selected.name} 在线`
					: "所有节点均在线"
				: offline
					? selected
						? `${selected.name} 已离线`
						: `${offline} 台节点离线`
					: "等待节点上报";
	const reportTime = selected ? Date.parse(selected.last_active) : NaN;
	const live = selected && nodeState(selected, now, fresh) === "online";
	const percent = (used: number, total: number) =>
		total > 0 ? `${((used / total) * 100).toFixed(1)}%` : "—";
	const state = healthy
		? "online"
		: offline && fresh
			? "offline"
			: fresh
				? "pending"
				: "updating";
	const counts = new Map<string, number>();
	for (const server of visible) {
		const code = serverLocation(server);
		if (code) counts.set(code, (counts.get(code) || 0) + 1);
	}
	return (
		<div className="status-reference">
			<header className="status-top">
				<Link to="/status" className="status-wordmark">
					节点状态
				</Link>
				<Link to="/" className="status-action">
					监控概览
				</Link>
			</header>
			{selectedId !== undefined && (
				<Link to="/status" className="status-back">
					‹ 全部节点
				</Link>
			)}
			<section
				aria-label="当前状态"
				className={`status-banner ${state === "offline" ? "status-banner-offline" : state !== "online" ? "status-banner-warning" : ""}`}
			>
				<div className="status-banner-title">
					<StatusSymbol state={state} />
					<h1>{title}</h1>
				</div>
				<p className="status-banner-copy">
					{!fresh
						? "正在获取最新监控数据，请稍候。"
						: !visible.length
							? "可以返回节点列表查看目前公开的服务器。"
							: selected
								? Number.isFinite(reportTime) && reportTime > 0
									? `最近上报：${new Date(reportTime).toLocaleString("zh-CN", { hour12: false })}`
									: "尚未收到节点的首次上报。"
								: `${visible.length} 台节点 · ${online} 台在线${offline ? ` · ${offline} 台离线` : ""}`}
				</p>
			</section>
			{selectedId === undefined && (
				<section aria-label="各节点状态" className="status-panel">
					<div className="status-panel-head">
						<h2>系统状态</h2>
						<span className="status-period">最近 24 小时</span>
					</div>
					{servers.length ? (
						servers.map((server) => (
							<article key={server.id} className="status-node">
								<div className="status-node-heading">
									<Link
										to={`/status/${server.id}`}
										aria-label={`查看 ${server.name} 的状态`}
										className="status-node-link"
									>
										<StatusSymbol state={nodeState(server, now, fresh)} />
										<h3>{server.name}</h3>
										<span className="status-location">
											{regionName(serverLocation(server))}
										</span>
										<span className="status-chevron" aria-hidden="true">
											›
										</span>
									</Link>
									<span className="status-node-state">
										{labels[nodeState(server, now, fresh)]}
									</span>
								</div>
								<StatusHistory feed={histories[server.id]} now={now} />
							</article>
						))
					) : (
						<p className="status-empty">
							{fresh ? "暂无公开节点" : "正在加载节点…"}
						</p>
					)}
				</section>
			)}
			{selected && (
				<>
					<section aria-label="节点上报历史" className="status-panel">
						<div className="status-panel-head">
							<h2>上报记录</h2>
							<span className="status-period">最近 24 小时</span>
						</div>
						<div className="status-node">
							<StatusHistory feed={histories[selected.id]} now={now} />
						</div>
					</section>
					<section
						aria-label="节点当前指标"
						className="status-panel"
						style={{ marginTop: 24 }}
					>
						<div className="status-panel-head">
							<h2>当前指标</h2>
							<span className="status-period">
								{live ? "实时更新" : "等待实时数据"}
							</span>
						</div>
						<dl className="status-metrics">
							<Metric
								label="CPU 使用率"
								value={live ? `${selected.state.cpu.toFixed(1)}%` : "—"}
							/>
							<Metric
								label="内存使用率"
								value={
									live
										? percent(selected.state.mem_used, selected.host.mem_total)
										: "—"
								}
							/>
							<Metric
								label="磁盘使用率"
								value={
									live
										? percent(
												selected.state.disk_used,
												selected.host.disk_total,
											)
										: "—"
								}
							/>
							<Metric
								label="连续运行"
								value={
									live
										? `${Math.floor(selected.state.uptime / 3600)} 小时`
										: "—"
								}
							/>
						</dl>
						<div className="status-system">
							<span>
								{selected.host.platform} {selected.host.platform_version}
							</span>
							<span>
								上传{" "}
								{live ? `${formatBytes(selected.state.net_out_speed)}/s` : "—"}
							</span>
							<span>
								下载{" "}
								{live ? `${formatBytes(selected.state.net_in_speed)}/s` : "—"}
							</span>
						</div>
						<Link to={`/server/${selected.id}`} className="status-details-link">
							查看详细监控与图表 <span aria-hidden="true"> ↗</span>
						</Link>
					</section>
				</>
			)}
			{!!counts.size && (
				<section aria-label="节点分布" className="status-region-summary">
					{[...counts].map(([code, count]) => (
						<span key={code}>
							{regionName(code)} · {count} 台
						</span>
					))}
				</section>
			)}
			<footer className="status-footer">
				在线状态依据探针最近上报。时间条表示各时段是否有上报记录；无记录不等同于故障，也不代表业务可用率。
			</footer>
		</div>
	);
}
