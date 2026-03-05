/* ========================================================
   📊 БАЗА ДАННЫХ И ИНИЦИАЛИЗАЦИЯ
   ======================================================== */

const DB_STUDENTS = [
    "Gusarov/86421/6Б",
    "Ivanov/12345/6Б", 
    "Labuba/12312/6Б", 
    "Karpukhin/22222/6Б", 
    "Woman/09876/6Б", 
    "Bot1/10293/6Б", 
    "Bot2/12309/6Б",  
    "Sidorov/11111/11Б",
    "Smirnov/00000/5Б",
    "Petrova/99999/7Б"
];

const DB_TEACHERS = [
    "dikiy/00000",
    "Admin/11111"
];

let currentUser = JSON.parse(localStorage.getItem('edu_user')) || null;
let assignedTests = JSON.parse(localStorage.getItem('edu_assigned')) || [];
let drafts = JSON.parse(localStorage.getItem('edu_drafts')) || [];
let globalErrors = JSON.parse(localStorage.getItem('edu_errors')) || {};

// Текущий тест и вопросы для пересдачи
let currentTestId = null;
let wrongQuestions = [];

/* ========================================================
   🤖 ЗАГРУЗКА ОБЪЯСНЕНИЯ ОТ GigaChat
   ======================================================== */

const GIGACHAT_API_KEY = "MDE5YzM2YjUtNWQ5ZC03MTFmLWE2MTItMGVmY2U2MzdmMzI3OjUwMGU5Zjk1LWUzMTMtNGFkMC05OWZhLWU3NGQ1ZTQ0MDIzMA==";// Функция получения токена с таймаутом
// Храним токен и время его получения
let cachedToken = null;
let tokenExpiryTime = 0;
// Для allorigins нужно немного изменить код

