import { useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import NodeStatusView from "@/components/NodeStatusView";
import { useDomesticProbes } from "@/hooks/use-domestic-probes";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { fetchServerMetrics } from "@/lib/nezha-api";
export default function NodeStatus() {
	const { id } = useParams();
	const probes = useDomesticProbes();
	const { lastData, connected } = useWebSocketContext();
	const [clock, setClock] = useState(Date.now());
	useEffect(() => {
		const timer = setInterval(() => setClock(Date.now()), 5000);
		return () => clearInterval(timer);
	}, []);
	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
		document.title = id === undefined ? "节点状态" : "节点详细监控";
	}, [id]);
	const nodes = (lastData?.servers || []).filter(
		(s) => id === undefined || s.id === Number(id),
	);
	const queries = useQueries({
		queries: nodes.map((server) => ({
			queryKey: ["status-reporting", server.id],
			queryFn: async () => {
				const result = await fetchServerMetrics(server.id, "cpu", "1d");
				if (!result.success || result.data?.server_id !== server.id)
					throw Error("历史记录暂不可用");
				return result.data.data_points;
			},
			staleTime: 60000,
			refetchInterval: 60000,
			retry: 0,
		})),
	});
	const histories = Object.fromEntries(
		nodes.map((s, i) => [
			s.id,
			{
				points: queries[i].data || [],
				loading: queries[i].isPending,
				error: queries[i].isError,
			},
		]),
	);
	const age = clock - (lastData?.now || 0);
	const fresh = connected && !!lastData && age < 30000 && age > -30000;
	return (
		<NodeStatusView
			showCharts
			domestic={probes.data}
			probeFailed={probes.isError}
			histories={histories}
			servers={lastData?.servers || []}
			now={clock}
			fresh={fresh}
			selectedId={id === undefined ? undefined : Number(id)}
		/>
	);
}
