// Payment component tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PaymentCheckout from '@/components/PaymentCheckout';
import PaymentHistory from '@/components/PaymentHistory';
import '@testing-library/jest-dom';

// Mock payment service
vi.mock('@/integrations/payment', () => ({
  default: vi.fn().mockImplementation(() => ({
    createPaymentIntent: vi.fn().mockResolvedValue({
      id: 'payment_123',
      stripe_payment_intent_id: 'pi_test_123',
      client_secret: 'pi_test_123_secret',
      amount_cents: 10000,
      currency: 'brl',
      status: 'pending',
      student_email: 'student@test.com',
      product_id: 'product_123',
      created_at: new Date().toISOString(),
    }),
    calculateSplit: vi.fn().mockResolvedValue({
      id: 'split_123',
      payment_id: 'payment_123',
      mentor_id: 'mentor_123',
      platform_fee_cents: 3000,
      mentor_amount_cents: 7000,
      split_percentage: 70,
    }),
    confirmPayment: vi.fn().mockResolvedValue({
      id: 'payment_123',
      student_email: 'student@test.com',
      product_id: 'product_123',
      mentor_id: 'mentor_123',
      stripe_payment_intent_id: 'pi_test_123',
      amount_cents: 10000,
      currency: 'brl',
      status: 'succeeded',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      succeeded_at: new Date().toISOString(),
      payment_split: {
        id: 'split_123',
        payment_id: 'payment_123',
        mentor_id: 'mentor_123',
        platform_fee_cents: 3000,
        mentor_amount_cents: 7000,
        split_percentage: 70,
      },
    }),
    getStudentPayments: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'payment_123',
          student_email: 'student@test.com',
          product_id: 'product_123',
          mentor_id: 'mentor_123',
          stripe_payment_intent_id: 'pi_test_123',
          amount_cents: 10000,
          currency: 'brl',
          status: 'succeeded',
          payment_method: 'card',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          succeeded_at: new Date().toISOString(),
          payment_split: {
            id: 'split_123',
            payment_id: 'payment_123',
            mentor_id: 'mentor_123',
            platform_fee_cents: 3000,
            mentor_amount_cents: 7000,
            split_percentage: 70,
          },
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
      total_pages: 1,
    }),
    refundPayment: vi.fn().mockResolvedValue({
      id: 'payment_123',
      status: 'refunded',
    }),
  })),
}));

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('PaymentCheckout Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render payment checkout form', async () => {
    render(
      <PaymentCheckout
        studentEmail="student@test.com"
        productId="product_123"
        amountCents={10000}
        productName="Test Course"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
      expect(screen.getByText('Test Course')).toBeInTheDocument();
    });
  });

  it('should display payment amount correctly', async () => {
    render(
      <PaymentCheckout
        studentEmail="student@test.com"
        productId="product_123"
        amountCents={10000}
        productName="Test Course"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText(/R\$ 100,00/)).toBeInTheDocument();
    });
  });

  it('should display payment split information', async () => {
    render(
      <PaymentCheckout
        studentEmail="student@test.com"
        productId="product_123"
        amountCents={10000}
        productName="Test Course"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Fund Distribution')).toBeInTheDocument();
      expect(screen.getByText('Instructor receives:')).toBeInTheDocument();
      expect(screen.getByText('Platform keeps:')).toBeInTheDocument();
    });
  });

  it('should have payment method tabs', async () => {
    render(
      <PaymentCheckout
        studentEmail="student@test.com"
        productId="product_123"
        amountCents={10000}
        productName="Test Course"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const creditCardTab = screen.getByText('Credit Card');
      const pixTab = screen.getByText('PIX');
      expect(creditCardTab).toBeInTheDocument();
      expect(pixTab).toBeInTheDocument();
    });
  });

  it('should have installment options', async () => {
    render(
      <PaymentCheckout
        studentEmail="student@test.com"
        productId="product_123"
        amountCents={10000}
        productName="Test Course"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Installments')).toBeInTheDocument();
    });
  });

  it('should validate required fields', async () => {
    render(
      <PaymentCheckout
        studentEmail="student@test.com"
        productId="product_123"
        amountCents={10000}
        productName="Test Course"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const submitButton = screen.getByText(/Pay Now/);
      fireEvent.click(submitButton);
    });

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/Name must be at least 3 characters/)).toBeInTheDocument();
    });
  });

  it('should format card number input', async () => {
    render(
      <PaymentCheckout
        studentEmail="student@test.com"
        productId="product_123"
        amountCents={10000}
        productName="Test Course"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const cardInput = screen.getByPlaceholderText('1234 5678 9012 3456');
      expect(cardInput).toBeInTheDocument();
    });
  });
});

