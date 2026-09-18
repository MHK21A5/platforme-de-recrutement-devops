const nodemailer = require("nodemailer");
const path = require("path");

// ── Startup validation ──────────────────────────────────────────────────────
if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
  console.warn(
    "[Email] WARNING: EMAIL_USER or EMAIL_APP_PASSWORD is not set. " +
    "Interview invitation emails will not be sent."
  );
}

const LOGO_PATH = path.resolve(__dirname, "../uploads/logo.png");
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ── Transporter ────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// ── HTML template ──────────────────────────────────────────────────────────
function buildInvitationHtml({
  candidateName, recruiterName, interviewTitle,
  jobTitle, interviewDate, interviewTime, meetingLink, prepLink,
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Interview Invitation – STB Recruitment</title>
</head>
<body style="margin:0;padding:0;background-color:#0d1117;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d1117;padding:36px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(160deg,#1a2f6e 0%,#1d4ed8 55%,#2563eb 100%);border-radius:16px 16px 0 0;padding:36px 40px 30px;text-align:center;">
    <img src="cid:stb-logo" alt="STB Recruitment" width="62" height="62"
         style="display:block;margin:0 auto 14px;border-radius:12px;border:2px solid rgba(255,255,255,0.15);" />
    <div style="font-size:21px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;margin-bottom:5px;">STB Recruitment</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:0.1em;text-transform:uppercase;">Recruitment &amp; Interview Platform</div>
  </td></tr>

  <!-- TITLE -->
  <tr><td style="background:#161b22;padding:28px 40px 0;border-left:1px solid rgba(255,255,255,0.07);border-right:1px solid rgba(255,255,255,0.07);">
    <h1 style="margin:0;font-size:24px;font-weight:700;color:#f0f6fc;letter-spacing:-0.02em;">Interview Invitation</h1>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#161b22;padding:18px 40px 32px;border-left:1px solid rgba(255,255,255,0.07);border-right:1px solid rgba(255,255,255,0.07);">

    <p style="margin:0 0 6px;font-size:16px;color:#e6edf3;">Hello, <strong style="color:#f0f6fc;">${candidateName}</strong></p>
    <p style="margin:0 0 26px;font-size:14px;color:#8b949e;line-height:1.7;">
      <strong style="color:#c9d1d9;">${recruiterName}</strong> has scheduled an interview for you at
      <strong style="color:#c9d1d9;">STB Recruitment</strong>. Please review the details below and join on time.
    </p>

    <!-- Details card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:12px;margin-bottom:26px;">
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:rgba(37,99,235,0.13);border-radius:12px 12px 0 0;padding:12px 22px;">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#58a6ff;">Interview Details</span>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="36%" style="padding:11px 22px;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:top;"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#484f58;">Position</span></td>
            <td style="padding:11px 22px;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="font-size:14px;color:#e6edf3;font-weight:500;">${jobTitle}</span></td>
          </tr>
          <tr>
            <td style="padding:11px 22px;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:top;"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#484f58;">Interview</span></td>
            <td style="padding:11px 22px;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="font-size:14px;color:#e6edf3;">${interviewTitle}</span></td>
          </tr>
          <tr>
            <td style="padding:11px 22px;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:top;"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#484f58;">Recruiter</span></td>
            <td style="padding:11px 22px;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="font-size:14px;color:#e6edf3;">${recruiterName}</span></td>
          </tr>
          <tr>
            <td style="padding:11px 22px;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:top;"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#484f58;">Date</span></td>
            <td style="padding:11px 22px;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="font-size:14px;color:#e6edf3;">${interviewDate}</span></td>
          </tr>
          <tr>
            <td style="padding:11px 22px;vertical-align:top;"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#484f58;">Time</span></td>
            <td style="padding:11px 22px;"><span style="font-size:14px;color:#e6edf3;">${interviewTime}</span></td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- Primary CTA -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      <tr><td align="center">
        <a href="${meetingLink}" style="display:inline-block;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;letter-spacing:-0.01em;">
          Join Interview Room &rarr;
        </a>
      </td></tr>
    </table>

    <!-- Secondary CTA -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;">
      <tr><td align="center">
        <a href="${prepLink}" style="display:inline-block;background:transparent;color:#58a6ff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 32px;border-radius:10px;border:1px solid rgba(88,166,255,0.35);">
          Prepare for Interview
        </a>
      </td></tr>
    </table>

    <!-- Tip box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.2);border-radius:10px;padding:15px 20px;">
        <p style="margin:0;font-size:13px;color:#8b949e;line-height:1.75;">
          <strong style="color:#c9d1d9;">A few tips before your interview:</strong><br/>
          &bull;&nbsp;Join 5&ndash;10 minutes early to test your camera and microphone.<br/>
          &bull;&nbsp;Review your preparation materials using the button above.<br/>
          &bull;&nbsp;Make sure you have a stable internet connection.
        </p>
      </td></tr>
    </table>

  </td></tr>

  <!-- FALLBACK LINKS -->
  <tr><td style="background:#161b22;padding:0 40px 22px;border-left:1px solid rgba(255,255,255,0.07);border-right:1px solid rgba(255,255,255,0.07);">
    <p style="margin:0 0 4px;font-size:12px;color:#484f58;">Buttons not working? Use these direct links:</p>
    <p style="margin:0 0 2px;font-size:12px;"><span style="color:#484f58;">Interview room:&nbsp;</span><a href="${meetingLink}" style="color:#58a6ff;word-break:break-all;">${meetingLink}</a></p>
    <p style="margin:0;font-size:12px;"><span style="color:#484f58;">Prep page:&nbsp;</span><a href="${prepLink}" style="color:#58a6ff;word-break:break-all;">${prepLink}</a></p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0d1117;border:1px solid rgba(255,255,255,0.07);border-top:1px solid rgba(255,255,255,0.1);border-radius:0 0 16px 16px;padding:22px 40px;text-align:center;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#484f58;">STB Recruitment</p>
    <p style="margin:0 0 8px;font-size:12px;"><a href="mailto:${process.env.EMAIL_USER || "your_email@example.com"}" style="color:#58a6ff;text-decoration:none;">${process.env.EMAIL_USER || "your_email@example.com"}</a></p>
    <p style="margin:0;font-size:11px;color:#30363d;">This is an automated message. Please do not reply directly to this email.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Plain text fallback ────────────────────────────────────────────────────────
function buildInvitationText({
  candidateName, recruiterName, interviewTitle,
  jobTitle, interviewDate, interviewTime, meetingLink, prepLink,
}) {
  return `STB Recruitment — Interview Invitation
=======================================

Hello ${candidateName},

${recruiterName} has scheduled an interview for you.

INTERVIEW DETAILS
-----------------
Position:   ${jobTitle}
Interview:  ${interviewTitle}
Recruiter:  ${recruiterName}
Date:       ${interviewDate}
Time:       ${interviewTime}

JOIN INTERVIEW ROOM:
${meetingLink}

PREPARE FOR YOUR INTERVIEW:
${prepLink}

Tips:
- Join 5-10 minutes early to test your camera and microphone.
- Review your preparation materials before the interview.
- Have a stable internet connection ready.

---
STB Recruitment
${process.env.EMAIL_USER || "your_email@example.com"}
This is an automated message.
`;
}

// ── Main send function ────────────────────────────────────────────────────────
async function sendInterviewInvitation(params) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    throw new Error("Email credentials not configured (EMAIL_USER / EMAIL_APP_PASSWORD missing).");
  }

  const { candidateEmail, jobTitle } = params;

  // prepLink is built here if not passed in (backward compat)
  if (!params.prepLink) {
    params.prepLink = `${FRONTEND_URL}/interview-prep`;
  }

  await transporter.sendMail({
    from: `"STB Recruitment" <${process.env.EMAIL_USER}>`,
    to: candidateEmail,
    subject: `Interview Invitation – ${jobTitle}`,
    text: buildInvitationText(params),
    html: buildInvitationHtml(params),
    attachments: [
      {
        filename: "stb-recruitment-logo.png",
        path: LOGO_PATH,
        cid: "stb-logo",
      },
    ],
  });
}

module.exports = { sendInterviewInvitation };
