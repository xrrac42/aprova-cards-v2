// Payment history component to display student's payment transactions
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Clock, XCircle, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PaymentService, { PaymentResponse, PaymentListResponse } from '@/integrations/payment';

interface PaymentHistoryProps {
  studentEmail: string;
  onRefund?: (paymentId: string) => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'succeeded':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case 'pending':
    case 'processing':
      return <Clock className="h-5 w-5 text-yellow-600" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-600" />;
    case 'refunded':
      return <RefreshCcw className="h-5 w-5 text-blue-600" />;
    default:
      return null;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'succeeded':
      return <Badge variant="default">Confirmed</Badge>;
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>;
    case 'processing':
      return <Badge variant="secondary">Processing</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'refunded':
      return <Badge variant="outline">Refunded</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  studentEmail,
  onRefund,
}) => {
  const [selectedPayment, setSelectedPayment] = useState<PaymentResponse | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);

  const { data: paymentsData, isLoading, error } = useQuery({
    queryKey: ['payments', studentEmail],
    queryFn: async () => {
      const paymentService = new PaymentService(null as any);
      return await paymentService.getStudentPayments(studentEmail, 1, 50);
    },
    enabled: !!studentEmail,
  });

  const handleRefund = async (payment: PaymentResponse) => {
    setSelectedPayment(payment);
    setIsRefundDialogOpen(true);
  };

  const confirmRefund = async () => {
    if (!selectedPayment) return;

    try {
      const paymentService = new PaymentService(null as any);
      await paymentService.refundPayment({
        payment_id: selectedPayment.id,
        reason: 'requested_by_customer',
      });

      setIsRefundDialogOpen(false);
      setSelectedPayment(null);

      if (onRefund) {
        onRefund(selectedPayment.id);
      }
    } catch (error) {
      console.error('Failed to refund payment:', error);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load payments. Please try again later.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>All your payment transactions</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : paymentsData && paymentsData.data.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentsData.data.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {format(new Date(payment.created_at), 'PPP p', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{payment.product_id.substring(0, 8)}...</TableCell>
                    <TableCell className="font-semibold">
                      {(payment.amount_cents / 100).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payment.status)}
                        {getStatusBadge(payment.status)}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{payment.payment_method || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPayment(payment)}
                            >
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Payment Details</DialogTitle>
                              <DialogDescription>
                                Transaction ID: {payment.id}
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-gray-600">Payment Intent ID</p>
                                  <p className="font-semibold text-xs break-all">
                                    {payment.stripe_payment_intent_id}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600">Status</p>
                                  <p className="font-semibold">{getStatusBadge(payment.status)}</p>
                                </div>
                              </div>

                              <div className="border-t pt-4">
                                <p className="text-sm font-semibold mb-2">Payment Breakdown</p>
                                {payment.payment_split ? (
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span>Total Amount:</span>
                                      <span className="font-semibold">
                                        {(payment.amount_cents / 100).toLocaleString('pt-BR', {
                                          style: 'currency',
                                          currency: 'BRL',
                                        })}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-t pt-2">
                                      <span>Instructor Receives:</span>
                                      <span className="font-semibold text-green-600">
                                        {(payment.payment_split.mentor_amount_cents / 100).toLocaleString(
                                          'pt-BR',
                                          {
                                            style: 'currency',
                                            currency: 'BRL',
                                          }
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Platform Fee:</span>
                                      <span className="font-semibold text-red-600">
                                        {(payment.payment_split.platform_fee_cents / 100).toLocaleString(
                                          'pt-BR',
                                          {
                                            style: 'currency',
                                            currency: 'BRL',
                                          }
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-gray-600">Split information not available</p>
                                )}
                              </div>

                              <div className="border-t pt-4">
                                <p className="text-sm text-gray-600 mb-1">Created At</p>
                                <p className="font-semibold">
                                  {format(new Date(payment.created_at), 'PPPpppp', {
                                    locale: ptBR,
                                  })}
                                </p>
                              </div>

                              {payment.succeeded_at && (
                                <div>
                                  <p className="text-sm text-gray-600 mb-1">Succeeded At</p>
                                  <p className="font-semibold">
                                    {format(new Date(payment.succeeded_at), 'PPPpppp', {
                                      locale: ptBR,
                                    })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>

                        {payment.status === 'succeeded' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRefund(payment)}
                          >
                            Refund
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">No payments found</p>
          </div>
        )}

        {/* Refund Confirmation Dialog */}
        <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Refund</DialogTitle>
              <DialogDescription>
                Are you sure you want to refund this payment?
              </DialogDescription>
            </DialogHeader>

            {selectedPayment && (
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">Amount to Refund</p>
                  <p className="text-2xl font-bold">
                    {(selectedPayment.amount_cents / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" onClick={() => setIsRefundDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={confirmRefund}>
                    Confirm Refund
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default PaymentHistory;
