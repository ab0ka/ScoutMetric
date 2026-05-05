from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import os
import numpy as np
from dotenv import load_dotenv

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(SERVER_DIR, '.env'), override=True)
app = Flask(__name__, static_folder='../', static_url_path='')
CORS(app)
from ai_chat import ai_chat_bp, init_agent_data
from ai_models import init_models, predict_match as ml_predict_match, predict_player_prospect, predict_interview_impact, summarize_interview_session, get_model_report
app.register_blueprint(ai_chat_bp)

# ─── Пути ───────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, 'data')

# ─── Глобальные датафреймы ───────────────────────────────────────────────────
players_df     = None
clubs_df       = None
games_df       = None
appearances_df = None
valuations_df  = None
transfers_df   = None
competitions_df= None
club_games_df  = None
game_events_df = None
game_lineups_df= None

# ─── Утилиты ─────────────────────────────────────────────────────────────────
def safe(val, default=None):
    """Безопасное преобразование pandas-значений в Python-типы."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return default
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return float(val)
    return val


def fmt_value(eur):
    """Форматирование рыночной стоимости: 1 500 000 → '€1.5M'."""
    if not eur or eur == 0:
        return None
    if eur >= 1_000_000:
        return f"€{eur / 1_000_000:.1f}M"
    if eur >= 1_000:
        return f"€{eur / 1_000:.0f}K"
    return f"€{eur:.0f}"


# ─── Загрузка данных ──────────────────────────────────────────────────────────
def load_data():
    global players_df, clubs_df, games_df, appearances_df, valuations_df
    global transfers_df, competitions_df, club_games_df, game_events_df, game_lineups_df

    files = {
        'players':      'players.csv',
        'clubs':        'clubs.csv',
        'games':        'games.csv',
        'appearances':  'appearances.csv',
        'valuations':   'player_valuations.csv',
        'transfers':    'transfers.csv',
        'competitions': 'competitions.csv',
        'club_games':   'club_games.csv',
        'game_events':  'game_events.csv',
        'game_lineups': 'game_lineups.csv',
    }

    loaded = {}
    for key, filename in files.items():
        path = os.path.join(DATA_PATH, filename)
        if os.path.exists(path):
            print(f"📂 {filename}...", end=' ')
            df = pd.read_csv(path, low_memory=False)
            loaded[key] = df
            print(f"✅ {len(df):,} строк")
        else:
            print(f"⚠️  {filename} не найден")
            loaded[key] = None

    players_df      = loaded['players']
    clubs_df        = loaded['clubs']
    games_df        = loaded['games']
    appearances_df  = loaded['appearances']
    valuations_df   = loaded['valuations']
    transfers_df    = loaded['transfers']
    competitions_df = loaded['competitions']
    club_games_df   = loaded['club_games']
    game_events_df  = loaded['game_events']
    game_lineups_df = loaded['game_lineups']

    _process_players()
    _process_clubs()
    _process_games()
    print("🚀 Данные готовы!")
    init_agent_data(
        players=players_df,
        clubs=clubs_df,
        transfers=transfers_df,
        games=games_df,
        valuations=valuations_df,
        competitions=competitions_df
    )
    print("🤖 AI агент инициализирован!")
    try:
        summary = init_models(
            players_df=players_df,
            clubs_df=clubs_df,
            games_df=games_df,
            valuations_df=valuations_df,
            club_games_df=club_games_df,
            interviews_path=INTERVIEWS_FILE,
        )
        print(f"🧠 ML модели готовы: {summary}")
    except Exception as exc:
        print(f"⚠️ ML модели не инициализировались: {exc}")


def _process_players():
    global players_df
    if players_df is None:
        return

    # Возраст
    if 'date_of_birth' in players_df.columns:
        players_df['date_of_birth'] = pd.to_datetime(players_df['date_of_birth'], errors='coerce')
        now = pd.Timestamp.now()
        players_df['age'] = ((now - players_df['date_of_birth']).dt.days / 365.25).fillna(0).astype(int)
    else:
        players_df['age'] = 0

    # Названия клубов
    if clubs_df is not None and 'current_club_id' in players_df.columns:
        club_map = clubs_df.set_index('club_id')['name'].to_dict()
        players_df['club_name'] = players_df['current_club_id'].map(club_map).fillna('Свободный агент')
    else:
        players_df['club_name'] = 'Свободный агент'

    # Лига клуба
    if clubs_df is not None and competitions_df is not None:
        comp_map = competitions_df.set_index('competition_id')['name'].to_dict()
        club_comp = clubs_df.set_index('club_id')['domestic_competition_id'].map(comp_map).to_dict() \
            if 'domestic_competition_id' in clubs_df.columns else {}
        players_df['league'] = players_df['current_club_id'].map(
            clubs_df.set_index('club_id').get('domestic_competition_id', pd.Series()).to_dict()
        ).map(comp_map).fillna('—') if 'domestic_competition_id' in clubs_df.columns else '—'
    else:
        players_df['league'] = '—'

    # Рыночная стоимость (последняя запись)
    if valuations_df is not None and 'player_id' in valuations_df.columns:
        val_col = 'market_value_in_eur'
        latest = (
            valuations_df.sort_values('date')
            .groupby('player_id')[val_col]
            .last()
            .reset_index()
        )
        players_df = players_df.merge(
            latest.rename(columns={val_col: 'market_value_in_eur'}),
            on='player_id', how='left', suffixes=('_old', '')
        )
        if 'market_value_in_eur_old' in players_df.columns:
            players_df['market_value_in_eur'] = players_df['market_value_in_eur'].fillna(
                players_df['market_value_in_eur_old']
            )
            players_df.drop(columns=['market_value_in_eur_old'], inplace=True)
    players_df['market_value_in_eur'] = players_df.get('market_value_in_eur', pd.Series(0)).fillna(0)

    # Унификация позиций
    pos_map = {
        'Centre-Forward': 'Attack', 'Left Winger': 'Attack', 'Right Winger': 'Attack',
        'Attack': 'Attack',
        'Attacking Midfield': 'Midfield', 'Central Midfield': 'Midfield',
        'Defensive Midfield': 'Midfield', 'Left Midfield': 'Midfield',
        'Right Midfield': 'Midfield', 'Midfield': 'Midfield',
        'Centre-Back': 'Defender', 'Left-Back': 'Defender', 'Right-Back': 'Defender',
        'Defender': 'Defender',
        'Goalkeeper': 'Goalkeeper',
    }
    if 'sub_position' in players_df.columns:
        players_df['sub_position'] = players_df['sub_position'].fillna('—')
    if 'position' in players_df.columns:
        players_df['position_group'] = players_df['position'].map(pos_map).fillna(players_df['position'])
    else:
        players_df['position_group'] = '—'

    players_df['position'] = players_df.get('position', pd.Series('—')).fillna('—')
    players_df['country_of_birth'] = players_df.get('country_of_birth', pd.Series('—')).fillna('—')
    players_df['nationality_name'] = players_df.get('nationality_name', players_df.get('country_of_birth', pd.Series('—'))).fillna('—')
    players_df['foot'] = players_df.get('foot', pd.Series('—')).fillna('—')
    players_df['height_in_cm'] = players_df.get('height_in_cm', pd.Series(0)).fillna(0)
    players_df['contract_expiry_date'] = players_df.get('contract_expiry_date', pd.Series(None))
    players_df['agent_name'] = players_df.get('agent_name', pd.Series('—')).fillna('—')
    players_df['image_url'] = players_df.get('image_url', pd.Series(None))

    print(f"✅ Игроков обработано: {len(players_df):,}")


def _process_clubs():
    global clubs_df
    if clubs_df is None or competitions_df is None:
        return
    if 'domestic_competition_id' in clubs_df.columns:
        comp_map = competitions_df.set_index('competition_id')['name'].to_dict()
        clubs_df['competition_name'] = clubs_df['domestic_competition_id'].map(comp_map).fillna('—')
    else:
        clubs_df['competition_name'] = '—'


def _process_games():
    global games_df
    if games_df is None:
        return
    if clubs_df is not None:
        club_map = clubs_df.set_index('club_id')['name'].to_dict()
        games_df['home_club_name'] = games_df.get('home_club_id', pd.Series()).map(club_map).fillna('—')
        games_df['away_club_name'] = games_df.get('away_club_id', pd.Series()).map(club_map).fillna('—')
    if competitions_df is not None and 'competition_id' in games_df.columns:
        comp_map = competitions_df.set_index('competition_id')['name'].to_dict()
        games_df['competition_name'] = games_df['competition_id'].map(comp_map).fillna('—')


# ─── Сериализация игрока ──────────────────────────────────────────────────────
def player_to_dict(row):
    mv = safe(row.get('market_value_in_eur'), 0)
    return {
        'player_id':           safe(row.get('player_id'), 0),
        'name':                safe(row.get('name'), 'Неизвестно'),
        'position':            safe(row.get('position'), '—'),
        'sub_position':        safe(row.get('sub_position'), '—'),
        'position_group':      safe(row.get('position_group'), '—'),
        'club_name':           safe(row.get('club_name'), 'Свободный агент'),
        'league':              safe(row.get('league'), '—'),
        'age':                 safe(row.get('age'), 0),
        'date_of_birth':       str(row['date_of_birth'])[:10] if pd.notna(row.get('date_of_birth')) else None,
        'country_of_birth':    safe(row.get('country_of_birth'), '—'),
        'nationality':         safe(row.get('nationality_name'), '—'),
        'foot':                safe(row.get('foot'), '—'),
        'height_in_cm':        safe(row.get('height_in_cm'), 0),
        'market_value_in_eur': mv,
        'market_value_fmt':    fmt_value(mv),
        'contract_expiry':     str(row['contract_expiry_date'])[:10] if pd.notna(row.get('contract_expiry_date')) else None,
        'agent':               safe(row.get('agent_name'), '—'),
        'image_url':           safe(row.get('image_url')),
        'url':                 safe(row.get('url')),
    }


# ════════════════════════════════════════════════════════════════════════════
# API: Игроки — список с фильтрацией
# ════════════════════════════════════════════════════════════════════════════
@app.route('/api/players', methods=['GET'])
def get_players():
    if players_df is None:
        return jsonify([])

    df = players_df.copy()

    # ── текстовый поиск ──────────────────────────────────────────────────────
    name = request.args.get('name', '').strip().lower()
    if name:
        df = df[df['name'].str.lower().str.contains(name, na=False)]

    # ── позиция (группа) ─────────────────────────────────────────────────────
    position = request.args.get('position', '').strip()
    if position:
        df = df[df['position_group'] == position]

    # ── точная sub-позиция ───────────────────────────────────────────────────
    sub_position = request.args.get('sub_position', '').strip()
    if sub_position:
        df = df[df['sub_position'] == sub_position]

    # ── возраст ──────────────────────────────────────────────────────────────
    age_min = request.args.get('age_min', type=int)
    age_max = request.args.get('age_max', type=int)
    if age_min is not None:
        df = df[df['age'] >= age_min]
    if age_max is not None:
        df = df[df['age'] <= age_max]

    # ── рыночная стоимость ───────────────────────────────────────────────────
    val_min = request.args.get('value_min', type=float)
    val_max = request.args.get('value_max', type=float)
    if val_min is not None:
        df = df[df['market_value_in_eur'] >= val_min]
    if val_max is not None:
        df = df[df['market_value_in_eur'] <= val_max]

    # ── нога ─────────────────────────────────────────────────────────────────
    foot = request.args.get('foot', '').strip()
    if foot:
        df = df[df['foot'].str.lower() == foot.lower()]

    # ── страна ───────────────────────────────────────────────────────────────
    country = request.args.get('country', '').strip()
    if country:
        df = df[
            df['country_of_birth'].str.lower().str.contains(country.lower(), na=False) |
            df['nationality_name'].str.lower().str.contains(country.lower(), na=False)
        ]

    # ── лига ─────────────────────────────────────────────────────────────────
    league = request.args.get('league', '').strip()
    if league:
        df = df[df['league'].str.lower().str.contains(league.lower(), na=False)]

    # ── клуб ─────────────────────────────────────────────────────────────────
    club = request.args.get('club', '').strip()
    if club:
        df = df[df['club_name'].str.lower().str.contains(club.lower(), na=False)]

    # ── рост ─────────────────────────────────────────────────────────────────
    height_min = request.args.get('height_min', type=int)
    height_max = request.args.get('height_max', type=int)
    if height_min is not None:
        df = df[df['height_in_cm'] >= height_min]
    if height_max is not None:
        df = df[df['height_in_cm'] <= height_max]

    # ── свободные агенты ─────────────────────────────────────────────────────
    free_agents = request.args.get('free_agents', '').strip().lower()
    if free_agents == 'true':
        df = df[df['club_name'] == 'Свободный агент']

    # ── сортировка ───────────────────────────────────────────────────────────
    sort_by = request.args.get('sort_by', 'market_value_in_eur')
    sort_dir = request.args.get('sort_dir', 'desc').lower()
    valid_sort = {'market_value_in_eur', 'age', 'name', 'height_in_cm'}
    if sort_by in valid_sort:
        df = df.sort_values(sort_by, ascending=(sort_dir == 'asc'), na_position='last')

    # ── пагинация ────────────────────────────────────────────────────────────
    page     = max(1, request.args.get('page', 1, type=int))
    per_page = min(200, max(10, request.args.get('per_page', 50, type=int)))
    total    = len(df)
    df       = df.iloc[(page - 1) * per_page : page * per_page]

    result = [player_to_dict(row) for _, row in df.iterrows()]

    return jsonify({
        'players': result,
        'total':   total,
        'page':    page,
        'per_page':per_page,
        'pages':   (total + per_page - 1) // per_page,
    })


# ════════════════════════════════════════════════════════════════════════════
# API: Профиль игрока
# ════════════════════════════════════════════════════════════════════════════
@app.route('/api/players/<int:player_id>', methods=['GET'])
def get_player(player_id):
    if players_df is None:
        return jsonify({'error': 'Данные не загружены'}), 500

    row = players_df[players_df['player_id'] == player_id]
    if row.empty:
        return jsonify({'error': 'Игрок не найден'}), 404

    data = player_to_dict(row.iloc[0])

    # ── Статистика по выступлениям ───────────────────────────────────────────
    if appearances_df is not None:
        apps = appearances_df[appearances_df['player_id'] == player_id].copy()
        data['stats'] = {
            'appearances':   int(len(apps)),
            'goals':         int(apps['goals'].sum())          if 'goals'          in apps.columns else 0,
            'assists':       int(apps['assists'].sum())        if 'assists'        in apps.columns else 0,
            'yellow_cards':  int(apps['yellow_cards'].sum())   if 'yellow_cards'   in apps.columns else 0,
            'red_cards':     int(apps['red_cards'].sum())      if 'red_cards'      in apps.columns else 0,
            'minutes_played':int(apps['minutes_played'].sum()) if 'minutes_played' in apps.columns else 0,
        }
        n = data['stats']['appearances']
        data['stats']['goals_per_game']   = round(data['stats']['goals']   / n, 2) if n else 0
        data['stats']['assists_per_game'] = round(data['stats']['assists'] / n, 2) if n else 0
        data['stats']['minutes_per_game'] = round(data['stats']['minutes_played'] / n, 1) if n else 0

        # Последние 5 матчей
        recent_cols = ['game_id', 'goals', 'assists', 'minutes_played', 'yellow_cards', 'red_cards']
        recent_cols = [c for c in recent_cols if c in apps.columns]
        recent = apps.sort_values('date').tail(5)[recent_cols] if 'date' in apps.columns \
            else apps.tail(5)[recent_cols]

        if games_df is not None and 'game_id' in recent.columns:
            game_map = games_df.set_index('game_id').apply(
                lambda r: f"{r.get('home_club_name','?')} vs {r.get('away_club_name','?')}", axis=1
            ).to_dict()
            date_map = games_df.set_index('game_id')['date'].to_dict() if 'date' in games_df.columns else {}
            recent['match']  = recent['game_id'].map(game_map).fillna('—')
            recent['date']   = recent['game_id'].map(date_map).fillna('—')

        data['recent_matches'] = recent.fillna(0).to_dict('records')
    else:
        data['stats'] = {
            'appearances': 0, 'goals': 0, 'assists': 0,
            'yellow_cards': 0, 'red_cards': 0, 'minutes_played': 0,
            'goals_per_game': 0, 'assists_per_game': 0, 'minutes_per_game': 0,
        }
        data['recent_matches'] = []

    # ── История стоимости ────────────────────────────────────────────────────
    if valuations_df is not None:
        hist = (
            valuations_df[valuations_df['player_id'] == player_id]
            .sort_values('date')[['date', 'market_value_in_eur']]
            .dropna()
        )
        data['value_history'] = [
            {'date': str(r['date'])[:10], 'value': safe(r['market_value_in_eur'], 0)}
            for _, r in hist.iterrows()
        ]
    else:
        data['value_history'] = []

    # ── Трансферы ────────────────────────────────────────────────────────────
    if transfers_df is not None and 'player_id' in transfers_df.columns:
        tr = transfers_df[transfers_df['player_id'] == player_id].sort_values(
            'transfer_date' if 'transfer_date' in transfers_df.columns else transfers_df.columns[0],
            ascending=False
        ).head(10)
        data['transfers'] = [
            {
                'from':   safe(r.get('from_club_name'), '—'),
                'to':     safe(r.get('to_club_name'), '—'),
                'fee':    fmt_value(safe(r.get('transfer_fee'), 0)),
                'season': safe(r.get('season'), '—'),
                'date':   str(r.get('transfer_date', ''))[:10],
            }
            for _, r in tr.iterrows()
        ]
    else:
        data['transfers'] = []

    # ── Голевые события ──────────────────────────────────────────────────────
    if game_events_df is not None and 'player_id' in game_events_df.columns:
        evts = game_events_df[game_events_df['player_id'] == player_id]
        type_col = 'type' if 'type' in evts.columns else None
        if type_col:
            counts = evts[type_col].value_counts().to_dict()
            data['event_breakdown'] = {str(k): int(v) for k, v in counts.items()}
        else:
            data['event_breakdown'] = {}
    else:
        data['event_breakdown'] = {}

    return jsonify(data)


# ════════════════════════════════════════════════════════════════════════════
# API: Фильтры — уникальные значения для UI
# ════════════════════════════════════════════════════════════════════════════
@app.route('/api/players/filters', methods=['GET'])
def get_player_filters():
    """Возвращает все доступные значения для фильтров."""
    if players_df is None:
        return jsonify({})

    def uniq(col, df=players_df, limit=300):
        if col not in df.columns:
            return []
        vals = df[col].dropna().unique().tolist()
        vals = sorted([str(v) for v in vals if str(v) not in ('—', '', 'nan')])
        return vals[:limit]

    positions = ['Attack', 'Midfield', 'Defender', 'Goalkeeper']

    return jsonify({
        'positions':     positions,
        'sub_positions': uniq('sub_position'),
        'countries':     uniq('nationality_name'),
        'leagues':       uniq('league'),
        'feet':          uniq('foot'),
        'age_range':     {
            'min': int(players_df['age'].min()) if 'age' in players_df.columns else 15,
            'max': int(players_df['age'].max()) if 'age' in players_df.columns else 45,
        },
        'value_range':   {
            'min': 0,
            'max': int(players_df['market_value_in_eur'].max()) if 'market_value_in_eur' in players_df.columns else 200_000_000,
        },
        'height_range':  {
            'min': int(players_df[players_df['height_in_cm'] > 0]['height_in_cm'].min()) if 'height_in_cm' in players_df.columns else 155,
            'max': int(players_df['height_in_cm'].max()) if 'height_in_cm' in players_df.columns else 210,
        },
    })


# ════════════════════════════════════════════════════════════════════════════
# API: Сравнение игроков
# ════════════════════════════════════════════════════════════════════════════
@app.route('/api/players/compare', methods=['GET'])
def compare_players():
    """?ids=123,456,789"""
    if players_df is None or appearances_df is None:
        return jsonify([])

    raw_ids = request.args.get('ids', '')
    try:
        ids = [int(x) for x in raw_ids.split(',') if x.strip()]
    except ValueError:
        return jsonify({'error': 'Неверный формат ids'}), 400

    if not ids or len(ids) > 5:
        return jsonify({'error': 'Укажите от 1 до 5 player_id'}), 400

    result = []
    for pid in ids:
        row = players_df[players_df['player_id'] == pid]
        if row.empty:
            continue
        d = player_to_dict(row.iloc[0])
        apps = appearances_df[appearances_df['player_id'] == pid]
        n = len(apps)
        d['stats'] = {
            'appearances':    n,
            'goals':          int(apps['goals'].sum())          if 'goals'          in apps.columns else 0,
            'assists':        int(apps['assists'].sum())        if 'assists'        in apps.columns else 0,
            'yellow_cards':   int(apps['yellow_cards'].sum())   if 'yellow_cards'   in apps.columns else 0,
            'red_cards':      int(apps['red_cards'].sum())      if 'red_cards'      in apps.columns else 0,
            'minutes_played': int(apps['minutes_played'].sum()) if 'minutes_played' in apps.columns else 0,
            'goals_per_game':   round(int(apps['goals'].sum())   / n, 2) if n and 'goals'   in apps.columns else 0,
            'assists_per_game': round(int(apps['assists'].sum()) / n, 2) if n and 'assists' in apps.columns else 0,
        }
        result.append(d)

    return jsonify(result)


# ════════════════════════════════════════════════════════════════════════════
# API: Остальные разделы
# ════════════════════════════════════════════════════════════════════════════
@app.route('/api/stats', methods=['GET'])
def get_stats():
    return jsonify({
        'totalPlayers':   len(players_df)   if players_df   is not None else 0,
        'totalClubs':     len(clubs_df)     if clubs_df     is not None else 0,
        'totalGames':     len(games_df)     if games_df     is not None else 0,
        'totalTransfers': len(transfers_df) if transfers_df is not None else 0,
    })


@app.route('/api/clubs', methods=['GET'])
def get_clubs():
    if clubs_df is None:
        return jsonify([])
    page     = max(1, request.args.get('page', 1, type=int))
    per_page = min(100, request.args.get('per_page', 50, type=int))
    df = clubs_df.iloc[(page-1)*per_page : page*per_page]
    result = []
    for _, row in df.iterrows():
        result.append({
            'club_id':          safe(row.get('club_id'), 0),
            'name':             safe(row.get('name'), '—'),
            'country':          safe(row.get('country'), '—'),
            'founded':          safe(row.get('founded'), None),
            'competition_name': safe(row.get('competition_name'), '—'),
            'stadium':          safe(row.get('stadium_name', row.get('stadium')), '—'),
            'capacity':         safe(row.get('stadium_seats'), None),
            'squad_size':       safe(row.get('squad_size'), None),
            'avg_age':          safe(row.get('average_age'), None),
            'total_market_value': safe(row.get('total_market_value'), None),
        })
    return jsonify({'clubs': result, 'total': len(clubs_df)})


@app.route('/api/games', methods=['GET'])
def get_games():
    if games_df is None:
        return jsonify([])
    page     = max(1, request.args.get('page', 1, type=int))
    per_page = min(100, request.args.get('per_page', 50, type=int))
    df = games_df.sort_values('date', ascending=False).iloc[(page-1)*per_page : page*per_page] \
        if 'date' in games_df.columns else games_df.iloc[(page-1)*per_page : page*per_page]
    result = []
    for _, row in df.iterrows():
        result.append({
            'game_id':         safe(row.get('game_id'), 0),
            'home_club_name':  safe(row.get('home_club_name'), '—'),
            'away_club_name':  safe(row.get('away_club_name'), '—'),
            'home_club_goals': safe(row.get('home_club_goals'), 0),
            'away_club_goals': safe(row.get('away_club_goals'), 0),
            'competition_name':safe(row.get('competition_name'), '—'),
            'date':            str(row.get('date', ''))[:10],
            'season':          safe(row.get('season'), '—'),
            'attendance':      safe(row.get('attendance'), None),
        })
    return jsonify({'games': result, 'total': len(games_df)})


@app.route('/api/transfers', methods=['GET'])
def get_transfers():
    if transfers_df is None:
        return jsonify([])
    page     = max(1, request.args.get('page', 1, type=int))
    per_page = min(100, request.args.get('per_page', 50, type=int))
    df = transfers_df.iloc[(page-1)*per_page : page*per_page]
    result = []
    for _, row in df.iterrows():
        fee = safe(row.get('transfer_fee'), 0)
        result.append({
            'player_id':   safe(row.get('player_id'), 0),
            'player_name': safe(row.get('player_name'), '—'),
            'from_club':   safe(row.get('from_club_name'), '—'),
            'to_club':     safe(row.get('to_club_name'), '—'),
            'fee':         fee,
            'fee_fmt':     fmt_value(fee),
            'season':      safe(row.get('season'), '—'),
            'date':        str(row.get('transfer_date', ''))[:10],
        })
    return jsonify({'transfers': result, 'total': len(transfers_df)})


@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


# ════════════════════════════════════════════════════════════════════════════
# API: Скауты — датасет с аккаунтами
# ════════════════════════════════════════════════════════════════════════════
import json
import hashlib
import uuid
from datetime import datetime
from urllib import parse as url_parse
from urllib import request as url_request
from urllib import error as url_error

SCOUTS_FILE = os.path.join(BASE_DIR, 'data', 'scouts.json')
INTERVIEWS_FILE = os.path.join(BASE_DIR, 'data', 'adaptive_interviews.json')
TELEGRAM_POLLS_FILE = os.path.join(BASE_DIR, 'data', 'telegram_polls.json')

BASE_INTERVIEW_QUESTIONS = [
    {
        'id': 'q1',
        'dimension': 'stress_control',
        'text': 'Опишите самый стрессовый матч за последний сезон и как вы справились с давлением.'
    },
    {
        'id': 'q2',
        'dimension': 'teamwork',
        'text': 'Как вы реагируете, если партнёр по команде регулярно ошибается и мешает результату?'
    },
    {
        'id': 'q3',
        'dimension': 'motivation',
        'text': 'Что вас мотивирует тренироваться в периоды, когда вы не попадаете в стартовый состав?'
    },
    {
        'id': 'q4',
        'dimension': 'resilience',
        'text': 'Вспомните серьёзную неудачу в карьере. Что вы сделали в следующие 2–3 недели?'
    },
]

FOLLOWUP_QUESTIONS = {
    'stress_control': [
        {'id': 's1', 'dimension': 'stress_control', 'text': 'Какие личные ритуалы помогают вам быстро восстановить концентрацию прямо по ходу матча?'},
        {'id': 's2', 'dimension': 'stress_control', 'text': 'Что вы делаете после серии неудачных действий в одном тайме?'},
    ],
    'teamwork': [
        {'id': 't1', 'dimension': 'teamwork', 'text': 'Как вы выстраиваете контакт с новыми партнёрами в первые недели в команде?'},
        {'id': 't2', 'dimension': 'teamwork', 'text': 'Что для вас важнее в конфликте внутри команды: правда или результат группы?'},
    ],
    'motivation': [
        {'id': 'm1', 'dimension': 'motivation', 'text': 'Какую цель на ближайшие 6 месяцев вы считаете для себя ключевой и почему?'},
        {'id': 'm2', 'dimension': 'motivation', 'text': 'Что удерживает вас от эмоционального выгорания на длинной дистанции сезона?'},
    ],
    'resilience': [
        {'id': 'r1', 'dimension': 'resilience', 'text': 'Как быстро вы возвращаете уверенность после критики тренера или СМИ?'},
        {'id': 'r2', 'dimension': 'resilience', 'text': 'Приведите пример, когда вы сознательно изменили привычку ради прогресса.'},
    ],
    'discipline': [
        {'id': 'd1', 'dimension': 'discipline', 'text': 'Как выглядит ваша дисциплина вне поля: режим сна, питание, восстановление?'},
        {'id': 'd2', 'dimension': 'discipline', 'text': 'Когда у вас был последний срыв режима, и как вы это исправили?'},
    ],
    'confidence': [
        {'id': 'c1', 'dimension': 'confidence', 'text': 'В какой роли на поле вы чувствуете себя максимально уверенно и почему?'},
        {'id': 'c2', 'dimension': 'confidence', 'text': 'Как вы сохраняете уверенность после 2–3 слабых матчей подряд?'},
    ],
}


def load_interviews():
    if os.path.exists(INTERVIEWS_FILE):
        with open(INTERVIEWS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_interviews(items):
    os.makedirs(os.path.dirname(INTERVIEWS_FILE), exist_ok=True)
    with open(INTERVIEWS_FILE, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def load_telegram_polls():
    if os.path.exists(TELEGRAM_POLLS_FILE):
        with open(TELEGRAM_POLLS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_telegram_polls(items):
    os.makedirs(os.path.dirname(TELEGRAM_POLLS_FILE), exist_ok=True)
    with open(TELEGRAM_POLLS_FILE, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def _new_poll_id():
    return uuid.uuid4().hex[:8]


def _find_poll_index_by_id(items, poll_id):
    return next((i for i, x in enumerate(items) if x.get('poll_id') == poll_id), None)


def _parse_poll_command(text):
    # Формат: /poll Вопрос | Вариант 1 | Вариант 2 | Вариант 3
    raw = (text or '').strip()
    payload = raw[5:].strip() if raw.lower().startswith('/poll') else raw
    parts = [x.strip() for x in payload.split('|') if x.strip()]
    if len(parts) < 3:
        return None
    question = parts[0]
    options = parts[1:]
    if len(options) > 8:
        options = options[:8]
    return {'question': question, 'options': options}


def _build_poll_keyboard(poll_id, options):
    rows = []
    for i, opt in enumerate(options):
        rows.append([
            {
                'text': f"{i + 1}. {opt}",
                'callback_data': f"poll_vote:{poll_id}:{i}",
            }
        ])
    return {'inline_keyboard': rows}


def _format_poll_message(poll):
    question = poll.get('question', 'Опрос')
    options = poll.get('options', [])
    lines = [
        "<b>ScoutMetric Poll</b>",
        f"ID: <code>{poll.get('poll_id', '—')}</code>",
        "",
        question,
        "",
    ]
    for i, opt in enumerate(options):
        lines.append(f"{i + 1}. {opt}")
    lines.append("")
    lines.append("Нажмите кнопку ниже, чтобы проголосовать.")
    lines.append("Или отправьте: <code>/vote POLL_ID НОМЕР_ВАРИАНТА</code>")
    return '\n'.join(lines)


def _format_poll_results(poll):
    options = poll.get('options', [])
    votes = poll.get('votes', {})
    counts = [0 for _ in options]
    for _, idx in votes.items():
        if isinstance(idx, int) and 0 <= idx < len(options):
            counts[idx] += 1
    total = sum(counts)

    lines = [
        "<b>Результаты опроса</b>",
        f"ID: <code>{poll.get('poll_id', '—')}</code>",
        f"Вопрос: {poll.get('question', '—')}",
        f"Всего голосов: <b>{total}</b>",
        "",
    ]

    for i, opt in enumerate(options):
        c = counts[i]
        pct = round((c / total) * 100, 1) if total else 0
        lines.append(f"{i + 1}. {opt} — <b>{c}</b> ({pct}%)")

    return '\n'.join(lines)


def _init_psy_metrics():
    return {
        'stress_control': 50,
        'teamwork': 50,
        'motivation': 50,
        'resilience': 50,
        'discipline': 50,
        'confidence': 50,
    }


def _clamp_metric(v):
    return int(max(0, min(100, round(v))))


def _score_interview_answer(answer):
    txt = (answer or '').lower()

    pos_words = ['план', 'спокой', 'команда', 'поддерж', 'работаю', 'анализ', 'цель', 'дисцип', 'режим', 'ответствен']
    neg_words = ['паник', 'не знаю', 'без разницы', 'брос', 'срываюсь', 'конфликт', 'выгора', 'давление мешает']

    impact = {
        'stress_control': 0,
        'teamwork': 0,
        'motivation': 0,
        'resilience': 0,
        'discipline': 0,
        'confidence': 0,
    }

    for w in pos_words:
        if w in txt:
            impact['motivation'] += 3
            impact['resilience'] += 2
            impact['stress_control'] += 2

    for w in neg_words:
        if w in txt:
            impact['stress_control'] -= 4
            impact['resilience'] -= 3
            impact['confidence'] -= 3

    if 'команд' in txt or 'партн' in txt:
        impact['teamwork'] += 4
    if 'режим' in txt or 'сон' in txt or 'питани' in txt:
        impact['discipline'] += 4
    if 'уверен' in txt or 'готов' in txt:
        impact['confidence'] += 4
    if 'тренир' in txt or 'прогресс' in txt:
        impact['motivation'] += 3

    if len(txt) < 25:
        impact['confidence'] -= 2
        impact['motivation'] -= 2
    elif len(txt) > 180:
        impact['confidence'] += 2
        impact['resilience'] += 2

    return impact


def _weakest_dimension(metrics):
    return min(metrics.items(), key=lambda kv: kv[1])[0]


def _pick_next_interview_question(session):
    asked = set(session.get('asked_question_ids', []))

    for q in BASE_INTERVIEW_QUESTIONS:
        if q['id'] not in asked:
            return q

    weak = _weakest_dimension(session.get('metrics', _init_psy_metrics()))
    for q in FOLLOWUP_QUESTIONS.get(weak, []):
        if q['id'] not in asked:
            return q

    for qlist in FOLLOWUP_QUESTIONS.values():
        for q in qlist:
            if q['id'] not in asked:
                return q

    return None


def _build_psy_summary(metrics):
    avg = float(sum(metrics.values()) / max(len(metrics), 1))
    stress = metrics.get('stress_control', 0)
    resilience = metrics.get('resilience', 0)

    if avg >= 75 and stress >= 65:
        state = 'Стабильное боевое состояние'
        risk = 'Низкий'
    elif avg >= 60:
        state = 'Рабочее психологическое состояние'
        risk = 'Умеренный'
    elif avg >= 45:
        state = 'Нужна точечная психологическая поддержка'
        risk = 'Повышенный'
    else:
        state = 'Риск эмоционального выгорания и потери уверенности'
        risk = 'Высокий'

    recommendations = []
    if stress < 50:
        recommendations.append('Добавить дыхательные и фокус-рутины перед матчами.')
    if resilience < 50:
        recommendations.append('Включить работу со спортивным психологом после неудачных матчей.')
    if metrics.get('discipline', 50) < 50:
        recommendations.append('Усилить контроль режима сна, восстановления и питания.')
    if metrics.get('teamwork', 50) < 50:
        recommendations.append('Провести коммуникационные сессии с тренерским штабом и лидерами команды.')
    if not recommendations:
        recommendations.append('Поддерживать текущий режим и проводить плановый психологический мониторинг раз в месяц.')

    return {
        'state': state,
        'risk_level': risk,
        'overall_score': int(round(avg)),
        'recommendations': recommendations,
    }


def _telegram_config():
    token = (os.environ.get('TG_BOT_TOKEN') or '').strip()
    default_chat_id = (os.environ.get('TG_DEFAULT_CHAT_ID') or '').strip()
    default_username = (os.environ.get('TG_DEFAULT_USERNAME') or '').strip()
    return token, default_chat_id, default_username


def _public_base_url():
    # Пример: https://my-domain.com
    return (os.environ.get('APP_PUBLIC_URL') or '').strip().rstrip('/')


def _telegram_send_message(chat_target, text, reply_markup=None):
    token, _, _ = _telegram_config()
    if not token:
        return {'ok': False, 'reason': 'TG_BOT_TOKEN is not configured'}
    if not chat_target:
        return {'ok': False, 'reason': 'chat target is empty'}

    payload = url_parse.urlencode({
        'chat_id': chat_target,
        'text': text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': 'true',
    }).encode('utf-8')

    if reply_markup is not None:
        payload = url_parse.urlencode({
            'chat_id': chat_target,
            'text': text,
            'parse_mode': 'HTML',
            'disable_web_page_preview': 'true',
            'reply_markup': json.dumps(reply_markup, ensure_ascii=False),
        }).encode('utf-8')

    req = url_request.Request(
        url=f"https://api.telegram.org/bot{token}/sendMessage",
        data=payload,
        method='POST',
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )

    try:
        with url_request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode('utf-8')
            body = json.loads(raw)
            return {'ok': bool(body.get('ok')), 'response': body}
    except url_error.HTTPError as e:
        detail = e.read().decode('utf-8', errors='ignore') if hasattr(e, 'read') else str(e)
        return {'ok': False, 'reason': f'HTTP {e.code}', 'detail': detail}
    except Exception as e:
        return {'ok': False, 'reason': str(e)}


def _format_interview_summary_message(session):
    summary = session.get('summary') or {}
    metrics = session.get('metrics') or {}
    recs = summary.get('recommendations') or []
    rec_lines = '\n'.join([f"• {r}" for r in recs[:4]]) if recs else '• Нет рекомендаций'

    return (
        "<b>ScoutMetric: итог адаптивного интервью</b>\n"
        f"Игрок: <b>{session.get('player_name', 'Игрок')}</b>\n"
        f"ID интервью: <code>{session.get('interview_id', '—')}</code>\n\n"
        f"Состояние: <b>{summary.get('state', '—')}</b>\n"
        f"Риск: <b>{summary.get('risk_level', '—')}</b>\n"
        f"Общий балл: <b>{summary.get('overall_score', 0)}</b>\n\n"
        "<b>Метрики</b>\n"
        f"• stress_control: {metrics.get('stress_control', '—')}\n"
        f"• teamwork: {metrics.get('teamwork', '—')}\n"
        f"• motivation: {metrics.get('motivation', '—')}\n"
        f"• resilience: {metrics.get('resilience', '—')}\n"
        f"• discipline: {metrics.get('discipline', '—')}\n"
        f"• confidence: {metrics.get('confidence', '—')}\n\n"
        f"<b>Рекомендации</b>\n{rec_lines}"
    )


def _deliver_interview_summary_to_telegram(session):
    chat_target = (session.get('telegram_chat_id') or '').strip()
    if not chat_target:
        username = (session.get('telegram_username') or '').strip()
        if username:
            chat_target = username

    if not chat_target:
        _, default_chat_id, default_username = _telegram_config()
        chat_target = default_chat_id or default_username

    if not chat_target:
        return {'ok': False, 'reason': 'No telegram target configured (telegram_chat_id/username or TG_DEFAULT_CHAT_ID/TG_DEFAULT_USERNAME)'}

    msg = _format_interview_summary_message(session)
    return _telegram_send_message(chat_target, msg)


def _telegram_answer_callback(callback_query_id, text=None):
    token, _, _ = _telegram_config()
    if not token:
        return {'ok': False, 'reason': 'TG_BOT_TOKEN is not configured'}

    data = {'callback_query_id': callback_query_id}
    if text:
        data['text'] = text
        data['show_alert'] = 'false'

    payload = url_parse.urlencode(data).encode('utf-8')
    req = url_request.Request(
        url=f"https://api.telegram.org/bot{token}/answerCallbackQuery",
        data=payload,
        method='POST',
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )

    try:
        with url_request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode('utf-8')
            body = json.loads(raw)
            return {'ok': bool(body.get('ok')), 'response': body}
    except Exception as e:
        return {'ok': False, 'reason': str(e)}


def _apply_poll_vote(poll, user_id, option_idx):
    options = poll.get('options', [])
    if option_idx < 0 or option_idx >= len(options):
        return {'ok': False, 'reason': 'invalid_option'}

    votes = poll.setdefault('votes', {})
    key = str(user_id)
    prev = votes.get(key)
    votes[key] = option_idx
    changed = (prev != option_idx)
    return {
        'ok': True,
        'changed': changed,
        'selected_option': options[option_idx],
    }


def _find_interview_index_by_id(sessions, interview_id):
    return next((i for i, x in enumerate(sessions) if x.get('interview_id') == interview_id), None)


def _find_active_interview_index_by_chat_id(sessions, chat_id):
    return next(
        (
            i for i, x in enumerate(sessions)
            if str(x.get('telegram_chat_id') or '').strip() == str(chat_id).strip()
            and x.get('status') in ('invited', 'in_progress')
        ),
        None
    )


def _ensure_interview_question(session):
    if session.get('status') == 'completed':
        return False

    if session.get('current_question'):
        return True

    next_q = _pick_next_interview_question(session)
    if not next_q:
        session['status'] = 'completed'
        session['summary'] = _build_psy_summary(session.get('metrics', _init_psy_metrics()))
        session['completed_at'] = datetime.now().isoformat()
        session['current_question'] = None
        return False

    session['current_question'] = next_q
    session['status'] = 'in_progress'
    return True


def _apply_answer_to_session(session, answer):
    q = session.get('current_question') or _pick_next_interview_question(session)
    if not q:
        session['status'] = 'completed'
        session['summary'] = summarize_interview_session(session)
        session['metrics'] = session['summary'].get('metrics', session.get('metrics', _init_psy_metrics()))
        session['completed_at'] = datetime.now().isoformat()
        session['current_question'] = None
        return True

    impact = predict_interview_impact(q, answer)
    metrics = session.get('metrics', _init_psy_metrics())
    for k in metrics.keys():
        metrics[k] = _clamp_metric(metrics[k] + impact.get(k, 0))

    session.setdefault('answers', []).append({
        'question_id': q.get('id'),
        'dimension': q.get('dimension'),
        'question': q.get('text'),
        'answer': answer,
        'created_at': datetime.now().isoformat(),
        'impact': impact,
    })
    session.setdefault('asked_question_ids', []).append(q.get('id'))
    session['metrics'] = metrics

    next_q = _pick_next_interview_question(session)
    max_questions = 8
    if len(session.get('answers', [])) >= max_questions or not next_q:
        session['status'] = 'completed'
        session['current_question'] = None
        session['summary'] = summarize_interview_session(session)
        session['metrics'] = session['summary'].get('metrics', metrics)
        session['completed_at'] = datetime.now().isoformat()
        if session.get('channel') == 'telegram':
            session['telegram_summary_status'] = _deliver_interview_summary_to_telegram(session)
        return True

    session['status'] = 'in_progress'
    session['current_question'] = next_q
    return False


def _format_interview_question_message(session):
    q = session.get('current_question') or {}
    step = len(session.get('answers', [])) + 1
    total = 8
    return (
        "<b>ScoutMetric: адаптивное интервью</b>\n"
        f"Игрок: <b>{session.get('player_name', 'Игрок')}</b>\n"
        f"Вопрос <b>{step}/{total}</b>\n\n"
        f"{q.get('text', 'Вопрос недоступен.')}\n\n"
        "Ответьте одним сообщением."
    )

def load_scouts():
    if os.path.exists(SCOUTS_FILE):
        with open(SCOUTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    # Начальные данные — команда скаутов
    default = [
        {
            "id": "sabyt",
            "name": "Сәбит Абзал",
            "email": "sabyt@fcastana.kz",
            "password_hash": hashlib.sha256("admin123".encode()).hexdigest(),
            "role": "Старший скаут",
            "club": "ФК Астана",
            "country": "Казахстан",
            "region": "Центр. Азия",
            "license": "UEFA Pro",
            "phone": "+7 777 123 45 67",
            "dob": "1990-03-15",
            "exp": "8",
            "spec": "Полузащитники, Нападающие",
            "age_range": "до 25 лет",
            "bio": "Профессиональный скаут с опытом в Центральной Азии и Европе.",
            "avatar": "АС",
            "color": "#2563EB",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": "aibek",
            "name": "Айбек Омаров",
            "email": "aibek@fcastana.kz",
            "password_hash": hashlib.sha256("aibek123".encode()).hexdigest(),
            "role": "Скаут",
            "club": "ФК Астана",
            "country": "Казахстан",
            "region": "Европа",
            "license": "UEFA B",
            "phone": "",
            "dob": "1993-07-22",
            "exp": "5",
            "spec": "Защитники",
            "age_range": "до 28 лет",
            "bio": "Скаут европейского направления.",
            "avatar": "АО",
            "color": "#10B981",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": "daniil",
            "name": "Даниил Ким",
            "email": "daniil@fcastana.kz",
            "password_hash": hashlib.sha256("daniil123".encode()).hexdigest(),
            "role": "Скаут-аналитик",
            "club": "ФК Астана",
            "country": "Казахстан",
            "region": "Россия, СНГ",
            "license": "UEFA A",
            "phone": "",
            "dob": "1991-11-05",
            "exp": "6",
            "spec": "Все позиции",
            "age_range": "до 30 лет",
            "bio": "Специализация на аналитике и данных.",
            "avatar": "ДК",
            "color": "#F59E0B",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": "alina",
            "name": "Алина Жунусова",
            "email": "alina@fcastana.kz",
            "password_hash": hashlib.sha256("alina123".encode()).hexdigest(),
            "role": "Скаут молодёжи",
            "club": "ФК Астана",
            "country": "Казахстан",
            "region": "Казахстан",
            "license": "UEFA B",
            "phone": "",
            "dob": "1995-04-18",
            "exp": "3",
            "spec": "Молодые таланты",
            "age_range": "до 21 лет",
            "bio": "Скаут молодёжного направления.",
            "avatar": "АЖ",
            "color": "#8B5CF6",
            "created_at": datetime.now().isoformat()
        }
    ]
    save_scouts(default)
    return default

def save_scouts(scouts):
    os.makedirs(os.path.dirname(SCOUTS_FILE), exist_ok=True)
    with open(SCOUTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(scouts, f, ensure_ascii=False, indent=2)

def scout_public(s):
    """Возвращает скаута без пароля."""
    return {k: v for k, v in s.items() if k != 'password_hash'}


@app.route('/api/scouts', methods=['GET'])
def get_scouts():
    scouts = load_scouts()
    return jsonify([scout_public(s) for s in scouts])


@app.route('/api/scouts/<scout_id>', methods=['GET'])
def get_scout(scout_id):
    scouts = load_scouts()
    s = next((x for x in scouts if x['id'] == scout_id), None)
    if not s:
        return jsonify({'error': 'Скаут не найден'}), 404
    return jsonify(scout_public(s))


@app.route('/api/scouts/register', methods=['POST'])
def register_scout():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Нет данных'}), 400

    name    = (data.get('name') or '').strip()
    email   = (data.get('email') or '').strip().lower()
    password= (data.get('password') or '').strip()

    if not name or not email or not password:
        return jsonify({'error': 'Имя, email и пароль обязательны'}), 400

    scouts = load_scouts()

    # Проверка уникальности email
    if any(s['email'].lower() == email for s in scouts):
        return jsonify({'error': 'Email уже зарегистрирован'}), 409

    # Генерация ID
    import re
    scout_id = re.sub(r'[^a-z0-9]', '', name.lower().replace(' ', '_'))[:12]
    scout_id = scout_id or 'scout'
    base_id = scout_id
    counter = 1
    while any(s['id'] == scout_id for s in scouts):
        scout_id = f"{base_id}{counter}"
        counter += 1

    avatar = ''.join(w[0].upper() for w in name.split()[:2])

    colors = ['#2563EB','#10B981','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#EC4899']
    color = data.get('color') or colors[len(scouts) % len(colors)]

    new_scout = {
        "id":            scout_id,
        "name":          name,
        "email":         email,
        "password_hash": hashlib.sha256(password.encode()).hexdigest(),
        "role":          (data.get('role') or 'Скаут').strip(),
        "club":          (data.get('club') or '').strip(),
        "country":       (data.get('country') or '').strip(),
        "region":        (data.get('region') or '').strip(),
        "license":       (data.get('license') or '').strip(),
        "phone":         (data.get('phone') or '').strip(),
        "dob":           (data.get('dob') or ''),
        "exp":           (data.get('exp') or ''),
        "spec":          (data.get('spec') or '').strip(),
        "age_range":     (data.get('age_range') or '').strip(),
        "bio":           (data.get('bio') or '').strip(),
        "avatar":        avatar,
        "color":         color,
        "created_at":    datetime.now().isoformat()
    }

    scouts.append(new_scout)
    save_scouts(scouts)
    print(f"Новый скаут зарегистрирован: {name} ({email})")
    return jsonify(scout_public(new_scout)), 201


@app.route('/api/scouts/login', methods=['POST'])
def login_scout():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Нет данных'}), 400

    email    = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({'error': 'Введите email и пароль'}), 400

    scouts = load_scouts()
    s = next((x for x in scouts if x['email'].lower() == email), None)

    if not s:
        return jsonify({'error': 'Пользователь не найден'}), 404

    ph = hashlib.sha256(password.encode()).hexdigest()
    if s['password_hash'] != ph:
        return jsonify({'error': 'Неверный пароль'}), 401

    return jsonify(scout_public(s))


@app.route('/api/scouts/<scout_id>', methods=['PUT'])
def update_scout(scout_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Нет данных'}), 400

    scouts = load_scouts()
    idx = next((i for i,s in enumerate(scouts) if s['id'] == scout_id), None)
    if idx is None:
        return jsonify({'error': 'Скаут не найден'}), 404

    allowed = ['name','role','club','country','region','license','phone','dob','exp','spec','age_range','bio','color']
    for field in allowed:
        if field in data:
            scouts[idx][field] = data[field]

    # Update avatar if name changed
    if 'name' in data:
        scouts[idx]['avatar'] = ''.join(w[0].upper() for w in data['name'].split()[:2])

    save_scouts(scouts)
    return jsonify(scout_public(scouts[idx]))


@app.route('/api/ai/interview/invite', methods=['POST'])
def create_interview_invite():
    data = request.get_json() or {}
    scout_id = (data.get('scout_id') or 'unknown').strip()
    channel = (data.get('channel') or 'site').strip().lower()
    player_id = data.get('player_id')
    player_name = (data.get('player_name') or '').strip()
    telegram_username = (data.get('telegram_username') or '').strip()
    telegram_chat_id = str(data.get('telegram_chat_id') or '').strip()

    if not player_id and not player_name:
        return jsonify({'error': 'Укажите player_id или player_name'}), 400

    if player_id and players_df is not None:
        row = players_df[players_df['player_id'] == int(player_id)]
        if not row.empty and not player_name:
            player_name = str(row.iloc[0].get('name', 'Игрок'))

    interview_id = uuid.uuid4().hex[:12]
    invite_path = f"/index.html?interview={interview_id}"
    base_url = _public_base_url()
    invite_link = f"{base_url}{invite_path}" if base_url else invite_path
    invite_message = (
        f"Приглашение на адаптивное интервью ScoutMetric для {player_name or 'игрока'}. "
        f"Код интервью: {interview_id}. Ссылка: {invite_link}"
    )

    session = {
        'interview_id': interview_id,
        'scout_id': scout_id,
        'player_id': int(player_id) if player_id else None,
        'player_name': player_name or 'Игрок',
        'channel': channel,
        'telegram_username': telegram_username,
        'telegram_chat_id': telegram_chat_id,
        'status': 'invited',
        'metrics': _init_psy_metrics(),
        'asked_question_ids': [],
        'answers': [],
        'current_question': None,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
        'completed_at': None,
        'summary': None,
    }

    sessions = load_interviews()
    sessions.append(session)
    save_interviews(sessions)

    telegram_status = None
    if channel == 'telegram':
        invite_text = (
            "<b>ScoutMetric: приглашение на адаптивное интервью</b>\n"
            f"Игрок: <b>{session.get('player_name', 'Игрок')}</b>\n"
            f"Код интервью: <code>{interview_id}</code>\n"
            f"Ссылка: {invite_link}\n\n"
            "В Telegram начните так: <code>/interview YOUR_CODE</code>\n"
            f"Например: <code>/interview {interview_id}</code>\n\n"
            "Если открываете через сайт, используйте ссылку выше."
        )
        _, default_chat_id, default_username = _telegram_config()
        target_chat = telegram_chat_id or telegram_username or default_chat_id or default_username
        telegram_status = _telegram_send_message(target_chat, invite_text)

    return jsonify({
        'interview_id': interview_id,
        'invite_link': invite_link,
        'invite_message': invite_message,
        'delivery': 'telegram' if channel == 'telegram' else 'site-notification',
        'telegram_status': telegram_status,
        'note': (
            'Telegram отправка активна (нужны TG_BOT_TOKEN и telegram_chat_id/TG_DEFAULT_CHAT_ID). '
            'По номеру телефона Telegram Bot API сообщения не отправляет.'
        ),
    })


@app.route('/api/ai/interview/<interview_id>', methods=['GET'])
def get_interview_session(interview_id):
    sessions = load_interviews()
    session = next((x for x in sessions if x.get('interview_id') == interview_id), None)
    if not session:
        return jsonify({'error': 'Интервью не найдено'}), 404

    if session.get('status') == 'completed':
        return jsonify({
            'interview_id': interview_id,
            'status': 'completed',
            'player_name': session.get('player_name', 'Игрок'),
            'metrics': session.get('metrics', {}),
            'summary': session.get('summary', {}),
            'answers_count': len(session.get('answers', [])),
            'completed_at': session.get('completed_at'),
        })

    if not session.get('current_question'):
        next_q = _pick_next_interview_question(session)
        if not next_q:
            session['status'] = 'completed'
            session['summary'] = summarize_interview_session(session)
            session['metrics'] = session['summary'].get('metrics', session.get('metrics', _init_psy_metrics()))
            session['completed_at'] = datetime.now().isoformat()
        else:
            session['current_question'] = next_q
            session['status'] = 'in_progress'
        session['updated_at'] = datetime.now().isoformat()
        save_interviews(sessions)

    return jsonify({
        'interview_id': interview_id,
        'status': session.get('status', 'in_progress'),
        'player_name': session.get('player_name', 'Игрок'),
        'question': session.get('current_question'),
        'answers_count': len(session.get('answers', [])),
        'metrics': session.get('metrics', {}),
        'summary': session.get('summary'),
    })


@app.route('/api/ai/interview/<interview_id>/answer', methods=['POST'])
def answer_interview_question(interview_id):
    body = request.get_json() or {}
    answer = (body.get('answer') or '').strip()
    if not answer:
        return jsonify({'error': 'Ответ не может быть пустым'}), 400

    sessions = load_interviews()
    idx = _find_interview_index_by_id(sessions, interview_id)
    if idx is None:
        return jsonify({'error': 'Интервью не найдено'}), 404

    session = sessions[idx]
    if session.get('status') == 'completed':
        return jsonify({'error': 'Интервью уже завершено'}), 400

    done = _apply_answer_to_session(session, answer)

    session['updated_at'] = datetime.now().isoformat()
    sessions[idx] = session
    save_interviews(sessions)

    return jsonify({
        'status': session['status'],
        'metrics': session.get('metrics', {}),
        'next_question': session.get('current_question'),
        'summary': session.get('summary'),
        'answers_count': len(session.get('answers', [])),
        'completed': done,
    })


@app.route('/api/ai/interview/<interview_id>/complete', methods=['POST'])
def complete_interview(interview_id):
    sessions = load_interviews()
    idx = next((i for i, x in enumerate(sessions) if x.get('interview_id') == interview_id), None)
    if idx is None:
        return jsonify({'error': 'Интервью не найдено'}), 404

    session = sessions[idx]
    if session.get('status') != 'completed':
        session['status'] = 'completed'
        session['current_question'] = None
        session['summary'] = summarize_interview_session(session)
        session['metrics'] = session['summary'].get('metrics', session.get('metrics', _init_psy_metrics()))
        session['completed_at'] = datetime.now().isoformat()
        if session.get('channel') == 'telegram':
            session['telegram_summary_status'] = _deliver_interview_summary_to_telegram(session)
        session['updated_at'] = datetime.now().isoformat()
        sessions[idx] = session
        save_interviews(sessions)

    return jsonify({
        'status': 'completed',
        'interview_id': interview_id,
        'summary': session.get('summary'),
        'metrics': session.get('metrics', {}),
        'telegram_summary_status': session.get('telegram_summary_status'),
    })


@app.route('/api/telegram/webhook', methods=['POST'])
def telegram_webhook():
    update = request.get_json(silent=True) or {}
    callback = update.get('callback_query') or {}

    if callback:
        cb_id = (callback.get('id') or '').strip()
        cb_data = (callback.get('data') or '').strip()
        from_user = callback.get('from') or {}
        user_id = from_user.get('id')

        if cb_data.startswith('poll_vote:'):
            parts = cb_data.split(':')
            if len(parts) == 3:
                poll_id = parts[1].strip()
                try:
                    option_idx = int(parts[2])
                except ValueError:
                    option_idx = -1

                polls = load_telegram_polls()
                pidx = _find_poll_index_by_id(polls, poll_id)
                if pidx is None:
                    _telegram_answer_callback(cb_id, "Опрос не найден")
                    return jsonify({'ok': True})

                poll = polls[pidx]
                vote_status = _apply_poll_vote(poll, user_id, option_idx)
                poll['updated_at'] = datetime.now().isoformat()
                polls[pidx] = poll
                save_telegram_polls(polls)

                if vote_status.get('ok'):
                    _telegram_answer_callback(cb_id, f"Ваш голос: {vote_status.get('selected_option')}")
                else:
                    _telegram_answer_callback(cb_id, "Неверный вариант")

                return jsonify({'ok': True})

    msg = update.get('message') or update.get('edited_message') or {}
    chat = msg.get('chat') or {}
    from_user = msg.get('from') or {}

    chat_id = str(chat.get('id') or '').strip()
    text = (msg.get('text') or '').strip()
    username = (from_user.get('username') or '').strip()

    if not chat_id or not text:
        return jsonify({'ok': True, 'ignored': True})

    sessions = load_interviews()

    if text.startswith('/start'):
        _telegram_send_message(
            chat_id,
            (
                "<b>ScoutMetric Bot</b>\n"
                "Команды:\n"
                "• /interview CODE - начать интервью по коду\n"
                "• /poll Вопрос | Да | Нет - создать опрос\n"
                "• /vote POLL_ID НОМЕР - проголосовать текстом\n"
                "• /results POLL_ID - посмотреть подсчёт\n"
                "• /myinterview - продолжить текущее интервью\n\n"
                f"Ваш chat_id: <code>{chat_id}</code>\n"
                "После запуска просто отправляйте ответы обычными сообщениями."
            )
        )
        return jsonify({'ok': True})

    if text.startswith('/poll'):
        parsed = _parse_poll_command(text)
        if not parsed:
            _telegram_send_message(
                chat_id,
                "Формат: <code>/poll Вопрос | Вариант 1 | Вариант 2</code>"
            )
            return jsonify({'ok': True})

        poll = {
            'poll_id': _new_poll_id(),
            'chat_id': chat_id,
            'creator_user_id': from_user.get('id'),
            'creator_username': username,
            'question': parsed['question'],
            'options': parsed['options'],
            'votes': {},
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
        }

        polls = load_telegram_polls()
        polls.append(poll)
        save_telegram_polls(polls)

        _telegram_send_message(
            chat_id,
            _format_poll_message(poll),
            reply_markup=_build_poll_keyboard(poll['poll_id'], poll['options'])
        )
        return jsonify({'ok': True, 'poll_id': poll['poll_id']})

    if text.startswith('/vote'):
        parts = text.split(maxsplit=2)
        if len(parts) < 3:
            _telegram_send_message(chat_id, "Использование: <code>/vote POLL_ID НОМЕР_ВАРИАНТА</code>")
            return jsonify({'ok': True})

        poll_id = parts[1].strip()
        try:
            option_idx = int(parts[2].strip()) - 1
        except ValueError:
            _telegram_send_message(chat_id, "Номер варианта должен быть числом.")
            return jsonify({'ok': True})

        polls = load_telegram_polls()
        pidx = _find_poll_index_by_id(polls, poll_id)
        if pidx is None:
            _telegram_send_message(chat_id, "Опрос не найден.")
            return jsonify({'ok': True})

        poll = polls[pidx]
        vote_status = _apply_poll_vote(poll, from_user.get('id'), option_idx)
        if not vote_status.get('ok'):
            _telegram_send_message(chat_id, "Неверный номер варианта.")
            return jsonify({'ok': True})

        poll['updated_at'] = datetime.now().isoformat()
        polls[pidx] = poll
        save_telegram_polls(polls)
        _telegram_send_message(chat_id, f"Голос принят: <b>{vote_status.get('selected_option')}</b>")
        return jsonify({'ok': True})

    if text.startswith('/results'):
        parts = text.split(maxsplit=1)
        if len(parts) < 2:
            _telegram_send_message(chat_id, "Использование: <code>/results POLL_ID</code>")
            return jsonify({'ok': True})

        poll_id = parts[1].strip()
        polls = load_telegram_polls()
        pidx = _find_poll_index_by_id(polls, poll_id)
        if pidx is None:
            _telegram_send_message(chat_id, "Опрос не найден.")
            return jsonify({'ok': True})

        _telegram_send_message(chat_id, _format_poll_results(polls[pidx]))
        return jsonify({'ok': True})

    if text.startswith('/interview'):
        parts = text.split(maxsplit=1)
        if len(parts) < 2:
            _telegram_send_message(chat_id, "Использование: <code>/interview YOUR_CODE</code>")
            return jsonify({'ok': True})

        interview_id = parts[1].strip()
        idx = _find_interview_index_by_id(sessions, interview_id)
        if idx is None:
            _telegram_send_message(chat_id, "Интервью с таким кодом не найдено.")
            return jsonify({'ok': True})

        session = sessions[idx]
        session['channel'] = 'telegram'
        session['telegram_chat_id'] = chat_id
        if username:
            session['telegram_username'] = f"@{username}"

        if session.get('status') == 'completed':
            _telegram_send_message(chat_id, _format_interview_summary_message(session))
        else:
            _ensure_interview_question(session)
            _telegram_send_message(chat_id, _format_interview_question_message(session))

        session['updated_at'] = datetime.now().isoformat()
        sessions[idx] = session
        save_interviews(sessions)
        return jsonify({'ok': True})

    if text.startswith('/myinterview'):
        idx = _find_active_interview_index_by_chat_id(sessions, chat_id)
        if idx is None:
            _telegram_send_message(chat_id, "Активное интервью не найдено. Запустите: <code>/interview YOUR_CODE</code>")
            return jsonify({'ok': True})

        session = sessions[idx]
        _ensure_interview_question(session)
        _telegram_send_message(chat_id, _format_interview_question_message(session))
        session['updated_at'] = datetime.now().isoformat()
        sessions[idx] = session
        save_interviews(sessions)
        return jsonify({'ok': True})

    idx = _find_active_interview_index_by_chat_id(sessions, chat_id)
    if idx is None:
        _telegram_send_message(
            chat_id,
            "Не вижу активного интервью. Используйте <code>/interview YOUR_CODE</code>, чтобы начать."
        )
        return jsonify({'ok': True})

    session = sessions[idx]
    completed = _apply_answer_to_session(session, text)
    session['updated_at'] = datetime.now().isoformat()
    sessions[idx] = session
    save_interviews(sessions)

    if completed:
        _telegram_send_message(chat_id, "Интервью завершено. Отправляю итоговый анализ.")
        _telegram_send_message(chat_id, _format_interview_summary_message(session))
    else:
        _telegram_send_message(chat_id, _format_interview_question_message(session))

    return jsonify({'ok': True, 'completed': completed})


@app.route('/api/telegram/set_webhook', methods=['POST'])
def telegram_set_webhook():
    body = request.get_json(silent=True) or {}
    webhook_url = (body.get('url') or '').strip()
    if not webhook_url:
        return jsonify({'error': 'Передайте публичный URL в поле url'}), 400

    token, _, _ = _telegram_config()
    if not token:
        return jsonify({'error': 'TG_BOT_TOKEN не настроен'}), 400

    payload = url_parse.urlencode({'url': webhook_url}).encode('utf-8')
    req = url_request.Request(
        url=f"https://api.telegram.org/bot{token}/setWebhook",
        data=payload,
        method='POST',
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )

    try:
        with url_request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode('utf-8')
            data = json.loads(raw)
            return jsonify(data)
    except url_error.HTTPError as e:
        detail = e.read().decode('utf-8', errors='ignore') if hasattr(e, 'read') else str(e)
        return jsonify({'ok': False, 'error': f'HTTP {e.code}', 'detail': detail}), 500
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/telegram/webhook_info', methods=['GET'])
def telegram_webhook_info():
    token, _, _ = _telegram_config()
    if not token:
        return jsonify({'error': 'TG_BOT_TOKEN не настроен'}), 400

    req = url_request.Request(
        url=f"https://api.telegram.org/bot{token}/getWebhookInfo",
        method='GET',
    )

    try:
        with url_request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode('utf-8')
            data = json.loads(raw)
            return jsonify(data)
    except url_error.HTTPError as e:
        detail = e.read().decode('utf-8', errors='ignore') if hasattr(e, 'read') else str(e)
        return jsonify({'ok': False, 'error': f'HTTP {e.code}', 'detail': detail}), 500
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/ai/model_report', methods=['GET'])
def ai_model_report():
    return jsonify(get_model_report())



# ════════════════════════════════════════════════════════════════════════════
# AI: Предикт матча
# ════════════════════════════════════════════════════════════════════════════
@app.route('/api/ai/predict_match', methods=['POST'])
def predict_match():
    """Предсказывает счёт матча на основе исторических данных."""
    data = request.get_json() or {}
    home_id = data.get('home_club_id')
    away_id = data.get('away_club_id')

    ml_result = ml_predict_match(home_id, away_id, clubs_df=clubs_df)
    if ml_result:
        return jsonify(ml_result)

    if games_df is None or club_games_df is None:
        return jsonify({'error': 'Данные матчей не загружены'}), 500

    cg = club_games_df.copy()

    def club_stats(club_id, last_n=20):
        rows = cg[cg['club_id'] == club_id].tail(last_n)
        if rows.empty:
            return {'wins': 0, 'draws': 0, 'losses': 0, 'goals_scored': 0, 'goals_conceded': 0, 'games': 0}
        wins   = int((rows['is_win'] == 1).sum())
        draws  = int((rows['is_win'] == 0).sum())
        losses = int((rows['is_win'] == -1).sum()) if -1 in rows['is_win'].values else int(len(rows) - wins - draws)
        gs = float(rows['own_goals'].fillna(0).mean())
        gc = float(rows['opponent_goals'].fillna(0).mean())
        return {'wins': wins, 'draws': draws, 'losses': losses,
                'goals_scored': round(gs, 2), 'goals_conceded': round(gc, 2), 'games': len(rows)}

    home_stats = club_stats(home_id)
    away_stats = club_stats(away_id)

    # Head-to-head
    h2h_games = games_df[
        ((games_df['home_club_id'] == home_id) & (games_df['away_club_id'] == away_id)) |
        ((games_df['home_club_id'] == away_id) & (games_df['away_club_id'] == home_id))
    ].tail(10)

    h2h = []
    for _, r in h2h_games.iterrows():
        h2h.append({
            'date': str(r['date'])[:10],
            'home': r.get('home_club_name', '?'),
            'away': r.get('away_club_name', '?'),
            'score': f"{int(r['home_club_goals']) if pd.notna(r['home_club_goals']) else '?'}:{int(r['away_club_goals']) if pd.notna(r['away_club_goals']) else '?'}"
        })

    # Предикт — взвешенная модель
    hg = home_stats['goals_scored']
    ag = away_stats['goals_scored']
    home_def = home_stats['goals_conceded']
    away_def = away_stats['goals_conceded']
    home_form = (home_stats['wins'] / max(home_stats['games'], 1))
    away_form = (away_stats['wins'] / max(away_stats['games'], 1))

    # Домашнее преимущество +0.3
    pred_home = round(hg * 0.6 + (1 - away_def / max(ag + away_def, 1)) * 1.5 + 0.3 + home_form * 0.5, 1)
    pred_away = round(ag * 0.6 + (1 - home_def / max(hg + home_def, 1)) * 1.5 + away_form * 0.5, 1)
    pred_home = max(0, min(pred_home, 6))
    pred_away = max(0, min(pred_away, 6))

    # Вероятности
    total = max(home_form + away_form + 0.3, 0.01)
    p_home = round((home_form + 0.15) / total * 100)
    p_draw = round(25 - abs(home_form - away_form) * 10)
    p_draw = max(8, min(p_draw, 35))
    p_away = max(5, 100 - p_home - p_draw)

    # Названия клубов
    home_name = '—'; away_name = '—'
    if clubs_df is not None:
        h = clubs_df[clubs_df['club_id'] == home_id]
        a = clubs_df[clubs_df['club_id'] == away_id]
        if not h.empty: home_name = h.iloc[0]['name']
        if not a.empty: away_name = a.iloc[0]['name']

    return jsonify({
        'home_club': home_name,
        'away_club': away_name,
        'predicted_score': f"{round(pred_home)}:{round(pred_away)}",
        'predicted_home_goals': round(pred_home, 1),
        'predicted_away_goals': round(pred_away, 1),
        'probabilities': {'home_win': p_home, 'draw': p_draw, 'away_win': p_away},
        'home_stats': home_stats,
        'away_stats': away_stats,
        'head_to_head': h2h[-5:],
        'confidence': 'Высокая' if home_stats['games'] >= 15 and away_stats['games'] >= 15 else 'Средняя' if home_stats['games'] >= 8 else 'Низкая'
    })


# ════════════════════════════════════════════════════════════════════════════
# AI: Анализ игрока
# ════════════════════════════════════════════════════════════════════════════
@app.route('/api/ai/analyze_player/<int:player_id>', methods=['GET'])
def analyze_player(player_id):
    """Анализирует игрока: потенциал, лучшее время покупки, важность для клуба."""
    if players_df is None:
        return jsonify({'error': 'Данные не загружены'}), 500

    ml_result = predict_player_prospect(player_id, players_df, valuations_df, clubs_df=clubs_df)
    if ml_result:
        return jsonify(ml_result)

    row = players_df[players_df['player_id'] == player_id]
    if row.empty:
        return jsonify({'error': 'Игрок не найден'}), 404
    p = row.iloc[0]

    age = safe(p.get('age'), 0)
    mv  = safe(p.get('market_value_in_eur'), 0) or 0
    hmv = safe(p.get('highest_market_value_in_eur'), 0) or 0
    pos = safe(p.get('position_group'), '—')

    # История стоимости
    val_hist = []
    if valuations_df is not None:
        vh = valuations_df[valuations_df['player_id'] == player_id].sort_values('date')
        val_hist = [{'date': str(r['date'])[:10], 'value': safe(r['market_value_in_eur'], 0)}
                    for _, r in vh.iterrows()]

    # Потенциал по возрасту
    peak_ages = {'Attack': (24, 28), 'Midfield': (25, 30), 'Defender': (26, 31), 'Goalkeeper': (27, 33)}
    peak = peak_ages.get(pos, (25, 30))

    if age < peak[0]:
        potential_stage  = 'Развивается'
        potential_score  = min(95, 60 + (peak[0] - age) * 3 + (mv / max(hmv, 1)) * 25)
        buy_recommendation = 'ПОКУПАТЬ СЕЙЧАС'
        buy_reason = f'Игрок {age} лет, ещё не достиг пика ({peak[0]}–{peak[1]} лет). Цена будет расти.'
        buy_color  = '#10B981'
    elif age <= peak[1]:
        potential_stage  = 'Пик формы'
        potential_score  = min(98, 75 + (mv / max(hmv, 1)) * 22)
        buy_recommendation = 'РАССМОТРЕТЬ'
        buy_reason = f'Игрок на пике ({peak[0]}–{peak[1]} лет). Высокая стоимость, но гарантированное качество.'
        buy_color  = '#F59E0B'
    elif age <= peak[1] + 3:
        potential_stage  = 'Опытный'
        potential_score  = max(40, 60 - (age - peak[1]) * 5)
        buy_recommendation = 'ОСТОРОЖНО'
        buy_reason = f'Игрок {age} лет, после пика. Стоимость может снижаться. Подходит для опыта в команде.'
        buy_color  = '#F59E0B'
    else:
        potential_stage  = 'Завершающий этап'
        potential_score  = max(20, 40 - (age - peak[1] - 3) * 4)
        buy_recommendation = 'НЕ РЕКОМЕНДУЕТСЯ'
        buy_reason = f'Игрок {age} лет, карьера в завершающей стадии. Только краткосрочный контракт.'
        buy_color  = '#EF4444'

    # Динамика стоимости — тренд
    value_trend = 'стабильная'
    trend_pct   = 0
    if len(val_hist) >= 4:
        recent_vals = [x['value'] for x in val_hist[-4:] if x['value']]
        if len(recent_vals) >= 2:
            trend_pct = round((recent_vals[-1] - recent_vals[0]) / max(recent_vals[0], 1) * 100, 1)
            if trend_pct > 15:   value_trend = 'растёт'
            elif trend_pct < -15: value_trend = 'падает'

    # Важность для клуба
    club_importance = 'Средняя'
    importance_score = 50
    if hmv > 0 and mv > 0:
        ratio = mv / hmv
        if ratio > 0.8:   club_importance = 'Ключевой игрок'; importance_score = 90
        elif ratio > 0.5: club_importance = 'Важный игрок';   importance_score = 70
        elif ratio > 0.25:club_importance = 'Ротационный';    importance_score = 45
        else:              club_importance = 'Резерв';          importance_score = 25

    # Лучшие клубы для игрока (по бюджету лиги)
    suitable_clubs = []
    if clubs_df is not None and mv > 0:
        club_sample = clubs_df[clubs_df['total_market_value'].notna()].copy()
        try:
            club_sample['tmv_num'] = club_sample['total_market_value'].astype(str).str.replace(
                r'[^\d.]', '', regex=True).astype(float)
            budget_min = mv * 5
            budget_max = mv * 40
            fits = club_sample[
                (club_sample['tmv_num'] >= budget_min) &
                (club_sample['tmv_num'] <= budget_max)
            ].head(5)
            for _, c in fits.iterrows():
                suitable_clubs.append({'name': c['name'], 'league': c.get('competition_name', '—')})
        except Exception:
            pass

    return jsonify({
        'player_id': player_id,
        'name': safe(p.get('name'), '—'),
        'age': age,
        'position': pos,
        'market_value': mv,
        'market_value_fmt': fmt_value(mv),
        'highest_value_fmt': fmt_value(hmv),
        'potential_stage': potential_stage,
        'potential_score': round(potential_score),
        'buy_recommendation': buy_recommendation,
        'buy_reason': buy_reason,
        'buy_color': buy_color,
        'value_trend': value_trend,
        'value_trend_pct': trend_pct,
        'club_importance': club_importance,
        'importance_score': importance_score,
        'suitable_clubs': suitable_clubs,
        'value_history': val_hist[-12:],
        'peak_age_range': f"{peak[0]}–{peak[1]}"
    })


# ════════════════════════════════════════════════════════════════════════════
# AI: Матчи для предикта (ближайшие / последние без результата)
# ════════════════════════════════════════════════════════════════════════════
@app.route('/api/ai/upcoming_matches', methods=['GET'])
def upcoming_matches():
    """Возвращает последние матчи сезона 25/26 для предикта."""
    if games_df is None:
        return jsonify([])

    df = games_df.copy()
    df['date'] = pd.to_datetime(df['date'], errors='coerce')

    # Матчи сезона 25/26 — самые свежие
    recent = df[df['season'] == '25/26'].sort_values('date', ascending=False).head(30)
    if recent.empty:
        recent = df.sort_values('date', ascending=False).head(30)

    result = []
    for _, r in recent.iterrows():
        result.append({
            'game_id':       safe(r.get('game_id'), 0),
            'home_club_id':  safe(r.get('home_club_id'), 0),
            'away_club_id':  safe(r.get('away_club_id'), 0),
            'home_club_name':safe(r.get('home_club_name'), '—'),
            'away_club_name':safe(r.get('away_club_name'), '—'),
            'competition':   safe(r.get('competition_id'), '—'),
            'date':          str(r['date'])[:10] if pd.notna(r['date']) else '—',
            'season':        safe(r.get('season'), '—'),
        })
    return jsonify(result)


# ════════════════════════════════════════════════════════════════════════════
# AI: Оценка работы скаута
# ════════════════════════════════════════════════════════════════════════════
@app.route('/api/ai/scout_performance/<scout_id>', methods=['GET'])
def scout_performance(scout_id):
    """Оценивает работу скаута по его данным."""
    scouts = load_scouts()
    s = next((x for x in scouts if x['id'] == scout_id), None)
    if not s:
        return jsonify({'error': 'Скаут не найден'}), 404

    exp = int(s.get('exp') or 0)
    license_scores = {'UEFA Pro': 100, 'UEFA A': 80, 'UEFA B': 60, 'UEFA C': 40, 'Нет': 20, '': 20}
    lic_score = license_scores.get(s.get('license', ''), 30)

    exp_score = min(100, exp * 10)
    overall = round((lic_score * 0.4 + exp_score * 0.6))

    grade = 'S' if overall >= 90 else 'A' if overall >= 75 else 'B' if overall >= 55 else 'C'
    grade_color = {'S': '#60A5FA', 'A': '#10B981', 'B': '#F59E0B', 'C': '#EF4444'}[grade]

    return jsonify({
        'scout_id': scout_id,
        'name': s.get('name', '—'),
        'grade': grade,
        'grade_color': grade_color,
        'overall_score': overall,
        'license_score': lic_score,
        'exp_score': exp_score,
        'strengths': [
            s.get('spec', '—'),
            f"Регион: {s.get('region', '—')}",
            f"Опыт {exp} лет"
        ],
        'license': s.get('license', '—'),
        'exp': exp,
    })


# ─── Старт ───────────────────────────────────────────────────────────────────
print("ScoutMetric — загрузка данных...")
load_data()

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')