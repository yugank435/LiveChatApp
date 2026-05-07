'use client';

import { LogOut, MessageSquarePlus, PanelLeft, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { api, clearSession, getStoredUser, getToken } from '../../lib/api';
import { disconnectSocket, getSocket } from '../../lib/socket';
import { Conversation, Message, User } from '../../types';
import styles from './chat.module.css';

export function ChatClient() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [typingNames, setTypingNames] = useState<Record<string, string>>({});
  const [showSidebar, setShowSidebar] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const typingTimer = useRef<number | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? null,
    [activeId, conversations],
  );
  const chatPartner = findConversationPartner(activeConversation, currentUser?.id);
  const activeTitle = displayName(chatPartner);

  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) {
      router.replace('/login');
      return;
    }

    void api
      .me()
      .then(({ user: freshUser }) => {
        setCurrentUser(freshUser);
        return api.conversations();
      })
      .then((items) => {
        setConversations(items);
        setActiveId((existing) => existing ?? items[0]?.id ?? null);
      })
      .catch(() => {
        clearSession();
        router.replace('/login');
      });

    const socket = getSocket();
    socketRef.current = socket;

    socket?.on('message:new', (message: Message) => {
      setMessages((existing) =>
        existing.some((item) => item.id === message.id) ? existing : [...existing, message],
      );
      setConversations((existing) =>
        existing.map((conversation) =>
          conversation.id === message.conversationId
            ? { ...conversation, lastMessage: message, updatedAt: message.createdAt }
            : conversation,
        ),
      );
    });

    socket?.on('typing:update', (payload: { conversationId: string; userId: string; name?: string; typing: boolean }) => {
      setTypingUsers((existing) => {
        const next = new Set(existing);
        const key = `${payload.conversationId}:${payload.userId}`;
        if (payload.typing) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
      if (payload.name) {
        setTypingNames((existing) => ({ ...existing, [payload.userId]: payload.name as string }));
      }
    });

    socket?.on('presence:update', (payload: { userId: string; online: boolean; lastSeen?: string }) => {
      setConversations((existing) =>
        existing.map((conversation) => ({
          ...conversation,
          participants: conversation.participants.map((participant) =>
            participant.id === payload.userId
              ? { ...participant, online: payload.online, lastSeen: payload.lastSeen }
              : participant,
          ),
        })),
      );
    });

    return () => {
      socket?.off('message:new');
      socket?.off('typing:update');
      socket?.off('presence:update');
    };
  }, [router]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }

    void api.messages(activeId).then(setMessages);
  }, [activeId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeId]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const id = window.setTimeout(() => {
      void api.searchUsers(query).then(setResults);
    }, 220);
    return () => window.clearTimeout(id);
  }, [query]);

  function logout() {
    disconnectSocket();
    clearSession();
    router.replace('/login');
  }

  async function startConversation(user: User) {
    const conversation = await api.createConversation([user.id]);
    setConversations((existing) => {
      const withoutDuplicate = existing.filter((item) => item.id !== conversation.id);
      return [conversation, ...withoutDuplicate];
    });
    setActiveId(conversation.id);
    setQuery('');
    setResults([]);
    setShowSidebar(false);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!activeId || !body) {
      return;
    }

    setDraft('');
    socketRef.current?.emit('typing:stop', { conversationId: activeId });
    socketRef.current?.emit('message:send', { conversationId: activeId, body });
  }

  function updateDraft(value: string) {
    setDraft(value);
    if (!activeId) {
      return;
    }

    socketRef.current?.emit('typing:start', { conversationId: activeId });
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current);
    }
    typingTimer.current = window.setTimeout(() => {
      socketRef.current?.emit('typing:stop', { conversationId: activeId });
    }, 900);
  }

  const someoneTyping =
    activeId && currentUser
      ? Array.from(typingUsers).some((key) => key === `${activeId}:${chatPartner?.id}`)
      : false;
  const typingName = chatPartner?.id
    ? typingNames[chatPartner.id] ?? displayName(chatPartner)
    : 'Someone';

  return (
    <main className={styles.page}>
      <aside className={`${styles.sidebar} ${!showSidebar ? styles.hiddenMobile : ''}`}>
        <header className={styles.sidebarHeader}>
          <div className={styles.account}>
            <strong>{currentUser?.name}</strong>
            <span>{currentUser?.email}</span>
          </div>
          <button className={styles.iconButton} onClick={logout} title="Log out" aria-label="Log out">
            <LogOut size={19} />
          </button>
        </header>

        <section className={styles.search}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            aria-label="Search people"
          />
          {results.length > 0 ? (
            <div className={styles.searchResults}>
              {results.map((user) => (
                <button className={styles.result} key={user.id} onClick={() => startConversation(user)}>
                  <strong>{user.name}</strong>
                  <div className={styles.preview}>{user.email}</div>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <div className={styles.conversationList}>
          {conversations.map((conversation) => {
            const partner = findConversationPartner(conversation, currentUser?.id);
            const name = displayName(partner);
            return (
              <button
                className={`${styles.conversation} ${conversation.id === activeId ? styles.active : ''}`}
                key={conversation.id}
                onClick={() => {
                  setActiveId(conversation.id);
                  setShowSidebar(false);
                }}
              >
                <div className={styles.avatar}>
                  {name.slice(0, 1).toUpperCase()}
                  <span className={`${styles.presence} ${partner?.online ? styles.online : ''}`} />
                </div>
                <div className={styles.conversationText}>
                  <div className={styles.conversationTop}>
                    <strong>{name}</strong>
                    <span className={styles.time}>{formatTime(conversation.updatedAt)}</span>
                  </div>
                  <div className={styles.preview}>
                    {conversation.lastMessage?.body ?? 'No messages yet'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {activeConversation ? (
        <section className={`${styles.chat} ${showSidebar ? styles.hiddenMobile : ''}`}>
          <header className={styles.chatHeader}>
            <button
              className={styles.iconButton}
              onClick={() => setShowSidebar(true)}
              title="Conversations"
              aria-label="Conversations"
            >
              <PanelLeft size={19} />
            </button>
            <div className={styles.avatar}>
              {activeTitle.slice(0, 1).toUpperCase()}
              <span className={`${styles.presence} ${chatPartner?.online ? styles.online : ''}`} />
            </div>
            <div className={styles.chatTitle}>
              <strong>{activeTitle}</strong>
              <span>{chatPartner?.online ? 'Online' : 'Offline'}</span>
            </div>
          </header>

          <div className={styles.messages}>
            {messages.map((message) => {
              const mine = message.senderId === currentUser?.id;
              return (
                <article className={`${styles.bubble} ${mine ? styles.mine : ''}`} key={message.id}>
                  <div>{message.body}</div>
                  <div className={styles.messageMeta}>{formatTime(message.createdAt)}</div>
                </article>
              );
            })}
            <div ref={messageEndRef} />
          </div>
          <div className={styles.typing}>{someoneTyping ? `${typingName} is typing...` : ''}</div>
          <form className={styles.composer} onSubmit={send}>
            <input
              value={draft}
              onChange={(event) => updateDraft(event.target.value)}
              placeholder="Message"
              aria-label="Message"
            />
            <button className={styles.iconButton} title="Send" aria-label="Send">
              <Send size={19} />
            </button>
          </form>
        </section>
      ) : (
        <section className={`${styles.empty} ${showSidebar ? styles.hiddenMobile : ''}`}>
          <div>
            <MessageSquarePlus size={40} />
            <h2>No conversation selected</h2>
          </div>
        </section>
      )}
    </main>
  );
}

function findConversationPartner(conversation: Conversation | null, currentUserId?: string) {
  if (!conversation) {
    return undefined;
  }

  return (
    conversation.participants.find((user) => user.id !== currentUserId) ??
    conversation.participants[0]
  );
}

function displayName(user?: User) {
  return user?.name?.trim() || user?.email?.trim() || 'Unknown user';
}

function formatTime(value?: string) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
