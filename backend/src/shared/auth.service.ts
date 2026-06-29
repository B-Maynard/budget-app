import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthService {

    constructor(
    ) {}


  /* Returns unauthorized if both subs do not match/are null */
  public determineNotAuth(headers: any) {
    let token = headers["authtoken"];
    let storedToken = process.env.TOKEN;

    if (!token || (storedToken != token)) {
        throw new UnauthorizedException("User doesn't have permissions");
    }
  }
}