// netlify/functions/stillcut.js

// 0) 나중에 Netlify에서 OPENAI_API_KEY 환경변수 설정 필요
//    (지금은 개념 설계 단계라 "어디에 뭐가 들어가는지"만 이해하면 됨)

const OpenAI = require("openai");
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 1) AI에게 줄 시스템 프롬프트 (요약 버전)
//    → 입력 JSON을 받아서 stillcuts / gear_package / schedule JSON으로 돌려달라는 역할
const SYSTEM_PROMPT = `
너는 영상 감독, 프로듀서, 컬러리스트, 장비 코디네이터 역할을 동시에 수행하는 AI이다.

아래 형식의 JSON 입력이 주어진다:

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

이 정보를 바탕으로 다음 세 가지를 한 번에 제안해야 한다:

1) 스틸컷 후보 3~5개 (각각 제목, 설명, 추천 이유, 태그, 구도, 톤 포함)
2) 장비 패키지 (1인 운영용 / 소규모 크루용)
3) 준비–촬영–후반 작업 일정 구조

반드시 아래 JSON 구조로만 응답하라:

{
  "stillcuts": [
    {
      "id": "cut_01",
      "title": "string",
      "description": "string",
      "reason": ["string", "string"],
      "tags": ["string", "string"],
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

모든 설명은 한국어로, 실제 현장에서 참고할 수 있을 정도로 구체적이고 실무적인 톤으로 작성하라.
추가 텍스트나 인사말 없이, 반드시 위 구조를 만족하는 JSON 객체만 반환하라.
`;

// 2) Netlify 함수 엔트리포인트
exports.handler = async (event, context) => {
  // (1) POST 요청만 허용
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  // (2) 폼 데이터 파싱
  const body = event.body || "";
  const params = new URLSearchParams(body);

  // (3) 폼 값 → AI에게 줄 input JSON으로 정리
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
    // (4) 여기서 AI 브레인(너)을 호출
    const response = await client.responses.create({
      model: "gpt-5.1-mini",  // 나중에 필요하면 모델 이름 바꿔도 됨
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
      response_format: { type: "json_object" },
    });

    // (5) AI가 돌려준 JSON 텍스트 꺼내기
    const text = response.output[0].content[0].text;
    const result = JSON.parse(text); // { stillcuts, gear_package, schedule }

    // (6) 결과를 HTML로 렌더링
    const html = renderResultHtml(input, result);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
      body: html,
    };
  } catch (err) {
    console.error(err);
    const errorHtml = renderErrorHtml(err, input);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
      body: errorHtml,
    };
  }
};

