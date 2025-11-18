// netlify/functions/directors.js
// FIDUCLA People DB에서 Published = true 인 모든 사람을 읽어온 뒤,
// 그중 Type = director 인 사람만 골라서 반환

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DB_ID = process.env.NOTION_DB_ID;
const NOTION_VERSION = process.env.NOTION_VERSION || "2022-06-28";

exports.handler = async (event) => {
  if (event.httpMethod && event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "GET만 지원합니다." })
    };
  }

  if (!NOTION_API_KEY || !NOTION_DB_ID) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        error: "Notion 환경변수(NOTION_API_KEY / NOTION_DB_ID)가 설정되지 않았습니다."
      })
    };
  }

  try {
    // 1) Notion에서 Published=true 인 모든 사람 불러오기 (Type 가리지 않음)
    const res = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filter: {
            property: "Published",
            checkbox: { equals: true }
          }
        })
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Notion API 오류(directors):", res.status, text);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          error: "Notion API 요청 실패(directors)",
          detail: text
        })
      };
    }

    const data = await res.json();

    const getTitle = (p) => p?.title?.[0]?.plain_text || "";
    const getRichText = (p) =>
      (p?.rich_text || []).map((r) => r.plain_text).join(" ") || "";
    const getSelect = (p) => p?.select?.name || "";
    const getMultiSelect = (p) =>
      (p?.multi_select || []).map((o) => o.name);

    // 2) 자바스크립트 쪽에서 Type = "director" 인 사람만 필터
    const items = (data.results || [])
      .filter((page) => {
        const props = page.properties || {};
        const typeName = getSelect(props.Type); // Notion의 Type 컬럼
        return typeName === "director";
      })
      .map((page) => {
        const props = page.properties || {};
        return {
          id: page.id,
          name: getTitle(props.Name),                 // 이름
          type: getSelect(props.Type),                // director / staff 등
          roles: getMultiSelect(props.Roles),         // 연출 / 촬영 / 조명 등
          level: getSelect(props.Level),              // Director / 1st / 2nd ...
          main_gear: getRichText(props.MainGear),     // 주 장비
          bio: getRichText(props.Bio),                // 한 줄/두 줄 소개
          available_days: getRichText(props.AvailableDays), // 가능한 요일
          tags: getMultiSelect(props.Tags)            // 태그들
        };
      });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ items })
    };
  } catch (err) {
    console.error("directors 함수 처리 오류:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        error: "서버 내부 오류(directors)",
        detail: String(err)
      })
    };
  }
};