// CORS-прокси для GigaChat
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// Модифицированная функция получения токена
async function getGigaChatToken() {
    if (cachedToken && Date.now() < tokenExpiryTime) {
        console.log('✅ Используем кэшированный токен');
        return cachedToken;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        console.log('🔄 Получаем новый токен через прокси...');

        const targetUrl = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
        const encodedUrl = encodeURIComponent(targetUrl);
        
        const response = await fetch(CORS_PROXY + encodedUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${GIGACHAT_API_KEY}`,
                'RqUID': crypto.randomUUID()
            },
            body: 'scope=GIGACHAT_API_PERS',
            signal: controller.signal
        });

        const data = await response.json();
        
        // Для allorigins ответ может быть в data.contents
        const tokenData = data.contents ? JSON.parse(data.contents) : data;
        
        cachedToken = tokenData.access_token;
        tokenExpiryTime = Date.now() + 25 * 60 * 1000;

        console.log('✅ Токен получен!');
        return cachedToken;

    } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Ошибка получения токена:', error);
        return null;
    }
}
/* ========================================================
   🔧 ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ
   ======================================================== */

window.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    // Проверяем соединение с интернетом
    checkInternetConnection();
    window.addEventListener('online', hideOfflineScreen);
    window.addEventListener('offline', showOfflineScreen);
    
    if (path.includes('register.html') || path.endsWith('/')) {
        if (currentUser) {
            window.location.href = currentUser.role + '.html';
        }
    } else {
        if (!currentUser) {
            window.location.href = 'register.html';
            return;
        }
        
        if (currentUser.role === 'teacher') {
            document.body.className = 'teacher-page';
        } else {
            const gradeNum = parseInt(currentUser.grade) || 0;
            document.body.className = `cls-${gradeNum}`;
        }
        
        loadAvatarUI();
        
        if (path.includes('student.html')) {
            initStudent();
            setupLeaderboard();
            showWelcomeMessage();
        }
        if (path.includes('teacher.html')) {
            initTeacher();
        }
    }
});

/* ========================================================
   🌐 ПРОВЕРКА ИНТЕРНЕТА С АНИМАЦИЕЙ ЛИЦА
   ======================================================== */

let offlineAnimationPlayed = false;

function checkInternetConnection() {
    if (!navigator.onLine) {
        showOfflineScreen();
    }
}

function createSadSmileSVG() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "250");
    svg.setAttribute("height", "250");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.setAttribute("id", "sad-smile-svg");
    
    // Основной круг (голова) - остается на месте
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "100");
    circle.setAttribute("cy", "100");
    circle.setAttribute("r", "80");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "#333");
    circle.setAttribute("stroke-width", "4");
    circle.setAttribute("id", "head-circle");
    
    // Глаза - будут анимироваться
    const leftEye = document.createElementNS(svgNS, "ellipse");
    leftEye.setAttribute("cx", "65");
    leftEye.setAttribute("cy", "120");
    leftEye.setAttribute("rx", "8");
    leftEye.setAttribute("ry", "8");
    leftEye.setAttribute("fill", "#333");
    leftEye.setAttribute("id", "left-eye");
    
    const rightEye = document.createElementNS(svgNS, "ellipse");
    rightEye.setAttribute("cx", "135");
    rightEye.setAttribute("cy", "120");
    rightEye.setAttribute("rx", "8");
    rightEye.setAttribute("ry", "8");
    rightEye.setAttribute("fill", "#333");
    rightEye.setAttribute("id", "right-eye");
    
    // Грустный рот (перевернутая улыбка)
    const mouth = document.createElementNS(svgNS, "path");
    mouth.setAttribute("d", "M 70 150 Q 100 130, 130 150");
    mouth.setAttribute("fill", "none");
    mouth.setAttribute("stroke", "#333");
    mouth.setAttribute("stroke-width", "4");
    mouth.setAttribute("stroke-linecap", "round");
    mouth.setAttribute("id", "mouth");
    
    // Добавляем элемент для анимации (группа для лица)
    const faceGroup = document.createElementNS(svgNS, "g");
    faceGroup.setAttribute("id", "face-group");
    faceGroup.appendChild(leftEye);
    faceGroup.appendChild(rightEye);
    faceGroup.appendChild(mouth);
    
    svg.appendChild(circle);
    svg.appendChild(faceGroup);
    
    return svg;
}

function showOfflineScreen() {
    // Удаляем старый экран если есть
    const oldScreen = document.getElementById('offline-screen');
    if (oldScreen) oldScreen.remove();
    
    // Создаем новый экран
    const offlineScreen = document.createElement('div');
    offlineScreen.id = 'offline-screen';
    offlineScreen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'Comfortaa', cursive;
        cursor: pointer;
        transition: opacity 0.5s ease;
    `;
    
    // Создаем контейнер
    const container = document.createElement('div');
    container.style.cssText = `
        text-align: center;
        position: relative;
    `;
    
    // Добавляем SVG смайлик
    const svg = createSadSmileSVG();
    
    const text = document.createElement('div');
    text.style.cssText = `
        margin-top: 30px;
        font-size: 1.5rem;
        color: #333;
        font-weight: 700;
    `;
    text.textContent = 'Нет интернета';
    
    const subText = document.createElement('div');
    subText.style.cssText = `
        margin-top: 15px;
        font-size: 1rem;
        color: #666;
        font-weight: 400;
    `;
    subText.textContent = 'Проверь подключение';
    
    container.appendChild(svg);
    container.appendChild(text);
    container.appendChild(subText);
    offlineScreen.appendChild(container);
    
    // Добавляем стили для анимации лица
    const style = document.createElement('style');
    style.textContent = `
        @keyframes faceSob {
            0% { transform: translateY(0); }
            15% { transform: translateY(-15px) scale(1.02); }
            30% { transform: translateY(5px) scale(0.98); }
            45% { transform: translateY(-8px) scale(1.01); }
            60% { transform: translateY(3px) scale(0.99); }
            75% { transform: translateY(-3px) scale(1); }
            90% { transform: translateY(1px) scale(1); }
            100% { transform: translateY(0) scale(1); }
        }
        
        @keyframes eyesBlink {
            0% { ry: 8; rx: 8; }
            20% { ry: 2; rx: 8; }
            30% { ry: 8; rx: 8; }
            40% { ry: 2; rx: 8; }
            50% { ry: 8; rx: 8; }
            100% { ry: 8; rx: 8; }
        }
        
        @keyframes mouthSad {
            0% { d: path("M 70 150 Q 100 130, 130 150"); }
            30% { d: path("M 70 155 Q 100 135, 130 155"); }
            60% { d: path("M 70 150 Q 100 128, 130 150"); }
            100% { d: path("M 70 150 Q 100 130, 130 150"); }
        }
        
        .face-sob {
            animation: faceSob 0.8s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
        }
        
        .eyes-blink {
            animation: eyesBlink 0.8s ease-out forwards;
        }
        
        .mouth-sad {
            animation: mouthSad 0.8s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(offlineScreen);
    
    // Запускаем анимацию лица при появлении
    setTimeout(() => {
        const faceGroup = document.getElementById('face-group');
        const leftEye = document.getElementById('left-eye');
        const rightEye = document.getElementById('right-eye');
        const mouth = document.getElementById('mouth');
        
        if (faceGroup) {
            faceGroup.classList.add('face-sob');
        }
        
        if (leftEye && rightEye) {
            leftEye.classList.add('eyes-blink');
            rightEye.classList.add('eyes-blink');
        }
        
        if (mouth) {
            mouth.classList.add('mouth-sad');
        }
        
        offlineAnimationPlayed = true;
    }, 100);
    
    // Добавляем обработчик клика для повторения анимации
    offlineScreen.addEventListener('click', function(e) {
        e.stopPropagation();
        
        const faceGroup = document.getElementById('face-group');
        const leftEye = document.getElementById('left-eye');
        const rightEye = document.getElementById('right-eye');
        const mouth = document.getElementById('mouth');
        
        // Убираем старые анимации
        if (faceGroup) {
            faceGroup.classList.remove('face-sob');
        }
        if (leftEye && rightEye) {
            leftEye.classList.remove('eyes-blink');
            rightEye.classList.remove('eyes-blink');
        }
        if (mouth) {
            mouth.classList.remove('mouth-sad');
        }
        
        // Форсируем перерисовку
        void faceGroup?.offsetWidth;
        
        // Добавляем новые анимации
        setTimeout(() => {
            if (faceGroup) {
                faceGroup.classList.add('face-sob');
            }
            if (leftEye && rightEye) {
                leftEye.classList.add('eyes-blink');
                rightEye.classList.add('eyes-blink');
            }
            if (mouth) {
                mouth.classList.add('mouth-sad');
            }
        }, 10);
        
        // Через 0.67 сек добавляем дополнительный всхлип
        setTimeout(() => {
            if (faceGroup) {
                faceGroup.style.transform = 'translateY(-5px)';
                setTimeout(() => {
                    faceGroup.style.transform = 'translateY(0)';
                }, 150);
            }
            
            if (leftEye && rightEye) {
                leftEye.setAttribute('ry', '2');
                rightEye.setAttribute('ry', '2');
                setTimeout(() => {
                    leftEye.setAttribute('ry', '8');
                    rightEye.setAttribute('ry', '8');
                }, 150);
            }
        }, 670);
    });
}

function hideOfflineScreen() {
    const offlineScreen = document.getElementById('offline-screen');
    if (offlineScreen) {
        // Плавное исчезновение
        offlineScreen.style.opacity = '0';
        setTimeout(() => {
            if (offlineScreen.parentNode) {
                offlineScreen.remove();
            }
        }, 500);
    }
}

/* ========================================================
   🔑 ЛОГИКА ВХОДА И ВЫХОДА
   ======================================================== */

function handleLogin() {
    const u = document.getElementById('login-input').value.trim();
    const p = document.getElementById('pass-input').value.trim();
    const err = document.getElementById('error-msg');

    const teacher = DB_TEACHERS.find(t => {
        const [login, pass] = t.split('/');
        return login === u && pass === p;
    });
    
    if (teacher) {
        return saveAndGo(teacher.split('/')[0], 'teacher');
    }

    const student = DB_STUDENTS.find(s => {
        const [login, pass] = s.split('/');
        return login === u && pass === p;
    });
    
    if (student) {
        const [name, , grade] = student.split('/');
        return saveAndGo(name, 'student', grade);
    }
    
    if (err) err.innerText = "Ой! Тебя нет в списке ❌";
}

function saveAndGo(name, role, grade = "") {
    localStorage.setItem('edu_user', JSON.stringify({ name, role, grade }));
    window.location.href = role + '.html';
}

function logout() { 
    localStorage.removeItem('edu_user'); 
    window.location.href = 'register.html'; 
}

/* ========================================================
   👨‍🎓 ЛОГИКА УЧЕНИКА
   ======================================================== */

function initStudent() {
    if (document.getElementById('h-name')) {
        document.getElementById('h-name').innerText = currentUser.name;
    }
    if (document.getElementById('h-grade')) {
        document.getElementById('h-grade').innerText = currentUser.grade;
    }
    renderTests();
    updateProgressBar();
}

function renderTests() {
    const list = document.getElementById('tests-list');
    if (!list) return;
    
    const comp = JSON.parse(localStorage.getItem(`comp_${currentUser.name}`)) || [];
    const myGrade = (currentUser.grade || "").toString().toUpperCase().trim();
    const myTests = assignedTests.filter(t => (t.target || "").toString().toUpperCase().trim() === myGrade);

    if (myTests.length === 0) {
        list.innerHTML = `<p style='text-align:center; opacity:0.3; padding:40px;'>Заданий для ${myGrade} пока нет...</p>`;
        return;
    }

    list.innerHTML = myTests.map((t, i) => {
        const isDone = comp.includes(t.id);
        return `
            <div class="test-btn" onclick="${isDone ? '' : `showLessonWindow(${t.id})`}" 
                 style="animation-delay: ${i * 0.1}s; ${isDone ? 'opacity: 0.6;' : ''}">
                <span class="test-title">
                    ${t.topic} ${isDone ? '✓' : ''}
                </span>
                <span class="test-author">${isDone ? 'Пройдено' : 'От: ' + (t.author || "Учитель")}</span>
                ${!isDone ? '<span class="test-deadline">Срочно</span>' : ''}
            </div>`;
    }).join('');
}

/* ========================================================
   🎓 ОКНО ОБУЧЕНИЯ
   ======================================================== */

function showLessonWindow(testId) {
    currentTestId = testId;
    const test = assignedTests.find(t => t.id == testId);
    
    const overlay = document.createElement('div');
    overlay.className = 'lesson-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(5px);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    const lessonWindow = document.createElement('div');
    lessonWindow.className = 'lesson-window';
    lessonWindow.style.cssText = `
        background: white;
        border-radius: 60px;
        padding: 40px;
        max-width: 1100px;
        width: 90%;
        border: 10px solid var(--accent);
        box-shadow: 0 30px 60px rgba(0,0,0,0.3);
        transform: scale(0.8);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    
    const title = document.createElement('h2');
    title.style.cssText = `
        text-align: center;
        margin-bottom: 30px;
        color: var(--accent);
        font-size: 2rem;
    `;
    title.textContent = `Урок: ${test.topic}`;
    
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
        display: flex;
        gap: 30px;
        align-items: stretch;
        margin-bottom: 30px;
    `;
    
    const gifContainer = document.createElement('div');
    gifContainer.style.cssText = `
        flex: 1;
        background: white;
        border-radius: 40px;
        padding: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 4px solid var(--accent);
    `;
    
    const gif = document.createElement('img');
    gif.src = 'QTB_talk.gif';
    gif.alt = 'Учитель объясняет';
    gif.style.cssText = `
        max-width: 100%;
        max-height: 400px;
        width: auto;
        height: auto;
        border-radius: 30px;
        animation: shake 3s ease-in-out infinite;
    `;
    gifContainer.appendChild(gif);
    
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = `
        flex: 1;
        background: #e3f2fd;
        border-radius: 60px 60px 60px 20px;
        padding: 30px;
        position: relative;
        border: 4px solid var(--accent);
        display: flex;
        flex-direction: column;
        justify-content: center;
    `;
    
    const tail = document.createElement('div');
    tail.style.cssText = `
        position: absolute;
        left: -20px;
        bottom: 30px;
        width: 0;
        height: 0;
        border-top: 20px solid transparent;
        border-bottom: 20px solid transparent;
        border-right: 20px solid var(--accent);
        filter: drop-shadow(-2px 2px 2px rgba(0,0,0,0.1));
    `;
    messageContainer.appendChild(tail);
    
    const messageText = document.createElement('div');
    messageText.id = 'lesson-message';
    messageText.style.cssText = `
        font-size: 1.2rem;
        line-height: 1.6;
        color: #2d3436;
        font-weight: 700;
    `;
    messageText.innerHTML = 'Загружаю объяснение...';
    messageContainer.appendChild(messageText);
    
    contentContainer.appendChild(gifContainer);
    contentContainer.appendChild(messageContainer);
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
        display: flex;
        gap: 20px;
        justify-content: center;
        margin-top: 30px;
    `;
    
    const startButton = document.createElement('button');
    startButton.className = 'primary';
    startButton.style.cssText = `
        padding: 15px 40px;
        font-size: 1.2rem;
        background: #00b894;
    `;
    startButton.innerHTML = 'Начать тест';
    startButton.onclick = () => {
        document.body.removeChild(overlay);
        startTest(testId);
    };
    
    const cancelButton = document.createElement('button');
    cancelButton.style.cssText = `
        padding: 15px 40px;
        font-size: 1.2rem;
        background: #ff7675;
        color: white;
        border: none;
        border-radius: 35px;
        font-weight: 900;
        cursor: pointer;
    `;
    cancelButton.innerHTML = 'Закрыть';
    cancelButton.onclick = () => {
        document.body.removeChild(overlay);
    };
    
    buttonsContainer.appendChild(startButton);
    buttonsContainer.appendChild(cancelButton);
    
    lessonWindow.appendChild(title);
    lessonWindow.appendChild(contentContainer);
    lessonWindow.appendChild(buttonsContainer);
    
    overlay.appendChild(lessonWindow);
    document.body.appendChild(overlay);
    
    setTimeout(() => {
        overlay.style.opacity = '1';
        lessonWindow.style.transform = 'scale(1)';
        lessonWindow.style.opacity = '1';
    }, 10);
    
    loadLessonExplanation(test.topic, test.modules);
}


async function loadLessonExplanation(topic, modules) {
    const messageElement = document.getElementById('lesson-message');
    if (!messageElement) return;
    
    // Сразу показываем запасной текст, чтобы не было бесконечной загрузки
    messageElement.innerHTML = `
        <strong>📚 Тема: ${topic}</strong>
        <br><br>
        Давай быстро повторим:
        <br><br>
        • Читай вопросы внимательно
        • Не торопись с ответом
        • Если что-то непонятно - спроси учителя
        <br><br>
        Удачи! 🌟
    `;
    
    // Пытаемся получить объяснение от GigaChat в фоне
    try {
        const token = await getGigaChatToken();
        if (!token) return; // Если не получили токен, оставляем запасной текст
        
        let topicsList = '';
        if (modules && modules.length > 0) {
            topicsList = modules.map(m => 
                `- ${m.title}: ${m.qs.length} вопросов`
            ).join('\n');
        }
        
        const prompt = `Ты - добрый учитель. Объясни ученику тему "${topic}" перед тестом.
        
        Вот что входит в тему:
        ${topicsList || 'Основные понятия по теме'}
        
        Напиши короткое, понятное объяснение (3-4 предложения), которое подготовит ученика к тесту. 
        Используй дружелюбный тон. Объясни самые важные моменты.`;
        
        const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: 'GigaChat',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 300
            })
        });
        
        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            const aiText = data.choices[0].message.content;
            
            // Плавно заменяем текст
            messageElement.style.opacity = '0';
            setTimeout(() => {
                messageElement.innerHTML = aiText.replace(/\n/g, '<br>');
                messageElement.style.transition = 'opacity 0.5s ease';
                messageElement.style.opacity = '1';
            }, 300);
        }
    } catch (error) {
        console.error('Ошибка GigaChat:', error);
        // Оставляем запасной текст
    }
}

