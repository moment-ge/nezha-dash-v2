import { useContext } from "react";
import { CarrierContext } from "@/context/carrier-provider";

export default function CarrierStatus({
	serverId,
	online = true,
}: {
	serverId: number;
	online?: boolean;
}) {
	const { carriers, queries } = useContext(CarrierContext);
	return (
		<section
			className="w-full min-w-0 rounded-lg border bg-muted/30 p-3 text-xs"
			aria-label="三网实时探测"
		>
			<div className="mb-2 flex justify-between gap-2 text-muted-foreground">
				<span>三网延迟</span>
				<span>近 5 分钟丢包</span>
			</div>
			<div className="grid grid-cols-3 gap-3">
				{carriers.map((c, i) => {
					const p = queries[i].data?.data?.find(
						(p) => p.server_id === serverId,
					);
					const fresh =
						online &&
						!queries[i].isError &&
						!!p &&
						Date.now() - p.checked_at <= 90000 &&
						p.checked_at <= Date.now() + 30000;
					const loss = fresh ? p.loss_pct : null,
						delay = fresh ? p.latency_ms : null;
					return (
						<div key={c.name} className="min-w-0">
							<div className="text-muted-foreground">{c.name}</div>
							<div className="mt-1 whitespace-nowrap font-medium tabular-nums">
								{delay == null ? "—" : `${Math.round(delay)} ms`}
							</div>
							<div
								className={`mt-1 tabular-nums ${loss == null ? "text-muted-foreground" : loss === 0 ? "text-emerald-600 dark:text-emerald-400" : loss < 5 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}
							>
								{loss == null ? "—" : `${loss.toFixed(1)}%`}
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
