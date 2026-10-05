import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import NodeStatusView from "@/components/NodeStatusView";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
export default function NodeStatus() {
	const { id } = useParams();
	const { lastData, connected } = useWebSocketContext();
	const [clock, setClock] = useState(Date.now());
	useEffect(() => {
		const timer = setInterval(() => setClock(Date.now()), 5000);
		return () => clearInterval(timer);
	}, []);
	const age = clock - (lastData?.now || 0);
	const fresh = connected && !!lastData && age < 30000 && age > -30000;
	return (
		<NodeStatusView
			servers={lastData?.servers || []}
			now={lastData?.now || clock}
			fresh={fresh}
			selectedId={id === undefined ? undefined : Number(id)}
		/>
	);
}
