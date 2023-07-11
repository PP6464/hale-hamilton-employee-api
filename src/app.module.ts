import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DeleteShiftController } from './delete-shift/delete-shift.controller';
import { ConfigModule } from '@nestjs/config';

ConfigModule.forRoot();
@Module({
  imports: [],
  controllers: [AppController, DeleteShiftController],
  providers: [AppService],
})
export class AppModule {}
