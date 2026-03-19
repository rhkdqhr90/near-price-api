import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ELASTICSEARCH_CLIENT,
  createElasticsearchClient,
} from '../config/elasticsearch.config';
import { Product } from './entities/product.entity';
import { ProductSearchService } from './product-search.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Product])],
  providers: [
    {
      provide: ELASTICSEARCH_CLIENT,
      useFactory: (configService: ConfigService) =>
        createElasticsearchClient(configService),
      inject: [ConfigService],
    },
    ProductSearchService,
  ],
  exports: [ProductSearchService],
})
export class ProductSearchModule {}
