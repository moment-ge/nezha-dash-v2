import {describe,it,expect} from "vitest";
import {reportingHistory,HISTORY_SLOT} from "@/lib/status-history";
describe("status reporting history",()=>{
 const now=Date.UTC(2026,9,5,12,5);
 it("leaves missing periods gray instead of fabricating uptime",()=>{
  const bins=reportingHistory([{ts:now-1000,value:0},{ts:now-2000,value:2}],now);
  expect(bins).toHaveLength(96);
  expect(bins.filter(b=>b.count)).toHaveLength(1);
  expect(bins[95].count).toBe(2);
 });
 it("ignores future, expired, and invalid samples",()=>{
  const bins=reportingHistory([{ts:now+1000,value:1},{ts:now-100*HISTORY_SLOT,value:1},{ts:NaN,value:1},{ts:now,value:NaN}],now);
  expect(bins.every(b=>b.count===0)).toBe(true);
 });
 it("keeps samples in separate fifteen-minute periods",()=>{
  const bins=reportingHistory([{ts:now,value:1},{ts:now-HISTORY_SLOT,value:1}],now);
  expect(bins.filter(b=>b.count)).toHaveLength(2);
 });
});
