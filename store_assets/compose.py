"""Compose Play Store screenshots (phone 1080x1920, tablet 1440x2560) from raw app captures."""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = "/app/store_assets"
FONT = f"{ROOT}/fonts"
SCREENS = [
    ("discover", "Find Your Perfect Match", "Verified profiles, real people near you"),
    ("likes", "See Who Likes You", "Super likes & likes, all in one place"),
    ("chat", "Chats That Feel Real", "Typing indicators, photos & read receipts"),
    ("matches", "Match With The Right One", "Compatibility score on every match"),
    ("crush", "Secret Crush", "Someone has a crush on you. Find out who"),
    ("views", "Who Viewed Your Profile", "Know who is checking you out"),
    ("profile", "Safe & Verified", "Selfie verification and women-safety tools"),
]
C1, C2 = (219, 39, 119), (234, 88, 12)  # pink -> orange (brand)


def gradient(w, h):
    g = Image.new("RGB", (w, h))
    px = g.load()
    for y in range(h):
        for x in range(0, w):
            t = min(1.0, max(0.0, (0.75 * y / h) + (0.25 * x / w)))
            px[x, y] = tuple(int(C1[i] + (C2[i] - C1[i]) * t) for i in range(3))
    return g


def decorate(bg):
    w, h = bg.size
    layer = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for cx, cy, r, a in [(0.92, 0.08, 0.28, 34), (0.05, 0.42, 0.22, 26), (0.85, 0.7, 0.35, 22)]:
        R = int(r * w)
        d.ellipse([cx * w - R, cy * h - R, cx * w + R, cy * h + R], fill=(255, 255, 255, a))
    layer = layer.filter(ImageFilter.GaussianBlur(w // 40))
    return Image.alpha_composite(bg.convert("RGBA"), layer)


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0], img.size[1]], radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def device(shot, inner_w, bezel, radius):
    s = shot.convert("RGB")
    inner_h = int(s.height * inner_w / s.width)
    s = s.resize((inner_w, inner_h), Image.LANCZOS)
    body = Image.new("RGBA", (inner_w + 2 * bezel, inner_h + 2 * bezel), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle([0, 0, body.width - 1, body.height - 1], radius + bezel, fill=(18, 18, 22, 255))
    body.alpha_composite(rounded(s, radius), (bezel, bezel))
    return body


def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        trial = (cur + " " + wd).strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = wd
    return lines + [cur]


def compose(kind, W, H, raw_dir, out_dir, inner_ratio, title_px, sub_px):
    os.makedirs(out_dir, exist_ok=True)
    base_bg = decorate(gradient(W, H))
    title_f = ImageFont.truetype(f"{FONT}/Poppins-Bold.ttf", title_px)
    sub_f = ImageFont.truetype(f"{FONT}/Poppins-Regular.ttf", sub_px)
    brand_f = ImageFont.truetype(f"{FONT}/Poppins-SemiBold.ttf", int(sub_px * 0.85))
    for i, (name, title, sub) in enumerate(SCREENS, 1):
        canvas = base_bg.copy()
        d = ImageDraw.Draw(canvas)
        y = int(H * 0.055)
        d.text((W // 2, y), "HeartLink", font=brand_f, fill=(255, 255, 255, 210), anchor="mt")
        y += int(sub_px * 1.9)
        for line in wrap(d, title, title_f, W * 0.86):
            d.text((W // 2, y), line, font=title_f, fill="white", anchor="mt")
            y += int(title_px * 1.15)
        y += int(sub_px * 0.3)
        for line in wrap(d, sub, sub_f, W * 0.82):
            d.text((W // 2, y), line, font=sub_f, fill=(255, 240, 245), anchor="mt")
            y += int(sub_px * 1.35)
        inner_w = int(W * inner_ratio)
        dev = device(Image.open(f"{raw_dir}/{name}.png"), inner_w, bezel=int(W * 0.018), radius=int(W * 0.045))
        top = y + int(H * 0.035)
        shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle(
            [(W - dev.width) // 2 + 10, top + 30, (W + dev.width) // 2 + 10, top + dev.height + 30], int(W * 0.06), fill=(60, 0, 20, 120))
        canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(W // 45)))
        canvas.alpha_composite(dev, ((W - dev.width) // 2, top))
        canvas = canvas.crop((0, 0, W, H)).convert("RGB")
        path = f"{out_dir}/{kind}_{i:02d}_{name}.png"
        canvas.save(path, optimize=True)
        print(path, canvas.size)


compose("phone", 1080, 1920, f"{ROOT}/raw/phone", f"{ROOT}/final/phone", 0.74, 84, 40)
compose("tablet", 1440, 2560, f"{ROOT}/raw/tablet", f"{ROOT}/final/tablet", 0.74, 108, 50)
