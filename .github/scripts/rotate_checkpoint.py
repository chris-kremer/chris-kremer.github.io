#!/usr/bin/env python3
"""Rotate checkpoint.txt according to a deterministic Poisson process."""

from __future__ import annotations

import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import re
import secrets
import string
import subprocess
from datetime import datetime, timedelta, timezone


DAILY_MEAN = 2.6
INTERVAL_MINUTES = 15
SCHEDULE_OFFSET_MINUTES = 7
CHECKPOINT_PATH = Path("checkpoint.txt")
SYMBOLS = "!@#$%^&*+-_=.?"
COMMIT_PATTERN = re.compile(
    r"^checkpoint: rotate (?P<slot>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z) event (?P<event>\d+)$"
)


def poisson_sample(uniform_value: float, mean: float) -> int:
    """Return an inverse-CDF Poisson sample for a uniform value in (0, 1)."""
    probability = math.exp(-mean)
    cumulative = probability
    sample = 0

    while uniform_value > cumulative:
        sample += 1
        probability *= mean / sample
        cumulative += probability

        if sample > 100:
            raise RuntimeError("Poisson sampler exceeded its safety limit")

    return sample


def events_for_slot(schedule_seed: str, slot: datetime) -> int:
    slot_id = slot.strftime("%Y-%m-%dT%H:%MZ")
    digest = hmac.new(
        schedule_seed.encode("utf-8"),
        slot_id.encode("ascii"),
        hashlib.sha256,
    ).digest()
    uniform_value = (int.from_bytes(digest[:8], "big") + 0.5) / (2**64)
    slots_per_day = (24 * 60) // INTERVAL_MINUTES
    return poisson_sample(uniform_value, DAILY_MEAN / slots_per_day)


def elapsed_slots(now: datetime) -> list[datetime]:
    first_slot = now.replace(
        hour=0,
        minute=SCHEDULE_OFFSET_MINUTES,
        second=0,
        microsecond=0,
    )
    slots: list[datetime] = []
    slot = first_slot

    while slot <= now:
        slots.append(slot)
        slot += timedelta(minutes=INTERVAL_MINUTES)

    return slots


def completed_events() -> set[tuple[str, int]]:
    result = subprocess.run(
        ["git", "log", "--format=%s", "--", str(CHECKPOINT_PATH)],
        check=True,
        capture_output=True,
        text=True,
    )
    completed: set[tuple[str, int]] = set()

    for subject in result.stdout.splitlines():
        match = COMMIT_PATTERN.fullmatch(subject)
        if match:
            completed.add((match.group("slot"), int(match.group("event"))))

    return completed


def next_pending_event(schedule_seed: str, now: datetime) -> tuple[str, int] | None:
    completed = completed_events()

    for slot in elapsed_slots(now):
        slot_id = slot.strftime("%Y-%m-%dT%H:%MZ")
        for event_number in range(1, events_for_slot(schedule_seed, slot) + 1):
            if (slot_id, event_number) not in completed:
                return slot_id, event_number

    return None


def random_checkpoint(previous_value: str) -> str:
    alphabet = string.ascii_letters + string.digits + SYMBOLS

    while True:
        characters = [
            secrets.choice(string.ascii_letters),
            secrets.choice(string.digits),
            secrets.choice(SYMBOLS),
        ]
        characters.extend(secrets.choice(alphabet) for _ in range(13))
        secrets.SystemRandom().shuffle(characters)
        candidate = "".join(characters)

        if candidate != previous_value:
            return candidate


def main() -> None:
    schedule_seed = os.environ.get("CHECKPOINT_SCHEDULE_SEED")
    if not schedule_seed:
        raise RuntimeError("CHECKPOINT_SCHEDULE_SEED is required")

    now = datetime.now(timezone.utc)
    pending = next_pending_event(schedule_seed, now)
    if pending is None:
        print(json.dumps({"changed": False}))
        return

    slot_id, event_number = pending
    previous_value = CHECKPOINT_PATH.read_text(encoding="utf-8").strip()
    CHECKPOINT_PATH.write_text(
        random_checkpoint(previous_value) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "changed": True,
                "commit_message": (
                    f"checkpoint: rotate {slot_id} event {event_number}"
                ),
            }
        )
    )


if __name__ == "__main__":
    main()
