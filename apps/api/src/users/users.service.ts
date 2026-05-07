import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './user.schema';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  online: boolean;
  lastSeen?: Date;
};

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(input: { name: string; email: string; passwordHash: string }): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.userModel.exists({ email });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    try {
      const user = await this.userModel.create({
        ...input,
        email,
        name: input.name.trim(),
      });
      return this.toPublicUser(user);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.userModel.findById(id).exec();
  }

  async searchUsers(query: string, currentUserId: string): Promise<PublicUser[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return [];
    }

    const users = await this.userModel
      .find({
        _id: { $ne: new Types.ObjectId(currentUserId) },
        $or: [
          { name: { $regex: trimmed, $options: 'i' } },
          { email: { $regex: trimmed, $options: 'i' } },
        ],
      })
      .limit(10)
      .exec();

    return users.map((user) => this.toPublicUser(user));
  }

  async setPresence(id: string, online: boolean): Promise<PublicUser | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          online,
          lastSeen: online ? undefined : new Date(),
        },
        { new: true },
      )
      .exec();
    return user ? this.toPublicUser(user) : null;
  }

  toPublicUser(user: UserDocument): PublicUser {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      online: user.online,
      lastSeen: user.lastSeen,
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }
}
