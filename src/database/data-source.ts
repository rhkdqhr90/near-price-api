import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../user/entities/user.entity';
import { UserOauth } from '../user/entities/user-oauth.entity';
import { Store } from '../store/entities/store.entity';
import { Product } from '../product/entities/product.entity';
import { Price } from '../price/entities/price.entity';
import { Wishlist } from '../wishlist/entities/wishlist.entity';
import { Notice } from '../notice/entities/notice.entity';
import { Faq } from '../faq/entities/faq.entity';
import { PriceReaction } from '../price-reaction/entities/price-reaction.entity';
import { PriceVerification } from '../price-verification/entities/price-verification.entity';
import { UserTrustScore } from '../trust-score/entities/user-trust-score.entity';
import { BadgeDefinition } from '../badge/entities/badge-definition.entity';
import { UserBadge } from '../badge/entities/user-badge.entity';
import { Inquiry } from '../inquiry/entities/inquiry.entity';
import { Flyer } from '../flyer/entities/flyer.entity';
import { OwnerPost } from '../flyer/entities/owner-post.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'nearprice',
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
  ],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
