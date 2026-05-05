# ScoutMetric

**Интеллектуальная система анализа и оценки футбольных игроков**

ScoutMetric — это полнофункциональная платформа для сбора, анализа и визуализации данных о футболистах, включающая веб-интерфейс, мобильное приложение и ИИ-помощника для аналитики.

##  Функциональность

-  **Анализ данных игроков** — просмотр статистики, оценок, истории трансфертов
-  **ИИ-чат** — интеллектуальный помощник для анализа и прогнозов
-  **Мобильное приложение** — React Native приложение для скаутов
-  **Веб-интерфейс** — интерактивная веб-платформа
-  **ML-прогнозы** — предсказание результатов матчей и потенциала игроков
-  **Визуализация** — графики и диаграммы производительности

## Структура проекта

```
├── server/                   # Python Flask backend
│   ├── app.py               # Основное приложение
│   ├── ai_chat.py           # ИИ-чат функционал
│   ├── ai_models.py         # ML модели и предсказания
│   └── .env                 # Переменные окружения
├── ScoutMetricApp/          # React Native мобильное приложение
│   ├── App.js               # Главный компонент
│   ├── screens/             # Экраны приложения
│   └── package.json         # Зависимости
├── js/                      # JavaScript для веб-интерфейса
│   └── app.js               # Главное JS приложение
├── css/                     # Стили
│   └── style.css
├── index.html               # Главная страница
├── data/                    # Данные о игроках, клубах, матчах
│   ├── players.csv
│   ├── clubs.csv
│   ├── games.csv
│   └── ...
└── architecture_to_jpg.py   # Утилита архитектуры
```

##  Быстрый старт

### Требования

- Python 3.8+
- Node.js 16+
- npm или yarn

### Установка

#### Backend (Python)

```bash
cd server
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

#### Веб-интерфейс

```bash
# Просто откройте index.html в браузере
# или используйте локальный сервер
python -m http.server 8000
```

#### Мобильное приложение (React Native)

```bash
cd ScoutMetricApp
npm install
npm start
# или
yarn start

# Для Android
npm run android

# Для iOS
npm run ios
```

### Запуск

#### Backend сервер

```bash
cd server
python app.py
```

Сервер будет доступен на `http://localhost:5000`

#### Веб-интерфейс

```bash
# Откройте в браузере
http://localhost:8000  # (если используете http.server)
```

##  Зависимости

### Backend (Python)
- Flask — веб-фреймворк
- Flask-CORS — поддержка CORS
- pandas — обработка данных
- numpy — численные вычисления
- python-dotenv — управление переменными окружения

### Мобильное приложение
- React Native
- Expo
- React Navigation
- @expo/vector-icons

##  API Endpoints

### Чат с ИИ
- `POST /api/chat` — отправить сообщение в ИИ-чат

### Прогнозы
- `POST /api/predict/match` — прогноз результата матча
- `POST /api/predict/player` — оценка потенциала игрока
- `GET /api/models/report` — отчет по моделям

### Данные
- `GET /api/players` — список игроков
- `GET /api/clubs` — список клубов
- `GET /api/games` — список матчей

##  Конфигурация

Создайте файл `.env` в папке `server`:

```env
FLASK_ENV=development
FLASK_DEBUG=True
API_KEY=your_api_key_here
```

##  Тестирование

```bash
cd server
pytest tests/
```

##  Безопасность

- Использует переменные окружения для чувствительных данных
- CORS настроен для безопасного доступа
- Валидация входных данных на всех эндпоинтах

##  Лицензия

[Укажите вашу лицензию]

##  Контриб

Вклады приветствуются! Пожалуйста:

1. Сделайте fork репозитория
2. Создайте feature-ветку (`git checkout -b feature/AmazingFeature`)
3. Закоммитьте изменения (`git commit -m 'Add some AmazingFeature'`)
4. Pushьте в ветку (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

##  Контакты

Для вопросов создавайте Issues в репозитории.

---

**Создано:** 2026  
**Версия:** 1.0.0
