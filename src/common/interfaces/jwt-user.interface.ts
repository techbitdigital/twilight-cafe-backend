export interface JwtUser {
  id: number;
  email: string;
  role: 'admin' | 'customer';
}
