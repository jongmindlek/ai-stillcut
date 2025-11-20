const axios = require('axios');  // axios를 사용하여 HTTP 요청 처리

// 카카오톡 메시지 보내는 함수
async function sendMessageToKakao(userMessage, kakaoApiKey) {
  const kakaoApiUrl = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';

  const data = {
    object_type: 'text',
    text: userMessage,  // 고객이 입력한 예약 정보 메시지
    link: {
      web_url: 'https://your-website.com/reservation/',  // 예약 확인 링크
      mobile_web_url: 'https://your-website.com/reservation',
    },
    button_title: '예약 확인하기'
  };

  try {
    const response = await axios.post(kakaoApiUrl, data, {
      headers: {
        'Authorization': `Bearer ${kakaoApiKey}`,  // 카카오 API 액세스 토큰
      }
    });
    console.log('Message sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending message to Kakao:', error);
  }
}

exports.handler = async (event) => {
  const { kakaoApiKey } = process.env; // 환경변수에서 카카오 API 키 가져오기
  const { name, contact, projectType, budget, shootDate, shootLocation, requestDetails } = JSON.parse(event.body); // 클라이언트에서 보낸 예약 데이터
  
  const userMessage = `
    예약 정보:
    - 이름: ${name}
    - 연락처: ${contact}
    - 프로젝트 종류: ${projectType}
    - 예산: ${budget}
    - 촬영 날짜: ${shootDate}
    - 촬영 장소: ${shootLocation}
    - 요청 사항: ${requestDetails}
  `;

  try {
    // 카카오톡 메시지 보내기
    await sendMessageToKakao(userMessage, kakaoApiKey);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: '예약 요청이 성공적으로 전송되었습니다!' })
    };
  } catch (error) {
    console.error('예약 처리 중 오류 발생:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: '예약 처리 중 오류가 발생했습니다.' })
    };
  }
};