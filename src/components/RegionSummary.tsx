import { serverLocation } from "@/lib/server-location";
import type { NezhaServer } from "@/types/nezha-api";

const names = new Intl.DisplayNames(["zh-CN"], { type: "region" });
export function regionName(code: string) {
	return (
		({ HK: "香港", MO: "澳门", TW: "台湾" } as Record<string, string>)[code] ||
		(code ? names.of(code) : "") ||
		code
	);
}
export default function RegionSummary({ servers }: { servers: NezhaServer[] }) {
	const counts = new Map<string, number>();
	for (const server of servers) {
		const code = serverLocation(server);
		if (code) counts.set(code, (counts.get(code) || 0) + 1);
	}
	if (!counts.size) return null;
	return (
		<section
			aria-label="节点分布"
			className="flex flex-wrap items-center gap-2 text-sm"
		>
			<span className="mr-1 text-muted-foreground">节点分布</span>
			{[...counts]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([code, count]) => (
					<span
						key={code}
						className="rounded-md border bg-card px-3 py-1.5 text-foreground"
					>
						{regionName(code)} · {count} 台
					</span>
				))}
		</section>
	);
}
