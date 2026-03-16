"""
MindSentry Model Diagnostics (API-based architecture)
Run: cd backend && python check_models.py
"""
import sys, time

def ok(msg):    print(f"  [OK]   {msg}")
def warn(msg):  print(f"  [WARN] {msg}")
def fail(msg):  print(f"  [FAIL] {msg}")
def info(msg):  print(f"  [INFO] {msg}")
def header(msg): print(f"\n=== {msg} ===\n" + "-"*50)


# -------------------------------------------------------
# 1. ENVIRONMENT / API KEYS
# -------------------------------------------------------
header("1. API Key Configuration")
sys.path.insert(0, ".")
try:
    from app.core.config import get_settings
    s = get_settings()
    if s.huggingface_api_key and s.huggingface_api_key != "hf_your_api_key_here":
        ok(f"HUGGINGFACE_API_KEY  set  ({s.huggingface_api_key[:8]}...)")
    else:
        warn("HUGGINGFACE_API_KEY  NOT set  (text emotion returns 'neutral')")
        info("Get free key: https://huggingface.co/settings/tokens")
    if s.groq_api_key and s.groq_api_key != "gsk_your_groq_key_here":
        ok(f"GROQ_API_KEY         set  ({s.groq_api_key[:8]}...)")
    else:
        warn("GROQ_API_KEY         NOT set  (audio transcript returns empty)")
        info("Get free key: https://console.groq.com/keys")
except Exception as e:
    fail(f"Could not load config: {e}")


# -------------------------------------------------------
# 2. REQUIRED PACKAGES
# -------------------------------------------------------
header("2. Package Checks")

packages = {
    "httpx":            "HTTP client for HF + Groq API calls",
    "numpy":            "Numeric ops (NN inference)",
    "sklearn":          "scikit-learn (Fusion NN)",
    "librosa":          "Audio feature extraction (DSP only)",
    "soundfile":        "Audio file I/O",
    "cv2":              "OpenCV (video frame extraction)",
    "mediapipe":        "Face detection (bundled, no download)",
}

installed = {}
for pkg, desc in packages.items():
    try:
        mod = __import__(pkg)
        ver = getattr(mod, "__version__", "?")
        ok(f"{pkg} {ver}  --  {desc}")
        installed[pkg] = True
    except ImportError:
        fail(f"{pkg}  --  {desc}  (NOT INSTALLED)")
        installed[pkg] = False


# -------------------------------------------------------
# 3. TEXT EMOTION  (HF Inference API)
# -------------------------------------------------------
header("3. Text Emotion  (HF Inference API, free)")

try:
    from app.services.text_service import analyse_text
    result = analyse_text("I feel completely hopeless and exhausted today.")
    emotion = result.get("emotion", "?")
    score   = result.get("emotion_score", 0)
    # Determine what actually answered: real API vs fallback default
    if score < 1.0:
        source = "HF API live"
    elif s.huggingface_api_key and s.huggingface_api_key != "hf_your_api_key_here":
        source = "API key set -- model cold-starting or rate-limited (neutral used)"
    else:
        source = "no API key -- neutral default"
    ok(f"analyse_text() ran -- emotion={emotion}, score={score:.4f}  [{source}]")
    ok(f"  stress_score = {result['stress_score']}  |  mood_score = {result['mood_score']}")
except Exception as e:
    fail(f"text_service error: {e}")


# -------------------------------------------------------
# 4. AUDIO TRANSCRIPTION  (Groq API)
# -------------------------------------------------------
header("4. Audio Transcription  (Groq Whisper API, free)")

try:
    from app.services.audio_service import extract_audio_features
    ok("audio_service imported OK")
    if installed.get("librosa") and installed.get("numpy"):
        import numpy as np, librosa, tempfile, soundfile as sf
        sr = 22050
        y = np.sin(2 * 3.14159 * 440 * np.linspace(0, 1, sr)).astype(np.float32)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            sf.write(tmp.name, y, sr)
            feats = extract_audio_features(tmp.name)
        ok(f"extract_audio_features() -- rms={feats.get('rms_energy')}, silence={feats.get('silence_ratio')}")
    else:
        warn("librosa not installed -- audio features unavailable")
    info("Transcription requires GROQ_API_KEY and a real audio file")
    info("Test: POST /audio/upload/{assessment_id} with a .wav or .mp3 file")
except Exception as e:
    fail(f"audio_service error: {e}")


# -------------------------------------------------------
# 5. VIDEO FACE DETECTION  (OpenCV Haar Cascade, bundled in cv2)
# -------------------------------------------------------
header("5. Video Face Detection  (OpenCV Haar Cascade, bundled in cv2)")

