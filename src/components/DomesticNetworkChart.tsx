import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDomesticProbes, type Row } from "@/hooks/use-domestic-probes";

const carriers = ["电信", "联通", "移动"];
const colors = ["#0284c7", "#d97706", "#059669"];
type Metric = "latency_ms" | "loss_pct";
const freshFor = 12 * 60_000;

export function validDomesticRow(row: Row | undefined, time: number, maxAge = freshFor): row is Row {
	return !!row && row.status === "ok" && !!row.measured_at &&
		row.measured_at <= time + 30_000 && time - row.measured_at < maxAge &&
		Number.isInteger(row.sent) && row.sent! > 0 && row.sent! <= 16 &&
		Number.isInteger(row.received) && row.received! >= 0 && row.received! <= row.sent!;
}

export function domesticChartData(history: { timestamp: number; rows: Row[] }[], metric: Metric, intervalMs = 15 * 60_000): { time: number; [key: string]: number | null }[] {
	const chart: { time: number; [key: string]: number | null }[] = [];
	const routes = new Map<string, string>();
	for (const sample of [...history].sort((a, b) => a.timestamp - b.timestamp)) {
        const previousTime = chart[chart.length - 1]?.time;
        if (previousTime != null && sample.timestamp - previousTime > intervalMs + 120_000) {
            chart.push({ time: previousTime + 1, ...Object.fromEntries(carriers.map(carrier => [carrier, null])) });
        }
		const values = Object.fromEntries(carriers.map((carrier) => {
			const row = sample.rows.find((r) => r.carrier === carrier && r.route_id);
			return [carrier, validDomesticRow(row, sample.timestamp) ? valueFor(row, metric) : null];
		}));
		const changed = carriers.filter(carrier => {
			const row = sample.rows.find(r => r.carrier === carrier && r.route_id);
			if (!row?.route_id) return false;
			const previous = routes.get(carrier);
			routes.set(carrier, row.route_id);
			return previous && previous !== row.route_id;
		});
		if (changed.length) chart.push({time: sample.timestamp - 1, ...Object.fromEntries(carriers.map(carrier =>
			[carrier, changed.includes(carrier) ? null : values[carrier]]))});
		chart.push({time: sample.timestamp, ...values});
	}
	return chart;
}

export function domesticChartBridges(chart: { time: number; [key: string]: number | null }[], maxGapMs = 45 * 60_000) {
    const bridges: { carrier: string; points: { time: number; value: number }[] }[] = [];
    for (const carrier of carriers) {
        let previous = -1;
        chart.forEach((point, index) => {
            const value = point[carrier];
            if (value == null) return;
            if (previous >= 0 && index > previous + 1 && point.time - chart[previous].time <= maxGapMs) {
                bridges.push({ carrier, points: [
                    { time: chart[previous].time, value: chart[previous][carrier]! },
                    { time: point.time, value },
                ] });
            }
            previous = index;
        });
    }
    return bridges;
}

const cityNames: Record<string, string> = {
	Beijing: "北京", Shanghai: "上海", Guangzhou: "广州", Shenzhen: "深圳", Nanjing: "南京",
	Wuhan: "武汉", Changsha: "长沙", Wuhu: "芜湖", "Xi'an": "西安", Nanning: "南宁",
	Tianjin: "天津", Ningbo: "宁波", Kunming: "昆明", Guilin: "桂林", Taishan: "台山",
	Wuxi: "无锡", Zhenjiang: "镇江", Yangzhou: "扬州", Hangzhou: "杭州", Chengdu: "成都", Chongqing: "重庆",
};


function valueFor(row: Row, metric: Metric) {
	if (metric === "loss_pct") return (row.sent! - row.received!) * 100 / row.sent!;
	return row.received! > 0 && row.latency_ms != null && Number.isFinite(row.latency_ms) && row.latency_ms >= 0 ? row.latency_ms : null;
}

