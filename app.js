// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

import { config } from './config.js';

let tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Инициализация Socket.IO
let socket = null;

function initSocket() {
    if (!socket) {
        socket = io(config.WS_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });
        
        socket.on('connect', () => {
            console.log('✅ Подключено к серверу');
        });
        
        socket.on('disconnect', () => {
            console.log('❌ Отключено от сервера');
        });
        
        socket.on('error', (error) => {
            console.error('❌ Ошибка Socket.IO:', error);
        });
        
        // Обработчики событий
        socket.on('game-joined', handleGameJoined);
        socket.on('player-joined', handlePlayerJoined);
        socket.on('new-message', handleNewMessage);
        socket.on('score-updated', handleScoreUpdated);
        socket.on('game-started', handleGameStarted);
        socket.on('level-changed', handleLevelChanged);
    }
    return socket;
}

// Обработчики событий от сервера
function handleGameJoined(data) {
    console.log('Присоединились к игре:', data);
    // Обновляем состояние
    if (data.teams) {
        state.teams = data.teams;
    }
}

function handlePlayerJoined(data) {
    console.log('Новый игрок:', data);
    // Показываем уведомление
    showNotification(`${data.name} присоединился к игре`);
}

function handleNewMessage(data) {
    console.log('Новое сообщение:', data);
    addMessageToChat(data);
}

function handleScoreUpdated(data) {
    console.log('Обновлён счёт:', data);
    updateTeamScore(data.teamId, data.score);
}

function handleGameStarted(data) {
    console.log('Игра началась, уровень:', data.level);
    startLevel1();
}

function handleLevelChanged(data) {
    console.log('Смена уровня:', data.level);
    if (data.level === 2) {
        startLevel2();
    } else if (data.level === 3) {
        startLevel3();
    }
}

// Вспомогательные функции
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--primary);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function addMessageToChat(data) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    if (data.playerName === state.playerName) {
        messageDiv.classList.add('own');
    }
    messageDiv.innerHTML = `
        <div class="message-author">${data.playerName}</div>
        <div class="message-text">${data.message}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateTeamScore(teamId, score) {
    const team = state.teams.find(t => t.id === teamId);
    if (team) {
        team.score = score;
    }
    
    // Обновляем отображение если это наша команда
    if (teamId === state.teamId) {
        state.score = score;
        const scoreElements = document.querySelectorAll('#team-score, #current-score');
        scoreElements.forEach(el => {
            if (el) el.textContent = score;
        });
    }
}

// Состояние приложения
const state = {
    currentScreen: 'main-menu',
    gameCode: null,
    gameId: null,
    playerName: null,
    teamId: null,
    teamName: null,
    role: null,
    currentLevel: 0,
    score: 100,
    teams: [],
    isTeacher: false,
    currentCard: 0,
    eventCards: [],
    timer: null,
    teacherInterval: null
};

// ============================================
// НАВИГАЦИЯ МЕЖДУ ЭКРАНАМИ
// ============================================

function showScreen(screenId) {
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Показываем нужный экран
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
        state.currentScreen = screenId;
    }
    
    // Обновляем кнопку "Назад" в Telegram
    if (screenId === 'main-menu') {
        tg.BackButton.hide();
    } else {
        tg.BackButton.show();
    }
}

// Обработка кнопки "Назад" в Telegram
tg.BackButton.onClick(() => {
    if (state.currentScreen === 'main-menu') {
        tg.close();
    } else {
        showScreen('main-menu');
    }
});

// ============================================
// БЫСТРЫЙ СТАРТ (ДЛЯ ТЕСТИРОВАНИЯ)
// ============================================

function quickStartGame() {
    // Создаём игру с настройками по умолчанию
    generateTeams();
    
    // Создаём игрока автоматически
    state.playerName = 'Тестовый игрок';
    state.teamId = 1;
    state.teamName = state.teams[0].name;
    state.role = 'ceo';
    state.score = 100;
    
    // Добавляем игрока в команду
    state.teams[0].members.push({
        name: state.playerName,
        role: state.role
    });
    
    // Сразу начинаем Уровень 1
    startLevel1();
}

// ============================================
// СОЗДАНИЕ ИГРЫ (ПРЕПОДАВАТЕЛЬ)
// ============================================

let gameSettings = {
    teamCount: 4,
    playersPerTeam: 5,
    timeLevel1: 10,
    timeLevel2: 15,
    timeLevel3: 15
};

function changeTeams(delta) {
    gameSettings.teamCount = Math.max(1, Math.min(10, gameSettings.teamCount + delta));
    document.getElementById('team-count').textContent = gameSettings.teamCount;
}

function changePlayersPerTeam(delta) {
    gameSettings.playersPerTeam = Math.max(1, Math.min(10, gameSettings.playersPerTeam + delta));
    document.getElementById('players-per-team').textContent = gameSettings.playersPerTeam;
}

function changeTime(level, delta) {
    const key = 'time' + level.charAt(0).toUpperCase() + level.slice(1);
    gameSettings[key] = Math.max(5, Math.min(30, gameSettings[key] + delta));
    document.getElementById('time-' + level).textContent = gameSettings[key];
}

function createGame() {
    state.isTeacher = true;
    
    // Отправляем запрос на сервер для создания игры
    fetch(`${config.API_URL}/api/game/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings: gameSettings })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            state.gameCode = data.code;
            state.gameId = data.gameId;
            
            // Показываем экран с кодом
            document.getElementById('room-code').textContent = state.gameCode;
            showScreen('game-code');
            
            // Инициализируем Socket.IO
            initSocket();
            
            console.log('Создана игра:', state.gameCode, gameSettings);
        } else {
            alert('Ошибка создания игры: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        alert('Не удалось подключиться к серверу');
    });
}

function generateGameCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Режим: преподаватель управляет игрой  
function startGameAsTeacher() {
    // Запрашиваем данные игры с сервера
    fetch(`${config.API_URL}/api/game/${state.gameCode}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                state.teams = data.game.teams;
                state.isTeacher = true;
                
                // Инициализируем Socket.IO
                initSocket();
                
                // Показываем панель преподавателя
                showTeacherPanel();
                
                // Запускаем обновление данных каждые 2 секунды
                state.teacherInterval = setInterval(() => {
                    updateTeacherPanel();
                }, 2000);
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Не удалось загрузить данные игры. Проверьте подключение к серверу.');
        });
}

function showTeacherPanel() {
    document.getElementById('teacher-game-code').textContent = state.gameCode;
    updateTeacherPanel();
    showScreen('teacher-panel');
}

function updateTeacherPanel() {
    // Обновляем список команд и участников
    fetch(`${config.API_URL}/api/game/${state.gameCode}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                state.teams = data.game.teams;
                const players = data.game.players || [];
                
                // Обновляем список команд
                const teamsList = document.getElementById('teacher-teams-list');
                teamsList.innerHTML = '';
                
                state.teams.forEach(team => {
                    const teamPlayers = players.filter(p => p.team_id === team.id);
                    const teamDiv = document.createElement('div');
                    teamDiv.style.cssText = `
                        background: var(--bg-secondary);
                        padding: 16px;
                        border-radius: 12px;
                        margin-bottom: 12px;
                    `;
                    teamDiv.innerHTML = `
                        <h4 style="margin-bottom: 8px;">${team.name}</h4>
                        <p style="font-size: 14px; opacity: 0.8;">
                            Участников: ${teamPlayers.length} | Счёт: ${team.score}
                        </p>
                        ${teamPlayers.length > 0 ? `
                            <div style="margin-top: 8px;">
                                ${teamPlayers.map(p => `
                                    <span style="
                                        display: inline-block;
                                        background: var(--primary);
                                        padding: 4px 12px;
                                        border-radius: 20px;
                                        font-size: 12px;
                                        margin: 4px;
                                    ">${p.name} (${getRoleName(p.role).split(' - ')[0]})</span>
                                `).join('')}
                            </div>
                        ` : '<p style="font-size: 12px; opacity: 0.6; margin-top: 4px;">Нет участников</p>'}
                    `;
                    teamsList.appendChild(teamDiv);
                });
                
                // Обновляем счёт
                const scoresDiv = document.getElementById('teacher-scores');
                scoresDiv.innerHTML = state.teams
                    .sort((a, b) => b.score - a.score)
                    .map((team, index) => `
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 12px;
                            background: var(--bg-secondary);
                            border-radius: 12px;
                            margin-bottom: 8px;
                        ">
                            <span>${index + 1}. ${team.name}</span>
                            <span style="font-size: 20px; font-weight: 700; color: var(--accent);">
                                ${team.score}
                            </span>
                        </div>
                    `).join('');
            }
        })
        .catch(error => {
            console.error('Ошибка обновления:', error);
        });
}

