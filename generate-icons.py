#!/usr/bin/env python3
"""
Generate PNG icons for the LockedIn Chrome extension.
Run once before loading the extension:  python3 generate-icons.py
"""

import os
import math
import struct
import zlib


# ── PNG writer ────────────────────────────────────────────────────────────────

def make_png(width, height, pixels):
    """Build a minimal PNG from a flat list of (r, g, b, a) tuples."""

    def chunk(tag, data):
        body = tag + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)

    sig  = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))

    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter: None
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            raw.extend([r, g, b, a])

    idat = chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    iend = chunk(b'IEND', b'')

    return sig + ihdr + idat + iend


# ── Geometry helpers ──────────────────────────────────────────────────────────

def in_rounded_rect(px, py, w, h, r):
    """True if pixel centre is inside a rounded rectangle."""
    x, y = px + 0.5, py + 0.5
    if x < r and y < r:
        return math.hypot(x - r, y - r) <= r
    if x > w - r and y < r:
        return math.hypot(x - (w - r), y - r) <= r
    if x < r and y > h - r:
        return math.hypot(x - r, y - (h - r)) <= r
    if x > w - r and y > h - r:
        return math.hypot(x - (w - r), y - (h - r)) <= r
    return True


def aa_circle(px, py, cx, cy, r, feather=0.6):
    """Anti-aliased circle mask in [0, 1]."""
    d = math.hypot(px + 0.5 - cx, py + 0.5 - cy)
    if d <= r - feather:
        return 1.0
    if d >= r + feather:
        return 0.0
    return (r + feather - d) / (2 * feather)


def aa_rect_mask(px, py, x0, y0, x1, y1):
    """Hard mask — 1 if inside rectangle."""
    return 1.0 if x0 <= px < x1 and y0 <= py < y1 else 0.0


# ── Icon drawing ──────────────────────────────────────────────────────────────

def blend(base_rgba, overlay_rgb, alpha):
    r = int(base_rgba[0] * (1 - alpha) + overlay_rgb[0] * alpha)
    g = int(base_rgba[1] * (1 - alpha) + overlay_rgb[1] * alpha)
    b = int(base_rgba[2] * (1 - alpha) + overlay_rgb[2] * alpha)
    a = base_rgba[3]
    return (r, g, b, a)


def make_icon(size, active):
    if active:
        bg_color = (0, 102, 255)    # electric blue
    else:
        bg_color = (16, 16, 16)     # near-black

    fg_color = (255, 255, 255)      # white
    transparent = (0, 0, 0, 0)

    corner_r = size * 0.22
    pixels = []

    # Lock geometry scaled to icon size
    s = size
    # Shackle: arc centred at (s/2, s*0.38), outer r, inner r
    shackle_cx  = s / 2
    shackle_cy  = s * 0.36
    shackle_or  = s * 0.22
    shackle_ir  = s * 0.13
    shackle_bot = s * 0.50   # shackle only drawn above this y

    # Body rectangle
    body_x0 = s * 0.20
    body_x1 = s * 0.80
    body_y0 = s * 0.46
    body_y1 = s * 0.86
    body_cr = s * 0.10

    # Keyhole
    kh_cx = s / 2
    kh_cy = s * 0.64
    kh_r  = s * 0.08
    kh_slot_x0 = s / 2 - s * 0.04
    kh_slot_x1 = s / 2 + s * 0.04
    kh_slot_y0 = kh_cy
    kh_slot_y1 = kh_cy + s * 0.14

    for py in range(size):
        for px in range(size):
            pixel = transparent

            if in_rounded_rect(px, py, s, s, corner_r):
                pixel = (*bg_color, 255)

                # ── Draw shackle (ring, top half only) ──────────────────────
                if py + 0.5 < shackle_bot:
                    outer = aa_circle(px, py, shackle_cx, shackle_cy, shackle_or)
                    inner = aa_circle(px, py, shackle_cx, shackle_cy, shackle_ir)
                    ring  = max(0.0, outer - inner)
                    if ring > 0:
                        pixel = blend(pixel, fg_color, ring)

                # ── Draw body rectangle ──────────────────────────────────────
                in_body = (body_x0 <= px < body_x1 and body_y0 <= py < body_y1)
                if in_body:
                    pixel = (*fg_color, 255)

                    # Punch out keyhole circle
                    kh_mask = aa_circle(px, py, kh_cx, kh_cy, kh_r)
                    if kh_mask > 0:
                        pixel = blend(pixel, bg_color, kh_mask)

                    # Punch out keyhole slot
                    if aa_rect_mask(px, py, kh_slot_x0, kh_slot_y0,
                                    kh_slot_x1, kh_slot_y1) > 0:
                        pixel = (*bg_color, 255)

            pixels.append(pixel)

    return pixels


# ── Entrypoint ────────────────────────────────────────────────────────────────

def save(path, size, active):
    pixels = make_icon(size, active)
    data   = make_png(size, size, pixels)
    with open(path, 'wb') as f:
        f.write(data)
    print(f'  {path}  ({size}x{size})')


if __name__ == '__main__':
    os.makedirs('icons', exist_ok=True)
    print('Generating icons...')

    save('icons/icon16.png',          16,  active=False)
    save('icons/icon48.png',          48,  active=False)
    save('icons/icon128.png',         128, active=False)
    save('icons/icon-inactive16.png', 16,  active=False)
    save('icons/icon-inactive48.png', 48,  active=False)
    save('icons/icon-active16.png',   16,  active=True)
    save('icons/icon-active48.png',   48,  active=True)

    print('Done.')
