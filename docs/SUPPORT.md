# Support and recovery

* **Unhealthy/startup fails:** Check `/health` through the SSH tunnel and
  `docker logs --tail 50 excalidraw-live`. File logging is temporary at
  `/tmp/excalidraw.log` inside the container; inspect it locally and redact scene
  content before sharing. Confirm the dedicated appdata is writable by 99:100,
  and that `EXCALIDRAW_DATA_DIR` is `/data`. Do not recursively change ownership
  of a shared directory.
* **Port conflict:** Choose a free loopback host port. Keep container port 3000.
  Match the SSH forward and browser URL to your chosen host port.
* **MCP not connecting:** Use SSH `BatchMode=yes`, a verified host key, no TTY,
  `docker exec -i` and the `excalidraw-mcp` launcher. This requires a running,
  healthy canvas. Ensure the client can launch SSH and has its existing key
  access. No package credentials or new SSH keys are needed.
* **Scene unexpectedly changes:** Coordinate writers. A browser's full-scene
  sync replaces the server scene. Use snapshots/export before a large edit.
* **Corrupt state or ownership lock:** Stop all instances using the directory.
  Preserve a copy of the complete directory before repair. Restore a known-good
  stopped backup rather than deleting the checkpoint. Upstream recovers proven
  stale locks; do not remove a live lock based only on a startup error.
* **Rollback:** Stop the new container. Preserve its appdata for diagnosis.
  Restore the previous stopped backup and previous image digest/tag, then start
  and verify the scene. No data migration is implemented by this wrapper.

Removing the container/template does not remove the bind-mounted appdata.
Delete appdata only when intentionally retiring the canvas and after a backup.
Do not use broad Docker prune commands as a troubleshooting step.