function teacherStartLevel(level) {
    // Отправляем всем игрокам команду начать уровень
    fetch(`${config.API_URL}/api/game/${state.gameCode}/next-level`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`Уровень ${level} начат! Все участники получили уведомление.`);
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        alert('Не удалось начать уровень');
    });
}

function teacherShowResults() {
    // Показываем результаты
    showResults();
}

// Режим: быстрая игра для одного игрока (тестирование)
function startGameAsSinglePlayer() {
    // Запрашиваем данные игры
    fetch(`${config.API_URL}/api/game/${state.gameCode}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                state.teams = data.game.teams;
                
                // Создаём игрока автоматически
                state.playerName = 'Игрок 1';
                state.teamId = state.teams[0].id;
                state.teamName = state.teams[0].name;
                state.role = 'ceo';
                
                // Инициализируем Socket.IO и присоединяемся к игре
                const s = initSocket();
                s.emit('join-game', {
                    code: state.gameCode,
                    playerName: state.playerName,
                    teamId: state.teamId,
                    role: state.role
                });
                
                // Сразу начинаем Уровень 1
                setTimeout(() => {
                    startLevel1();
                }, 500);
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Не удалось загрузить данные игры');
        });
}

function generateTeams() {
    const teamNames = ['Альфа', 'Бета', 'Гамма', 'Дельта', 'Эпсилон', 'Сигма'];
    state.teams = [];
    
    for (let i = 0; i < gameSettings.teamCount; i++) {
        state.teams.push({
            id: i + 1,
            name: `Команда ${teamNames[i]}`,
            score: 100,
            members: [],
            level1Idea: null,
            level2Choices: [],
            level3Plan: null
        });
    }
}

// ============================================
// ВХОД В ИГРУ (УЧАСТНИК)
// ============================================

function joinGame() {
    const code = document.getElementById('join-code').value.toUpperCase();
    const name = document.getElementById('player-name').value.trim();
    
    if (!code || code.length !== 6) {
        alert('Введите корректный код игры (6 символов)');
        return;
    }
    
    if (!name) {
        alert('Введите ваше имя');
        return;
    }
    
    state.gameCode = code;
    state.playerName = name;
    
    // В реальном приложении здесь будет запрос на сервер
    console.log('Подключение к игре:', code, name);
    
    // Показываем выбор команды
    showTeamSelection();
}

function showTeamSelection() {
    const teamsContainer = document.getElementById('teams-list');
    teamsContainer.innerHTML = '';
    
    // Если команды еще не созданы, создаем их для демо
    if (state.teams.length === 0) {
        generateTeams();
    }
    
    state.teams.forEach(team => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';
        teamCard.innerHTML = `
            <h3>${team.name}</h3>
            <p class="team-count">${team.members.length}/5 участников</p>
        `;
        teamCard.onclick = () => selectTeam(team.id);
        teamsContainer.appendChild(teamCard);
    });
    
    showScreen('team-selection');
}

function selectTeam(teamId) {
    state.teamId = teamId;
    const team = state.teams.find(t => t.id === teamId);
    state.teamName = team.name;
    
    // Подсвечиваем выбранную команду
    document.querySelectorAll('.team-card').forEach((card, index) => {
        card.classList.toggle('selected', index + 1 === teamId);
    });
}

// ============================================
// ВЫБОР РОЛИ
// ============================================

function selectRole(role) {
    state.role = role;
    
    // Подсвечиваем выбранную роль
    document.querySelectorAll('.role-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.role-card').classList.add('selected');
    
    // Добавляем игрока в команду
    const team = state.teams.find(t => t.id === state.teamId);
    team.members.push({
        name: state.playerName,
        role: role
    });
    
    // Переходим в лобби
    setTimeout(() => {
        showLobby();
    }, 500);
}

function showLobby() {
    document.getElementById('team-name').textContent = state.teamName;
    document.getElementById('team-score').textContent = state.score;
    
    // Отображаем участников команды
    const membersList = document.getElementById('members-list');
    membersList.innerHTML = '';
    
    const team = state.teams.find(t => t.id === state.teamId);
    team.members.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'member-item';
        memberDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-card); border-radius: 12px; margin-bottom: 8px;">
                <span style="font-size: 24px;">${getRoleIcon(member.role)}</span>
                <div>
                    <div style="font-weight: 600;">${member.name}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${getRoleName(member.role)}</div>
                </div>
            </div>
        `;
        membersList.appendChild(memberDiv);
    });
    
    showScreen('lobby');
}

