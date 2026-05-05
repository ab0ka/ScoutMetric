import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, posColor, fmtValue } from './theme';
import { API_BASE } from './config';

const StatBox = ({ label, value, color }) => (
  <View style={styles.statBox}>
    <Text style={[styles.statValue, color && { color }]}>{value ?? '—'}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Row = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || '—'}</Text>
  </View>
);

export default function PlayerDetailScreen({ route }) {
  const { player: initial } = route.params;
  const [player, setPlayer] = useState(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/players/${initial.player_id}`)
      .then(r => r.json())
      .then(data => { setPlayer(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.accent} size="large" />
    </View>
  );

  const stats = player.stats || {};
  const pos = player.position_group || player.position;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.bigAvatar, { backgroundColor: theme.bgSecondary }]}>
          <Text style={styles.bigAvatarText}>
            {(player.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
          </Text>
        </View>
        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={[styles.posLabel, { color: posColor(pos) }]}>
          {player.sub_position || player.position || '—'}
        </Text>
        <Text style={styles.clubName}>{player.club_name || player.club || '—'}</Text>
        <Text style={styles.leagueName}>{player.league || '—'}</Text>
      </View>

      {/* Value card */}
      <View style={styles.valueCard}>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.valueLabel}>Рыночная стоимость</Text>
          <Text style={styles.valueAmount}>
            {player.market_value_fmt || fmtValue(player.market_value_in_eur)}
          </Text>
        </View>
        {player.contract_expiry && (
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.valueLabel}>Контракт до</Text>
            <Text style={[styles.valueAmount, { fontSize: 16 }]}>
              {String(player.contract_expiry).slice(0, 7)}
            </Text>
          </View>
        )}
      </View>

      {/* Stats */}
      {stats.appearances > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Статистика</Text>
          <View style={styles.statsGrid}>
            <StatBox label="Матчей" value={stats.appearances} />
            <StatBox label="Голов" value={stats.goals} color={theme.success} />
            <StatBox label="Передач" value={stats.assists} color={theme.warning} />
            <StatBox label="Мин/матч" value={stats.minutes_per_game} />
            <StatBox label="ЖК" value={stats.yellow_cards} color={theme.warning} />
            <StatBox label="КК" value={stats.red_cards} color={theme.danger} />
          </View>
        </View>
      )}

      {/* Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Информация</Text>
        <Row label="Национальность" value={player.nationality || player.nationality_name} />
        <Row label="Страна рождения" value={player.country_of_birth} />
        <Row label="Возраст" value={player.age ? `${player.age} лет` : null} />
        <Row label="Рост" value={player.height_in_cm || player.height_cm ? `${player.height_in_cm || player.height_cm} см` : null} />
        <Row label="Нога" value={player.foot} />
        <Row label="Агент" value={player.agent || player.agent_name} />
      </View>

      {/* Transfers */}
      {player.transfers?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Трансферы</Text>
          {player.transfers.map((t, i) => (
            <View key={i} style={styles.transferRow}>
              <Text style={styles.transferDate}>{String(t.transfer_date || '').slice(0, 7)}</Text>
              <Text style={styles.transferClub} numberOfLines={1}>{t.from_club_name || '—'}</Text>
              <Ionicons name="arrow-forward" size={12} color={theme.textMuted} style={{ marginHorizontal: 4 }} />
              <Text style={styles.transferClub} numberOfLines={1}>{t.to_club_name || '—'}</Text>
              {t.transfer_fee && t.transfer_fee !== '—' && (
                <Text style={styles.transferFee}>{fmtValue(t.transfer_fee)}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', padding: 24, paddingBottom: 16 },
  bigAvatar: {
    width: 72, height: 72, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  bigAvatarText: { color: theme.textSecondary, fontSize: 24, fontWeight: '800' },
  playerName: { color: theme.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  posLabel: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  clubName: { color: theme.textSecondary, fontSize: 14, marginTop: 4 },
  leagueName: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  valueCard: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: theme.bgCard, marginHorizontal: 12, marginBottom: 12,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border,
  },
  valueLabel: { color: theme.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  valueAmount: { color: theme.success, fontSize: 22, fontWeight: '800', marginTop: 4 },
  card: {
    backgroundColor: theme.bgCard, marginHorizontal: 12, marginBottom: 12,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border,
  },
  cardTitle: { color: theme.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: {
    flex: 1, minWidth: '30%', backgroundColor: theme.bg,
    borderRadius: 8, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: theme.border,
  },
  statValue: { color: theme.textPrimary, fontSize: 18, fontWeight: '800' },
  statLabel: { color: theme.textMuted, fontSize: 10, marginTop: 2 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  infoLabel: { color: theme.textMuted, fontSize: 13 },
  infoValue: { color: theme.textPrimary, fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  transferRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  transferDate: { color: theme.textMuted, fontSize: 11, width: 52 },
  transferClub: { color: theme.textPrimary, fontSize: 12, flex: 1 },
  transferFee: { color: theme.success, fontSize: 11, fontWeight: '700' },
});
