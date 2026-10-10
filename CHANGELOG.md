# Changes

## 1.0.1

Pins compatible security fixes across server, bundled frontend and build-tool
dependencies. Both complete-lockfile and runtime npm audits pass with zero
advisories at release time. Adds real MCP-to-browser Mermaid conversion to the
live acceptance test. Keeps application source pinned and unchanged at upstream
2.1.2, commit `8084a1c8b410d625fcfd59d5cffb32f3a86a2a6f`.

## 1.0.0

Initial Docker/Unraid package with persistent appdata, loopback access, stdio MCP,
non-root hardened runtime, attribution, support documentation and release build.
Superseded by 1.0.1, which also covers dependencies compiled into the frontend.
