import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CarrierStatus from "@/components/CarrierStatus";
import { CarrierProvider } from "@/context/carrier-provider";
import { renderWithProviders } from "@/test/utils";

function mockProbes({ stale = false, unknown = false, fail = false } = {}) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string) => {
			if (url.endsWith("/service"))
				return {
					ok: true,
					json: async () => ({
						success: true,
						data: {
							services: {
								"1": { service_name: "三网 · 电信" },
								"2": { service_name: "三网 · 移动" },
								"3": { service_name: "三网 · 联通" },
							},
						},
					}),
				};
			if (fail && url.includes("/2/")) return { ok: false };
			return {
				ok: true,
				json: async () => ({
					success: true,
					data: [
						{
							server_id: 2,
							checked_at: Date.now(),
							latency_ms: 150,
							loss_pct: 5,
						},
						{
							server_id: 1,
							checked_at: Date.now() - (stale ? 100000 : 0),
							latency_ms: 21,
							loss_pct: unknown ? null : url.includes("/1/") ? 20 : 0,
						},
					],
				}),
			};
		}),
	);
}
describe("carrier packet measurements", () => {
	it("shares one fetch batch across nodes and never reuses another node's measurements", async () => {
		mockProbes();
		renderWithProviders(
			<CarrierProvider>
				<CarrierStatus serverId={1} />
				<CarrierStatus serverId={2} />
				<CarrierStatus serverId={3} />
			</CarrierProvider>,
		);
		const cards = screen.getAllByRole("region", { name: "三网实时探测" });
		await waitFor(() =>
			expect(within(cards[1]).getAllByText("150 ms")).toHaveLength(3),
		);
		expect(within(cards[0]).getAllByText("21 ms")).toHaveLength(3);
		expect(within(cards[2]).getAllByText("—")).toHaveLength(6);
		expect(fetch).toHaveBeenCalledTimes(4);
	});

	it("shows measured partial loss and keeps other carriers when one fails", async () => {
		mockProbes({ fail: true });
		renderWithProviders(
			<CarrierProvider>
				<CarrierStatus serverId={1} />
			</CarrierProvider>,
		);
		await waitFor(() => expect(screen.getByText("20.0%")).toBeInTheDocument());
		expect(screen.getByText("0.0%")).toBeInTheDocument();
		expect(screen.getAllByText("—")).toHaveLength(2);
	});
	it.each([
		{ stale: true },
		{ unknown: true },
	])("does not turn stale or missing packet counts into zero loss: %j", async (options) => {
		mockProbes(options);
		renderWithProviders(
			<CarrierProvider>
				<CarrierStatus serverId={1} />
			</CarrierProvider>,
		);
		await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
		expect(screen.queryByText("0.0%")).not.toBeInTheDocument();
		expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
	});
});
