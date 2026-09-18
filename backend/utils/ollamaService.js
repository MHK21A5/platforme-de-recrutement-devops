const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/generate";

function tryParseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function normalizeQuestion(question, index) {
  const prompt = String(question.prompt || question.question || question.text || `Question ${index + 1}`).trim();
  const rawOptions = Array.isArray(question.options)
    ? question.options.map((o) => String(o).trim()).filter(Boolean)
    : [];

  // Strip letter prefixes like "A) ", "a) ", "A. ", "1) ", "1. "
  const options = rawOptions.map(o =>
    o.replace(/^[a-dA-D1-4][.)]\s*/, "").replace(/^\([a-dA-D1-4]\)\s*/, "").trim()
  ).filter(Boolean);

  let correctAnswer = String(question.correctAnswer || question.answer || "").trim();

  // Strip prefix from correctAnswer too
  correctAnswer = correctAnswer.replace(/^[a-dA-D1-4][.)]\s*/, "").replace(/^\([a-dA-D1-4]\)\s*/, "").trim();

  // If correctAnswer is a single letter (a/b/c/d), resolve to option text
  if (/^[a-dA-D]$/.test(correctAnswer) && options.length > 0) {
    const idx = correctAnswer.toLowerCase().charCodeAt(0) - 97;
    if (options[idx]) correctAnswer = options[idx];
  }

  // If correctAnswer still doesn't match any option, do fuzzy match
  if (!options.includes(correctAnswer) && options.length > 0) {
    const lower = correctAnswer.toLowerCase();
    const fuzzy = options.find(o => o.toLowerCase().includes(lower.slice(0, 20)) || lower.includes(o.toLowerCase().slice(0, 20)));
    if (fuzzy) correctAnswer = fuzzy;
    else correctAnswer = options[0]; // last resort: first option
  }

  return {
    questionId: String(question.questionId || question.id || `q${index + 1}`),
    prompt,
    options: options.length >= 2 ? options : ["True", "False"],
    correctAnswer,
    explanation: String(question.explanation || question.explain || question.feedback || "").trim(),
  };
}

function parseOllamaRawOutput(rawText) {
  const parsed = tryParseJson(rawText);
  if (parsed && parsed.response) return parsed.response;
  if (parsed && parsed.questions) return rawText;

  // Streamed NDJSON fallback
  const lines = rawText.split("\n").filter(Boolean);
  if (lines.length > 1) {
    const combined = lines.map(l => tryParseJson(l)).filter(Boolean).map(o => o.response || "").join("");
    if (combined) return combined;
  }
  return rawText;
}

function extractJsonText(text) {
  const trimmed = String(text).trim();

  // Strip markdown code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (tryParseJson(inner)) return inner;
    return repairJson(inner);
  }

  if (tryParseJson(trimmed)) return trimmed;

  // Try to find a JSON object first, then a JSON array
  const objMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objMatch) {
    const candidate = objMatch[0];
    if (tryParseJson(candidate)) return candidate;
    return repairJson(candidate);
  }

  const arrMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    const candidate = arrMatch[0];
    if (tryParseJson(candidate)) return candidate;
    // wrap array in questions object
    const repaired = repairJson(candidate);
    const parsed = tryParseJson(repaired);
    if (Array.isArray(parsed)) return JSON.stringify({ questions: parsed });
    return `{"questions":${repaired}}`;
  }

  return repairJson(trimmed);
}

function buildPrompt(job, interviewTitle) {
  const skills = Array.isArray(job?.requiredSkills) && job.requiredSkills.length
    ? job.requiredSkills.slice(0, 5).join(", ")
    : "general professional skills";
  const level = job?.experienceLevel || "mid";
  const seed = Math.floor(Math.random() * 99999);

  return `Output ONLY valid JSON, no markdown, no text outside JSON. Seed:${seed}

Create 8 multiple-choice questions for a ${level}-level "${job?.title || "professional"}" interview.
Topic areas: ${skills}

Requirements:
- Each question has exactly 4 short options (max 8 words each)
- correctAnswer must exactly match one of the 4 options
- Include a 1-sentence explanation

Use this exact JSON format:
{"questions":[{"questionId":"q1","prompt":"Short question here?","options":["Option A","Option B","Option C","Option D"],"correctAnswer":"Option A","explanation":"One sentence."}]}

Generate all 8 questions now:`;
}

