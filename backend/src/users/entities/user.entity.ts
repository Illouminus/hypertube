import { Exclude } from "class-transformer";
import type { User } from "generated/prisma/client";


export class UserEntity implements User {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    profilePictureUrl: string;
    preferredLanguage: string;
    fortyTwoId: string | null;
    googleId: string | null;
    resetPasswordToken: string | null;
    resetPasswordExpires: Date | null;
    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    password: string | null;

    constructor(partial: Partial<UserEntity>) {
        Object.assign(this, partial);
    }
}