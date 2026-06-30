from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


OUTPUT = "output/pdf/作业答题卡-15选6填1算8大.pdf"
CHOICE_COUNT = 15
FILL_COUNT = 6
CALCULATION_COUNT = 1
LONG_ANSWER_COUNT = 8
WIDTH, HEIGHT = A4
MARGIN_X = 42
MARGIN_TOP = 38
MARGIN_BOTTOM = 36


FONT_NAME = "AnswerSheetChinese"
FONT_PATHS = [
    "/System/Library/AssetsV2/com_apple_MobileAsset_Font7/eb257c12d1a51c8c661b89f30eec56cacf9b8987.asset/AssetData/STHEITI.ttf",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
]


def register_font():
    for font_path in FONT_PATHS:
        try:
            pdfmetrics.registerFont(TTFont(FONT_NAME, font_path))
            return
        except Exception:
            continue
    raise RuntimeError("No usable Chinese font found for answer sheet PDF.")


register_font()


def set_font(c, size=10):
    c.setFont(FONT_NAME, size)


def draw_title(c, subtitle):
    set_font(c, 22)
    c.setFillColor(colors.HexColor("#111827"))
    c.drawCentredString(WIDTH / 2, HEIGHT - MARGIN_TOP, "通用作业答题卡")
    set_font(c, 9)
    c.setFillColor(colors.HexColor("#6B7280"))
    c.drawCentredString(WIDTH / 2, HEIGHT - MARGIN_TOP - 20, subtitle)
    c.setFillColor(colors.black)


def draw_footer(c, page, total):
    set_font(c, 8)
    c.setFillColor(colors.HexColor("#9CA3AF"))
    c.drawCentredString(WIDTH / 2, 18, f"第 {page} / {total} 页")
    c.setFillColor(colors.black)


def rounded_box(c, x, y, w, h, stroke="#CBD5E1", fill=None, radius=7):
    c.setStrokeColor(colors.HexColor(stroke))
    c.setLineWidth(0.8)
    if fill:
        c.setFillColor(colors.HexColor(fill))
        c.roundRect(x, y, w, h, radius, stroke=1, fill=1)
        c.setFillColor(colors.black)
    else:
        c.roundRect(x, y, w, h, radius, stroke=1, fill=0)


def label_line(c, label, x, y, w):
    set_font(c, 10)
    c.setFillColor(colors.HexColor("#374151"))
    c.drawString(x, y + 3, label)
    c.setStrokeColor(colors.HexColor("#94A3B8"))
    c.setLineWidth(0.7)
    c.line(x + 45, y, x + w, y)
    c.setFillColor(colors.black)


def section_header(c, title, x, y, w):
    rounded_box(c, x, y - 18, w, 24, stroke="#DBEAFE", fill="#EFF6FF", radius=5)
    set_font(c, 12)
    c.setFillColor(colors.HexColor("#1F2937"))
    c.drawString(x + 10, y - 11, title)
    c.setFillColor(colors.black)


def draw_choice_grid(c, x, y, start, end, cols=4):
    labels = ["A", "B", "C", "D"]
    cell_w = (WIDTH - 2 * MARGIN_X) / cols
    row_h = 24
    set_font(c, 9)
    for index, number in enumerate(range(start, end + 1)):
        col = index % cols
        row = index // cols
        cx = x + col * cell_w
        cy = y - row * row_h
        c.setFillColor(colors.HexColor("#111827"))
        c.drawString(cx, cy, f"{number:02d}.")
        for option_index, option in enumerate(labels):
            ox = cx + 30 + option_index * 24
            c.setStrokeColor(colors.HexColor("#64748B"))
            c.circle(ox, cy + 3, 6, stroke=1, fill=0)
            c.setFillColor(colors.HexColor("#475569"))
            c.drawCentredString(ox, cy - 10, option)
    c.setFillColor(colors.black)


