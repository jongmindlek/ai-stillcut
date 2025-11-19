// netlify/functions/directors.js
// FIDUCIA People DB에서 Published=true 인 사람들 중 Type=director 만 추려서 반환

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
    // Published = true 전체 가져오기
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
    const getUrl = (p) => p?.url || "";

    const items = (data.results || [])
      .filter((page) => {
        const props = page.properties || {};
        const typeName = getSelect(props.Type);
        return typeName === "director";
      })
      .map((page) => {
        const props = page.properties || {};
        return {
          id: page.id,
          name: getTitle(props.Name),
          type: getSelect(props.Type),
          roles: getMultiSelect(props.Roles),
          level: getSelect(props.Level),
          main_gear: getRichText(props.MainGear),
          bio: getRichText(props.Bio),
          available_days: getRichText(props.AvailableDays),
          tags: getMultiSelect(props.Tags),
          profile_image_url: getUrl(props.ProfileImageURL),
          portfolio_url: getUrl(props.PortfolioURL),
          instagram: getUrl(props.Instagram),
          schedule_url: getUrl(props.ScheduleURL)
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