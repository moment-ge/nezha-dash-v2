# Status monitoring

The independent status site borrows Komari's separation of a compact server overview and per-server history. It keeps the existing Nezha agents, identities, permissions, TSDB, and Globalping carrier probes.

- `/status`: searchable server cards, online/attention filters, CPU/memory/disk, live upload/download, cumulative outbound/inbound transfer, and measured carrier results.
- `/status/:id`: the same server's reporting timeline, current resources, persistent resource charts, and existing domestic carrier history.
- The resource history module loads only on a server detail page. Six independent requests run concurrently and share the React Query cache; switching from 24 hours to 1 hour reuses the same dataset.
- Guest history is limited to 24 hours by the existing API. Authenticated viewers can request 7 and 30 days. The page does not change server visibility rules or expose server credentials or addresses.
- Memory and disk history are bytes, not percentages calculated against today's capacity. Transfer totals are network-interface counters and may reset on reboot; they are not subscription billing.
- The TSDB's query resolutions are 30 seconds for 1 day, 30 minutes for 7 days, and 2 hours for 30 days. Missing buckets are left disconnected. History from before collection started cannot be recovered by changing retention.
- Domestic probe values appear only when the snapshot and exact server's successful samples are fresh and have valid packet counts. Loss comes from actual received/sent packets. A valid zero-reply sample shows no response without inventing latency.
- Offline or disconnected monitoring hides current resource values and totals. A lack of measurements does not prove a proxy-service failure.

The original homepage (`/`), map, group/status filters, sorting, card/inline layouts, plan/billing details, original server details (`/server/:id`), and dashboard remain available. Both original and new pages use the same status labels and heartbeat rules. All consumers share one clock from the WebSocket provider: server time advances by time elapsed since the last valid received frame, so a different browser clock does not change node status. A disconnected or silent (30 seconds) monitoring feed is updating, not proof that every node is offline. A fresh feed classifies each node independently; missing/invalid heartbeats wait for reporting, and timestamps over 30 seconds into the future cannot claim online.

Production retention is configured under `tsdb.retention_days` in `/etc/nezha/dashboard.yaml`. Use 30 days for a month of history; TSDB expires older samples automatically. Back up that configuration before changing it and restart only `nezha-dashboard` to apply it. Preserve `/var/lib/nezha/tsdb`, agent UUIDs, node settings, and the account database during frontend releases.

Reference: [Komari monitoring API](https://komari-monitor.github.io/komari-document/dev/api.html).
