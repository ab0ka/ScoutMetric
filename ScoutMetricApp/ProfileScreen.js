import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

const SCOUT = {
  name: 'Сәбит Абзал',
  role: 'Старший скаут',
  club: 'ФК Астана',
  region: 'Центр. Азия',
  license: 'UEFA Pro',
  email: 'sabyt@fcastana.kz',
  phone: '+7 777 123 45 67',
  exp: '8 лет',
  spec: 'Полузащитники, Нападающие',
  ageRange: 'до 25 лет',
  bio: 'Профессиональный скаут с опытом работы в Центральной Азии и Европе. Специализация: молодые таланты, полузащитники до 25 лет.',
  avatar: 'АС',
  color: '#2563EB',
};

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={14} color={theme.accent} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);

const StatCard = ({ label, value, color }) => (
  <View style={styles.statCard}>
    <Text style={[styles.statValue, color && { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export default function ProfileScreen() {
  const grade = 'A';
  const gradeColor = theme.success;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: SCOUT.color }]}>
          <Text style={styles.avatarText}>{SCOUT.avatar}</Text>
        </View>
        <Text style={styles.name}>{SCOUT.name}</Text>
        <Text style={styles.role}>{SCOUT.role}</Text>
        <Text style={styles.club}>{SCOUT.club}</Text>
      </View>

      {/* Grade */}
      <View style={styles.gradeCard}>
        <View style={styles.gradeBadge}>
          <Text style={[styles.gradeValue, { color: gradeColor }]}>{grade}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.gradeTitle}>Рейтинг скаута</Text>
          <Text style={styles.gradeSub}>На основе лицензии и опыта</Text>
        </View>
        <View style={styles.licBadge}>
          <Text style={styles.licText}>{SCOUT.license}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Опыт" value={SCOUT.exp} color={theme.accent} />
        <StatCard label="Лицензия" value={SCOUT.license} color={theme.warning} />
        <StatCard label="Регион" value={SCOUT.region} />
      </View>

      {/* Bio */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>О себе</Text>
        <Text style={styles.bioText}>{SCOUT.bio}</Text>
      </View>

      {/* Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Контакты и данные</Text>
        <InfoRow icon="mail-outline" label="Email" value={SCOUT.email} />
        <InfoRow icon="call-outline" label="Телефон" value={SCOUT.phone} />
        <InfoRow icon="location-outline" label="Регион" value={SCOUT.region} />
        <InfoRow icon="football-outline" label="Специализация" value={SCOUT.spec} />
        <InfoRow icon="people-outline" label="Возрастная группа" value={SCOUT.ageRange} />
      </View>

      {/* Edit button */}
      <TouchableOpacity style={styles.editBtn}>
        <Ionicons name="pencil" size={14} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.editBtnText}>Редактировать профиль</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { alignItems: 'center', padding: 28, paddingBottom: 16 },
  avatar: {
    width: 80, height: 80, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { color: theme.textPrimary, fontSize: 22, fontWeight: '800' },
  role: { color: theme.accent, fontSize: 13, fontWeight: '600', marginTop: 4 },
  club: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  gradeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.bgCard, marginHorizontal: 12, marginBottom: 12,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border, gap: 12,
  },
  gradeBadge: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: theme.bg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.success,
  },
  gradeValue: { fontSize: 28, fontWeight: '900' },
  gradeTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: '700' },
  gradeSub: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  licBadge: {
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  licText: { color: theme.warning, fontSize: 11, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 12, marginBottom: 12, gap: 8,
  },
  statCard: {
    flex: 1, backgroundColor: theme.bgCard, borderRadius: 10, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: theme.border,
  },
  statValue: { color: theme.textPrimary, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  statLabel: { color: theme.textMuted, fontSize: 10, marginTop: 3, textAlign: 'center' },
  card: {
    backgroundColor: theme.bgCard, marginHorizontal: 12, marginBottom: 12,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border,
  },
  cardTitle: { color: theme.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  bioText: { color: theme.textPrimary, fontSize: 13, lineHeight: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  infoIcon: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(37,99,235,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { color: theme.textMuted, fontSize: 10 },
  infoValue: { color: theme.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 1 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.accent, marginHorizontal: 12, borderRadius: 12, padding: 14,
  },
  editBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
