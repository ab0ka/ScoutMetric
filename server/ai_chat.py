from flask import Blueprint, jsonify, request
import json
import os
import re
from urllib import error as url_error
from urllib import request as url_request
import pandas as pd
import numpy as np

ai_chat_bp = Blueprint('ai_chat', __name__)

_players_df = None
_clubs_df = None
_transfers_df = None
_games_df = None
_valuations_df = None
_competitions_df = None


def init_agent_data(players, clubs, transfers, games, valuations, competitions):
    global _players_df, _clubs_df, _transfers_df, _games_df, _valuations_df, _competitions_df
    _players_df = players
    _clubs_df = clubs
    _transfers_df = transfers
    _games_df = games
    _valuations_df = valuations
    _competitions_df = competitions


def _safe(val, default=None):
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return default
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return float(val)
    return val


def _fmt(eur):
    if not eur or eur == 0:
        return "—"
    if eur >= 1_000_000:
        return f"€{eur / 1_000_000:.1f}M"
    if eur >= 1_000:
        return f"€{eur / 1_000:.0f}K"
    return f"€{eur:.0f}"


def tool_search_players(query, position=None, age_min=None, age_max=None, nationality=None, limit=10):
    if _players_df is None:
        return {"error": "Данные не загружены"}
    df = _players_df.copy()
    if query:
        q = query.lower()
        df = df[
            df['name'].str.lower().str.contains(q, na=False) |
            df['club_name'].str.lower().str.contains(q, na=False) |
            df['position'].str.lower().str.contains(q, na=False) |
            df['position_group'].str.lower().str.contains(q, na=False) |
            df['nationality_name'].str.lower().str.contains(q, na=False) |
            df['sub_position'].str.lower().str.contains(q, na=False)
        ]
    if position:
        df = df[df['position_group'].str.lower() == position.lower()]
    if age_min:
        df = df[df['age'] >= int(age_min)]
    if age_max:
        df = df[df['age'] <= int(age_max)]
    if nationality:
        n = nationality.lower()
        df = df[
            df['nationality_name'].str.lower().str.contains(n, na=False) |
            df['country_of_birth'].str.lower().str.contains(n, na=False)
        ]
    result = df.nlargest(int(limit), 'market_value_in_eur')
    players = []
    for _, r in result.iterrows():
        mv = _safe(r['market_value_in_eur'], 0)
        players.append({
            "id": int(r['player_id']),
            "name": str(r['name']),
            "age": int(r['age']),
            "position": str(r.get('sub_position', r['position'])),
            "club": str(r['club_name']),
            "nationality": str(r.get('nationality_name', '—')),
            "market_value": _fmt(mv),
            "foot": str(r.get('foot', '—')),
            "height_cm": int(r.get('height_in_cm', 0)),
            "contract_until": str(r['contract_expiry_date'])[:10] if pd.notna(r.get('contract_expiry_date')) else None,
            "league": str(r.get('league', '—')),
        })
    return {"players": players, "total_found": len(df)}


def tool_get_player_detail(player_id):
    if _players_df is None:
        return {"error": "Данные не загружены"}
    row = _players_df[_players_df['player_id'] == int(player_id)]
    if row.empty:
        return {"error": f"Игрок с ID {player_id} не найден"}
    p = row.iloc[0]
    mv = _safe(p.get('market_value_in_eur'), 0)
    hmv = _safe(p.get('highest_market_value_in_eur'), 0) or 0
    data = {
        "id": int(p['player_id']),
        "name": str(p.get('name', '—')),
        "age": int(p.get('age', 0)),
        "position": str(p.get('sub_position', p.get('position', '—'))),
        "club": str(p.get('club_name', '—')),
        "league": str(p.get('league', '—')),
        "nationality": str(p.get('nationality_name', '—')),
        "foot": str(p.get('foot', '—')),
        "height_cm": int(p.get('height_in_cm', 0)),
        "market_value": _fmt(mv),
        "market_value_eur": mv,
        "highest_value": _fmt(hmv),
        "contract_until": str(p['contract_expiry_date'])[:10] if pd.notna(p.get('contract_expiry_date')) else None,
        "agent": str(p.get('agent_name', '—')),
    }
    if _valuations_df is not None:
        hist = _valuations_df[_valuations_df['player_id'] == int(player_id)].sort_values('date').tail(8)
        data['value_history'] = [
            {"date": str(r['date'])[:10], "value_fmt": _fmt(_safe(r['market_value_in_eur'], 0))}
            for _, r in hist.iterrows()
        ]
    if _transfers_df is not None and 'player_id' in _transfers_df.columns:
        t_cols = [c for c in ['from_club_name', 'to_club_name', 'transfer_fee', 'transfer_date'] if c in _transfers_df.columns]
        tr = _transfers_df[_transfers_df['player_id'] == int(player_id)].sort_values(
            'transfer_date' if 'transfer_date' in _transfers_df.columns else _transfers_df.columns[0],
            ascending=False
        ).head(5)
        data['transfers'] = tr[t_cols].fillna('—').to_dict('records') if t_cols else []
    return data