/* ========================================================
   📝 НАЧАЛО ТЕСТА
   ======================================================== */

function startTest(id) {
    const test = assignedTests.find(t => t.id == id);
    const box = document.getElementById('active-test');
    
    if (!test || !box) return;
    
    box.classList.remove('hidden');
    
    let questionsHTML = '';
    
    // Если есть вопросы для пересдачи, показываем только их
    if (wrongQuestions.length > 0) {
        questionsHTML = '<h3 style="margin: 20px 0; color: #ff7675;">📝 Пересдай эти вопросы:</h3>';
        wrongQuestions.forEach((q, index) => {
            if (q.type === 'choice') {
                questionsHTML += renderChoiceQuestion(q, 0, index, true);
            } else if (q.type === 'multiple') {
                questionsHTML += renderMultipleChoiceQuestion(q, 0, index, true);
            } else {
                questionsHTML += `
                    <div class="card" style="margin-bottom:20px; padding:30px; border:4px solid #ff7675; border-radius:35px; background:#fff;">
                        <p style="margin-bottom:15px; font-size:1.1rem; font-weight:700;"><b>${index+1}.</b> ${q.t}</p>
                        <input class="u-ans retry-question" data-question-index="${index}" placeholder="Твой ответ..." style="width:100%; padding:15px; border:3px solid #eee; border-radius:20px; font-family:'Comfortaa';">
                    </div>
                `;
            }
        });
        questionsHTML += `<button class="primary" onclick="checkRetryAnswers(${id})" style="margin-top:20px; background:#ff7675;">Проверить ответы</button>`;
    } else {
        // Показываем весь тест
        if (test.modules) {
            test.modules.forEach((module, moduleIndex) => {
                questionsHTML += `<h3 style="margin: 30px 0 15px; color: var(--accent); font-size: 1.5rem;">📚 ${module.title}</h3>`;
                module.qs.forEach((q, qIndex) => {
                    if (q.type === 'choice') {
                        questionsHTML += renderChoiceQuestion(q, moduleIndex, qIndex);
                    } else if (q.type === 'multiple') {
                        questionsHTML += renderMultipleChoiceQuestion(q, moduleIndex, qIndex);
                    } else {
                        questionsHTML += `
                            <div class="card" style="margin-bottom:20px; padding:30px; border:4px solid var(--accent); border-radius:35px; background:#fff;">
                                <p style="margin-bottom:15px; font-size:1.1rem; font-weight:700;"><b>${moduleIndex+1}.${qIndex+1}.</b> ${q.t}</p>
                                <input class="u-ans" data-module="${moduleIndex}" data-question="${qIndex}" placeholder="Твой ответ..." style="width:100%; padding:15px; border:3px solid #eee; border-radius:20px; font-family:'Comfortaa';">
                            </div>
                        `;
                    }
                });
            });
        } else {
            const questions = test.qs || [];
            questionsHTML = questions.map((q, i) => {
                if (q.type === 'choice') {
                    return renderChoiceQuestion(q, 0, i);
                } else if (q.type === 'multiple') {
                    return renderMultipleChoiceQuestion(q, 0, i);
                } else {
                    return `
                        <div class="card" style="margin-bottom:20px; padding:30px; border:4px solid var(--accent); border-radius:35px; background:#fff;">
                            <p style="margin-bottom:15px; font-size:1.1rem; font-weight:700;"><b>${i+1}.</b> ${q.t}</p>
                            <input class="u-ans" data-id="${i}" placeholder="Твой ответ..." style="width:100%; padding:15px; border:3px solid #eee; border-radius:20px; font-family:'Comfortaa';">
                        </div>
                    `;
                }
            }).join('');
        }
        questionsHTML += `<button class="primary" onclick="finishTest(${id})" style="margin-top:20px;">Сдать работу</button>`;
    }
    
    box.innerHTML = `<h2 style="margin-bottom:25px;">${test.topic}</h2>` + questionsHTML;
    box.scrollIntoView({ behavior: 'smooth' });
}

function renderChoiceQuestion(q, moduleIndex, qIndex, isRetry = false) {
    let optionsHTML = '';
    if (q.options) {
        q.options.forEach((opt, optIndex) => {
            optionsHTML += `
                <label style="display: block; margin: 10px 0; padding: 10px; border: 2px solid #eee; border-radius: 15px; cursor: pointer;">
                    <input type="radio" name="q_${moduleIndex}_${qIndex}" value="${optIndex}" style="margin-right: 10px; transform: scale(1.2);">
                    ${opt}
                </label>
            `;
        });
    }
    
    return `
        <div class="card" style="margin-bottom:20px; padding:30px; border:4px solid ${isRetry ? '#ff7675' : 'var(--accent)'}; border-radius:35px; background:#fff;">
            <p style="margin-bottom:15px; font-size:1.1rem; font-weight:700;"><b>${moduleIndex+1}.${qIndex+1}.</b> ${q.t}</p>
            <div class="choice-options" data-module="${moduleIndex}" data-question="${qIndex}" ${isRetry ? 'data-retry="true"' : ''}>
                ${optionsHTML}
            </div>
        </div>
    `;
}

function renderMultipleChoiceQuestion(q, moduleIndex, qIndex, isRetry = false) {
    let optionsHTML = '';
    if (q.options) {
        q.options.forEach((opt, optIndex) => {
            optionsHTML += `
                <label style="display: block; margin: 10px 0; padding: 10px; border: 2px solid #eee; border-radius: 15px; cursor: pointer;">
                    <input type="checkbox" name="q_${moduleIndex}_${qIndex}" value="${optIndex}" style="margin-right: 10px; transform: scale(1.2);">
                    ${opt}
                </label>
            `;
        });
    }
    
    return `
        <div class="card" style="margin-bottom:20px; padding:30px; border:4px solid ${isRetry ? '#ff7675' : 'var(--accent)'}; border-radius:35px; background:#fff;">
            <p style="margin-bottom:15px; font-size:1.1rem; font-weight:700;"><b>${moduleIndex+1}.${qIndex+1}.</b> ${q.t}</p>
            <p style="font-size:0.9rem; color: #666; margin-bottom: 10px;">(можно выбрать несколько вариантов)</p>
            <div class="multiple-choice-options" data-module="${moduleIndex}" data-question="${qIndex}" ${isRetry ? 'data-retry="true"' : ''}>
                ${optionsHTML}
            </div>
        </div>
    `;
}

