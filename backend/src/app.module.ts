import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { MoviesModule } from './movies/movies.module';
import { CommentsModule } from './comments/comments.module';
import { TorrentModule } from './torrent/torrent.module';
import { StreamModule } from './stream/stream.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '../.env',
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    MailModule,
    MoviesModule,
    CommentsModule,
    TorrentModule,
    StreamModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
