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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { RootTabParamList } from '../types';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { chatApi, getChatHubUrl, type DirectContactDto, type DirectMessageDto } from '../services/api';
import { getAccessToken } from '../utils/sessionTokens';
import { getCurrentUserId, normalizeUserId } from '../utils/workOrders';
import { useTheme } from '../theme/ThemeContext';

function normalizeMessage(msg: DirectMessageDto, myUserId: string | null): DirectMessageDto {
  if (!myUserId) return msg;
  const isMine = normalizeUserId(msg.senderUserId) === normalizeUserId(myUserId);
  return { ...msg, isMine, isReadByOther: isMine ? msg.isReadByOther : false };
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function MessageBubble({ msg }: { msg: DirectMessageDto }) {
  const isMe = msg.isMine;
  return (
    <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        {!isMe && <Text style={styles.senderName}>{msg.senderName}</Text>}
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{msg.body}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{formatTime(msg.sentAt)}</Text>
          {isMe && msg.isReadByOther && (
            <Ionicons name="checkmark-done" size={14} color="#BAE6FD" style={styles.readIcon} />
          )}
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { colors } = useTheme();
  const route = useRoute<RouteProp<RootTabParamList, 'Sohbet'>>();
  const [contacts, setContacts] = useState<DirectContactDto[]>([]);
  const [selectedContact, setSelectedContact] = useState<DirectContactDto | null>(null);
  const [messages, setMessages] = useState<DirectMessageDto[]>([]);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const connectionRef = useRef<HubConnection | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const pendingDeepLinkRef = useRef<{ conversationId?: string; senderUserId?: string } | null>(null);
  const typingHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    void getCurrentUserId().then((id) => {
      myUserIdRef.current = id;
    });
  }, []);

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const { data } = await chatApi.getMessages(conversationId);
      setMessages(data.map((m) => normalizeMessage(m, myUserIdRef.current)));
      await chatApi.markRead(conversationId).catch(() => undefined);
      setContacts((prev) =>
        prev.map((c) =>
          c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c,
        ),
      );
    } catch {
      if (!silent) setError('Mesajlar yüklenemedi.');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  const openContact = useCallback(
    async (contact: DirectContactDto) => {
      setSelectedContact(contact);
      setIsOtherTyping(false);
      setError(null);
      try {
        let conversationId = contact.conversationId;
        let resolved = contact;
        if (!conversationId) {
          const { data } = await chatApi.startConversation(contact.userId);
          conversationId = data.conversationId;
          resolved = { ...contact, ...data, userId: contact.userId };
          setContacts((prev) =>
            prev.map((c) => (c.userId === contact.userId ? resolved : c)),
          );
          setSelectedContact(resolved);
        }
        if (!conversationId) return;
        conversationIdRef.current = conversationId;
        const conn = connectionRef.current;
        if (conn?.state === HubConnectionState.Connected) {
          await conn.invoke('JoinConversation', conversationId);
        }
        await loadMessages(conversationId);
      } catch {
        setError('Konuşma açılamadı.');
      }
    },
    [loadMessages],
  );

  const tryOpenDeepLink = useCallback(
    async (list: DirectContactDto[]) => {
      const pending = pendingDeepLinkRef.current;
      if (!pending) return;
      pendingDeepLinkRef.current = null;

      let contact =
        (pending.senderUserId
          ? list.find((c) => c.userId === pending.senderUserId)
          : undefined) ??
        (pending.conversationId
          ? list.find((c) => c.conversationId === pending.conversationId)
          : undefined);

      if (!contact && pending.senderUserId) {
        try {
          const { data } = await chatApi.startConversation(pending.senderUserId);
          contact = { ...data, userId: pending.senderUserId };
        } catch {
          return;
        }
      }

      if (contact) await openContact(contact);
    },
    [openContact],
  );

  const loadContacts = useCallback(async () => {
    try {
      const { data } = await chatApi.listContacts();
      setContacts(data);
      setError(null);
      await tryOpenDeepLink(data);
    } catch {
      setError('Kişi listesi yüklenemedi.');
    } finally {
      setLoadingContacts(false);
    }
  }, [tryOpenDeepLink]);

  useFocusEffect(
    useCallback(() => {
      const params = route.params;
      if (params?.conversationId || params?.senderUserId) {
        pendingDeepLinkRef.current = {
          conversationId: params.conversationId,
          senderUserId: params.senderUserId,
        };
      }
      void loadContacts();
    }, [loadContacts, route.params]),
  );

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        const connection = new HubConnectionBuilder()
          .withUrl(getChatHubUrl(), {
            accessTokenFactory: async () => (await getAccessToken()) || '',
          })
          .withAutomaticReconnect()
          .configureLogging(LogLevel.Warning)
          .build();

        connection.on('DirectMessageCreated', (dto: DirectMessageDto) => {
          const normalized = normalizeMessage(dto, myUserIdRef.current);
          if (normalized.conversationId === conversationIdRef.current) {
            setMessages((prev) =>
              prev.some((m) => m.id === normalized.id) ? prev : [...prev, normalized],
            );
            void chatApi.markRead(normalized.conversationId).catch(() => undefined);
          }
          void loadContacts();
        });

        connection.on('DirectMessagesRead', () => {
          setMessages((prev) => prev.map((m) => (m.isMine ? { ...m, isReadByOther: true } : m)));
        });

        connection.on('DirectConversationUpdated', () => {
          void loadContacts();
        });

        connection.on('DirectTyping', (payload: { conversationId: string }) => {
          if (payload.conversationId !== conversationIdRef.current) return;
          setIsOtherTyping(true);
          if (typingHideRef.current) clearTimeout(typingHideRef.current);
          typingHideRef.current = setTimeout(() => setIsOtherTyping(false), 2500);
        });

        await connection.start();
        if (cancelled) {
          await connection.stop();
          return;
        }
        connectionRef.current = connection;
        setIsLive(true);
        if (conversationIdRef.current) {
          await connection.invoke('JoinConversation', conversationIdRef.current);
        }
      } catch {
        setIsLive(false);
      }
    };

    void connect();
    return () => {
      cancelled = true;
      setIsLive(false);
      if (typingHideRef.current) clearTimeout(typingHideRef.current);
      connectionRef.current?.stop().catch(() => undefined);
      connectionRef.current = null;
    };
  }, [loadContacts]);

  useEffect(() => {
    if (isLive || !selectedContact?.conversationId) return;
    const id = setInterval(() => {
      void loadMessages(selectedContact.conversationId!, true);
      void loadContacts();
    }, 4000);
    return () => clearInterval(id);
  }, [isLive, selectedContact?.conversationId, loadMessages, loadContacts]);

  const handleInputChange = (value: string) => {
    setInput(value);
    const conversationId = selectedContact?.conversationId;
    const conn = connectionRef.current;
    if (conversationId && conn?.state === HubConnectionState.Connected) {
      void conn.invoke('SendTyping', conversationId);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    const conversationId = selectedContact?.conversationId;
    if (!text || !conversationId || sending) return;
    setSending(true);
    try {
      const { data } = await chatApi.sendMessage(conversationId, text, `${Date.now()}`);
      const normalized = normalizeMessage(data, myUserIdRef.current);
      setMessages((prev) => (prev.some((m) => m.id === normalized.id) ? prev : [...prev, normalized]));
      setInput('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      setError('Mesaj gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  const filtered = contacts.filter((c) =>
    c.fullName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (!selectedContact) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Kişi ara..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        {loadingContacts ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.orange} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.contactRow} onPress={() => void openContact(item)}>
                <View style={{ flex: 1 }}>
                  <View style={styles.contactTitleRow}>
                    {item.isGaManagement && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badgeLabel || 'GA Yönetim'}</Text>
                      </View>
                    )}
                    <Text style={[styles.contactName, { color: colors.text }]}>{item.fullName}</Text>
                  </View>
                  {!item.isGaManagement && item.companyName ? (
                    <Text style={styles.companyName}>{item.companyName}</Text>
                  ) : null}
                  <Text style={styles.preview} numberOfLines={1}>
                    {item.lastMessagePreview || 'Mesaj yok'}
                  </Text>
                </View>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Mesajlaşabileceğiniz kişi bulunamadı.</Text>
            }
          />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <View style={styles.chatHeader}>
        <TouchableOpacity
          onPress={() => {
            setSelectedContact(null);
            setMessages([]);
            conversationIdRef.current = null;
            setIsOtherTyping(false);
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          {selectedContact.isGaManagement && (
            <Text style={styles.headerBadge}>{selectedContact.badgeLabel || 'GA Yönetim'}</Text>
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]}>{selectedContact.fullName}</Text>
          {isOtherTyping && (
            <Text style={styles.typingText}>Yazıyor...</Text>
          )}
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {loadingMessages ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.orange} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Mesaj yazın..."
          placeholderTextColor="#94A3B8"
          value={input}
          onChangeText={handleInputChange}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.orange }]}
          onPress={() => void sendMessage()}
          disabled={sending || !input.trim()}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  searchInput: { flex: 1, fontSize: 15 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  contactTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  contactName: { fontSize: 16, fontWeight: '700' },
  companyName: { fontSize: 11, color: '#64748B', marginTop: 2 },
  preview: { fontSize: 12, color: '#64748B', marginTop: 4 },
  badge: { backgroundColor: '#1A233A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 32, color: '#94A3B8' },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  headerBadge: { fontSize: 10, fontWeight: '700', color: '#1A233A' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  typingText: { fontSize: 11, color: '#059669', marginTop: 2 },
  messagesContent: { padding: 12, paddingBottom: 8 },
  bubbleRow: { marginBottom: 8, alignItems: 'flex-start' },
  bubbleRowMe: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  bubbleMe: { backgroundColor: '#F97316', borderColor: '#F97316' },
  bubbleOther: {},
  senderName: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 2 },
  bubbleText: { fontSize: 15, color: '#1E293B' },
  bubbleTextMe: { color: '#fff' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 },
  bubbleTime: { fontSize: 10, color: '#94A3B8' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.75)' },
  readIcon: { marginLeft: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: '#EF4444', textAlign: 'center', padding: 8, fontSize: 12 },
});
