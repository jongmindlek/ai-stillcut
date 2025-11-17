// netlify/functions/stillcut.js
// ✅ OpenAI 전부 제거
// ✅ HuggingFace 텍스트 + 이미지로만 작동하는 버전

// HTML 이스케이프 함수
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// HuggingFace 텍스트 생성 호출
async function generateTextFromHF(prompt) {
  if (!process.env.HF_API_KEY) {
    throw new Error("HF_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const res = await fetch(
    "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 400,
          temperature: 0.8,
        },
      }),
    }
  );

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`HuggingFace 텍스트 API 오류: ${res.status} ${msg}`);
  }

  const data = await res.json();
  // HF text-generation은 보통 [{ generated_text: "..." }] 형태로 옴
  let text = "";
  if (Array.isArray(data) && data[0]?.generated_text) {
    text = data[0].generated_text;
  } else if (data.generated_text) {
    text = data.generated_text;
  } else {
    text = JSON.stringify(data);
  }
  return text.trim();
}

// HuggingFace 이미지 생성 호출 (Stable Diffusion)
async function generateImageFromHF(prompt) {
  if (!process.env.HF_API_KEY) {
    throw new Error("HF_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const res = await fetch(
    "https://api-inference.huggingface.co/models/stabilityai/sdxl-base-1.0",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  );

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`HuggingFace 이미지 API 오류: ${res.status} ${msg}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:image/png;base64,${base64}`;
}

exports.handler = async (event) => {
  // GET 요청이면 안내만
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "이 엔드포인트는 폼을 통해 POST 요청으로만 사용됩니다.",
    };
  }

  try {
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

    const safeNotes = escapeHtml(input.extra_notes || "입력 없음").replace(
      /\n/g,
      "<br>"
    );

    // 2) 텍스트 프롬프트 만들기 (요약 + 샷리스트)
    const textPrompt = `
너는 상업 영상/브랜딩/웨딩을 많이 찍어본 시니어 감독이야.
아래 프로젝트 정보를 보고,

1) 프로젝트 전체를 한 문장으로 요약 (감독 메모 느낌, 60자 내외)
2) 스틸컷 후보 4~6개를 "번호. 내용" 형태로 작성
   - 각 번호마다: 컷 이름 / 샷 타입 / 카메라 움직임 / 간단한 설명 정도를 한 줄로 묶어서 써줘.
   - 예: "1. 오프닝 무드 인서트 - WS / 슬로우 패닝 - 공간 전체 분위기 소개"

형식 예시는 아래와 비슷하게:

요약: ~~~~
스틸컷 후보:
1. ...
2. ...
3. ...

[프로젝트 정보]
- 영상 종류: ${input.video_type}
- 무드/톤: ${input.mood}
- 영상 길이: ${input.project_length}
- 로케이션: ${input.location_type}
- 예산: ${input.budget_level}
- 크루 규모: ${input.crew_preference}
- 희망 마감: ${input.deadline}
- 추가 요청: ${input.extra_notes}
    `.trim();

    let summary = "요약을 가져오지 못했습니다.";
    let cutsText = "스틸컷 후보를 가져오지 못했습니다.";

    try {
      const rawText = await generateTextFromHF(textPrompt);

      // "요약:" / "스틸컷 후보:" 기준으로 대충 나누기
      // 모델 답변 형식이 약간 달라도 어느 정도 유연하게 처리
      const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      let summaryLine = lines.find((l) => l.startsWith("요약")) || lines[0] || "";
      summaryLine = summaryLine.replace(/^요약[:：]\s*/, "");
      if (!summaryLine) summaryLine = rawText.slice(0, 80);

      const startIdx = lines.findIndex((l) => l.startsWith("스틸컷 후보"));
      let cutLines = [];
      if (startIdx >= 0) {
        cutLines = lines.slice(startIdx + 1);
      } else {
        // "1."로 시작하는 줄들만 모으기
        cutLines = lines.filter((l) => /^[0-9]+\./.test(l));
      }
      if (cutLines.length === 0) {
        cutLines = lines.slice(1); // 그냥 요약 빼고 나머지 다
      }

      summary = summaryLine.trim();
      cutsText = cutLines.join("\n");
      if (!cutsText.trim()) {
        cutsText = rawText;
      }
    } catch (e) {
      console.error("HF 텍스트 생성 오류:", e);
      summary = "텍스트 생성 중 오류가 발생했습니다.";
      cutsText =
        (e && e.message) || "HuggingFace 텍스트 API 오류로 스틸컷 리스트를 생성하지 못했습니다.";
    }

    // 3) 대표 스틸컷 이미지 프롬프트
    let heroImageUrl = null;
    let heroImageError = null;

    const imagePrompt = `
${input.video_type || "영상"}의 대표 스틸컷 콘셉트.
무드: ${input.mood || "감성적인"}
로케이션: ${input.location_type || "실내/야외"}
설명: ${summary || "시네마틱한 브랜드/웨딩/뮤직비디오 느낌"}

영화 스틸컷 같은 시네마틱 사진, 고해상도, 사실적인 스타일.
    `.trim();

    try {
      heroImageUrl = await generateImageFromHF(imagePrompt);
    } catch (e) {
      console.error("HF 이미지 생성 오류:", e);
      heroImageUrl = null;
      heroImageError =
        (e && e.message) || "HuggingFace 이미지 API 오류로 대표 이미지를 생성하지 못했습니다.";
    }

    // 4) HTML 렌더링
    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>AI 스틸컷 추천 결과 (HuggingFace)</title>
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
    pre {
      white-space: pre-wrap;
      font-size: 13px;
      background: rgba(0,0,0,0.35);
      padding: 10px;
      border-radius: 10px;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <header>
      <div class="logo">FIDUCIA · AI STILLCUT</div>
      <div class="tagline">HuggingFace 기반 스틸컷 · 요약 생성</div>
    </header>

    <main>
      <h1>AI 스틸컷 설계 결과 (HF 버전)</h1>
      <p style="font-size:13px; opacity:0.85;">
        텍스트와 이미지는 모두 HuggingFace Inference API를 통해 생성된 결과입니다.
        (OpenAI는 전혀 사용하지 않습니다.)
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
        <h2>AI 스틸컷 후보 (텍스트)</h2>
        <pre>${escapeHtml(cutsText)}</pre>
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