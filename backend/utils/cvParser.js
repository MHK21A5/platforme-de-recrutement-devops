/**
 * cvParser.js  — ATS CV parser (cross-platform: Windows + Linux)
 *
 * PDF  → pdf-parse v2 (PDFParse class) with minimal browser-API polyfills
 * DOCX → mammoth
 */

const path = require("path");
const { pathToFileURL } = require("url");

/* ── browser-API polyfills for pdfjs-dist v5 (pdf-parse v2 dep) ─────────── */
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0;
      this.m11=1;this.m12=0;this.m13=0;this.m14=0;
      this.m21=0;this.m22=1;this.m23=0;this.m24=0;
      this.m31=0;this.m32=0;this.m33=1;this.m34=0;
      this.m41=0;this.m42=0;this.m43=0;this.m44=1;
      this.is2D=true;this.isIdentity=true;
    }
    multiply()        { return new globalThis.DOMMatrix(); }
    translate()       { return new globalThis.DOMMatrix(); }
    scale()           { return new globalThis.DOMMatrix(); }
    rotate()          { return new globalThis.DOMMatrix(); }
    inverse()         { return new globalThis.DOMMatrix(); }
    transformPoint(p) { return p || {x:0,y:0,z:0,w:1}; }
  };
}
if (typeof globalThis.Path2D === "undefined") {
  globalThis.Path2D = class Path2D { constructor() {} };
}
if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = class ImageData {
    constructor(w,h) { this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4); }
  };
}

/* ── text extraction ─────────────────────────────────────────────────────── */

async function extractTextFromPDF(filePath) {
  const { PDFParse } = require("pdf-parse");
  const fileUrl = pathToFileURL(filePath).href;
  const parser  = new PDFParse({ url: fileUrl });
  const result  = await parser.getText();
  return result.text || "";
}

async function extractTextFromDOCX(filePath) {
  const mammoth = require("mammoth");
  const result  = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
}

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf")                    return extractTextFromPDF(filePath);
  if (ext === ".docx" || ext === ".doc") return extractTextFromDOCX(filePath);
  return "";
}

/* ── clean raw text ──────────────────────────────────────────────────────── */

function cleanText(text) {
  return text
    .replace(/[​‌‍‎‏﻿­]/g, "")  // invisible Unicode chars
    .replace(/[–—]/g, "-")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^-- \d+ of \d+ --$/gm, "") // pdfjs page-break markers
    .trim();
}

/* ── section splitter ────────────────────────────────────────────────────── */

const SECTION_MAP = {
  summary:        /^(summary|professional\s+summary|profile|objective|about\s+me|career\s+objective)$/i,
  skills:         /^(skills|technical\s+skills|core\s+competencies|key\s+skills|technologies|tools(\s+[&and]+\s+technologies)?|expertise|tech\s+stack|stack)$/i,
  experience:     /^(experience|work\s+experience|professional\s+experience|employment(\s+history)?|career\s+history|work\s+history)$/i,
  education:      /^(education|academic\s+background|qualifications|academic\s+qualifications|studies|training\s+&\s+education)$/i,
  certifications: /^(certifications?|certificates?|accreditations?|licen[sc]es?)$/i,
  languages:      /^(languages?|language\s+skills?|spoken\s+languages?)$/i,
  _stop:          /^(projects?|personal\s+projects?|portfolio|references?|hobbies|interests?|volunteer|awards?|publications?)$/i,
};

function splitSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = {
    header:[], summary:[], skills:[], experience:[],
    education:[], certifications:[], languages:[], _stop:[],
  };
  let current = "header";
  for (const line of lines) {
    const trimmed = line.trim();
    let matched = false;
    for (const [key, regex] of Object.entries(SECTION_MAP)) {
      if (regex.test(trimmed)) { current = key; matched = true; break; }
    }
    if (!matched) sections[current].push(line);
  }
  return Object.fromEntries(
    Object.entries(sections).map(([k,v]) => [k, Array.isArray(v) ? v.join("\n") : v])
  );
}

/* ── contact extractors ──────────────────────────────────────────────────── */

function extractEmail(text) {
  const m = text.match(/[\w.+\-]+@[\w\-]+\.[a-z]{2,}/i);
  return m ? m[0] : "";
}
function extractPhone(text) {
  const m = text.match(/(?:\+?\d{1,3}[\s\-.])?(?:\(?\d{2,4}\)?[\s\-.])\d{3,4}[\s\-.]?\d{3,6}/);
  return m ? m[0].trim() : "";
}
function extractLinkedIn(text) {
  const m = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([\w\-%]+)/i);
  return m ? m[0] : "";
}
function extractGitHub(text) {
  const m = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([\w\-]+)/i);
  return m ? m[0] : "";
}
function extractPortfolio(text) {
  const urls = text.match(/https?:\/\/[^\s,<>"]+/gi) || [];
  return urls.find((u) => !/linkedin\.com|github\.com/i.test(u)) || "";
}
function extractName(headerText) {
  const lines = headerText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (/[@\/\\]/.test(line))  continue;
    if (/\d{3,}/.test(line))   continue;
    if (line.length > 70)      continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 6) return line;
  }
  return "";
}

