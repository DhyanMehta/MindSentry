# Model Review And Fusion Analysis

## Current models found
- Text analysis previously used hosted Hugging Face emotion classification with heuristic fallback logic.
- Audio analysis previously mixed Groq Whisper transcription with DSP heuristics and transcript-derived emotion.
- Video analysis previously used Haar-cascade face detection and weak fallback emotion guesses.
- Fusion previously preferred a synthetic-data MLP artifact and fell back to a heuristic weighted average.

## Problems in the previous implementation
- Text inference mixed real model output with hand-built fallback logic that could behave like a pseudo-classifier.
- Audio emotion was not truly audio-model-based in the active path; silence and energy heuristics could dominate the result.
- Visual analysis incorrectly converted low light or missing face into emotional labels such as fear or sadness.
- Fusion explainability was tied to a synthetic MLP workflow that was not trained on real labeled MindSentry data.
- Questionnaire `total_score` could be projected into fake stress and mood dimensions as if those were observed values.
- Safety escalation and multimodal scoring were too loosely connected.

## Hugging Face model choices
- Text emotion: `j-hartmann/emotion-english-distilroberta-base`
  - Strong practical choice for English emotion classification.
  - Well-supported and appropriate for supportive wellness interpretation.
- Audio transcription: `openai/whisper-large-v3-turbo`
  - Strong hosted ASR option without local model download.
  - Useful for transcript-based safety scanning and context.
- Audio emotion: `superb/wav2vec2-base-superb-er`
  - Practical hosted baseline for audio emotion classification.
  - Better than pretending DSP heuristics are a real emotion model.
- Facial emotion: `dima806/facial_emotions_image_detection`
  - Kept as the hosted FER option, but now only used after actual face extraction.
  - Low-quality visual input no longer gets converted into fake emotions.

## What changed
- Added a shared hosted Hugging Face inference client for text, audio, and image model calls.
- Replaced active endpoint imports so text, audio, and video analysis now use dedicated hosted-inference services.
- Kept local preprocessing only for:
  - text cleanup
  - audio feature extraction and integrity checks
  - face detection / crop extraction
- Switched the active fusion pipeline to deterministic weighted fusion with modality confidence and integrity weighting.
- Removed the production dependence on the synthetic neural fusion artifact.
- Added model registry tracking for the active hosted model set and fusion strategy.
- Connected safety flags back into the analysis result so explicit crisis language can elevate concern scores.
- Fixed analysis response field consistency for video integrity metadata.

## What was not changed
- Chatbot, agent, clinic search, appointment, calling, and reminder workflows were intentionally not touched.
- Frontend behavior was left unchanged.
- The legacy synthetic fusion model file remains in the repo as an experimental artifact and is not the active production path.
- Recommendation generation stayed rule-based and supportive.

## Fusion model analysis
- Previous approach:
  - Synthetic MLP plus heuristic fallback.
  - This was not production-trustworthy because the MLP was trained on synthetic archetypes rather than real validated labels.
- Current approach:
  - Deterministic weighted fusion.
  - Uses modality confidence, modality integrity, availability, and conservative weighting.
  - Self-report questionnaire evidence is treated as the strongest direct signal when available.
  - Visual evidence is intentionally weaker unless confidence and integrity are both good.
- Limitations:
  - It is still a rule-based system, not a learned calibrated multimodal model.
  - Hosted model response quality and latency depend on Hugging Face service availability.
- Best production direction later:
  - Keep the current deterministic fusion now.
  - Move to learned multimodal fusion only after collecting real labeled data, clear evaluation targets, and calibration datasets.

## Tradeoffs
- Accuracy:
  - Improved over the previous heuristic-heavy audio/video logic.
  - Still bounded by hosted model availability and the limits of generic FER/audio-emotion models.
- Speed:
  - Hosted inference is slower than pure local heuristics but more truthful.
- Memory:
  - Very low local memory footprint because no model weights are downloaded.
- Maintainability:
  - Better separation between preprocessing, hosted inference, and deterministic fusion.
  - Easier to swap hosted models later with config-level changes.

## Future recommendations
- Add per-model offline evaluation datasets for text, voice, and face signals relevant to the product.
- Calibrate fusion thresholds using real user-consented retrospective data.
- If a future deployment needs lower latency, introduce optional local inference paths only after explicit approval.
- Continue treating outputs as supportive wellness signals, not clinical diagnosis.