/* ========================================================
   ✅ ПРОВЕРКА ТЕСТА
   ======================================================== */

async function finishTest(id) {
    const test = assignedTests.find(t => t.id == id);
    let questions = [];
    let mistakes = 0;
    const userAnswers = [];
    const correctAnswers = [];
    wrongQuestions = [];
    
    if (test.modules) {
        test.modules.forEach(module => {
            questions = questions.concat(module.qs);
        });
    } else {
        questions = test.qs || [];
    }
    
    // Собираем ответы
    questions.forEach((q, i) => {
        let userAns = '';
        
        if (q.type === 'choice') {
            const radios = document.querySelectorAll(`input[name="q_0_${i}"]:checked, input[name^="q_0_${i}"]:checked`);
            if (radios.length > 0) {
                userAns = radios[0].value;
            }
        } else if (q.type === 'multiple') {
            const checkboxes = document.querySelectorAll(`input[name^="q_0_${i}"]:checked`);
            userAns = Array.from(checkboxes).map(cb => cb.value).sort().join(',');
        } else {
            const input = document.querySelector(`.u-ans[data-id="${i}"], .u-ans[data-question="${i}"]`);
            if (input) {
                userAns = input.value.trim().toLowerCase();
            }
        }
        
        const correctAns = q.type === 'multiple' ? 
            (Array.isArray(q.a) ? q.a.sort().join(',') : q.a) : 
            (q.a ? q.a.toString().toLowerCase() : '');
        
        userAnswers.push(userAns);
        correctAnswers.push(correctAns);
        
        if (userAns !== correctAns) {
            mistakes++;
            wrongQuestions.push(q);
            globalErrors[q.t] = (globalErrors[q.t] || 0) + 1;
        }
    });
    
    localStorage.setItem('edu_errors', JSON.stringify(globalErrors));
    
    if (mistakes > 0) {
        await getAIHelp(mistakes, test.topic, wrongQuestions, id);
    } else {
        alert("🎉 Поздравляем! Тест пройден идеально!");
        
        const comp = JSON.parse(localStorage.getItem(`comp_${currentUser.name}`)) || [];
        if (!comp.includes(id)) comp.push(id);
        localStorage.setItem(`comp_${currentUser.name}`, JSON.stringify(comp));
        
        updateProgressBar();
        
        setTimeout(() => {
            location.reload();
        }, 2000);
    }
}

/* ========================================================
   📚 СОЗДАНИЕ МЕТОДИЧКИ ДЛЯ ИЗУЧЕНИЯ (БЕЗ ПРАВИЛЬНЫХ ОТВЕТОВ)
   ======================================================== */

async function getAIHelp(mistakes, testTopic, wrongQuestions, testId) {
    const aiBox = document.getElementById('ai-response');
    if (!aiBox) return;
    
    // Получаем тест
    const test = assignedTests.find(t => t.id == testId);
    console.log('📋 Данные для GigaChat:');
    console.log('- Тема теста:', testTopic);
    console.log('- Количество ошибок:', mistakes);
    console.log('- Вопросы с ошибками:', wrongQuestions.map(q => q.t));
    if (!test) return;
    
    // Показываем интерфейс загрузки
    aiBox.classList.remove('hidden');
    aiBox.innerHTML = `
        <div class="card" style="border:8px solid #ff7675; border-radius:50px; padding:40px; background:#fff;">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 25px;">
                <div style="background: #ff7675; width: 60px; height: 60px; border-radius: 30px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 2rem;">📚</span>
                </div>
                <div>
                    <h3 style="color:#ff7675; font-weight:900; margin:0;">Персональная методичка</h3>
                    <p style="margin:5px 0 0; color:#666;">Изучи материал и попробуй снова</p>
                </div>
            </div>
            
            <div style="background:#fff3cd; border-left:8px solid #ffc107; padding:20px; border-radius:20px; margin-bottom:25px;">
                <h4 style="color:#856404; margin:0 0 10px;">📝 Нужно повторить (${mistakes} тем):</h4>
                <ul style="margin:0; padding-left:20px;">
                    ${wrongQuestions.map(wq => {
                        // Определяем тему для каждого вопроса
                        let topic = '';
                        if (wq.t.includes('мозгом') || wq.t.includes('процессор')) topic = 'Процессор';
                        else if (wq.t.includes('монитор')) topic = 'Устройства вывода';
                        else if (wq.t.includes('ввода')) topic = 'Устройства ввода';
                        else if (wq.t.includes('память') || wq.t.includes('ОЗУ')) topic = 'Оперативная память';
                        else if (wq.t.includes('хранение') || wq.t.includes('жесткий')) topic = 'Долговременная память';
                        else topic = 'Устройства компьютера';
                        
                        return `<li style="margin:5px 0;"><b>${topic}:</b> ${wq.t}</li>`;
                    }).join('')}
                </ul>
            </div>
            
            <div id="gigachat-loading" style="text-align: center; padding: 30px; background: #f8f9fa; border-radius: 30px; margin-bottom: 25px;">
                <div style="font-size: 3rem; margin-bottom: 15px;">🤔</div>
                <div style="color: #666; font-size: 1.1rem;">GigaChat готовит персональную методичку...</div>
                <div style="margin-top: 20px; width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #ff7675; border-radius: 50%; animation: spin 1s linear infinite; margin-left: auto; margin-right: auto;"></div>
            </div>
            
            <div id="gigachat-advice" style="display: none;"></div>
            
            <div style="display: flex; gap: 20px; margin-top: 25px;">
                <button class="primary" onclick="startTest(${testId})" style="flex: 1; background: #ff7675;">
                    🔄 Попробовать снова
                </button>
                <button class="primary" onclick="document.getElementById('ai-response').classList.add('hidden')" style="flex: 1; background: #7f8c8d;">
                    📖 Закрыть
                </button>
            </div>
        </div>
    `;
    
    // Добавляем анимацию
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Пытаемся получить методичку от GigaChat
    try {
        const token = await getGigaChatToken();
        if (!token) {
            showStudyGuide(testTopic, wrongQuestions, test);
            return;
        }
        
        // Создаем промпт для методички (БЕЗ ПРАВИЛЬНЫХ ОТВЕТОВ!)
        const prompt = createStudyGuidePrompt(testTopic, wrongQuestions, test);
        
        const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: 'GigaChat',
                messages: [
                    {
                        role: 'system',
                        content: 'Ты - добрый учитель, который создает понятные учебные материалы. Твоя задача - объяснить тему так, чтобы ученик сам понял материал и смог ответить на вопросы. НИКОГДА не давай прямые ответы на вопросы теста! Только объясняй теорию.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1500
            })
        });
        
        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            const studyGuide = data.choices[0].message.content;
            
            // Убираем загрузку и показываем методичку
            document.getElementById('gigachat-loading').style.display = 'none';
            const adviceDiv = document.getElementById('gigachat-advice');
            adviceDiv.style.display = 'block';
            adviceDiv.innerHTML = formatStudyGuide(studyGuide);
        } else {
            showStudyGuide(testTopic, wrongQuestions, test);
        }
        
    } catch (error) {
        console.error('Ошибка GigaChat:', error);
        showStudyGuide(testTopic, wrongQuestions, test);
    }
}

