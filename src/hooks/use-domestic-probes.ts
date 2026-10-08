import { useQuery } from "@tanstack/react-query";

export type Row = {
	city: string;
	network?: string;
	route_id?: string;
	probe_changed?: boolean;
	carrier: string;
	asn: number;
	status: string;
	reason?: string;
	latency_ms: number | null;
	loss_pct: number | null;
	sent: number | null;
	received: number | null;
	measured_at?: number;
};
export type DomesticSnapshot = {
	schema_version?: number;
	interval_seconds?: number;
	updated_at: number;
	servers: { server_id: number; status: string; error?: string; rows: Row[]; last_valid_rows?: Row[]; history?: { timestamp: number; rows: Row[] }[] }[];
};

export function useDomesticProbes() {
	return useQuery({
		queryKey: ["domestic-probes"],
		queryFn: async (): Promise<DomesticSnapshot> => {
			const response = await fetch("/api/v1/domestic-probes", { credentials: "same-origin" });
			if (!response.ok) throw new Error("国内探测暂不可用");
			return response.json();
		},
		refetchInterval: 60_000,
		retry: 1,
	});
}
