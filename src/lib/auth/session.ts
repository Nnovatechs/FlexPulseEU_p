export type MockUserSession = {
  name: string;
  email: string;
  role: "Research lead";
};

export async function getMockSession(): Promise<MockUserSession> {
  return {
    name: "Eduardo Ulloa Villar",
    email: "eduardo@flexpulseeu.local",
    role: "Research lead",
  };
}