// 3) 결과 JSON → 간단한 HTML 페이지로 변환
function renderResultHtml(input, result) {
  const { stillcuts = [], gear_package = {}, schedule = {} } = result;

  const stillcutHtml = stillcuts
    .map((cut) => {
      return `
      <div style="border:1px solid rgba(255,255,255,0.26); border-radius:12px; padding:12px; margin-bottom:10px;">
        <h3 style="margin:0 0 4px;">${cut.title || ""}</h3>
        <p style="margin:0 0 8px; font-size:13px;">${cut.description || ""}</p>
        <p style="margin:0; font-size:12px;"><strong>추천 이유</strong></p>
        <ul style="margin:4px 0 8px; padding-left:18px; font-size:12px;">
          ${(cut.reason || [])
            .map((r) => `<li>${r}</li>`)
            .join("")}
        </ul>
        <p style="margin:0; font-size:12px;"><strong>태그:</strong> ${(cut.tags || []).join(", ")}</p>
        <p style="margin:4px 0 0; font-size:12px;"><strong>구도:</strong> ${cut.framing || ""}</p>
        <p style="margin:2px 0 0; font-size:12px;"><strong>톤:</strong> ${cut.tone || ""}</p>
      </div>
    `;
    })
    .join("");

  const gear = gear_package || {};
  const one = gear.for_one_person || {};
  const crew = gear.for_small_crew || {};
  const schedulePhases = (schedule.phases || [])
    .map(
      (p) => `
      <div style="margin-bottom:8px; font-size:12px;">
        <strong>${p.name || ""}</strong> · <span>${p.duration || ""}</span>
        <ul style="margin:4px 0 0; padding-left:18px;">
          ${(p.tasks || [])
            .map((t) => `<li>${t}</li>`)
            .join("")}
        </ul>
      </div>
    `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>Ai 스틸컷 추천 결과</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      margin: 0;
      padding: 24px 16px 48px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #07080b;
      color: #f5f5f5;
      line-height: 1.5;
    }
    .wrapper {
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      font-size: 22px;
      margin-bottom: 8px;
    }
    h2 {
      font-size: 18px;
      margin: 18px 0 8px;
    }
    p {
      font-size: 13px;
      color: rgba(255,255,255,0.85);
      margin-bottom: 12px;
    }
    section {
      margin-top: 16px;
    }
    .chip {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.2);
      font-size: 11px;
      margin-right: 6px;
      margin-bottom: 4px;
    }
    a {
      color: #7BA5FF;
      text-decoration: none;
      font-size: 13px;
    }
    ul {
      margin: 4px 0 8px;
      padding-left: 18px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <h1>Ai 스틸컷 추천 결과</h1>
    <p>아래 내용은 입력하신 프로젝트 정보를 기반으로 AI가 생성한 스틸컷 · 장비 · 일정 제안입니다.</p>

    <section>
      <h2>요약 정보</h2>
      <div class="chip">영상 종류: ${input.video_type || "-"}</div>
      <div class="chip">길이: ${input.project_length || "-"}</div>
      <div class="chip">예산: ${input.budget_level || "-"}</div>
      <div class="chip">크루: ${input.crew_preference || "-"}</div>
      <div class="chip">로케이션: ${input.location_type || "-"}</div>
    </section>

    <section>
      <h2>스틸컷 후보</h2>
      ${stillcutHtml || "<p style='font-size:13px;'>스틸컷 후보를 생성하지 못했습니다.</p>"}
    </section>

    <section>
      <h2>장비 패키지</h2>
      <p style="font-size:13px;">${gear.summary || ""}</p>

      <h3 style="font-size:14px; margin-bottom:4px;">1인 운영 기준</h3>
      <ul>
        <li><strong>카메라:</strong> ${(one.camera || []).join(", ")}</li>
        <li><strong>렌즈:</strong> ${(one.lenses || []).join(", ")}</li>
        <li><strong>조명:</strong> ${(one.light || []).join(", ")}</li>
        <li><strong>사운드:</strong> ${(one.sound || []).join(", ")}</li>
        <li><strong>서포트:</strong> ${(one.support || []).join(", ")}</li>
      </ul>
      <p style="font-size:12px;">${one.notes || ""}</p>

      <h3 style="font-size:14px; margin-bottom:4px; margin-top:10px;">소규모 크루 기준</h3>
      <ul>
        <li><strong>카메라:</strong> ${(crew.camera || []).join(", ")}</li>
        <li><strong>렌즈:</strong> ${(crew.lenses || []).join(", ")}</li>
        <li><strong>조명:</strong> ${(crew.light || []).join(", ")}</li>
        <li><strong>사운드:</strong> ${(crew.sound || []).join(", ")}</li>
        <li><strong>크루 구성:</strong> ${(crew.crew_roles || []).join(", ")}</li>
      </ul>
      <p style="font-size:12px;">${crew.notes || ""}</p>
    </section>

    <section>
      <h2>진행 일정</h2>
      <p style="font-size:13px;">${schedule.overview || ""}</p>
      ${schedulePhases || "<p style='font-size:13px;'>일정 정보를 생성하지 못했습니다.</p>"}
    </section>

    <p style="margin-top:24px;"><a href="/">← 다시 입력하기</a></p>
  </div>
</body>
</html>`;
}

// 4) 에러가 날 경우 보여줄 HTML
function renderErrorHtml(err, input) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>오류가 발생했습니다</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      margin: 0;
      padding: 24px 16px 48px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #07080b;
      color: #f5f5f5;
      line-height: 1.5;
    }
    .wrapper {
      max-width: 900px;
      margin: 0 auto;
    }
    pre {
      background: rgba(10,12,18,0.95);
      border-radius: 12px;
      padding: 16px;
      border: 1px solid rgba(255,255,255,0.16);
      font-size: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    a {
      color: #7BA5FF;
      text-decoration: none;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <h1>오류가 발생했습니다.</h1>
    <p>잠시 후 다시 시도해 주세요. 문제가 계속되면 로그를 확인해 주세요.</p>
    <pre>${String(err)}</pre>
    <p><a href="/">← 돌아가기</a></p>
  </div>
</body>
</html>`;
}
