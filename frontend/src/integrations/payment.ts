// Payment API client for communicating with backend payment endpoints
import { APIClient } from './api';

export interface PaymentIntentRequest {
  student_email: string;
  product_id: string;
  amount_cents: number;
  currency?: string;
  description?: string;
}

export interface PaymentIntentResponse {
  id: string;
  stripe_payment_intent_id: string;
  client_secret: string;
  amount_cents: number;
  currency: string;
  status: string;
  student_email: string;
  product_id: string;
  created_at: string;
}

export interface PaymentResponse {
  id: string;
  student_email: string;
  product_id: string;
  mentor_id: string;
  stripe_payment_intent_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  payment_method?: string;
  payment_split?: PaymentSplitDTO;
  created_at: string;
  updated_at: string;
  succeeded_at?: string;
}

export interface PaymentSplitDTO {
  id: string;
  payment_id: string;
  mentor_id: string;
  platform_fee_cents: number;
  mentor_amount_cents: number;
  split_percentage: number;
  transfer_status?: string;
}

export interface PaymentListQuery {
  student_email?: string;
  product_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface PaymentListResponse {
  data: PaymentResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ConfirmPaymentRequest {
  payment_intent_id: string;
  payment_method_id: string;
}

export interface RefundPaymentRequest {
  payment_id: string;
  reason?: string;
}

export interface CalculateSplitRequest {
  total_amount_cents: number;
  split_percentage: number;
}

class PaymentService {
  private client: APIClient;

  constructor(client: APIClient) {
    this.client = client;
  }

  /**
   * Create a payment intent for a new payment
   */
  async createPaymentIntent(
    request: PaymentIntentRequest
  ): Promise<PaymentIntentResponse> {
    const response = await this.client.post<PaymentIntentResponse>(
      '/payments/intents',
      request
    );
    return response.data;
  }

  /**
   * Get a payment by ID
   */
  async getPayment(paymentId: string): Promise<PaymentResponse> {
    const response = await this.client.get<PaymentResponse>(
      `/payments/${paymentId}`
    );
    return response.data;
  }

  /**
   * Confirm a payment with a payment method
   */
  async confirmPayment(
    request: ConfirmPaymentRequest
  ): Promise<PaymentResponse> {
    const response = await this.client.post<PaymentResponse>(
      `/payments/${request.payment_intent_id}/confirm`,
      {
        payment_intent_id: request.payment_intent_id,
        payment_method_id: request.payment_method_id,
      }
    );
    return response.data;
  }

  /**
   * List all payments with optional filters
   */
  async listPayments(query?: PaymentListQuery): Promise<PaymentListResponse> {
    const params = new URLSearchParams();
    if (query?.student_email) {
      params.append('student_email', query.student_email);
    }
    if (query?.product_id) {
      params.append('product_id', query.product_id);
    }
    if (query?.status) {
      params.append('status', query.status);
    }
    if (query?.page) {
      params.append('page', query.page.toString());
    }
    if (query?.page_size) {
      params.append('page_size', query.page_size.toString());
    }

    const response = await this.client.get<PaymentListResponse>(
      `/payments?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get all payments for a student
   */
  async getStudentPayments(
    email: string,
    page?: number,
    pageSize?: number
  ): Promise<PaymentListResponse> {
    const params = new URLSearchParams();
    if (page) {
      params.append('page', page.toString());
    }
    if (pageSize) {
      params.append('page_size', pageSize.toString());
    }

    const response = await this.client.get<PaymentListResponse>(
      `/payments/student/${email}?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Refund a payment
   */
  async refundPayment(request: RefundPaymentRequest): Promise<PaymentResponse> {
    const response = await this.client.post<PaymentResponse>(
      `/payments/${request.payment_id}/refund`,
      {
        reason: request.reason,
      }
    );
    return response.data;
  }

  /**
   * Calculate payment split between mentor and platform
   */
  async calculateSplit(
    totalAmountCents: number,
    splitPercentage: number
  ): Promise<PaymentSplitDTO> {
    const response = await this.client.post<PaymentSplitDTO>(
      '/payments/calculate-split',
      {
        total_amount_cents: totalAmountCents,
        split_percentage: splitPercentage,
      }
    );
    return response.data;
  }
}

export default PaymentService;
