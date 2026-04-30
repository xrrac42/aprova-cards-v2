// Payment checkout component for processing student payments
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import PaymentService, { PaymentIntentResponse, PaymentSplitDTO } from '@/integrations/payment';

interface PaymentCheckoutProps {
  studentEmail: string;
  productId: string;
  amountCents: number;
  productName?: string;
  description?: string;
  onPaymentSuccess?: (paymentId: string) => void;
  onPaymentError?: (error: string) => void;
}

const paymentSchema = z.object({
  payment_method: z.enum(['card', 'pix']),
  full_name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  cpf: z.string().min(11, 'Invalid CPF').max(14, 'Invalid CPF'),
  installments: z.enum(['1', '2', '3', '6', '12']),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

export const PaymentCheckout: React.FC<PaymentCheckoutProps> = ({
  studentEmail,
  productId,
  amountCents,
  productName = 'Course Access',
  description,
  onPaymentSuccess,
  onPaymentError,
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentResponse | null>(null);
  const [paymentSplit, setPaymentSplit] = useState<PaymentSplitDTO | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvc: '',
  });

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_method: 'card',
      full_name: '',
      email: studentEmail,
      cpf: '',
      installments: '1',
    },
  });

  // Initialize payment when component mounts
  useEffect(() => {
    initializePayment();
    calculateSplit();
  }, []);

  const initializePayment = async () => {
    try {
      setLoading(true);
      const paymentService = new PaymentService(null as any); // Should be initialized with API client
      const intent = await paymentService.createPaymentIntent({
        student_email: studentEmail,
        product_id: productId,
        amount_cents: amountCents,
        currency: 'brl',
        description: description,
      });
      setPaymentIntent(intent);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to initialize payment';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const calculateSplit = async () => {
    try {
      const paymentService = new PaymentService(null as any);
      const split = await paymentService.calculateSplit(amountCents, 70.0);
      setPaymentSplit(split);
    } catch (error) {
      console.error('Failed to calculate payment split:', error);
    }
  };

  const handleCardInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'number' | 'expiry' | 'cvc'
  ) => {
    let value = e.target.value.replace(/\D/g, '');

    if (field === 'number') {
      value = value.replace(/(\d{4})(?=\d)/g, '$1 ').substring(0, 19);
    } else if (field === 'expiry') {
      value = value.slice(0, 4);
      if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2);
      }
    } else if (field === 'cvc') {
      value = value.slice(0, 4);
    }

    setCardData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const onSubmit = async (values: PaymentFormValues) => {
    if (!paymentIntent) {
      setErrorMessage('Payment intent not initialized');
      return;
    }

    try {
      setLoading(true);
      setPaymentStatus('processing');
      setErrorMessage(null);

      // In production, you would use Stripe.js to tokenize the card
      // For now, this simulates the payment flow
      const paymentService = new PaymentService(null as any);

      // Create a payment method token (in production, use Stripe.js)
      const paymentMethodId = `pm_test_${Date.now()}`;

      // Confirm the payment
      await paymentService.confirmPayment({
        payment_intent_id: paymentIntent.stripe_payment_intent_id,
        payment_method_id: paymentMethodId,
      });

      setPaymentStatus('success');
      toast.success('Payment successful!');

      if (onPaymentSuccess) {
        onPaymentSuccess(paymentIntent.id);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Payment failed';
      setPaymentStatus('error');
      setErrorMessage(errorMsg);
      toast.error(errorMsg);

      if (onPaymentError) {
        onPaymentError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const amountFormatted = (amountCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const mentorAmount = paymentSplit
    ? (paymentSplit.mentor_amount_cents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    : '-';

  const platformFee = paymentSplit
    ? (paymentSplit.platform_fee_cents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    : '-';

  if (paymentStatus === 'success') {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <h2 className="text-2xl font-bold">Payment Successful!</h2>
            <p className="text-center text-gray-600">
              Your payment has been processed successfully. You now have access to{' '}
              {productName}.
            </p>
            <div className="pt-4">
              <Button onClick={() => setPaymentStatus('idle')} variant="outline">
                Make Another Payment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
          <CardDescription>Complete your payment for {productName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Payment Summary */}
          <div className="space-y-4 rounded-lg bg-gray-50 p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Order Summary</p>
              <p className="text-lg font-semibold">{productName}</p>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{amountFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Fee (30%):</span>
                <span>{platformFee}</span>
              </div>
              <div className="border-t-2 border-gray-200 pt-2 flex justify-between font-bold">
                <span>Total Amount:</span>
                <span className="text-green-600">{amountFormatted}</span>
              </div>
            </div>

            {/* Payment Split Information */}
            <div className="mt-4 space-y-2 rounded-lg bg-white p-3">
              <p className="text-sm font-medium text-gray-600">Fund Distribution</p>
              <div className="flex justify-between text-sm">
                <span>Instructor receives:</span>
                <span className="font-semibold">{mentorAmount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Platform keeps:</span>
                <span className="font-semibold">{platformFee}</span>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Payment Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="font-semibold">Personal Information</h3>

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
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input placeholder="123.456.789-00" {...field} />
                      </FormControl>
                      <FormDescription>Required for Brazilian payments</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-4">
                <h3 className="font-semibold">Payment Method</h3>

                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Tabs value={field.value} onValueChange={field.onChange}>
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="card">Credit Card</TabsTrigger>
                            <TabsTrigger value="pix">PIX</TabsTrigger>
                          </TabsList>

                          <TabsContent value="card" className="space-y-4">
                            <div className="space-y-2">
                              <FormLabel>Card Number</FormLabel>
                              <Input
                                placeholder="1234 5678 9012 3456"
                                value={cardData.number}
                                onChange={(e) => handleCardInputChange(e, 'number')}
                                maxLength={19}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <FormLabel>Expiry Date</FormLabel>
                                <Input
                                  placeholder="MM/YY"
                                  value={cardData.expiry}
                                  onChange={(e) => handleCardInputChange(e, 'expiry')}
                                  maxLength={5}
                                />
                              </div>
                              <div className="space-y-2">
                                <FormLabel>CVC</FormLabel>
                                <Input
                                  placeholder="123"
                                  value={cardData.cvc}
                                  onChange={(e) => handleCardInputChange(e, 'cvc')}
                                  maxLength={4}
                                />
                              </div>
                            </div>

                            <FormField
                              control={form.control}
                              name="installments"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Installments</FormLabel>
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select installments" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="1">1x {amountFormatted}</SelectItem>
                                      <SelectItem value="2">
                                        2x{' '}
                                        {(
                                          amountCents /
                                          100 /
                                          2
                                        ).toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                        })}
                                      </SelectItem>
                                      <SelectItem value="3">
                                        3x{' '}
                                        {(
                                          amountCents /
                                          100 /
                                          3
                                        ).toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                        })}
                                      </SelectItem>
                                      <SelectItem value="6">
                                        6x{' '}
                                        {(
                                          amountCents /
                                          100 /
                                          6
                                        ).toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                        })}
                                      </SelectItem>
                                      <SelectItem value="12">
                                        12x{' '}
                                        {(
                                          amountCents /
                                          100 /
                                          12
                                        ).toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                        })}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TabsContent>

                          <TabsContent value="pix" className="space-y-4">
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                PIX payment will be processed instantly. You will receive a QR code
                                to scan with your bank app.
                              </AlertDescription>
                            </Alert>
                          </TabsContent>
                        </Tabs>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || paymentStatus === 'processing'}
                className="w-full"
              >
                {loading || paymentStatus === 'processing' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  `Pay Now - ${amountFormatted}`
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCheckout;
