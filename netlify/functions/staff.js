// netlify/functions/staff.js
// FIDUCLA People DB에서 Published = true 인 사람 중
// Type = staff 인 사람들만 골라서 반환

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
    // 1) Published = true 인 모든 사람 가져오기
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
      console.error("Notion API 오류(staff):", res.status, text);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          error: "Notion API 요청 실패(staff)",
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

    // 2) Type = "staff" 인 사람만 필터
    const items = (data.results || [])
      .filter((page) => {
        const props = page.properties || {};
        const typeName = getSelect(props.Type);
        return typeName === "staff";
      })
      .map((page) => {
        const props = page.properties || {};
        return {
          id: page.id,
          name: getTitle(props.Name),                 // 이름
          type: getSelect(props.Type),                // staff
          roles: getMultiSelect(props.Roles),         // 촬영, 조명 등
          level: getSelect(props.Level),              // 퍼스트/세컨/서드/막내
          main_gear: getRichText(props.MainGear),     // 주 장비
          bio: getRichText(props.Bio),                // 소개
          available_days: getRichText(props.AvailableDays), // 가능 요일
          tags: getMultiSelect(props.Tags)            // 태그
        };
      });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ items })
    };
  } catch (err) {
    console.error("staff 함수 처리 오류:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        error: "서버 내부 오류(staff)",
        detail: String(err)
      })
    };
  }
};