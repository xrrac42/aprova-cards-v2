import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface SuccessData {
  mentorName: string;
  productName: string;
  studentEmail: string;
  loading: boolean;
  error: string | null;
  emailSent: boolean;
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SuccessData>({
    mentorName: '',
    productName: '',
    studentEmail: '',
    loading: true,
    error: null,
    emailSent: false,
  });

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      setData((prev) => ({ ...prev, loading: false, error: 'Session ID not found' }));
      return;
    }

    const fetchSessionData = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
        const response = await fetch(
          `${apiBase}/checkout/session-info?session_id=${encodeURIComponent(sessionId)}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch session information');
        }

        const json = await response.json();
        if (!json.success) {
          throw new Error(json.error || 'Failed to process session');
        }

        const { mentor_name, product_name, student_email } = json.data;

        setData((prev) => ({
          ...prev,
          mentorName: mentor_name || 'Your Mentor',
          productName: product_name || 'Your Course',
          studentEmail: student_email || '',
          loading: false,
        }));

        // Send welcome email
        if (student_email) {
          try {
            const emailResponse = await fetch(`${apiBase}/welcome-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                student_email,
                mentor_name: mentor_name || 'Your Mentor',
                product_name: product_name || 'Your Course',
                session_id: sessionId,
              }),
            });

            if (emailResponse.ok) {
              setData((prev) => ({ ...prev, emailSent: true }));
            }
          } catch (emailErr) {
            console.error('Failed to send welcome email:', emailErr);
          }
        }
      } catch (err) {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'An error occurred',
        }));
      }
    };

    fetchSessionData();
  }, [searchParams]);

  if (data.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
            <p className="text-gray-600">Processando seu pagamento...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-600 mb-4" />
            <h1 className="text-2xl font-bold text-red-600 mb-2">Erro no pagamento</h1>
            <p className="text-gray-600 text-center mb-6">{data.error}</p>
            <Button onClick={() => navigate('/')} variant="outline">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <Card className="w-full max-w-md border-green-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="h-8 w-8" />
            <CardTitle>Payment Successful!</CardTitle>
          </div>
          <CardDescription className="text-green-50">
            Seu produto foi ativado
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8 space-y-6">
          {/* Welcome Message */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              Welcome to Aprova Cards!
            </h2>
            <p className="text-lg text-gray-700">
              You're now learning with <span className="font-semibold text-indigo-600">{data.mentorName}</span>
            </p>
          </div>

          {/* Course Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Your Course:</p>
            <p className="font-semibold text-gray-900">{data.productName}</p>
          </div>

          {/* Email Confirmation */}
          {data.emailSent && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-gray-900">Welcome email sent!</p>
                <p className="text-gray-600">
                  Check <span className="font-mono text-sm">{data.studentEmail}</span> for login instructions
                </p>
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-gray-900 text-sm">Próximos Passos:</p>
            <ol className="text-sm space-y-2 text-gray-700">
              <li className="flex gap-2">
                <span className="text-indigo-600 font-bold">1.</span>
                <span>Cheque seu email para instruções de login</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-600 font-bold">2.</span>
                <span>Faca login para acessar seus materiais de estudo e começar a aprender</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-600 font-bold">3.</span>
                <span>Explore seus cursos e acompanhe seu progresso</span>
              </li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => navigate('/')}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
            Início
            </Button>
            <Button
              onClick={() => {
                const mentorSlug = data.mentorName.toLowerCase().replace(/\s+/g, '-');
                window.location.href = `/mentor/${mentorSlug}/study`;
              }}
              variant="outline"
              className="flex-1"
            >
              Começar a estudar!
            </Button>
          </div>

          {/* Support Message */}
          <div className="border-t pt-4 text-center text-xs text-gray-500">
            <p>Duvidas? Entre em contato com o suporte ou seu mentor para assistencia.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