// Функция создания промпта для методички (с ОБЯЗАТЕЛЬНОЙ теорией)
function createStudyGuidePrompt(testTopic, wrongQuestions, test) {
    // Определяем класс ученика
    const studentGrade = currentUser?.grade || "5";
    
    // Определяем предмет из темы (берем первое слово)
    const subject = testTopic.split(' ')[0] || "предмет";
    
    // Группируем вопросы по темам из теста
    const topicsMap = new Map();
    
    if (test.modules) {
        test.modules.forEach(module => {
            const moduleQuestions = module.qs.filter(q => 
                wrongQuestions.some(wq => wq.t === q.t)
            );
            
            if (moduleQuestions.length > 0) {
                topicsMap.set(module.title, {
                    questions: moduleQuestions.map(q => q.t),
                    allQuestions: module.qs // все вопросы модуля для контекста
                });
            }
        });
    }
    
    let prompt = `Ты - опытный репетитор. Составь ПОДРОБНЫЙ учебный материал для ученика ${studentGrade} класса.

Ученик допустил ошибки в следующих вопросах по теме "${testTopic}":

`;
    
    topicsMap.forEach((data, topic) => {
        prompt += `\n📚 РАЗДЕЛ: ${topic}\n`;
        prompt += `Ошибочные вопросы:\n`;
        data.questions.forEach(q => {
            prompt += `• ${q}\n`;
        });
    });
    
    prompt += `\nВАЖНЕЙШИЕ ТРЕБОВАНИЯ:
1. НИКОГДА не давай прямые ответы на вопросы!
2. Для КАЖДОГО ошибочного вопроса нужно дать:

   📖 ПОДРОБНУЮ ТЕОРИЮ (обязательно!)
      - Объясни тему простыми словами (как для ${studentGrade} класса)
      - Напиши 3-5 предложений теории, которая нужна именно для этого вопроса
      - Объясни ключевые понятия

   ✨ ПРИМЕР
      - Приведи конкретный пример из жизни, связанный с этим вопросом
      - Покажи, как теория работает на практике

   🔍 ПОИСК НА RUTUBE
      - Дай точный поисковый запрос по теме вопроса

   💡 ЧТО ЗАПОМНИТЬ
      - 2-3 важных факта

Формат ответа (СТРОГО соблюдай для КАЖДОГО вопроса):

📚 [НАЗВАНИЕ РАЗДЕЛА]

❓ ВОПРОС: [текст вопроса]

📖 ТЕОРИЯ:
[Подробное объяснение теории, которая относится именно к этому вопросу. 3-5 предложений. Обязательно объясни ключевые понятия простыми словами. Не давай прямой ответ на вопрос!]

✨ ПРИМЕР ИЗ ЖИЗНИ:
[Конкретный пример, связанный с этим вопросом, который поможет понять тему]

🔍 НАЙТИ НА RUTUBE:
"[точный поисковый запрос по теме вопроса ${studentGrade} класс]"

💡 ВАЖНО ЗАПОМНИТЬ:
• [ключевой факт 1]
• [ключевой факт 2]

---
[повторить для каждого вопроса]

🎯 КАК ИСПОЛЬЗОВАТЬ МАТЕРИАЛ:
1. Прочитай теорию по каждому вопросу
2. Разбери пример из жизни
3. Введи запрос в Rutube и посмотри видео
4. Запомни важные факты
5. После изучения нажми "Попробовать снова"

Помни: ТЕОРИЯ - это самое главное! Без неё ученик не поймет тему.`;
    
    return prompt;
}
// Форматирование ответа от GigaChat (с теорией)
function formatStudyGuide(text) {
    // Заменяем заголовки
    let formatted = text
        .replace(/📚 \[(.*?)\]/g, '<div style="background: #0066CC; color: white; padding: 20px 25px; border-radius: 30px 30px 0 0; margin-top: 40px;"><h2 style="margin:0; font-size: 1.8rem;">📚 $1</h2></div>')
        .replace(/❓ ВОПРОС:/g, '<div style="background: #FFF3E0; padding: 15px 25px; border-left: 8px solid #FF9800; margin: 20px 0 0;"><h3 style="color: #E65100; margin:0; font-size: 1.3rem;">❓ ВОПРОС:</h3></div>')
        .replace(/📖 ТЕОРИЯ:/g, '<h4 style="color: #00b894; margin: 20px 0 10px 25px;">📖 ТЕОРИЯ:</h4>')
        .replace(/✨ ПРИМЕР ИЗ ЖИЗНИ:/g, '<h4 style="color: #fdcb6e; margin: 20px 0 10px 25px;">✨ ПРИМЕР ИЗ ЖИЗНИ:</h4>')
        .replace(/🔍 НАЙТИ НА RUTUBE:/g, '<h4 style="color: #0066CC; margin: 20px 0 10px 25px;">🔍 НАЙТИ НА RUTUBE:</h4>')
        .replace(/💡 ВАЖНО ЗАПОМНИТЬ:/g, '<h4 style="color: #0984e3; margin: 20px 0 10px 25px;">💡 ВАЖНО ЗАПОМНИТЬ:</h4>')
        .replace(/🎯 КАК ИСПОЛЬЗОВАТЬ МАТЕРИАЛ:/g, '<div style="background: #00b894; color: white; padding: 20px 25px; border-radius: 20px; margin: 40px 20px 20px;"><h3 style="margin:0;">🎯 КАК ИСПОЛЬЗОВАТЬ МАТЕРИАЛ:</h3></div>')
        .replace(/---/g, '<hr style="border: 2px dashed #dfe6e9; margin: 30px 20px;">');
    
    // Находим поисковые запросы в кавычках и делаем из них ссылки на Rutube
    const searchRegex = /"([^"]+)"/g;
    formatted = formatted.replace(searchRegex, (match, searchQuery) => {
        const encodedQuery = encodeURIComponent(searchQuery);
        return `<a href="https://rutube.ru/search/?query=${encodedQuery}" target="_blank" style="display: inline-block; background: #0066CC; color: white; padding: 10px 25px; border-radius: 30px; text-decoration: none; margin: 5px 25px; font-weight: 700; font-size: 1.1rem;">📺 ${searchQuery}</a>`;
    });
    
    // Форматируем текст
    let lines = formatted.split('\n');
    let inList = false;
    let result = [];
    let inQuestion = false;
    let inTheory = false;
    
    lines.forEach(line => {
        // Обрабатываем текст вопроса
        if (line.includes('❓ ВОПРОС:</h3>')) {
            inQuestion = true;
            result.push(line);
        } else if (inQuestion && line.trim() && !line.includes('<h4') && !line.includes('<div') && !line.includes('<hr') && !line.includes('ТЕОРИЯ')) {
            // Это сам текст вопроса
            result.push(`<div style="background: #FFF3E0; padding: 15px 25px 25px 25px; font-size: 1.2rem; font-weight: 700; color: #BF360C; border-bottom: 2px solid #FF9800;">${line.trim()}</div>`);
            inQuestion = false;
        } 
        // Обрабатываем теорию
        else if (line.includes('📖 ТЕОРИЯ:')) {
            inTheory = true;
            result.push(line);
        }
        else if (line.trim().startsWith('•')) {
            if (!inList) {
                result.push('<ul style="margin: 10px 25px 20px; padding-left: 25px;">');
                inList = true;
            }
            result.push(`<li style="margin: 8px 0; line-height: 1.6;">${line.substring(1).trim()}</li>`);
        } else {
            if (inList) {
                result.push('</ul>');
                inList = false;
            }
            
            // Обычный текст (теория, примеры)
            if (line.trim() && !line.includes('<h') && !line.includes('<li') && !line.includes('<a') && !line.includes('<div') && !line.includes('<hr')) {
                result.push(`<p style="margin: 10px 25px; line-height: 1.7; font-size: 1.1rem;">${line}</p>`);
            } else if (!line.includes('<h') && !line.includes('<div') && !line.includes('<hr')) {
                result.push(line);
            }
        }
    });
    
    if (inList) {
        result.push('</ul>');
    }
    
    return `
        <div style="background: #f8f9fa; border-radius: 40px; padding: 0; border: 4px solid #dfe6e9; overflow: hidden;">
            ${result.join('')}
            
            <div style="background: #E3F2FD; padding: 25px; margin-top: 30px; text-align: center; border-top: 4px solid #0066CC;">
                <p style="margin:0; color: #0066CC; font-weight: 700; font-size: 1.2rem;">
                    📺 Нажми на синюю кнопку с запросом - откроется Rutube с видео по этой теме!
                </p>
            </div>
        </div>
    `;
}
// Резервная методичка (если GigaChat не отвечает)
function showStudyGuide(testTopic, wrongQuestions, test) {
    document.getElementById('gigachat-loading').style.display = 'none';
    const adviceDiv = document.getElementById('gigachat-advice');
    adviceDiv.style.display = 'block';
    
    // Определяем класс ученика
    const studentGrade = currentUser?.grade || "5";
    
    // Группируем вопросы по темам
    const topics = {};
    
    if (test.modules) {
        test.modules.forEach(module => {
            const moduleQuestions = module.qs.filter(q => 
                wrongQuestions.some(wq => wq.t === q.t)
            );
            
            if (moduleQuestions.length > 0) {
                topics[module.title] = moduleQuestions.map(q => q.t);
            }
        });
    }
    
    let studyGuide = `
        <div style="background: linear-gradient(135deg, #0066CC 0%, #003366 100%); border-radius: 35px; padding: 35px; color: white; margin-bottom: 30px;">
            <h2 style="margin:0 0 10px; font-size: 2rem;">📚 Разбор ошибок</h2>
            <p style="margin:0; opacity:0.9; font-size: 1.2rem;">Изучи материалы по каждому вопросу</p>
        </div>
    `;
    
    for (let [topic, questions] of Object.entries(topics)) {
        studyGuide += `
            <div style="margin-bottom: 40px; background: white; border-radius: 30px; overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #0066CC 0%, #003366 100%); padding: 20px; color: white;">
                    <h3 style="margin:0; font-size: 1.5rem;">📚 ${topic}</h3>
                </div>
                <div style="padding: 25px;">
        `;
        
        questions.forEach((question, idx) => {
            // Создаем уникальный поисковый запрос для каждого вопроса
            const searchQuery = `${testTopic} ${question} ${studentGrade} класс урок`;
            const encodedQuery = encodeURIComponent(searchQuery);
            
            studyGuide += `
                <div style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 20px; border-left: 6px solid #FF9800;">
                    <h4 style="color: #E65100; margin: 0 0 15px;">❓ Вопрос ${idx+1}:</h4>
                    <p style="font-size: 1.2rem; font-weight: 700; margin: 0 0 20px; padding: 10px; background: white; border-radius: 15px;">${question}</p>
                    
                    <div style="background: #E3F2FD; padding: 20px; border-radius: 15px; margin: 15px 0;">
                        <h5 style="color: #0066CC; margin: 0 0 10px;">🔍 Найди на Rutube:</h5>
                        <a href="https://rutube.ru/search/?query=${encodedQuery}" target="_blank" style="display: inline-block; background: #0066CC; color: white; padding: 12px 30px; border-radius: 30px; text-decoration: none; font-weight: 700; margin: 5px 0;">
                            📺 ${searchQuery}
                        </a>
                    </div>
                    
                    <div style="background: #E8F5E8; padding: 15px; border-radius: 15px;">
                        <p style="margin:0; color: #1B5E20;">💡 <b>Совет:</b> Посмотри видео, обрати внимание на объяснение этой темы</p>
                    </div>
                </div>
            `;
        });
        
        studyGuide += `
                </div>
            </div>
        `;
    }
    
    studyGuide += `
        <div style="background: linear-gradient(135deg, #2E7D32, #1B5E20); border-radius: 30px; padding: 30px; color: white; margin: 40px 0;">
            <h4 style="margin:0 0 20px; font-size: 1.5rem;">🎯 ЧТО ДЕЛАТЬ:</h4>
            <ol style="margin:0; padding-left:20px; font-size: 1.2rem;">
                <li style="margin: 12px 0;">Для каждого вопроса нажми на синюю кнопку</li>
                <li style="margin: 12px 0;">Посмотри видео на Rutube по этой теме</li>
                <li style="margin: 12px 0;">Запиши главные мысли в тетрадь</li>
                <li style="margin: 12px 0;">Попробуй ответить на вопрос своими словами</li>
                <li style="margin: 12px 0;">Нажми "Попробовать снова"</li>
            </ol>
        </div>
    `;
    
    adviceDiv.innerHTML = studyGuide;
}
/* ========================================================
   ✅ ПРОВЕРКА ПЕРЕСДАЧИ
   ======================================================== */

