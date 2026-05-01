import json
import os
import sys
from app.services.video_inference_service import analyse_video
from app.services.audio_inference_service import analyse_audio

video_path = r'D:\Dhyan\Self Projects\MindSentry\uploads\video\8cb7c4fb3206470c951332de3ee68475.mp4'
audio_path = r'D:\Dhyan\Self Projects\MindSentry\uploads\audio\409c9fa84a65406590f1e1ff68065632.m4a'

results = {}

if os.path.exists(video_path):
    video_res = analyse_video(video_path)
    results['video'] = {
        'duration_seconds': video_res.get('metadata', {}).get('duration_seconds'),
        'fps': video_res.get('metadata', {}).get('fps'),
        'resolution_width': video_res.get('metadata', {}).get('resolution_width'),
        'resolution_height': video_res.get('metadata', {}).get('resolution_height'),
        'face_detected': video_res.get('analysis', {}).get('face_detected'),
        'face_ratio': video_res.get('analysis', {}).get('face_ratio'),
        'video_emotion': video_res.get('inference', {}).get('video_emotion'),
        'video_emotion_confidence': video_res.get('inference', {}).get('video_emotion_confidence'),
        'video_integrity_flags': video_res.get('integrity', {}).get('video_integrity_flags'),
        'warnings_count': len(video_res.get('warnings', []))
    }
else:
    results['video'] = 'File missing'

if os.path.exists(audio_path):
    audio_res = analyse_audio(audio_path)
    results['audio'] = {
        'duration_seconds': audio_res.get('features', {}).get('duration_seconds'),
        'silence_ratio': audio_res.get('features', {}).get('silence_ratio'),
        'audio_emotion': audio_res.get('inference', {}).get('audio_emotion'),
        'audio_emotion_confidence': audio_res.get('inference', {}).get('audio_emotion_confidence'),
        'audio_integrity_flags': audio_res.get('integrity', {}).get('audio_integrity_flags'),
        'warnings_count': len(audio_res.get('warnings', []))
    }
else:
    results['audio'] = 'File missing'

print(json.dumps(results, indent=2))
