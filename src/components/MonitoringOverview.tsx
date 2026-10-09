import { ArrowDown, ArrowUp, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { DomesticSnapshot } from "@/hooks/use-domestic-probes";
import { formatBytes } from "@/lib/format";
import { currentCarrierRows, nodeState, usagePercent } from "@/lib/monitoring";
import type { HealthIssue } from "@/lib/node-health";
import { serverLocation } from "@/lib/server-location";
import type { NezhaServer } from "@/types/nezha-api";
import { regionName } from "./RegionSummary";
import StatusHistory, { type ReportingFeed } from "./StatusHistory";

const stateLabels = {
	online: "在线",
	offline: "离线",
	pending: "等待上报",
	updating: "更新中",
};
function Resource({
	label,
	percent,
}: {
	label: string;
	percent: number | null;
}) {
	return (
		<div className="monitor-resource">
			<div>
				<span>{label}</span>
				<strong>{percent === null ? "—" : `${percent.toFixed(1)}%`}</strong>
			</div>
			<div className="monitor-resource-track" aria-hidden="true">
				<span
					style={{ width: `${percent ?? 0}%` }}
					className={percent !== null && percent >= 90 ? "high" : undefined}
				/>
			</div>
		</div>
	);
}

export default function MonitoringOverview({
	servers,
	now,
	fresh,
	histories,
	domestic,
	issues,
}: {
	servers: NezhaServer[];
	now: number;
	fresh: boolean;
	histories: Record<number, ReportingFeed>;
	domestic?: DomesticSnapshot;
	issues: Record<number, HealthIssue[]>;
}) {
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState("all");
	const online = servers.filter(
		(server) => nodeState(server, now, fresh) === "online",
	);
	const offline = servers.filter(
		(server) => nodeState(server, now, fresh) === "offline",
	);
	const visible = servers.filter((server) => {
		const state = nodeState(server, now, fresh);
		return (
			`${server.name} ${regionName(serverLocation(server))}`
				.toLowerCase()
				.includes(search.trim().toLowerCase()) &&
			(filter === "all" ||
				(filter === "online" && state === "online") ||
				(filter === "attention" &&
					(state === "offline" || (issues[server.id]?.length ?? 0) > 0)))
		);
	});
	const rate = (key: "net_out_speed" | "net_in_speed") =>
		fresh
			? `${formatBytes(online.reduce((sum, server) => sum + Math.max(0, server.state[key]), 0))}/s`
			: "—";
	return (
		<section className="monitor-overview" aria-label="服务器监控总览">
			<dl className="monitor-summary">
				{[
					{ label: "公开节点", value: servers.length },
					{ label: "在线节点", value: fresh ? online.length : "—" },
					{ label: "离线节点", value: fresh ? offline.length : "—" },
					{
						label: "总上传 / 下载",
						value: `${rate("net_out_speed")} / ${rate("net_in_speed")}`,
					},
				].map((item) => (
					<div key={item.label}>
						<dt>{item.label}</dt>
						<dd>{item.value}</dd>
					</div>
				))}
			</dl>
			<div className="monitor-toolbar">
				<fieldset className="monitor-filters" aria-label="筛选节点状态">
					{[
						{ value: "all", label: "全部节点" },
						{ value: "online", label: "在线" },
						{ value: "attention", label: "需要关注" },
					].map((item) => (
						<button
							type="button"
							key={item.value}
							aria-pressed={filter === item.value}
							onClick={() => setFilter(item.value)}
						>
							{item.label}
						</button>
					))}
				</fieldset>
				<label className="monitor-search">
					<Search size={16} aria-hidden="true" />
					<input
						aria-label="搜索节点名称或地区"
						placeholder="搜索节点名称或地区"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</label>
			</div>
			<div className="monitor-grid">
				{visible.map((server) => {
					const state = nodeState(server, now, fresh);
					const live = state === "online";
					const rows = currentCarrierRows(domestic, server.id, now);
					return (
						<article
							className="monitor-card"
							key={server.id}
							aria-label={server.name}
						>
							<div className="monitor-card-heading">
								<div>
									<Link
										aria-label={`查看 ${server.name} 的状态`}
										to={`/status/${server.id}`}
									>
										<h2>{server.name}</h2>
									</Link>
									<span className="monitor-muted">
										{regionName(serverLocation(server)) || "地区未提供"} ·{" "}
										{server.host.platform} {server.host.platform_version}
									</span>
								</div>
								<span className={`monitor-state ${state}`}>
									<i aria-hidden="true" />
									{stateLabels[state]}
								</span>
							</div>
							<div className="monitor-resources">
								<Resource
									label="CPU"
									percent={
										live && Number.isFinite(server.state.cpu)
											? Math.min(100, Math.max(0, server.state.cpu))
											: null
									}
								/>
								<Resource
									label="内存"
									percent={
										live
											? usagePercent(
													server.state.mem_used,
													server.host.mem_total,
												)
											: null
									}
								/>
								<Resource
									label="磁盘"
									percent={
										live
											? usagePercent(
													server.state.disk_used,
													server.host.disk_total,
												)
											: null
									}
								/>
							</div>
							<dl className="monitor-traffic">
								<div>
									<dt>实时上传</dt>
									<dd>
										<ArrowUp size={13} aria-hidden="true" />
										{live
											? `${formatBytes(server.state.net_out_speed)}/s`
											: "—"}
									</dd>
								</div>
								<div>
									<dt>实时下载</dt>
									<dd>
										<ArrowDown size={13} aria-hidden="true" />
										{live ? `${formatBytes(server.state.net_in_speed)}/s` : "—"}
									</dd>
								</div>
								<div>
									<dt>累计出站 / 入站</dt>
									<dd>
										{live
											? `${formatBytes(server.state.net_out_transfer)} / ${formatBytes(server.state.net_in_transfer)}`
											: "—"}
									</dd>
								</div>
							</dl>
							<div className="monitor-carriers">
								<span className="monitor-muted">桂林 → 节点 · ICMP</span>
								<div>
									{["电信", "联通", "移动"].map((carrier) => {
										const row = rows.find((value) => value.carrier === carrier);
										const loss = row
											? (((row.sent ?? 0) - (row.received ?? 0)) /
													(row.sent ?? 0)) *
												100
											: null;
										return (
											<span
												key={carrier}
												title={
													row
														? `采样 ${new Date(row.measured_at ?? 0).toLocaleString("zh-CN")} · ${row.received}/${row.sent} 包回复`
														: "当前没有有效探测"
												}
											>
												<small>{carrier}</small>
												<strong>
													{row
														? row.received === 0
															? "无响应"
															: `${row.latency_ms?.toFixed(0) ?? "—"} ms`
														: "—"}
												</strong>
												<small
													className={
														loss !== null && loss > 0
															? "monitor-loss"
															: undefined
													}
												>
													{loss === null ? "未测" : `${loss.toFixed(2)}% 丢包`}
												</small>
											</span>
										);
									})}
								</div>
							</div>
							{issues[server.id]?.length > 0 && (
								<p
									className="monitor-card-warning"
									title={issues[server.id]
										.map((item) => item.detail)
										.join("；")}
								>
									{issues[server.id].map((item) => item.label).join(" · ")}
								</p>
							)}
							<div className="monitor-reporting">
								<StatusHistory now={now} feed={histories[server.id]} />
							</div>
							<Link className="monitor-card-link" to={`/status/${server.id}`}>
								查看资源与网络历史 <ChevronRight size={14} aria-hidden="true" />
							</Link>
						</article>
					);
				})}
			</div>
			{!visible.length && (
				<div className="monitor-empty">
					<p>
						{servers.length
							? "没有匹配的节点"
							: fresh
								? "暂无公开节点"
								: "正在加载节点…"}
					</p>
					{servers.length > 0 && (
						<button
							type="button"
							onClick={() => {
								setSearch("");
								setFilter("all");
							}}
						>
							清除筛选
						</button>
					)}
				</div>
			)}
		</section>
	);
}
