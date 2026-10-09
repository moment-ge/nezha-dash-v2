import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import NodeStatusView from "@/components/NodeStatusView";
import { createServer } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";

const now = Date.parse("2025-01-01T00:00:20Z");
const servers = [
	createServer({ name: "Hong Kong", country_code: "HK" }),
	createServer({
		id: 2,
		name: "Tokyo",
		country_code: "JP",
		last_active: "2024-12-31T23:00:00Z",
	}),
];
describe("monitoring overview", () => {
	it("filters by search and status, with a recovery action for an empty result", async () => {
		const user = userEvent.setup();
		renderWithProviders(<NodeStatusView servers={servers} now={now} fresh />);
		await user.click(screen.getByRole("button", { name: "在线" }));
		expect(
			screen.getByRole("article", { name: "Hong Kong" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("article", { name: "Tokyo" }),
		).not.toBeInTheDocument();
		await user.type(
			screen.getByRole("textbox", { name: "搜索节点名称或地区" }),
			"Tokyo",
		);
		expect(screen.getByText("没有匹配的节点")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "清除筛选" }));
		expect(screen.getByRole("article", { name: "Tokyo" })).toBeInTheDocument();
	});
	it("distinguishes transfer direction and hides stale resource values", () => {
		renderWithProviders(<NodeStatusView servers={servers} now={now} fresh />);
		const live = within(screen.getByRole("article", { name: "Hong Kong" }));
		expect(live.getByText("2.00 MiB/s")).toBeInTheDocument();
		expect(live.getByText("1.00 MiB/s")).toBeInTheDocument();
		expect(live.getByText("2.00 GiB / 1.00 GiB")).toBeInTheDocument();
		const offline = within(screen.getByRole("article", { name: "Tokyo" }));
		expect(offline.queryByText("12.0%")).not.toBeInTheDocument();
		expect(offline.getByText("离线")).toBeInTheDocument();
	});
	it("does not claim live totals when the monitoring connection is stale", () => {
		renderWithProviders(
			<NodeStatusView servers={servers} now={now} fresh={false} />,
		);
		expect(screen.getAllByText("更新中")).toHaveLength(2);
		expect(screen.queryByText("12.0%")).not.toBeInTheDocument();
		expect(screen.queryByText("2.00 MiB/s")).not.toBeInTheDocument();
	});
});
