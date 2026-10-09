import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import type { DomesticSnapshot } from "@/hooks/use-domestic-probes";
import { formatBytes } from "@/lib/format";
import { nodeState } from "@/lib/monitoring";
import { type HealthIssue, nodeHealth } from "@/lib/node-health";
import type { NezhaServer } from "@/types/nezha-api";
import MonitoringOverview from "./MonitoringOverview";
import StatusHistory, { type ReportingFeed } from "./StatusHistory";
import { ModeToggle } from "./ThemeSwitcher";
import "./node-status.css";
import "./monitoring.css";

export { nodeState } from "@/lib/monitoring";

const MonitoringHistory = lazy(() => import("./MonitoringHistory"));
const DomesticNetworkChart = lazy(() => import("./DomesticNetworkChart"));

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
function HealthBadges({ issues }: { issues: HealthIssue[] }) {
	return issues.length ? (
		<ul className="status-health" aria-label="节点异常提示">
			{issues.map((issue) => (
				<li
					key={issue.label}
					className={`status-health-${issue.level}`}
					title={issue.detail}
				>
					<span>{issue.label}</span>
					<small>{issue.detail}</small>
				</li>
			))}
		</ul>
	) : null;
}
export default function NodeStatusView({
	servers,
	now,
	fresh,
	selectedId,
	histories = {},
	domestic,
	probeFailed = false,
	showCharts = false,
}: {
	domestic?: DomesticSnapshot;
	probeFailed?: boolean;
	showCharts?: boolean;
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
	const issues = Object.fromEntries(
		visible.map((s) => [
			s.id,
			nodeHealth(s, now, fresh, domestic, probeFailed),
		]),
	);
	const affected = visible.filter((s) => issues[s.id].length > 0).length;
	const healthy = fresh && visible.length > 0 && online === visible.length;
	const title = !fresh
		? "正在更新节点状态"
		: !visible.length
			? selectedId === undefined
				? "暂无公开节点"
				: "未找到这个节点"
			: healthy
				? selected
					? `${selected.name} 在线${affected ? " · 有异常提示" : ""}`
					: affected
						? `${affected} 台节点有异常提示`
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
	const state =
		healthy && !affected
			? "online"
			: offline && fresh
				? "offline"
				: fresh
					? "pending"
					: "updating";
	return (
		<div className="status-reference status-monitor-layout">
			<header className="monitor-top">
				<Link to="/status" className="monitor-brand">
					<strong>Boan Status</strong>
					<small>服务器与线路监控</small>
				</Link>
				<nav aria-label="状态站导航">
					<Link to="/">监控概览</Link>
					<Link to="/status" aria-current="page">
						节点状态
					</Link>
					<ModeToggle />
				</nav>
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
				<MonitoringOverview
					servers={servers}
					now={now}
					fresh={fresh}
					histories={histories}
					domestic={probeFailed ? undefined : domestic}
					issues={issues}
				/>
			)}
			{selected && (
				<>
					<section aria-label="节点上报历史" className="status-panel">
						<div className="status-panel-head">
							<h2>上报记录</h2>
							<span className="status-period">最近 24 小时</span>
						</div>
						<div className="status-node">
							<HealthBadges issues={issues[selected.id] || []} />
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
					{showCharts && (
						<Suspense
							fallback={
								<p className="monitor-chart-empty" role="status">
									正在加载图表…
								</p>
							}
						>
							<MonitoringHistory
								key={selected.id}
								serverId={selected.id}
								now={now}
							/>
							<div className="monitor-history-section">
								<DomesticNetworkChart
									key={selected.id}
									serverId={selected.id}
								/>
							</div>
						</Suspense>
					)}
				</>
			)}
			<footer className="status-footer">
				在线状态依据探针最近上报。超过 20 秒提示上报延迟，超过 30
				秒显示离线；资源使用率达到 90% 提示高占用。线路丢包来自最近一次 ICMP
				实测，连续两轮延迟明显升高才提示疑似拥堵。时间条表示各时段是否有上报记录；无记录不等同于故障，也不代表业务可用率。
			</footer>
		</div>
	);
}
