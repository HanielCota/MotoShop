/** Saudação da navegação da conta: usa só o primeiro nome e cai para "Olá!" sem nome. */
export function customerGreeting(name: string | null | undefined): string {
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName ? `Olá, ${firstName}` : "Olá!";
}
