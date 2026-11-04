# CanvasTTY Times Frame Agents

A small CanvasTTY plugin that exports live agent status counts for a local
dashboard, including a Divoom Times Frame layout preview. No dependencies,
account credentials, network requests, or machine-specific paths.

The data flow is **CanvasTTY → local JSON snapshot → your dashboard**.
This plugin supplies the agent counts; rendering and uploading a finished
screen to a physical display belong to the dashboard integration.

## Install

1. Open the CanvasTTY plugin installer and enter this repository URL:
   `https://github.com/howdeploy/canvastty-times-frame-agents`.
2. Review the `sessions:events` permission and confirm installation.
3. Open **Settings → Agents → Extension native code** and enable the
   **Times Frame Agent Counts** service after reviewing `counts.mjs`.

Installing a plugin does not start its native code. Disabling it stops updates;
an update or a changed service file requires a new trust confirmation.

## Snapshot

Every three seconds the service requests `sessions.list` and writes `counts.json`
in the private `dataDir` provided by CanvasTTY. The schema is:

```ts
interface AgentCountSnapshot {
  version: 1;
  fetchedAt: number; // Unix time in milliseconds
  counts: {
    working: number;
    waiting: number;
    idle: number;
  };
}
```

The file is replaced atomically after each successful read. If the host cannot
be reached, the timestamp stops advancing. Consumers should treat a snapshot
older than 15 seconds as unavailable, rather than displaying zero agents.

With the standard CanvasTTY profile the file is at:

| Platform | Snapshot path |
| --- | --- |
| Linux | `$XDG_CONFIG_HOME/canvastty/plugin-data/dev.timesframe.agent-counts/counts.json`, with `~/.config` as the default config directory |
| macOS | `~/Library/Application Support/canvastty/plugin-data/dev.timesframe.agent-counts/counts.json` |
| Windows | `%APPDATA%\canvastty\plugin-data\dev.timesframe.agent-counts\counts.json` |

A custom CanvasTTY user-data profile changes the prefix. The service uses the
directory supplied by its host, so no configuration is required in the plugin.
Read the snapshot in your dashboard's backend and expose only the counts to
its frontend. The studio integration supports `CANVASTTY_USER_DATA_DIR` to
select a custom profile when starting the dashboard.

## Counting rules

| CanvasTTY session status | Counter |
| --- | --- |
| `working` | `working` |
| `needs_approval` | `waiting` |
| `idle`, `unavailable` | `idle` |

This follows CanvasTTY's three visual status tones: `unavailable` is included
in the idle visual category, not proof that its agent is actually idle.
Ordinary shell terminals, sessions with an exit code, and `done`/`failed`
sessions are excluded. Each live agent, orchestrator or subagent card counts
as one session.

## Privacy and permissions

The `sessions:events` permission lets the service receive session metadata,
including IDs, titles and working directories. The service discards those
fields and saves only the aggregate counts, a timestamp, and the schema version.
It does not request conversation contents or agent credentials, launch agents,
control terminals, or send data over the network. Runtime snapshots are not
included in this repository.

Native code trust runs the service with the operating system user's privileges,
as with other CanvasTTY native services. The manifest permissions gate CanvasTTY
host calls; they are not an operating-system sandbox. Review the source before
enabling it.

## Compatibility

Requires CanvasTTY plugin service API v2 with `sessions.list` support under
`sessions:events`. The implementation uses Node.js built-ins and the host's
private data directory. Compatibility with every CanvasTTY release and operating
system has not been tested.

Protocol reference: [CanvasTTY plugin services](https://github.com/howdeploy/CanvasTTY/blob/main/docs/plugins.md#services-apiversion-2).
The JSON-RPC transport pattern is adapted from CanvasTTY's MIT-licensed
`examples/plugins/service-echo/services/echo.mjs`.

## License

MIT. See [LICENSE](LICENSE).
