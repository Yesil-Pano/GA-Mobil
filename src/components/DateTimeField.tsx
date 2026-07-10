import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { formatWorkOrderDate } from '../utils/workOrderSchedule';

interface Props {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
}

export default function DateTimeField({ label, value, onChange, disabled = false }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [mode, setMode] = useState<'date' | 'time'>('date');
  const [draft, setDraft] = useState(value);

  const openPicker = (nextMode: 'date' | 'time') => {
    if (disabled) return;
    setDraft(value);
    setMode(nextMode);
    setShowPicker(true);
  };

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (!selected) return;
    setDraft(selected);
    if (Platform.OS === 'android') onChange(selected);
  };

  const confirmIos = () => {
    onChange(draft);
    setShowPicker(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => openPicker('date')}
          disabled={disabled}
        >
          <Ionicons name="calendar-outline" size={16} color={disabled ? '#64748B' : '#38BDF8'} />
          <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>
            {formatWorkOrderDate(value).slice(0, 10)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => openPicker('time')}
          disabled={disabled}
        >
          <Ionicons name="time-outline" size={16} color={disabled ? '#64748B' : '#F97316'} />
          <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>
            {formatWorkOrderDate(value).slice(11)}
          </Text>
        </TouchableOpacity>
      </View>

      {showPicker && (
        <View style={styles.pickerBox}>
          <DateTimePicker
            value={draft}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            locale="tr-TR"
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmIos}>
              <Text style={styles.confirmText}>Tamam</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { color: '#64748B', fontSize: 11, fontWeight: '600', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  btnDisabled: { opacity: 0.65 },
  btnText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  btnTextDisabled: { color: '#94A3B8' },
  pickerBox: { marginTop: 8, backgroundColor: '#0F172A', borderRadius: 10, overflow: 'hidden' },
  confirmBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  confirmText: { color: '#F97316', fontWeight: '700', fontSize: 14 },
});
