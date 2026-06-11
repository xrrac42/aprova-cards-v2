import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Eye, EyeOff, ExternalLink, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'validating' | 'form' | 'redirecting' | 'invalid';
type LinkMode = 'invite' | 'persistent';

const signUpSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(255),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: 'As senhas não coincidem',
  path: ['confirm_password'],
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

interface Invitation {
  product_name: string;
  product_id: string;
  payment_link: string;
}

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

const PageShell = ({ children }: { children: React.ReactNode }) => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
    <div className="pointer-events-none absolute top-0 left-1/2 h-80 w-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
    <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-96 rounded-full bg-secondary/8 blur-[100px]" />
    <div className="relative w-full max-w-md">{children}</div>
  </div>
);

export const StudentSignUpFlow: React.FC = () => {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('code');
  const productToken = searchParams.get('plink');

  const linkMode: LinkMode = productToken ? 'persistent' : 'invite';

  const [step, setStep] = useState<Step>('validating');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: '', email: '', password: '', confirm_password: '' },
  });

  useEffect(() => {
    if (!inviteCode && !productToken) { setStep('invalid'); return; }

    const validate = async () => {
      try {
        let url: string;
        let body: object;

        if (linkMode === 'persistent') {
          url = `${BACKEND}/api/v1/product-link/validate`;
          body = { product_token: productToken };
        } else {
          url = `${BACKEND}/api/v1/invite/validate`;
          body = { invite_code: inviteCode };
        }

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (!data.success || !data.data?.is_valid) {
          setStep('invalid');
          return;
        }
        const { product_name, product_id, payment_link } = data.data;
        if (!payment_link) {
          toast.error('Configuração do produto inválida. Contate seu instrutor.');
          setStep('invalid');
          return;
        }
        setInvitation({ product_name, product_id, payment_link });
        setStep('form');
      } catch {
        setStep('invalid');
      }
    };

    validate();
  }, [inviteCode, productToken]);

  const onSubmit = async (values: SignUpFormValues) => {
    if (!invitation) return;
    setSubmitting(true);

    try {
      let url: string;
      let body: object;

      if (linkMode === 'persistent') {
        url = `${BACKEND}/api/v1/auth/signup/initiate-product-link`;
        body = { product_token: productToken, email: values.email, password: values.password, full_name: values.full_name };
      } else {
        url = `${BACKEND}/api/v1/auth/signup/initiate`;
        body = { invite_code: inviteCode, email: values.email, password: values.password, full_name: values.full_name };
      }

      const initiateResp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const initiateData = await initiateResp.json();
      if (!initiateData.success) {
        toast.error(initiateData.error || 'Erro ao criar conta');
        return;
      }

      setStep('redirecting');
      const kiwifyUrl = `${invitation.payment_link}?email=${encodeURIComponent(values.email)}&name=${encodeURIComponent(values.full_name)}`;
      window.location.href = kiwifyUrl;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'validating') {
    return (
      <PageShell>
        <Card className="border-border/50 shadow-[0_8px_32px_-8px_hsla(0,0%,0%,0.6)]">
          <CardContent className="pb-12 pt-12 text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Validando convite…</p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (step === 'invalid') {
    return (
      <PageShell>
        <Card className="border-border/50 shadow-[0_8px_32px_-8px_hsla(0,0%,0%,0.6)]">
          <CardContent className="pb-12 pt-12 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold">Convite inválido</h2>
            <p className="text-muted-foreground text-sm">
              Este link de convite é inválido ou expirou. Solicite um novo convite ao seu instrutor.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (step === 'redirecting') {
    return (
      <PageShell>
        <Card className="border-border/50 shadow-[0_8px_32px_-8px_hsla(0,0%,0%,0.6)]">
          <CardContent className="pb-12 pt-12 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Redirecionando para o pagamento…</h2>
            <p className="text-muted-foreground text-sm">
              Você será levado ao ambiente seguro da Kiwify.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background py-10 px-4">
      <div className="pointer-events-none absolute top-0 left-1/2 h-80 w-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-96 rounded-full bg-secondary/8 blur-[100px]" />

      <div className="relative max-w-md mx-auto space-y-6">
        <div className="text-center space-y-3 pt-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">
            <GraduationCap className="h-3.5 w-3.5" />
            Convite exclusivo
          </div>
          <h1 className="text-2xl font-bold font-display">{invitation?.product_name}</h1>
          <p className="text-muted-foreground text-sm">
            Crie sua conta e conclua o pagamento para ter acesso imediato.
          </p>
        </div>

        <Card className="border-border/50 shadow-[0_8px_32px_-8px_hsla(0,0%,0%,0.6)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Criar conta</CardTitle>
            <CardDescription>Preencha seus dados para começar</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Maria Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="maria@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Mínimo 8 caracteres"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirm_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar senha</FormLabel>
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Repita a senha"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Alert className="border-border/50 bg-muted/50">
                  <ExternalLink className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Após criar a conta, você será redirecionado à Kiwify para concluir o pagamento com segurança.
                  </AlertDescription>
                </Alert>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando…</>
                  ) : (
                    'Criar conta e ir para o pagamento'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Já tem conta?{' '}
          <a href="/login" className="underline hover:text-foreground transition-colors">Faça login</a>
        </p>
      </div>
    </div>
  );
};

export default StudentSignUpFlow;
