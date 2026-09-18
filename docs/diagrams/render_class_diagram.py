from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "diagrams" / "png"
OUT.mkdir(parents=True, exist_ok=True)

SCALE = 2
W, H = 2100, 1500
INK = "#1B1F23"
BLUE = "#4A90C2"
HEADER = "#DCEEFF"
BODY = "#F8FCFF"
PAPER = "#FFFFFF"


def s(value):
    return int(round(value * SCALE))


def box_s(box):
    return tuple(s(value) for value in box)


def font(size, bold=False, italic=False):
    if bold and italic:
        filename = "arialbi.ttf"
    elif bold:
        filename = "arialbd.ttf"
    elif italic:
        filename = "ariali.ttf"
    else:
        filename = "arial.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / filename), s(size))


def text(draw, xy, value, size=14, bold=False, italic=False, fill=INK, anchor=None):
    draw.text(
        (s(xy[0]), s(xy[1])),
        value,
        font=font(size, bold=bold, italic=italic),
        fill=fill,
        anchor=anchor,
    )


def line(draw, points, fill=INK, width=1):
    scaled = tuple(s(value) for point in points for value in point)
    draw.line(scaled, fill=fill, width=s(width), joint="curve")


def dashed_segment(draw, start, end, width=1, dash=7, gap=5):
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    length = max(1.0, (dx * dx + dy * dy) ** 0.5)
    distance = 0.0
    while distance < length:
        dash_end = min(length, distance + dash)
        a = distance / length
        b = dash_end / length
        line(
            draw,
            (
                (x1 + dx * a, y1 + dy * a),
                (x1 + dx * b, y1 + dy * b),
            ),
            width=width,
        )
        distance += dash + gap


def dashed_polyline(draw, points, width=1):
    for start, end in zip(points, points[1:]):
        dashed_segment(draw, start, end, width=width)


def polygon(draw, points, fill=PAPER, outline=INK, width=1):
    scaled = [(s(x), s(y)) for x, y in points]
    draw.polygon(scaled, fill=fill)
    draw.line(scaled + [scaled[0]], fill=outline, width=s(width), joint="curve")


def label(draw, x, y, value, size=12, bold=False):
    label_font = font(size, bold=bold)
    bounds = draw.textbbox((s(x), s(y)), value, font=label_font, anchor="mm")
    draw.rectangle(
        (
            bounds[0] - s(4),
            bounds[1] - s(2),
            bounds[2] + s(4),
            bounds[3] + s(2),
        ),
        fill=PAPER,
    )
    draw.text(
        (s(x), s(y)),
        value,
        font=label_font,
        fill=INK,
        anchor="mm",
    )


def class_box(draw, x, y, w, name, attributes, operations):
    header_h = 46
    attr_h = max(28, 14 + 23 * len(attributes))
    op_h = 0 if not operations else 14 + 23 * len(operations)
    h = header_h + attr_h + op_h

    draw.rectangle(box_s((x, y, x + w, y + h)), fill=BODY, outline=BLUE, width=s(2))
    draw.rectangle(
        box_s((x, y, x + w, y + header_h)),
        fill=HEADER,
        outline=BLUE,
        width=s(2),
    )
    text(draw, (x + w / 2, y + header_h / 2), name, 16, bold=True, anchor="mm")

    attr_top = y + header_h
    for index, attribute in enumerate(attributes):
        text(draw, (x + 12, attr_top + 10 + index * 23), attribute, 13)

    if operations:
        divider_y = attr_top + attr_h
        line(draw, ((x, divider_y), (x + w, divider_y)), fill=BLUE, width=1)
        for index, operation in enumerate(operations):
            text(draw, (x + 12, divider_y + 10 + index * 23), operation, 13)

    return (x, y, x + w, y + h)


def enum_box(draw, x, y, w, name, literals):
    header_h = 64
    body_h = 14 + len(literals) * 23
    h = header_h + body_h
    draw.rectangle(box_s((x, y, x + w, y + h)), fill=BODY, outline=BLUE, width=s(2))
    draw.rectangle(
        box_s((x, y, x + w, y + header_h)),
        fill=HEADER,
        outline=BLUE,
        width=s(2),
    )
    text(draw, (x + w / 2, y + 17), "«enumeration»", 12, italic=True, anchor="mm")
    text(draw, (x + w / 2, y + 43), name, 15, bold=True, anchor="mm")
    for index, literal in enumerate(literals):
        text(draw, (x + 12, y + header_h + 10 + index * 23), literal, 13)
    return (x, y, x + w, y + h)


def generalization(draw, child_box, parent_box, target_x, corridor_y):
    child_x = (child_box[0] + child_box[2]) / 2
    child_y = child_box[1]
    parent_y = parent_box[3]
    triangle_base_y = parent_y + 17

    line(
        draw,
        (
            (child_x, child_y),
            (child_x, corridor_y),
            (target_x, corridor_y),
            (target_x, triangle_base_y),
        ),
        width=2,
    )
    polygon(
        draw,
        (
            (target_x, parent_y),
            (target_x - 12, triangle_base_y),
            (target_x + 12, triangle_base_y),
        ),
        fill=PAPER,
        outline=INK,
        width=2,
    )


