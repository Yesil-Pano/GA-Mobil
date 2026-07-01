import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  text: string;
  sender: 'me' | 'system';
  time: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '0',
    text: 'Sohbet modülü yakında aktif olacaktır. Bu alan grup mesajlaşma ve iş emri yorumları için kullanılacaktır.',
    sender: 'system',
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  },
];

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isMe = msg.sender === 'me';
  const isSystem = msg.sender === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemMsgContainer}>
        <View style={styles.systemMsgBubble}>
          <Ionicons name="information-circle-outline" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
          <Text style={styles.systemMsgText}>{msg.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{msg.text}</Text>
        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{msg.time}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: 'me',
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    // Simulated system reply (until real backend chat is available)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + '_reply',
          text: 'Mesajınız alındı. Sohbet özelliği yakında tam işlevsel olacak.',
          sender: 'system',
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      listRef.current?.scrollToEnd({ animated: true });
    }, 1000);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* ── Header badge ───────────────────────────── */}
      <View style={styles.comingSoon}>
        <Ionicons name="construct-outline" size={14} color="#F97316" />
        <Text style={styles.comingSoonText}>Bu özellik geliştirme aşamasındadır</Text>
      </View>

      {/* ── Messages ──────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble msg={item} />}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {/* ── Input bar ─────────────────────────────── */}
      <View style={styles.inputBar}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={() => Alert.alert('Yakında', 'Dosya ekleme özelliği yakında eklenecek.')}
        >
          <Ionicons name="attach-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Mesaj yaz..."
          placeholderTextColor="#64748B"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="default"
        />

        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim()}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },

  comingSoon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F97316' + '18',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F97316' + '33',
  },
  comingSoonText: { color: '#F97316', fontSize: 12, fontWeight: '600' },

  messageList: { padding: 16, paddingBottom: 8 },

  systemMsgContainer: { alignItems: 'center', marginVertical: 10 },
  systemMsgBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  systemMsgText: { color: '#94A3B8', fontSize: 13, flex: 1, lineHeight: 18 },

  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
    paddingBottom: 6,
  },
  bubbleOther: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  bubbleMe: { backgroundColor: '#F97316' },
  bubbleText: { color: '#E2E8F0', fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { color: '#64748B', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: '#ffffff88' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    backgroundColor: '#1A233A',
    gap: 8,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  input: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#E2E8F0',
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#334155' },
});
