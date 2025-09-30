#!/usr/bin/env python3
# Press '4', move & click, then show a live countdown until the next cycle.

import time
import datetime as _dt
import sys
import pydirectinput as pdi

try:
    import pyautogui
except ImportError as e:
    raise SystemExit("Install first: pip install pyautogui") from e

INTERVAL_SECONDS = 6 * 60  # 6 minutes
TARGET_X = 1300
TARGET_Y = 242
MOVE_DURATION = 0.3        # seconds for smooth movement
INITIAL_DELAY = 5          # seconds before starting the loop

def _countdown(seconds: int, prefix: str):
    """Print a mm:ss countdown on one line."""
    for remaining in range(seconds, 0, -1):
        mm, ss = divmod(remaining, 60)
        sys.stdout.write(f"\r{prefix} {mm:02d}:{ss:02d} (Ctrl+C to stop)   ")
        sys.stdout.flush()
        time.sleep(1)
    # Clear the line after countdown completes
    sys.stdout.write("\r" + " " * 60 + "\r")
    sys.stdout.flush()

def main():
    pyautogui.FAILSAFE = True  # move mouse to top-left to abort

    print(f"Starting in {INITIAL_DELAY} seconds...")
    _countdown(INITIAL_DELAY, prefix="Starting in")

    count = 0
    while True:
        count += 1
        now = _dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Move & click to focus the target window/spot
        pyautogui.moveTo(TARGET_X, TARGET_Y, duration=MOVE_DURATION)
        pyautogui.click(TARGET_X, TARGET_Y, button='left')
        time.sleep(1)

        # Press '4' with DirectInput-style keys
        pdi.keyDown('4')
        time.sleep(0.05)
        pdi.keyUp('4')
        time.sleep(0.05)
        pyautogui.click(TARGET_X, TARGET_Y, button='left')
        print(f"[{now}] Cycle #{count}: pressed '4' and clicked at ({TARGET_X}, {TARGET_Y}).")

        # Live countdown to the next cycle
        _countdown(INTERVAL_SECONDS, prefix="Next action in")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped by user.")