def association(
    draw,
    points,
    relation_name,
    name_xy,
    source_multiplicity,
    source_xy,
    target_multiplicity,
    target_xy,
):
    line(draw, points, width=1)
    label(draw, name_xy[0], name_xy[1], relation_name, size=12)
    label(draw, source_xy[0], source_xy[1], source_multiplicity, size=11)
    label(draw, target_xy[0], target_xy[1], target_multiplicity, size=11)


def composition(draw, points, relation_name, name_xy, composite_xy, target_xy):
    line(draw, points, width=1)
    cx, cy = composite_xy
    diamond = ((cx, cy), (cx - 9, cy + 7), (cx, cy + 14), (cx + 9, cy + 7))
    polygon(draw, diamond, fill=INK, outline=INK, width=1)
    label(draw, name_xy[0], name_xy[1], relation_name, size=11)
    label(draw, cx + 20, cy + 8, "1", size=10)
    label(draw, target_xy[0], target_xy[1], "0..*", size=10)


def dependency(draw, points):
    """UML type dependency with a dashed line and open arrowhead."""
    dashed_polyline(draw, points, width=1)
    tip_x, tip_y = points[-1]
    line(draw, ((tip_x - 8, tip_y - 11), (tip_x, tip_y)), width=1)
    line(draw, ((tip_x + 8, tip_y - 11), (tip_x, tip_y)), width=1)


