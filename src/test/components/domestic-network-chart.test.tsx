import { describe, expect, it } from "vitest";
import { domesticChartData, domesticChartBridges, validDomesticRow, lastDomesticSample, domesticUnavailableReason } from "@/components/DomesticNetworkChart";
import type { Row } from "@/hooks/use-domestic-probes";

const time = Date.now();
const base: Row = { route_id: "mobile-1", city: "北京", carrier: "移动", asn: 56048, status: "ok", latency_ms: 20, loss_pct: 0, sent: 16, received: 15, measured_at: time };

describe("three carrier measurements without city restrictions", () => {
	it("keeps missing carriers as gaps and includes other cities", () => {
		const samples = [{timestamp: time, rows: [base, {...base, carrier: "电信", status: "unavailable"}, {...base, city: "上海", carrier: "联通", latency_ms: 100}]}];
		expect(domesticChartData(samples, "latency_ms")).toEqual([{time, 电信: null, 联通: 100, 移动: 20}]);
		expect(domesticChartData(samples, "loss_pct")).toEqual([{time, 电信: null, 联通: 6.25, 移动: 6.25}]);
	});
	it("does not turn complete loss into zero latency", () => {
		const samples = [{timestamp: time, rows: [{...base, received: 0, latency_ms: 0}]}];
		expect(domesticChartData(samples, "latency_ms")[0].移动).toBeNull();
		expect(domesticChartData(samples, "loss_pct")[0].移动).toBe(100);
	});
	it("rejects stale measurements and impossible packet counts", () => {
		expect(validDomesticRow({...base, measured_at: time - 13 * 60_000}, time)).toBe(false);
		expect(validDomesticRow({...base, received: 17}, time)).toBe(false);
		expect(validDomesticRow({...base, sent: 0}, time)).toBe(false);
		expect(validDomesticRow({...base, measured_at: time + 60_000}, time)).toBe(false);
	});
});


describe("domestic probe status and historical fallback", () => {
 it("separates collector timeout from measured target loss", () => {
  expect(domesticUnavailableReason(false, undefined, "timeout")).toContain("非节点超时");
  expect(domesticUnavailableReason(true, {...base, status:"unavailable", reason:"no_probe"})).toContain("暂无可用国内探测源");
 });
 it("retains only recent measured rows without filling chart gaps", () => {
  const old = {...base, measured_at:time-3600000};
  expect(lastDomesticSample([old], "移动", time)).toEqual(old);
  expect(validDomesticRow(old,time)).toBe(false);
  expect(lastDomesticSample([old], "电信", time)).toBeUndefined();
  expect(lastDomesticSample([old], "移动", time+8*86400000)).toBeUndefined();
 });
});

 it("breaks the curve when the probe changes even within the same city", () => {
  const samples = [{timestamp:time, rows:[base]}, {timestamp:time+900000, rows:[{...base, route_id:"mobile-2", measured_at:time+900000}]}];
  const chart = domesticChartData(samples, "latency_ms");
  expect(chart).toHaveLength(3);
  expect(chart[0].移动).toBe(20);
  expect(chart[1].移动).toBeNull();
  expect(chart[2].移动).toBe(20);
 });


describe("short-gap trend bridges", () => {
 it("bridges only bounded short gaps without inserting measurements", () => {
  const chart = [{time, 电信: 10}, {time: time+900000, 电信: null}, {time: time+1800000, 电信: 30}];
  expect(domesticChartBridges(chart)).toEqual([{carrier:"电信",points:[{time,value:10},{time:time+1800000,value:30}]}]);
  expect(chart[1].电信).toBeNull();
 });
 it("does not bridge long outages or invent leading and trailing values", () => {
  expect(domesticChartBridges([{time, 电信:10},{time:time+900000,电信:null},{time:time+3600000,电信:30}])).toEqual([]);
  expect(domesticChartBridges([{time,电信:null},{time:time+900000,电信:10},{time:time+1800000,电信:null}])).toEqual([]);
 });
 it("bridges a probe switch without changing the solid series", () => {
  const chart=domesticChartData([{timestamp:time,rows:[base]},{timestamp:time+900000,rows:[{...base,route_id:"new",measured_at:time+900000}]}],"latency_ms");
  expect(chart[1].移动).toBeNull();
  expect(domesticChartBridges(chart)).toHaveLength(1);
 });
});
