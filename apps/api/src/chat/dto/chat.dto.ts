import { ArrayMinSize, IsArray, IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  participantIds!: string[];
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
