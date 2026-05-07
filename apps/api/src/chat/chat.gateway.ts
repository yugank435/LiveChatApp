import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UsersService } from '../users/users.service';
import { ChatService } from './chat.service';

type AuthedSocket = Socket & {
  data: {
    user?: {
      id: string;
      email: string;
      name: string;
    };
  };
};

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly connectedUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly chatService: ChatService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    const token = this.readToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; email: string }>(token, {
        secret: this.config.get<string>('JWT_SECRET') ?? 'dev-secret',
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        client.disconnect();
        return;
      }

      client.data.user = { id: payload.sub, email: payload.email, name: user.name };
      this.addSocket(payload.sub, client.id);

      const conversationIds = await this.chatService.userConversationIds(payload.sub);
      conversationIds.forEach((conversationId) => client.join(this.conversationRoom(conversationId)));

      await this.usersService.setPresence(payload.sub, true);
      this.server.emit('presence:update', { userId: payload.sub, online: true });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    const userId = client.data.user?.id;
    if (!userId) {
      return;
    }

    const stillOnline = this.removeSocket(userId, client.id);
    if (!stillOnline) {
      await this.usersService.setPresence(userId, false);
      this.server.emit('presence:update', {
        userId,
        online: false,
        lastSeen: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { conversationId: string; body: string },
  ) {
    const userId = client.data.user?.id;
    if (!userId || !payload?.conversationId || !payload?.body?.trim()) {
      return;
    }

    const message = await this.chatService.sendMessage(userId, payload.conversationId, payload.body.trim());
    this.server.to(this.conversationRoom(payload.conversationId)).emit('message:new', message);
    return message;
  }

  @SubscribeMessage('typing:start')
  typingStart(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    this.broadcastTyping(client, payload?.conversationId, true);
  }

  @SubscribeMessage('typing:stop')
  typingStop(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    this.broadcastTyping(client, payload?.conversationId, false);
  }

  private broadcastTyping(client: AuthedSocket, conversationId: string | undefined, typing: boolean) {
    const userId = client.data.user?.id;
    if (!userId || !conversationId) {
      return;
    }

    client.to(this.conversationRoom(conversationId)).emit('typing:update', {
      conversationId,
      userId,
      name: client.data.user?.name,
      typing,
    });
  }

  private readToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string') {
      return authToken;
    }

    const header = client.handshake.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  }

  private addSocket(userId: string, socketId: string) {
    const sockets = this.connectedUsers.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    this.connectedUsers.set(userId, sockets);
  }

  private removeSocket(userId: string, socketId: string) {
    const sockets = this.connectedUsers.get(userId);
    if (!sockets) {
      return false;
    }

    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.connectedUsers.delete(userId);
      return false;
    }

    return true;
  }

  private conversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }
}
