import { describe, expect, it } from "vitest";
import { createServer } from "@/test/fixtures";
import { mergeNodeNotes, nodeIsOnline, serverLocation } from "@/lib/server-location";

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

describe("WebSocket note deltas", () => {
 it("retains first-frame regions separately by node and clears removed or explicitly empty notes", () => {
  const cache = new Map<number,string>();
  const hk=createServer({id:1,country_code:"",public_note:JSON.stringify({countryCode:"HK"})});
  const jp=createServer({id:2,country_code:"",public_note:JSON.stringify({countryCode:"JP"})});
  mergeNodeNotes([hk,jp],cache);
  const hkDelta={...hk}; Reflect.deleteProperty(hkDelta,"public_note");
  const jpDelta={...jp}; Reflect.deleteProperty(jpDelta,"public_note");
  expect(mergeNodeNotes([hkDelta,jpDelta],cache).map(serverLocation)).toEqual(["HK","JP"]);
  expect(mergeNodeNotes([{...hk,public_note:""}],cache).map(serverLocation)).toEqual([""]);
  expect(cache.has(2)).toBe(false);
  expect(mergeNodeNotes([jpDelta],cache).map(serverLocation)).toEqual([""]);
  expect(mergeNodeNotes([hkDelta],new Map()).map(serverLocation)).toEqual([""]);
 });
});
