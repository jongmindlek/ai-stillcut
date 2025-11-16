// netlify/functions/stillcut.js

exports.handler = async (event) => {
  // 1) GET으로 들어오면 안내만 보여주기
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "이 엔드포인트는 폼을 통해 POST 요청으로만 사용됩니다.",
    };
  }

  try {
    // 2) 폼 데이터 파싱 (application/x-www-form-urlencoded)
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

    // 3) 일단은 "가짜 AI 결과"를 만들어서 보여주기
    //    (우선 전체 흐름이 잘 도는지 확인하는 단계)
    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>AI 스틸컷 추천 결과 (샘플)</title>
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
      <div class="tagline">스틸컷 · 장비 · 일정 추천 (샘플 결과)</div>
    </header>

    <main>
      <h1>샘플 스틸컷·장비·일정 설계 결과</h1>
      <p style="font-size:13px; opacity:0.85;">
        지금은 전체 흐름 테스트용으로, 입력하신 정보를 바탕으로
        요약만 보여주는 버전입니다. AI 자동 추천 버전은
        이 구조 위에 <strong>브레인만 교체하면</strong> 바로 붙일 수 있어요.
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
          <div class="value">${(input.extra_notes || "입력 없음")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/\\n/g,"<br>")}</div>
        </div>
      </section>

      <section>
        <h2>샘플 제안 (임시)</h2>
        <p style="font-size:13px; opacity:0.9;">
          · 입력하신 무드와 예산, 크루 규모를 기준으로 실제 AI가
          스틸컷 후보, 장비 구성, 촬영/편집 일정을 자동으로 설계하게 됩니다.<br/>
          · 현재는 <strong>구조 테스트용</strong>이라, 서버 에러 없이 잘 연결되는지만 확인하는 버전입니다.
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
    console.error("stillcut 함수 오류:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "서버에서 예기치 못한 오류가 발생했습니다.",
    };
  }
};
