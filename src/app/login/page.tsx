import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "@/modules/auth/components/auth-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Acessar a Moto Shop</CardTitle>
          <CardDescription>Acesse sua conta para acompanhar pedidos, salvar favoritos ou administrar sua loja.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-muted-foreground text-sm">Carregando...</p>}>
            <AuthForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
import { Suspense } from "react";
