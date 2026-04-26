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
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'validating' | 'form' | 'redirecting' | 'invalid';

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

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

export const StudentSignUpFlow: React.FC = () => {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('code');
  const amountCents = Number(searchParams.get('amount') || '9700');

  const [step, setStep] = useState<Step>('validating');
  const [invitation, setInvitation] = useState<{ product_name: string; product_id: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: '', email: '', password: '', confirm_password: '' },
  });

  useEffect(() => {
    if (!inviteCode) { setStep('invalid'); return; }

    const validate = async () => {
      try {
        const resp = await fetch(`${BACKEND}/api/v1/invite/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invite_code: inviteCode }),
        });
        const data = await resp.json();
        if (!data.success || !data.data?.is_valid) {
          setStep('invalid');
          return;
        }
        setInvitation({ product_name: data.data.product_name, product_id: data.data.product_id });
        setStep('form');
      } catch {
        setStep('invalid');
      }
    };

    validate();
  }, [inviteCode]);

  const onSubmit = async (values: SignUpFormValues) => {
    if (!inviteCode || !invitation) return;
    setSubmitting(true);

    try {
      // 1. Criar conta no Supabase
      const initiateResp = await fetch(`${BACKEND}/api/v1/auth/signup/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: inviteCode,
          email: values.email,
          password: values.password,
          full_name: values.full_name,
        }),
      });
      const initiateData = await initiateResp.json();
      if (!initiateData.success) {
        toast.error(initiateData.error || 'Erro ao criar conta');
        return;
      }

      // 2. Criar sessão de checkout Stripe
      setStep('redirecting');
      const checkoutResp = await fetch(`${BACKEND}/api/v1/invite/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: inviteCode,
          amount_cents: amountCents,
          currency: 'brl',
        }),
      });
      const checkoutData = await checkoutResp.json();
      if (!checkoutData.success || !checkoutData.data?.session_url) {
        toast.error(checkoutData.error || 'Erro ao iniciar pagamento');
        setStep('form');
        return;
      }

      // 3. Redirecionar para o Stripe
      window.location.href = checkoutData.data.session_url;
    } catch (err: any) {
      toast.error(err.message || 'Erro inesperado');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'validating') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Validando convite…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-2xl font-bold">Convite inválido</h2>
            <p className="text-muted-foreground">
              Este link de convite é inválido ou expirou. Solicite um novo convite ao seu instrutor.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'redirecting') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <h2 className="text-xl font-semibold">Redirecionando para o pagamento…</h2>
            <p className="text-muted-foreground text-sm">
              Você será levado ao ambiente seguro do Stripe.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{invitation?.product_name}</h1>
          <p className="text-muted-foreground text-sm">
            Crie sua conta e conclua o pagamento para ter acesso imediato.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Criar conta</CardTitle>
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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

                <Alert>
                  <ExternalLink className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Após criar a conta, você será redirecionado ao Stripe para concluir o pagamento com segurança.
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
          <a href="/login" className="underline hover:text-foreground">Faça login</a>
        </p>
      </div>
    </div>
  );
};

export default StudentSignUpFlow;
