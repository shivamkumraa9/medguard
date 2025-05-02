import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  action: string; // 'read', 'write', 'delete', etc.

  @Column()
  resource: string; // 'patient_record'
}
