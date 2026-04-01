import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductSearchService } from './product-search.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [ProductSearchService],
  exports: [ProductSearchService],
})
export class ProductSearchModule {}
