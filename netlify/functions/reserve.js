// netlify/functions/reserve.js
// 예약 폼에서 받은 정보를 Notion Reservation DB 에 저장하는 함수

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = process.env.NOTION_VERSION || "2022-06-28";
const RESERVATION_DB_ID = process.env.NOTION_RESERVATION_DB_ID;

exports.handler = async (event) => {
  // 1) 메서드 체크 (POST 만 허용)
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "POST 메서드만 지원합니다." }),
    };
  }

  if (!NOTION_API_KEY || !RESERVATION_DB_ID) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Notion 환경변수(NOTION_API_KEY / NOTION_RESERVATION_DB_ID)가 설정되지 않았습니다.",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "잘못된 JSON 형식입니다." }),
    };
  }

  const {
    name,
    contact,
    projectType,
    budget,
    preferredDate,
    location,
    message,
  } = payload;

  if (!name || !contact || !message) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "name, contact, message 는 필수입니다." }),
    };
  }

  // 2) Notion DB 에 저장할 properties 구성
  const notionBody = {
    parent: { database_id: RESERVATION_DB_ID },
    properties: {
      // Name: 제목 컬럼 (타입: title)
      Name: {
        title: [
          {
            text: { content: name },
          },
        ],
      },

      // Contact: 연락처 (타입: rich text)
      Contact: {
        rich_text: [
          {
            text: { content: contact },
          },
        ],
      },

      // ProjectType: 프로젝트 종류 (타입: select 권장)
      ProjectType: projectType
        ? {
            select: { name: projectType },
          }
        : undefined,

      // Budget: 예산 (타입: select 권장)
      Budget: budget
        ? {
            select: { name: budget },
          }
        : undefined,

      // PreferredDate: 희망 날짜 (타입: date)
      PreferredDate: preferredDate
        ? {
            date: {
              start: preferredDate, // "YYYY-MM-DD"
            },
          }
        : undefined,

      // Location: 장소 (타입: rich text)
      Location: location
        ? {
            rich_text: [
              {
                text: { content: location },
              },
            ],
          }
        : undefined,

      // Message: 상세 요청 (타입: rich text)
      Message: {
        rich_text: [
          {
            text: { content: message },
          },
        ],
      },

      // Status: 상태 (타입: status or select) – 신규 접수로 기본값 설정
      Status: {
  select: { name: "신규 접수" },
},
    },
  };

  // undefined 프로퍼티 제거 (Notion은 undefined 있으면 에러는 안 나도 지저분해서 정리)
  Object.keys(notionBody.properties).forEach((key) => {
    if (notionBody.properties[key] === undefined) {
      delete notionBody.properties[key];
    }
  });

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notionBody),
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("Notion 예약 생성 실패:", text);
      return {
        statusCode: res.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Notion API 요청 실패 (reserve)",
          detail: text,
        }),
      };
    }

    // 성공
    const json = JSON.parse(text);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        id: json.id,
      }),
    };
  } catch (err) {
    console.error("reserve 함수 내부 오류:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "서버 내부 오류 (reserve)",
        detail: String(err),
      }),
    };
  }
};