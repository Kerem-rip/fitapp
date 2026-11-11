import { Injectable } from '@nestjs/common';
import { hashPassword, verifyPassword } from '../../common/password.js';

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  verify(password: string, stored: string): Promise<boolean> {
    return verifyPassword(password, stored);
  }
}
