import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { chatApi, getChatHubUrl } from '../services/api';
import type { ChatMessageDto } from '../types';

type ListItem =
  | { kind: 'msg'; data: ChatMessageDto }
  | { kind: 'day'; id: string; label: string };

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function dayLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Bugün';
    if (d.toDateString() === yesterday.toDateString()) return 'Dün';
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

function buildListItems(messages: ChatMessageDto[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDay = '';
  for (const m of messages) {
    const label = dayLabel(m.sentAt);
    if (label && label !== lastDay) {
      items.push({ kind: 'day', id: `day-${label}-${m.sentAt}`, label });
      lastDay = label;
    }
    items.push({ kind: 'msg', data: m });
  }
  return items;
}

function MessageBubble({
  msg,
  myUserId,
}: {
  msg: ChatMessageDto;
  myUserId: string | null;
}) {
  // Ben = saha personeli kendi mesajı (sağ / turuncu); ofis = sol
  const isMe =
    myUserId != null
      ? msg.senderUserId === myUserId
      : msg.isFromFieldWorker;

  return (
    <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        {!isMe && (
          <Text style={styles.senderName}>
            {msg.senderName}
            <Text style={styles.senderRole}> · Operasyon</Text>
          </Text>
        )}
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{msg.body}</Text>
        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
          {formatTime(msg.sentAt)}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const connectionRef = useRef<HubConnection | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const upsertMessage = useCallback((msg: ChatMessageDto) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      if (
        msg.clientMessageId &&
        prev.some((m) => m.clientMessageId === msg.clientMessageId)
      ) {
        return prev.map((m) =>
          m.clientMessageId === msg.clientMessageId ? msg : m,
        );
      }
      return [...prev, msg];
    });
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const loadConversation = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null);
      const uid = await SecureStore.getItemAsync('user_id');
      setMyUserId(uid);
      const { data } = await chatApi.getMyConversation(80);
      setConversationId(data.id);
      setMessages((prev) => {
        const next = data.messages ?? [];
        if (silent && prev.length === next.length) {
          const same = prev.every((m, i) => m.id === next[i]?.id);
          if (same) return prev;
        }
        return next;
      });
      if (data.id && !silent) {
        await chatApi.markRead(data.id).catch(() => undefined);
      }
    } catch (err: any) {
      if (!silent) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Sohbet yüklenemedi.';
        setError(String(msg));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const connectHub = useCallback(async (convId: string) => {
    try {
      const token = await SecureStore.getItemAsync('user_token');
      if (!token) return;

      if (connectionRef.current) {
        try {
          await connectionRef.current.stop();
        } catch {
          /* ignore */
        }
        connectionRef.current = null;
      }

      const connection = new HubConnectionBuilder()
        .withUrl(`${getChatHubUrl()}?access_token=${encodeURIComponent(token)}`)
        .withAutomaticReconnect([0, 2000, 5000, 10000])
        .configureLogging(LogLevel.Warning)
        .build();

      connection.on('MessageCreated', (dto: ChatMessageDto) => {
        if (dto.conversationId === conversationIdRef.current) {
          upsertMessage(dto);
          chatApi.markRead(dto.conversationId).catch(() => undefined);
        }
      });

      connection.onreconnected(async () => {
        try {
          await connection.invoke('JoinConversation', convId);
        } catch {
          /* ignore */
        }
      });

      await connection.start();
      if (connection.state === HubConnectionState.Connected) {
        await connection.invoke('JoinConversation', convId);
      }
      connectionRef.current = connection;
    } catch (err) {
      console.warn('[Chat] SignalR bağlanamadı, polling ile devam:', err);
    }
  }, [upsertMessage]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        await loadConversation(false);
        if (!active) return;
      })();

      // SignalR düşse bile 4 sn'de bir sessiz yenile
      const poll = setInterval(() => {
        if (active) void loadConversation(true);
      }, 4_000);

      return () => {
        active = false;
        clearInterval(poll);
      };
    }, [loadConversation]),
  );

  useEffect(() => {
    if (!conversationId) return;
    void connectHub(conversationId);
    return () => {
      const conn = connectionRef.current;
      connectionRef.current = null;
      if (conn) {
        conn.stop().catch(() => undefined);
      }
    };
  }, [conversationId, connectHub]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadConversation(true);
    });
    return () => sub.remove();
  }, [loadConversation]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const clientMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ChatMessageDto = {
      id: `local-${clientMessageId}`,
      conversationId: conversationId ?? '',
      senderUserId: myUserId ?? '',
      senderName: 'Ben',
      isFromFieldWorker: true,
      body: text,
      sentAt: new Date().toISOString(),
      clientMessageId,
    };

    setInput('');
    setSending(true);
    upsertMessage(optimistic);

    try {
      const { data } = await chatApi.sendMessage(text, clientMessageId);
      upsertMessage(data);
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));
      setError(
        err?.response?.data?.message || err?.message || 'Mesaj gönderilemedi.',
      );
    } finally {
      setSending(false);
    }
  };

  const listItems = buildListItems(messages);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.muted}>Sohbet yükleniyor...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.headerBar}>
        <View style={styles.headerAvatar}>
          <Ionicons name="headset-outline" size={20} color="#F97316" />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Operasyon</Text>
          <Text style={styles.headerSub}>Ofis operasyon ekibi</Text>
        </View>
      </View>

      {error ? (
        <TouchableOpacity style={styles.errorBar} onPress={() => void loadConversation(false)}>
          <Ionicons name="warning-outline" size={14} color="#F97316" />
          <Text style={styles.errorText}>{error} — Yenile</Text>
        </TouchableOpacity>
      ) : null}

      {listItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="chatbubbles-outline" size={40} color="#475569" />
          <Text style={styles.emptyTitle}>Operasyon ekibine yazın</Text>
          <Text style={styles.emptySub}>
            Sorularınızı ve saha bilgilendirmelerinizi buradan iletebilirsiniz.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={(item) =>
            item.kind === 'day' ? item.id : item.data.id
          }
          renderItem={({ item }) => {
            if (item.kind === 'day') {
              return (
                <View style={styles.daySep}>
                  <Text style={styles.daySepText}>{item.label}</Text>
                </View>
              );
            }
            return <MessageBubble msg={item.data} myUserId={myUserId} />;
          }}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Operasyona mesaj yaz..."
          placeholderTextColor="#64748B"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  centered: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  muted: { color: '#94A3B8', marginTop: 12, fontSize: 14 },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1A233A',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9731622',
    borderWidth: 1,
    borderColor: '#F9731644',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#94A3B8', fontSize: 12, marginTop: 1 },

  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9731618',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9731633',
  },
  errorText: { color: '#F97316', fontSize: 12, fontWeight: '600', flex: 1 },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  messageList: { padding: 16, paddingBottom: 8 },
  daySep: { alignItems: 'center', marginVertical: 10 },
  daySepText: {
    color: '#94A3B8',
    fontSize: 11,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },

  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    padding: 12,
    paddingBottom: 6,
  },
  bubbleOther: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  bubbleMe: { backgroundColor: '#F97316' },
  senderName: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  senderRole: { color: '#94A3B8', fontWeight: '500' },
  bubbleText: { color: '#E2E8F0', fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
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
