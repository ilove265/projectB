const firebaseConfig = {
    apiKey: "AIzaSyCmYBElBsb4bl8wR8_2Oct-auZTk4wgPyo",
    authDomain: "projectaz-d4150.firebaseapp.com",
    projectId: "projectaz-d4150",
    storageBucket: "projectaz-d4150.firebasestorage.app",
    messagingSenderId: "607007709132",
    appId: "1:607007709132:web:c4b67bcdf245cf58e76f69"
  };

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();



let currentQuizData = null;
let quizSubmitted = false;
let totalQuestions = 0;

/* -------------------- Helpers -------------------- */
function getUrlParameter(name) {
    name = name.replace(/[\\[]/, '\\\\[').replace(/[\\]]/, '\\\\]');
    const regex = new RegExp('[\\\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\\+/g, ' '));
}

/* -------------------- Navigation / Sidebar -------------------- */
function jumpToQuestionByFlatIndex(flatIndex) {
    const flattened = window.__flattenedQuiz || [];
    const f = flattened[flatIndex];
    if (!f) return;
    const target = document.getElementById(`question-${f.qIndex}`);
    if (target) {
        // Scroll to the question container; if it's a statement, we still scroll to the parent question
        window.scrollTo({
            top: target.offsetTop - 100,
            behavior: 'smooth'
        });
    }
}

function renderSidebarButtons() {
    const sidebarList = document.getElementById('question-button-list');
    sidebarList.innerHTML = '';

    // Số câu thực tế (mỗi câu 1 nút)
    const questionCount = (currentQuizData || []).length;
    if (questionCount === 0) return;

    let groupNumber = 1;
    let groupDiv = document.createElement('div');
    groupDiv.classList.add('question-buttons-group');

    // Thêm tiêu đề nhóm đầu nếu có câu
    let groupHeader = document.createElement('h3');
    groupHeader.textContent = `Nhóm ${groupNumber}`;
    sidebarList.appendChild(groupHeader);
    sidebarList.appendChild(groupDiv);

    for (let i = 0; i < questionCount; i++) {
        // Tạo nút cho Câu i (hiển thị số thứ tự)
        const btn = document.createElement('a');
        btn.classList.add('question-button');
        btn.textContent = String(i + 1).padStart(2, '0');
        btn.setAttribute('data-q-index', i);

        // Khi click: scroll tới phần tử question-{i}
        btn.addEventListener('click', function () {
            const target = document.getElementById(`question-${i}`);
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        });

        groupDiv.appendChild(btn);

        // Chia nhóm mỗi 10 câu (giữ hành vi cũ)
        if ((i + 1) % 10 === 0 && i + 1 < questionCount) {
            groupNumber++;
            groupDiv = document.createElement('div');
            groupDiv.classList.add('question-buttons-group');
            groupHeader = document.createElement('h3');
            groupHeader.textContent = `Nhóm ${groupNumber}`;
            sidebarList.appendChild(groupHeader);
            sidebarList.appendChild(groupDiv);
        }
    }

    // Sau khi tạo, cập nhật trạng thái ban đầu
    updateSidebarStatusPerQuestion();
}

/* -------------------- Completion check -------------------- */
function checkCompletion() {
    if (quizSubmitted) return;
  
    const form = document.getElementById('quiz-form');
    const sidebarButtons = document.querySelectorAll('.question-button');
    const flattened = window.__flattenedQuiz || [];
    const totalDisplayQuestions = window.__totalDisplayQuestions || (currentQuizData ? currentQuizData.length : 0);
  
    // Đếm số câu đã trả lời (ít nhất 1 lựa chọn trong câu)
    let answeredQuestions = 0;
  
    for (let qIndex = 0; qIndex < (currentQuizData || []).length; qIndex++) {
      const q = currentQuizData[qIndex];
      let isAnswered = false;
  
      if (q.type === 'statements_tf') {
        // Có ít nhất một phát biểu đã chọn Đúng/Sai
        const relatedFlatIndices = [];
        flattened.forEach((f, idx) => { if (f.qIndex === qIndex) relatedFlatIndices.push(idx); });
        for (const fi of relatedFlatIndices) {
          if (form.querySelector(`input[name="item${fi}"]:checked`)) {
            isAnswered = true;
            break;
          }
        }
      } else {
        // Trắc nghiệm A/B/C/D (name="q{index}")
        const selected = form.querySelector(`input[name="q${qIndex}"]:checked`);
        if (selected) isAnswered = true;
      }
  
      if (isAnswered) {
        answeredQuestions++;
        const btn = sidebarButtons[qIndex];
        btn?.classList.add('answered');
      } else {
        const btn = sidebarButtons[qIndex];
        btn?.classList.remove('answered');
      }
    }
  
    // Cập nhật nút nộp theo số câu (không phải flattened)
    const topSubmitBtn = document.getElementById('top-submit-btn');
    if (topSubmitBtn) {
      topSubmitBtn.textContent = `HOÀN THÀNH BÀI LÀM (${answeredQuestions}/${totalDisplayQuestions})`;
    }
  }

function updateSidebarStatusPerQuestion() {
    const sidebarButtons = document.querySelectorAll('.question-button');
    const flattened = window.__flattenedQuiz || [];
    const form = document.getElementById('quiz-form');

    // Với mỗi câu (index tương ứng với nút), xác định các flattened item thuộc câu đó
    for (let qIndex = 0; qIndex < (currentQuizData || []).length; qIndex++) {
        const btn = sidebarButtons[qIndex];
        if (!btn) continue;

        // Tìm tất cả flattened indices thuộc câu qIndex
        const relatedFlatIndices = [];
        flattened.forEach((f, idx) => {
            if (f.qIndex === qIndex) relatedFlatIndices.push(idx);
        });

        // Nếu không có flattened item (câu rỗng) => remove trạng thái
        if (relatedFlatIndices.length === 0) {
            btn.classList.remove('answered', 'active', 'correct', 'wrong');
            continue;
        }

        // Kiểm tra: có bao nhiêu item đã được chọn, có bao nhiêu chưa
        let answered = 0;
        relatedFlatIndices.forEach(fi => {
            const sel = form.querySelector(`input[name="item${fi}"]:checked`);
            if (sel) answered++;
        });

        // Quy tắc hiển thị:
        // - Nếu chưa chọn item nào trong câu => remove 'answered'
        // - Nếu đã chọn ít nhất 1 => add 'answered'
        // - Sau khi nộp (quizSubmitted === true), trạng thái 'correct'/'wrong' sẽ được set trong handleSubmit
        if (!quizSubmitted) {
            if (answered === 0) {
                btn.classList.remove('answered');
            } else {
                btn.classList.add('answered');
            }
            // Xóa các trạng thái chấm điểm cũ nếu có
            btn.classList.remove('correct', 'wrong');
        } else {
            // Nếu đã nộp, trạng thái correct/wrong đã được gán trong handleSubmit cho từng flattened item.
            // Ở đây ta tổng hợp: nếu tất cả flattened items của câu đều correct => mark correct,
            // nếu có ít nhất 1 wrong => mark wrong, nếu none answered => leave neutral.
            let allCorrect = true;
            let anyWrong = false;
            relatedFlatIndices.forEach(fi => {
                const sb = document.querySelectorAll('.question-button')[fi]; // not used; we check classes on sidebar per-item not present
                // Instead, check DOM: after submit, handleSubmit sets classes on sidebarButtons[flatIndex]
                const perItemBtn = document.querySelectorAll('.question-button')[fi];
                if (perItemBtn) {
                    if (perItemBtn.classList.contains('wrong')) anyWrong = true;
                    if (!perItemBtn.classList.contains('correct')) allCorrect = false;
                } else {
                    // fallback: if no per-item info, use answered count
                    const sel = form.querySelector(`input[name="item${fi}"]:checked`);
                    if (!sel) allCorrect = false;
                }
            });

            btn.classList.remove('answered');
            btn.classList.remove('correct', 'wrong');
            if (anyWrong) btn.classList.add('wrong');
            else if (allCorrect && relatedFlatIndices.length > 0) btn.classList.add('correct');
        }
    }
}

/* -------------------- Render Quiz -------------------- */
function renderQuiz(quiz) {
    currentQuizData = quiz.questionsData;
    // Build flattened list: each statement becomes 1 item, each normal question becomes 1 item
    const flattened = [];
    currentQuizData.forEach((q, qIndex) => {
        if (q.type === 'statements_tf') {
            q.options.forEach((opt, sIndex) => {
                flattened.push({ qIndex, type: 'statement', stmtIndex: sIndex });
            });
        } else {
            flattened.push({ qIndex, type: 'question' });
        }
    });


    window.__flattenedQuiz = flattened;
    totalQuestions = flattened.length;

    document.getElementById('quiz-title-display').textContent = quiz.title;
    document.getElementById('page-title-display').textContent = `Bắt đầu Quiz - ${quiz.title}`;
    document.getElementById('quiz-topic-display').textContent = quiz.topic;
    document.getElementById('quiz-count-display').textContent = totalQuestions;

    const questionsArea = document.getElementById('questions-area');
    questionsArea.innerHTML = '';

    // Top submit button
    const submitArea = document.getElementById('submit-button-area');
    submitArea.innerHTML = `
        <button type="button" id="top-submit-btn">
            HOÀN THÀNH BÀI LÀM (0/${totalQuestions})
        </button>
    `;
    document.getElementById('top-submit-btn').addEventListener('click', handleSubmit);

    // Render each question block
    currentQuizData.forEach((q, qIndex) => {
        const item = document.createElement('div');
        item.classList.add('question-item');
        item.id = `question-${qIndex}`;
        item.setAttribute('data-q-index', qIndex);

        let html = `<h3><span style="color:#00bcd4;">Câu ${qIndex + 1}:</span> ${q.questionText}</h3>`;

        if (q.type === 'statements_tf') {
            // Each option is a statement with two radio buttons (Đúng / Sai)
            q.options.forEach((opt, sIndex) => {
                const flatIndex = window.__flattenedQuiz.findIndex(f => f.qIndex === qIndex && f.type === 'statement' && f.stmtIndex === sIndex);
                const inputName = `item${flatIndex}`;
                html += `
                    <div class="tf-statement" data-flat-index="${flatIndex}">
                        <div class="statement-text">
                                ${opt.prefix}) ${opt.content}
                            </div>
                        <div class="tf-controls">
                            <label class="tf-label" data-value="true" for="${inputName}-true-${flatIndex}">
                                <input type="radio" id="${inputName}-true-${flatIndex}" name="${inputName}" value="true" onclick="onTFSelect(${flatIndex}, true)">
                                Đúng
                            </label>
                            <label class="tf-label" data-value="false" for="${inputName}-false-${flatIndex}">
                                <input type="radio" id="${inputName}-false-${flatIndex}" name="${inputName}" value="false" onclick="onTFSelect(${flatIndex}, false)">
                                Sai
                            </label>
                        </div>
                    </div>

                `;
            });
        } else {
            // Multiple choice or true_false (2-option) — render as a group of radios
            const questionName = `q${qIndex}`;
            q.options.forEach((option, oIndex) => {
                const prefix = (option.prefix || '') + (q.optionFormat === 'letter_dot' ? '.' : ')');
                html += `
                    <label class="option-label" for="${questionName}-${oIndex}">
                        <input type="radio"
                               id="${questionName}-${oIndex}"
                               name="${questionName}"
                               value="${oIndex}"
                               onclick="checkCompletion()">
                        <span style="font-weight: 600; color: #333;">${prefix}</span>
                        ${option.content}
                    </label>
                `;
            });
        }

        item.innerHTML = html;
        questionsArea.appendChild(item);
    });
    bindOptionSelection();
    renderSidebarButtons();
    document.getElementById('quiz-form').addEventListener('change', checkCompletion);
    checkCompletion();
}
function bindOptionSelection() {
    // tất cả label dạng .option-label chứa input radio
    document.querySelectorAll('.question-item').forEach(questionEl => {
      // trong mỗi câu, lắng nghe sự kiện change trên form (delegation)
      questionEl.addEventListener('change', function (e) {
        const target = e.target;
        if (!target || target.type !== 'radio') return;
  
        // Nếu radio thuộc nhóm q{index} (ví dụ name="q0"), tìm tất cả label trong câu đó
        const labels = questionEl.querySelectorAll('.option-label');
  
        // Xóa class selected ở tất cả label trong câu
        labels.forEach(lbl => lbl.classList.remove('selected'));
  
        // Tìm label chứa input đã chọn và thêm class selected
        const chosenLabel = target.closest('label');
        if (chosenLabel && chosenLabel.classList.contains('option-label')) {
          chosenLabel.classList.add('selected');
        }
      });
    });
  }
  
/* -------------------- TF UI helper -------------------- */
function onTFSelect(flatIndex, valueTrue) {
    const container = document.querySelector(`.tf-statement[data-flat-index="${flatIndex}"]`);
    if (!container) return;

    container.querySelectorAll('.tf-label').forEach(lbl => {
        lbl.classList.remove('selected-true', 'selected-false');
    });

    const targetLabel = container.querySelector(`.tf-label[data-value="${valueTrue ? 'true' : 'false'}"]`);
    if (targetLabel) {
        targetLabel.classList.add(valueTrue ? 'selected-true' : 'selected-false');
    }

    checkCompletion();
}

/* -------------------- Submit & Scoring -------------------- */
function handleSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (quizSubmitted) return;

    quizSubmitted = true;
    const form = document.getElementById('quiz-form');
    let score = 0;

    const questionsArea = document.getElementById('questions-area');
    const resultDisplay = document.getElementById('result-display');
    const sidebarButtons = document.querySelectorAll('.question-button');
    const topSubmitBtn = document.getElementById('top-submit-btn');

    // Disable inputs and update button
    if (topSubmitBtn) {
        topSubmitBtn.disabled = true;
        topSubmitBtn.textContent = 'Đã nộp bài!';
    }
    questionsArea.querySelectorAll('input').forEach(input => input.disabled = true);

    const flattened = window.__flattenedQuiz || [];

    for (let i = 0; i < flattened.length; i++) {
        const f = flattened[i];
        const sidebarBtn = sidebarButtons[i];
        if (sidebarBtn) {
            sidebarBtn.classList.remove('answered');
            sidebarBtn.removeAttribute('onclick');
        }

        if (f.type === 'statement') {
            const q = currentQuizData[f.qIndex];
            const stmt = q.options[f.stmtIndex];
            const itemName = `item${i}`;
            const selected = form.querySelector(`input[name="${itemName}"]:checked`);
            const selectedVal = selected ? (selected.value === 'true') : null;

            // Scoring
            if (selectedVal === stmt.isCorrect) {
                score++;
                if (sidebarBtn) sidebarBtn.classList.add('correct');
            } else if (selectedVal === null) {
                if (sidebarBtn) sidebarBtn.style.backgroundColor = '#ffcc80';
            } else {
                if (sidebarBtn) sidebarBtn.classList.add('wrong');
            }

            // Highlight labels
            const container = document.querySelector(`.tf-statement[data-flat-index="${i}"]`);
            if (container) {
                const trueLabel = container.querySelector('.tf-label[data-value="true"]');
                const falseLabel = container.querySelector('.tf-label[data-value="false"]');

                if (stmt.isCorrect === true) {
                    trueLabel?.classList.add('correct-answer-feedback');
                } else {
                    falseLabel?.classList.add('correct-answer-feedback');
                }

                if (selectedVal !== null && selectedVal !== stmt.isCorrect) {
                    const chosen = container.querySelector(`.tf-label[data-value="${selectedVal ? 'true' : 'false'}"]`);
                    chosen?.classList.add('wrong-answer-feedback');
                }
            }
        } else {
            // multiple choice / true_false
            const q = currentQuizData[f.qIndex];
            const questionElement = document.getElementById(`question-${f.qIndex}`);
            const questionName = `q${f.qIndex}`;
            const selectedInput = form.querySelector(`input[name="${questionName}"]:checked`);
            const selectedIndex = selectedInput ? parseInt(selectedInput.value) : -1;

            if (selectedIndex === q.correctAnswer) {
                score++;
                if (sidebarBtn) sidebarBtn.classList.add('correct');
            } else if (selectedIndex !== -1) {
                if (sidebarBtn) sidebarBtn.classList.add('wrong');
            } else {
                if (sidebarBtn) sidebarBtn.style.backgroundColor = '#ffcc80';
            }

            q.options.forEach((option, oIndex) => {
                const optionLabel = questionElement.querySelector(`label[for="${questionName}-${oIndex}"]`);
                if (!optionLabel) return;
                if (oIndex === q.correctAnswer) {
                    optionLabel.classList.add('correct-answer-feedback');
                }
                if (selectedIndex !== -1 && oIndex === selectedIndex && selectedIndex !== q.correctAnswer) {
                    optionLabel.classList.add('wrong-answer-feedback');
                }
            });
        }
    }

    // Show result
    resultDisplay.style.display = 'block';
    resultDisplay.innerHTML = `
        <div class="result-box">
            <h2>🎉 Kết Quả Bài Quiz 🎉</h2>
            <p style="font-size: 1.5rem; font-weight: 700; color: ${score === totalQuestions ? '#4caf50' : '#ff9800'};">
                Bạn đã đạt ${score} / ${totalQuestions} điểm!
            </p>
            <p style="color: #999; margin-top: 10px;">Các đáp án đúng đã được đánh dấu màu xanh lá.</p>
        </div>
    `;
    resultDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* -------------------- Load & Normalize -------------------- */
function normalizeQuizData(quiz) {
    if (quiz && Array.isArray(quiz.questionsData)) return quiz;

    const normalized = Object.assign({}, quiz);
    if (Array.isArray(quiz.questions)) {
        normalized.questionsData = quiz.questions;
    } else if (quiz.questions && typeof quiz.questions === 'object') {
        normalized.questionsData = Object.values(quiz.questions);
    } else {
        normalized.questionsData = [];
    }
    return normalized;
}

function showQuizNotAvailable(idOrMsg) {
    const titleDisplay = document.getElementById('quiz-title-display');
    const questionsArea = document.getElementById('questions-area');
    titleDisplay.textContent = "Lỗi: Quiz không khả dụng";
    document.getElementById('loading-message')?.remove();

    document.getElementById('quiz-topic-display').textContent = "---";
    document.getElementById('quiz-count-display').textContent = "0";

    questionsArea.innerHTML = `
        <div style="padding: 20px; text-align: center; border: 1px dashed #f44336; border-radius: 10px; margin-top: 30px;">
            <p style="color: #d32f2f; font-weight: 600;">
                Không tìm thấy dữ liệu câu hỏi cho Quiz này (ID: ${idOrMsg}).
            </p>
            <p style="color: #666; margin-top: 10px;">
                *Kiểm tra localStorage key "quizzlab_quizzes" hoặc thử tạo lại quiz.* 
            </p>
        </div>
    `;
}

// Hàm tải Quiz từ Firebase và hiển thị
async function loadAndRenderQuiz() { // Thêm async
    const quizId = getUrlParameter('id'); // ID từ Firebase là CHUỖI, không cần parseInt
    
    const titleDisplay = document.getElementById('quiz-title-display');
    const questionsArea = document.getElementById('questions-area');
    
    if (!quizId) {
        showQuizNotAvailable("Không có ID Quiz");
        return;
    }

    try {
        // Lấy document trực tiếp bằng ID (chuỗi)
        const doc = await db.collection("quizzes").doc(quizId).get();
        
        if (!doc.exists) {
            // Không tìm thấy Quiz
            showQuizNotAvailable(quizId);
            return;
        }

        const rawQuiz = { id: doc.id, ...doc.data() };
        
        // ... (phần còn lại của logic xử lý quiz data giữ nguyên) ...
        const quiz = rawQuiz; // Dùng trực tiếp doc.data()

        if (!Array.isArray(quiz.questionsData) || quiz.questionsData.length === 0) {
            // ...
            return;
        }
        
        // Gán dữ liệu cho biến toàn cục và Render
        currentQuizData = quiz;
        totalQuestions = quiz.questionsData.length;
        renderQuiz(quiz); 
        
        // Ẩn thông báo loading
        document.getElementById('loading-message')?.remove();
        document.getElementById('submit-quiz-btn').disabled = false;
        
    } catch (err) {
        console.error('Lỗi khi tải Quiz từ Firebase:', err);
        showQuizNotAvailable(quizId);
    }
}
// Gọi hàm ngay khi trang được tải
window.onload = loadAndRenderQuiz;
