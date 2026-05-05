import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, posColor, fmtValue } from './theme';
import { API_BASE } from './config';

const POSITIONS = ['', 'Attack', 'Midfield', 'Defender', 'Goalkeeper'];
const POS_LABELS = { '': 'Все', Attack: 'НАП', Midfield: 'ПЗ', Defender: 'ЗАЩ', Goalkeeper: 'ВР' };

export default function PlayersScreen({ navigation }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPlayers = useCallback(async (reset = false) => {
    const currentPage = reset ? 1 : page;
    if (reset) setLoading(true); else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        page: currentPage,
        per_page: 30,
        sort_by: 'market_value_in_eur',
        sort_dir: 'desc',
      });
      if (search) params.append('name', search);
      if (position) params.append('position', position);

      const res = await fetch(`${API_BASE}/players?${params}`);
      const data = await res.json();

      if (reset) {
        setPlayers(data.players || []);
        setPage(2);
      } else {
        setPlayers(prev => [...prev, ...(data.players || [])]);
        setPage(p => p + 1);
      }
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [search, position, page]);

  useEffect(() => {
    fetchPlayers(true);
  }, [search, position]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlayers(true);
  };

  const renderPlayer = ({ item: p }) => (
    <TouchableOpacity
      style={styles.playerCard}
      onPress={() => navigation.navigate('PlayerDetail', { player: p })}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: theme.bgSecondary }]}>
        <Text style={styles.avatarText}>
          {(p.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
        </Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.playerSub} numberOfLines={1}>
          {p.club_name || p.club || '—'} · {p.nationality || p.country_of_birth || '—'}
        </Text>
      </View>
      <View style={styles.playerRight}>
        <Text style={[styles.posTag, { color: posColor(p.position_group || p.position) }]}>
          {POS_LABELS[p.position_group] || p.sub_position || '—'}
        </Text>
        <Text style={styles.playerAge}>{p.age ? `${p.age} л` : '—'}</Text>
        <Text style={styles.playerValue}>{p.market_value_fmt || fmtValue(p.market_value_in_eur)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск игроков..."
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={t => { setSearch(t); setPage(1); }}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Position filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {POSITIONS.map(pos => (
          <TouchableOpacity
            key={pos}
            style={[styles.filterBtn, position === pos && styles.filterBtnActive]}
            onPress={() => { setPosition(pos); setPage(1); }}
          >
            <Text style={[styles.filterBtnText, position === pos && styles.filterBtnTextActive]}>
              {POS_LABELS[pos]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Total */}
      <Text style={styles.totalText}>Найдено: {total.toLocaleString()}</Text>

      {loading ? (
        <ActivityIndicator color={theme.accent} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={players}
          keyExtractor={p => String(p.player_id)}
          renderItem={renderPlayer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          onEndReached={() => { if (!loadingMore && players.length < total) fetchPlayers(false); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.accent} style={{ padding: 16 }} /> : null}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.bgCard, margin: 12, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: theme.border,
  },
  searchInput: { flex: 1, color: theme.textPrimary, fontSize: 14 },
  filterRow: { paddingHorizontal: 12, marginBottom: 8 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: theme.bgCard, marginRight: 8,
    borderWidth: 1, borderColor: theme.border,
  },
  filterBtnActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  filterBtnText: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
  filterBtnTextActive: { color: '#fff' },
  totalText: { color: theme.textMuted, fontSize: 11, paddingHorizontal: 16, marginBottom: 6 },
  playerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.bgCard, marginHorizontal: 12,
    marginBottom: 8, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  avatarText: { color: theme.textSecondary, fontSize: 13, fontWeight: '800' },
  playerInfo: { flex: 1 },
  playerName: { color: theme.textPrimary, fontSize: 14, fontWeight: '700' },
  playerSub: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  playerRight: { alignItems: 'flex-end', gap: 2 },
  posTag: { fontSize: 10, fontWeight: '800' },
  playerAge: { color: theme.textMuted, fontSize: 11 },
  playerValue: { color: theme.success, fontSize: 12, fontWeight: '700' },
});
