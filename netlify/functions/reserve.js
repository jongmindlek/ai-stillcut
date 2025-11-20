// netlify/functions/reserve.js
// 카카오톡 API로 메시지 보내는 함수

const axios = require('axios');

// 카카오톡 메시지 보내는 함수
const sendMessageToKakao = async (userMessage) => {
  try {
    const response = await axios.post('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      template_object: {
        object_type: 'text',
        text: `예약 요청: ${userMessage}`,  // 예약 정보
        link: {
          web_url: 'https://your-website.com/confirmation',  // 예약 확인 링크
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.KAKAO_ACCESS_TOKEN}`  // 여기에 환경 변수로 설정한 카카오톡 API 액세스 토큰을 넣습니다
      }
    });
    console.log('Message sent:', response.data);
  } catch (error) {
    console.error('Error sending message to Kakao:', error);
  }
};

// 예약 정보 예시
exports.handler = async (event) => {
  // POST 메소드만 처리
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "POST 메서드만 지원합니다." }),
    };
  }

  // 폼 데이터 받아오기
  const payload = JSON.parse(event.body);
  const { name, contact, projectType, budget, preferredDate, location, message } = payload;

  // 필수 항목 확인
  if (!name || !contact || !message) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "name, contact, message 는 필수입니다." }),
    };
  }

  // 예약 메시지 형식
  const userMessage = `
    이름: ${name}
    연락처: ${contact}
    프로젝트 종류: ${projectType || "미제공"}
    예산: ${budget || "미제공"}
    희망 일정: ${preferredDate || "미제공"}
    촬영 장소: ${location || "미제공"}
    상세 요청: ${message}
  `;

  // 카카오톡 메시지 전송
  await sendMessageToKakao(userMessage);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "예약 요청이 접수되었습니다!" }),
  };
};