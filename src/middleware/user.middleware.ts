import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UserMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async use(req: Request & { user?: User }, res: Response, next: NextFunction) {
    const userId = req.header('x-user-id');
    if (!userId) {
      throw new UnauthorizedException('Missing user id header');
    }
    const user = await this.userRepo.findOne({
      where: { id: +userId },
      relations: ['role', 'organization'],
    });
    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }
    req.user = user;
    next();
  }
}