function checkRetryAnswers(testId) {
    let allCorrect = true;
    const results = [];
    
    wrongQuestions.forEach((q, index) => {
        let userAns = '';
        
        if (q.type === 'choice') {
            const radios = document.querySelectorAll(`input[name="q_0_${index}"]:checked`);
            if (radios.length > 0) {
                userAns = radios[0].value;
            }
        } else if (q.type === 'multiple') {
            const checkboxes = document.querySelectorAll(`input[name^="q_0_${index}"]:checked`);
            userAns = Array.from(checkboxes).map(cb => cb.value).sort().join(',');
        } else {
            const input = document.querySelector(`.u-ans[data-question-index="${index}"]`);
            if (input) {
                userAns = input.value.trim().toLowerCase();
            }
        }
        
        const correctAns = q.type === 'multiple' ? 
            (Array.isArray(q.a) ? q.a.sort().join(',') : q.a) : 
            (q.a ? q.a.toString().toLowerCase() : '');
        
        const isCorrect = userAns === correctAns;
        results.push({
            question: q.t,
            isCorrect: isCorrect,
            userAnswer: userAns,
            correctAnswer: correctAns
        });
        
        if (!isCorrect) {
            allCorrect = false;
        }
    });
    
    if (allCorrect) {
        alert("🎉 Отлично! Ты исправил все ошибки!");
        
        const comp = JSON.parse(localStorage.getItem(`comp_${currentUser.name}`)) || [];
        if (!comp.includes(testId)) comp.push(testId);
        localStorage.setItem(`comp_${currentUser.name}`, JSON.stringify(comp));
        
        wrongQuestions = [];
        updateProgressBar();
        
        setTimeout(() => {
            location.reload();
        }, 2000);
    } else {
        // Показываем какие ответы всё ещё неправильные
        const wrongNow = results.filter(r => !r.isCorrect);
        let message = "Ещё есть ошибки:\n\n";
        wrongNow.forEach(w => {
            message += `❌ ${w.question}\nПравильно: ${w.correctAnswer}\n\n`;
        });
        alert(message);
    }
}

/* ========================================================
   🏆 ЛИДЕРБОРД
   ======================================================== */

function renderClassmates() {
    const list = document.getElementById('classmates-list');
    if (!list || !currentUser) return;
    
    const myClass = currentUser.grade || "";
    const classmates = DB_STUDENTS.filter(s => s.split('/')[2] === myClass);
    
    if (classmates.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:40px;">👥 В классе пока нет учеников</div>';
        return;
    }
    
    const boardData = classmates.map(s => {
        const name = s.split('/')[0];
        const completed = JSON.parse(localStorage.getItem(`comp_${name}`)) || [];
        const photo = localStorage.getItem(`photo_${name}`);
        const emoji = localStorage.getItem(`avatar_${name}`);
        
        return {
            name: name,
            score: completed.length * 10,
            photo: photo,
            emoji: emoji,
            initial: name.charAt(0).toUpperCase()
        };
    }).sort((a, b) => b.score - a.score);
    
    let html = '';
    
    boardData.forEach((student, i) => {
        let tier = 'B';
        let medal = '';
        
        if (i === 0) {
            tier = 'S';
            medal = '🥇';
        } else if (i === 1) {
            tier = 'A';
            medal = '🥈';
        } else if (i === 2) {
            tier = 'A';
            medal = '🥉';
        }
        
        let avatarContent = student.initial;
        let avatarStyle = '';
        
        if (student.photo) {
            avatarStyle = `style="background-image: url('${student.photo}'); background-size: cover; background-position: center;"`;
            avatarContent = '';
        } else if (student.emoji) {
            avatarContent = student.emoji;
        }
        
        html += `
            <div class="classmate-row">
                <div class="tier-badge tier-${tier}">${tier}</div>
                <div class="classmate-avatar" ${avatarStyle}>${avatarContent}</div>
                <div class="classmate-info">
                    <div class="classmate-name">
                        ${student.name} 
                        <span class="medal">${medal}</span>
                    </div>
                    <div class="classmate-score">${student.score}</div>
                </div>
            </div>
        `;
    });
    
    list.innerHTML = html;
}

function toggleLeaderboard() {
    const bookmark = document.querySelector('.bookmark');
    const leaderboard = document.getElementById('leaderboard');
    
    if (!bookmark || !leaderboard) return;
    
    if (leaderboard.classList.contains('show')) {
        leaderboard.classList.remove('show');
        bookmark.classList.remove('active');
    } else {
        renderClassmates();
        leaderboard.classList.add('show');
        bookmark.classList.add('active');
    }
}

function setupLeaderboard() {
    const bookmark = document.querySelector('.bookmark');
    const leaderboard = document.getElementById('leaderboard');
    
    if (!bookmark || !leaderboard) return;
    
    const newBookmark = bookmark.cloneNode(true);
    bookmark.parentNode.replaceChild(newBookmark, bookmark);
    
    const finalBookmark = document.querySelector('.bookmark');
    const finalLeaderboard = document.getElementById('leaderboard');
    
    finalBookmark.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleLeaderboard();
    });
    
    document.addEventListener('click', function(e) {
        if (!finalBookmark.contains(e.target) && !finalLeaderboard.contains(e.target)) {
            finalLeaderboard.classList.remove('show');
            finalBookmark.classList.remove('active');
        }
    });
    
    finalLeaderboard.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

/* ========================================================
   🎯 ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ
   ======================================================== */

