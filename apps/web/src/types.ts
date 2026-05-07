export type User = {
  id: string;
  name: string;
  email: string;
  online?: boolean;
  lastSeen?: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  participants: User[];
  lastMessage: Message | null;
  updatedAt: string;
};

export type AuthResponse = {
  accessToken: string;
  user: User;
};
