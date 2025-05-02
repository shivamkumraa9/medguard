import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class PatientRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  data: string; // Can be expanded to actual patient fields

  @ManyToOne(() => User, user => user.ownedRecords)
  owner: User;
}
