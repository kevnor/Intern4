import { z } from 'zod';

const AddressSchema = z.object({
  street: z.string(),
  postalCode: z.string(),
  city: z.string(),
  country: z.string().optional(),
});

const UserSchema = z.object({
  name: z.string(),
  email: z.email(),
  phone: z.string(),
  birthDate: z.date().optional(),
  address: AddressSchema,
  schoolId: z.string().optional(),
  studyId: z.string().optional(),
  study: z.string(),
  studyPlace: z.string(),
  profilePicture: z.string().optional(),
  seniority: z.number().int(),
  roomNumber: z.number().int(),
  role: z.string(),
  onLeave: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const NewUserInputSchema = z.object({
  name: UserSchema.shape.name,
  email: UserSchema.shape.email,
  phone: UserSchema.shape.phone.optional(),
  birthDate: UserSchema.shape.birthDate.optional(),
  address: AddressSchema.partial(),
  schoolId: UserSchema.shape.schoolId.optional(),
  studyId: UserSchema.shape.studyId.optional(),
  profilePicture: UserSchema.shape.profilePicture.optional(),
  seniority: UserSchema.shape.seniority.default(0),
  roomNumber: UserSchema.shape.roomNumber.default(0),
  role: UserSchema.shape.role,
  onLeave: UserSchema.shape.onLeave.default(false),
  isActive: UserSchema.shape.isActive.default(true),
});

export type NewUserInput = z.infer<typeof NewUserInputSchema>;

export const UpdateUserInputSchema = z.object({
  name: UserSchema.shape.name.optional(),
  email: UserSchema.shape.email.optional(),
  phone: UserSchema.shape.phone.optional(),
  birthDate: UserSchema.shape.birthDate.optional(),
  address: AddressSchema.partial().optional(),
  schoolId: UserSchema.shape.schoolId.optional(),
  studyId: UserSchema.shape.studyId.optional(),
  profilePicture: UserSchema.shape.profilePicture.optional(),
  seniority: UserSchema.shape.seniority.optional(),
  roomNumber: UserSchema.shape.roomNumber.optional(),
  onLeave: UserSchema.shape.onLeave.optional(),
  isActive: UserSchema.shape.isActive.optional(),
  roleId: z.string().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;

export type BasicUserWithRole = {
  id: string;
  name: string;
  email: string;
  role?: string;
  onLeave: boolean;
  isActive: boolean;
};

export type ResidentDirectoryUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string | null;
  study: string;
  studyPlace: string;
  seniority: number;
  roomNumber: number | null;
  createdAt: string | null;
  profilePicture?: string;
  role?: string;
  onLeave: boolean;
  isActive: boolean;
  address: {
    street: string;
    postalCode: string;
    city: string;
    country?: string;
  };
};

export type Role = {
  id: string;
  name: string;
};
