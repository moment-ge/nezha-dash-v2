import { useQueries, useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode } from "react";

type Probe = {
	server_id: number;
	checked_at: number;
	latency_ms: number | null;
	loss_pct: number | null;
};
type Services = {
	success: boolean;
	data?: { services?: Record<string, { service_name: string }> };
};
async function get<T>(path: string): Promise<T> {
	const response = await fetch(`/api/v1/${path}`, {
		credentials: "same-origin",
	});
	if (!response.ok) throw Error("监控数据暂不可用");
	const body = await response.json();
	if (body.success !== true) throw Error("监控数据暂不可用");
	return body;
}
type Feed = {
	carriers: { name: string; id?: string }[];
	queries: { data?: { data?: Probe[] }; isError: boolean }[];
};
export const CarrierContext = createContext<Feed>({
	carriers: [],
	queries: [],
});
export function CarrierProvider({ children }: { children: ReactNode }) {
	const { data: services } = useQuery({
		queryKey: ["carrier-services"],
		queryFn: () => get<Services>("service"),
		refetchInterval: 30000,
	});
	const carriers = ["电信", "移动", "联通"].map((name) => ({
		name,
		id: Object.entries(services?.data?.services || {}).find(
			([, s]) => s.service_name === `三网 · ${name}`,
		)?.[0],
	}));
	const queries = useQueries({
		queries: carriers.map((c) => ({
			queryKey: ["carrier-recent", c.id ?? c.name],
			queryFn: () =>
				get<{ success: boolean; data?: Probe[] }>(`service/${c.id}/recent`),
			enabled: !!c.id,
			refetchInterval: 5000,
			retry: 0,
		})),
	});
	return (
		<CarrierContext.Provider value={{ carriers, queries }}>
			{children}
		</CarrierContext.Provider>
	);
}
