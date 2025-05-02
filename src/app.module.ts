import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ResourceController } from './controllers/resource.controller';

import { UserMiddleware } from './middleware/user.middleware';

import { User } from './entities/user.entity';
import { Organization } from './entities/organization.entity';
import { PatientRecord } from './entities/patient-record.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { AuditLog } from './entities/audit-log.entity';

import { AccessControlService } from './services/access-control.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [User, Organization, PatientRecord, Role, Permission, AuditLog],
      synchronize: true,
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
  controllers: [AppController, ResourceController],
  providers: [AppService, AccessControlService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(UserMiddleware).forRoutes(ResourceController);
  }
}