def main():
    image = Image.new("RGB", (s(W), s(H)), PAPER)
    draw = ImageDraw.Draw(image)
    text(
        draw,
        (W / 2, 28),
        "Diagramme de classes — Plateforme de recrutement",
        24,
        bold=True,
        anchor="mm",
    )

    user = class_box(
        draw,
        790,
        65,
        520,
        "User",
        [
            "− _id : ObjectId",
            "− name : String",
            "− email : String {unique}",
            "− passwordHash : String",
            "− role : String",
            "− profileImage : String",
            "− createdAt : Date",
            "− updatedAt : Date",
        ],
        [
            "+ sAuthentifier(email : String, password : String) : Boolean",
            "+ mettreAJourProfil() : void",
        ],
    )

    admin = class_box(
        draw,
        70,
        470,
        410,
        "Admin",
        [],
        [
            "+ gererUtilisateurs() : void",
            "+ creerCompteRecruteur() : void",
            "+ supprimerUtilisateur() : void",
            "+ superviserOffresEtEntretiens() : void",
        ],
    )
    candidat = class_box(
        draw,
        650,
        455,
        500,
        "Candidat",
        ["− cv : String"],
        [
            "+ televerserCV() : void",
            "+ consulterOffres() : Job[]",
            "+ postuler(job : Job) : Application",
            "+ participerEntretien(interview : Interview) : void",
            "+ passerQuiz() : void",
            "+ consulterRapportQuiz() : void",
        ],
    )
    recruteur = class_box(
        draw,
        1400,
        445,
        530,
        "Recruteur",
        [
            "− googleCalendarConnected : Boolean",
            "− googleCalendarEmail : String",
        ],
        [
            "+ publierOffre(job : Job) : void",
            "+ gererOffres() : void",
            "+ traiterCandidature(application : Application) : void",
            "+ planifierEntretien() : Interview",
            "+ menerEntretien(interview : Interview) : void",
            "+ genererQuizIA(interview : Interview) : void",
        ],
    )

    cv_info = class_box(
        draw,
        35,
        900,
        430,
        "CVInfo",
        [
            "− _id : ObjectId",
            "− fullName : String",
            "− email : String",
            "− phone : String",
            "− linkedIn : String",
            "− github : String",
            "− portfolio : String",
            "− summary : String",
            "− skills : String[]",
            "− languages : String[]",
            "− certifications : String[]",
            "− rawText : String",
        ],
        [],
    )
    application = class_box(
        draw,
        535,
        935,
        390,
        "Application",
        [
            "− _id : ObjectId",
            "− status : ApplicationStatus",
            "− createdAt : Date",
            "− updatedAt : Date",
        ],
        [
            "+ accepter() : void",
            "+ refuser() : void",
        ],
    )
    job = class_box(
        draw,
        1000,
        885,
        450,
        "Job",
        [
            "− _id : ObjectId",
            "− title : String",
            "− position : String",
            "− description : String",
            "− requiredSkills : String[]",
            "− experienceLevel : ExperienceLevel",
            "− minExperienceYears : Number",
            "− location : String",
            "− status : JobStatus",
            "− createdAt : Date",
        ],
        [
            "+ ouvrir() : void",
            "+ cloturer() : void",
        ],
    )
    interview = class_box(
        draw,
        1540,
        900,
        460,
        "Interview",
        [
            "− _id : ObjectId",
            "− title : String",
            "− scheduledAt : Date",
            "− status : InterviewStatus",
            "− googleCalendarEventId : String",
            "− googleCalendarHtmlLink : String",
            "− createdAt : Date",
            "− updatedAt : Date",
        ],
        [
            "+ demarrer() : void",
            "+ terminer() : void",
        ],
    )

    education = class_box(
        draw,
        20,
        1300,
        290,
        "Education",
        [
            "− institution : String",
            "− degree : String",
            "− field : String",
            "− startYear : String",
            "− endYear : String",
        ],
        [],
    )
    experience = class_box(
        draw,
        335,
        1300,
        350,
        "Experience",
        [
            "− company : String",
            "− title : String",
            "− startDate : String",
            "− endDate : String",
            "− description : String",
        ],
        [],
    )

    application_status = enum_box(
        draw,
        720,
        1290,
        250,
        "ApplicationStatus",
        ["pending", "accepted", "rejected"],
    )
    experience_level = enum_box(
        draw,
        1000,
        1290,
        230,
        "ExperienceLevel",
        ["intern", "junior", "mid", "senior"],
    )
    job_status = enum_box(
        draw,
        1260,
        1290,
        210,
        "JobStatus",
        ["open", "closed"],
    )
    interview_status = enum_box(
        draw,
        1580,
        1290,
        260,
        "InterviewStatus",
        ["pending", "ongoing", "finished"],
    )

    # Relations are drawn after boxes only where they occupy dedicated whitespace.
    # Generalization is the only relation with an arrowhead.
    generalization(draw, admin, user, 900, 415)
    generalization(draw, candidat, user, 1050, 425)
    generalization(draw, recruteur, user, 1200, 435)

    association(
        draw,
        (
            (730, candidat[3]),
            (730, 790),
            (250, 790),
            (250, cv_info[1]),
        ),
        "possède",
        (490, 777),
        "1",
        (715, candidat[3] + 15),
        "0..1",
        (275, cv_info[1] - 12),
    )
    association(
        draw,
        (
            (870, candidat[3]),
            (870, 825),
            (730, 825),
            (730, application[1]),
        ),
        "soumet",
        (800, 812),
        "1",
        (855, candidat[3] + 15),
        "0..*",
        (755, application[1] - 12),
    )
    association(
        draw,
        (
            (1510, recruteur[3]),
            (1510, 805),
            (1225, 805),
            (1225, job[1]),
        ),
        "publie",
        (1365, 792),
        "1",
        (1495, recruteur[3] + 15),
        "0..*",
        (1250, job[1] - 12),
    )
    association(
        draw,
        (
            (1580, recruteur[3]),
            (1580, 850),
            (880, 850),
            (880, application[1]),
        ),
        "traite",
        (1230, 837),
        "1",
        (1565, recruteur[3] + 15),
        "0..*",
        (900, application[1] - 12),
    )
    association(
        draw,
        (
            (1770, recruteur[3]),
            (1770, interview[1]),
        ),
        "planifie",
        (1815, 820),
        "1",
        (1755, recruteur[3] + 15),
        "0..*",
        (1795, interview[1] - 12),
    )
    association(
        draw,
        (
            (1080, candidat[1]),
            (1080, 420),
            (2040, 420),
            (2040, 1040),
            (interview[2], 1040),
        ),
        "participe",
        (1820, 407),
        "1",
        (1065, candidat[1] - 14),
        "0..*",
        (interview[2] + 22, 1025),
    )
    association(
        draw,
        (
            (application[2], 1035),
            (job[0], 1035),
        ),
        "reçoit",
        (962, 1021),
        "0..*",
        (application[2] + 19, 1020),
        "1",
        (job[0] - 15, 1020),
    )
    association(
        draw,
        (
            (job[2], 1115),
            (interview[0], 1115),
        ),
        "concerne",
        (1495, 1133),
        "1",
        (job[2] + 16, 1098),
        "0..*",
        (interview[0] - 21, 1098),
    )

    composition(
        draw,
        (
            (155, cv_info[3]),
            (155, education[1]),
        ),
        "contient",
        (110, 1260),
        (155, cv_info[3]),
        (180, education[1] - 12),
    )
    composition(
        draw,
        (
            (375, cv_info[3]),
            (375, 1265),
            (510, 1265),
            (510, experience[1]),
        ),
        "contient",
        (450, 1252),
        (375, cv_info[3]),
        (535, experience[1] - 12),
    )

    # Explicit type dependencies connect every typed status attribute to its enum.
    dependency(
        draw,
        (
            (835, application[3]),
            (835, application_status[1]),
        ),
    )
    dependency(
        draw,
        (
            (1115, job[3]),
            (1115, experience_level[1]),
        ),
    )
    dependency(
        draw,
        (
            (1365, job[3]),
            (1365, job_status[1]),
        ),
    )
    dependency(
        draw,
        (
            (1710, interview[3]),
            (1710, interview_status[1]),
        ),
    )

    # Restore crisp antialiasing after drawing at 2× resolution.
    image = image.resize((W, H), Image.Resampling.LANCZOS)
    for filename in (
        "diagramme_classes.png",
        "diagramme_classes_corrige.png",
        "diagramme_classes_staruml.png",
    ):
        image.save(OUT / filename, optimize=True)


if __name__ == "__main__":
    main()