if installed.get("cv2"):
    try:
        import cv2, numpy as np
        xml = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        cascade = cv2.CascadeClassifier(xml)
        if cascade.empty():
            fail("Haar cascade XML not found -- cv2 package may be incomplete")
        else:
            # Test with a blank frame (expect 0 faces)
            blank = np.zeros((480, 640, 1), dtype=np.uint8)
            faces = cascade.detectMultiScale(blank, scaleFactor=1.1, minNeighbors=4)
            ok(f"Haar cascade loaded from cv2.data  ({xml.split('/')[-1]})")
            ok(f"Blank frame test -- faces_detected={len(faces)}  (expected 0)")
            info("Real face detection works on uploaded video files")
    except Exception as e:
        fail(f"OpenCV Haar cascade error: {e}")
else:
    warn("opencv not installed")
    info("Fix: pip install opencv-python-headless")


# -------------------------------------------------------
# 6. FUSION NN  (sklearn MLP, trained on dummy data)
# -------------------------------------------------------
header("6. Fusion Neural Network  (sklearn MLP, ml_models/fusion_nn.pkl)")

from pathlib import Path
pkl_path = Path(__file__).parent / "ml_models" / "fusion_nn.pkl"

if not pkl_path.exists():
    warn("fusion_nn.pkl NOT FOUND -- scoring uses heuristic fallback")
    info("Train:  python train_nn.py   (takes ~15 seconds)")
else:
    try:
        from app.services.scoring_service import compute_scores

        r_h = compute_scores(
            text_features={"emotion": "joy", "stress_score": 0.1, "mood_score": 0.9},
            questionnaire_data={"stress_level": 2, "mood_level": 9, "sleep_hours": 8},
        )
        r_c = compute_scores(
            text_features={"emotion": "fear", "stress_score": 0.9, "mood_score": 0.1},
            audio_features={"audio_emotion": "sadness",
                            "features": {"silence_ratio": 0.8, "rms_energy": 0.01}},
            questionnaire_data={"stress_level": 9, "mood_level": 1, "sleep_hours": 3},
        )
        ok(f"fusion_nn.pkl loaded  ({pkl_path.stat().st_size // 1024} KB)")
        ok(f"  Healthy  --> stress={r_h['stress_score']}, crisis={r_h['crisis_score']}, risk={r_h['final_risk_level']}")
        ok(f"  Crisis   --> stress={r_c['stress_score']}, crisis={r_c['crisis_score']}, risk={r_c['final_risk_level']}")
        ok(f"  scoring_source = {r_h['scoring_source']}")
    except Exception as e:
        fail(f"NN scoring error: {e}")


# -------------------------------------------------------
# 7. RECOMMENDATIONS + SAFETY  (pure Python, always active)
# -------------------------------------------------------
header("7. Recommendations + Safety Scanner  (pure Python)")

try:
    from app.services.recommendation_service import generate
    from app.services.safety_service import scan_text

    scores = compute_scores(
        text_features={"emotion": "sadness", "stress_score": 0.7, "mood_score": 0.2},
        questionnaire_data={"stress_level": 8, "mood_level": 2, "sleep_hours": 4},
    )
    recs = generate("test-id", 1, scores)
    ok(f"generate() -- {len(recs)} recommendations  [{', '.join(r['recommendation_type'] for r in recs)}]")

    s1 = scan_text("I want to kill myself")
    s2 = scan_text("Today was a good day")
    ok(f"scan_text() -- crisis phrase: crisis_flag={s1['crisis_flag']}, severity={s1['severity']}")
    ok(f"scan_text() -- neutral:       crisis_flag={s2['crisis_flag']}")
except Exception as e:
    fail(f"Error: {e}")


# -------------------------------------------------------
# SUMMARY
# -------------------------------------------------------
header("SUMMARY")

try:
    nn_active = pkl_path.exists() and installed.get("sklearn")
    api_text  = bool(s.huggingface_api_key and s.huggingface_api_key != "hf_your_api_key_here")
    api_audio = bool(s.groq_api_key and s.groq_api_key != "gsk_your_groq_key_here")

    components = [
        ("Fusion NN scoring",       nn_active,            "python train_nn.py"),
        ("Text emotion (HF API)",   api_text,             "set HUGGINGFACE_API_KEY in .env"),
        ("Audio transcription",     api_audio,            "set GROQ_API_KEY in .env"),
        ("Audio features (librosa)",installed.get("librosa"), "pip install librosa soundfile"),
        ("Video analysis",          installed.get("mediapipe") and installed.get("cv2"), "pip install mediapipe opencv-python-headless"),
        ("Recommendations",         True,                 "always active"),
        ("Safety scanner",          True,                 "always active"),
    ]
    for name, active, fix in components:
        if active:
            ok(f"{name}")
        else:
            warn(f"{name:30s}  -- not active  ({fix})")
except Exception as e:
    fail(f"Summary error: {e}")

print()
info("Run server:  uvicorn app.main:app --reload")
print()
