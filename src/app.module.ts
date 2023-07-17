import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ShiftController } from './shift/shift.controller';
import { ChatController } from './chat/chat.controller';
import { AuthController } from './auth/auth.controller';

@Module({
  imports: [],
  controllers: [AppController, ShiftController, ChatController, AuthController],
  providers: [AppService],
})
export class AppModule {}
