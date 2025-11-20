// 예약 폼 제출 시 처리
document.getElementById('reservation-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const form = new FormData(this);
    const data = {
        name: form.get('name'),
        contact: form.get('contact'),
    };

    // 예약 데이터를 처리하거나 카카오톡 API로 보내는 코드 추가
    console.log('예약 데이터:', data);
    
    // 예약 성공 메시지
    alert('예약이 완료되었습니다!');
});