function showWelcomeMessage() {
    const hours = new Date().getHours();
    let greeting = "";
    
    if (hours < 12) greeting = "Доброе утро";
    else if (hours < 18) greeting = "Добрый день";
    else greeting = "Добрый вечер";
    
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `${greeting}, ${currentUser.name}!`;
    
    const container = document.querySelector('.container');
    if (container && !document.querySelector('.welcome-message')) {
        container.insertBefore(welcomeDiv, container.firstChild);
        
        setTimeout(() => {
            welcomeDiv.style.opacity = '0';
            setTimeout(() => welcomeDiv.remove(), 500);
        }, 5000);
    }
}

function updateProgressBar() {
    const container = document.querySelector('.container');
    if (!container) return;
    
    const comp = JSON.parse(localStorage.getItem(`comp_${currentUser.name}`)) || [];
    const myGrade = (currentUser.grade || "").toString().toUpperCase().trim();
    const myTests = assignedTests.filter(t => (t.target || "").toString().toUpperCase().trim() === myGrade);
    
    const totalTests = myTests.length;
    const completedTests = comp.length;
    const progress = totalTests > 0 ? (completedTests / totalTests) * 100 : 0;
    
    const oldProgress = document.querySelector('.progress-container');
    if (oldProgress) oldProgress.remove();
    
    const progressHTML = `
        <div class="progress-container">
            <div class="progress-header">
                <span>Твой прогресс</span>
                <span class="progress-stats">${completedTests}/${totalTests} тестов</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('afterbegin', progressHTML);
}

/* ========================================================
   🍎 ЛОГИКА УЧИТЕЛЯ
   ======================================================== */

function initTeacher() {
    if (document.getElementById('t-h-name')) {
        document.getElementById('t-h-name').innerText = currentUser.name;
    }
    updateDraftsUI();
    renderErrorStats();
    updateTStats();
}

function getClassStudents(className) {
    return DB_STUDENTS.filter(s => s.split('/')[2] === className);
}

function createNewTopic() {
    const container = document.getElementById('master-editor');
    if (!container) return;
    
    const currentCount = document.querySelectorAll('.topic-card').length;
    if (currentCount >= 15) return alert("Максимум 15 тем!");

    const topicId = Date.now();
    const topicHtml = `
        <div class="topic-card" id="topic-${topicId}" style="background:white; border-radius:40px; padding:30px; margin-bottom:30px; border:4px solid var(--accent);">
            <div style="display:flex; gap:20px; align-items:center; margin-bottom:25px;">
                <div style="background:var(--accent); color:white; width:40px; height:40px; border-radius:15px; display:flex; align-items:center; justify-content:center; font-weight:900;">${currentCount+1}</div>
                <input type="text" class="topic-title" placeholder="Название темы..." style="flex:1; border:none; border-bottom:3px solid #eee; font-size:1.4rem; font-weight:800; outline:none;">
                <button onclick="this.closest('.topic-card').remove()" style="background:none; border:none; cursor:pointer; font-size:1.5rem;">🗑️</button>
            </div>
            <div class="questions-list" id="qlist-${topicId}"></div>
            <div style="display:flex; gap:10px; margin-top:20px; flex-wrap: wrap;">
                <button onclick="addQuestion(${topicId}, 'text')" class="btn-question" style="background:#f1f2f6; border:none; padding:12px 20px; border-radius:20px; cursor:pointer; font-weight:700;">📝 Текст</button>
                <button onclick="addQuestion(${topicId}, 'number')" class="btn-question" style="background:#f1f2f6; border:none; padding:12px 20px; border-radius:20px; cursor:pointer; font-weight:700;">🔢 Число</button>
                <button onclick="addChoiceQuestion(${topicId})" class="btn-question" style="background:#e3f2fd; border:2px solid #64b5f6; padding:12px 20px; border-radius:20px; cursor:pointer; font-weight:700; color:#1976d2;">🔘 Выбор (1 ответ)</button>
                <button onclick="addMultipleChoiceQuestion(${topicId})" class="btn-question" style="background:#fff3e0; border:2px solid #ffb74d; padding:12px 20px; border-radius:20px; cursor:pointer; font-weight:700; color:#f57c00;">🔲 Выбор (несколько)</button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', topicHtml);
}

function addChoiceQuestion(topicId) {
    const questionsList = document.getElementById(`qlist-${topicId}`);
    if (!questionsList) return;
    
    const questionHtml = `
        <div class="question-item choice-item" style="background:#f8f9fa; border-radius:20px; padding:20px; margin-bottom:15px; border-left:8px solid #64b5f6;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                <span style="font-weight:700; color:#1976d2;">🔘 Вопрос с выбором (1 ответ)</span>
                <button onclick="this.closest('.question-item').remove()" style="background:none; border:none; cursor:pointer;">❌</button>
            </div>
            <input type="text" class="q-text" placeholder="Текст вопроса (например: Что больше?)" style="width:100%; padding:12px; border:2px solid #eee; border-radius:15px; margin-bottom:15px;">
            
            <div style="margin-bottom:15px;">
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                    <input type="text" class="choice-option" placeholder="Вариант ответа 1" style="flex:1; padding:10px; border:2px solid #eee; border-radius:12px;">
                    <div class="correct-checkbox" onclick="toggleCorrect(this)" style="width:30px; height:30px; border:3px solid #00b894; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:20px; color:#00b894;"></div>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                    <input type="text" class="choice-option" placeholder="Вариант ответа 2" style="flex:1; padding:10px; border:2px solid #eee; border-radius:12px;">
                    <div class="correct-checkbox" onclick="toggleCorrect(this)" style="width:30px; height:30px; border:3px solid #00b894; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:20px; color:#00b894;"></div>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                    <input type="text" class="choice-option" placeholder="Вариант ответа 3 (необязательно)" style="flex:1; padding:10px; border:2px solid #eee; border-radius:12px;">
                    <div class="correct-checkbox" onclick="toggleCorrect(this)" style="width:30px; height:30px; border:3px solid #00b894; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:20px; color:#00b894;"></div>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                    <input type="text" class="choice-option" placeholder="Вариант ответа 4 (необязательно)" style="flex:1; padding:10px; border:2px solid #eee; border-radius:12px;">
                    <div class="correct-checkbox" onclick="toggleCorrect(this)" style="width:30px; height:30px; border:3px solid #00b894; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:20px; color:#00b894;"></div>
                </div>
            </div>
            
            <p style="font-size:0.9rem; color:#666; margin-top:10px;">✓ Нажмите на квадратик, чтобы отметить правильный ответ</p>
        </div>
    `;
    
    questionsList.insertAdjacentHTML('beforeend', questionHtml);
}

function addMultipleChoiceQuestion(topicId) {
    const questionsList = document.getElementById(`qlist-${topicId}`);
    if (!questionsList) return;
    
    const questionHtml = `
        <div class="question-item multiple-choice-item" style="background:#f8f9fa; border-radius:20px; padding:20px; margin-bottom:15px; border-left:8px solid #ffb74d;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                <span style="font-weight:700; color:#f57c00;">🔲 Вопрос с выбором (несколько ответов)</span>
                <button onclick="this.closest('.question-item').remove()" style="background:none; border:none; cursor:pointer;">❌</button>
            </div>
            <input type="text" class="q-text" placeholder="Текст вопроса" style="width:100%; padding:12px; border:2px solid #eee; border-radius:15px; margin-bottom:15px;">
            
            <div style="margin-bottom:15px;">
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                    <input type="text" class="choice-option" placeholder="Вариант ответа 1" style="flex:1; padding:10px; border:2px solid #eee; border-radius:12px;">
                    <div class="correct-checkbox" onclick="toggleMultipleCorrect(this)" style="width:30px; height:30px; border:3px solid #f57c00; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:20px; color:#f57c00;"></div>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                    <input type="text" class="choice-option" placeholder="Вариант ответа 2" style="flex:1; padding:10px; border:2px solid #eee; border-radius:12px;">
                    <div class="correct-checkbox" onclick="toggleMultipleCorrect(this)" style="width:30px; height:30px; border:3px solid #f57c00; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:20px; color:#f57c00;"></div>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                    <input type="text" class="choice-option" placeholder="Вариант ответа 3 (необязательно)" style="flex:1; padding:10px; border:2px solid #eee; border-radius:12px;">
                    <div class="correct-checkbox" onclick="toggleMultipleCorrect(this)" style="width:30px; height:30px; border:3px solid #f57c00; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:20px; color:#f57c00;"></div>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                    <input type="text" class="choice-option" placeholder="Вариант ответа 4 (необязательно)" style="flex:1; padding:10px; border:2px solid #eee; border-radius:12px;">
                    <div class="correct-checkbox" onclick="toggleMultipleCorrect(this)" style="width:30px; height:30px; border:3px solid #f57c00; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:20px; color:#f57c00;"></div>
                </div>
            </div>
            
            <p style="font-size:0.9rem; color:#666; margin-top:10px;">✓ Нажимайте на квадратики, чтобы отметить правильные ответы (можно несколько)</p>
        </div>
    `;
    
    questionsList.insertAdjacentHTML('beforeend', questionHtml);
}

