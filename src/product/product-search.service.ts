import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_CLIENT } from '../config/elasticsearch.config';
import { Product } from './entities/product.entity';
import { SearchProductResponseDto } from './dto/search-product.dto';

interface EsProductDoc {
  id: string;
  name: string;
  category: string;
  createdAt: string;
}

@Injectable()
export class ProductSearchService implements OnModuleInit {
  private readonly logger = new Logger(ProductSearchService.name);
  private readonly indexName: string;

  constructor(
    @Inject(ELASTICSEARCH_CLIENT)
    private readonly esClient: Client,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    private readonly configService: ConfigService,
  ) {
    this.indexName = this.configService.getOrThrow<string>(
      'ELASTICSEARCH_INDEX',
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.esClient.indices.exists({
        index: this.indexName,
      });
      if (!exists) {
        await this.createIndex();
        this.logger.log(`ES 인덱스 생성 완료: ${this.indexName}`);
      } else {
        this.logger.log(`ES 인덱스 확인됨: ${this.indexName}`);
      }
    } catch (err) {
      this.logger.warn(
        `ES 인덱스 초기화 실패 (ES 미연결 상태일 수 있음): ${String(err)}`,
      );
    }
  }

  private async createIndex(): Promise<void> {
    await this.esClient.indices.create({
      index: this.indexName,
      settings: {
        analysis: {
          tokenizer: {
            nori_tokenizer: {
              type: 'nori_tokenizer',
              decompound_mode: 'mixed',
            },
            ngram_tokenizer: {
              type: 'ngram',
              min_gram: 2,
              max_gram: 3,
              token_chars: ['letter', 'digit'],
            },
          },
          analyzer: {
            korean: {
              type: 'custom',
              tokenizer: 'nori_tokenizer',
              filter: ['nori_readingform', 'lowercase'],
            },
            ngram_analyzer: {
              type: 'custom',
              tokenizer: 'ngram_tokenizer',
              filter: ['lowercase'],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'korean',
            fields: {
              keyword: { type: 'keyword' },
              ngram: {
                type: 'text',
                analyzer: 'ngram_analyzer',
              },
            },
          },
          category: { type: 'keyword' },
          createdAt: { type: 'date' },
        },
      },
    });
  }

  async indexProduct(product: Product): Promise<void> {
    try {
      await this.esClient.index({
        index: this.indexName,
        id: product.id,
        document: {
          id: product.id,
          name: product.name,
          category: product.category,
          createdAt: product.createdAt,
        },
      });
    } catch (err) {
      this.logger.warn(`ES 색인 실패 (id: ${product.id}): ${String(err)}`);
    }
  }

  async searchProducts(
    keyword: string,
    limit = 10,
  ): Promise<SearchProductResponseDto[]> {
    if (!keyword.trim()) return [];
    try {
      const result = await this.esClient.search<EsProductDoc>({
        index: this.indexName,
        size: limit,
        query: {
          multi_match: {
            query: keyword,
            fields: ['name^3', 'name.ngram^1'],
            fuzziness: 'AUTO',
          },
        },
        highlight: {
          fields: {
            name: {},
          },
        },
      });

      return result.hits.hits.map((hit) => ({
        id: (hit._source as EsProductDoc).id,
        name: (hit._source as EsProductDoc).name,
        score: hit._score ?? 0,
        highlight:
          (hit.highlight as { name?: string[] } | undefined)?.name ?? [],
      }));
    } catch (err) {
      this.logger.warn(`ES 검색 실패 (keyword: ${keyword}): ${String(err)}`);
      return [];
    }
  }

  async deleteProduct(id: string): Promise<void> {
    try {
      await this.esClient.delete({
        index: this.indexName,
        id,
      });
    } catch (err) {
      this.logger.warn(`ES 삭제 실패 (id: ${id}): ${String(err)}`);
    }
  }

  async syncAllProducts(): Promise<number> {
    const products = await this.productRepository.find();

    if (products.length === 0) {
      return 0;
    }

    const operations = products.flatMap((product) => [
      { index: { _index: this.indexName, _id: product.id } },
      {
        id: product.id,
        name: product.name,
        category: product.category,
        createdAt: product.createdAt,
      },
    ]);

    try {
      const response = await this.esClient.bulk({ operations });
      if (response.errors) {
        const failedCount = response.items.filter(
          (item) => item.index?.error,
        ).length;
        this.logger.warn(
          `ES 벌크 색인 부분 실패: ${failedCount}건 / 전체 ${products.length}건`,
        );
        return products.length - failedCount;
      }
      this.logger.log(`ES 벌크 색인 완료: ${products.length}건`);
      return products.length;
    } catch (err) {
      this.logger.warn(`ES 벌크 색인 실패: ${String(err)}`);
      return 0;
    }
  }
}
