// Cấu hình Firebase (Dựa trên thông tin bạn đã cung cấp)
const firebaseConfig = {
    apiKey: "AIzaSyCmYBElBsb4bl8wR8_2Oct-auZTk4wgPyo",
    authDomain: "projectaz-d4150.firebaseapp.com",
    projectId: "projectaz-d4150",
    storageBucket: "projectaz-d4150.firebasestorage.app",
    messagingSenderId: "607007709132",
    appId: "1:607007709132:web:c4b67bcdf245cf58e76f69"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const quizListContainer = document.getElementById('quiz-list');

// Hàm lấy danh sách Quiz (Chỉ lấy, không sửa/xóa)
async function loadPublicQuizzes() {
    try {
        const snapshot = await db.collection("quizzes").get();
        quizListContainer.innerHTML = ''; // Xóa dòng chữ loading

        if (snapshot.empty) {
            quizListContainer.innerHTML = '<p class="loading-shimmer">Hiện chưa có bài Quiz nào được xuất bản.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const quiz = doc.data();
            const quizId = doc.id;
            renderQuizCard(quizId, quiz);
        });
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
        quizListContainer.innerHTML = '<p class="loading-shimmer">Không thể kết nối dữ liệu. Vui lòng thử lại sau.</p>';
    }
}

// Hàm render thẻ Quiz theo phong cách Minimal
function renderQuizCard(id, data) {
    const card = document.createElement('div');
    card.className = 'quiz-card';
    
    // Khi click vào thẻ sẽ chuyển đến trang làm bài của bạn
    card.onclick = () => {
        window.location.href = `start-quiz.html?id=${id}`;
    };

    card.innerHTML = `
        <div>
            <h3>${data.title || 'Chưa đặt tên'}</h3>
            <p>${data.topic || 'Chủ đề tổng hợp'}</p>
        </div>
        <div class="quiz-info">
            <span>${data.questions || 0} Câu hỏi</span>
            <span>Bắt đầu →</span>
        </div>
    `;

    quizListContainer.appendChild(card);
}

// Chạy hàm tải khi trang web sẵn sàng
document.addEventListener('DOMContentLoaded', loadPublicQuizzes);