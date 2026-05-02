"""Scoped runtime tweaks for the local OmniVoice launcher on Windows."""

import os


def _patch_windows_proactor_connection_reset():
    if os.name != "nt":
        return

    try:
        from asyncio import proactor_events
    except Exception:
        return

    transport_type = getattr(proactor_events, "_ProactorBasePipeTransport", None)
    original = getattr(transport_type, "_call_connection_lost", None)
    if original is None or getattr(original, "_omnivoice_winreset_patch", False):
        return

    def call_connection_lost_without_winreset_noise(self, exc):
        try:
            return original(self, exc)
        except ConnectionResetError as error:
            if getattr(error, "winerror", None) != 10054:
                raise

            sock = getattr(self, "_sock", None)
            if sock is not None:
                try:
                    sock.close()
                except Exception:
                    pass
                self._sock = None

            server = getattr(self, "_server", None)
            if server is not None:
                try:
                    server._detach(self)
                except Exception:
                    pass
                self._server = None

            self._called_connection_lost = True
            return None

    call_connection_lost_without_winreset_noise._omnivoice_winreset_patch = True
    transport_type._call_connection_lost = call_connection_lost_without_winreset_noise


_patch_windows_proactor_connection_reset()