def draw_fill_lines(c, x, y, count=20):
    col_w = (WIDTH - 2 * MARGIN_X - 18) / 2
    row_h = 29
    set_font(c, 9)
    for index in range(count):
        col = index % 2
        row = index // 2
        cx = x + col * (col_w + 18)
        cy = y - row * row_h
        c.setFillColor(colors.HexColor("#111827"))
        c.drawString(cx, cy, f"{index + 1:02d}.")
        c.setStrokeColor(colors.HexColor("#94A3B8"))
        c.line(cx + 25, cy - 1, cx + col_w, cy - 1)
    c.setFillColor(colors.black)


def draw_answer_box(c, number, title, x, y, w, h):
    rounded_box(c, x, y - h, w, h, stroke="#CBD5E1", radius=6)
    set_font(c, 10)
    c.setFillColor(colors.HexColor("#111827"))
    c.drawString(x + 10, y - 18, f"第 {number} 题  {title}")
    c.setStrokeColor(colors.HexColor("#E5E7EB"))
    c.setLineWidth(0.5)
    line_y = y - 38
    while line_y > y - h + 14:
        c.line(x + 10, line_y, x + w - 10, line_y)
        line_y -= 20
    c.setFillColor(colors.black)


def page_one(c, page, total):
    draw_title(c, "选择题 15 题，填空题 6 题，计算题 1 题，大题 8 题")

    y = HEIGHT - 98
    rounded_box(c, MARGIN_X, y - 86, WIDTH - 2 * MARGIN_X, 86, stroke="#E2E8F0", radius=8)
    label_line(c, "姓名", MARGIN_X + 18, y - 26, 160)
    label_line(c, "课程", MARGIN_X + 210, y - 26, 170)
    label_line(c, "日期", MARGIN_X + 410, y - 26, 110)
    label_line(c, "作业", MARGIN_X + 18, y - 64, 502)

    section_header(c, "一、选择题（请圈出选项）", MARGIN_X, y - 116, WIDTH - 2 * MARGIN_X)
    draw_choice_grid(c, MARGIN_X + 8, y - 148, 1, CHOICE_COUNT)

    fill_y = y - 280
    section_header(c, "二、填空题（请在横线上作答）", MARGIN_X, fill_y, WIDTH - 2 * MARGIN_X)
    draw_fill_lines(c, MARGIN_X + 8, fill_y - 38, FILL_COUNT)

    calc_y = fill_y - 170
    section_header(c, "三、计算题", MARGIN_X, calc_y, WIDTH - 2 * MARGIN_X)
    draw_answer_box(c, 1, "计算题", MARGIN_X, calc_y - 38, WIDTH - 2 * MARGIN_X, 170)

    set_font(c, 8)
    c.setFillColor(colors.HexColor("#64748B"))
    c.drawString(MARGIN_X, 46, "提示：题量不足时可留空；题量超过本页时，可继续使用后续空白区域或另附纸。")
    c.setFillColor(colors.black)
    draw_footer(c, page, total)


def long_answer_page(c, page, total, start, end, per_page=4):
    draw_title(c, "大题 / 解答题答题区")
    usable_w = WIDTH - 2 * MARGIN_X
    y = HEIGHT - 92
    box_h = 332 if per_page == 2 else 158
    for i in range(start, end + 1):
        draw_answer_box(c, i, "大题 / 解答题", MARGIN_X, y, usable_w, box_h)
        y -= box_h + 16
    draw_footer(c, page, total)


def main():
    c = canvas.Canvas(OUTPUT, pagesize=A4)
    long_answers_per_page = 2
    total_pages = 1 + ((LONG_ANSWER_COUNT + long_answers_per_page - 1) // long_answers_per_page)
    page_one(c, 1, total_pages)
    c.showPage()
    page = 2
    for start in range(1, LONG_ANSWER_COUNT + 1, long_answers_per_page):
      end = min(start + long_answers_per_page - 1, LONG_ANSWER_COUNT)
      long_answer_page(c, page, total_pages, start, end, per_page=long_answers_per_page)
      if end < LONG_ANSWER_COUNT:
          c.showPage()
      page += 1
    c.save()


if __name__ == "__main__":
    main()
