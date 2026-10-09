import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NodeStatusView from "@/components/NodeStatusView";
import ServerCard from "@/components/ServerCard";
import ServerCardInline from "@/components/ServerCardInline";
import ServerDetailOverview from "@/components/ServerDetailOverview";
import { WebSocketProvider } from "@/context/websocket-provider";
import { useLiveStatus } from "@/hooks/use-live-status";
import { monitoringTime, nodeState } from "@/lib/monitoring";
import { formatNezhaInfo } from "@/lib/utils";
import { createServer } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";

class Socket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSED = 3;
	static instance: Socket;
	readyState = 0;
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;
	constructor() {
		Socket.instance = this;
	}
	close() {
		this.readyState = 3;
		this.onclose?.();
	}
	open() {
		this.readyState = 1;
		this.onopen?.();
	}
	message(data: unknown) {
		this.onmessage?.({ data: JSON.stringify(data) });
	}
}

const serverNow = Date.parse("2025-01-01T00:00:20Z");
function Views() {
	const { lastData, now, fresh } = useLiveStatus();
	const server = lastData?.servers[0];
	if (!server) return null;
	return (
		<>
			<div data-testid="original-card">
				<ServerCard now={now} fresh={fresh} serverInfo={server} />
			</div>
			<div data-testid="original-inline">
				<ServerCardInline now={now} fresh={fresh} serverInfo={server} />
			</div>
			<div data-testid="original-detail">
				<ServerDetailOverview server_id="1" />
			</div>
			<div data-testid="new-status">
				<NodeStatusView servers={[server]} now={now} fresh={fresh} />
			</div>
		</>
	);
}
function expectStatus(state: string, detail: string) {
	for (const id of ["original-card", "original-inline"]) {
		expect(
			within(screen.getByTestId(id)).getByRole("img", { name: state }),
		).toBeInTheDocument();
	}
	expect(
		within(screen.getByTestId("original-detail")).getByText(detail),
	).toBeInTheDocument();
	expect(
		within(screen.getByTestId("new-status")).getByRole("article"),
	).toHaveTextContent(state);
}

describe("consistent node status across original and new views", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-09T00:00:00Z"));
		vi.stubGlobal("WebSocket", Socket);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});
	it("uses server time even with a different browser clock, expires silent connections and recovers", () => {
		renderWithProviders(
			<WebSocketProvider url="/api/v1/ws/server">
				<Views />
			</WebSocketProvider>,
		);
		act(() => {
			Socket.instance.open();
			Socket.instance.message({ now: serverNow, servers: [createServer()] });
		});
		expectStatus("在线", "serverDetail.online");
		act(() => {
			vi.advanceTimersByTime(30000);
		});
		expectStatus("更新中", "更新中");
		expect(
			within(screen.getByTestId("new-status")).queryByText("离线"),
		).not.toBeInTheDocument();
		act(() => {
			Socket.instance.message({
				now: serverNow + 30000,
				servers: [createServer()],
			});
		});
		expectStatus("离线", "serverDetail.offline");
		act(() => {
			Socket.instance.message({
				now: serverNow + 30000,
				servers: [
					createServer({
						last_active: new Date(serverNow + 30000).toISOString(),
					}),
				],
			});
		});
		expectStatus("在线", "serverDetail.online");
		act(() => {
			Socket.instance.close();
		});
		expectStatus("更新中", "更新中");
		act(() => {
			vi.advanceTimersByTime(3000);
			Socket.instance.open();
		});
		expectStatus("更新中", "更新中");
		act(() => {
			Socket.instance.message({
				now: serverNow + 33000,
				servers: [
					createServer({
						last_active: new Date(serverNow + 33000).toISOString(),
					}),
				],
			});
		});
		expectStatus("在线", "serverDetail.online");
	});
	it("does not turn invalid or excessively future heartbeats into online nodes", () => {
		const data = { now: serverNow, servers: [] };
		const time = monitoringTime(data, true, 1000, 2000);
		expect(time).toEqual({ now: serverNow + 1000, fresh: true });
		for (const heartbeat of [
			"invalid",
			"0001-01-01T00:00:00Z",
			new Date(serverNow + 60000).toISOString(),
		]) {
			const server = createServer({ last_active: heartbeat });
			expect(formatNezhaInfo(time.now, server, time.fresh).online).toBe(false);
			expect(formatNezhaInfo(time.now, server, time.fresh).status).toBe(
				nodeState(server, time.now, time.fresh),
			);
		}
		expect(monitoringTime(data, true, null, 2000).fresh).toBe(false);
		expect(monitoringTime(data, false, 1000, 2000).fresh).toBe(false);
	});
});