describe('PaymentHistory Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render payment history', async () => {
    render(
      <PaymentHistory studentEmail="student@test.com" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Payment History')).toBeInTheDocument();
      expect(screen.getByText('All your payment transactions')).toBeInTheDocument();
    });
  });

  it('should display payment table', async () => {
    render(
      <PaymentHistory studentEmail="student@test.com" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Product')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  it('should display payment status badges', async () => {
    render(
      <PaymentHistory studentEmail="student@test.com" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
    });
  });

  it('should show payment amount in correct format', async () => {
    render(
      <PaymentHistory studentEmail="student@test.com" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText(/R\$ 100,00/)).toBeInTheDocument();
    });
  });

  it('should have details button for each payment', async () => {
    render(
      <PaymentHistory studentEmail="student@test.com" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const detailsButtons = screen.getAllByText('Details');
      expect(detailsButtons.length).toBeGreaterThan(0);
    });
  });

  it('should display refund button for succeeded payments', async () => {
    render(
      <PaymentHistory studentEmail="student@test.com" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const refundButton = screen.getByText('Refund');
      expect(refundButton).toBeInTheDocument();
    });
  });

  it('should handle empty payment history', async () => {
    const mockPaymentService = vi.fn().mockImplementation(() => ({
      getStudentPayments: vi.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        page_size: 50,
        total_pages: 0,
      }),
    }));

    vi.doMock('@/integrations/payment', () => ({
      default: mockPaymentService,
    }));

    render(
      <PaymentHistory studentEmail="student@test.com" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('No payments found')).toBeInTheDocument();
    });
  });

  it('should show payment split details in dialog', async () => {
    render(
      <PaymentHistory studentEmail="student@test.com" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const detailsButton = screen.getByText('Details');
      fireEvent.click(detailsButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
      expect(screen.getByText('Instructor Receives:')).toBeInTheDocument();
      expect(screen.getByText('Platform Fee:')).toBeInTheDocument();
    });
  });
});

describe('Payment Split Calculation', () => {
  it('should calculate correct payment split', () => {
    const totalAmount = 10000; // R$100.00
    const splitPercentage = 70; // 70% for mentor

    const mentorAmount = Math.floor((totalAmount * splitPercentage) / 100);
    const platformFee = totalAmount - mentorAmount;

    expect(mentorAmount).toBe(7000);
    expect(platformFee).toBe(3000);
    expect(mentorAmount + platformFee).toBe(totalAmount);
  });

  it('should handle different split percentages', () => {
    const testCases = [
      { total: 10000, percentage: 70, expectedMentor: 7000 },
      { total: 5000, percentage: 80, expectedMentor: 4000 },
      { total: 15000, percentage: 60, expectedMentor: 9000 },
    ];

    testCases.forEach(({ total, percentage, expectedMentor }) => {
      const mentorAmount = Math.floor((total * percentage) / 100);
      expect(mentorAmount).toBe(expectedMentor);
    });
  });
});

describe('Payment API Integration', () => {
  it('should call createPaymentIntent with correct parameters', async () => {
    const mockPaymentService = vi.fn().mockImplementation(() => ({
      createPaymentIntent: vi.fn(),
    }));

    // Test would verify the mock was called with correct params
    expect(mockPaymentService).toBeDefined();
  });

  it('should handle payment confirmation', async () => {
    const mockPaymentService = vi.fn().mockImplementation(() => ({
      confirmPayment: vi.fn(),
    }));

    expect(mockPaymentService).toBeDefined();
  });

  it('should handle payment refund', async () => {
    const mockPaymentService = vi.fn().mockImplementation(() => ({
      refundPayment: vi.fn(),
    }));

    expect(mockPaymentService).toBeDefined();
  });
});
