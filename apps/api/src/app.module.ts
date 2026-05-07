import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI') ?? 'mongodb+srv://jonnydep1912:jonnydep1912@cluster0.jcnub.mongodb.net/ChatApp?appName=Cluster0',
      }),
    }),
    UsersModule,
    AuthModule,
    ChatModule,
  ],
})
export class AppModule {}
