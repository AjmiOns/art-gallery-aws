#!/usr/bin/env python3
"""Génère les œuvres originales de frontend/public/artworks (peinture, décoration murale, art numérique, croquis).

Prérequis : pip install numpy scipy pillow opencv-python
Usage : python scripts/generate_artworks.py --out frontend/public/artworks --category painting
"""
import argparse
import math
import os
import random

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, gaussian_filter1d, map_coordinates, uniform_filter

W, H = int(os.environ.get('ART_W', 720)), int(os.environ.get('ART_H', 900))
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


# ------------------------------------------------------------------ helpers
def rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0


def cmap(v, cols):
    cols = np.array([rgb(c) if isinstance(c, str) else c for c in cols])
    xs = np.linspace(0, 1, len(cols))
    return np.stack([np.interp(v, xs, cols[:, i]) for i in range(3)], -1).astype(np.float32)


def norm(a):
    lo, hi = np.percentile(a, [1, 99])
    return np.clip((a - lo) / (hi - lo + 1e-9), 0, 1).astype(np.float32)


def fbm(rng, base=100, octaves=4, gain=0.55):
    """Bruit fractal 0..1 (les grandes octaves sont calculées en basse résolution)."""
    out = np.zeros((H, W), np.float32)
    amp, sig = 1.0, base
    for _ in range(octaves):
        if sig >= 12:
            n = gaussian_filter(rng.standard_normal((H // 4 + 1, W // 4 + 1)), sig / 4, mode="reflect")
            n = cv2.resize(n.astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
        else:
            n = gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), max(sig, 0.8))
        out += amp * n / (n.std() + 1e-9)
        amp *= gain
        sig /= 2
    return norm(out)


def finish(img, rng, grain=0.02, canvas=0.03, vignette=0.08):
    if canvas:
        weave = (np.sin(XX * 1.9) + np.sin(YY * 1.9)) * 0.5
        img = img * (1 + canvas * weave[..., None])
    if grain:
        img = img + rng.normal(0, grain, img.shape)
    if vignette:
        d = np.hypot((XX - W / 2) / (W / 2), (YY - H / 2) / (H / 2))
        img = img * (1 - vignette * d[..., None] ** 2)
    return np.clip(img, 0, 1).astype(np.float32)


def save(img, path, size=None):
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    if size:
        im = im.resize(size, Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, quality=84, optimize=True, progressive=True)


def warp(field, wx, wy, amp):
    return map_coordinates(field, [np.clip(YY + wy * amp, 0, H - 1), np.clip(XX + wx * amp, 0, W - 1)], order=1)


def kuwahara(img, r=4):
    m, sh = r + 1, r // 2
    gray = img.mean(-1)
    mean_g = uniform_filter(gray, m)
    var_g = uniform_filter(gray ** 2, m) - mean_g ** 2
    shifts = [(sh, sh), (sh, -sh), (-sh, sh), (-sh, -sh)]
    idx = np.stack([np.roll(var_g, s, (0, 1)) for s in shifts]).argmin(0)
    out = np.zeros_like(img)
    for c in range(3):
        mc = uniform_filter(img[..., c], m)
        ms = np.stack([np.roll(mc, s, (0, 1)) for s in shifts])
        out[..., c] = np.take_along_axis(ms, idx[None], 0)[0]
    return out


# ------------------------------------------------------------------ PAINTING
def fluid(seed, cols):
    rng = np.random.default_rng(seed)
    wx, wy = fbm(rng, base=120) * 2 - 1, fbm(rng, base=120) * 2 - 1
    f = warp(fbm(rng, base=200, octaves=3), wx, wy, 170)
    f = warp(f, warp(wx, wx, wy, 90), warp(wy, wx, wy, 90), 120)
    v = norm(gaussian_filter(f, 1.5))
    t = np.abs(((v * 2.6) % 2) - 1)
    img = cmap(t, cols)
    ridge = np.exp(-(np.sin(v * math.pi * 2.6 * 2)) ** 2 * 60)[..., None]
    img = img * (1 - 0.10 * ridge) + 0.07 * ridge
    gy, gx = np.gradient(gaussian_filter(v, 3.0))
    img = img + np.clip((-gx - gy) * 18, -0.06, 0.06)[..., None]
    return finish(img, rng, grain=0.008, canvas=0.015, vignette=0.04)


def landscape(seed, sky, mtn, sun, water=False, paint=True, raw=False):
    rng = np.random.default_rng(seed)
    hz = int(H * rng.uniform(0.56, 0.66))
    t = np.linspace(0, 1, hz)
    img = np.zeros((H, W, 3), np.float32)
    sky_img = np.repeat(cmap(t, sky)[:, None, :], W, axis=1)
    img[:hz] = sky_img
    img[hz:] = sky_img[-1]
    cl = gaussian_filter(rng.standard_normal((H // 4, W // 4)), (3, 14))
    cl = cv2.resize(norm(cl), (W, H))
    alpha = np.clip((cl - 0.55) / 0.25, 0, 1) * 0.5 * np.clip(1 - YY / hz, 0, 1) ** 0.6
    alpha[hz:] = 0
    cloud_col = np.clip(rgb(sky[-1]) * 0.25 + 0.78, 0, 1)
    img = img * (1 - alpha[..., None]) + cloud_col * alpha[..., None]
    sx, sy = rng.uniform(0.25, 0.75) * W, hz - rng.uniform(0.12, 0.4) * hz
    d = np.hypot(XX - sx, YY - sy)
    sc = rgb(sun)
    glow = (np.exp(-(d / 170) ** 2) * 0.55 + np.exp(-(d / 60) ** 2) * 0.5) * (YY < hz + 40)
    img = img + sc * glow[..., None] * 0.8
    disk = np.clip((52 - d) / 2.5, 0, 1)
    img = img * (1 - disk[..., None]) + sc * disk[..., None]
    n = len(mtn)
    for l in range(n):
        if water:
            mean, amp = hz - 18 - (n - 1 - l) * 34, 70 - 12 * l
        else:
            mean, amp = hz * 0.84 + l * (H - hz * 0.84) * 0.17, 85 - 10 * l
        p = np.zeros(W)
        for s, a in [(90, 1.0), (35, 0.5), (12, 0.22), (4, 0.08)]:
            g = gaussian_filter1d(rng.standard_normal(W), s, mode="reflect")
            p += a * g / (g.std() + 1e-9)
        p /= p.std() + 1e-9
        ridge = mean + amp * 0.55 * p
        mask = (YY > ridge[None, :]).astype(np.float32)
        if water:
            mask *= YY <= hz
        mask = gaussian_filter(mask, 0.8)
        tex = fbm(rng, base=40, octaves=4)
        shade = 1 - 0.18 * np.clip((YY - ridge[None, :]) / 220, 0, 1) + 0.12 * (tex - 0.5)
        img = img * (1 - mask[..., None]) + rgb(mtn[l]) * shade[..., None] * mask[..., None]
    if water:
        refl = cv2.resize(img[:hz][::-1].copy(), (W, H - hz), interpolation=cv2.INTER_LINEAR)
        rows = np.arange(H - hz)[:, None]
        shift = np.sin(rows * 0.35 + rng.uniform(0, 6)) * 4 * (1 + rows / 80.0)
        xs = np.clip(np.arange(W)[None, :] + shift, 0, W - 1).astype(int)
        refl = np.take_along_axis(refl, np.repeat(xs[..., None], 3, -1), axis=1)
        refl = gaussian_filter(refl, (1.0, 6.0, 0))
        depth = np.linspace(0, 1, H - hz)[:, None, None]
        refl = refl * (0.9 - 0.3 * depth)
        wy = YY[hz:]
        glit = np.exp(-((XX[hz:] - sx) / (22 + (wy - hz) * 0.25)) ** 2) * (0.5 + 0.5 * np.sin(wy * 0.9)) * np.exp(-(wy - hz) / 260)
        img[hz:] = refl + sc * glit[..., None] * 0.55
    if paint:
        img = kuwahara(img, 4)
    if raw:
        return np.clip(img, 0, 1)
    return finish(img, rng, grain=0.012, canvas=0.03, vignette=0.07)


def knife(seed, cols, bg):
    rng = np.random.default_rng(seed)
    canvas = rgb(bg) * (0.93 + 0.1 * fbm(rng, base=60, octaves=3)[..., None])
    for _ in range(46):
        cx, cy = rng.uniform(-40, W + 40), rng.uniform(-40, H + 40)
        ang = rng.uniform(-0.7, 0.7) + (math.pi / 2 if rng.random() < 0.3 else 0)
        L, Wd = rng.uniform(160, 560), rng.uniform(36, 190)
        c, s = math.cos(ang), math.sin(ang)
        dx = (XX - cx) * c + (YY - cy) * s
        dy = -(XX - cx) * s + (YY - cy) * c
        edge = (fbm(rng, base=14, octaves=2) - 0.5) * 22
        mask = np.clip((L / 2 - np.abs(dx) + edge) / 4, 0, 1) * np.clip((Wd / 2 - np.abs(dy) + edge) / 4, 0, 1)
        bristle = gaussian_filter1d(rng.standard_normal(96), 1.2)
        idx = np.clip(((dy + Wd / 2) / Wd * 95), 0, 95).astype(int)
        tex = bristle[idx] / (bristle.std() + 1e-9)
        col = rgb(cols[rng.integers(len(cols))]) * rng.uniform(0.88, 1.08)
        layer = np.clip(col * (1 + 0.07 * tex[..., None]), 0, 1)
        rim = np.clip(mask - gaussian_filter(mask, 3), 0, 1)[..., None] * 0.35
        a = (0.96 * mask)[..., None]
        canvas = canvas * (1 - a) + layer * a + rim * 0.4
    return finish(canvas, rng, grain=0.01, canvas=0.035, vignette=0.05)


# ------------------------------------------------------------------ WALL ART
S = 2


def pil_canvas(bg):
    im = Image.new("RGB", (W * S, H * S), tuple(int(x * 255) for x in rgb(bg)))
    return im, ImageDraw.Draw(im)


def pil_to_np(im):
    return np.asarray(im.resize((W, H), Image.LANCZOS), np.float32) / 255.0


def paper_finish(img, seed):
    rng = np.random.default_rng(seed + 999)
    fiber = gaussian_filter(rng.standard_normal((H, W)), 0.9)
    low = fbm(rng, base=90, octaves=3) - 0.5
    img = img * (1 + 0.025 * fiber[..., None] / (fiber.std() + 1e-9) + 0.04 * low[..., None])
    return np.clip(img, 0, 1)


def hx(c):
    return tuple(int(x * 255) for x in rgb(c))


def arches(seed, bg, cols):
    rnd = random.Random(seed)
    im, d = pil_canvas(bg)
    w, h = W * S, H * S
    if seed % 2 == 0:
        cx, base_y, R = w / 2, h * 0.76, w * 0.40
        n = rnd.choice([4, 5, 6])
        sx = cx + rnd.choice([-1, 1]) * w * 0.2
        d.ellipse([sx - w * 0.09, h * 0.14, sx + w * 0.09, h * 0.14 + w * 0.18], fill=hx(cols[rnd.randrange(len(cols))]))
        for i in range(n):
            r = R - i * (R / (n + 0.8))
            d.pieslice([cx - r, base_y - r, cx + r, base_y + r], 180, 360, fill=hx(cols[i % len(cols)]))
        d.rectangle([w * 0.12, base_y, w * 0.88, base_y + 10], fill=hx(cols[-1]))
        for k in range(7):
            x = rnd.uniform(0.1, 0.9) * w
            y = rnd.uniform(0.06, 0.4) * h
            d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=hx(cols[rnd.randrange(len(cols))]))
    else:
        d.ellipse([w * 0.18, h * 0.12, w * 0.18 + w * 0.34, h * 0.12 + w * 0.34], fill=hx(cols[0]))
        ww, gap = w * 0.24, w * 0.06
        x0 = (w - (3 * ww + 2 * gap)) / 2
        base = h * 0.84
        for i in range(3):
            x = x0 + i * (ww + gap)
            top = h * rnd.uniform(0.34, 0.5)
            c1, c2 = cols[(i + 1) % len(cols)], cols[(i + 3) % len(cols)]
            d.rectangle([x, top + ww / 2, x + ww, base], fill=hx(c1))
            d.pieslice([x, top, x + ww, top + ww], 180, 360, fill=hx(c1))
            ins = ww * 0.2
            d.rectangle([x + ins, top + ww / 2 + ins * 0.6, x + ww - ins, base - ins * 1.4], fill=hx(c2))
            d.pieslice([x + ins, top + ins * 0.6, x + ww - ins, top + ww - ins * 0.4], 180, 360, fill=hx(c2))
        d.rectangle([w * 0.1, base, w * 0.9, base + 12], fill=hx(cols[-1]))
    return paper_finish(pil_to_np(im), seed)


def sun_waves(seed, bg, cols):
    rnd = random.Random(seed)
    im, d = pil_canvas(bg)
    w, h = W * S, H * S
    r = w * rnd.uniform(0.2, 0.26)
    cx, cy = w * rnd.uniform(0.4, 0.6), h * rnd.uniform(0.32, 0.4)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hx(cols[0]))
    n = rnd.choice([5, 6, 7])
    f0 = rnd.uniform(0.35, 0.6)
    for k in range(n):
        base = h * 0.5 + k * h * (0.5 / n)
        amp = h * rnd.uniform(0.014, 0.03)
        f, ph = 2 * math.pi / (w * f0 * rnd.uniform(0.8, 1.2)), rnd.uniform(0, 6.28)
        pts = [(x, base + amp * math.sin(x * f + ph)) for x in range(0, w + 1, 8)] + [(w, h), (0, h)]
        d.polygon(pts, fill=hx(cols[(k + 1) % len(cols)]))
    for _ in range(9):
        x, y = rnd.uniform(0.08, 0.92) * w, rnd.uniform(0.05, 0.42) * h
        d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=hx(cols[rnd.randrange(len(cols))]))
    return paper_finish(pil_to_np(im), seed)


def organic(seed, bg, cols):
    rnd = random.Random(seed)
    im, d = pil_canvas(bg)
    w, h = W * S, H * S
    for i in range(rnd.randint(6, 9)):
        cx, cy = rnd.uniform(0.15, 0.85) * w, rnd.uniform(0.15, 0.85) * h
        R = rnd.uniform(0.1, 0.24) * w
        ph = [rnd.uniform(0, 6.28) for _ in range(3)]
        pts = []
        for k in range(120):
            th = k / 120 * 2 * math.pi
            rr = R * (1 + 0.25 * math.sin(2 * th + ph[0]) + 0.15 * math.sin(3 * th + ph[1]) + 0.08 * math.sin(5 * th + ph[2]))
            pts.append((cx + rr * math.cos(th), cy + rr * math.sin(th)))
        d.polygon(pts, fill=hx(cols[i % len(cols)]))
    for i in range(rnd.randint(4, 6)):
        x, y = rnd.uniform(0.1, 0.9) * w, rnd.uniform(0.1, 0.9) * h
        L, a = rnd.uniform(0.1, 0.2) * h, rnd.uniform(0, math.pi)
        pts = []
        for u in np.linspace(0, 1, 30):
            hw = L * 0.16 * math.sin(math.pi * u) ** 0.9
            pts.append((x + math.cos(a) * L * u - math.sin(a) * hw, y + math.sin(a) * L * u + math.cos(a) * hw))
        for u in np.linspace(1, 0, 30):
            hw = L * 0.16 * math.sin(math.pi * u) ** 0.9
            pts.append((x + math.cos(a) * L * u + math.sin(a) * hw, y + math.sin(a) * L * u - math.cos(a) * hw))
        d.polygon(pts, fill=hx(cols[(i + 2) % len(cols)]))
    return paper_finish(pil_to_np(im), seed)


# ------------------------------------------------------------------ DIGITAL
def mesh(seed, bg, cols, light=False):
    rng = np.random.default_rng(seed)
    img = np.ones((H, W, 3), np.float32) * rgb(bg)
    for i in range(7):
        cx, cy = rng.uniform(-0.1, 1.1) * W, rng.uniform(-0.1, 1.1) * H
        sg = rng.uniform(130, 280)
        g = np.exp(-((XX - cx) ** 2 + (YY - cy) ** 2) / (2 * sg ** 2))[..., None]
        col = rgb(cols[i % len(cols)])
        img = img * (1 - g * 0.9) + col * g * 0.9 if light else img + col * g * 0.7
    ring = np.zeros((H, W, 3), np.float32)
    for _ in range(2):
        cv2.circle(ring, (int(rng.uniform(0.2, 0.8) * W), int(rng.uniform(0.25, 0.75) * H)), int(rng.uniform(120, 300)), (1, 1, 1), 2, cv2.LINE_AA)
    img = img + cv2.GaussianBlur(ring, (0, 0), 1.2) * (0.25 if not light else -0.12) + cv2.GaussianBlur(ring, (0, 0), 8) * (0.2 if not light else 0)
    if not light:
        img = 1 - np.exp(-img * 1.5)
    return finish(img, rng, grain=0.02, canvas=0, vignette=0.0 if light else 0.1)


def synth(seed, sky, sun_cols, grid_col, mtn_col):
    rng = np.random.default_rng(seed)
    hz = int(H * 0.6)
    img = np.zeros((H, W, 3), np.float32)
    img[:hz] = np.repeat(cmap(np.linspace(0, 1, hz), sky)[:, None, :], W, axis=1)
    for _ in range(140):
        x, y = rng.integers(0, W), rng.integers(0, int(hz * 0.7))
        img[y, x] = np.clip(img[y, x] + rng.uniform(0.5, 1.0), 0, 1)
    img[:hz] = np.maximum(img[:hz], cv2.GaussianBlur(img[:hz], (0, 0), 1.0))
    cx, R = W * rng.uniform(0.3, 0.7), rng.uniform(140, 235)
    cy = hz - rng.uniform(0.55, 0.85) * R
    d = np.hypot(XX - cx, YY - cy)
    inside = np.clip((R - d) / 2, 0, 1)
    sun = cmap(np.clip((YY - (cy - R)) / (2 * R), 0, 1), sun_cols)
    cut = np.ones((H, W), np.float32)
    for k in range(1, 9):
        y0 = cy + 10 + k * 22
        cut[(YY > y0) & (YY < y0 + k * 2.6)] = 0
    glow = (np.exp(-(d / 260) ** 2) * 0.35)[..., None] * rgb(sun_cols[0])
    img[:hz] += glow[:hz]
    m = (inside * cut * (YY < hz))[..., None]
    img = img * (1 - m) + sun * m
    for l, (mean, amp) in enumerate([(hz - 70, 70), (hz - 25, 55)]):
        p = np.zeros(W)
        for s, a in [(60, 1.0), (22, 0.5), (8, 0.2)]:
            g = gaussian_filter1d(rng.standard_normal(W), s, mode="reflect")
            p += a * g / (g.std() + 1e-9)
        ridge = mean + amp * 0.5 * np.abs(p / (p.std() + 1e-9))
        ridge = np.minimum(ridge, hz)
        mask = ((YY > ridge[None, :]) & (YY <= hz)).astype(np.float32)[..., None]
        img = img * (1 - mask) + rgb(mtn_col) * (0.8 + 0.2 * l) * mask
    floor = np.repeat(cmap(np.linspace(0, 1, H - hz), [mtn_col, "#0a0420"])[:, None, :], W, axis=1)
    img[hz:] = floor
    lines = np.zeros((H, W, 3), np.float32)
    gc = tuple(float(x) for x in rgb(grid_col))
    for i in range(1, 16):
        y = int(hz + (H - hz) * (i / 15) ** 2.2)
        cv2.line(lines, (0, y), (W, y), gc, 2, cv2.LINE_AA)
    for j in range(-14, 15):
        cv2.line(lines, (W // 2, hz), (int(W / 2 + j * 110), H), gc, 2, cv2.LINE_AA)
    lines[:hz] = 0
    cv2.line(lines, (0, hz), (W, hz), gc, 3, cv2.LINE_AA)
    img = img + lines * 0.9 + cv2.GaussianBlur(lines, (0, 0), 7) * 1.1
    return finish(img, rng, grain=0.015, canvas=0, vignette=0.12)


def flow(seed, bg, cols):
    rng = np.random.default_rng(seed)
    ang = fbm(rng, base=150, octaves=3) * 4 * math.pi
    img = np.zeros((H, W, 3), np.uint8) + (rgb(bg) * 255).astype(np.uint8)
    for _ in range(1700):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        pts = []
        for _ in range(120):
            if not (0 <= x < W and 0 <= y < H):
                break
            pts.append((int(x), int(y)))
            a = ang[int(y), int(x)]
            x += math.cos(a) * 3.2
            y += math.sin(a) * 3.2
        if len(pts) > 8:
            t = (ang[pts[0][1], pts[0][0]] / (4 * math.pi) + pts[0][0] / W * 0.4) % 1.0
            col = (cmap(np.array([t]), cols)[0] * 255 * rng.uniform(0.6, 1.0)).tolist()
            cv2.polylines(img, [np.array(pts, np.int32)], False, col, 1, cv2.LINE_AA)
    f = img.astype(np.float32) / 255
    f = f + cv2.GaussianBlur(f, (0, 0), 5) * 0.9
    return finish(f, rng, grain=0.012, canvas=0, vignette=0.12)


# ------------------------------------------------------------------ SKETCH
def pencil(img, rng, paper="#F2EDE2", contrast=1.0):
    gray = img @ np.array([0.299, 0.587, 0.114], np.float32)
    blur = gaussian_filter(1 - gray, 4)
    dodge = np.clip(gray / (1 - blur + 0.03), 0, 1)
    tone = 1 - 0.55 * (1 - gray)
    wob = (fbm(rng, base=30, octaves=2) - 0.5) * 8
    h1 = (np.sin((XX + YY) * 0.85 + wob * 3) > 0.45).astype(np.float32)
    h2 = (np.sin((XX - YY) * 0.85 + wob * 3) > 0.45).astype(np.float32)
    shade = (1 - 0.5 * np.clip((0.6 - gray) / 0.35, 0, 1) * h1) * (1 - 0.45 * np.clip((0.35 - gray) / 0.25, 0, 1) * h2)
    out = (0.5 * dodge + 0.5 * tone) * shade
    out = np.clip((out - 0.5) * contrast + 0.5, 0, 1)
    out = gaussian_filter(out, 0.6) * (1 + rng.normal(0, 0.04, out.shape))
    graphite, pap = np.array([0.16, 0.16, 0.19], np.float32), rgb(paper)
    pap = pap * (0.96 + 0.06 * fbm(rng, base=70, octaves=3)[..., None])
    o = np.clip(out, 0, 1)[..., None]
    return np.clip(graphite * (1 - o) + pap * o, 0, 1)


def sketch_landscape(seed, kind):
    rng = np.random.default_rng(seed + 500)
    presets = [
        (["#4a4a4a", "#9a9a9a", "#e0e0e0"], ["#b0b0b0", "#808080", "#555555", "#2a2a2a"], "#ffffff", False),
        (["#7a7a7a", "#c0c0c0", "#ececec"], ["#a0a0a0", "#707070", "#404040"], "#ffffff", True),
    ]
    sky, mtn, sun, water = presets[kind % 2]
    img = landscape(seed, sky, mtn, sun, water=water, paint=False, raw=True)
    return finish(pencil(img, rng, contrast=1.6), rng, grain=0.008, canvas=0, vignette=0.06)


def still_life(seed):
    rng = np.random.default_rng(seed)
    z = np.zeros((H, W), np.float32)
    ground = int(H * 0.68)
    sil = []
    n = int(rng.integers(3, 6))
    xs = np.sort(rng.uniform(0.18, 0.82, n)) * W
    for i, cx in enumerate(xs):
        if rng.random() < 0.5:
            r = rng.uniform(55, 105)
            cy = ground + rng.uniform(-10, 70) - r * 0.35
            zz = np.sqrt(np.clip(r ** 2 - (XX - cx) ** 2 - (YY - cy) ** 2, 0, None))
        else:
            hh = rng.uniform(220, 360)
            ybot = ground + rng.uniform(0, 60)
            ytop = ybot - hh
            t = np.clip((YY - ytop) / hh, 1e-4, 1)
            rmax, rmin = rng.uniform(55, 90), rng.uniform(20, 38)
            prof = rmin + (rmax - rmin) * np.sin(np.pi * t ** 0.75) ** 0.9
            prof = np.where((YY >= ytop) & (YY <= ybot), prof, 0)
            zz = np.sqrt(np.clip(prof ** 2 - (XX - cx) ** 2, 0, None))
        z = np.maximum(z, zz)
        sil.append(zz > 0)
    gy, gx = np.gradient(gaussian_filter(z, 1.2))
    nz = 1 / np.sqrt(gx ** 2 + gy ** 2 + 1)
    L = np.array([-0.55, -0.6, 0.58])
    L /= np.linalg.norm(L)
    lam = np.clip((-gx * L[0] - gy * L[1] + L[2]) * nz, 0, 1)
    obj = 0.12 + 0.70 * lam
    wall = 0.86 + 0.06 * (1 - YY / H)
    floor = 0.93 - 0.12 * np.clip((YY - ground) / (H - ground), 0, 1)
    bg = np.where(YY < ground, wall, floor)
    m = np.zeros((H, W), np.float32)
    for s in sil:
        m = np.maximum(m, s.astype(np.float32))
    shadow = gaussian_filter(np.roll(m, (int(22), int(50)), (0, 1)), 16)
    bg = bg * (1 - 0.5 * shadow * (YY > ground - 10))
    mm = gaussian_filter(m, 0.8)
    img = np.clip(bg * (1 - mm) + obj * mm, 0, 1)
    k = np.ones((5, 5), np.uint8)
    edge = cv2.dilate(m, k) - cv2.erode(m, k)
    img = np.clip(img - 0.55 * gaussian_filter(edge, 1.0), 0, 1)
    img = np.repeat(img[..., None], 3, -1).astype(np.float32)
    return finish(pencil(img, rng, contrast=1.2), rng, grain=0.008, canvas=0, vignette=0.07)


def botanical(seed):
    rnd = random.Random(seed)
    rng = np.random.default_rng(seed)
    im = Image.new("RGB", (W * S, H * S), hx("#F4EFE4"))
    d = ImageDraw.Draw(im)
    ink = (52, 50, 48)
    w, h = W * S, H * S

    def bez(p0, p1, p2, p3, n=90):
        return [((1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t ** 2 * p2[0] + t ** 3 * p3[0],
                 (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t ** 2 * p2[1] + t ** 3 * p3[1]) for t in np.linspace(0, 1, n)]

    for _ in range(rnd.choice([1, 2, 2, 3])):
        x0, y0 = rnd.uniform(0.2, 0.8) * w, h * 0.96
        x1, y1 = x0 + rnd.uniform(-0.3, 0.3) * w, h * rnd.uniform(0.14, 0.32)
        pts = bez((x0, y0), (x0 + rnd.uniform(-0.25, 0.25) * w, y0 - 0.3 * h), (x1 + rnd.uniform(-0.25, 0.25) * w, y1 + 0.3 * h), (x1, y1))
        for off in (0, 3):
            d.line([(x + off, y) for x, y in pts], fill=ink, width=5, joint="curve")
        nl = rnd.randint(9, 14)
        for i in range(nl):
            k = int(8 + (len(pts) - 14) * i / nl)
            (xa, ya), (xb, yb) = pts[k], pts[k + 3]
            tang = math.atan2(yb - ya, xb - xa)
            side = 1 if i % 2 == 0 else -1
            th = tang + side * rnd.uniform(0.7, 1.15)
            L = h * (0.2 - 0.09 * i / nl) * rnd.uniform(0.8, 1.15)
            wmax = L * rnd.uniform(0.2, 0.3)
            left, right = [], []
            for u in np.linspace(0, 1, 28):
                hw = wmax * math.sin(math.pi * u) ** 0.85 * (1 - 0.25 * u)
                bx, by = xa + math.cos(th) * L * u, ya + math.sin(th) * L * u - 0.15 * L * math.sin(math.pi * u) * side * 0.4
                left.append((bx - math.sin(th) * hw, by + math.cos(th) * hw))
                right.append((bx + math.sin(th) * hw, by - math.cos(th) * hw))
            outline = left + right[::-1]
            d.polygon(outline, fill=hx("#F4EFE4"))
            d.line(outline + [outline[0]], fill=ink, width=4, joint="curve")
            mid = [(a[0] / 2 + b[0] / 2, a[1] / 2 + b[1] / 2) for a, b in zip(left, right)]
            d.line(mid, fill=ink, width=3)
            for j in range(3, 25, 3):
                for sgn, edge in ((1, left), (-1, right)):
                    d.line([mid[j], (mid[j][0] * 0.35 + edge[min(j + 2, 27)][0] * 0.65, mid[j][1] * 0.35 + edge[min(j + 2, 27)][1] * 0.65)], fill=ink, width=2)
    arr = pil_to_np(im)
    arr = gaussian_filter(arr, (0.5, 0.5, 0))
    pap = rgb("#F4EFE4") * (0.96 + 0.06 * fbm(rng, base=70, octaves=3)[..., None])
    arr = np.minimum(arr, pap + 0.0) * (1 + rng.normal(0, 0.03, arr.shape))
    return np.clip(arr, 0, 1)


# ------------------------------------------------------------------ catalogue
FLUID = [
    ["#F7D6E0", "#B8E0D2", "#C9B6F2", "#FFFFFF", "#F6E3B4", "#8FB8DE"],
    ["#0B3C5D", "#1D7A8C", "#76C7C0", "#EAF6F6", "#F2C14E", "#D9534F"],
    ["#2B1B4F", "#7B2D8E", "#E4572E", "#F6A04D", "#FFE3B3", "#1C3B5A"],
    ["#0D3B2E", "#1F7A5C", "#7BC8A4", "#F2E8CF", "#C9A227", "#14213D"],
    ["#14213D", "#3A506B", "#F4C7C3", "#FFFFFF", "#E8A0BF", "#5BC0BE"],
    ["#3D2B1F", "#A5532F", "#E0A96D", "#F4E4C1", "#7D8F69", "#2F4858"],
]
LAND = [
    (["#35407A", "#9A5E9E", "#F2A07B", "#FFE2A8"], ["#8C6BA8", "#6A4F8E", "#4A3A70", "#2B2650"], "#FFF2C4", False),
    (["#6BA7E3", "#A8D3F0", "#E8F4F8"], ["#9DB8D6", "#7A9AC0", "#587CA8"], "#FFFFFF", True),
    (["#7FA6C9", "#D9C7A3", "#F0B87A"], ["#B07A4F", "#8A5A3A", "#5E3B28", "#3A2418"], "#FFE0A0", False),
    (["#B7CFC2", "#DCE8DA", "#F5F3E6"], ["#A7C1B0", "#7FA38D", "#5A8570", "#35604F"], "#FFFFFF", False),
    (["#0B1033", "#1B2A5C", "#3B5A9A"], ["#1C2B52", "#14213D", "#0B1226"], "#F4F1DE", True),
    (["#F7B2BD", "#F9D1C4", "#FDEBD0"], ["#C9879B", "#9C5F7C", "#6D3F5E"], "#FFF6E0", True),
]
KNIFE = [
    (["#E76F51", "#F4A261", "#E9C46A", "#2A9D8F", "#264653"], "#F6EDE0"),
    (["#FFB3C6", "#FF8FAB", "#C8B6FF", "#BDE0FE", "#A2D2FF"], "#FFF5F7"),
    (["#003049", "#D62828", "#F77F00", "#FCBF49", "#EAE2B7"], "#EAE2B7"),
    (["#22577A", "#38A3A5", "#57CC99", "#80ED99", "#C7F9CC"], "#F4FFF8"),
    (["#6D597A", "#B56576", "#E56B6F", "#EAAC8B", "#355070"], "#F8EDEB"),
    (["#0B132B", "#1C2541", "#3A506B", "#5BC0BE", "#F4F1DE"], "#F4F1DE"),
]
WALL = [
    ("#F4E9DA", ["#D98E6B", "#B65D4A", "#E9C9B0", "#7C8B6F", "#3F4A3C"]),
    ("#F7EFE6", ["#E8B4A0", "#C97B63", "#9FB8A5", "#6B8F7B", "#F0D9B5"]),
    ("#EEF3F0", ["#A8C3B4", "#F2C6C2", "#E8D5A9", "#7E9C8F", "#D8A48F"]),
    ("#FBF1E4", ["#F2A65A", "#E76F51", "#264653", "#E9C46A", "#2A9D8F"]),
    ("#F3ECF7", ["#C8B6E2", "#F4B6C2", "#9ED8DB", "#FBE7A1", "#6C5B7B"]),
    ("#F6EBDD", ["#CC7A5C", "#8C4A3B", "#DDB892", "#556B5A", "#2F3E36"]),
]
MESH = [
    ("#0E0B1F", ["#FF4D8D", "#7B4DFF", "#22D3EE", "#FF9F43"], False),
    ("#071A2B", ["#22D3EE", "#3B82F6", "#A78BFA", "#34D399"], False),
    ("#1A0B14", ["#FB7185", "#F59E0B", "#C026D3", "#6366F1"], False),
    ("#FBF7FF", ["#FFC8DD", "#BDE0FE", "#CDB4DB", "#FFE5A5"], True),
    ("#F5FBFF", ["#A2D2FF", "#FFAFCC", "#CDEAC0", "#E4C1F9"], True),
    ("#FFF7F2", ["#FFD6A5", "#FFADAD", "#CAFFBF", "#9BF6FF"], True),
]
SYNTH = [
    (["#1B0B3A", "#5B1A8B", "#E84A9B", "#FFB36B"], ["#FFE45E", "#FF3D81"], "#38E8FF", "#1A0A38"),
    (["#0B1B3F", "#2E3C9B", "#7B5CFF", "#FF9AD5"], ["#FFD166", "#EF476F"], "#5CE1E6", "#120A33"),
    (["#12063A", "#7A1FA2", "#FF5E7E", "#FFC470"], ["#FFF07C", "#FF5C8A"], "#FF8AF2", "#1C0B3B"),
    (["#021B3A", "#0B5AA2", "#2BB3C0", "#C8F2E6"], ["#FFF1A8", "#FF8FAB"], "#B0FFF1", "#06223F"),
    (["#220A38", "#8E2B8F", "#FF6F61", "#FFD9A0"], ["#FFE066", "#FF6B6B"], "#7DF9FF", "#210A35"),
    (["#10092E", "#3F2B96", "#A8C0FF", "#FFD6EC"], ["#FFE6A7", "#FF8CC6"], "#9AF0FF", "#150B38"),
]
FLOW = [
    ("#07060F", ["#FF4D8D", "#FFB86B", "#7B4DFF"]),
    ("#05121C", ["#22D3EE", "#7DF9C5", "#3B82F6"]),
    ("#120714", ["#F472B6", "#C084FC", "#FDE68A"]),
    ("#0A0F0B", ["#86EFAC", "#FDE047", "#34D399"]),
    ("#0B0A1E", ["#A5B4FC", "#F0ABFC", "#67E8F9"]),
    ("#14080A", ["#FB923C", "#F43F5E", "#FDE68A"]),
]

CATS = {
    "painting": lambda i: (
        fluid(100 + i, FLUID[i % 6]) if i < 6 else
        landscape(200 + i, *LAND[i % 6]) if i < 12 else
        knife(300 + i, *KNIFE[i % 6])),
    "wall-art": lambda i: (
        arches(400 + i, *WALL[i % 6]) if i < 6 else
        sun_waves(500 + i, *WALL[i % 6]) if i < 12 else
        organic(600 + i, *WALL[i % 6])),
    "digital": lambda i: (
        mesh(700 + i, *MESH[i % 6]) if i < 6 else
        synth(800 + i, *SYNTH[i % 6]) if i < 12 else
        flow(900 + i, *FLOW[i % 6])),
    "sketch": lambda i: (
        sketch_landscape(1000 + i, i) if i < 6 else
        still_life(1100 + i) if i < 12 else
        botanical(1200 + i)),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--category", choices=list(CATS))
    ap.add_argument("--indices", default="0-17", help="ex: 0-17 ou 0,6,12")
    a = ap.parse_args()
    if "-" in a.indices:
        lo, hi = a.indices.split("-")
        idx = range(int(lo), int(hi) + 1)
    else:
        idx = [int(x) for x in a.indices.split(",")]
    for i in idx:
        save(CATS[a.category](i), os.path.join(a.out, a.category, f"{a.category}-{i + 1:02d}.jpg"))
        print(a.category, i + 1, flush=True)


if __name__ == "__main__":
    main()
