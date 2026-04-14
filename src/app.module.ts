import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { createThrottlerConfig } from './config/throttler.config';
import { UserModule } from './user/user.module';
import { StoreModule } from './store/store.module';
import { ProductModule } from './product/product.module';
import { PriceModule } from './price/price.module';
import { AuthModule } from './auth/auth.module';
import { UserOauth } from './user/entities/user-oauth.entity';
import { Store } from './store/entities/store.entity';
import { User } from './user/entities/user.entity';
import { Product } from './product/entities/product.entity';
import { Price } from './price/entities/price.entity';
import { Wishlist } from './wishlist/entities/wishlist.entity';
import { WishlistModule } from './wishlist/wishlist.module';
import { UploadModule } from './upload/upload.module';
import { NoticeModule } from './notice/notice.module';
import { Notice } from './notice/entities/notice.entity';
import { FaqModule } from './faq/faq.module';
import { Faq } from './faq/entities/faq.entity';
import { PriceReactionModule } from './price-reaction/price-reaction.module';
import { PriceReaction } from './price-reaction/entities/price-reaction.entity';
import { PriceVerificationModule } from './price-verification/price-verification.module';
import { PriceVerification } from './price-verification/entities/price-verification.entity';
import { TrustScoreModule } from './trust-score/trust-score.module';
import { UserTrustScore } from './trust-score/entities/user-trust-score.entity';
import { BadgeModule } from './badge/badge.module';
import { BadgeDefinition } from './badge/entities/badge-definition.entity';
import { UserBadge } from './badge/entities/user-badge.entity';
import { HealthModule } from './health/health.module';
import { InquiryModule } from './inquiry/inquiry.module';
import { Inquiry } from './inquiry/entities/inquiry.entity';
import { NotificationModule } from './notification/notification.module';
import { FlyerModule } from './flyer/flyer.module';
import { Flyer } from './flyer/entities/flyer.entity';
import { OwnerPost } from './flyer/entities/owner-post.entity';
import { StoreReview } from './store/entities/store-review.entity';
import { NaverModule } from './naver/naver.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 프로덕션: EC2의 .env 파일을 PM2가 직접 읽음 (시스템 환경변수)
      // 개발: 로컬 .env 파일 로드
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createThrottlerConfig,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: configService.getOrThrow<number>('DB_PORT'),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_DATABASE'),
        ssl:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
        entities: [
          User,
          UserOauth,
          Store,
          Product,
          Price,
          Wishlist,
          Notice,
          Faq,
          PriceReaction,
          PriceVerification,
          UserTrustScore,
          BadgeDefinition,
          UserBadge,
          Inquiry,
          Flyer,
          OwnerPost,
          StoreReview,
        ],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    UserModule,
    StoreModule,
    ProductModule,
    PriceModule,
    WishlistModule,
    AuthModule,
    UploadModule,
    NoticeModule,
    FaqModule,
    PriceReactionModule,
    PriceVerificationModule,
    TrustScoreModule,
    BadgeModule,
    HealthModule,
    InquiryModule,
    NotificationModule,
    FlyerModule,
    NaverModule,
    RedisModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
