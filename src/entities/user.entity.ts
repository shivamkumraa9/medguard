import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Role } from './role.entity';
import { PatientRecord } from './patient-record.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Organization, org => org.users)
  organization: Organization;

  @ManyToOne(() => Role, role => role.users)
  role: Role;

  @OneToMany(() => PatientRecord, record => record.owner)
  ownedRecords: PatientRecord[];
}
