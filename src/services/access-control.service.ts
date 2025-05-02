import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { PatientRecord } from '../entities/patient-record.entity';
import { Organization } from '../entities/organization.entity';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AccessControlService {
  constructor(
    @InjectRepository(User) public userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(PatientRecord)
    public recordRepo: Repository<PatientRecord>,
    @InjectRepository(Organization) public orgRepo: Repository<Organization>,
    @InjectRepository(AuditLog) public logRepo: Repository<AuditLog>,
  ) {}

  private async getSubOrgIds(org: Organization): Promise<number[]> {
    const children = await this.orgRepo.find({ where: { parent: org } });
    return children.map((c) => c.id);
  }

  /**
   * Returns flat list of permission actions (e.g. 'read', 'write', 'update', 'read-all').
   */
  async getPermissionsForRole(role: Role): Promise<string[]> {
    const roleWithPerms = await this.roleRepo.findOne({
      where: { id: role.id },
      relations: ['permissions'],
    });
    if (!roleWithPerms) return [];
    return roleWithPerms.permissions.map((p) => p.action);
  }

  /**
   * Checks if user can perform <action> on a patient record.
   * - Must be in same org/sub-org
   * - Owner bypass
   * - Must have either specific or global permission
   */
  async canAccessResource(
    user: User,
    record: PatientRecord,
    action: string,
  ): Promise<boolean> {
    const perms = await this.getPermissionsForRole(user.role);
    const specific = action; // e.g. 'read', 'write', 'update'

    // Org scope check
    const userOrg = await this.orgRepo.findOne({
      where: { id: user.organization.id },
    });
    if (!userOrg) {
      await this.logAccessAttempt(
        user.id,
        record.id,
        false,
        'User organization not found',
      );
      return false;
    }
    const allowedOrgIds = [userOrg.id, ...(await this.getSubOrgIds(userOrg))];
    const recordOwner = await this.userRepo.findOne({
      where: { id: record.owner.id },
      relations: ['organization'],
    });
    const inOrgScope =
      recordOwner && recordOwner.organization
        ? allowedOrgIds.includes(recordOwner.organization.id)
        : false;
    if (!inOrgScope) {
      await this.logAccessAttempt(
        user.id,
        record.id,
        false,
        'Outside organization',
      );
      return false;
    }

    // Owner bypass
    if (record.owner.id === user.id) {
      await this.logAccessAttempt(user.id, record.id, true, 'Owner bypass');
      return true;
    }

    // Permission check
    if (!perms.includes(specific)) {
      await this.logAccessAttempt(
        user.id,
        record.id,
        false,
        'Insufficient permission',
      );
      return false;
    }

    // Allowed
    await this.logAccessAttempt(user.id, record.id, true, 'Allowed');
    return true;
  }

  /**
   * Returns all patient records user can perform <action> on.
   */
  async getAccessibleResources(
    user: User,
    action = 'read',
  ): Promise<PatientRecord[]> {
    const perms = await this.getPermissionsForRole(user.role);
    const specific = action;

    // Scoped permission: access by organization
    if (perms.includes(specific)) {
      const userOrg = await this.orgRepo.findOne({
        where: { id: user.organization.id },
      });
      if (!userOrg) {
        throw new NotFoundException('User organization not found');
      }
      const orgIds = [userOrg.id, ...(await this.getSubOrgIds(userOrg))];
      return this.recordRepo.find({
        where: { owner: { organization: In(orgIds) } },
        relations: ['owner', 'owner.organization'],
      });
    }

    // Fallback: return only own-created records
    return this.recordRepo.find({
      where: { owner: { id: user.id } },
      relations: ['owner', 'owner.organization'],
    });
  }

  async createResource(user: User, data: string): Promise<PatientRecord> {
    const perms = await this.getPermissionsForRole(user.role);
    if (!perms.includes('write')) {
      throw new ForbiddenException('No create permission');
    }

    const record = this.recordRepo.create({ data, owner: user });
    const savedRecord = await this.recordRepo.save(record);

    // Audit log creation
    await this.logRepo.save({
      userId: user.id,
      resourceId: savedRecord.id,
      action: 'create',
      outcome: true,
      reason: 'Resource created',
      timestamp: new Date(),
    });

    return savedRecord;
  }

  async updateResource(
    user: User,
    id: number,
    data: string,
  ): Promise<PatientRecord> {
    const record = await this.recordRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!record) throw new NotFoundException('Resource not found');
    if (!(await this.canAccessResource(user, record, 'update'))) {
      throw new ForbiddenException('No update permission');
    }
    record.data = data;
    return this.recordRepo.save(record);
  }

  async logAccessAttempt(
    userId: number,
    resourceId: number,
    outcome: boolean,
    reason: string,
  ): Promise<void> {
    const log = this.logRepo.create({
      userId,
      resourceId,
      outcome,
      reason,
      timestamp: new Date(),
    });
    await this.logRepo.save(log);
  }
}
