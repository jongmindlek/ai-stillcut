// netlify/functions/stillcut.js

const OpenAI = require("openai");

// Netlify 환경변수에서 OPENAI_API_KEY 읽음
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// SYSTEM PROMPT — AI 역할 정의
const SYSTEM_PROMPT = `
너는 영상 감독, 프로듀서, 색보정, 장비 코디네이터 역할을 동시에 수행하는 AI이다.

입력(JSON) 형식:
{
  "video_url": string | null,
  "video_type": string,
  "mood": string,
  "budget_level": string,
  "project_length": string,
  "location_type": string,
  "crew_preference": string,
  "deadline": string,
  "extra_notes": string | null
}

반드시 아래 형식의 JSON으로 출력하라:

{
  "stillcuts": [
    {
      "id": "cut_01",
      "title": "string",
      "description": "string",
      "reason": ["string"],
      "tags": ["string"],
      "framing": "string",
      "tone": "string"
    }
  ],
  "gear_package": {
    "summary": "string",
    "for_one_person": {
      "camera": ["string"],
      "lenses": ["string"],
      "light": ["string"],
      "sound": ["string"],
      "support": ["string"],
      "notes": "string"
    },
    "for_small_crew": {
      "camera": ["string"],
      "lenses": ["string"],
      "light": ["string"],
      "sound": ["string"],
      "crew_roles": ["string"],
      "notes": "string"
    }
  },
  "schedule": {
    "overview": "string",
    "phases": [
      {
        "name": "string",
        "duration": "string",
        "tasks": ["string"]
      }
    ]
  }
}

모든 내용은 실제 촬영 실무에 적합하게 한국어로 설명하라.
여분 텍스트 없이 반드시 JSON만 반환하라.
`;

// Netlify handler
exports.handler = async (event) => {
  // Only POST allowed
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  // Parse Form Data
  const params = new URLSearchParams(event.body);

  const input = {
    video_url: params.get("video_url") || "",
    video_type: params.get("video_type") || "",
    mood: params.get("mood") || "",
    budget_level: params.get("budget_level") || "",
    project_length: params.get("project_length") || "",
    location_type: params.get("location_type") || "",
    crew_preference: params.get("crew_preference") || "",
    deadline: params.get("deadline") || "",
    extra_notes: params.get("extra_notes") || "",
  };

  try {
    // AI 호출
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) }
      ],
      response_format: { type: "json_object" }
    });

    const resultText = response.output[0].content[0].text;
    const result = JSON.parse(resultText);

    // 결과 HTML 렌더링
    const html = renderResultHtml(input, result);

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html,
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `
      <h1>❌ 서버 에러 발생</h1>
      <p>${String(error)}</p>
      <a href="/">← 돌아가기</a>
      `,
    };
  }
};

// HTML 렌더링 함수
function renderResultHtml(input, result) {
  const { stillcuts = [], gear_package = {}, schedule = {} } = result;

  const stillcutHtml = stillcuts.map((cut) => `
    <div style="border:1px solid rgba(255,255,255,0.26); padding:14px; border-radius:12px; margin-bottom:12px;">
      <h3>${cut.title}</h3>
      <p>${cut.description}</p>
      <strong>추천 이유</strong>
      <ul>${cut.reason.map(r => `<li>${r}</li>`).join("")}</ul>
      <p><strong>태그:</strong> ${cut.tags.join(", ")}</p>
      <p><strong>구도:</strong> ${cut.framing}</p>
      <p><strong>톤:</strong> ${cut.tone}</p>
    </div>
  `).join("");

  const phasesHtml = (schedule.phases || [])
    .map(
      (p) => `
    <div style="margin-bottom:10px;">
      <strong>${p.name}</strong> – ${p.duration}
      <ul>
        ${p.tasks.map(t => `<li>${t}</li>`).join("")}
      </ul>
    </div>`
    )
    .join("");

  return `
  <!DOCTYPE html>
  <html lang="ko">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AI 스틸컷 결과</title>
    <style>
      body { padding: 24px; background:#07080b; color:white; font-family: system-ui; }
      h1 { font-size: 22px; margin-bottom: 12px; }
      section { margin-top: 26px; }
    </style>
  </head>
  <body>
    <h1>AI 스틸컷 결과</h1>

    <section>
      <h2>스틸컷 후보</h2>
      ${stillcutHtml || "<p>스틸컷 생성 실패</p>"}
    </section>

    <section>
      <h2>장비 패키지</h2>
      <p>${gear_package.summary || ""}</p>
    </section>

    <section>
      <h2>일정</h2>
      <p>${schedule.overview || ""}</p>
      ${phasesHtml}
    </section>

    <p><a href="/" style="color:#7BA5FF;">← 다시 입력하기</a></p>
  </body>
  </html>
  `;
}

