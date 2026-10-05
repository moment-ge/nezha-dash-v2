import { describe, expect, it } from "vitest";
import { nodeIsOnline, serverLocation } from "@/lib/server-location";

describe("node regions and heartbeat", () => {
	it("uses explicit regions ahead of automatic geolocation and route text as a fallback", () => {
		expect(
			serverLocation({
				country_code: "",
				public_note: JSON.stringify({ planDataMod: { networkRoute: "香港" } }),
			}),
		).toBe("HK");
		expect(
			serverLocation({
				country_code: "us",
				public_note: JSON.stringify({ countryCode: "HK" }),
			}),
		).toBe("HK");
		expect(serverLocation({ country_code: "JP", public_note: "invalid" })).toBe(
			"JP",
		);
		expect(
			serverLocation({
				country_code: "",
				public_note: JSON.stringify({
					planDataMod: { networkRoute: "香港到日本" },
				}),
			}),
		).toBe("");
	});
	it("rejects stale, absent and invalid future heartbeats", () => {
		const now = Date.now();
		expect(
			nodeIsOnline(now, { last_active: new Date(now - 10000).toISOString() }),
		).toBe(true);
		for (const value of [now - 60000, now + 60000, 0])
			expect(
				nodeIsOnline(now, { last_active: new Date(value).toISOString() }),
			).toBe(false);
	});
});
