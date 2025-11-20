const axios = require('axios');  // Axios를 사용하여 HTTP 요청 처리

// Notion API 설정
const notionApiUrl = 'https://api.notion.com/v1/pages';
const notionApiKey = process.env.NOTION_API_KEY;  // Notion API 키
const notionDatabaseId = process.env.NOTION_DATABASE_ID;  // Notion 데이터베이스 ID

// 예약 정보를 Notion에 추가하는 함수
async function addReservationToNotion(data) {
  const notionData = {
    parent: { database_id: notionDatabaseId },
    properties: {
      '예약자 이름': {
        title: [
          {
            text: {
              content: data.name,
            },
          },
        ],
      },
      '연락처': {
        rich_text: [
          {
            text: {
              content: data.contact,
            },
          },
        ],
      },
      '프로젝트 종류': {
        select: {
          name: data.previewInfo,
        },
      },
      '예산': {
        select: {
          name: data.budget,
        },
      },
      '촬영 날짜': {
        date: {
          start: data.shootDate,
        },
      },
      '촬영 장소': {
        rich_text: [
          {
            text: {
              content: data.shootLocation,
            },
          },
        ],
      },
      '요청 사항': {
        rich_text: [
          {
            text: {
              content: data.requestDetails,
            },
          },
        ],
      },
      '스틸컷 이미지': {
        files: [
          {
            type: 'external',
            name: '스틸컷 이미지',
            external: { url: data.previewImage }
          }
        ]
      }
    },
  };

  try {
    const response = await axios.post(notionApiUrl, notionData, {
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2021-05-13',
      },
    });
    console.log('Reservation added to Notion:', response.data);
  } catch (error) {
    console.error('Error adding reservation to Notion:', error);
  }
}

exports.handler = async (event) => {
  const data = JSON.parse(event.body);  // 폼에서 받은 데이터
  await addReservationToNotion(data);  // Notion에 예약 정보 저장

  return {
    statusCode: 200,
    body: JSON.stringify({ message: '예약 요청이 Notion에 저장되었습니다!' }),
  };
};