import { reportingHistory } from "@/lib/status-history";
import type { MetricDataPoint } from "@/types/nezha-api";
export type ReportingFeed = {
	points: MetricDataPoint[];
	loading?: boolean;
	error?: boolean;
};
export default function StatusHistory({
	feed,
	now,
}: {
	feed?: ReportingFeed;
	now: number;
}) {
	const bins = reportingHistory(feed?.points || [], now);
	const time = (ts: number) =>
		new Date(ts).toLocaleString("zh-CN", {
			month: "numeric",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
	return (
		<div className="status-history">
			<svg
				viewBox="0 0 768 18"
				preserveAspectRatio="none"
				role="img"
				aria-label={
					feed?.error
						? "历史记录暂不可用"
						: `近 24 小时上报记录，${bins.filter((b) => b.count).length} 个时段有记录`
				}
			>
				{bins.map((bin, i) => (
					<rect
						key={bin.start}
						x={i * 8}
						y="0"
						width="6"
						height="18"
						rx="1"
						fill={bin.count ? "#60b99d" : "#e9eceb"}
					>
						<title>
							{time(bin.start)} ·{" "}
							{bin.count ? `${bin.count} 条上报记录` : "无记录"}
						</title>
					</rect>
				))}
			</svg>
			<div className="status-history-caption">
				<span>24 小时前</span>
				<span>
					{feed?.error
						? "历史记录暂不可用"
						: !feed || feed.loading
							? "正在加载记录"
							: "绿色：有上报 · 灰色：无记录"}
				</span>
				<span>现在</span>
			</div>
		</div>
	);
}
