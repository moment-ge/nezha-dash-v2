import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { formatBytes } from "@/lib/format";
import { chartSamples } from "@/lib/monitoring";
import { fetchLoginUser, fetchServerMetrics } from "@/lib/nezha-api";
import type { MetricPeriod, MetricType } from "@/types/nezha-api";

const metrics: {
	key: MetricType;
	label: string;
	unit: string;
	color: string;
}[] = [
	{ key: "cpu", label: "CPU 使用率", unit: "%", color: "#059669" },
	{ key: "memory", label: "内存使用量", unit: "bytes", color: "#7c3aed" },
	{ key: "disk", label: "磁盘使用量", unit: "bytes", color: "#d97706" },
	{ key: "net_out_speed", label: "上传速度", unit: "rate", color: "#0284c7" },
	{ key: "net_in_speed", label: "下载速度", unit: "rate", color: "#059669" },
	{ key: "tcp_conn", label: "TCP 连接数", unit: "count", color: "#7c3aed" },
];
const periods = [
	{ value: "1h", label: "1 小时", hours: 1 },
	{ value: "1d", label: "24 小时", hours: 24 },
	{ value: "7d", label: "7 天", hours: 168 },
	{ value: "30d", label: "30 天", hours: 720 },
] as const;
type Period = (typeof periods)[number]["value"];

export default function MonitoringHistory({
	serverId,
	now,
}: {
	serverId: number;
	now: number;
}) {
	const [period, setPeriod] = useState<Period>("1d");
	const user = useQuery({
		queryKey: ["login-user"],
		queryFn: fetchLoginUser,
		retry: 0,
		staleTime: 30000,
	});
	const member =
		!user.isError && user.data?.success === true && !!user.data.data?.id;
	const selected =
		(period === "7d" || period === "30d") && !member ? "1d" : period;
	useEffect(() => {
		if (selected !== period) setPeriod(selected);
	}, [selected, period]);
	const apiPeriod: MetricPeriod = selected === "1h" ? "1d" : selected;
	const hours =
		selected === "1h"
			? 1
			: selected === "1d"
				? 24
				: selected === "7d"
					? 168
					: 720;
	const queries = useQueries({
		queries: metrics.map((metric) => ({
			queryKey: ["monitor-history", serverId, metric.key, apiPeriod],
			queryFn: async () => {
				const result = await fetchServerMetrics(
					serverId,
					metric.key,
					apiPeriod,
				);
				if (
					!result.success ||
					result.data?.server_id !== serverId ||
					result.data.metric !== metric.key ||
					!Array.isArray(result.data.data_points)
				)
					throw new Error("历史记录暂不可用");
				return result.data.data_points;
			},
			staleTime: 60000,
			refetchInterval: 60000,
			retry: 0,
		})),
	});
	const date = (ts: number) =>
		new Date(ts).toLocaleString("zh-CN", {
			month: hours > 24 ? "numeric" : undefined,
			day: hours > 24 ? "numeric" : undefined,
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
	return (
		<section aria-label="节点资源历史" className="monitor-history-section">
			<div className="monitor-section-heading">
				<div>
					<h2>资源历史</h2>
					<p>网卡速率与系统资源实测；数据缺口保留空白。</p>
				</div>
				<fieldset className="monitor-filters" aria-label="历史时间范围">
					{periods.map((item) => (
						<button
							type="button"
							key={item.value}
							aria-pressed={selected === item.value}
							disabled={
								!member && (item.value === "7d" || item.value === "30d")
							}
							title={
								!member && (item.value === "7d" || item.value === "30d")
									? "登录后可查看更长历史"
									: undefined
							}
							onClick={() => setPeriod(item.value)}
						>
							{item.label}
						</button>
					))}
				</fieldset>
			</div>
			{!member && (
				<p className="monitor-muted monitor-history-note">
					公开展示最近 24 小时；登录后可查看 7 天与 30
					天。实际范围取决于已保存的记录。
				</p>
			)}
			<div className="monitor-chart-grid">
				{metrics.map((metric, index) => {
					const query = queries[index];
					const data = chartSamples(query.data || [], now, hours);
					const format = (value: number) =>
						metric.unit === "bytes"
							? formatBytes(value)
							: metric.unit === "rate"
								? `${formatBytes(value)}/s`
								: `${value.toFixed(metric.unit === "%" ? 1 : 0)}${metric.unit === "%" ? "%" : ""}`;
					return (
						<article key={metric.key} className="monitor-chart-card">
							<div className="monitor-chart-title">
								<h3>{metric.label}</h3>
								<span>
									{data.length ? format(data[data.length - 1].value ?? 0) : "—"}
								</span>
							</div>
							{query.isPending ? (
								<div className="monitor-chart-empty" role="status">
									正在加载历史…
								</div>
							) : query.isError ? (
								<div className="monitor-chart-empty" role="alert">
									<p>历史记录暂不可用</p>
									<button type="button" onClick={() => void query.refetch()}>
										重试
									</button>
								</div>
							) : !data.length ? (
								<div className="monitor-chart-empty">
									所选时间内没有已保存的记录
								</div>
							) : (
								<div
									className="monitor-chart"
									role="img"
									aria-label={`${metric.label}历史，${data.filter((point) => point.value !== null).length} 个实测点`}
								>
									<ResponsiveContainer width="100%" height="100%">
										<LineChart
											data={data}
											margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
										>
											<CartesianGrid
												stroke="var(--monitor-grid-line)"
												strokeDasharray="3 3"
												vertical={false}
											/>
											<XAxis
												dataKey="ts"
												type="number"
												domain={[now - hours * 3600000, now]}
												tickFormatter={date}
												tick={{ fontSize: 10 }}
												minTickGap={32}
											/>
											<YAxis
												width={65}
												domain={metric.unit === "%" ? [0, 100] : [0, "auto"]}
												tickFormatter={format}
												tick={{ fontSize: 10 }}
											/>
											<Tooltip
												labelFormatter={(value) => date(Number(value))}
												formatter={(value) => [
													format(Number(value)),
													metric.label,
												]}
												contentStyle={{
													background: "hsl(var(--card))",
													border: "1px solid hsl(var(--border))",
													borderRadius: 8,
													fontSize: 12,
												}}
											/>
											<Line
												type="linear"
												dataKey="value"
												stroke={metric.color}
												strokeWidth={1.8}
												dot={data.length === 1}
												connectNulls={false}
												isAnimationActive={false}
											/>
										</LineChart>
									</ResponsiveContainer>
								</div>
							)}
						</article>
					);
				})}
			</div>
		</section>
	);
}
