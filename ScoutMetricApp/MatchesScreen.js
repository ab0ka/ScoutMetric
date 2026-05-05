import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { theme } from './theme';
import { API_BASE } from './config';

const initials = name => (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

export default function MatchesScreen() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/ai/upcoming_matches`)
      .then(r => r.json())
      .then(data => { setMatches(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const predict = async (match) => {
    setPredicting(true);
    setPrediction(null);
    setModalVisible(true);
    try {
      const res = await fetch(`${API_BASE}/ai/predict_match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_club_id: match.home_club_id, away_club_id: match.away_club_id }),
      });
      const data = await res.json();
      setPrediction(data);
    } catch (e) {
      setPrediction({ error: 'Сервер недоступен' });
    } finally {
      setPredicting(false);
    }
  };

  const renderMatch = ({ item: m }) => (
    <TouchableOpacity style={styles.matchCard} onPress={() => predict(m)} activeOpacity={0.7}>
      <Text style={styles.matchMeta}>{m.competition} · {m.date} · {m.season}</Text>
      <View style={styles.matchTeams}>
        <View style={styles.teamBox}>
          <View style={styles.teamAvatar}><Text style={styles.teamAvatarText}>{initials(m.home_club_name)}</Text></View>
          <Text style={styles.teamName} numberOfLines={2}>{m.home_club_name}</Text>
          <Text style={styles.homeLabel}>Хозяева</Text>
        </View>
        <View style={styles.vsBox}>
          <Text style={styles.vsText}>VS</Text>
          <Text style={styles.predictHint}>Нажми для прогноза</Text>
        </View>
        <View style={styles.teamBox}>
          <View style={styles.teamAvatar}><Text style={styles.teamAvatarText}>{initials(m.away_club_name)}</Text></View>
          <Text style={styles.teamName} numberOfLines={2}>{m.away_club_name}</Text>
          <Text style={styles.awayLabel}>Гости</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const pr = prediction?.probabilities || {};
  const hs = prediction?.home_stats || {};
  const as_ = prediction?.away_stats || {};

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={theme.accent} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={m => String(m.game_id)}
          renderItem={renderMatch}
          contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>Матчи для прогноза</Text>
          }
        />
      )}

      {/* Prediction Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Прогноз матча</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {predicting ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator color={theme.accent} size="large" />
                <Text style={styles.loadingText}>Анализирую...</Text>
              </View>
            ) : prediction?.error ? (
              <Text style={styles.errorText}>{prediction.error}</Text>
            ) : prediction ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Score */}
                <View style={styles.scoreBlock}>
                  <Text style={styles.scoreLabel}>ПРЕДСКАЗАННЫЙ СЧЁТ</Text>
                  <Text style={styles.scoreValue}>{prediction.predicted_score}</Text>
                  <Text style={styles.confidenceText}>Точность: {prediction.confidence}</Text>
                </View>

                {/* Teams */}
                <View style={styles.teamsRow}>
                  <Text style={styles.teamNamePred} numberOfLines={2}>{prediction.home_club}</Text>
                  <Text style={styles.goalsRow}>
                    {prediction.predicted_home_goals} — {prediction.predicted_away_goals}
                  </Text>
                  <Text style={styles.teamNamePred} numberOfLines={2}>{prediction.away_club}</Text>
                </View>

                {/* Probabilities */}
                <Text style={styles.sectionLabel}>ВЕРОЯТНОСТЬ ИСХОДА</Text>
                <View style={styles.probBar}>
                  <View style={[styles.probSegment, { flex: pr.home_win || 33, backgroundColor: theme.success }]}>
                    <Text style={styles.probText}>{pr.home_win}%</Text>
                  </View>
                  <View style={[styles.probSegment, { flex: pr.draw || 25, backgroundColor: theme.warning }]}>
                    <Text style={styles.probText}>{pr.draw}%</Text>
                  </View>
                  <View style={[styles.probSegment, { flex: pr.away_win || 33, backgroundColor: theme.danger }]}>
                    <Text style={styles.probText}>{pr.away_win}%</Text>
                  </View>
                </View>
                <View style={styles.probLegend}>
                  <Text style={[styles.probLegendItem, { color: theme.success }]}>● Хозяева</Text>
                  <Text style={[styles.probLegendItem, { color: theme.warning }]}>● Ничья</Text>
                  <Text style={[styles.probLegendItem, { color: theme.danger }]}>● Гости</Text>
                </View>

                {/* Stats */}
                <Text style={styles.sectionLabel}>СТАТИСТИКА</Text>
                {[
                  ['Победы (посл. 20)', hs.wins, as_.wins],
                  ['Ср. голов забито', hs.goals_scored, as_.goals_scored],
                  ['Ср. голов пропущено', hs.goals_conceded, as_.goals_conceded],
                ].map(([label, hv, av]) => (
                  <View key={label} style={styles.statCompRow}>
                    <Text style={styles.statCompVal}>{hv ?? '—'}</Text>
                    <Text style={styles.statCompLabel}>{label}</Text>
                    <Text style={styles.statCompVal}>{av ?? '—'}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  sectionTitle: { color: theme.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  matchCard: {
    backgroundColor: theme.bgCard, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: theme.border,
  },
  matchMeta: { color: theme.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  matchTeams: { flexDirection: 'row', alignItems: 'center' },
  teamBox: { flex: 1, alignItems: 'center' },
  teamAvatar: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: theme.bgSecondary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  teamAvatarText: { color: theme.textSecondary, fontSize: 14, fontWeight: '800' },
  teamName: { color: theme.textPrimary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  homeLabel: { color: theme.textMuted, fontSize: 10, marginTop: 2 },
  awayLabel: { color: theme.textMuted, fontSize: 10, marginTop: 2 },
  vsBox: { alignItems: 'center', paddingHorizontal: 8 },
  vsText: { color: theme.textMuted, fontSize: 13, fontWeight: '800' },
  predictHint: { color: theme.accent, fontSize: 9, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: '800' },
  closeBtn: { color: theme.textMuted, fontSize: 18, padding: 4 },
  modalCenter: { alignItems: 'center', padding: 32 },
  loadingText: { color: theme.textMuted, marginTop: 12 },
  errorText: { color: theme.danger, textAlign: 'center', padding: 16 },
  scoreBlock: { alignItems: 'center', paddingVertical: 20 },
  scoreLabel: { color: theme.textMuted, fontSize: 10, letterSpacing: 0.8, fontWeight: '700' },
  scoreValue: { color: theme.textPrimary, fontSize: 52, fontWeight: '900', letterSpacing: -2, marginTop: 4 },
  confidenceText: { color: theme.textMuted, fontSize: 11, marginTop: 4 },
  teamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  teamNamePred: { flex: 1, color: theme.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  goalsRow: { color: theme.accent, fontSize: 14, fontWeight: '800', paddingHorizontal: 8 },
  sectionLabel: { color: theme.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  probBar: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', height: 32, marginBottom: 8 },
  probSegment: { alignItems: 'center', justifyContent: 'center' },
  probText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  probLegend: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  probLegendItem: { fontSize: 11 },
  statCompRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  statCompVal: { color: theme.textPrimary, fontSize: 16, fontWeight: '800', width: 40, textAlign: 'center' },
  statCompLabel: { color: theme.textMuted, fontSize: 12, flex: 1, textAlign: 'center' },
});
