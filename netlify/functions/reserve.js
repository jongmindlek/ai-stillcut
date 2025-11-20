// netlify/functions/reserve.js
const axios = require('axios');

// 카카오톡 메시지 보내는 함수
async function sendMessageToKakao(userMessage) {
  const apiKey = process.env.KAKAO_ACCESS_TOKEN;  // Netlify 환경 변수에서 API 키 가져오기
  const kakaoApiUrl = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';

  const data = {
    object_type: 'text',
    text: userMessage, // 예약 정보
    link: {
      web_url: 'https://your-website.com/confirmation',  // 예약 확인 링크
      mobile_web_url: 'https://your-website.com/confirmation',
    },
    button_title: '예약 확인하기'
  };

  try {
    const response = await axios.post(kakaoApiUrl, data, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,  // 환경 변수에서 API 액세스 토큰을 사용
      }
    });
    console.log('Message sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending message to Kakao:', error);
  }
}

// 예약 요청을 처리하는 함수
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'POST method is required.' }),
    };
  }

  // 폼 데이터 받아오기
  const payload = JSON.parse(event.body);
  const { name, contact, message } = payload;

  if (!name || !contact || !message) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Name, contact, and message are required.' }),
    };
  }

  const userMessage = `
    이름: ${name}
    연락처: ${contact}
    요청사항: ${message}
  `;

  await sendMessageToKakao(userMessage);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: '예약 요청이 접수되었습니다!' }),
  };
};