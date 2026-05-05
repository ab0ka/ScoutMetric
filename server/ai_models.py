"""Lightweight fallback AI models module.

This project imports functions from this module at server startup.
The implementation below keeps the API stable so the app can run
without optional ML dependencies.
"""


def init_models(**kwargs):
    """Initialize ML models (fallback: no-op)."""
    return {"status": "fallback", "message": "ML models are disabled"}


def predict_match(home_club_id, away_club_id, clubs_df=None):
    """Return None to let app.py use heuristic fallback prediction."""
    return None


def predict_player_prospect(player_id, players_df, valuations_df, clubs_df=None):
    """Return None to let app.py use rule-based fallback analysis."""
    return None


def predict_interview_impact(*args, **kwargs):
    """Optional ML hook used by interview flow (fallback: no prediction)."""
    return None


def summarize_interview_session(*args, **kwargs):
    """Optional ML hook used by interview flow (fallback: no summary)."""
    return None


def get_model_report():
    """Expose model report endpoint data in fallback mode."""
    return {
        "status": "fallback",
        "models": [],
        "message": "ML model module is running in compatibility mode"
    }