function getRoleIcon(role) {
    const icons = {
        ceo: '👔',
        cmo: '📢',
        cto: '💻',
        cfo: '💰',
        coo: '⚙️'
    };
    return icons[role] || '👤';
}

function getRoleName(role) {
    const names = {
        ceo: 'CEO - Генеральный директор',
        cmo: 'CMO - Директор по маркетингу',
        cto: 'CTO - Технический директор',
        cfo: 'CFO - Финансовый директор',
        coo: 'COO - Операционный директор'
    };
    return names[role] || 'Менеджер';
}

// ============================================
// УРОВЕНЬ 1: ИДЕЯ
// ============================================

const businessCategories = [
    'Образовательные технологии',
    'Здоровье и фитнес',
    'Экология и устойчивое развитие',
    'Развлечения и медиа',
    'Финансовые технологии',
    'Доставка и логистика',
    'Умный дом и IoT',
    'Социальные сети',
    'Путешествия и туризм',
    'Мода и стиль'
];

function startLevel1() {
    // Случайная категория бизнеса
    const category = businessCategories[Math.floor(Math.random() * businessCategories.length)];
    document.getElementById('business-category').textContent = category;
    
    // Запускаем таймер
    startTimer('timer1', gameSettings.timeLevel1 * 60);
    
    showScreen('level1');
}

function startTimer(elementId, seconds) {
    const timerElement = document.getElementById(elementId);
    let remaining = seconds;
    
    // Добавляем подсказку о пропуске
    const levelHeader = timerElement.closest('.level-header');
    if (levelHeader && !levelHeader.querySelector('.skip-hint')) {
        const skipHint = document.createElement('div');
        skipHint.className = 'skip-hint';
        skipHint.style.fontSize = '14px';
        skipHint.style.opacity = '0.7';
        skipHint.style.marginTop = '8px';
        skipHint.textContent = '💡 Подсказка: можно не ждать таймер и сразу отправить';
        levelHeader.appendChild(skipHint);
    }
    
    state.timer = setInterval(() => {
        remaining--;
        
        const minutes = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timerElement.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        
        if (remaining <= 0) {
            clearInterval(state.timer);
            timerElement.style.color = 'var(--danger)';
        }
    }, 1000);
}

