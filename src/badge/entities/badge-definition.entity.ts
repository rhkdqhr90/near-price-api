import { Column, Entity, PrimaryColumn } from 'typeorm';

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
