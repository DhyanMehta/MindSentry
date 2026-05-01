# -*- coding: utf-8 -*-
"""
Utility module that guarantees the FFmpeg binary bundled by the
`imageio[ffmpeg]` dependency is added to the process ``PATH`` *before* any
audio or video libraries are imported.

Both ``librosa`` (used for audio) and ``imageio`` (used for video) rely on
FFmpeg being discoverable.  When the backend starts, the first import of
those libraries may happen inside a service function, which means the
environment variable must already be set.  By performing the injection at
module import time we get a single‑point, process‑wide fix without changing
any other code paths.
"""

import os
import pathlib

def _ensure_ffmpeg_path() -> None:
    """Locate the FFmpeg executable provided by ``imageio-ffmpeg`` and prepend
    its directory to ``PATH`` if it is not already present.
    """
    try:
        import imageio_ffmpeg  # type: ignore
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        ffmpeg_dir = pathlib.Path(ffmpeg_exe).parent
        current_path = os.environ.get("PATH", "")
        # Avoid duplicate entries
        if str(ffmpeg_dir) not in current_path.split(os.pathsep):
            os.environ["PATH"] = f"{ffmpeg_dir}{os.pathsep}{current_path}"
    except Exception:
        # If the optional dependency is missing we simply ignore – the
        # services will raise their own errors later, which is fine for
        # debugging.
        pass

# Execute the injection when this module is imported.
_ensure_ffmpeg_path()
