"""Preload Hugging Face audio/video models into local cache for offline/runtime reuse.

Usage:
    python preload_hf_models.py
"""
from __future__ import annotations

from pathlib import Path
import os

# Disable symlinks warning on Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from huggingface_hub import snapshot_download

from app.core.config import get_settings


def _candidate_models(settings) -> list[str]:
    """Collect all local audio/video models to preload.
    
    Prioritizes primary local models from _local_candidates over fallback hosted models.
    """
    models: list[str] = []
    seen: set[str] = set()
    
    # Primary local models (fast, reliable, no cold-start)
    audio_local = str(settings.huggingface_audio_emotion_local_candidates or "").split(",")
    face_local = [settings.huggingface_face_emotion_model]  # Single local face model
    
    # Combine all candidates
    raw = [*audio_local, *face_local]
    
    for item in raw:
        model = item.strip()
        if not model or model in seen:
            continue
        seen.add(model)
        models.append(model)
    
    return models


def main() -> None:
    settings = get_settings()
    cache_dir = Path(settings.huggingface_local_model_cache_dir).resolve()
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Set environment to avoid symlink issues on Windows
    os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

    token = settings.huggingface_api_key or None
    models = _candidate_models(settings)

    if not models:
        print("No local audio/video models configured.")
        return

    print(f"Using cache dir: {cache_dir}")
    for model_id in models:
        print(f"\n{'='*70}")
        print(f"Preloading: {model_id}")
        print(f"{'='*70}")
        try:
            # Create subdirectories in advance
            (cache_dir / "models--" + model_id.replace("/", "--")).mkdir(parents=True, exist_ok=True)
            
            snapshot_download(
                repo_id=model_id,
                cache_dir=str(cache_dir),
                token=token,
                local_files_only=False,
            )
            print(f"✅ Successfully cached: {model_id}")
        except Exception as exc:
            print(f"❌ Failed to cache {model_id}: {exc}")
            print(f"Continuing with next model...")

    print(f"\n{'='*70}")
    print("Preload attempt complete. Check above for any errors.")
    print(f"Cache directory: {cache_dir}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