function addQuestion(topicId, type) {
    const questionsList = document.getElementById(`qlist-${topicId}`);
    if (!questionsList) return;
    
    const questionHtml = `
        <div class="question-item" style="background:#f8f9fa; border-radius:20px; padding:20px; margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span style="font-weight:700; color:var(--accent);">${type === 'text' ? '📝 Текст' : '🔢 Число'}</span>
                <button onclick="this.closest('.question-item').remove()" style="background:none; border:none; cursor:pointer;">❌</button>
            </div>
            <input type="text" class="q-text" placeholder="Вопрос..." style="width:100%; padding:12px; border:2px solid #eee; border-radius:15px; margin-bottom:10px;">
            <input type="${type === 'number' ? 'number' : 'text'}" class="q-answer" placeholder="Правильный ответ..." style="width:100%; padding:12px; border:2px solid #00b894; border-radius:15px;">
        </div>
    `;
    
    questionsList.insertAdjacentHTML('beforeend', questionHtml);
}

function toggleCorrect(element) {
    const parentQuestion = element.closest('.question-item');
    const checkboxes = parentQuestion.querySelectorAll('.correct-checkbox');
    checkboxes.forEach(cb => {
        cb.innerHTML = '';
        cb.style.backgroundColor = 'transparent';
    });
    
    element.innerHTML = '✓';
    element.style.backgroundColor = '#00b894';
    element.style.color = 'white';
}

function toggleMultipleCorrect(element) {
    if (element.innerHTML === '✓') {
        element.innerHTML = '';
        element.style.backgroundColor = 'transparent';
        element.style.color = '#f57c00';
    } else {
        element.innerHTML = '✓';
        element.style.backgroundColor = '#f57c00';
        element.style.color = 'white';
    }
}

function publishFinal() {
    const targetEl = document.getElementById('class-name') || document.getElementById('target-cls');
    const targetClass = targetEl.value.toUpperCase().trim();
    const cards = document.querySelectorAll('.topic-card');

    if (!targetClass || !cards.length) {
        return alert("Укажите класс и создайте хотя бы одну тему!");
    }

    const modules = [];
    
    cards.forEach(card => {
        const title = card.querySelector('.topic-title').value.trim();
        const qs = Array.from(card.querySelectorAll('.question-item')).map(q => {
            if (q.classList.contains('choice-item')) {
                const questionText = q.querySelector('.q-text').value.trim();
                const optionInputs = q.querySelectorAll('.choice-option');
                const checkboxes = q.querySelectorAll('.correct-checkbox');
                
                const options = [];
                let correctIndex = -1;
                
                optionInputs.forEach((input, index) => {
                    const value = input.value.trim();
                    if (value) {
                        options.push(value);
                        if (checkboxes[index] && checkboxes[index].innerHTML === '✓') {
                            correctIndex = index;
                        }
                    }
                });
                
                if (questionText && options.length >= 2 && correctIndex !== -1) {
                    return {
                        t: questionText,
                        type: 'choice',
                        options: options,
                        a: correctIndex.toString()
                    };
                }
            } else if (q.classList.contains('multiple-choice-item')) {
                const questionText = q.querySelector('.q-text').value.trim();
                const optionInputs = q.querySelectorAll('.choice-option');
                const checkboxes = q.querySelectorAll('.correct-checkbox');
                
                const options = [];
                const correctIndices = [];
                
                optionInputs.forEach((input, index) => {
                    const value = input.value.trim();
                    if (value) {
                        options.push(value);
                        if (checkboxes[index] && checkboxes[index].innerHTML === '✓') {
                            correctIndices.push(index);
                        }
                    }
                });
                
                if (questionText && options.length >= 2 && correctIndices.length > 0) {
                    return {
                        t: questionText,
                        type: 'multiple',
                        options: options,
                        a: correctIndices.sort().join(',')
                    };
                }
            } else {
                const questionText = q.querySelector('.q-text').value.trim();
                const answer = q.querySelector('.q-answer').value.trim();
                
                if (questionText && answer) {
                    return {
                        t: questionText,
                        a: answer
                    };
                }
            }
            return null;
        }).filter(q => q !== null);
        
        if (title && qs.length) {
            modules.push({ title, qs });
        }
    });

    assignedTests.push({
        id: Date.now(),
        author: currentUser.name,
        target: targetClass,
        topic: modules[0].title + (modules.length > 1 ? ` (+${modules.length-1} тем)` : ""),
        modules: modules
    });

    localStorage.setItem('edu_assigned', JSON.stringify(assignedTests));
    alert("Тест успешно опубликован для " + targetClass);
    
    // Очищаем редактор
    document.getElementById('master-editor').innerHTML = '';
}

function updateTStats() {
    const el = document.getElementById('t-count');
    if (el) el.innerText = document.querySelectorAll('.topic-card').length;
    document.querySelectorAll('.topic-num').forEach((n, i) => n.innerText = i + 1);
}

function saveDraft() {
    const topic = document.getElementById('test-topic').value.trim();
    const items = document.querySelectorAll('.q-item');
    const qs = [];
    
    items.forEach(item => {
        const t = item.querySelector('.qt-input').value;
        const a = item.querySelector('.qa-input').value;
        if (t && a) qs.push({ t, a, type: item.dataset.type });
    });
    
    if (!topic || qs.length < 1) {
        return alert("Заполни название и добавь вопросы!");
    }
    
    drafts.push({ id: Date.now(), topic, qs, author: currentUser.name });
    localStorage.setItem('edu_drafts', JSON.stringify(drafts));
    updateDraftsUI();
    
    document.getElementById('q-list').innerHTML = '';
    document.getElementById('test-topic').value = '';
}

function updateDraftsUI() {
    const sel = document.getElementById('draft-select');
    if (sel) {
        sel.innerHTML = drafts.map(d => `<option value="${d.id}">${d.topic}</option>`).join('');
    }
}

function renderErrorStats() {
    const div = document.getElementById('error-analysis');
    if (div) {
        const entries = Object.entries(globalErrors);
        div.innerHTML = entries.length ? 
            entries.map(([q, count]) => `<p>🔴 <b>${q}</b>: ${count} ош.</p>`).join('') : 
            "Ошибок пока нет.";
    }
}

/* ========================================================
   ✨ ПРОФИЛЬ И АВАТАРКИ
   ======================================================== */

function loadAvatarUI() {
    const icon = document.getElementById('h-initials') || document.querySelector('.mini-avatar');
    if (!icon || !currentUser) return;

    const photo = localStorage.getItem(`photo_${currentUser.name}`);
    const emoji = localStorage.getItem(`avatar_${currentUser.name}`);

    if (photo) {
        icon.style.backgroundImage = `url(${photo})`;
        icon.style.backgroundSize = "cover";
        icon.style.backgroundPosition = "center";
        icon.innerText = "";
    } else if (emoji) {
        icon.style.backgroundImage = "none";
        icon.innerText = emoji;
    } else {
        icon.style.backgroundImage = "none";
        icon.innerText = currentUser.name.charAt(0).toUpperCase();
    }
}

function setAvatar(emoji) {
    localStorage.setItem(`avatar_${currentUser.name}`, emoji);
    localStorage.removeItem(`photo_${currentUser.name}`);
    loadAvatarUI();
    
    const modal = document.getElementById('avatar-modal');
    if (modal) modal.classList.remove('active');
}

function uploadPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            localStorage.setItem(`photo_${currentUser.name}`, e.target.result);
            localStorage.removeItem(`avatar_${currentUser.name}`);
            loadAvatarUI();
            
            const modal = document.getElementById('avatar-modal');
            if (modal) modal.classList.remove('active');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function startAvatarAnim() {
    const drop = document.getElementById('drop-anim');
    if (!drop) return;
    
    document.getElementById('avatar-modal').classList.add('active');
    drop.style.opacity = "1";
    drop.classList.remove('drop-fall');
    void drop.offsetWidth; 
    drop.classList.add('drop-fall');
    
    setTimeout(() => { 
        drop.style.opacity = "0"; 
    }, 1200);
}

function toggleProfile() {
    const menu = document.getElementById('dropdown');
    if (menu) menu.classList.toggle('show');
}
