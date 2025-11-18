// netlify/functions/directors.js
// Notion FIDUCIA PEOPLE DB에서 Type = director 인 사람들만 읽어서 반환

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DB_ID = process.env.NOTION_STAFF_DB_ID; // 같은 DB 재사용
const NOTION_VERSION = "2022-06-28";

exports.handler = async (event) => {
  // GET만 허용
  if (event.httpMethod !== "GET") {
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
      body: JSON.stringify({ error: "Notion 환경변수가 설정되어 있지 않습니다." })
    };
  }

  try {
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
            and: [
              { property: "Published", checkbox: { equals: true } },
              { property: "Type", select: { equals: "director" } }
            ]
          }
        })
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Notion API 오류 (directors):", res.status, text);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          error: "Notion API 요청 실패 (directors)",
          detail: text
        })
      };
    }

    const data = await res.json();

    const items = (data.results || []).map((page) => {
      const props = page.properties || {};

      const getTitle = (p) => p?.title?.[0]?.plain_text || "";
      const getRichText = (p) =>
        p?.rich_text?.map((r) => r.plain_text).join(" ") || "";
      const getSelect = (p) => p?.select?.name || "";
      const getMultiSelect = (p) =>
        (p?.multi_select || []).map((o) => o.name);
      const getUrl = (p) => p?.url || "";

      return {
        id: page.id,
        name: getTitle(props.Name),                 // 이름
        roles: getMultiSelect(props.Roles),         // 연출 / 촬영 / 조명 / 편집 등
        level: getSelect(props.Level),              // Director / DOP …
        main_gear: getRichText(props.MainGear),     // 주 카메라/렌즈 등
        tags: getMultiSelect(props.Tags),           // 태그
        portfolio_url: getUrl(props.PortfolioUrl),  // 포트폴리오 링크
        schedule_url: getUrl(props.ScheduleUrl),    // 개인 스케줄 링크
        instagram: getUrl(props.Instagram)          // 인스타
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
        error: "서버 내부 오류 (directors)",
        detail: String(err)
      })
    };
  }
};