function submitIdea() {
    const projectName = document.getElementById('project-name').value;
    const projectIdea = document.getElementById('project-idea').value;
    const targetAudience = document.getElementById('target-audience').value;
    const revenueModel = document.getElementById('revenue-model').value;
    
    if (!projectName || !projectIdea || !targetAudience || !revenueModel) {
        alert('Пожалуйста, заполните все поля!');
        return;
    }
    
    // Сохраняем идею
    const team = state.teams.find(t => t.id === state.teamId);
    team.level1Idea = {
        name: projectName,
        idea: projectIdea,
        audience: targetAudience,
        revenue: revenueModel
    };
    
    clearInterval(state.timer);
    
    // В реальном приложении отправляем на сервер
    console.log('Идея отправлена:', team.level1Idea);
    
    // Начисляем баллы за Уровень 1 (симуляция оценки преподавателя)
    const level1Score = Math.floor(Math.random() * 31) + 30; // от 30 до 60
    updateScore(level1Score);
    
    alert(`Уровень 1 завершён!\n\nВаша идея оценена в ${level1Score} баллов!\nТекущий счёт: ${state.score}\n\nПереходим к Уровню 2...`);
    
    // Переходим к Уровню 2
    setTimeout(() => {
        startLevel2();
    }, 1000);
}

// ============================================
// УРОВЕНЬ 2: КАРТОЧКИ СОБЫТИЙ
// ============================================

const eventCardsData = [
    {
        title: 'Конкурент скопировал идею',
        description: 'Крупный конкурент выпустил продукт, очень похожий на ваш. Что делать?',
        choices: [
            { text: 'Подать в суд за нарушение авторских прав', points: -10, type: 'negative' },
            { text: 'Ускорить разработку и добавить уникальные функции', points: 15, type: 'positive' },
            { text: 'Монетка: Запустить агрессивную маркетинговую кампанию', points: { win: 25, lose: -15 }, type: 'coin' }
        ]
    },
    {
        title: 'Инвестор предлагает сделку',
        description: 'Известный инвестор готов вложить $500K, но хочет 30% компании. У вас есть другие варианты финансирования.',
        choices: [
            { text: 'Принять предложение инвестора', points: 20, type: 'positive' },
            { text: 'Отказаться и искать другие источники', points: 0, type: 'neutral' },
            { text: 'Монетка: Попытаться договориться о 15%', points: { win: 30, lose: -10 }, type: 'coin' }
        ]
    },
    {
        title: 'Ключевой сотрудник уходит',
        description: 'Ваш лучший разработчик получил предложение от Google и собирается уйти через неделю.',
        choices: [
            { text: 'Повысить зарплату и предложить акции', points: -5, type: 'negative' },
            { text: 'Пожелать удачи и начать срочный найм', points: -15, type: 'negative' },
            { text: 'Монетка: Попытаться убедить остаться через миссию проекта', points: { win: 20, lose: -20 }, type: 'coin' }
        ]
    },
    {
        title: 'Вирусный момент',
        description: 'Известный блогер упомянул ваш продукт. Трафик вырос в 10 раз за день!',
        choices: [
            { text: 'Срочно масштабировать серверы (дорого)', points: 10, type: 'positive' },
            { text: 'Монетка: Рискнуть с текущей инфраструктурой', points: { win: 35, lose: -25 }, type: 'coin' },
            { text: 'Временно ограничить доступ новым пользователям', points: 5, type: 'positive' }
        ]
    },
    {
        title: 'Проблемы с безопасностью',
        description: 'Обнаружена уязвимость в вашем приложении. Хакеры уже об этом знают.',
        choices: [
            { text: 'Закрыть сервис на 2 дня для исправления', points: -5, type: 'negative' },
            { text: 'Монетка: Исправить "на ходу" за 6 часов', points: { win: 20, lose: -30 }, type: 'coin' },
            { text: 'Нанять компанию по кибербезопасности', points: 15, type: 'positive' }
        ]
    }
];

