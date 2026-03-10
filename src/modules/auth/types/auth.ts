export interface LoginRequestDTO {
  username: string;
  password: string;
}

export interface LoginResponseDTO {
  token: string;
  user: {
    username?: string;
    name?: string;
    email?: string;
    department?: string;
    title?: string;
    company?: string;
    groups: string[];
  };
}
