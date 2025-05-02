import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  resourceId: number;

  @Column()
  outcome: boolean;

  @Column()
  reason: string;

  @Column('timestamp')
  timestamp: Date;
}
