from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "diagrams" / "png"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1940, 1320
INK = "#111111"
PAPER = "#FFFFFF"


def font(size, bold=False):
    filename = "arialbd.ttf" if bold else "arial.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / filename), size)


def centered_text(draw, box, text, text_font):
    lines = text.split("\n")
    heights = []
    widths = []
    for line in lines:
        bounds = draw.textbbox((0, 0), line, font=text_font)
        widths.append(bounds[2] - bounds[0])
        heights.append(bounds[3] - bounds[1])

    line_gap = 2
    total_height = sum(heights) + line_gap * max(0, len(lines) - 1)
    y = box[1] + (box[3] - box[1] - total_height) / 2
    for line, line_width, line_height in zip(lines, widths, heights):
        x = box[0] + (box[2] - box[0] - line_width) / 2
        draw.text((x, y), line, font=text_font, fill=INK)
        y += line_height + line_gap


def actor(draw, x, y, label):
    # Standard monochrome UML actor, matching a classic StarUML export.
    draw.ellipse((x - 14, y - 44, x + 14, y - 16), outline=INK, width=2)
    draw.line((x, y - 16, x, y + 34), fill=INK, width=2)
    draw.line((x - 23, y + 1, x + 23, y + 1), fill=INK, width=2)
    draw.line((x, y + 34, x - 20, y + 65), fill=INK, width=2)
    draw.line((x, y + 34, x + 20, y + 65), fill=INK, width=2)

    label_font = font(15)
    bounds = draw.textbbox((0, 0), label, font=label_font)
    draw.text(
        (x - (bounds[2] - bounds[0]) / 2, y + 76),
        label,
        font=label_font,
        fill=INK,
    )


def usecase(draw, x, y, label, w=240, h=54):
    box = (x, y, x + w, y + h)
    draw.ellipse(box, fill=PAPER, outline=INK, width=2)
    centered_text(draw, box, label, font(14))
    return box


def solid_polyline(draw, points, width=1):
    draw.line(points, fill=INK, width=width, joint="curve")


def dashed_segment(draw, x1, y1, x2, y2, width=1, dash=8, gap=6):
    dx = x2 - x1
    dy = y2 - y1
    length = max(1.0, (dx * dx + dy * dy) ** 0.5)
    distance = 0.0
    while distance < length:
        end = min(length, distance + dash)
        a = distance / length
        b = end / length
        draw.line(
            (
                x1 + dx * a,
                y1 + dy * a,
                x1 + dx * b,
                y1 + dy * b,
            ),
            fill=INK,
            width=width,
        )
        distance += dash + gap


def open_arrow(draw, tip_x, tip_y, size=12):
    draw.line((tip_x - size, tip_y - 7, tip_x, tip_y), fill=INK, width=1)
    draw.line((tip_x - size, tip_y + 7, tip_x, tip_y), fill=INK, width=1)


def association_group(draw, actor_x, actor_y, boxes, lane_x=220):
    """Route every association separately through a narrow left-side corridor."""
    count = len(boxes)
    for index, box in enumerate(boxes):
        center_y = (box[1] + box[3]) / 2
        start_y = actor_y + (index - (count - 1) / 2) * 3
        route_x = lane_x + index * 4
        solid_polyline(
            draw,
            (
                actor_x,
                start_y,
                route_x,
                start_y,
                route_x,
                center_y,
                box[0],
                center_y,
            ),
        )


def include_group(draw, boxes, rail_x):
    """Draw protected-use-case includes in an unobstructed right corridor."""
    relation_font = font(11)
    centers = []
    for box in boxes:
        center_y = (box[1] + box[3]) / 2
        centers.append(center_y)
        dashed_segment(draw, box[2], center_y, rail_x, center_y)

        label = "«include»"
        bounds = draw.textbbox((0, 0), label, font=relation_font)
        label_width = bounds[2] - bounds[0]
        label_x = rail_x - label_width - 8
        label_y = center_y - 17
        # StarUML-style relation label with a white knockout behind the text.
        draw.rectangle(
            (
                label_x - 2,
                label_y - 1,
                label_x + label_width + 2,
                label_y + 14,
            ),
            fill=PAPER,
        )
        draw.text((label_x, label_y), label, font=relation_font, fill=INK)

    dashed_segment(draw, rail_x, min(centers), rail_x, max(centers), width=1)


