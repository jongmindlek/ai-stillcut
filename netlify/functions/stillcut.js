// netlify/functions/stillcut.js
// ✅ 텍스트: OpenAI + 로컬 규칙 fallback
// ✅ 이미지: OpenAI 호출 없음(그라디언트 박스만 사용, 에러/요금 걱정 X)

// HTML 이스케이프
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 🔹 로컬 요약 (fallback)
function makeSummaryLocal(input) {
  const type = input.video_type || "프로젝트";
  const mood = input.mood || pickOne(["감성적인", "시네마틱한", "따뜻한", "도시적인"]);
  const len = input.project_length || "1~3분";
  const loc = input.location_type || "한 공간에서";

  const endings = [
    "담아내는 시네마틱 필름",
    "섬세하게 포착하는 무드 필름",
    "브랜드의 결을 보여주는 영상",
    "감정을 오래 남기는 영상",
  ];

  return `${mood} 톤으로 ${len} 분량의 ${type}을(를) ${loc} ${pickOne(endings)}`;
}

// 🔹 로컬 샷리스트 (fallback)
function makeCutsLocal(input) {
  const type = input.video_type || "";
  const mood = input.mood || "감성적인";
  const loc = input.location_type || "공간";

  const baseTech = [
    "S-Log3 기준, 노출 안전하게, 기본 짐벌+삼각대 세팅.",
    "프레임 구도 먼저 잡고, 사람/오브젝트 동선을 고려.",
    "컬러는 나중 보정 전제, 촬영 시 노출/콘트라스트에만 집중.",
  ];

  const cuts = [];

  if (type.includes("웨딩")) {
    cuts.push(
      {
        cut_title: "신부/신랑 디테일 인서트",
        shot_type: "CU / 인서트",
        movement: pickOne(["고정 샷", "아주 미세한 핸드헬드"]),
        description: `드레스, 부케, 반지 등의 디테일을 ${mood} 톤으로 담아 오프닝 무드를 만드는 컷.`,
        tech_note: "50mm 근접, 얕은 심도, 피부/하이라이트 관리. " + pickOne(baseTech),
      },
      {
        cut_title: "식장 전체 분위기 와이드",
        shot_type: "WS",
        movement: pickOne(["느린 패닝", "슬로우 짐벌 인"]),
        description: `${loc} 전체 구조와 하객 분위기를 한 번에 보여주는 인트로 / 브릿지 컷.`,
        tech_note: "24~35mm 광각, 수평/수직 라인 정리. " + pickOne(baseTech),
      },
      {
        cut_title: "서약/하이라이트 클로즈업",
        shot_type: "MCU / CU",
        movement: pickOne(["고정 샷", "아주 천천히 인"]),
        description: "표정·눈빛·손의 떨림 등 감정이 드러나는 순간을 붙잡는 핵심 스틸컷.",
        tech_note: "85mm 전후 망원, F2 전후, 얼굴 노출 안정. " + pickOne(baseTech),
      },
      {
        cut_title: "식 후 하객 축하 무드",
        shot_type: "MS / 2SHOT / 군중샷",
        movement: pickOne(["핸드헬드 워킹", "가벼운 짐벌 워크"]),
        description: "대화, 웃음, 포옹 등 전체적인 행복한 공기를 담는 컷.",
        tech_note: "35mm 근처, 셔터 1/100 이상으로 흔들림 관리. " + pickOne(baseTech),
      }
    );
  } else if (type.includes("뮤직")) {
    cuts.push(
      {
        cut_title: "오프닝 무드 인트로",
        shot_type: "WS / MS",
        movement: pickOne(["슬로우 짐벌 워킹", "고정 샷"]),
        description: `${loc}의 질감과 조명을 이용해 곡 분위기를 먼저 깔아주는 인서트 컷.`,
        tech_note: "광각+약간의 스모그/백라이트 좋음. " + pickOne(baseTech),
      },
      {
        cut_title: "메인 퍼포먼스 샷",
        shot_type: "MS / 2SHOT",
        movement: pickOne(["고정 샷", "리듬에 맞춘 미세한 핸드헬드"]),
        description: "노래/랩을 풀로 담는 기준 컷. 편집에서 가장 많이 돌아오는 메인 스틸컷.",
        tech_note: "35~50mm, 곡 템포에 맞는 셔터/셔터앵글. " + pickOne(baseTech),
      },
      {
        cut_title: "클로즈업 리액션",
        shot_type: "CU / ECU",
        movement: "고정 샷",
        description: "입 모양, 눈빛, 손짓 등 감정이 살아 있는 부분을 타이트하게 잡는 컷.",
        tech_note: "85mm 근접, 눈 하이라이트/피부 톤 우선. " + pickOne(baseTech),
      },
      {
        cut_title: "B-roll 무브먼트",
        shot_type: "MS / WS",
        movement: pickOne(["짐벌 인/아웃", "핸드헬드 워크"]),
        description: "리듬감 있는 움직임으로 편집 템포를 살리는 B-roll용 스틸컷.",
        tech_note: "셔터/프레임레이트를 곡 분위기에 맞게. " + pickOne(baseTech),
      }
    );
  } else if (type.includes("브랜딩")) {
    cuts.push(
      {
        cut_title: "브랜드 공간 와이드",
        shot_type: "WS",
        movement: pickOne(["천천히 인", "느린 패닝"]),
        description: `${loc} 전체 구조와 브랜드의 첫인상을 동시에 보여주는 오프닝 컷.`,
        tech_note: "24~35mm, 수평/수직 정확히. " + pickOne(baseTech),
      },
      {
        cut_title: "키 비주얼·로고 디테일",
        shot_type: "CU / 인서트",
        movement: "고정 샷",
        description: "로고, 제품, 상징 오브젝트를 상징적으로 담는 인서트.",
        tech_note: "50mm 이상, 얕은 심도, 조명으로 포인트. " + pickOne(baseTech),
      },
      {
        cut_title: "사용자/제작자 스토리",
        shot_type: "MS / MCU",
        movement: pickOne(["고정 샷", "아주 미세한 인"]),
        description: "브랜드를 사용하는 사람/만드는 사람의 행동과 표정을 담는 컷.",
        tech_note: "인물 노출/피부 톤 중심 세팅. " + pickOne(baseTech),
      },
      {
        cut_title: "마감 시그니처 샷",
        shot_type: "WS / MS",
        movement: pickOne(["슬로우 인", "슬로우 아웃"]),
        description: "슬로건/키 메시지가 들어갈 자리를 남기며 정리해 주는 엔딩 컷.",
        tech_note: "로고/카피 위치를 고려한 프레이밍. " + pickOne(baseTech),
      }
    );
  } else {
    cuts.push(
      {
        cut_title: "공간 무드 와이드",
        shot_type: "WS",
        movement: pickOne(["느린 패닝", "고정 샷"]),
        description: `${loc} 전체 분위기를 한 번에 보여주는 오프닝/브릿지용 컷.`,
        tech_note: pickOne(baseTech),
      },
      {
        cut_title: "핵심 액션/장면",
        shot_type: "MS",
        movement: pickOne(["고정 샷", "간단한 인/아웃"]),
        description: "영상 목적을 가장 잘 보여주는 행동/상황을 정면으로 담는 컷.",
        tech_note: pickOne(baseTech),
      },
      {
        cut_title: "디테일 인서트",
        shot_type: "CU / 인서트",
        movement: "고정 샷",
        description: "손, 오브젝트, 화면 등 디테일을 클로즈업으로 채워주는 컷.",
        tech_note: "프레임 안 정리, 반사/난반사 체크. " + pickOne(baseTech),
      },
      {
        cut_title: "마무리 리액션/뷰",
        shot_type: "MS / WS",
        movement: pickOne(["천천히 아웃", "고정 샷"]),
        description: "영상의 여운을 남기는 마무리 컷. 후반부/엔딩에 사용.",
        tech_note: pickOne(baseTech),
      }
    );
  }

  return cuts;
}