def tool_get_top_players(position=None, age_max=None, nationality=None, min_value_m=None, limit=20):
    if _players_df is None:
        return {"error": "Данные не загружены"}
    df = _players_df.copy()
    if position:
        df = df[df['position_group'].str.lower() == position.lower()]
    if age_max:
        df = df[df['age'] <= int(age_max)]
    if nationality:
        n = nationality.lower()
        df = df[
            df['nationality_name'].str.lower().str.contains(n, na=False) |
            df['country_of_birth'].str.lower().str.contains(n, na=False)
        ]
    if min_value_m:
        df = df[df['market_value_in_eur'] >= float(min_value_m) * 1_000_000]
    result = df.nlargest(int(limit), 'market_value_in_eur')
    return {
        "players": [
            {
                "rank": i + 1,
                "name": str(r['name']),
                "age": int(r['age']),
                "position": str(r.get('sub_position', r['position'])),
                "club": str(r['club_name']),
                "nationality": str(r.get('nationality_name', '—')),
                "market_value": _fmt(_safe(r['market_value_in_eur'], 0)),
                "league": str(r.get('league', '—')),
            }
            for i, (_, r) in enumerate(result.iterrows())
        ]
    }


def tool_get_club_info(query):
    if _clubs_df is None:
        return {"error": "Данные о клубах не загружены"}
    df = _clubs_df.copy()
    mask = df['name'].str.lower().str.contains(query.lower(), na=False)
    result = df[mask].head(5)
    if result.empty:
        return {"clubs": [], "message": f"Клубы по запросу '{query}' не найдены"}
    clubs = []
    for _, r in result.iterrows():
        club = {"name": str(r['name'])}
        for col in ['competition_name', 'squad_size', 'average_age', 'total_market_value', 'stadium_name', 'coach_name']:
            if col in r.index and pd.notna(r.get(col)):
                club[col] = _safe(r.get(col), '—')
        if _players_df is not None and 'club_id' in r.index:
            squad = _players_df[_players_df['current_club_id'] == r['club_id']]
            if not squad.empty:
                top3 = squad.nlargest(3, 'market_value_in_eur')
                club['top_players'] = [
                    {"name": str(p['name']), "position": str(p.get('sub_position', p['position'])), "value": _fmt(_safe(p['market_value_in_eur'], 0))}
                    for _, p in top3.iterrows()
                ]
        clubs.append(club)
    return {"clubs": clubs}


def tool_compare_players(player_id_1, player_id_2):
    p1 = tool_get_player_detail(player_id_1)
    p2 = tool_get_player_detail(player_id_2)
    if "error" in p1:
        return p1
    if "error" in p2:
        return p2
    return {"player_1": p1, "player_2": p2}


def tool_get_database_stats():
    stats = {}
    if _players_df is not None:
        stats['total_players'] = len(_players_df)
        stats['avg_age'] = round(float(_players_df['age'].mean()), 1)
        stats['avg_value_m'] = round(float(_players_df['market_value_in_eur'].mean() / 1e6), 2)
        stats['positions'] = _players_df['position_group'].value_counts().to_dict()
        stats['top_nationalities'] = _players_df['nationality_name'].value_counts().head(10).to_dict()
        stats['top_leagues'] = _players_df['league'].value_counts().head(10).to_dict()
        most_val = _players_df.nlargest(1, 'market_value_in_eur').iloc[0]
        stats['most_valuable_player'] = {"name": str(most_val['name']), "value": _fmt(_safe(most_val['market_value_in_eur'], 0))}
    if _clubs_df is not None:
        stats['total_clubs'] = len(_clubs_df)
    if _transfers_df is not None:
        stats['total_transfers'] = len(_transfers_df)
    if _games_df is not None:
        stats['total_games'] = len(_games_df)
    return stats


