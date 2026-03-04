import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [User, UserOauth, Store, Product, Price],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    UserModule,
    StoreModule,
    ProductModule,
    PriceModule,
    AuthModule,
  ],
})
export class AppModule {}
