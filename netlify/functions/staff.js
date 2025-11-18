// netlify/functions/staff.js
// Notion에서 Type=staff 만 불러와 JSON으로 반환

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DB_ID = process.env.NOTION_DB_ID;
const NOTION_VERSION = "2022-06-28";

exports.handler = async () => {
  try {
    // Notion API 호출
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filter: {
          property: "Type",
          select: { equals: "staff" }
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: "Notion API 요청 실패 (staff)", detail: errText })
      };
    }

    const data = await res.json();

    // 데이터 가공
    const items = data.results.map(page => {
      const props = page.properties;

      const Name = props.Name?.title?.[0]?.plain_text ?? "";
      const Role = props.Role?.select?.name ?? "";
      const Bio = props.Bio?.rich_text?.[0]?.plain_text ?? "";
      const Tags = props.Tags?.multi_select?.map(t => t.name) ?? [];
      const AvailableDays = props.AvailableDays?.rich_text?.[0]?.plain_text ?? "";

      return { Name, Role, Bio, Tags, AvailableDays };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(items)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "서버 내부 오류 (staff)", detail: String(err) })
    };
  }
};