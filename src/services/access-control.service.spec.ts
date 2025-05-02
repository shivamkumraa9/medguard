import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessControlService } from './access-control.service';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { PatientRecord } from '../entities/patient-record.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { AuditLog } from '../entities/audit-log.entity';

describe('AccessControlService (integration)', () => {
  let service: AccessControlService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          entities: [
            User,
            Organization,
            PatientRecord,
            Role,
            Permission,
            AuditLog,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([
          User,
          Organization,
          PatientRecord,
          Role,
          Permission,
          AuditLog,
        ]),
      ],
      providers: [AccessControlService],
    }).compile();

    service = module.get<AccessControlService>(AccessControlService);

    const orgRepo = module.get<Repository<Organization>>(
      'OrganizationRepository',
    );
    const roleRepo = module.get<Repository<Role>>('RoleRepository');
    const permRepo = module.get<Repository<Permission>>('PermissionRepository');
    const userRepo = module.get<Repository<User>>('UserRepository');
    const recordRepo = module.get<Repository<PatientRecord>>(
      'PatientRecordRepository',
    );

    // Orgs
    await orgRepo.save([
      { id: 1, name: 'A' },
      { id: 2, name: 'B', parent: { id: 1 } },
      { id: 3, name: 'C' },
    ]);

    // Perms
    const perms = await permRepo.save([
      { action: 'read', resource: 'record' },
      { action: 'write', resource: 'record' },
      { action: 'update', resource: 'record' },
    ]);

    // Roles
    const [readP, writeP, updateP] = perms;
    await roleRepo.save([
      { id: 1, name: 'Admin', permissions: [readP, writeP, updateP] },
      { id: 2, name: 'Viewer', permissions: [readP] },
      { id: 3, name: 'Writer', permissions: [readP, writeP, updateP] },
    ]);

    // Users
    await userRepo.save([
      { id: 1, name: 'User1', organization: { id: 1 }, role: { id: 1 } },
      { id: 2, name: 'User2', organization: { id: 2 }, role: { id: 2 } },
      { id: 3, name: 'User3', organization: { id: 2 }, role: { id: 3 } },
      { id: 4, name: 'User4', organization: { id: 3 }, role: { id: 2 } },
    ]);

    // Records
    await recordRepo.save([
      { id: 1, data: 'rec1', owner: { id: 3 } }, // User3's record in B
      { id: 2, data: 'rec2', owner: { id: 2 } }, // User2's record in B
    ]);
  });

  afterAll(async () => {
    await module.close();
  });

  it('Direct Ownership: owner can access and update', async () => {
    const owner = await service.userRepo.findOne({
      where: { id: 3 },
      relations: ['role', 'organization'],
    });
    if (!owner) {
      throw new Error('Owner not found');
    }
    const record = await service.recordRepo.findOne({
      where: { id: 1 },
      relations: ['owner'],
    });
    if (!record) {
      throw new Error('Record not found');
    }
    expect(await service.canAccessResource(owner, record, 'read')).toBe(true);
    expect(await service.canAccessResource(owner, record, 'update')).toBe(true);
  });

  it('Admin Access: admin can access and update another user record', async () => {
    const admin = await service.userRepo.findOne({
      where: { id: 1 },
      relations: ['role', 'organization'],
    });
    if (!admin) {
      throw new Error('Admin not found');
    }
    const record = await service.recordRepo.findOne({
      where: { id: 1 },
      relations: ['owner'],
    });
    if (!record) {
      throw new Error('Record not found');
    }
    expect(await service.canAccessResource(admin, record, 'read')).toBe(true);
    expect(await service.canAccessResource(admin, record, 'update')).toBe(true);
  });

  it('Org Role Read: user in same org can read', async () => {
    const viewerB = await service.userRepo.findOne({
      where: { id: 2 },
      relations: ['role', 'organization'],
    });
    if (!viewerB) {
      throw new Error('Viewer not found');
    }
    const record = await service.recordRepo.findOne({
      where: { id: 1 },
      relations: ['owner'],
    });
    if (!record) {
      throw new Error('Record not found');
    }
    expect(await service.canAccessResource(viewerB, record, 'read')).toBe(true);
  });

  it('Denied: non-owner without write cannot update', async () => {
    const viewerB = await service.userRepo.findOne({
      where: { id: 2 },
      relations: ['role', 'organization'],
    });
    if (!viewerB) {
      throw new Error('Viewer not found');
    }
    const record = await service.recordRepo.findOne({
      where: { id: 1 },
      relations: ['owner'],
    });
    if (!record) {
      throw new Error('Record not found');
    }
    await expect(
      service.canAccessResource(viewerB, record, 'update'),
    ).resolves.toBe(false);
  });

  it('Denied: different org cannot access', async () => {
    const viewerC = await service.userRepo.findOne({
      where: { id: 4 },
      relations: ['role', 'organization'],
    });
    if (!viewerC) {
      throw new Error('Viewer not found');
    }
    const record = await service.recordRepo.findOne({
      where: { id: 1 },
      relations: ['owner'],
    });
    if (!record) {
      throw new Error('Record not found');
    }
    expect(await service.canAccessResource(viewerC, record, 'read')).toBe(
      false,
    );
  });

  it('Denied: no write permission cannot create', async () => {
    const viewerB = await service.userRepo.findOne({
      where: { id: 2 },
      relations: ['role', 'organization'],
    });
    if (!viewerB) {
      throw new Error('Viewer not found');
    }
    await expect(service.createResource(viewerB, 'x')).rejects.toThrow();
  });

  it('Audit Logging: creating record logs entry', async () => {
    const writer = await service.userRepo.findOne({
      where: { id: 3 },
      relations: ['role', 'organization'],
    });
    if (!writer) {
      throw new Error('Writer not found');
    }
    const rec = await service.createResource(writer, 'new');
    const logs = await service.logRepo.find({
      where: { resourceId: rec.id, userId: writer.id },
    });
    expect(logs.length).toBeGreaterThan(0);
  });
});
