import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MonitoringHistory from "@/components/MonitoringHistory";
import { renderWithProviders } from "@/test/utils";

const api = vi.hoisted(() => ({
	fetchLoginUser: vi.fn(),
	fetchServerMetrics: vi.fn(),
}));
vi.mock("@/lib/nezha-api", () => api);
vi.mock("recharts", () => {
	const component = ({ children }: { children?: ReactNode }) => (
		<div>{children}</div>
	);
	return {
		LineChart: component,
		ResponsiveContainer: component,
		Line: component,
		CartesianGrid: component,
		XAxis: component,
		YAxis: component,
		Tooltip: component,
	};
});
const now = 1770000000000;
describe("monitoring history", () => {
	beforeEach(() => {
		api.fetchLoginUser.mockResolvedValue({ success: false });
		api.fetchServerMetrics.mockImplementation(
			async (id: number, metric: string) => ({
				success: true,
				data: {
					server_id: id,
					metric,
					data_points: [{ ts: now - 30000, value: 12 }],
				},
			}),
		);
	});
	it("loads the selected node only and keeps longer guest periods locked", async () => {
		renderWithProviders(<MonitoringHistory serverId={7} now={now} />);
		await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(6));
		expect(api.fetchServerMetrics).toHaveBeenCalledTimes(6);
		expect(
			api.fetchServerMetrics.mock.calls.every(
				(call) => call[0] === 7 && call[2] === "1d",
			),
		).toBe(true);
		expect(screen.getByRole("button", { name: "7 天" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "30 天" })).toBeDisabled();
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "1 小时" }));
		expect(api.fetchServerMetrics).toHaveBeenCalledTimes(6);
	});
	it("allows authenticated long history and rejects data for the wrong node", async () => {
		api.fetchLoginUser.mockResolvedValue({ success: true, data: { id: 1 } });
		renderWithProviders(<MonitoringHistory serverId={7} now={now} />);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "30 天" })).toBeEnabled(),
		);
		api.fetchServerMetrics.mockImplementation(async () => ({
			success: true,
			data: {
				server_id: 99,
				metric: "cpu",
				data_points: [{ ts: now, value: 99 }],
			},
		}));
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "30 天" }));
		await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(6));
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
		expect(
			api.fetchServerMetrics.mock.calls.some(
				(call) => call[0] === 7 && call[2] === "30d",
			),
		).toBe(true);
	});
});
