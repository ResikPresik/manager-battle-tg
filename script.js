if (window.Telegram && window.Telegram.WebApp) {
    const webApp = window.Telegram.WebApp;
    webApp.ready();
    webApp.enableClosingConfirmation(); 

    const mainButton = webApp.MainButton;
    const timerDisplay = document.getElementById('timer');
    const pitchForm = document.getElementById('pitch-form');
    let timeLeft = 10 * 60; // 10 минут в секундах
    let timerInterval;

    // --- 1. ФУНКЦИИ ТАЙМЕРА ---
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                timerDisplay.textContent = `Осталось: ${formatTime(timeLeft)}`;
            } else {
                clearInterval(timerInterval);
                timerDisplay.textContent = 'ВРЕМЯ ВЫШЛО!';
                
                // Если время вышло, автоматически отправляем данные
                if (mainButton.text.includes("Отправить Pitch")) {
                     mainButton.setText("ВРЕМЯ ВЫШЛО - ОТПРАВКА");
                     mainButton.disable();
                     submitPitch();
                }
            }
        }, 1000);
    }
    
    // --- 2. ФУНКЦИИ ОТПРАВКИ ДАННЫХ ---
    
    // Эмуляция отправки данных (вместо реального сервера)
    function submitPitch() {
        const formData = new FormData(pitchForm);
        const data = {};
        formData.forEach((value, key) => { data[key] = value; });

        // Преобразование данных в строку для отправки боту
        const messageText = 
            `*ОТВЕТ УРОВНЯ 1 - PITCH-КАРТА* \n\n` +
            `Команда/Пользователь ID: ${webApp.initDataUnsafe.user.id}\n\n` +
            `1️⃣ Название: ${data.name}\n` +
            `2️⃣ Суть: ${data.essence}\n` +
            `3️⃣ WOW-Фактор: ${data.wow_factor}\n` +
            `4️⃣ Целевая аудитория: ${data.audience}\n` +
            `5️⃣ Монетизация: ${data.monetization}\n\n` +
            `Таймер остановлен на: ${formatTime(timeLeft)}`;

        // Отправляем данные обратно боту через webApp.sendData
        // Это самое важное! Бот получит эту строку как сообщение.
        webApp.sendData(messageText);

        // Отключаем кнопку после отправки
        mainButton.disable();
        
        // Показываем пользователю, что отправка прошла успешно
        webApp.showAlert("Pitch-карта успешно отправлена жюри! Ждите начала Уровня 2.");
        
        // Скрываем форму Уровня 1 и показываем заглушку Уровня 2
        pitchForm.style.display = 'none';
        document.getElementById('level2-view').style.display = 'block';
    }


    // --- 3. ИНИЦИАЛИЗАЦИЯ (Запуск) ---

    // Настраиваем Главную Кнопку Telegram
    mainButton.text = "ОТПРАВИТЬ PITCH-КАРТУ";
    mainButton.show();
    mainButton.onClick(function() {
        // Проверяем заполнение формы перед отправкой
        if (pitchForm.checkValidity()) {
            clearInterval(timerInterval); // Останавливаем таймер
            submitPitch(); // Отправляем данные
        } else {
            // Если форма не заполнена, выводим сообщение об ошибке
            webApp.showAlert("Пожалуйста, заполните все обязательные поля Pitch-карты.");
            // Активируем встроенную проверку HTML5, чтобы подсветить поля
            pitchForm.reportValidity(); 
        }
    });
    
    // Запускаем таймер при открытии Mini App
    startTimer();

} else {
    // Режим разработки в браузере
    document.getElementById('timer').textContent = 'Осталось: 10:00 (Web Mode)';
    document.getElementById('score').textContent = 'Баллы команды: 0 (Web Mode)';
    alert('Запустите это приложение внутри Telegram!');
}
