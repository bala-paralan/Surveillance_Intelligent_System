#!/usr/bin/env python3
"""TCP forwarder: local 127.0.0.1:<LOCAL_PORT> -> REMOTE_HOST:REMOTE_PORT.

Used so the preview browser (which only opens local ports) can reach the
staging dashboard at 192.168.10.33:5173, including its WebSocket traffic.
"""
import asyncio
import os
import sys

REMOTE_HOST = os.environ.get("REMOTE_HOST", "192.168.10.33")
REMOTE_PORT = int(os.environ.get("REMOTE_PORT", "5173"))
LOCAL_PORT = int(os.environ.get("LOCAL_PORT", "5173"))


async def pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except (ConnectionResetError, BrokenPipeError, asyncio.IncompleteReadError):
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def handle(client_r: asyncio.StreamReader, client_w: asyncio.StreamWriter) -> None:
    try:
        server_r, server_w = await asyncio.open_connection(REMOTE_HOST, REMOTE_PORT)
    except OSError as e:
        print(f"[proxy] upstream connect failed: {e}", file=sys.stderr)
        client_w.close()
        return
    await asyncio.gather(pipe(client_r, server_w), pipe(server_r, client_w))


async def main() -> None:
    server = await asyncio.start_server(handle, "127.0.0.1", LOCAL_PORT)
    addrs = ", ".join(str(s.getsockname()) for s in server.sockets)
    print(f"[proxy] listening on {addrs} -> {REMOTE_HOST}:{REMOTE_PORT}", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
