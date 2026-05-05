# ScoutMetric

**Intelligent Football Player Analysis and Evaluation System**

ScoutMetric is a full-featured platform for collecting, analyzing, and visualizing data on football players, including a web interface, mobile application, and AI assistant for analytics.

## Features

- **Player Data Analysis** — view statistics, ratings, and transfer history
- **AI Chat** — intelligent assistant for analysis and predictions
- **Mobile App** — React Native application for scouts
- **Web Interface** — interactive web platform
- **ML Predictions** — match result and player potential forecasting
- **Visualization** — performance charts and diagrams

## Project Structure

```
├── server/                   # Python Flask backend
│   ├── app.py               # Main application
│   ├── ai_chat.py           # AI chat functionality
│   ├── ai_models.py         # ML models and predictions
│   └── .env                 # Environment variables
├── ScoutMetricApp/          # React Native mobile app
│   ├── App.js               # Main component
│   ├── screens/             # App screens
│   └── package.json         # Dependencies
├── js/                      # JavaScript for web interface
│   └── app.js               # Main JS application
├── css/                     # Styles
│   └── style.css
├── index.html               # Main page
├── data/                    # Player, club, and match data
│   ├── players.csv
│   ├── clubs.csv
│   ├── games.csv
│   └── ...
└── architecture_to_jpg.py   # Architecture utility
```

## Quick Start

### Requirements

- Python 3.8+
- Node.js 16+
- npm or yarn

### Installation

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

#### Web Interface

```bash
# Simply open index.html in a browser
# or use a local server
python -m http.server 8000
```

#### Mobile App (React Native)

```bash
cd ScoutMetricApp
npm install
npm start
# or
yarn start

# For Android
npm run android

# For iOS
npm run ios
```

### Running

#### Backend Server

```bash
cd server
python app.py
```

Server will be available at `http://localhost:5000`

#### Web Interface

```bash
# Open in browser
http://localhost:8000  # (if using http.server)
```

## Dependencies

### Backend (Python)
- Flask — web framework
- Flask-CORS — CORS support
- pandas — data processing
- numpy — numerical computing
- python-dotenv — environment variable management

### Mobile App
- React Native
- Expo
- React Navigation
- @expo/vector-icons

## API Endpoints

### AI Chat
- `POST /api/chat` — send a message to the AI chat

### Predictions
- `POST /api/predict/match` — match result prediction
- `POST /api/predict/player` — player potential evaluation
- `GET /api/models/report` — model report

### Data
- `GET /api/players` — player list
- `GET /api/clubs` — club list
- `GET /api/games` — match list

## Configuration

Create a `.env` file in the `server` folder:

```env
FLASK_ENV=development
FLASK_DEBUG=True
API_KEY=your_api_key_here
```

## Testing

```bash
cd server
pytest tests/
```

## Security

- Uses environment variables for sensitive data
- CORS configured for secure access
- Input validation on all endpoints

## License

[Specify your license]

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Contact

For questions, please open an Issue in the repository.

---

**Created:** 2026  
**Version:** 1.0.0