export function domesticUnavailableReason(current: boolean, row: Row | undefined, error?: string) {
 if (error === "rate_limited") return "探测服务限额，等待下轮采样";
 if (error === "timeout") return "探测任务未完成，非节点超时结论";
 if (error === "provider_error") return "探测服务异常";
 if (!current) return "本轮数据已过期或未更新";
 if (row?.reason === "probe_error") return "探针执行失败，无法判断节点状态";
 return "该运营商暂无可用国内探测源";
}

export function lastDomesticSample(rows: Row[], carrier: string, now: number): Row | undefined {
 return rows.filter(r => r.carrier === carrier && !!r.route_id && validDomesticRow(r, now, 7 * 86400_000))
  .sort((a,b) => b.measured_at! - a.measured_at!)[0];
}

export default function DomesticNetworkChart({ serverId }: { serverId: number }) {
	const { data, isError } = useDomesticProbes();
	const [metric, setMetric] = useState<Metric>("latency_ms");
	const now = Date.now();
	const interval = data?.interval_seconds || 600;
	const maxAge = (interval + 120) * 1000;
	const server = data?.schema_version === 2 ? data.servers.find((s) => s.server_id === serverId) : undefined;
	const current = !isError && server?.status === "ok" && !!data &&
		now - data.updated_at < maxAge && data.updated_at <= now + 30_000;
	const history = (server?.history || []).filter((sample) => sample.timestamp > now - 86400_000 && sample.timestamp <= now + 30_000);
	const chart = domesticChartData(history, metric, interval * 1000);
	const bridges = domesticChartBridges(chart);
	const validCount = current ? (server?.rows || []).filter(r => validDomesticRow(r, now, maxAge)).length : 0;
	const hasPoints = chart.some((sample) => carriers.some((carrier) => sample[carrier as keyof typeof sample] != null));
	const unit = metric === "latency_ms" ? "ms" : "%";
	const formatTime = (time: number) => new Date(time).toLocaleTimeString("zh-CN", {hour: "2-digit", minute: "2-digit", hour12: false});
	return <section className="w-full min-w-0 rounded-lg border bg-card p-4" aria-label="国内三网延迟与丢包">
		<div className="flex flex-wrap items-center justify-between gap-3">
			<h2 className="text-sm font-semibold">国内三网延迟与丢包</h2>
		</div>
		<p className="mt-2 text-xs text-muted-foreground">中国大陆 → 当前节点 · ICMP 实测 · 每 {Math.round(interval / 60)} 分钟采样 16 个包</p>
		<p className="mt-2 text-xs text-muted-foreground" role="status">本轮有效 {validCount} / 3 条运营商线路 · 固定桂林三网探针，优先复用；历史城市以样本为准；无探测源不代表节点故障。</p>
		<div className="my-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
			{carriers.map((carrier, index) => {
				const row = server?.rows.find((r) => r.carrier === carrier);
				const valid = current && validDomesticRow(row, now, maxAge);
				const previous = !valid ? lastDomesticSample([...(server?.last_valid_rows || []), ...history.flatMap(h => h.rows)], carrier, now) : undefined;
                const display = valid ? row : previous;
                const latency = display ? valueFor(display, "latency_ms") : null;
				return <div key={carrier} className="rounded-md bg-muted/40 px-3 py-3">
					<p className="text-xs font-medium"><span aria-hidden="true" style={{color: colors[index]}}>● </span>{carrier}</p>
					{(display || row)?.city && <p className="mt-1 text-xs text-muted-foreground">{cityNames[(display || row)!.city] || (display || row)!.city} · AS{(display || row)!.asn}{valid && row?.probe_changed ? " · 本轮已更换探针" : ""}</p>}
					<p className="mt-2 text-sm tabular-nums">{display ? <>{latency == null ? (display.received === 0 ? "探测超时（未收到响应）" : "延迟未返回") : `${latency.toFixed(1)} ms`}<span className="mx-2 text-muted-foreground">/</span>{valueFor(display, "loss_pct")!.toFixed(2)}% 丢包</> : <span className="text-muted-foreground">{!data && !isError ? "正在加载…" : domesticUnavailableReason(!!current, row, server?.error)}</span>}</p>
					{display && <p className="mt-1 text-xs text-muted-foreground">{valid ? "本轮实测" : "历史结果，非当前值"} · 收到 {display.received} / {display.sent} 个包 · {new Date(display.measured_at!).toLocaleString("zh-CN", {hour12: false})}</p>}
                    {!valid && display && <p className="mt-1 text-xs text-muted-foreground">{domesticUnavailableReason(!!current, row, server?.error)}</p>}
				</div>;
			})}
		</div>
		<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
			<p className="text-xs text-muted-foreground">最近 24 小时 · {metric === "latency_ms" ? "平均延迟（ms）" : "单轮丢包率（%）"}</p>
			<div role="group" aria-label="选择指标" className="flex gap-1">
				{([['latency_ms', '延迟'], ['loss_pct', '丢包']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={metric === value} onClick={() => setMetric(value)} className={`min-h-11 rounded-md px-4 text-sm ${metric === value ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}>{label}</button>)}
			</div>
		</div>
		{hasPoints ? <div className="h-64 min-w-0" role="img" aria-label={`国内三网${metric === "latency_ms" ? "延迟" : "丢包"}历史图`}>
			<ResponsiveContainer width="100%" height="100%">
				<LineChart data={chart} margin={{top: 10, right: 16, bottom: 0, left: 0}}>
					<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
					<XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatTime} minTickGap={30} tick={{fontSize: 11}} />
					<YAxis domain={metric === "loss_pct" ? [0, 100] : [0, "auto"]} width={48} tick={{fontSize: 11}} />
					<Tooltip formatter={(value) => value == null ? "暂无样本" : `${Number(value).toFixed(metric === "loss_pct" ? 2 : 1)} ${unit}`} labelFormatter={(time) => new Date(Number(time)).toLocaleString("zh-CN", {hour12: false})} contentStyle={{background: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))"}} />
                    <Legend />
                    {bridges.map((bridge) => <Line
                        key={`${bridge.carrier}-${bridge.points[0].time}`}
                        data={bridge.points}
                        dataKey="value"
                        name={bridge.carrier}
                        stroke={colors[carriers.indexOf(bridge.carrier)]}
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                        strokeOpacity={0.65}
                        dot={false}
                        activeDot={false}
                        legendType="none"
                        tooltipType="none"
                        isAnimationActive={false}
                    />)}
					{carriers.map((carrier, index) => <Line
                        key={carrier}
                        name={carrier}
                        dataKey={carrier}
                        stroke={colors[index]}
                        strokeWidth={2}
                        legendType="plainline"
                        activeDot={{ r: 4 }}
                        dot={({ cx, cy, index: pointIndex }) => {
                            const isolated = pointIndex != null && chart[pointIndex]?.[carrier] != null &&
                                chart[pointIndex - 1]?.[carrier] == null && chart[pointIndex + 1]?.[carrier] == null;
                            return isolated
                                ? <circle key={pointIndex} cx={cx} cy={cy} r={3} fill={colors[index]} stroke="hsl(var(--card))" strokeWidth={1} />
                                : <g key={pointIndex} />;
                        }}
                        connectNulls={false}
                        isAnimationActive={false}
                    />)}
				</LineChart>
			</ResponsiveContainer>
		</div> : <p className="py-12 text-center text-sm text-muted-foreground" role="status">{!data && !isError ? "正在加载探测数据…" : "暂无有效趋势样本"}</p>}
		<p className="mt-3 text-xs leading-relaxed text-muted-foreground">来源：<a href="https://globalping.io/" target="_blank" rel="noreferrer" className="underline underline-offset-4">Globalping 公共探针</a>。每家运营商一个探针，地区由提供方标注，仅代表对应测试线路。最近有效结果保留 7 天并标明时间；实线为连续实测；45 分钟内的缺测或探针切换以虚线连接前后实测点，仅供趋势参考，不代表缺测期间数据。超过 45 分钟保持断线。丢包按实际收发包数计算。ICMP 结果不代表代理连接成功率，时间为本地时间。</p>
	</section>;
}