def main():
    image = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(image)

    title = "Diagramme de cas d'utilisation global — STB Recruitment"
    draw.text((W / 2, 17), title, anchor="ma", font=font(22), fill=INK)

    boundary = (205, 47, 1895, 1285)
    draw.rectangle(boundary, outline=INK, width=2)
    draw.text(
        (boundary[0] + 15, boundary[1] + 10),
        "Plateforme de recrutement",
        font=font(17),
        fill=INK,
    )

    # Four independent actors: no generic Utilisateur and no inheritance.
    actor(draw, 90, 120, "Visiteur")
    actor(draw, 90, 340, "Candidat inscrit")
    actor(draw, 90, 730, "Recruteur")
    actor(draw, 90, 1095, "Administrateur")

    register = usecase(draw, 310, 100, "S'inscrire")
    solid_polyline(
        draw,
        (
            120,
            140,
            245,
            140,
            245,
            (register[1] + register[3]) / 2,
            register[0],
            (register[1] + register[3]) / 2,
        ),
    )

    # Use cases are deliberately staggered instead of stacked in one column.
    candidate_specs = [
        (310, 190, "Gérer son profil"),
        (620, 230, "Téléverser son CV"),
        (930, 270, "Consulter les\noffres d'emploi"),
        (1170, 310, "Postuler à une offre"),
        (390, 350, "Consulter ses\nentretiens"),
        (700, 390, "Participer à un\nentretien"),
        (1010, 430, "Passer le quiz\nd'évaluation"),
        (500, 470, "Consulter son\nrapport de quiz"),
        (810, 510, "Obtenir des conseils\nde préparation (IA)"),
    ]
    candidate = [usecase(draw, x, y, label) for x, y, label in candidate_specs]
    association_group(draw, 120, 370, candidate)

    recruiter_specs = [
        (310, 610, "Gérer son profil"),
        (620, 650, "Publier une offre\nd'emploi"),
        (930, 690, "Gérer ses offres"),
        (1170, 730, "Consulter les\ncandidatures reçues"),
        (390, 770, "Consulter le profil\nd'un candidat"),
        (700, 810, "Accepter la\ncandidature"),
        (1010, 850, "Refuser la\ncandidature"),
        (1190, 890, "Planifier un\nentretien"),
        (500, 930, "Mener un entretien\nen ligne"),
        (810, 970, "Générer un quiz\npar IA"),
    ]
    recruiter = [usecase(draw, x, y, label) for x, y, label in recruiter_specs]
    association_group(draw, 120, 760, recruiter)

    admin_specs = [
        (310, 1080, "Gérer son profil"),
        (620, 1120, "Gérer les\nutilisateurs"),
        (930, 1160, "Créer un compte\nrecruteur"),
        (1170, 1200, "Gérer les offres\net entretiens"),
    ]
    admin = [usecase(draw, x, y, label) for x, y, label in admin_specs]
    association_group(draw, 120, 1125, admin)

    # Authentication is kept as the single shared use case on the right.
    protected = candidate + recruiter + admin
    auth_rail_x = 1515
    include_group(draw, protected, auth_rail_x)

    auth = usecase(draw, 1600, 570, "S'authentifier", w=250, h=64)
    auth_center_y = (auth[1] + auth[3]) / 2
    dashed_segment(draw, auth_rail_x, auth_center_y, auth[0], auth_center_y)
    open_arrow(draw, auth[0], auth_center_y)

    for filename in (
        "diagramme_cas_utilisation.png",
        "diagramme_cas_utilisation_global.png",
        "diagramme_cas_utilisation_global_staruml.png",
    ):
        image.save(OUT / filename, optimize=True)


if __name__ == "__main__":
    main()