/* ── skills ──────────────────────────────────────────────────────────────── */

function parseSkills(text) {
  if (!text.trim()) return [];
  const tokens = text
    .replace(/[•*▪◦►▸·]/g, ",")
    .replace(/\|/g, ",")
    .split(/[,\n;]+/)
    .map((s) => s.replace(/^\s*[-–]\s*/, "").trim())
    .filter((s) => s.length > 1 && s.length < 60 && !s.endsWith(":") && !/^[\W\d]+$/.test(s));
  return [...new Set(tokens)];
}

/* ── date helpers ────────────────────────────────────────────────────────── */

const DATE_RANGE_RE = /(?:(?:\d{2}\/\d{4}|\d{4})\s*[-]\s*(?:\d{2}\/\d{4}|\d{4}|present|current|now))/i;
const YEAR_RE       = /\b(19|20)\d{2}\b/;
const DEGREE_RE     = /\b(b\.?s\.?c?|m\.?s\.?c?|ph\.?d?|bachelor|master|associate|diploma|licence|ingenieur|engineer|bts|dut|doctorat|mba|llb|llm)\b/i;

/* ── experience: state-machine parser ───────────────────────────────────── */
/*
 * Handles pdf-parse v2 output format:
 *   - Bullets are "•text" (no preceding newline relative to title)
 *   - Date range appears MID-entry between bullet groups
 *   - Company/location appears on the line right after the date
 *   - Entries are NOT blank-line-separated
 *
 * A new job starts when a non-bullet, non-date plain line appears
 * AFTER at least one bullet has been seen for the current job.
 */
function parseExperienceStateMachine(text) {
  if (!text.trim()) return [];

  const lines    = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const isBullet = (l) => /^[•\-*▪◦►▸]/.test(l);
  const isDate   = (l) => DATE_RANGE_RE.test(l);

  const jobs    = [];
  let current   = null;
  let sawBullet = false;
  let lastDate  = false;

  const pushCurrent = () => { if (current && current.title) jobs.push(current); };
  const newJob = (title) => {
    pushCurrent();
    // If title ends with comma, keep it (company will fill next line)
    current   = { title: title.replace(/,$/, "").trim(), company: "", startDate: "", endDate: "", description: "" };
    sawBullet = false;
    lastDate  = false;
  };

  for (const line of lines) {
    if (isDate(line)) {
      if (current) {
        const m = line.match(DATE_RANGE_RE);
        if (m) {
          const parts = m[0].split(/\s*[-]\s*/);
          current.startDate = parts[0].trim();
          current.endDate   = parts[1]?.trim() || "";
        }
      }
      lastDate = true; sawBullet = false;
      continue;
    }

    if (isBullet(line)) {
      if (!current) newJob("");
      const desc = line.replace(/^[•\-*▪◦►▸]\s*/, "");
      current.description = current.description
        ? current.description + " " + desc
        : desc;
      if (current.description.length > 400) current.description = current.description.slice(0, 400);
      sawBullet = true; lastDate = false;
      continue;
    }

    // Plain text line
    if (lastDate) {
      // Line right after a date → company/location
      if (current && !current.company) current.company = line;
      lastDate = false;
      continue;
    }

    if (!current) {
      newJob(line); continue;
    }

    if (sawBullet) {
      // If line starts with lowercase it's a wrapped continuation of the previous bullet
      if (/^[a-z]/.test(line)) {
        current.description = current.description
          ? current.description + " " + line
          : line;
        if (current.description.length > 400) current.description = current.description.slice(0, 400);
        continue;
      }
      // Uppercase → new job title
      newJob(line); continue;
    }

    // Non-bullet before any bullet for current job
    // Could be: second line of title, or company name
    if (current.title.length === 0) {
      current.title = line;
    } else if (!current.company) {
      current.company = line;
    }
  }

  pushCurrent();
  return jobs;
}

/* ── experience: block-based fallback (DOCX / plain-newline PDFs) ────────── */

function mergeTrailingDateBlocks(blocks) {
  const merged = [];
  for (const b of blocks) {
    const lines = b.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const isDateOnly    = lines.length <= 2 && DATE_RANGE_RE.test(b);
    const prevHasDate   = merged.length && DATE_RANGE_RE.test(merged[merged.length-1]);
    const isCompanyOnly = merged.length && prevHasDate && lines.length <= 2 &&
      lines.every((l) => l.length < 80 &&
        !/^(managed|resolved|handled|achieved|worked|maintained|improved|automated|coordinated|assisted|developed|built|led)/i.test(l));
    if (merged.length && isDateOnly) merged[merged.length-1] += "\n" + b;
    else if (isCompanyOnly)          merged[merged.length-1] += "\n" + b;
    else                             merged.push(b);
  }
  return merged;
}

