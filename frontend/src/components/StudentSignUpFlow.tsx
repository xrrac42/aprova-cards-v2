import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import PaymentCheckout from '@/components/PaymentCheckout';

interface StudentSignUpFlowProps {
  onSignUpComplete?: (studentAuthId: string) => void;
}

const signUpSchema = z.object({
  full_name: z.string().min(3, 'Name must be at least 3 characters').max(255),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

type Step = 'validate_invite' | 'signup_form' | 'payment' | 'confirm_email' | 'complete';

export const StudentSignUpFlow: React.FC<StudentSignUpFlowProps> = ({
  onSignUpComplete,
}) => {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('code');

  const [currentStep, setCurrentStep] = useState<Step>('validate_invite');
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [studentAuthData, setStudentAuthData] = useState<any | null>(null);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      confirm_password: '',
    },
  });

  // Validate invitation code on mount
  useEffect(() => {
    const validateInvite = async () => {
      if (!inviteCode) {
        toast.error('Invalid invitation link');
        setCurrentStep('validate_invite');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch('/api/invitations/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invite_code: inviteCode }),
        });

        const data = await response.json();

        if (!data.success || !data.data.is_valid) {
          toast.error(data.data?.message || 'Invalid or expired invitation');
          setCurrentStep('validate_invite');
          setLoading(false);
          return;
        }

        setInvitation(data.data);
        setCurrentStep('signup_form');
      } catch (error) {
        toast.error('Failed to validate invitation');
        setCurrentStep('validate_invite');
      } finally {
        setLoading(false);
      }
    };

    validateInvite();
  }, [inviteCode]);

  const onSubmitSignUp = async (values: SignUpFormValues) => {
    try {
      setLoading(true);

      // Initiate signup
      const response = await fetch('/api/auth/signup/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: inviteCode,
          email: values.email,
          password: values.password,
          full_name: values.full_name,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Failed to initiate signup');
        return;
      }

      // Move to payment step
      setCurrentStep('payment');
      toast.success('Now complete your payment to activate access');
    } catch (error) {
      toast.error('Failed to initiate signup');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentId: string) => {
    try {
      setLoading(true);
      setPaymentId(paymentId);

      // Complete signup after payment
      const response = await fetch('/api/auth/signup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentId,
          invite_code: inviteCode,
          email: form.getValues('email'),
          full_name: form.getValues('full_name'),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Failed to complete signup');
        return;
      }

      setStudentAuthData(data.data);
      setCurrentStep('complete');
      toast.success('Account created successfully!');

      if (onSignUpComplete) {
        onSignUpComplete(data.data.student_auth_id);
      }
    } catch (error) {
      toast.error('Failed to complete signup');
    } finally {
      setLoading(false);
    }
  };

  if (loading && currentStep === 'validate_invite') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Validating your invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === 'validate_invite' || !invitation) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
            <h2 className="text-2xl font-bold">Invalid Invitation</h2>
            <p className="text-gray-600">
              The invitation link is invalid or has expired.
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === 'complete' && studentAuthData) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h2 className="text-2xl font-bold">Welcome to {invitation.product_name}!</h2>
            <p className="text-gray-600">
              Your account has been created successfully. You can now log in with your email and password.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg text-left space-y-2 text-sm">
              <div>
                <p className="text-gray-600">Email:</p>
                <p className="font-mono">{studentAuthData.email}</p>
              </div>
              <div>
                <p className="text-gray-600">Account ID:</p>
                <p className="font-mono text-xs break-all">{studentAuthData.student_auth_id}</p>
              </div>
            </div>
            <Button onClick={() => window.location.href = '/login'} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Tabs value={currentStep} className="w-full">
          {/* Signup Form Step */}
          <TabsContent value="signup_form">
            <Card>
              <CardHeader>
                <CardTitle>Complete Your Registration</CardTitle>
                <CardDescription>
                  Sign up for {invitation?.product_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitSignUp)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
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
                            <Input type="email" placeholder="john@example.com" {...field} />
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
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <Eye className="h-4 w-4 text-gray-400" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Minimum 8 characters
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirm_password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        You'll need to verify your email and complete a payment to activate access.
                      </AlertDescription>
                    </Alert>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Continue to Payment'
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Step */}
          <TabsContent value="payment">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Complete Your Payment</CardTitle>
                  <CardDescription>
                    Secure your access to {invitation?.product_name}
                  </CardDescription>
                </CardHeader>
              </Card>

              <PaymentCheckout
                studentEmail={form.getValues('email')}
                productId={invitation?.product_id}
                amountCents={10000} // This should come from product pricing
                productName={invitation?.product_name}
                onPaymentSuccess={handlePaymentSuccess}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StudentSignUpFlow;
