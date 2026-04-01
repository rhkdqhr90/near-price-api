import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { SearchProductResponseDto } from './dto/search-product.dto';

@Injectable()
export class ProductSearchService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /** ES 제거 후 no-op — PostgreSQL은 항상 최신 상태 */
  async indexProduct(_product: Product): Promise<void> {}

  /** ES 제거 후 no-op */
  async deleteProduct(_id: string): Promise<void> {}

  async searchProducts(
    keyword: string,
    limit = 10,
  ): Promise<SearchProductResponseDto[]> {
    if (!keyword.trim()) return [];

    const trimmed = keyword.trim();
    const escaped = trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const q = `%${escaped}%`;
    const products = await this.productRepository
      .createQueryBuilder('product')
      .where('product.name ILIKE :q ESCAPE :escape', { q, escape: '\\' })
      .orWhere('product.category ILIKE :q ESCAPE :escape', { q, escape: '\\' })
      .orderBy('product.name', 'ASC')
      .limit(limit)
      .getMany();

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      score: 1,
      highlight: [],
    }));
  }

  /** ES 제거 후 DB 전체 카운트 반환 */
  async syncAllProducts(): Promise<number> {
    return await this.productRepository.count();
  }
}
