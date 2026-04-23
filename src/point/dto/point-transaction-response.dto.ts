import {
  PointDirection,
  PointSourceType,
  PointTransactionStatus,
} from '../entities/point-transaction.entity';

export class PointTransactionResponseDto {
  id: string;
  direction: PointDirection;
  status: PointTransactionStatus;
  amount: number;
  signedAmount: number;
  sourceType: PointSourceType;
  sourceId: string;
  createdAt: string;
  effectiveAt: string;
}

export class PointTransactionListResponseDto {
  items: PointTransactionResponseDto[];
  nextCursor: string | null;
}
