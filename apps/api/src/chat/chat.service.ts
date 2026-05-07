import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/user.schema';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async createConversation(ownerId: string, participantIds: string[]) {
    const uniqueIds = Array.from(new Set([ownerId, ...participantIds]));
    const conversation = await this.conversationModel.create({
      participantIds: uniqueIds.map((id) => new Types.ObjectId(id)),
    });
    return this.getConversation(ownerId, conversation._id.toString());
  }

  async getConversations(userId: string) {
    const conversations = await this.conversationModel
      .find({ participantIds: new Types.ObjectId(userId) })
      .populate('lastMessageId')
      .sort({ updatedAt: -1 })
      .exec();

    return this.serializeConversations(conversations);
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .populate('lastMessageId')
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    this.assertParticipant(conversation, userId);

    return (await this.serializeConversations([conversation]))[0];
  }

  async getMessages(userId: string, conversationId: string) {
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    this.assertParticipant(conversation, userId);

    const messages = await this.messageModel
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 })
      .limit(200)
      .exec();

    return messages.map((message) => this.serializeMessage(message));
  }

  async sendMessage(userId: string, conversationId: string, body: string) {
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    this.assertParticipant(conversation, userId);

    const message = await this.messageModel.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId: new Types.ObjectId(userId),
      body,
    });

    await this.conversationModel
      .findByIdAndUpdate(conversationId, { lastMessageId: message._id }, { timestamps: true })
      .exec();

    return this.serializeMessage(message);
  }

  async userConversationIds(userId: string): Promise<string[]> {
    const conversations = await this.conversationModel
      .find({ participantIds: new Types.ObjectId(userId) }, { _id: 1 })
      .exec();
    return conversations.map((conversation) => conversation._id.toString());
  }

  async conversationParticipantIds(conversationId: string): Promise<string[]> {
    const conversation = await this.conversationModel.findById(conversationId).exec();
    return conversation?.participantIds.map((id) => id.toString()) ?? [];
  }

  private assertParticipant(conversation: ConversationDocument, userId: string) {
    const isParticipant = conversation.participantIds.some((id) => id.toString() === userId);
    if (!isParticipant) {
      throw new ForbiddenException('You are not part of this conversation.');
    }
  }

  private async serializeConversations(conversations: ConversationDocument[]) {
    const participantIds = Array.from(
      new Set(
        conversations.flatMap((conversation) =>
          conversation.participantIds.map((participantId) => participantId.toString()),
        ),
      ),
    );
    const users = await this.userModel
      .find({ _id: { $in: participantIds.map((id) => new Types.ObjectId(id)) } })
      .exec();
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    return conversations.map((conversation) => this.serializeConversation(conversation, usersById));
  }

  private serializeConversation(
    conversation: ConversationDocument,
    usersById: Map<string, UserDocument>,
  ) {
    return {
      id: conversation._id.toString(),
      participants: conversation.participantIds.map((participantId) => {
        const id = participantId.toString();
        const value = usersById.get(id);
        return {
          id,
          name: value?.name,
          email: value?.email,
          online: Boolean(value?.online),
          lastSeen: value?.lastSeen,
        };
      }),
      lastMessage: conversation.lastMessageId
        ? this.serializeMessage(conversation.lastMessageId as unknown as MessageDocument)
        : null,
      updatedAt: conversation.updatedAt,
    };
  }

  private serializeMessage(message: MessageDocument) {
    return {
      id: message._id.toString(),
      conversationId: message.conversationId.toString(),
      senderId: message.senderId.toString(),
      body: message.body,
      createdAt: message.createdAt,
    };
  }
}
