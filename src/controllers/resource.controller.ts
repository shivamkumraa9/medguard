import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { AccessControlService } from '../services/access-control.service';
import { PatientRecord } from '../entities/patient-record.entity';
import { User } from '../entities/user.entity';

@Controller('resources')
export class ResourceController {
  constructor(private readonly acl: AccessControlService) {}

  @Get(':id')
  async getOne(
    @Param('id') id: number,
    @Req() req: Request & { user: User },
  ): Promise<PatientRecord> {
    const user = req.user;
    const record = await this.acl.recordRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!record) throw new NotFoundException('Resource not found');
    const allowed = await this.acl.canAccessResource(user, record, 'read');
    if (!allowed) throw new ForbiddenException('Access denied');
    return record;
  }

  @Get()
  async getAll(@Req() req: Request & { user: User }): Promise<PatientRecord[]> {
    const user = req.user;
    return this.acl.getAccessibleResources(user);
  }

  @Post()
  async create(
    @Body('data') data: string,
    @Req() req: Request & { user: User },
  ): Promise<PatientRecord> {
    const user = req.user;
    return this.acl.createResource(user, data);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body('data') data: string,
    @Req() req: Request & { user: User },
  ): Promise<PatientRecord> {
    const user = req.user;
    return this.acl.updateResource(user, id, data);
  }

  @Get('audit-logs')
  async getLogs(@Req() req: Request & { user: User }) {
    const user = req.user;
    const perms = await this.acl.getPermissionsForRole(user.role);
    if (!perms.includes('read-all')) {
      throw new ForbiddenException('Access denied');
    }
    return this.acl.logRepo.find();
  }
}
