#!/usr/bin/env python3
"""
Peppa Retell — Video Synthesizer
Combines per-scene recordings with screenshots into a narrated movie.

Usage:
  python make_movie.py <course_folder>

Expects:
  course_folder/
    config.json
    scene-1.webm, scene-2.webm, ...  (student recordings)
    screenshot images referenced in config.json

Output:
  course_folder/my-retell.mp4
"""

import json
import sys
import os
import subprocess
import tempfile
from pathlib import Path


def get_audio_duration(audio_path: str) -> float:
    """Get duration of an audio file using ffprobe."""
    result = subprocess.run(
        ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', audio_path],
        capture_output=True, text=True
    )
    info = json.loads(result.stdout)
    return float(info['format']['duration'])


def make_scene_video(image_path: str, audio_path: str, output_path: str, duration: float):
    """Create a video segment: static image + audio, duration matched to audio length."""
    subprocess.run([
        'ffmpeg', '-y',
        '-loop', '1', '-i', image_path,
        '-i', audio_path,
        '-c:v', 'libx264', '-tune', 'stillimage',
        '-c:a', 'aac', '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-t', str(duration),
        '-shortest',
        '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=white',
        output_path
    ], check=True, capture_output=True)


def make_placeholder_image(text: str, output_path: str):
    """Generate a simple placeholder image using ffmpeg when no screenshot exists."""
    subprocess.run([
        'ffmpeg', '-y',
        '-f', 'lavfi', '-i',
        f"color=c=white:s=1280x720:d=1,drawtext=text='{text}':fontsize=48:fontcolor=black:x=(w-text_w)/2:y=(h-text_h)/2",
        '-frames:v', '1',
        output_path
    ], check=True, capture_output=True)


def main():
    if len(sys.argv) < 2:
        print("Usage: python make_movie.py <course_folder>")
        sys.exit(1)

    folder = Path(sys.argv[1])
    config_path = folder / 'config.json'

    if not config_path.exists():
        print(f"Error: {config_path} not found")
        sys.exit(1)

    with open(config_path) as f:
        config = json.load(f)

    scenes = config.get('scenes', [])
    if not scenes:
        print("No scenes in config.")
        sys.exit(1)

    temp_dir = tempfile.mkdtemp(prefix='peppa-retell-')
    segment_files = []

    print(f"🐷 Peppa Retell Movie Maker")
    print(f"   {len(scenes)} scenes to process\n")

    for i, scene in enumerate(scenes):
        scene_num = i + 1
        audio_file = folder / f'scene-{scene_num}.webm'

        if not audio_file.exists():
            print(f"  ⚠️  Scene {scene_num}: no recording found, skipping")
            continue

        # Resolve image
        image_file = None
        if scene.get('image'):
            candidate = folder / scene['image']
            if candidate.exists():
                image_file = str(candidate)

        if not image_file:
            # Generate placeholder
            placeholder = os.path.join(temp_dir, f'placeholder-{scene_num}.png')
            make_placeholder_image(scene.get('title', f'Scene {scene_num}'), placeholder)
            image_file = placeholder

        duration = get_audio_duration(str(audio_file))
        segment_path = os.path.join(temp_dir, f'segment-{scene_num}.mp4')

        print(f"  🎬 Scene {scene_num}: {duration:.1f}s")
        make_scene_video(image_file, str(audio_file), segment_path, duration)
        segment_files.append(segment_path)

    if not segment_files:
        print("\nNo segments to combine. Make sure you have scene recordings.")
        sys.exit(1)

    # Concatenate all segments
    concat_list = os.path.join(temp_dir, 'concat.txt')
    with open(concat_list, 'w') as f:
        for seg in segment_files:
            f.write(f"file '{seg}'\n")

    output_path = folder / 'my-retell.mp4'
    print(f"\n  📼 Combining {len(segment_files)} segments...")

    subprocess.run([
        'ffmpeg', '-y',
        '-f', 'concat', '-safe', '0',
        '-i', concat_list,
        '-c', 'copy',
        str(output_path)
    ], check=True, capture_output=True)

    print(f"\n  ✅ Movie saved: {output_path}")
    print(f"     Duration: {sum(get_audio_duration(s) for s in segment_files):.1f}s")

    # Cleanup temp
    import shutil
    shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == '__main__':
    main()
