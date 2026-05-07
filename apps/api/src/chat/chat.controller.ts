import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  conversations(@CurrentUser() user: JwtUser) {
    return this.chatService.getConversations(user.id);
  }

  @Post('conversations')
  createConversation(@CurrentUser() user: JwtUser, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(user.id, dto.participantIds);
  }

  @Get('conversations/:conversationId/messages')
  messages(@CurrentUser() user: JwtUser, @Param('conversationId') conversationId: string) {
    return this.chatService.getMessages(user.id, conversationId);
  }

  @Post('conversations/:conversationId/messages')
  sendMessage(
    @CurrentUser() user: JwtUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, conversationId, dto.body);
  }
}
