// netlify/functions/stillcut.js

const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handler = async (event) => {
  // 1) GET이면 안내문만
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "이 엔드포인트는 폼을 통해 POST 요청으로만 사용됩니다.",
    };
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
    }

    // 2) 폼 데이터 파싱
    const body = event.body || "";
    const params = new URLSearchParams(body);

    const input = {
      video_url: params.get("video_url") || "",
      video_type: params.get("video_type") || "",
      mood: params.get("mood") || "",
      project_length: params.get("project_length") || "",
      location_type: params.get("location_type") || "",
      budget_level: params.get("budget_level") || "",
      crew_preference: params.get("crew_preference") || "",
      deadline: params.get("deadline") || "",
      extra_notes: params.get("extra_notes") || "",
    };

    // 3) OpenAI에 요약 한 줄 요청
    const prompt = `
너는 시니어 영상 감독이자 프로듀서야.
아래 프로젝트 정보를 보고, 감독 메모 형식으로 한 줄 요약을 만들어줘.

[프로젝트 정보]
- 영상 종류: ${input.video_type}
- 무드/톤: ${input.mood}
- 영상 길이: ${input.project_length}
- 로케이션: ${input.location_type}
- 예산: ${input.budget_level}
- 크루 규모: ${input.crew_preference}
- 희망 마감: ${input.deadline}
- 추가 요청: ${input.extra_notes}

요구사항:
- 한국어 한 문장으로만 답하기
- "~한, 시네마틱 브랜딩 필름" 이런 식으로 감독의 의도를 써주기
- 최대 60자 이내.
    `.trim();

    let aiSummary = "";
    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "너는 시니어 영상 감독이다." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      });

      aiSummary =
        completion.choices?.[0]?.message?.content?.trim() ||
        "AI 요약을 가져오지 못했습니다.";
    } catch (aiErr) {
      console.error("OpenAI 호출 오류:", aiErr);
      aiSummary = "AI 요약 생성 중 오류가 발생했습니다.";
    }

    // 4) HTML 생성 (기존 샘플 + AI 요약 한 섹션 추가)
    const safeNotes = (input.extra_notes || "입력 없음")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>AI 스틸컷 추천 결과</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #07080b;
      color: #f5f5f5;
      line-height: 1.6;
    }
    .wrapper {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 16px 64px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      margin-bottom: 24px;
    }
    .logo { font-size: 14px; font-weight: 700; letter-spacing: 0.15em; }
    .tagline { font-size: 12px; opacity: 0.8; }

    h1 { font-size: 24px; margin-bottom: 8px; }
    .pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.18);
      font-size: 12px;
      opacity: 0.9;
      margin-right: 6px;
      margin-bottom: 4px;
    }
    section {
      margin-top: 20px;
      padding: 18px 16px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.18);
      background: radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 55%),
                  radial-gradient(circle at bottom right, rgba(255,255,255,0.06), transparent 55%);
    }
    h2 { font-size: 18px; margin-bottom: 10px; }
    .label { font-size: 12px; opacity: 0.7; margin-bottom: 2px; }
    .value { font-size: 14px; margin-bottom: 6px; }
    .back-link {
      display: inline-block;
      margin-top: 24px;
      font-size: 13px;
      opacity: 0.8;
      text-decoration: none;
      color: #7BA5FF;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <header>
      <div class="logo">FIDUCIA · AI STILLCUT</div>
      <div class="tagline">스틸컷 · 장비 · 일정 추천</div>
    </header>

    <main>
      <h1>AI 스틸컷 설계 결과 (1단계)</h1>
      <p style="font-size:13px; opacity:0.85;">
        지금은 전체 구조 테스트 단계로, 아래 요약 문장은 실제 OpenAI가 생성한 내용입니다.
        이 구조 위에 스틸컷/장비/일정을 단계적으로 확장할 거예요.
      </p>

      <section>
        <h2>프로젝트 요약</h2>
        <div class="pill">${input.video_type || "영상 타입 미입력"}</div>
        <div class="pill">${input.project_length || "길이 미입력"}</div>
        <div class="pill">${input.budget_level || "예산 미입력"}</div>
        <div class="pill">${input.crew_preference || "크루 규모 미입력"}</div>

        <div style="margin-top:12px;">
          <div class="label">영상 링크</div>
          <div class="value">${input.video_url || "입력 없음"}</div>

          <div class="label">무드 / 톤</div>
          <div class="value">${input.mood || "입력 없음"}</div>

          <div class="label">로케이션</div>
          <div class="value">${input.location_type || "입력 없음"}</div>

          <div class="label">희망 마감 시점</div>
          <div class="value">${input.deadline || "입력 없음"}</div>

          <div class="label">추가 요청사항</div>
          <div class="value">${safeNotes}</div>
        </div>
      </section>

      <section>
        <h2>AI 한 줄 요약</h2>
        <p style="font-size:14px; opacity:0.95;">
          ${aiSummary}
        </p>
      </section>

      <section>
        <h2>샘플 안내</h2>
        <p style="font-size:13px; opacity:0.9;">
          · 다음 단계에서는 이 요약을 기반으로 스틸컷 후보, 장비 구성, 촬영/편집 일정을 세분화해서 제공합니다.<br/>
          · 지금은 OpenAI 연결과 전체 플로우가 정상 동작하는지 확인하는 1단계 버전입니다.
        </p>
      </section>

      <a href="/" class="back-link">← 다시 입력 페이지로 돌아가기</a>
    </main>
  </div>
</body>
</html>
    `;

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html,
    };
  } catch (err) {
    console.error("stillcut 함수 전체 오류:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "서버에서 예기치 못한 오류가 발생했습니다.",
    };
  }
};

