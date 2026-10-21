import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { MessagesService } from './messages.service';

class SendMessageDto {
  @IsUUID() recipientId: string;
  @IsString() @MinLength(1) @MaxLength(2000) body: string;
  @IsOptional() @IsUUID() artworkId?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  send(@CurrentUser() user: AuthUser, @Body() dto: SendMessageDto) {
    return this.messages.send(user, dto);
  }

  @Get('threads')
  threads(@CurrentUser() user: AuthUser) {
    return this.messages.threads(user.userId);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: AuthUser) {
    return this.messages.unreadCount(user.userId);
  }

  @Get('with/:userId')
  conversation(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.messages.conversation(user, userId);
  }
}
