import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

export const createElasticsearchClient = (
  configService: ConfigService,
): Client => {
  return new Client({
    node: configService.getOrThrow<string>('ELASTICSEARCH_NODE'),
  });
};

export const ELASTICSEARCH_CLIENT = 'ELASTICSEARCH_CLIENT';
