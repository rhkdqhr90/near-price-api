import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * 마실 뱃지 시스템 — 5단계 티어로 분류된 23개 뱃지.
 *
 * 디자인: Claude Design / Masil Badges.html
 * 앱 측 메타데이터: near-price-app/src/data/masilBadges.ts (`MASIL_BADGES`)
 *
 * 기존 BadgeCategory(registration/verification/trust/point) 분류는 유지하되 evaluator
 * 내부 그룹핑 용도로만 사용. 외부 노출 분류는 `tier`.
 */
export enum BadgeTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  MYTHIC = 'mythic',
}

export enum BadgeCategory {
  REGISTRATION = 'registration',
  VERIFICATION = 'verification',
  TRUST = 'trust',
  POINT = 'point',
}

@Entity('badge_definitions')
export class BadgeDefinition {
  @PrimaryColumn()
  id: string;

  @Column({ type: 'enum', enum: BadgeTier, default: BadgeTier.BRONZE })
  tier: BadgeTier;

  @Column({ type: 'enum', enum: BadgeCategory })
  category: BadgeCategory;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  icon: string;

  @Column({ type: 'int' })
  threshold: number;

  @Column({ type: 'int', nullable: true })
  durationDays: number | null;

  @Column({ type: 'int' })
  rank: number;
}
