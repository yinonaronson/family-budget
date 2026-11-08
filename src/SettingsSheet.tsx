import { I18nManager, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, REMINDER_TIMES } from './config';
import type { Prefs } from './prefs';
import { layoutFor, STRINGS, type Lang } from './strings';

type Props = {
  visible: boolean;
  prefs: Prefs;
  biometrics: boolean;
  busy: boolean;
  message: string | null;
  intro: boolean;
  lang: Lang;
  onClose: () => void;
  onToggleLock: (on: boolean) => void;
  onToggleReminder: (on: boolean) => void;
  onPickTime: (time: string) => void;
};

export function SettingsSheet(p: Props) {
  const insets = useSafeAreaInsets();
  const s = STRINGS[p.lang];
  const L = layoutFor(p.lang, I18nManager.isRTL);
  const txt = { textAlign: L.textAlign, writingDirection: L.writingDirection };
  const row = { flexDirection: L.rowDirection };
  return (
    <Modal visible={p.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={p.onClose}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.header, row]}>
          <Text style={[styles.title, txt]} accessibilityRole="header">
            {p.intro ? s.introTitle : s.settingsTitle}
          </Text>
          <Pressable onPress={p.onClose} accessibilityRole="button" hitSlop={12}>
            <Text style={styles.close}>{p.intro ? s.maybeLater : s.close}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: 16 }}>
          {p.message ? <Text style={[styles.message, txt]}>{p.message}</Text> : null}

          <View style={styles.card}>
            <Row row={row} txt={txt} label={s.lockLabel} value={p.prefs.lockEnabled} disabled={p.busy || !p.biometrics} onChange={p.onToggleLock} />
            <Text style={[styles.sub, txt]}>
              {p.biometrics ? s.lockSub : s.lockUnavailable}
            </Text>
          </View>

          <View style={styles.card}>
            <Row row={row} txt={txt} label={s.reminderLabel} value={p.prefs.reminderEnabled} disabled={p.busy} onChange={p.onToggleReminder} />
            <Text style={[styles.sub, txt]}>{s.reminderSub}</Text>
            {p.prefs.reminderEnabled ? (
              <View style={[styles.chips, row]}>
                {REMINDER_TIMES.map((t) => {
                  const selected = p.prefs.reminderTime === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => p.onPickTime(t)}
                      disabled={p.busy}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.chip, selected && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

type RowStyle = { flexDirection: 'row' | 'row-reverse' };
type TxtStyle = { textAlign: 'left' | 'right'; writingDirection: 'ltr' | 'rtl' };

function Row({ label, value, disabled, onChange, row, txt }: { label: string; value: boolean; disabled: boolean; onChange: (v: boolean) => void; row: RowStyle; txt: TxtStyle }) {
  return (
    <View style={[styles.row, row]}>
      <Text style={[styles.label, txt]}>{label}</Text>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: COLORS.primary }} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 20, paddingTop: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, textAlign: 'left', flexShrink: 1 },
  close: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 16, fontWeight: '600', color: COLORS.text, flexShrink: 1, textAlign: 'left' },
  sub: { fontSize: 14, color: COLORS.muted, lineHeight: 20, textAlign: 'left' },
  message: { fontSize: 14, color: '#8a3b12', backgroundColor: '#fbebe1', padding: 12, borderRadius: 12, textAlign: 'left' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 15, color: COLORS.text },
  chipTextOn: { color: '#fff', fontWeight: '700' },
});
