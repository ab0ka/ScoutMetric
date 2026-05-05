from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)


def pick_font(size):
    candidates = [
        "arial.ttf",
        "segoeui.ttf",
        "tahoma.ttf",
    ]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


font_title = pick_font(56)
font_text = pick_font(30)
font_small = pick_font(24)


def box(x1, y1, x2, y2, text, fill, outline=(60, 60, 60)):
    d.rounded_rectangle((x1, y1, x2, y2), radius=16, fill=fill, outline=outline, width=3)
    lines = text.split("\n")
    line_h = 38
    total_h = line_h * len(lines)
    y = y1 + ((y2 - y1 - total_h) // 2)
    for line in lines:
        tw = d.textlength(line, font=font_text)
        x = x1 + ((x2 - x1 - tw) // 2)
        d.text((x, y), line, fill=(20, 20, 20), font=font_text)
        y += line_h


def arrow(x1, y1, x2, y2, color=(70, 70, 70), w=4):
    d.line((x1, y1, x2, y2), fill=color, width=w)
    ah = 12
    if x1 == x2:
        if y2 > y1:
            p = [(x2, y2), (x2 - ah, y2 - ah), (x2 + ah, y2 - ah)]
        else:
            p = [(x2, y2), (x2 - ah, y2 + ah), (x2 + ah, y2 + ah)]
    else:
        if x2 > x1:
            p = [(x2, y2), (x2 - ah, y2 - ah), (x2 - ah, y2 + ah)]
        else:
            p = [(x2, y2), (x2 + ah, y2 - ah), (x2 + ah, y2 + ah)]
    d.polygon(p, fill=color)

# Title
d.text((52, 34), "ScoutMetric Architecture", fill=(10, 10, 10), font=font_title)

# Blocks
box(760, 110, 1160, 220, "Users", (230, 230, 230))
box(180, 290, 820, 480, "Frontend Web\nindex.html + js/app.js", (220, 235, 255))
box(1100, 290, 1740, 480, "Frontend Mobile\nApp.js + screens", (220, 235, 255))
box(520, 560, 1400, 760, "Backend Flask\nAPI + business logic + aggregations", (220, 245, 225))
box(180, 820, 820, 1030, "AI Layer\nai_chat.py + ai_models.py\nchat tools + fallback", (255, 245, 210))
box(1100, 820, 1740, 1030, "Data Layer\nCSV + JSON datasets", (245, 230, 255))

# Arrows
arrow(960, 220, 500, 290)
arrow(960, 220, 1420, 290)
arrow(500, 480, 830, 560)
arrow(1420, 480, 1090, 560)
arrow(830, 760, 500, 820)
arrow(1090, 760, 1420, 820)
arrow(820, 925, 1100, 925)

# Labels
d.text((620, 510), "HTTP /api", fill=(60, 60, 60), font=font_small)
d.text((1160, 510), "HTTP /api", fill=(60, 60, 60), font=font_small)
d.text((900, 875), "data access", fill=(60, 60, 60), font=font_small)

out = "architecture_slide.jpg"
img.save(out, format="JPEG", quality=95)
print(f"saved: {out}")
