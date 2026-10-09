import { monitoringTime } from "@/lib/monitoring";
import { useWebSocketContext } from "./use-websocket-context";

export function useLiveStatus() {
	const context = useWebSocketContext();
	return {
		...context,
		...monitoringTime(
			context.lastData,
			context.connected,
			context.receivedAt,
			context.clock ?? Date.now(),
		),
	};
}
