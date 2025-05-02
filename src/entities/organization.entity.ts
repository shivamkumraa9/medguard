import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Organization {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // For 2-level hierarchy (null = top level)
  @ManyToOne(() => Organization, org => org.children, { nullable: true })
  parent: Organization;

  @OneToMany(() => Organization, org => org.parent)
  children: Organization[];

  @OneToMany(() => User, user => user.organization)
  users: User[];
}