// 🔹 OpenAI 텍스트 (요약 + 샷리스트)
async function makeWithOpenAI(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 미설정");

  const userPrompt = `
너는 상업 영상/웨딩/브랜딩을 많이 찍어본 시니어 감독이야.
아래 프로젝트 정보를 보고,

1) 프로젝트 전체를 한 문장으로 요약 (감독 메모 느낌, 60자 내외)
2) 스틸컷 후보 4~6개를 JSON 배열로 작성

각 스틸컷 객체는 다음 필드를 포함:
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

반드시 아래 JSON 형식으로만, 코드블록 없이 순수 JSON으로 응답해:
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "너는 상업 영상/브랜딩/웨딩을 많이 찍어본 시니어 감독이다.",
        },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`OpenAI 텍스트 API 오류: ${res.status} ${msg}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || "{}";
  const data = JSON.parse(content);

  return {
    summary: data.summary,
    cuts: Array.isArray(data.cuts) ? data.cuts : [],
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "이 엔드포인트는 폼을 통해 POST 요청으로만 사용됩니다.",
    };
  }

  try {
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

    // 기본값: 로컬 엔진
    let summary = makeSummaryLocal(input);
    let cuts = makeCutsLocal(input);
    let usedOpenAI = false;

    // OpenAI 시도
    try {
      const ai = await makeWithOpenAI(input);
      if (ai.summary) summary = String(ai.summary).trim();
      if (ai.cuts && ai.cuts.length > 0) {
        cuts = ai.cuts.slice(0, 6);
      }
      usedOpenAI = true;
    } catch (e) {
      console.error("OpenAI 호출 실패, 로컬 fallback 사용:", e.message || e);
    }

    const safeNotes = escapeHtml(input.extra_notes || "입력 없음").replace(
      /\n/g,
      "<br>"
    );

    const cutsHtml = cuts
      .map((cut, idx) => {
        return `
        <div style="margin-bottom:14px; padding:12px 10px; border-radius:12px; background:rgba(0,0,0,0.35);">
          <div style="font-size:13px; opacity:0.75; margin-bottom:2px;">컷 ${idx + 1}</div>
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
      .join("");

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
    .placeholder-img {
      width: 100%;
      height: 180px;
      border-radius: 18px;
      margin-top: 12px;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #3A6CF3, #7BA5FF);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <header>
      <div class="logo">FIDUCIA · AI STILLCUT</div>
      <div class="tagline">스틸컷 · 샷리스트 자동 설계</div>
    </header>

    <main>
      <h1>스틸컷 설계 결과</h1>
      <p style="font-size:13px; opacity:0.8;">
        ${usedOpenAI
          ? "OpenAI(gpt-4o-mini)를 사용해 요약과 스틸컷 후보를 생성했습니다."
          : "현재는 로컬 규칙 기반으로 요약/샷리스트를 생성한 결과입니다."}
      </p>

      <section>
        <h2>대표 스틸컷 자리</h2>
        <div class="placeholder-img">
          대표 스틸컷 이미지 영역 (현재는 디자인용 플레이스홀더입니다)
        </div>
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
        <h2>요약 메모</h2>
        <p style="font-size:14px; opacity:0.95;">
          ${escapeHtml(summary)}
        </p>
      </section>

      <section>
        <h2>스틸컷 후보 리스트</h2>
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