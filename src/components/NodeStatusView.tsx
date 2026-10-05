import { Link } from "react-router-dom";
import { nodeIsOnline, serverLocation } from "@/lib/server-location";
import { formatBytes } from "@/lib/format";
import type { NezhaServer } from "@/types/nezha-api";
import RegionSummary, { regionName } from "./RegionSummary";

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
const colors = {
	online: "bg-emerald-500",
	offline: "bg-red-500",
	pending: "bg-slate-400",
	updating: "bg-amber-500",
};
function StateLabel({ state }: { state: keyof typeof labels }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium">
			<span
				aria-hidden="true"
				className={`size-2 rounded-full ${colors[state]}`}
			/>
			{labels[state]}
		</span>
	);
}
function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border p-4">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className="mt-2 text-xl font-medium tabular-nums">{value}</dd>
		</div>
	);
}
export default function NodeStatusView({
	servers,
	now,
	fresh,
	selectedId,
}: {
	servers: NezhaServer[];
	now: number;
	fresh: boolean;
	selectedId?: number;
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
	return (
		<div className="mx-auto w-full max-w-5xl space-y-8 py-4 sm:py-8">
			<nav aria-label="状态视图导航" className="flex flex-wrap gap-2 text-sm">
				<Link
					to="/"
					className="inline-flex min-h-11 items-center rounded-lg px-4 text-muted-foreground hover:bg-muted focus-visible:ring-2"
				>
					监控概览
				</Link>
				<Link
					to="/status"
					aria-current={selectedId === undefined ? "page" : undefined}
					className="inline-flex min-h-11 items-center rounded-lg bg-muted px-4 font-medium focus-visible:ring-2"
				>
					节点状态
				</Link>
			</nav>
			<section
				aria-label="当前状态"
				className={`rounded-2xl border p-6 sm:p-8 ${healthy ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : offline && fresh ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30" : "bg-muted/40"}`}
			>
				<div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
					<span
						aria-hidden="true"
						className={`size-2 rounded-full ${healthy ? colors.online : offline && fresh ? colors.offline : colors.updating}`}
					/>
					当前节点状态
				</div>
				<h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
					{title}
				</h1>
				<p className="mt-3 text-sm leading-6 text-muted-foreground">
					{!fresh
						? "监控连接恢复后将自动刷新，暂不判断节点是否离线。"
						: !visible.length
							? "可以返回节点列表查看目前公开的服务器。"
							: selected
								? Number.isFinite(reportTime) && reportTime > 0
									? `最近上报：${new Date(reportTime).toLocaleString("zh-CN", { hour12: false })}`
									: "尚未收到节点的首次上报。"
								: `${visible.length} 台节点 · ${online} 台在线${offline ? ` · ${offline} 台离线` : ""}`}
				</p>
			</section>
			<RegionSummary servers={visible} />
			{selected ? (
				<>
					<section aria-label="节点当前指标" className="space-y-4">
						<div className="flex flex-wrap items-baseline justify-between gap-2">
							<h2 className="text-lg font-semibold">当前指标</h2>
							<span className="text-sm text-muted-foreground">
								{live ? "随节点上报更新" : "等待实时数据"}
							</span>
						</div>
						<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
						<div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
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
					</section>
					<div className="flex flex-wrap gap-3">
						<Link
							to={`/server/${selected.id}`}
							className="inline-flex min-h-11 items-center rounded-lg bg-foreground px-5 text-sm font-medium text-background focus-visible:ring-2"
						>
							查看详细监控与图表
						</Link>
						<Link
							to="/status"
							className="inline-flex min-h-11 items-center rounded-lg border px-5 text-sm focus-visible:ring-2"
						>
							全部节点
						</Link>
					</div>
				</>
			) : (
				selectedId === undefined && (
					<section aria-label="各节点状态">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="text-lg font-semibold">各节点状态</h2>
							<span className="text-sm text-muted-foreground">
								{servers.length} 台节点
							</span>
						</div>
						<div className="divide-y rounded-xl border bg-card">
							{servers.map((server) => (
								<article
									key={server.id}
									className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-5 sm:p-6"
								>
									<div className="min-w-0 flex-1">
										<h3 className="break-words text-base font-medium">
											{server.name}
										</h3>
										<p className="mt-1 text-sm text-muted-foreground">
											{regionName(serverLocation(server)) ||
												server.host.platform}
										</p>
									</div>
									<div className="flex items-center gap-4">
										<StateLabel state={nodeState(server, now, fresh)} />
										<Link
											to={`/status/${server.id}`}
											aria-label={`查看 ${server.name} 的状态`}
											className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted focus-visible:ring-2"
										>
											查看状态 <span aria-hidden="true">↗</span>
										</Link>
									</div>
								</article>
							))}
						</div>
					</section>
				)
			)}
			<p className="text-xs leading-5 text-muted-foreground">
				在线状态依据探针最近上报；具体网络质量可在节点详细监控中查看。
			</p>
		</div>
	);
}
