import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import NodeStatusView from "@/components/NodeStatusView";
import { createServer } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";
const now = Date.parse("2025-01-01T00:00:20Z");
const hk = createServer({ name: "香港 CN2", country_code: "HK" });
describe("node status view", () => {
	it("links each node separately without region summary", () => {
		renderWithProviders(
			<NodeStatusView
				servers={[
					hk,
					createServer({ id: 2, country_code: "HK" }),
					createServer({ id: 3, country_code: "JP" }),
				]}
				now={now}
				fresh
			/>,
		);
		expect(screen.queryByRole("region", { name: "节点分布" })).not.toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "所有节点均在线" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "查看 香港 CN2 的状态" }),
		).toHaveAttribute("href", "/status/1");
	});
	it("does not report stale disconnected data as healthy or offline", () => {
		renderWithProviders(
			<NodeStatusView servers={[hk]} now={now} fresh={false} selectedId={1} />,
		);
		expect(
			screen.getByRole("heading", { name: "正在更新节点状态" }),
		).toBeInTheDocument();
		expect(screen.getAllByText("—")).toHaveLength(4);
	});
	it("shows offline nodes without presenting old CPU measurements as current", () => {
		renderWithProviders(
			<NodeStatusView servers={[hk]} now={now + 60000} fresh selectedId={1} />,
		);
		expect(
			screen.getByRole("heading", { name: "香港 CN2 已离线" }),
		).toBeInTheDocument();
		expect(screen.getAllByText("—")).toHaveLength(4);
	});
	it("selects only the requested node for individual status", () => {
		renderWithProviders(
			<NodeStatusView
				servers={[hk, createServer({ id: 2, name: "Tokyo" })]}
				now={now}
				fresh
				selectedId={2}
			/>,
		);
		expect(
			screen.getByRole("heading", { name: "Tokyo 在线" }),
		).toBeInTheDocument();
		expect(screen.queryByText("香港 CN2")).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "查看详细监控与图表" }),
		).toHaveAttribute("href", "/server/2");
	});
	it("shows an unknown node without substituting another server", () => {
		renderWithProviders(
			<NodeStatusView servers={[hk]} now={now} fresh selectedId={99} />,
		);
		expect(
			screen.getByRole("heading", { name: "未找到这个节点" }),
		).toBeInTheDocument();
		expect(screen.queryByText("当前指标")).not.toBeInTheDocument();
	});
});