function parseExperienceBlocks(text) {
  const blocks = mergeTrailingDateBlocks(text.split(/\n\s*\n+/).filter((b) => b.trim()));
  const results = [];
  for (const block of blocks) {
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const entry = { company:"", title:"", startDate:"", endDate:"", description:"" };
    const dm = block.match(DATE_RANGE_RE);
    if (dm) { const p = dm[0].split(/\s*[-]\s*/); entry.startDate=p[0].trim(); entry.endDate=p[1]?.trim()||""; }
    const contentLines = lines.filter((l) => !DATE_RANGE_RE.test(l));
    if (contentLines[0]) {
      const tr = contentLines[0].trim();
      const ci = tr.lastIndexOf(",");
      if (ci > 0 && tr.length-ci < 40) { entry.title=tr.slice(0,ci).trim(); entry.company=tr.slice(ci+1).trim(); }
      else entry.title = tr;
    }
    if (!entry.company && contentLines[1]) {
      const s = contentLines[1].trim();
      if (s.length < 80 && !/^(managed|resolved|handled|achieved|worked|maintained|improved|automated|coordinated)/i.test(s))
        entry.company = s;
    }
    entry.description = contentLines.slice(2).filter((l)=>l.length>3).join(" ").slice(0,350);
    if (entry.title) results.push(entry);
  }
  return results;
}

function parseExperience(text) {
  if (!text.trim()) return [];
  // State-machine handles bullet-based PDFs; if no bullets found, fall back to block parser
  const hasBullets = /^[•▪◦►▸]/m.test(text);
  if (hasBullets) return parseExperienceStateMachine(text);
  return parseExperienceBlocks(text);
}

/* ── education ───────────────────────────────────────────────────────────── */

function parseEducation(text) {
  if (!text.trim()) return [];
  const blocks = mergeTrailingDateBlocks(text.split(/\n\s*\n+/).filter((b) => b.trim()));
  const results = [];
  for (const block of blocks) {
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const entry = { institution:"", degree:"", field:"", startYear:"", endYear:"" };
    const dm = block.match(DATE_RANGE_RE);
    if (dm) { const p = dm[0].split(/\s*[-]\s*/); entry.startYear=p[0].trim(); entry.endYear=p[1]?.trim()||""; }
    else { const y = block.match(YEAR_RE); if (y) entry.endYear=y[0]; }
    for (const line of lines) {
      const cleanLine = line.replace(DATE_RANGE_RE,"").replace(YEAR_RE,"").trim();
      if (!cleanLine) continue;
      if (DEGREE_RE.test(line) && !entry.degree) entry.degree = cleanLine.replace(/,$/,"").trim();
      else if (!entry.institution && !DATE_RANGE_RE.test(line)) entry.institution = cleanLine.replace(/,$/,"").trim();
    }
    if (entry.institution || entry.degree) results.push(entry);
  }
  return results;
}

/* ── languages / certifications ─────────────────────────────────────────── */

const LANG_LEVEL_RE = /^(native|fluent|proficient|intermediate|beginner|advanced|basic|bilingual|c1|c2|b1|b2|a1|a2)$/i;

function parseLanguages(text) {
  if (!text.trim()) return [];
  return [...new Set(
    text.replace(/[•*▪◦►▸·]/g,",").split(/[,\n;]+/)
      .map((s) => s.replace(/^\s*[-–]\s*/,"").replace(/\(.*?\)/g,"").trim())
      .filter((s) => s.length>1 && s.length<40 && !/\d/.test(s) && !LANG_LEVEL_RE.test(s))
  )];
}

function parseCertifications(text) {
  if (!text.trim()) return [];
  return text.replace(/[•*▪◦►▸·]/g,"\n").split(/\n+/)
    .map((s) => s.replace(/^\s*[-–]\s*/,"").trim())
    .filter((s) => s.length>3);
}

/* ── main ────────────────────────────────────────────────────────────────── */

async function parseCV(filePath) {
  let rawText = "";
  try {
    rawText = await extractText(filePath);
  } catch (err) {
    console.error("[cvParser] extraction error:", err.message);
    return { rawText: "", error: err.message };
  }
  if (!rawText.trim()) return { rawText: "", error: "Could not extract text from CV" };

  rawText = cleanText(rawText);
  const sections = splitSections(rawText);

  return {
    fullName:       extractName(sections.header),
    email:          extractEmail(rawText),
    phone:          extractPhone(sections.header),
    linkedIn:       extractLinkedIn(rawText),
    github:         extractGitHub(rawText),
    portfolio:      extractPortfolio(rawText),
    summary:        sections.summary.trim(),
    skills:         parseSkills(sections.skills),
    education:      parseEducation(sections.education),
    experience:     parseExperience(sections.experience),
    languages:      parseLanguages(sections.languages),
    certifications: parseCertifications(sections.certifications),
    rawText:        rawText.slice(0, 10000),
  };
}



module.exports = { parseCV };