TOOL_FUNCTIONS = {
    "search_players": tool_search_players,
    "get_player_detail": tool_get_player_detail,
    "get_top_players": tool_get_top_players,
    "get_club_info": tool_get_club_info,
    "compare_players": tool_compare_players,
    "get_database_stats": tool_get_database_stats,
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "search_players",
            "description": "Поиск игроков по имени, клубу, позиции или национальности.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "position": {"type": "string", "description": "Attack, Midfield, Defender, Goalkeeper"},
                    "age_min": {"type": "integer"},
                    "age_max": {"type": "integer"},
                    "nationality": {"type": "string"},
                    "limit": {"type": "integer"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_player_detail",
            "description": "Полный профиль игрока: стоимость, трансферы, контракт.",
            "parameters": {
                "type": "object",
                "properties": {"player_id": {"type": "integer"}},
                "required": ["player_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_top_players",
            "description": "Топ игроков по рыночной стоимости с фильтрами.",
            "parameters": {
                "type": "object",
                "properties": {
                    "position": {"type": "string"},
                    "age_max": {"type": "integer"},
                    "nationality": {"type": "string"},
                    "min_value_m": {"type": "number"},
                    "limit": {"type": "integer"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_club_info",
            "description": "Информация о клубе: состав, стадион, лига.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_players",
            "description": "Сравнение двух игроков по всем параметрам.",
            "parameters": {
                "type": "object",
                "properties": {
                    "player_id_1": {"type": "integer"},
                    "player_id_2": {"type": "integer"},
                },
                "required": ["player_id_1", "player_id_2"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_database_stats",
            "description": "Общая статистика базы: игроки, клубы, матчи, топ лиги.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

SYSTEM_PROMPT = """Ты — ИИ-ассистент платформы ScoutMetric для профессиональных футбольных скаутов.

Твои возможности:
- Поиск и анализ игроков из реальной базы данных
- Сравнение игроков по всем метрикам
- Топы по позиции, возрасту, стране
- Информация о клубах и трансферах

Правила:
- Всегда используй инструменты для получения данных
- Если вопрос про игрока — сначала search_players, потом get_player_detail
- Отвечай конкретно, с цифрами и фактами
- Давай профессиональные скаутские рекомендации
- Отвечай ТОЛЬКО на русском языке
- Используй эмодзи для наглядности"""


def _xai_chat_completion(messages, tools=None):
    api_key = os.environ.get("XAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("XAI_API_KEY не установлен в .env файле")
    if api_key.lower().startswith("your_") or "api_key_here" in api_key.lower():
        raise ValueError("XAI_API_KEY содержит шаблонное значение. Укажите реальный ключ из xAI Console.")

    model = os.environ.get("XAI_MODEL", "grok-3-mini")
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    req = url_request.Request(
        "https://api.x.ai/v1/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with url_request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except url_error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else ""
        raise RuntimeError(f"xAI HTTP {e.code}: {body}") from e


def _openrouter_chat_completion(messages, tools=None):
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY не установлен в .env файле")
    if api_key.lower().startswith("your_") or "api_key_here" in api_key.lower():
        raise ValueError("OPENROUTER_API_KEY содержит шаблонное значение. Укажите реальный ключ OpenRouter.")

    model = os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    referer = (os.environ.get("APP_PUBLIC_URL") or "").strip()
    app_title = (os.environ.get("APP_NAME") or "ScoutMetric").strip()
    if referer:
        headers["HTTP-Referer"] = referer
    if app_title:
        headers["X-Title"] = app_title

    req = url_request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with url_request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except url_error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else ""
        raise RuntimeError(f"OpenRouter HTTP {e.code}: {body}") from e


def _cloud_chat_completion(messages, tools=None, mode="auto"):
    mode = (mode or "auto").strip().lower()
    if mode == "xai":
        return _xai_chat_completion(messages, tools=tools), "xai"
    if mode == "openrouter":
        return _openrouter_chat_completion(messages, tools=tools), "openrouter"

    errors = []
    for provider in ("xai", "openrouter"):
        try:
            if provider == "xai":
                return _xai_chat_completion(messages, tools=tools), "xai"
            return _openrouter_chat_completion(messages, tools=tools), "openrouter"
        except Exception as exc:
            errors.append(f"{provider}: {exc}")
    raise RuntimeError("; ".join(errors))


def _fallback_local_assistant(user_message):
    q = (user_message or '').strip().lower()
    tool_calls = []

    def mark_tool(name, args):
        tool_calls.append({'tool': name, 'input': args})

    def summarize_players(items, limit=5):
        if not items:
            return 'Ничего не найдено по запросу.'
        lines = []
        for i, p in enumerate(items[:limit], start=1):
            lines.append(
                f"{i}. {p.get('name', '—')} | {p.get('position', '—')} | "
                f"{p.get('club', '—')} | {p.get('age', '—')} лет | {p.get('market_value', '—')}"
            )
        return '\n'.join(lines)

    age_match = re.search(r'(?:до|u[- ]?)\s*(\d{1,2})', q)
    age_max = int(age_match.group(1)) if age_match else None

    pos_map = {
        'напада': 'Attack',
        'форвар': 'Attack',
        'полузащ': 'Midfield',
        'хавбек': 'Midfield',
        'защит': 'Defender',
        'вратар': 'Goalkeeper',
    }
    position = None
    for k, v in pos_map.items():
        if k in q:
            position = v
            break

    if 'статист' in q or 'база' in q:
        mark_tool('get_database_stats', {})
        stats = tool_get_database_stats()
        reply = (
            "📊 Статистика базы:\n"
            f"• Игроков: {stats.get('total_players', 0):,}\n"
            f"• Клубов: {stats.get('total_clubs', 0):,}\n"
            f"• Трансферов: {stats.get('total_transfers', 0):,}\n"
            f"• Матчей: {stats.get('total_games', 0):,}\n"
            f"• Средний возраст: {stats.get('avg_age', '—')}\n"
            f"• Средняя стоимость: €{stats.get('avg_value_m', '—')}M"
        )
        return reply, tool_calls

    if 'сравн' in q:
        ids = [int(x) for x in re.findall(r'\d+', q)]
        if len(ids) >= 2:
            args = {'player_id_1': ids[0], 'player_id_2': ids[1]}
            mark_tool('compare_players', args)
            cmp_data = tool_compare_players(ids[0], ids[1])
            if 'error' in cmp_data:
                return f"⚠️ {cmp_data['error']}", tool_calls
            p1 = cmp_data.get('player_1', {})
            p2 = cmp_data.get('player_2', {})
            reply = (
                "⚖️ Сравнение игроков:\n"
                f"• {p1.get('name', '—')} — {p1.get('age', '—')} лет, {p1.get('position', '—')}, {p1.get('market_value', '—')}\n"
                f"• {p2.get('name', '—')} — {p2.get('age', '—')} лет, {p2.get('position', '—')}, {p2.get('market_value', '—')}\n"
                "Рекомендация: ориентируйтесь на возрастной профиль + контракт + динамику стоимости."
            )
            return reply, tool_calls

    if 'клуб' in q and len(q.split()) >= 2:
        club_query = user_message.strip().split()[-1]
        args = {'query': club_query}
        mark_tool('get_club_info', args)
        club_data = tool_get_club_info(club_query)
        clubs = club_data.get('clubs', [])
        if not clubs:
            return f"🏟️ По запросу '{club_query}' клубы не найдены.", tool_calls
        c = clubs[0]
        top_players = c.get('top_players', [])
        tp = '\n'.join([f"  - {x.get('name')} ({x.get('position')}), {x.get('value')}" for x in top_players]) or '  - Нет данных'
        reply = (
            f"🏟️ Клуб: {c.get('name', '—')}\n"
            f"• Лига: {c.get('competition_name', '—')}\n"
            f"• Состав: {c.get('squad_size', '—')}\n"
            f"• Средний возраст: {c.get('average_age', '—')}\n"
            f"• Топ игроки:\n{tp}"
        )
        return reply, tool_calls

    if 'топ' in q or position or age_max:
        args = {'position': position, 'age_max': age_max, 'limit': 10}
        mark_tool('get_top_players', args)
        top = tool_get_top_players(position=position, age_max=age_max, limit=10)
        players = top.get('players', [])
        if not players:
            return '🏆 Не нашёл игроков по фильтрам. Попробуйте убрать ограничения.', tool_calls
        lines = []
        for p in players[:10]:
            lines.append(f"{p.get('rank', '?')}. {p.get('name')} | {p.get('position')} | {p.get('club')} | {p.get('age')} | {p.get('market_value')}")
        return '🏆 Топ игроков:\n' + '\n'.join(lines), tool_calls

    args = {'query': user_message, 'limit': 8}
    mark_tool('search_players', args)
    found = tool_search_players(query=user_message, limit=8)
    players = found.get('players', [])
    total = found.get('total_found', 0)
    reply = (
        f"🔍 Нашёл игроков: {total}\n"
        f"{summarize_players(players, limit=8)}\n\n"
        "Могу дальше: сравнить двух игроков (напишите 'сравнить 123 и 456') или дать детальный профиль по ID."
    )
    return reply, tool_calls


def _assistant_mode():
    mode = (os.environ.get("AI_ASSISTANT_MODE", "auto") or "auto").strip().lower()
    if mode not in ("auto", "xai", "openrouter", "local"):
        return "auto"
    return mode


@ai_chat_bp.route('/api/ai/chat', methods=['POST'])
def chat():
    body = request.get_json(silent=True) or {}
    user_message = body.get('message', '').strip()
    history = body.get('history', [])

    if not user_message:
        return jsonify({'error': 'Пустое сообщение'}), 400

    mode = _assistant_mode()

    # Ручной локальный режим: вообще не используем внешний API.
    if mode == 'local':
        reply, tools = _fallback_local_assistant(user_message)
        pref = "🛠️ Локальный ассистент (ручной режим) активен. Ответ сформирован по вашей базе данных.\n\n"
        return jsonify({'reply': pref + reply, 'tool_calls': tools, 'fallback': True, 'mode': 'local'})

    try:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for h in history[-10:]:
            role = h.get('role', '')
            content = (h.get('content') or '').strip()
            if not content:
                continue
            if role in ('user', 'assistant'):
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_message})

        tool_calls_made = []

        # Agentic loop — максимум 4 итерации
        provider_used = None
        for _ in range(4):
            response, provider_used = _cloud_chat_completion(messages, tools=TOOL_SCHEMAS, mode=mode)
            choices = response.get('choices', [])
            if not choices:
                return jsonify({'reply': 'Не удалось получить ответ от модели.', 'tool_calls': tool_calls_made})

            message = choices[0].get('message', {})
            tool_calls = message.get('tool_calls') or []

            if not tool_calls:
                text = (message.get('content') or '').strip()
                return jsonify({'reply': text or 'Не удалось получить ответ.', 'tool_calls': tool_calls_made, 'provider': provider_used})

            messages.append({
                "role": "assistant",
                "content": message.get('content') or '',
                "tool_calls": tool_calls,
            })

            for tc in tool_calls:
                fn_name = tc.get('function', {}).get('name')
                raw_args = tc.get('function', {}).get('arguments') or '{}'
                try:
                    args = json.loads(raw_args)
                except json.JSONDecodeError:
                    args = {}

                tool_calls_made.append({'tool': fn_name, 'input': args})
                fn = TOOL_FUNCTIONS.get(fn_name)
                try:
                    result = fn(**args) if fn else {"error": "unknown tool"}
                except Exception as tool_err:
                    result = {"error": f"tool_failed: {str(tool_err)}"}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.get('id', ''),
                    "name": fn_name,
                    "content": json.dumps(result, ensure_ascii=False, default=str),
                })

        return jsonify({'reply': 'Не удалось получить ответ.', 'tool_calls': tool_calls_made})

    except Exception as e:
        err = str(e)
        if mode in ('xai', 'openrouter'):
            return jsonify({'error': f'Cloud strict mode ({mode}): {err}'}), 503

        if 'xai http 403' in err.lower() or 'openrouter http 403' in err.lower() or 'does not have permission' in err or 'doesn\'t have any credits' in err:
            reply, tools = _fallback_local_assistant(user_message)
            pref = "⚠️ Облачный AI временно недоступен (нет кредитов/лицензии). Переключился на локальный режим анализа по вашей базе.\n\n"
            return jsonify({'reply': pref + reply, 'tool_calls': tools, 'fallback': True, 'mode': 'auto->local'})
        if 'xai_api_key' in err.lower() or 'openrouter_api_key' in err.lower() or '401' in err or 'Unauthorized' in err:
            if mode == 'auto':
                reply, tools = _fallback_local_assistant(user_message)
                pref = "⚠️ Ключ облачного AI недоступен. Переключился на локальный режим анализа по вашей базе.\n\n"
                return jsonify({'reply': pref + reply, 'tool_calls': tools, 'fallback': True, 'mode': 'auto->local'})
            return jsonify({'error': 'Неверный ключ AI-провайдера. Проверь XAI_API_KEY / OPENROUTER_API_KEY в .env'}), 401
        if 'quota' in err.lower() or 'RESOURCE_EXHAUSTED' in err:
            if mode == 'auto':
                reply, tools = _fallback_local_assistant(user_message)
                pref = "⚠️ Лимит xAI исчерпан. Переключился на локальный режим анализа по вашей базе.\n\n"
                return jsonify({'reply': pref + reply, 'tool_calls': tools, 'fallback': True, 'mode': 'auto->local'})
            return jsonify({'error': 'Превышен лимит запросов. Подожди немного.'}), 429
        return jsonify({'error': f'Ошибка агента: {err}'}), 500