import type { NezhaServer } from "@/types/nezha-api";
import { countryCoordinates } from "./geo-limit";

const aliases: Record<string, string> = {
	香港: "HK",
	中国香港: "HK",
	澳门: "MO",
	中国澳门: "MO",
	台湾: "TW",
	中国台湾: "TW",
	日本: "JP",
	新加坡: "SG",
	美国: "US",
	韩国: "KR",
	德国: "DE",
	英国: "GB",
	中国: "CN",
	中国大陆: "CN",
};
function code(value: unknown): string {
	if (typeof value !== "string") return "";
	const text = value.trim();
	const upper = text.toUpperCase();
	if (Object.keys(countryCoordinates).includes(upper)) return upper;
	return (
		(Object.keys(aliases).includes(text) ? aliases[text] : "") ||
		Object.entries(countryCoordinates).find(
			([, c]) => c.name.toLowerCase() === text.toLowerCase(),
		)?.[0] ||
		""
	);
}
export function serverLocation(
	server: Pick<NezhaServer, "country_code" | "public_note">,
): string {
	let note: {
		countryCode?: unknown;
		planDataMod?: { countryCode?: unknown; networkRoute?: unknown };
	} = {};
	try {
		note = JSON.parse(server.public_note || "{}") || {};
	} catch {
		/* Non-JSON notes have no region override. */
	}
	return (
		code(note.countryCode) ||
		code(note.planDataMod?.countryCode) ||
		code(server.country_code) ||
		code(note.planDataMod?.networkRoute)
	);
}
export function nodeIsOnline(
	now: number,
	server: Pick<NezhaServer, "last_active">,
): boolean {
	const last = Date.parse(server.last_active);
	return (
		Number.isFinite(last) &&
		last > 0 &&
		last <= now + 30000 &&
		now - last <= 30000
	);
}