function repairJson(text) {
  // Try to salvage a truncated questions array by closing it
  let t = text.trim();
  // Remove trailing commas before closing brackets
  t = t.replace(/,\s*([}\]])/g, "$1");
  // If the array is unclosed, close it
  if (t.includes('"questions"') && !t.endsWith("}")) {
    // Find last complete question object
    const lastClose = t.lastIndexOf("}");
    if (lastClose > 0) {
      t = t.slice(0, lastClose + 1);
      if (!t.endsWith("]}")) t += "]}";
      if (!t.startsWith("{")) t = "{" + t;
    }
  }
  return t;
}

async function callOllama(prompt) {
  const fetchFn = globalThis.fetch;
  if (!fetchFn) throw new Error("Node.js 18+ required for fetch.");

  const response = await fetchFn(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen2.5:1.5b",
      prompt,
      stream: false,
      options: {
        temperature: 0.4,   // lower = more reliable JSON structure
        top_p: 0.85,
        top_k: 30,
        seed: Math.floor(Math.random() * 2147483647),
        num_predict: 4096,  // max context for 1.5b
        repeat_penalty: 1.1,
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Ollama error: ${response.status} ${text}`);
  return parseOllamaRawOutput(text);
}

function ensureQuestions(data) {
  // Handle both {"questions":[...]} and direct array [...]
  const list = Array.isArray(data) ? data : (Array.isArray(data?.questions) ? data.questions : null);
  if (!list) throw new Error("No questions array in response.");
  const questions = list.slice(0, 8).map(normalizeQuestion).filter(q =>
    q.prompt && q.options.length >= 2 && q.correctAnswer
  );
  if (questions.length < 2) throw new Error(`Only ${questions.length} valid question(s) — unusable.`);
  return questions.map((q, i) => ({
    ...q,
    questionId: q.questionId || `q${i + 1}`,
    options: q.options.length ? q.options : ["True", "False"],
  }));
}

function buildFallbackQuestions(job, interviewTitle) {
  const combined = [
    job?.title, job?.position, job?.description, interviewTitle,
    ...(Array.isArray(job?.requiredSkills) ? job.requiredSkills : []),
  ].filter(Boolean).join(" ").toLowerCase();

  const pool = [
    {
      tags: ["secretaire","secretary","admin","administration","office","assistant","clerical","excel","time management","organisation","journalisation","tache","rh","hr","receptionist","accueil","general"],
      q: [
        { prompt: "What is the most effective way to prioritize multiple urgent tasks?", options: ["Handle them in the order they arrive","Assess urgency and importance using a priority matrix","Delegate all tasks immediately","Work on the easiest tasks first"], correctAnswer: "Assess urgency and importance using a priority matrix", explanation: "The Eisenhower matrix helps distinguish urgent/important tasks to manage workload effectively." },
        { prompt: "Which Excel function looks up a value in the first column of a table?", options: ["HLOOKUP","INDEX","SUMIF","VLOOKUP"], correctAnswer: "VLOOKUP", explanation: "VLOOKUP searches vertically in the first column and returns a value from a specified column." },
        { prompt: "What is the best practice for managing confidential documents?", options: ["Store in a shared public folder","Use password protection and restrict access","Email to all team members","Print and leave on the desk"], correctAnswer: "Use password protection and restrict access", explanation: "Confidential documents must be protected digitally and physically." },
        { prompt: "What does an effective meeting agenda include?", options: ["Only meeting time and location","Topics, responsible persons, time allocations, and objectives","A list of attendees only","A summary of the last meeting"], correctAnswer: "Topics, responsible persons, time allocations, and objectives", explanation: "A structured agenda keeps meetings focused and ensures key points are addressed." },
        { prompt: "How should a scheduling conflict for an executive be handled?", options: ["Cancel the less important meeting silently","Inform all parties promptly and propose alternatives","Ignore it and let the executive decide","Accept both and hope for the best"], correctAnswer: "Inform all parties promptly and propose alternatives", explanation: "Proactive communication preserves professional relationships." },
        { prompt: "What is the purpose of meeting minutes?", options: ["To entertain attendees","To formally record decisions, actions, and discussions","To replace the agenda","To track attendance only"], correctAnswer: "To formally record decisions, actions, and discussions", explanation: "Meeting minutes serve as an official record and reference for follow-up actions." },
        { prompt: "Which Excel feature lets you filter rows by specific criteria?", options: ["Pivot Table","AutoFilter","VLOOKUP","Conditional Formatting"], correctAnswer: "AutoFilter", explanation: "AutoFilter displays only rows meeting specific criteria within a dataset." },
        { prompt: "How should incoming business correspondence be handled?", options: ["Read and discard","Log, sort by priority, and route to the appropriate person","Archive without reading","Forward everything to the manager"], correctAnswer: "Log, sort by priority, and route to the appropriate person", explanation: "Proper correspondence management ensures nothing is missed and responses are timely." },
      ],
    },
    {
      tags: ["finance","accounting","financial","budget","audit","tax","banking","comptable","comptabilite"],
      q: [
        { prompt: "What is the difference between cash flow and profit?", options: ["Cash flow is actual money movement; profit is revenue minus expenses","They are the same thing","Profit includes non-cash items only","Cash flow is only for investments"], correctAnswer: "Cash flow is actual money movement; profit is revenue minus expenses", explanation: "A company can be profitable but still run out of cash due to timing differences." },
        { prompt: "What does accounts receivable represent?", options: ["Money owed by the company","Money owed to the company","Long-term assets","Operating expenses"], correctAnswer: "Money owed to the company", explanation: "AR is money customers owe for goods/services already delivered." },
        { prompt: "What does EBITDA measure?", options: ["Earnings Before Interest, Taxes, Depreciation, and Amortization","Estimated Budget Including Tax, Debt, and Assets","Earnings Before Income Tax Disclosures","None of the above"], correctAnswer: "Earnings Before Interest, Taxes, Depreciation, and Amortization", explanation: "EBITDA measures core operational profitability before financing and accounting adjustments." },
        { prompt: "Which financial statement shows a company's position at a specific date?", options: ["Income statement","Cash flow statement","Balance sheet","Statement of retained earnings"], correctAnswer: "Balance sheet", explanation: "The balance sheet is a snapshot of assets, liabilities, and equity at a point in time." },
        { prompt: "What is working capital?", options: ["Total assets minus total liabilities","Current assets minus current liabilities","Net income plus depreciation","Revenue minus cost of goods sold"], correctAnswer: "Current assets minus current liabilities", explanation: "Working capital measures short-term liquidity and operational efficiency." },
        { prompt: "What does ROI measure?", options: ["Return on Investment — profitability relative to cost","Rate of Inflation Index","Revenue Over Interest","Risk of Investment"], correctAnswer: "Return on Investment — profitability relative to cost", explanation: "ROI = (Gain - Cost) / Cost, used to evaluate investment efficiency." },
        { prompt: "What is the purpose of an audit?", options: ["Increase company revenue","Verify financial statements are accurate and compliant","Reduce employee count","Set annual budgets"], correctAnswer: "Verify financial statements are accurate and compliant", explanation: "Audits provide assurance to stakeholders that financial reporting is truthful." },
        { prompt: "What is amortization?", options: ["Gradually writing off an intangible asset","Increasing asset value over time","Paying off debt instantly","Calculating interest on loans"], correctAnswer: "Gradually writing off an intangible asset", explanation: "Amortization spreads the cost of intangibles like patents over their useful life." },
      ],
    },
    {
      tags: ["devops","docker","kubernetes","ci","cd","aws","cloud","infrastructure","linux","sre","ops"],
      q: [
        { prompt: "What is the main purpose of Docker?", options: ["Containerize applications and their dependencies","Manage relational databases","Write frontend code","Monitor network traffic"], correctAnswer: "Containerize applications and their dependencies", explanation: "Docker packages apps into isolated containers ensuring consistent environments." },
        { prompt: "What does CI/CD stand for?", options: ["Continuous Integration / Continuous Deployment","Code Inspection / Code Delivery","Controlled Input / Controlled Distribution","None of the above"], correctAnswer: "Continuous Integration / Continuous Deployment", explanation: "CI/CD automates building, testing, and deploying software." },
        { prompt: "What is Kubernetes used for?", options: ["Container orchestration at scale","Writing backend APIs","Database replication","Browser rendering"], correctAnswer: "Container orchestration at scale", explanation: "Kubernetes automates deploying, scaling, and managing containerized applications." },
        { prompt: "What is the difference between horizontal and vertical scaling?", options: ["Horizontal adds servers; vertical adds resources to existing servers","They are the same","Vertical adds servers; horizontal adds resources","Horizontal is only for databases"], correctAnswer: "Horizontal adds servers; vertical adds resources to existing servers", explanation: "Horizontal scaling is generally more resilient; vertical has hardware limits." },
        { prompt: "What is Infrastructure as Code?", options: ["Managing infrastructure through config files","Writing infrastructure documentation","Testing server performance","Monitoring cloud costs"], correctAnswer: "Managing infrastructure through config files", explanation: "IaC tools like Terraform allow reproducible, version-controlled infrastructure." },
        { prompt: "What does a load balancer do?", options: ["Distributes traffic across multiple servers","Stores static files","Manages database queries","Monitors CPU usage"], correctAnswer: "Distributes traffic across multiple servers", explanation: "Load balancers prevent any single server from becoming a bottleneck." },
        { prompt: "What is a reverse proxy?", options: ["Forwards client requests to backend servers","Directly serves database queries","Compiles source code","Scans for vulnerabilities"], correctAnswer: "Forwards client requests to backend servers", explanation: "Reverse proxies like Nginx add security, caching, and load distribution." },
        { prompt: "What is blue-green deployment?", options: ["Running two identical environments and switching traffic","Deploying only bug fixes","Deploying to one server at a time","A Docker networking mode"], correctAnswer: "Running two identical environments and switching traffic", explanation: "Blue-green minimizes downtime and allows instant rollback." },
      ],
    },
    {
      tags: ["__default__"],
      q: [
        { prompt: "What is the difference between SQL and NoSQL databases?", options: ["SQL is relational with fixed schema; NoSQL is flexible and document-based","SQL is always faster","NoSQL only works offline","They are the same"], correctAnswer: "SQL is relational with fixed schema; NoSQL is flexible and document-based", explanation: "The choice depends on data structure and scalability needs." },
        { prompt: "What is REST?", options: ["An architectural style for APIs using HTTP methods","A programming language","A database type","A frontend framework"], correctAnswer: "An architectural style for APIs using HTTP methods", explanation: "REST uses GET, POST, PUT, DELETE over HTTP for stateless communication." },
        { prompt: "What is the purpose of version control?", options: ["Track changes, collaborate, and revert to previous states","Speed up compilation","Replace unit tests","Manage databases"], correctAnswer: "Track changes, collaborate, and revert to previous states", explanation: "Version control (e.g. Git) is fundamental to professional software development." },
        { prompt: "What does SOLID stand for?", options: ["Single responsibility, Open/closed, Liskov, Interface segregation, Dependency inversion","Speed, Optimization, Logic, Integration, Design","A testing framework","None of the above"], correctAnswer: "Single responsibility, Open/closed, Liskov, Interface segregation, Dependency inversion", explanation: "SOLID principles guide writing maintainable object-oriented code." },
        { prompt: "What is a race condition?", options: ["Two processes accessing shared data simultaneously causing unexpected results","A performance benchmark","A type of loop","A CSS animation"], correctAnswer: "Two processes accessing shared data simultaneously causing unexpected results", explanation: "Race conditions require synchronization mechanisms like locks." },
        { prompt: "What is the difference between authentication and authorization?", options: ["Authentication verifies identity; authorization grants permissions","They are the same","Authorization verifies identity; authentication grants access","Neither is security-related"], correctAnswer: "Authentication verifies identity; authorization grants permissions", explanation: "You first authenticate then authorize." },
        { prompt: "What is caching?", options: ["Storing frequently accessed data in fast memory to reduce latency","Saving files to disk","A backup strategy","A type of database index"], correctAnswer: "Storing frequently accessed data in fast memory to reduce latency", explanation: "Caching reduces database load and speeds up response times." },
        { prompt: "What is a deadlock?", options: ["Two processes waiting for each other to release resources indefinitely","A server crash","An infinite loop","A null pointer error"], correctAnswer: "Two processes waiting for each other to release resources indefinitely", explanation: "Deadlocks require careful resource ordering or timeout strategies." },
      ],
    },
  ];

  const best = pool.find(p => p.tags.some(tag => combined.includes(tag))) || pool[pool.length - 1];
  const ts = Date.now();
  return best.q.map((q, i) => ({
    questionId: `fb_${ts}_${i + 1}`,
    prompt: q.prompt,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
  }));
}

async function generateQuizQuestions(job, interviewTitle) {
  const prompt = buildPrompt(job, interviewTitle);
  try {
    const raw = await callOllama(prompt);
    console.log(`[Quiz] Raw Ollama output (first 300 chars): ${String(raw).slice(0, 300)}`);
    const extracted = extractJsonText(raw);
    const parsed = tryParseJson(extracted);
    if (!parsed) {
      console.warn(`[Quiz] JSON parse failed. Extracted: ${String(extracted).slice(0, 200)}`);
      throw new Error("Invalid JSON from Ollama.");
    }
    const questions = ensureQuestions(parsed);
    console.log(`[Quiz] Ollama generated ${questions.length} questions for: ${interviewTitle}`);
    return questions;
  } catch (err) {
    console.warn(`[Quiz] Ollama failed (${err.message}), using fallback for: ${interviewTitle}`);
    return buildFallbackQuestions(job, interviewTitle);
  }
}

async function generatePrepTips(job, interviewTitle) {
  const skills = Array.isArray(job?.requiredSkills) ? job.requiredSkills.join(", ") : "general skills";
  const prompt = `You are a career coach. Write 5 concise interview preparation tips for this role. Return ONLY a numbered list (1. 2. 3. 4. 5.), no intro, no conclusion.

Interview: "${interviewTitle}"
Job: ${job?.title || ""}${job?.position ? ` — ${job.position}` : ""}
Skills required: ${skills}
Level: ${job?.experienceLevel || "any"}${job?.description ? `\nDescription: ${job.description}` : ""}`;

  try {
    const fetchFn = globalThis.fetch;
    if (!fetchFn) throw new Error("Node.js 18+ required for fetch.");

    const response = await fetchFn(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:1.5b",
        prompt,
        stream: false,
        options: {
          temperature: 0.6,
          top_p: 0.9,
          num_predict: 600,
        },
      }),
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`Ollama error: ${response.status} ${text}`);

    // parse the response field directly — no JSON extraction needed for plain text
    const parsed = tryParseJson(text);
    const tips = (parsed?.response || text || "").trim();
    if (!tips) throw new Error("Empty response from Ollama.");
    return tips;
  } catch (err) {
    console.warn(`[PrepTips] Ollama failed: ${err.message}`);
    return null;
  }
}

module.exports = { generateQuizQuestions, generatePrepTips };
