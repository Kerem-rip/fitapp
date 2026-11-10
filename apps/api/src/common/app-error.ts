// Hata cevaplarının ortak biçimi: { code, message }.
// code: uygulamanın (mobil/web) tanıdığı sabit kod. message: kullanıcıya gösterilebilir Türkçe metin.
import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

export const conflict = (code: string, message: string) =>
  new ConflictException({ code, message });

export const forbidden = (code: string, message: string) =>
  new ForbiddenException({ code, message });

export const unauthorized = (code: string, message: string) =>
  new UnauthorizedException({ code, message });
