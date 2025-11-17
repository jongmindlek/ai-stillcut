// netlify/functions/stillcut.js

const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 간단한 HTML 이스케이프
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

exports.handler = async (event) => {
  // GET이면 안내만
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

    // 1) 폼 데이터 파싱
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

    // 2) OpenAI에 "요약 + 스틸컷 후보 JSON" 요청
    const userPrompt = `
너는 상업 영상/웨딩/브랜딩을 많이 찍어본 시니어 영상 감독이자 프로듀서야.
아래 프로젝트 정보를 바탕으로,

1) 프로젝트 한 줄 요약 (감독 메모 느낌, 60자 이내)
2) 스틸컷 후보 4~6개
   - 각 후보는 다음 정보를 포함:
     - cut_title: 컷 이름
     - shot_type: 샷 타입 (CU/MCU/WS/2SHOT 등)
     - movement: 카메라 무브
     - description: 컷 설명
     - tech_note: 카메라/렌즈/조명 메모

[프로젝트 정보]
- 영상 종류: ${input.video_type}
- 무드/톤: ${input.mood}
- 영상 길이: ${input.project_length}
- 로케이션: ${input.location_type}
- 예산: ${input.budget_level}
- 크루 규모: ${input.crew_preference}
- 희망 마감: ${input.deadline}
- 추가 요청: ${input.extra_notes}

반드시 아래 JSON 형식으로만 한국어로 응답해.
코드블록 없이 순수 JSON만:

{
  "summary": "프로젝트 한 줄 요약",
  "cuts": [
    {
      "cut_title": "...",
      "shot_type": "...",
      "movement": "...",
      "description": "...",
      "tech_note": "..."
    }
  ]
}
    `.trim();

    let summary = "";
    let cuts = [];

    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "너는 상업 영상/브랜딩/웨딩을 많이 찍어본 시니어 감독이다." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
      });

      const content = completion.choices?.[0]?.message?.content || "{}";
      const data = JSON.parse(content);

      summary = (data.summary || "").trim();
      if (!summary) summary = "AI 요약을 가져오지 못했습니다.";

      if (Array.isArray(data.cuts)) {
        cuts = data.cuts.slice(0, 6);
      }
    } catch (aiErr) {
      console.error("OpenAI 텍스트 호출/파싱 오류:", aiErr);
      summary = "AI 요약 생성 중 오류가 발생했습니다.";
      cuts = [];
    }

    // 3) 대표컷 1개 골라서 HuggingFace Stable Diffusion으로 이미지 생성
    let heroImageUrl = null;
    let heroImageError = null;

    const heroCut = cuts[0];

    if (heroCut && process.env.HF_API_KEY) {
      const imagePrompt = `
${input.video_type || "영상"}의 대표 스틸컷 콘셉트.
무드: ${input.mood || "감성적인"}
로케이션: ${input.location_type || "실내/야외"}
컷 이름: ${heroCut.cut_title || ""}
샷 타입: ${heroCut.shot_type || ""}
카메라 무브: ${heroCut.movement || ""}
컷 설명: ${heroCut.description || ""}

시네마틱, 고화질, 영화 스틸 느낌, 사실적인 사진 스타일.
      `.trim();

      try {
        // Netlify 함수는 Node 18+ 환경이라 fetch / Buffer 사용 가능
        const hfRes = await fetch(
          "https://api-inference.huggingface.co/models/stabilityai/sdxl-base-1.0",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.HF_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: imagePrompt }),
          }
        );

        if (!hfRes.ok) {
          heroImageError = `HuggingFace 상태 코드: ${hfRes.status}`;
        } else {
          const arrayBuffer = await hfRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          heroImageUrl = `data:image/png;base64,${base64}`;
        }
      } catch (imgErr) {
        console.error("HuggingFace 이미지 생성 오류:", imgErr);
        heroImageError =
          (imgErr && imgErr.message) ||
          "HuggingFace 이미지 생성 중 알 수 없는 오류";
      }
    } else if (!process.env.HF_API_KEY) {
      heroImageError = "HF_API_KEY 환경변수가 설정되지 않아 이미지를 생성할 수 없습니다.";
    }

    const safeNotes = escapeHtml(input.extra_notes || "입력 없음").replace(
      /\n/g,
      "<br>"
    );

    const cutsHtml =
      cuts.length > 0
        ? cuts
            .map((cut, idx) => {
              return `
        <div style="margin-bottom:14px; padding:12px 10px; border-radius:12px; background:rgba(0,0,0,0.35);">
          <div style="font-size:13px; opacity:0.75; margin-bottom:2px;">컷 ${
            idx + 1
          }</div>
          <div style="font-size:15px; font-weight:600; margin-bottom:4px;">
            ${escapeHtml(cut.cut_title || "제목 없음")}
          </div>
          <div style="font-size:12px; opacity:0.8; margin-bottom:6px;">
            샷: ${escapeHtml(cut.shot_type || "정보 없음")} · 무브: ${escapeHtml(
                cut.movement || "정보 없음"
              )}
          </div>
          <div style="font-size:13px; margin-bottom:4px;">
            ${escapeHtml(cut.description || "설명 없음")}
          </div>
          <div style="font-size:12px; opacity:0.75;">
            장비/기술 메모: ${escapeHtml(cut.tech_note || "메모 없음")}
          </div>
        </div>`;
            })
            .join("")
        : `<p style="font-size:13px; opacity:0.85;">스틸컷 후보를 가져오지 못했습니다.</p>`;

    // 4) HTML 렌더링
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
    .hero-img {
      width: 100%;
      border-radius: 18px;
      margin-top: 12px;
      margin-bottom: 8px;
      display: block;
      object-fit: cover;
    }
    .hint {
      font-size: 11px;
      opacity: 0.7;
      margin-top: 4px;
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
      <h1>AI 스틸컷 설계 결과</h1>
      <p style="font-size:13px; opacity:0.85;">
        입력하신 프로젝트 정보를 바탕으로 텍스트는 OpenAI, 대표 이미지는 HuggingFace Stable Diffusion으로 생성합니다.
      </p>

      <section>
        <h2>대표 스틸컷 (Stable Diffusion)</h2>
        ${
          heroImageUrl
            ? `<img src="${heroImageUrl}" alt="대표 스틸컷" class="hero-img" />`
            : `<p style="font-size:13px; opacity:0.85;">대표 이미지를 생성하지 못했습니다.</p>`
        }
        ${
          heroImageError
            ? `<div class="hint">이미지 서버 메시지: ${escapeHtml(heroImageError)}</div>`
            : ""
        }
      </section>

      <section>
        <h2>프로젝트 요약</h2>
        <div class="pill">${escapeHtml(input.video_type || "영상 타입 미입력")}</div>
        <div class="pill">${escapeHtml(input.project_length || "길이 미입력")}</div>
        <div class="pill">${escapeHtml(input.budget_level || "예산 미입력")}</div>
        <div class="pill">${escapeHtml(input.crew_preference || "크루 규모 미입력")}</div>

        <div style="margin-top:12px;">
          <div class="label">영상 링크</div>
          <div class="value">${escapeHtml(input.video_url || "입력 없음")}</div>

          <div class="label">무드 / 톤</div>
          <div class="value">${escapeHtml(input.mood || "입력 없음")}</div>

          <div class="label">로케이션</div>
          <div class="value">${escapeHtml(input.location_type || "입력 없음")}</div>

          <div class="label">희망 마감 시점</div>
          <div class="value">${escapeHtml(input.deadline || "입력 없음")}</div>

          <div class="label">추가 요청사항</div>
          <div class="value">${safeNotes}</div>
        </div>
      </section>

      <section>
        <h2>AI 한 줄 요약</h2>
        <p style="font-size:14px; opacity:0.95;">
          ${escapeHtml(summary)}
        </p>
      </section>

      <section>
        <h2>AI 스틸컷 후보</h2>
        ${cutsHtml}
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
    const msg =
      (err && err.message) ||
      JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "서버에서 예기치 못한 오류가 발생했습니다.\n\n" + msg,
    };
  }
  
};