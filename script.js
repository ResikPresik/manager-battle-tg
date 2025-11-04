// Проверяем, что Telegram WebApp API загрузился
if (window.Telegram && window.Telegram.WebApp) {
    const webApp = window.Telegram.WebApp;

    // Включаем виброотклик при нажатии
    webApp.enableClosingConfirmation(); 

    // Делаем главное меню видимым
    webApp.ready();

    // Получаем информацию о пользователе из Telegram
    const userInfo = webApp.initDataUnsafe.user;
    
    const userInfoElement = document.getElementById('user-info');
    if (userInfo) {
        userInfoElement.textContent = `Привет, ${userInfo.first_name}! Твой ID: ${userInfo.id}.`;
    } else {
        userInfoElement.textContent = `Добро пожаловать, Гость.`;
    }


    // Настраиваем Главную Кнопку (она появляется внизу экрана Telegram)
    const mainButton = webApp.MainButton;
    mainButton.text = "ЗАПУСТИТЬ ИГРУ";
    mainButton.show(); // Показываем кнопку

    // Что происходит при нажатии Главной Кнопки
    mainButton.onClick(function() {
        // Здесь будет логика запуска игры, например:
        // 1. Отправка данных на ваш сервер.
        // 2. Смена интерфейса на форму "Уровень 1: Идея".

        // Пока что просто покажем сообщение и закроем приложение
        webApp.showAlert(`Успешно! Пользователь ${userInfo.first_name} начал игру.`);
        // webApp.close(); // можно закрыть приложение, но пока оставим открытым
    });

} else {
    // Если мы открыли файл не в Telegram (например, в браузере)
    document.getElementById('user-info').textContent = 'Запустите это приложение внутри Telegram.';
}