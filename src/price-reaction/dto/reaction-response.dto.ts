import { PriceReactionType } from '../entities/price-reaction.entity';

export class ReactionResponseDto {
  confirmCount: number;
  reportCount: number;
  myReaction: PriceReactionType | null;
}