function startLevel2() {
    // Выбираем случайные карточки
    state.eventCards = shuffleArray([...eventCardsData]).slice(0, 5);
    state.currentCard = 0;
    
    // Запускаем таймер
    startTimer('timer2', gameSettings.timeLevel2 * 60);
    
    showScreen('level2');
    showEventCard();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function showEventCard() {
    const card = state.eventCards[state.currentCard];
    
    document.getElementById('current-card').textContent = state.currentCard + 1;
    document.getElementById('event-title').textContent = card.title;
    document.getElementById('event-description').textContent = card.description;
    
    // Обновляем прогресс
    const progress = ((state.currentCard + 1) / 5) * 100;
    document.getElementById('cards-progress').style.width = progress + '%';
    
    // Показываем варианты
    const choicesContainer = document.getElementById('event-choices');
    choicesContainer.innerHTML = '';
    
    card.choices.forEach((choice, index) => {
        const choiceBtn = document.createElement('div');
        choiceBtn.className = 'choice-btn';
        if (choice.type === 'coin') {
            choiceBtn.classList.add('coin-choice');
        }
        
        let pointsText = '';
        if (choice.type === 'coin') {
            pointsText = `<span class="choice-points coin">🎲 Бросок монетки</span>`;
        } else if (choice.points > 0) {
            pointsText = `<span class="choice-points positive">+${choice.points} баллов</span>`;
        } else if (choice.points < 0) {
            pointsText = `<span class="choice-points negative">${choice.points} баллов</span>`;
        } else {
            pointsText = `<span class="choice-points">0 баллов</span>`;
        }
        
        choiceBtn.innerHTML = `
            <div class="choice-text">${choice.text}</div>
            ${pointsText}
        `;
        
        choiceBtn.onclick = () => makeChoice(index);
        choicesContainer.appendChild(choiceBtn);
    });
}

function makeChoice(choiceIndex) {
    const card = state.eventCards[state.currentCard];
    const choice = card.choices[choiceIndex];
    
    if (choice.type === 'coin') {
        // Показываем модальное окно с монеткой
        flipCoin(choice.points);
    } else {
        // Обычное начисление баллов
        updateScore(choice.points);
        nextCard();
    }
}

function updateScore(points) {
    state.score += points;
    document.getElementById('current-score').textContent = state.score;
    
    // Анимация изменения счета
    const scoreElement = document.getElementById('current-score');
    scoreElement.classList.add('animate-slide-in');
    setTimeout(() => {
        scoreElement.classList.remove('animate-slide-in');
    }, 500);
}

function nextCard() {
    state.currentCard++;
    
    if (state.currentCard < state.eventCards.length) {
        setTimeout(() => {
            showEventCard();
        }, 1000);
    } else {
        // Все карточки пройдены
        clearInterval(state.timer);
        
        alert(`Уровень 2 завершён!\n\nВаш счёт: ${state.score}\n\nПереходим к финальному испытанию - Уровень 3...`);
        
        // Переходим к Уровню 3
        setTimeout(() => {
            startLevel3();
        }, 1000);
    }
}

// ============================================
// БРОСОК МОНЕТКИ
// ============================================

function flipCoin(points) {
    const modal = document.getElementById('coin-modal');
    modal.classList.add('active');
    
    // Определяем результат заранее
    const isWin = Math.random() > 0.5;
    
    // Анимация броска
    const coin = document.getElementById('coin');
    coin.style.animation = 'none';
    
    // Устанавливаем правильную финальную позицию монеты
    if (isWin) {
        // Орёл - монета остановится на heads (0deg или 360deg)
        coin.style.transform = 'rotateY(1440deg)'; // Чётное количество переворотов
    } else {
        // Решка - монета остановится на tails (180deg)
        coin.style.transform = 'rotateY(1620deg)'; // Нечётное количество переворотов (1440 + 180)
    }
    
    setTimeout(() => {
        coin.style.animation = 'flipCoin 2s ease-in-out';
    }, 10);
    
    // Показываем результат после анимации
    setTimeout(() => {
        const resultElement = document.getElementById('coin-result');
        
        if (isWin) {
            resultElement.textContent = `🎉 ОРЁЛ! +${points.win} баллов`;
            resultElement.className = 'coin-result win';
            updateScore(points.win);
        } else {
            resultElement.textContent = `😔 РЕШКА! ${points.lose} баллов`;
            resultElement.className = 'coin-result lose';
            updateScore(points.lose);
        }
    }, 2100);
}

function closeCoinModal() {
    const modal = document.getElementById('coin-modal');
    modal.classList.remove('active');
    document.getElementById('coin-result').textContent = '';
    
    nextCard();
}

// ============================================
// УРОВЕНЬ 3: БОСС-ФАЙТ
// ============================================

const crisisScenarios = [
    [
        'Крупнейший клиент расторг контракт без объяснений (-40% выручки)',
        'Ключевой инвестор потребовал вернуть деньги через 30 дней',
        'В команде назревает конфликт: 3 человека угрожают уйти',
        'Конкурент подал иск о нарушении патента на $2M',
        'Хакерская атака: утечка данных 10,000 пользователей'
    ],
    [
        'Производственный брак: 60% продукции последней партии дефектная',
        'Банк заморозил счета компании по подозрению в мошенничестве',
        'СМИ опубликовали негативное расследование о вашей компании',
        'Топ-менеджер уволился и увел за собой 5 лучших сотрудников',
        'Срыв сроков по главному проекту: штрафы и потеря репутации'
    ]
];

function startLevel3() {
    // Выбираем случайный сценарий кризисов
    const crisis = crisisScenarios[Math.floor(Math.random() * crisisScenarios.length)];
    
    const crisisList = document.getElementById('crisis-list');
    crisisList.innerHTML = '';
    
    crisis.forEach((crisisText, index) => {
        const crisisItem = document.createElement('div');
        crisisItem.className = 'crisis-item';
        crisisItem.innerHTML = `
            <span class="crisis-number">${index + 1}</span>
            <span class="crisis-text">${crisisText}</span>
        `;
        crisisList.appendChild(crisisItem);
    });
    
    // Запускаем таймер
    startTimer('timer3', gameSettings.timeLevel3 * 60);
    
    showScreen('level3');
}

function submitCrisisPlan() {
    const priorities = document.getElementById('priorities').value;
    const actions = document.getElementById('actions').value;
    const rolesDistribution = document.getElementById('roles-distribution').value;
    const timeline = document.getElementById('timeline').value;
    
    if (!priorities || !actions || !rolesDistribution || !timeline) {
        alert('Пожалуйста, заполните все поля плана!');
        return;
    }
    
    // Сохраняем план
    const team = state.teams.find(t => t.id === state.teamId);
    team.level3Plan = {
        priorities,
        actions,
        roles: rolesDistribution,
        timeline
    };
    
    clearInterval(state.timer);
    
    console.log('Антикризисный план отправлен:', team.level3Plan);
    
    // Начисляем баллы за Уровень 3 (симуляция оценки)
    const level3Score = Math.floor(Math.random() * 31) + 30; // от 30 до 60
    state.score += level3Score;
    team.score = state.score;
    
    alert(`Уровень 3 завершён!\n\nВаш план оценён в ${level3Score} баллов!\nФинальный счёт: ${state.score}\n\nПосмотрим результаты...`);
    
    // Показываем результаты
    setTimeout(() => {
        showResults();
    }, 1000);
}

// ============================================
// ЧАТ КОМАНДЫ
// ============================================

function toggleChat() {
    const chatWindow = document.getElementById('chat-window');
    chatWindow.style.display = chatWindow.style.display === 'none' ? 'block' : 'none';
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Отправляем через WebSocket
    if (socket && socket.connected) {
        socket.emit('send-message', {
            teamId: state.teamId,
            playerName: state.playerName,
            message: message
        });
    }
    
    input.value = '';
}

// ============================================
// РЕЗУЛЬТАТЫ
// ============================================

function showResults() {
    // Генерируем случайные результаты для других команд (для демонстрации)
    state.teams.forEach((team, index) => {
        if (index !== state.teamId - 1) {
            team.score = Math.floor(Math.random() * 100) + 100; // 100-200
        }
    });
    
    // Сортируем команды по баллам
    const sortedTeams = [...state.teams].sort((a, b) => b.score - a.score);
    
    const leaderboard = document.getElementById('leaderboard');
    leaderboard.innerHTML = '';
    
    sortedTeams.forEach((team, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        // Подсвечиваем команду игрока
        if (team.id === state.teamId) {
            item.style.border = '3px solid var(--accent)';
            item.style.background = 'linear-gradient(135deg, rgba(108, 92, 231, 0.2), rgba(0, 184, 148, 0.2))';
        }
        
        if (index === 0) item.classList.add('first');
        if (index === 1) item.classList.add('second');
        if (index === 2) item.classList.add('third');
        
        const medals = ['🥇', '🥈', '🥉'];
        const place = index < 3 ? medals[index] : `${index + 1}`;
        
        // Разбивка баллов (примерная для других команд)
        let breakdown = '';
        if (team.id === state.teamId) {
            // Для игрока показываем реальную разбивку
            const level1 = Math.floor(Math.random() * 31) + 30;
            const level2Change = state.score - 100 - level1;
            const level3 = team.score - state.score + level1;
            breakdown = `Старт: 100 | Уровень 1: +${level1} | Уровень 2: ${level2Change >= 0 ? '+' : ''}${level2Change} | Уровень 3: +${level3}`;
        } else {
            const l1 = Math.floor(Math.random() * 31) + 30;
            const l2 = Math.floor(Math.random() * 61) - 30;
            const l3 = Math.floor(Math.random() * 31) + 30;
            breakdown = `Старт: 100 | Уровень 1: +${l1} | Уровень 2: ${l2 >= 0 ? '+' : ''}${l2} | Уровень 3: +${l3}`;
        }
        
        item.innerHTML = `
            <div class="place-badge">${place}</div>
            <div class="team-info">
                <div class="team-name-result">${team.name} ${team.id === state.teamId ? '(ВЫ)' : ''}</div>
                <div class="score-breakdown">${breakdown}</div>
            </div>
            <div class="final-score">${team.score}</div>
        `;
        
        leaderboard.appendChild(item);
    });
    
    showScreen('results');
}

function shareResults() {
    const team = state.teams.find(t => t.id === state.teamId);
    const message = `🏆 Я сыграл в "Менеджерскую Битву"!\n\nКоманда: ${team.name}\nРоль: ${getRoleName(state.role)}\nИтоговый счет: ${team.score} баллов\n\n#МенеджерскаяБитва`;
    
    if (tg.initDataUnsafe?.user) {
        tg.sendData(JSON.stringify({ action: 'share', message }));
    }
    
    console.log('Поделиться результатами:', message);
}

// ============================================
// ПАНЕЛЬ ПРЕПОДАВАТЕЛЯ
// ============================================

function showTeacherDashboard() {
    // Здесь будет интерфейс управления игрой для преподавателя
    console.log('Панель преподавателя');
    alert('Панель управления для преподавателя будет доступна в следующей версии!');
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Приложение инициализировано');
    
    // Для демо: автоматически показываем главное меню
    showScreen('main-menu');
    
    // Делаем функции глобальными для onclick в HTML
    window.showScreen = showScreen;
    window.quickStartGame = quickStartGame;
    window.changeTeams = changeTeams;
    window.changePlayersPerTeam = changePlayersPerTeam;
    window.changeTime = changeTime;
    window.createGame = createGame;
    window.startGameAsTeacher = startGameAsTeacher;
    window.startGameAsSinglePlayer = startGameAsSinglePlayer;
    window.joinGame = joinGame;
    window.selectRole = selectRole;
    window.submitIdea = submitIdea;
    window.makeChoice = makeChoice;
    window.closeCoinModal = closeCoinModal;
    window.submitCrisisPlan = submitCrisisPlan;
    window.toggleChat = toggleChat;
    window.sendMessage = sendMessage;
    window.shareResults = shareResults;
    window.teacherStartLevel = teacherStartLevel;
    window.teacherShowResults = teacherShowResults;
});
